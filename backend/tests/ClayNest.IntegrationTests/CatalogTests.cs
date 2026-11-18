using System.Net;
using System.Net.Http.Json;
using ClayNest.Application.Catalog;
using ClayNest.Domain.Catalog;
using ClayNest.Domain.Identity;
using ClayNest.Infrastructure.Identity;
using ClayNest.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ClayNest.IntegrationTests;

public sealed class CatalogTests
{
    [DatabaseFact]
    public async Task Draft_publication_variant_lifecycle_and_archive_are_consistent()
    {
        await using var s = await Session.Create();
        var input = s.Input() with { Slug = Guid.NewGuid().ToString() };
        var draft = await s.Save(input);
        input = input with { Variants = [input.Variants[0] with { Id = draft.Variants.Single().Id }] };
        using var hidden = await s.Client.GetAsync("/api/v1/products/" + draft.Slug);
        Assert.Equal(HttpStatusCode.NotFound, hidden.StatusCode);
        var published = await s.Save(input with { Published = true, Revision = draft.Revision }, draft.Id);
        var visible = await s.Client.GetFromJsonAsync<ProductDto>("/api/v1/products/" + draft.Slug);
        Assert.NotNull(visible); Assert.True(visible.IsDemo == false);
        Assert.Equal(20, visible.Variants.Single().DiscountPercent);
        Assert.Equal(0, visible.Variants.Single().StockQty);
        Assert.Empty(visible.Variants.Single().CareNote);
        var original = input.Variants.Single() with { Id = published.Variants.Single().Id, Active = false };
        var added = original with { Id = null, Sku = s.Key + "-B", Active = true, Name = "Second" };
        var changed = await s.Save(input with { Revision = published.Revision, Published = true, Variants = [original, added], Images = [new("/images/slow-living/cup.jpg", "Changed image")] }, draft.Id);
        Assert.Equal(2, changed.Variants.Count);
        visible = await s.Client.GetFromJsonAsync<ProductDto>("/api/v1/products/" + draft.Slug);
        Assert.Single(visible!.Variants); Assert.Equal(added.Sku.ToUpperInvariant(), visible.Variants.Single().Sku);
        using var archived = await s.Send(HttpMethod.Delete, $"/api/v1/admin/catalog/products/{draft.Id}?revision={changed.Revision}");
        Assert.Equal(HttpStatusCode.NoContent, archived.StatusCode);
        using var after = await s.Client.GetAsync("/api/v1/products/" + draft.Slug);
        Assert.Equal(HttpStatusCode.NotFound, after.StatusCode);
    }

    [DatabaseFact]
    public async Task Unique_sku_slug_and_stale_revision_return_conflict_without_partial_writes()
    {
        await using var s = await Session.Create();
        var input = s.Input(); var first = await s.Save(input);
        using var duplicateSku = await s.Send(HttpMethod.Post, "/api/v1/admin/catalog/products", input with { Slug = s.Key + "-other" });
        Assert.Equal(HttpStatusCode.Conflict, duplicateSku.StatusCode);
        using var duplicateSlug = await s.Send(HttpMethod.Post, "/api/v1/admin/catalog/products", input with { Variants = [input.Variants[0] with { Sku = s.Key + "-NEW" }] });
        Assert.Equal(HttpStatusCode.Conflict, duplicateSlug.StatusCode);
        input = input with { Variants = [input.Variants[0] with { Id = first.Variants.Single().Id }] };
        var updated = await s.Save(input with { Revision = first.Revision, Name = "Changed name" }, first.Id);
        using var stale = await s.Send(HttpMethod.Put, "/api/v1/admin/catalog/products/" + first.Id, input with { Revision = first.Revision });
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        var current = await s.Client.GetFromJsonAsync<ProductDto>("/api/v1/admin/catalog/products/" + first.Id);
        Assert.Equal(updated.Revision, current!.Revision); Assert.Equal("Changed name", current.Name);
    }

    [DatabaseFact]
    public async Task Search_filters_same_variant_price_sort_pagination_and_category_visibility()
    {
        await using var s = await Session.Create();
        var input = s.Input() with { Published = true };
        await s.Save(input with { Variants = [input.Variants[0] with { PriceVnd = 100000, OriginalPriceVnd = null, Glaze = "green" }, input.Variants[0] with { Sku = s.Key + "-2", PriceVnd = 500000, OriginalPriceVnd = null, Glaze = "blue" }] });
        await s.Save(input with { Slug = s.Key + "-two", Name = s.Key + " Two", Variants = [input.Variants[0] with { Sku = s.Key + "-3", PriceVnd = 100000, OriginalPriceVnd = null }] });
        var result = await s.Client.GetFromJsonAsync<PageResult<ProductDto>>($"/api/v1/products?category={s.Category.Id}&glaze=blue&maxPrice=200000");
        Assert.Empty(result!.Items);
        result = await s.Client.GetFromJsonAsync<PageResult<ProductDto>>($"/api/v1/products?category={s.Category.Id}&minPrice=200000&sort=price-asc");
        Assert.Single(result!.Items); Assert.Single(result.Items[0].Variants); Assert.Equal(500000, result.Items[0].Variants[0].PriceVnd);
        var page1 = await s.Client.GetFromJsonAsync<PageResult<ProductDto>>($"/api/v1/products?category={s.Category.Id}&pageSize=1&sort=price-asc");
        var page2 = await s.Client.GetFromJsonAsync<PageResult<ProductDto>>($"/api/v1/products?category={s.Category.Id}&pageSize=1&sort=price-asc&page=2");
        Assert.Equal(2, page1!.TotalCount); Assert.NotEqual(page1.Items[0].Id, page2!.Items[0].Id);
        using var categoryHidden = await s.Send(HttpMethod.Put, "/api/v1/admin/catalog/categories/" + s.Category.Id,
            new CategoryInput(s.Category.Name, s.Category.Slug, false, s.Category.Revision));
        Assert.Equal(HttpStatusCode.OK, categoryHidden.StatusCode);
        result = await s.Client.GetFromJsonAsync<PageResult<ProductDto>>($"/api/v1/products?category={s.Category.Id}");
        Assert.Empty(result!.Items);
    }

    [DatabaseFact]
    public async Task Catalog_mutations_require_admin_and_csrf_and_reject_bad_prices_and_images()
    {
        await using var s = await Session.Create();
        using var noCsrf = await s.Client.PostAsJsonAsync("/api/v1/admin/catalog/products", s.Input());
        Assert.Equal(HttpStatusCode.BadRequest, noCsrf.StatusCode);
        using var badPrice = await s.Send(HttpMethod.Post, "/api/v1/admin/catalog/products", s.Input() with { Variants = [s.Input().Variants[0] with { PriceVnd = 0 }] });
        Assert.Equal(HttpStatusCode.BadRequest, badPrice.StatusCode);
        using var unsupported = new MultipartFormDataContent(); var fake = new ByteArrayContent("not-an-image"u8.ToArray());
        fake.Headers.ContentType = new("image/png"); unsupported.Add(fake, "file", "image.png");
        using var badImage = await s.Send(HttpMethod.Post, "/api/v1/admin/catalog/images", content: unsupported);
        Assert.Equal(HttpStatusCode.BadRequest, badImage.StatusCode);
        using var validForm = new MultipartFormDataContent();
        var png = new ByteArrayContent(Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="));
        png.Headers.ContentType = new("image/png"); validForm.Add(png, "file", "../../unsafe-name.png");
        using var upload = await s.Send(HttpMethod.Post, "/api/v1/admin/catalog/images", content: validForm);
        Assert.Equal(HttpStatusCode.Created, upload.StatusCode);
        var image = await upload.Content.ReadFromJsonAsync<StoredImage>(); Assert.StartsWith("/media/catalog/", image!.Url); Assert.DoesNotContain("unsafe", image.Url);
        using var downloaded = await s.Client.GetAsync(image.Url); Assert.Equal(HttpStatusCode.OK, downloaded.StatusCode);
        Assert.Equal("nosniff", downloaded.Headers.GetValues("X-Content-Type-Options").Single());
        using var guest = s.Factory.CreateClient(new() { HandleCookies = false, BaseAddress = new("https://localhost") });
        using var blocked = await guest.PostAsJsonAsync("/api/v1/admin/catalog/products", s.Input());
        Assert.Equal(HttpStatusCode.Unauthorized, blocked.StatusCode);
    }

    [DatabaseFact]
    public async Task Seed_is_idempotent_hidden_examples_stay_private_and_database_enforces_attributes()
    {
        await using var s = await Session.Create();
        await using var scope = s.Factory.Services.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<ICatalogService>();
        await service.SeedAsync(CancellationToken.None);
        var db = scope.ServiceProvider.GetRequiredService<CommerceDbContext>();
        var before = await db.Products.AsNoTracking().Where(p => p.IsDemo).OrderBy(p => p.Id).Select(p => new { p.Id, p.Revision }).ToListAsync();
        await service.SeedAsync(CancellationToken.None);
        var after = await db.Products.AsNoTracking().Where(p => p.IsDemo).OrderBy(p => p.Id).Select(p => new { p.Id, p.Revision }).ToListAsync();
        Assert.Equal(before, after);
        using var hidden = await s.Client.GetAsync("/api/v1/products/ban-nhap-demo");
        Assert.Equal(HttpStatusCode.NotFound, hidden.StatusCode);
        var product = await s.Save(s.Input()); var id = product.Variants.Single().Id;
        var invalid = await Assert.ThrowsAsync<Npgsql.PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync($"UPDATE commerce.\"ProductVariants\" SET \"CapacityMl\" = -1 WHERE \"Id\" = {id}"));
        Assert.Equal(Npgsql.PostgresErrorCodes.CheckViolation, invalid.SqlState);
        using var badPagination = await s.Client.GetAsync("/api/v1/products?pageSize=1000");
        Assert.Equal(HttpStatusCode.BadRequest, badPagination.StatusCode);
    }

    private sealed class Factory : WebApplicationFactory<Program>
    {
        public string ImageRoot { get; } = Path.Combine(Path.GetTempPath(), "claynest-images-" + Guid.NewGuid().ToString("N"));
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(new Dictionary<string,string?>
            { ["ConnectionStrings:Commerce"] = TestDatabase.Connection("TEST_COMMERCE_CONNECTION"), ["Catalog:ImagePath"] = ImageRoot, ["Logging:LogLevel:Default"] = "None" }));
            builder.ConfigureTestServices(s => s.AddDataProtection().UseEphemeralDataProtectionProvider());
        }
    }
    private sealed class Session : IAsyncDisposable
    {
        public Factory Factory { get; } = new();
        public HttpClient Client { get; private set; } = null!;
        public CategoryDto Category { get; private set; } = null!;
        public string Key { get; } = "test-" + Guid.NewGuid().ToString("N");
        private string userId = "";
        public static async Task<Session> Create()
        {
            var s = new Session(); s.Client = s.Factory.CreateClient(new() { BaseAddress = new("https://localhost") });
            await using var scope = s.Factory.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<CommerceDbContext>(); await db.Database.MigrateAsync();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AdminUser>>();
            var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
            if (!await roles.RoleExistsAsync(CommerceRoles.Admin)) Assert.True((await roles.CreateAsync(new(CommerceRoles.Admin))).Succeeded);
            var password = "Test-" + Guid.NewGuid().ToString("N") + "-Aa1!";
            var user = new AdminUser { Id = Guid.NewGuid(), UserName = s.Key + "@example.test", Email = s.Key + "@example.test", DisplayName = "Catalog tester" };
            Assert.True((await users.CreateAsync(user, password)).Succeeded); Assert.True((await users.AddToRoleAsync(user, CommerceRoles.Admin)).Succeeded); s.userId = user.Id.ToString();
            using var login = await s.Send(HttpMethod.Post, "/api/v1/auth/login", new { email = user.Email, password }); Assert.Equal(HttpStatusCode.OK, login.StatusCode);
            using var category = await s.Send(HttpMethod.Post, "/api/v1/admin/catalog/categories", new CategoryInput(s.Key, s.Key, true));
            Assert.Equal(HttpStatusCode.Created, category.StatusCode); s.Category = (await category.Content.ReadFromJsonAsync<CategoryDto>())!;
            return s;
        }
        public ProductInput Input() => new(Category.Id, Key, Key, "A ceramic product", "Craft story", "Ceramic", "Handmade variation", "HOT SALE", false,
            [new(null, Key.ToUpperInvariant(), "Standard", "green", "gift", 250, 8, 10, 300, 200000, 250000, true, "Unsupported claim", "", false)],
            [new("/images/slow-living/cup.jpg", "A ceramic cup")]);
        public async Task<HttpResponseMessage> Send(HttpMethod method, string path, object? body = null, HttpContent? content = null)
        {
            using var csrf = await Client.GetAsync("/api/v1/auth/csrf"); var token = (await csrf.Content.ReadFromJsonAsync<Dictionary<string,string>>())!["requestToken"];
            using var request = new HttpRequestMessage(method, path) { Content = content ?? (body is null ? null : JsonContent.Create(body)) };
            request.Headers.Add("X-CSRF-TOKEN", token); return await Client.SendAsync(request);
        }
        public async Task<ProductDto> Save(ProductInput input, Guid? id = null)
        {
            using var result = await Send(id is null ? HttpMethod.Post : HttpMethod.Put, "/api/v1/admin/catalog/products" + (id is null ? "" : "/" + id), input);
            Assert.Equal(id is null ? HttpStatusCode.Created : HttpStatusCode.OK, result.StatusCode);
            return (await result.Content.ReadFromJsonAsync<ProductDto>())!;
        }
        public async ValueTask DisposeAsync()
        {
            await using var scope = Factory.Services.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<CommerceDbContext>();
            var ids = await db.Products.Where(p => p.CategoryId == Category.Id).Select(p => p.Id).ToListAsync();
            await db.Set<ProductImage>().Where(i => ids.Contains(i.ProductId)).ExecuteDeleteAsync();
            await db.Set<ProductVariant>().Where(v => ids.Contains(v.ProductId)).ExecuteDeleteAsync();
            await db.Products.Where(p => p.CategoryId == Category.Id).ExecuteDeleteAsync();
            await db.Categories.Where(c => c.Id == Category.Id).ExecuteDeleteAsync();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AdminUser>>(); var user = await users.FindByIdAsync(userId); if (user is not null) await users.DeleteAsync(user);
            Client.Dispose(); await Factory.DisposeAsync();
            if (Directory.Exists(Factory.ImageRoot)) Directory.Delete(Factory.ImageRoot, true);
        }
    }
}
