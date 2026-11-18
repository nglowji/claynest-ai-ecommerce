using System.Net;
using System.Net.Http.Json;
using ClayNest.Application.Catalog;
using ClayNest.Application.Orders;
using ClayNest.Domain.Catalog;
using ClayNest.Domain.Orders;
using ClayNest.Infrastructure.Identity;
using ClayNest.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace ClayNest.IntegrationTests;

public sealed class FulfilmentTests
{
    [DatabaseFact]
    public async Task Complete_workflow_audits_actor_preserves_completed_time_and_checkout_receipt()
    {
        await using var s = await Session.Create(); var detail = await s.Get();
        foreach (var status in new[] { "confirmed", "packed", "shipped" })
            detail = await s.Change(s.Command(status, detail.Revision));
        using var noCod = await s.Send(s.Command("completed", detail.Revision) with { ConfirmCodCollected = false });
        Assert.Equal(HttpStatusCode.BadRequest, noCod.StatusCode);
        Assert.Equal("shipped", (await s.Get()).Status);
        var complete = s.Command("completed", detail.Revision); detail = await s.Change(complete);
        Assert.Equal("paid", detail.PaymentStatus); Assert.NotNull(detail.CompletedAt); Assert.Null(detail.RestockedAt);
        Assert.Equal(4, detail.Revision); Assert.Equal(5, detail.History.Count); Assert.Equal(Enumerable.Range(0,5), detail.History.Select(e => e.Sequence));
        Assert.All(detail.History.Skip(1), e => { Assert.Equal(s.ActorId,e.ActorId); Assert.Equal("Warehouse administrator", e.ActorName); });
        s.Fixture.Clock.Advance(TimeSpan.FromHours(1));
        var replay = await s.Change(complete); Assert.Equal(detail.CompletedAt,replay.CompletedAt); Assert.Equal(5,replay.History.Count);
        using var invalid = await s.Send(s.Command("cancelled", detail.Revision)); Assert.Equal(HttpStatusCode.Conflict,invalid.StatusCode);
        Assert.Equal(28,await s.Stock());
        using var publicRequest = new HttpRequestMessage(HttpMethod.Get,$"/api/v1/orders/{s.Receipt.Reference}/status"); publicRequest.Headers.Add("X-Order-Token",s.Receipt.AccessToken);
        using var publicResponse = await s.Client.SendAsync(publicRequest); var visible = (await publicResponse.Content.ReadFromJsonAsync<OrderStatusDto>())!;
        Assert.Equal("completed",visible.Status); Assert.Equal(detail.CompletedAt,visible.CompletedAt); Assert.Equal(5,visible.Timeline.Count);
        Assert.DoesNotContain("Warehouse administrator",await publicResponse.Content.ReadAsStringAsync());
        using var guest = s.Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        var token = (await guest.GetFromJsonAsync<Dictionary<string,string>>("/api/v1/auth/csrf"))!["requestToken"];
        using var req = new HttpRequestMessage(HttpMethod.Post,"/api/v1/orders") { Content = JsonContent.Create(s.Checkout) }; req.Headers.Add("X-CSRF-TOKEN",token); req.Headers.Add("Idempotency-Key",s.CheckoutKey.ToString());
        using var checkoutReplay = await guest.SendAsync(req); Assert.Equal(s.Receipt,await checkoutReplay.Content.ReadFromJsonAsync<OrderReceipt>());
    }

    [DatabaseFact]
    public async Task Repeated_or_concurrent_cancel_restores_stock_once_even_for_archived_product()
    {
        await using var s = await Session.Create(); var detail = await s.Get();
        await s.Fixture.WithDb(async db => { var product = await db.Products.SingleAsync(p => p.Id == s.Fixture.ProductId); product.Archive(); await db.SaveChangesAsync(); });
        var command = s.Command("cancelled",detail.Revision); var token = await s.Fixture.Csrf();
        var responses = await Task.WhenAll(s.Send(command,token),s.Send(command,token));
        Assert.All(responses,r => Assert.Equal(HttpStatusCode.OK,r.StatusCode)); foreach (var r in responses) r.Dispose();
        detail = await s.Get(); Assert.Equal("cancelled",detail.Status); Assert.NotNull(detail.RestockedAt); Assert.Equal(detail.CancelledAt,detail.RestockedAt);
        Assert.Equal(30,await s.Stock()); Assert.Equal(2,detail.History.Count);
        var repeat = await s.Change(command); Assert.Equal(detail.RestockedAt,repeat.RestockedAt); Assert.Equal(2,repeat.History.Count);
        using var newCancel = await s.Send(s.Command("cancelled",detail.Revision)); Assert.Equal(HttpStatusCode.Conflict,newCancel.StatusCode);
        using var changedPayload = await s.Send(command with { Reason = "Different cancellation reason" }); Assert.Equal(HttpStatusCode.Conflict,changedPayload.StatusCode);
        await s.Fixture.WithDb(async db => {
            Assert.Equal(1,await db.StockMovements.CountAsync(m => m.OrderId == s.Id && m.Kind == "restock"));
            Assert.Equal(30,await db.StockMovements.Where(m => m.VariantId == s.Fixture.VariantId).SumAsync(m => m.QuantityDelta));
        });
    }

    [DatabaseFact]
    public async Task Cancel_racing_confirmation_or_packing_cannot_overwrite_another_transition()
    {
        foreach (var next in new[] { "confirmed", "packed" })
        {
            await using var s = await Session.Create(); var detail = await s.Get();
            if (next == "packed") detail = await s.Change(s.Command("confirmed",detail.Revision));
            var token = await s.Fixture.Csrf();
            var responses = await Task.WhenAll(s.Send(s.Command("cancelled",detail.Revision),token),s.Send(s.Command(next,detail.Revision),token));
            Assert.Single(responses,r => r.StatusCode == HttpStatusCode.OK); Assert.Single(responses,r => r.StatusCode == HttpStatusCode.Conflict);
            foreach (var r in responses) r.Dispose();
            var current = await s.Get(); Assert.Equal(detail.Revision + 1,current.Revision);
            Assert.Equal(current.Status == "cancelled" ? 30 : 28,await s.Stock());
            await s.Fixture.WithDb(async db => Assert.Equal(current.Status == "cancelled" ? 1 : 0,await db.StockMovements.CountAsync(m => m.OrderId == s.Id && m.Kind == "restock")));
        }
    }

    [DatabaseFact]
    public async Task Packed_order_can_ship_but_cannot_be_cancelled_even_concurrently()
    {
        await using var s = await Session.Create(); var detail = await s.Get();
        detail = await s.Change(s.Command("confirmed",detail.Revision)); detail = await s.Change(s.Command("packed",detail.Revision));
        var token = await s.Fixture.Csrf();
        var results = await Task.WhenAll(s.Send(s.Command("cancelled",detail.Revision),token),s.Send(s.Command("shipped",detail.Revision),token));
        Assert.Single(results,r => r.StatusCode == HttpStatusCode.OK); Assert.Single(results,r => r.StatusCode == HttpStatusCode.Conflict); foreach (var r in results) r.Dispose();
        Assert.Equal("shipped",(await s.Get()).Status); Assert.Equal(28,await s.Stock());
    }

    [DatabaseFact]
    public async Task Stale_invalid_steps_and_customer_access_do_not_mutate_order()
    {
        await using var s = await Session.Create(); var initial = await s.Get();
        using var skip = await s.Send(s.Command("shipped",initial.Revision)); Assert.Equal(HttpStatusCode.Conflict,skip.StatusCode);
        using var noCsrf = await s.Client.PatchAsJsonAsync($"/api/v1/admin/orders/{s.Id}/status",s.Command("confirmed",initial.Revision)); Assert.Equal(HttpStatusCode.BadRequest,noCsrf.StatusCode);
        var detail = await s.Change(s.Command("confirmed",initial.Revision));
        using var stale = await s.Send(s.Command("packed",initial.Revision)); Assert.Equal(HttpStatusCode.Conflict,stale.StatusCode);
        using var emptyReason = await s.Send(s.Command("packed",detail.Revision) with { Reason = "  " }); Assert.Equal(HttpStatusCode.BadRequest,emptyReason.StatusCode);
        using var anonymous = s.Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        using var denied = await anonymous.GetAsync($"/api/v1/admin/orders/{s.Id}"); Assert.Equal(HttpStatusCode.Unauthorized,denied.StatusCode);
        await s.Fixture.LoginCustomer();
        using var customerRead = await s.Client.GetAsync($"/api/v1/admin/orders/{s.Id}"); Assert.Equal(HttpStatusCode.Forbidden,customerRead.StatusCode);
        using var customerWrite = await s.Send(s.Command("cancelled",detail.Revision)); Assert.Equal(HttpStatusCode.Forbidden,customerWrite.StatusCode);
        await s.Fixture.WithDb(async db => { var order = await db.Orders.SingleAsync(o => o.Id == s.Id); Assert.Equal("confirmed",order.Status); Assert.Equal(1,order.Revision); });
    }

    [DatabaseFact]
    public async Task Cancellation_database_failure_rolls_back_state_audit_and_stock_then_retries_safely()
    {
        await using var s = await Session.Create(); var initial = await s.Get(); var command = s.Command("cancelled",initial.Revision) with { Reason = "ROLLBACK_SENTINEL" };
        await s.Fixture.WithDb(db => db.Database.ExecuteSqlRawAsync("""
            CREATE FUNCTION commerce.reject_order_change_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN IF NEW."Reason" = 'ROLLBACK_SENTINEL' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END; $$;
            CREATE TRIGGER reject_order_change_fixture BEFORE INSERT ON commerce."OrderStatusChanges" FOR EACH ROW EXECUTE FUNCTION commerce.reject_order_change_fixture();
            """));
        try {
            using var failed = await s.Send(command); Assert.Equal(HttpStatusCode.InternalServerError,failed.StatusCode);
            Assert.DoesNotContain("test audit failure",await failed.Content.ReadAsStringAsync());
            var unchanged = await s.Get(); Assert.Equal("pending",unchanged.Status); Assert.Equal(0,unchanged.Revision); Assert.Null(unchanged.CancelledAt); Assert.Null(unchanged.RestockedAt); Assert.Single(unchanged.History); Assert.Equal(28,await s.Stock());
            await s.Fixture.WithDb(async db => Assert.False(await db.StockMovements.AnyAsync(m => m.OrderId == s.Id && m.Kind == "restock")));
        } finally { await s.Fixture.WithDb(db => db.Database.ExecuteSqlRawAsync("DROP TRIGGER reject_order_change_fixture ON commerce.\"OrderStatusChanges\"; DROP FUNCTION commerce.reject_order_change_fixture();")); }
        var retried = await s.Change(command); Assert.Equal("cancelled",retried.Status); Assert.Equal(30,await s.Stock());
    }

    [DatabaseFact]
    public async Task Audit_is_append_only_and_database_rejects_duplicate_restock()
    {
        await using var s = await Session.Create(); await s.Change(s.Command("cancelled",0));
        await s.Fixture.WithDb(async db => {
            var edit = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync($"UPDATE commerce.\"OrderStatusChanges\" SET \"Reason\" = 'tamper' WHERE \"OrderId\" = {s.Id}")); Assert.Equal(PostgresErrorCodes.CheckViolation,edit.SqlState);
            var delete = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM commerce.\"OrderStatusChanges\" WHERE \"OrderId\" = {s.Id}")); Assert.Equal(PostgresErrorCodes.CheckViolation,delete.SqlState);
            var duplicate = await Assert.ThrowsAsync<PostgresException>(() => db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO commerce.\"StockMovements\" (\"Id\",\"OrderId\",\"VariantId\",\"Kind\",\"QuantityDelta\",\"BalanceAfter\",\"ThresholdAfter\",\"Reason\",\"ActorId\",\"ActorName\",\"CreatedAt\") SELECT {Guid.NewGuid()}, \"OrderId\",\"VariantId\",\"Kind\",\"QuantityDelta\",\"BalanceAfter\",\"ThresholdAfter\",\"Reason\",\"ActorId\",\"ActorName\",\"CreatedAt\" FROM commerce.\"StockMovements\" WHERE \"OrderId\" = {s.Id} AND \"Kind\" = 'restock'"));
            Assert.Equal(PostgresErrorCodes.UniqueViolation,duplicate.SqlState);
        });
    }

    [DatabaseFact]
    public async Task Admin_list_filters_by_reference_state_vietnam_dates_and_does_not_expose_access_secrets()
    {
        await using var s = await Session.Create(); var today = DateOnly.FromDateTime(s.Fixture.Clock.GetUtcNow().ToOffset(TimeSpan.FromHours(7)).DateTime).ToString("yyyy-MM-dd");
        using var response = await s.Client.GetAsync($"/api/v1/admin/orders/?q={s.Receipt.Reference}&status=pending&from={today}&to={today}&pageSize=1");
        Assert.Equal(HttpStatusCode.OK,response.StatusCode); var page = (await response.Content.ReadFromJsonAsync<PageResult<AdminOrderRow>>())!; Assert.Equal(1,page.TotalCount); Assert.Equal(s.Id,page.Items.Single().Id);
        Assert.True(response.Headers.CacheControl?.NoStore == true);
        var detailJson = await s.Client.GetStringAsync($"/api/v1/admin/orders/{s.Id}"); Assert.DoesNotContain(s.Receipt.AccessToken,detailJson); Assert.DoesNotContain("accessToken",detailJson,StringComparison.OrdinalIgnoreCase);
        var none = await s.Client.GetFromJsonAsync<PageResult<AdminOrderRow>>($"/api/v1/admin/orders/?q={s.Receipt.Reference}&status=completed"); Assert.Equal(0,none!.TotalCount);
        using var badRange = await s.Client.GetAsync("/api/v1/admin/orders/?from=2026-11-19&to=2026-11-18"); Assert.Equal(HttpStatusCode.BadRequest,badRange.StatusCode);
        using var invalidState = await s.Client.GetAsync("/api/v1/admin/orders/?status=unknown"); Assert.Equal(HttpStatusCode.BadRequest,invalidState.StatusCode);
    }

    private sealed class Session : IAsyncDisposable
    {
        public CheckoutTests.Fixture Fixture { get; private init; } = null!;
        public WebApplicationFactory<Program> Factory => Fixture.Factory;
        public HttpClient Client => Fixture.Client;
        public Guid Id { get; private set; }
        public Guid ActorId { get; private set; }
        public Guid CheckoutKey { get; } = Guid.NewGuid();
        public CheckoutRequest Checkout { get; private set; } = null!;
        public OrderReceipt Receipt { get; private set; } = null!;
        public static async Task<Session> Create()
        {
            var s = new Session { Fixture = await CheckoutTests.Fixture.Create(30) }; s.Checkout = s.Fixture.Command(await s.Fixture.Quote(2));
            using var created = await s.Fixture.Post("/api/v1/orders",s.Checkout,s.CheckoutKey); Assert.Equal(HttpStatusCode.Created,created.StatusCode); s.Receipt = (await created.Content.ReadFromJsonAsync<OrderReceipt>())!;
            await using var scope = s.Factory.Services.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<CommerceDbContext>(); s.Id = await db.Orders.Where(o => o.Reference == s.Receipt.Reference).Select(o => o.Id).SingleAsync();
            var email = "admin-" + s.Fixture.Key + "@example.test"; var password = "Admin-Password!123";
            await scope.ServiceProvider.GetRequiredService<AdminProvisioner>().EnsureCreatedAsync(email,password,"Warehouse administrator");
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AdminUser>>(); s.ActorId = (await users.FindByEmailAsync(email))!.Id;
            using var login = await s.Fixture.Post("/api/v1/auth/login",new { email,password }); Assert.Equal(HttpStatusCode.OK,login.StatusCode); return s;
        }
        public async Task<AdminOrderDetail> Get() => (await Client.GetFromJsonAsync<AdminOrderDetail>($"/api/v1/admin/orders/{Id}"))!;
        public OrderTransition Command(string status,int revision) => new(status,revision,"Warehouse action: " + status,Guid.NewGuid(),status == "completed");
        public async Task<HttpResponseMessage> Send(OrderTransition command,string? token = null)
        {
            using var req = new HttpRequestMessage(HttpMethod.Patch,$"/api/v1/admin/orders/{Id}/status") { Content = JsonContent.Create(command) }; req.Headers.Add("X-CSRF-TOKEN",token ?? await Fixture.Csrf()); return await Client.SendAsync(req);
        }
        public async Task<AdminOrderDetail> Change(OrderTransition command) { using var response = await Send(command); Assert.Equal(HttpStatusCode.OK,response.StatusCode); return (await response.Content.ReadFromJsonAsync<AdminOrderDetail>())!; }
        public async Task<int> Stock() { var value = -1; await Fixture.WithDb(async db => value = await db.Set<ProductVariant>().Where(v => v.Id == Fixture.VariantId).Select(v => v.StockQty).SingleAsync()); return value; }
        public async ValueTask DisposeAsync() => await Fixture.DisposeAsync();
    }
}
