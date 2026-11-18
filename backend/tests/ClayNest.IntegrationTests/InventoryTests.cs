using System.Net;
using System.Net.Http.Json;
using ClayNest.Application.Inventory;
using ClayNest.Application.Catalog;
using ClayNest.Domain.Catalog;
using ClayNest.Domain.Inventory;
using ClayNest.Infrastructure.Identity;
using ClayNest.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace ClayNest.IntegrationTests;

public sealed class InventoryTests
{
    [DatabaseFact]
    public async Task Receipt_adjustment_threshold_and_history_preserve_balance_and_actor()
    {
        await using var s = await Fixture.Create();
        var initial = await s.Item();
        var receipt = await s.Change(new("receipt", 30, "Initial receipt", initial.Revision));
        Assert.Equal(30, receipt.Item.StockQty); Assert.Equal(s.ActorId, receipt.Movement.ActorId);
        Assert.Equal("Inventory admin", receipt.Movement.ActorName);
        var reduced = await s.Change(new("adjustment", -7, "Broken items", receipt.Item.Revision));
        Assert.Equal(23, reduced.Item.StockQty);
        var settings = await s.Change(new("threshold", 0, "Set threshold", reduced.Item.Revision, 25));
        Assert.Equal(25, settings.Item.LowStockThreshold);
        var lows = await s.Client.GetFromJsonAsync<PageResult<StockItem>>("/api/v1/admin/inventory/?lowOnly=true&q=" + s.Key);
        Assert.Single(lows!.Items);
        var history = await s.Client.GetFromJsonAsync<PageResult<MovementDto>>($"/api/v1/admin/inventory/{s.VariantId}/movements");
        Assert.Equal(3, history!.TotalCount); Assert.Equal(23, history.Items.Sum(m => m.QuantityDelta));
        Assert.All(history.Items, m => Assert.Equal(s.ActorId, m.ActorId));
        using var publicProduct = await s.Client.GetAsync("/api/v1/products/" + s.Key);
        Assert.Equal(23, (await publicProduct.Content.ReadFromJsonAsync<ProductDto>())!.Variants.Single().StockQty);
    }

    [DatabaseFact]
    public async Task Stale_retry_negative_stock_and_invalid_reason_leave_no_partial_writes()
    {
        await using var s = await Fixture.Create();
        var initial = await s.Item();
        var receipt = await s.Change(new("receipt", 2, "Receipt", initial.Revision));
        using var stale = await s.Send(new("receipt", 2, "Receipt", initial.Revision));
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        using var negative = await s.Send(new("adjustment", -3, "Too many", receipt.Item.Revision));
        Assert.Equal(HttpStatusCode.BadRequest, negative.StatusCode);
        using var invalid = await s.Send(new("receipt", 3, "", receipt.Item.Revision));
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var item = await s.Item(); Assert.Equal(2, item.StockQty); Assert.Equal(receipt.Item.Revision, item.Revision);
        await using var scope = s.Factory.Services.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<CommerceDbContext>();
        Assert.Equal(1, await db.StockMovements.CountAsync(m => m.VariantId == s.VariantId));
    }

    [DatabaseFact]
    public async Task Concurrent_adjustments_with_same_revision_apply_exactly_once()
    {
        await using var s = await Fixture.Create();
        var one = await s.Change(new("receipt", 1, "Last item", (await s.Item()).Revision));
        var token = await s.Csrf();
        async Task<HttpResponseMessage> Adjust() => await s.Send(new("adjustment", -1, "Count correction", one.Item.Revision), token);
        var responses = await Task.WhenAll(Adjust(), Adjust());
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
        foreach (var r in responses) r.Dispose();
        Assert.Equal(0, (await s.Item()).StockQty);
        await using var scope = s.Factory.Services.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<CommerceDbContext>();
        Assert.Equal(2, await db.StockMovements.CountAsync(m => m.VariantId == s.VariantId));
        Assert.Equal(0, await db.StockMovements.Where(m => m.VariantId == s.VariantId).SumAsync(m => m.QuantityDelta));
    }

    [DatabaseFact]
    public async Task History_is_append_only_and_mutations_require_admin_and_csrf()
    {
        await using var s = await Fixture.Create();
        var current = await s.Item();
        using var missingCsrf = await s.Client.PostAsJsonAsync($"/api/v1/admin/inventory/{s.VariantId}/movements", new StockChange("receipt", 1, "Receipt", current.Revision));
        Assert.Equal(HttpStatusCode.BadRequest, missingCsrf.StatusCode);
        using var anonymous = s.Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        using var blocked = await anonymous.GetAsync("/api/v1/admin/inventory/"); Assert.Equal(HttpStatusCode.Unauthorized, blocked.StatusCode);
        await s.Change(new("receipt", 3, "Receipt", current.Revision));
        await using var scope = s.Factory.Services.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<CommerceDbContext>();
        var update = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync($"UPDATE commerce.\"StockMovements\" SET \"Reason\" = 'tampered' WHERE \"VariantId\" = {s.VariantId}"));
        Assert.Equal(PostgresErrorCodes.CheckViolation, update.SqlState);
        var delete = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM commerce.\"StockMovements\" WHERE \"VariantId\" = {s.VariantId}"));
        Assert.Equal(PostgresErrorCodes.CheckViolation, delete.SqlState);
        var users = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<AdminUser>>();
        Assert.True((await users.RemoveFromRoleAsync((await users.FindByIdAsync(s.ActorId.ToString()))!, "Admin")).Succeeded);
        using var customerRead = await s.Client.GetAsync("/api/v1/admin/inventory/"); Assert.Equal(HttpStatusCode.Forbidden, customerRead.StatusCode);
        using var customerWrite = await s.Send(new("receipt", 1, "Forbidden", current.Revision)); Assert.Equal(HttpStatusCode.Forbidden, customerWrite.StatusCode);
    }

    private sealed class Fixture : IAsyncDisposable
    {
        public AuthenticationTests.AuthFactory Factory { get; } = new();
        public HttpClient Client { get; private set; } = null!;
        public string Key { get; } = "stock-" + Guid.NewGuid().ToString("N");
        public Guid VariantId { get; private set; }
        public Guid ActorId { get; private set; }
        public static async Task<Fixture> Create()
        {
            var s = new Fixture(); s.Client = s.Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
            await using var scope = s.Factory.Services.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<CommerceDbContext>();
            await db.Database.MigrateAsync();
            var password = "Test-" + Guid.NewGuid().ToString("N") + "-Aa1!";
            await scope.ServiceProvider.GetRequiredService<AdminProvisioner>().EnsureCreatedAsync(s.Key + "@example.test", password, "Inventory admin");
            var users = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<AdminUser>>();
            s.ActorId = (await users.FindByEmailAsync(s.Key + "@example.test"))!.Id;
            var category = new Category(s.Key, s.Key, true); db.Categories.Add(category);
            var product = new Product(); product.Update(category.Id, s.Key, s.Key, "Stock fixture", "", "Ceramic", "", "", true);
            var variant = new ProductVariant(product.Id); variant.Update(s.Key, "Standard", "Green", "Drink", null, null, null, null, 100000, null, true, "", "", false);
            s.VariantId = variant.Id; product.Variants.Add(variant); product.Images.Add(new ProductImage(product.Id, "/images/slow-living/cup.jpg", "Cup", 0)); product.ValidatePublication(); db.Products.Add(product); await db.SaveChangesAsync();
            using var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/login") { Content = JsonContent.Create(new { email = s.Key + "@example.test", password }) }; req.Headers.Add("X-CSRF-TOKEN", await s.Csrf());
            using var login = await s.Client.SendAsync(req); Assert.Equal(HttpStatusCode.OK, login.StatusCode);
            return s;
        }
        public async Task<string> Csrf() => (await Client.GetFromJsonAsync<Dictionary<string,string>>("/api/v1/auth/csrf"))!["requestToken"];
        public async Task<StockItem> Item() => (await Client.GetFromJsonAsync<PageResult<StockItem>>("/api/v1/admin/inventory/?q=" + Key))!.Items.Single();
        public async Task<HttpResponseMessage> Send(StockChange input, string? token = null)
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/admin/inventory/{VariantId}/movements") { Content = JsonContent.Create(input) }; req.Headers.Add("X-CSRF-TOKEN", token ?? await Csrf()); return await Client.SendAsync(req);
        }
        public async Task<StockChangeResult> Change(StockChange input)
        {
            using var response = await Send(input); Assert.Equal(HttpStatusCode.OK, response.StatusCode); return (await response.Content.ReadFromJsonAsync<StockChangeResult>())!;
        }
        // Test audit records intentionally survive for the lifetime of the isolated tmpfs test database.
        public async ValueTask DisposeAsync() { Client.Dispose(); await Factory.DisposeAsync(); }
    }
}
