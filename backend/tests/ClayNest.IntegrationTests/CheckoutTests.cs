using System.Net;
using System.Net.Http.Json;
using ClayNest.Application.Orders;
using ClayNest.Domain.Catalog;
using ClayNest.Domain.Inventory;
using ClayNest.Domain.Orders;
using ClayNest.Infrastructure.Identity;
using ClayNest.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ClayNest.IntegrationTests;

public sealed class CheckoutTests
{
    [DatabaseFact]
    public async Task Quote_recalculates_server_prices_shipping_and_hides_unavailable_products()
    {
        await using var s = await Fixture.Create(30);
        using var quoted = await s.Post("/api/v1/cart/quote", new { items = new[] { new { variantId = s.VariantId, quantity = 2, priceVnd = 1 } }, grandTotalVnd = 2 });
        Assert.Equal(HttpStatusCode.OK, quoted.StatusCode);
        var q = (await quoted.Content.ReadFromJsonAsync<CartQuote>())!;
        Assert.Equal(200000, q.SubtotalVnd); Assert.Equal(30000, q.ShippingFeeVnd); Assert.Equal(230000, q.GrandTotalVnd); Assert.True(q.CanCheckout);
        Assert.Equal(0, (await s.Quote(8)).ShippingFeeVnd);
        var unavailable = await s.Quote(31); Assert.False(unavailable.CanCheckout); Assert.Null(unavailable.QuoteToken);
        await s.WithDb(async db => { var p = await db.Products.SingleAsync(p => p.Id == s.ProductId); p.Archive(); await db.SaveChangesAsync(); });
        var hidden = await s.Quote(1); Assert.False(hidden.CanCheckout); Assert.Equal(0, hidden.Items.Single().UnitPriceVnd); Assert.NotEqual(s.Key, hidden.Items.Single().Name);
    }

    [DatabaseFact]
    public async Task Guest_checkout_is_atomic_snapshots_prices_and_same_key_replays_after_quote_expiry()
    {
        await using var s = await Fixture.Create(3); var quote = await s.Quote(2); var key = Guid.NewGuid(); var command = s.Command(quote);
        var token = await s.Csrf();
        var responses = await Task.WhenAll(s.Post("/api/v1/orders", command, key, token), s.Post("/api/v1/orders", command, key, token));
        Assert.All(responses, r => Assert.Equal(HttpStatusCode.Created, r.StatusCode));
        var receipts = await Task.WhenAll(responses.Select(async r => (await r.Content.ReadFromJsonAsync<OrderReceipt>())!));
        Assert.Equal(receipts[0], receipts[1]); foreach (var response in responses) response.Dispose();
        var receipt = receipts[0]; Assert.Equal(43, receipt.AccessToken.Length); Assert.Equal(230000, receipt.GrandTotalVnd);
        await s.WithDb(async db => {
            var order = await db.Orders.Include(o => o.Items).SingleAsync(o => o.IdempotencyKey == key);
            Assert.Null(order.CustomerId); Assert.Equal(2, order.Items.Single().Quantity); Assert.Equal(100000, order.Items.Single().UnitPriceVnd);
            Assert.DoesNotContain(receipt.AccessToken, order.AccessTokenProtected); Assert.NotEqual(receipt.AccessToken, order.AccessTokenHash);
            Assert.Equal(1, await db.Set<ProductVariant>().Where(v => v.Id == s.VariantId).Select(v => v.StockQty).SingleAsync());
            Assert.Equal(1, await db.StockMovements.CountAsync(m => m.OrderId == order.Id));
            Assert.Equal(1, await db.StockMovements.Where(m => m.VariantId == s.VariantId).SumAsync(m => m.QuantityDelta));
            var v = await db.Set<ProductVariant>().SingleAsync(v => v.Id == s.VariantId);
            v.Update(v.Sku, v.Name, v.Glaze, v.IntendedUse, null, null, null, null, 150000, null, true, "", "", false); await db.SaveChangesAsync();
        });
        s.Clock.Advance(TimeSpan.FromMinutes(6)); using var retried = await s.Post("/api/v1/orders", command, key);
        Assert.Equal(receipt, await retried.Content.ReadFromJsonAsync<OrderReceipt>());
        using var mismatch = await s.Post("/api/v1/orders", command with { Contact = command.Contact with { Name = "Different recipient" } }, key);
        Assert.Equal(HttpStatusCode.Conflict, mismatch.StatusCode); Assert.Contains("idempotency_conflict", await mismatch.Content.ReadAsStringAsync());
        using var statusRequest = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/orders/{receipt.Reference}/status"); statusRequest.Headers.Add("X-Order-Token", receipt.AccessToken);
        using var status = await s.Client.SendAsync(statusRequest); Assert.Equal(HttpStatusCode.OK, status.StatusCode);
        Assert.Equal(100000, (await status.Content.ReadFromJsonAsync<OrderStatusDto>())!.Items.Single().UnitPriceVnd);
    }

    [DatabaseFact]
    public async Task Two_buyers_racing_last_item_create_only_one_order_and_one_sale_movement()
    {
        await using var s = await Fixture.Create(1); var quote = await s.Quote(1); var command = s.Command(quote); var token = await s.Csrf();
        var responses = await Task.WhenAll(s.Post("/api/v1/orders", command, Guid.NewGuid(), token), s.Post("/api/v1/orders", command, Guid.NewGuid(), token));
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created); Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
        foreach (var response in responses) response.Dispose();
        await s.WithDb(async db => {
            Assert.Equal(0, await db.Set<ProductVariant>().Where(v => v.Id == s.VariantId).Select(v => v.StockQty).SingleAsync());
            Assert.Equal(1, await db.StockMovements.CountAsync(m => m.VariantId == s.VariantId && m.Kind == "sale"));
            Assert.Equal(1, await db.Set<OrderItem>().CountAsync(i => i.VariantId == s.VariantId));
        });
    }

    [DatabaseFact]
    public async Task Price_changes_expired_or_tampered_quotes_and_missing_consent_do_not_create_orders()
    {
        await using var s = await Fixture.Create(3); var quote = await s.Quote(1);
        await s.WithDb(async db => { var v = await db.Set<ProductVariant>().SingleAsync(v => v.Id == s.VariantId); v.Update(v.Sku, v.Name, v.Glaze, v.IntendedUse, null, null, null, null, 120000, null, true, "", "", false); await db.SaveChangesAsync(); });
        using var changed = await s.Post("/api/v1/orders", s.Command(quote), Guid.NewGuid()); Assert.Equal(HttpStatusCode.Conflict, changed.StatusCode); Assert.Contains("price_changed", await changed.Content.ReadAsStringAsync());
        var fresh = await s.Quote(1); s.Clock.Advance(TimeSpan.FromMinutes(6));
        using var expired = await s.Post("/api/v1/orders", s.Command(fresh), Guid.NewGuid()); Assert.Contains("quote_expired", await expired.Content.ReadAsStringAsync());
        using var tampered = await s.Post("/api/v1/orders", s.Command(fresh) with { QuoteToken = "tampered-quote" }, Guid.NewGuid()); Assert.Equal(HttpStatusCode.Conflict, tampered.StatusCode);
        using var consent = await s.Post("/api/v1/orders", s.Command(fresh) with { AcceptTerms = false }, Guid.NewGuid()); Assert.Equal(HttpStatusCode.BadRequest, consent.StatusCode);
        using var missingKey = await s.Post("/api/v1/orders", s.Command(fresh)); Assert.Equal(HttpStatusCode.BadRequest, missingKey.StatusCode);
        using var csrf = await s.Client.PostAsJsonAsync("/api/v1/orders", s.Command(fresh)); Assert.Equal(HttpStatusCode.BadRequest, csrf.StatusCode);
        await s.WithDb(async db => { Assert.False(await db.Set<OrderItem>().AnyAsync(i => i.VariantId == s.VariantId)); Assert.Equal(3, await db.StockMovements.Where(m => m.VariantId == s.VariantId).SumAsync(m => m.QuantityDelta)); });
    }

    [DatabaseFact]
    public async Task Database_failure_rolls_back_order_balance_and_ledger_together()
    {
        await using var s = await Fixture.Create(3); var quote = await s.Quote(1);
        await s.WithDb(db => db.Database.ExecuteSqlRawAsync("""
            CREATE FUNCTION commerce.reject_checkout_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF NEW."CustomerName" = 'ROLLBACK_SENTINEL' THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END; $$;
            CREATE TRIGGER reject_checkout_fixture BEFORE INSERT ON commerce."Orders" FOR EACH ROW EXECUTE FUNCTION commerce.reject_checkout_fixture();
            """));
        try {
            var command = s.Command(quote); using var rejected = await s.Post("/api/v1/orders", command with { Contact = command.Contact with { Name = "ROLLBACK_SENTINEL" } }, Guid.NewGuid());
            Assert.Equal(HttpStatusCode.InternalServerError, rejected.StatusCode);
            Assert.DoesNotContain("test failure", await rejected.Content.ReadAsStringAsync());
            await s.WithDb(async db => { Assert.False(await db.Set<OrderItem>().AnyAsync(i => i.VariantId == s.VariantId)); Assert.Equal(3, await db.Set<ProductVariant>().Where(v => v.Id == s.VariantId).Select(v => v.StockQty).SingleAsync()); Assert.False(await db.StockMovements.AnyAsync(m => m.VariantId == s.VariantId && m.Kind == "sale")); });
        } finally { await s.WithDb(db => db.Database.ExecuteSqlRawAsync("DROP TRIGGER reject_checkout_fixture ON commerce.\"Orders\"; DROP FUNCTION commerce.reject_checkout_fixture();")); }
    }

    [DatabaseFact]
    public async Task Order_lookup_requires_secret_or_authenticated_owner_and_tokens_expire_or_revoke()
    {
        await using var s = await Fixture.Create(3); var owner = await s.LoginCustomer(); var quote = await s.Quote(1);
        using var created = await s.Post("/api/v1/orders", new { quoteToken = quote.QuoteToken, contact = Fixture.Contact, acceptTerms = true, customerId = Guid.NewGuid(), grandTotalVnd = 1 }, Guid.NewGuid());
        var receipt = (await created.Content.ReadFromJsonAsync<OrderReceipt>())!;
        await s.WithDb(async db => Assert.Equal(owner, (await db.Orders.SingleAsync(o => o.Reference == receipt.Reference)).CustomerId));
        using var own = await s.Client.GetAsync($"/api/v1/orders/{receipt.Reference}/status"); Assert.Equal(HttpStatusCode.OK, own.StatusCode);
        using var guest = s.Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        using var guessed = await guest.GetAsync($"/api/v1/orders/{receipt.Reference}/status"); Assert.Equal(HttpStatusCode.NotFound, guessed.StatusCode);
        guest.DefaultRequestHeaders.Add("X-Order-Token", "wrong-secret");
        using var wrong = await guest.GetAsync($"/api/v1/orders/{receipt.Reference}/status"); Assert.Equal(HttpStatusCode.NotFound, wrong.StatusCode);
        guest.DefaultRequestHeaders.Remove("X-Order-Token"); guest.DefaultRequestHeaders.Add("X-Order-Token", receipt.AccessToken);
        using var right = await guest.GetAsync($"/api/v1/orders/{receipt.Reference}/status"); Assert.Equal(HttpStatusCode.OK, right.StatusCode);
        using var revoked = await s.Post($"/api/v1/orders/{receipt.Reference}/revoke-access", new { }); Assert.Equal(HttpStatusCode.NoContent, revoked.StatusCode);
        using var after = await guest.GetAsync($"/api/v1/orders/{receipt.Reference}/status"); Assert.Equal(HttpStatusCode.NotFound, after.StatusCode);
        var secondQuote = await s.Quote(1); using var secondOrder = await s.Post("/api/v1/orders", s.Command(secondQuote), Guid.NewGuid()); var second = (await secondOrder.Content.ReadFromJsonAsync<OrderReceipt>())!;
        s.Clock.Advance(TimeSpan.FromDays(31)); guest.DefaultRequestHeaders.Remove("X-Order-Token"); guest.DefaultRequestHeaders.Add("X-Order-Token", second.AccessToken);
        using var old = await guest.GetAsync($"/api/v1/orders/{second.Reference}/status"); Assert.Equal(HttpStatusCode.NotFound, old.StatusCode);
        await s.LoginCustomer(); // Refresh the authenticated session after advancing beyond its lifetime.
        using var stillOwned = await s.Client.GetAsync($"/api/v1/orders/{second.Reference}/status"); Assert.Equal(HttpStatusCode.OK, stillOwned.StatusCode);
    }

    internal sealed class TestClock : TimeProvider { private DateTimeOffset now = DateTimeOffset.UtcNow; public override DateTimeOffset GetUtcNow() => now; public void Advance(TimeSpan by) => now += by; }
    internal sealed class Fixture : IAsyncDisposable
    {
        public WebApplicationFactory<Program> Factory { get; }
        public TestClock Clock { get; } = new();
        public HttpClient Client { get; private set; } = null!;
        public Guid VariantId { get; private set; }
        public Guid ProductId { get; private set; }
        public string Key { get; } = "checkout-" + Guid.NewGuid().ToString("N");
        public static ShippingContact Contact => new("Order recipient", "0901234567", "buyer@example.test", "Trà Vinh", "123 Đường Gốm, phường Trà Vinh", "Gọi trước khi giao");
        private Fixture() { Factory = new AuthenticationTests.AuthFactory().WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddSingleton<TimeProvider>(Clock))); }
        public static async Task<Fixture> Create(int stock)
        {
            var s = new Fixture(); s.Client = s.Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
            await s.WithDb(async db => {
                await db.Database.MigrateAsync(); var category = new Category(s.Key, s.Key, true); db.Categories.Add(category);
                var product = new Product(); product.Update(category.Id, s.Key, s.Key, "Checkout fixture", "", "Ceramic", "", "", true); s.ProductId = product.Id;
                var variant = new ProductVariant(product.Id, stock); variant.Update(s.Key, "Standard", "Green", "Drink", null, null, null, null, 100000, null, true, "", "", false);
                s.VariantId = variant.Id; product.Variants.Add(variant); product.Images.Add(new ProductImage(product.Id, "/images/slow-living/cup.jpg", "Cup", 0)); product.ValidatePublication(); db.Products.Add(product);
                if (stock > 0) db.StockMovements.Add(new StockMovement(variant.Id, "opening", stock, stock, 5, "Test opening", null, "System")); await db.SaveChangesAsync();
            }); return s;
        }
        public async Task WithDb(Func<CommerceDbContext,Task> action) { await using var scope = Factory.Services.CreateAsyncScope(); await action(scope.ServiceProvider.GetRequiredService<CommerceDbContext>()); }
        public async Task<string> Csrf() => (await Client.GetFromJsonAsync<Dictionary<string,string>>("/api/v1/auth/csrf"))!["requestToken"];
        public async Task<HttpResponseMessage> Post(string path, object body, Guid? key = null, string? token = null)
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body) }; req.Headers.Add("X-CSRF-TOKEN", token ?? await Csrf()); if (key.HasValue) req.Headers.Add("Idempotency-Key", key.ToString()); return await Client.SendAsync(req);
        }
        public async Task<CartQuote> Quote(int qty) { using var response = await Post("/api/v1/cart/quote", new QuoteRequest([new(VariantId, qty)])); Assert.Equal(HttpStatusCode.OK, response.StatusCode); return (await response.Content.ReadFromJsonAsync<CartQuote>())!; }
        public CheckoutRequest Command(CartQuote quote) => new(quote.QuoteToken!, Contact, true);
        public async Task<Guid> LoginCustomer()
        {
            await using var scope = Factory.Services.CreateAsyncScope(); var users = scope.ServiceProvider.GetRequiredService<UserManager<AdminUser>>();
            var user = await users.FindByEmailAsync(Key + "@example.test"); var password = "Buyer-Password!123";
            if (user is null) { user = new AdminUser { Id = Guid.NewGuid(), UserName = Key + "@example.test", Email = Key + "@example.test", DisplayName = "Buyer" }; Assert.True((await users.CreateAsync(user,password)).Succeeded); }
            using var login = await Post("/api/v1/auth/login", new { email = user.Email, password }); Assert.Equal(HttpStatusCode.OK, login.StatusCode); return user.Id;
        }
        public async ValueTask DisposeAsync() { Client.Dispose(); await Factory.DisposeAsync(); }
    }
}
