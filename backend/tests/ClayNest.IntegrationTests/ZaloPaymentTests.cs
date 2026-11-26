using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ClayNest.Application.Orders;
using ClayNest.Application.Payments;
using ClayNest.Domain.Catalog;
using ClayNest.Domain.Payments;
using ClayNest.Infrastructure.Payments;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
namespace ClayNest.IntegrationTests;

public sealed class ZaloPaymentTests
{
    [DatabaseFact]
    public async Task Private_qr_uses_server_amount_and_signed_callback_is_idempotent()
    {
        await using var s = await Session.Create();
        using var missing = await s.Client.PostAsJsonAsync(s.Path, new {});
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        using var wrong = await s.Post(s.Path, new {}, "wrong");
        Assert.Equal(HttpStatusCode.NotFound, wrong.StatusCode);
        using var created = await s.Post(s.Path, new {amount = 1});
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var qr = (await created.Content.ReadFromJsonAsync<PaymentView>())!;
        Assert.Equal(230000, qr.Amount); Assert.StartsWith("https://", qr.QrPayload);
        Assert.Equal("230000", s.Gateway.Form["amount"]);
        var f = s.Gateway.Form;
        Assert.Equal(ZaloGateway.Sign("create-test", string.Join("|", f["app_id"], f["app_trans_id"], f["app_user"], f["amount"], f["app_time"], f["embed_data"], f["item"])), f["mac"]);
        using var again = await s.Post(s.Path, new {}); Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(1, s.Gateway.Creates);
        Assert.Equal(2, await s.Callback(230000, false));
        Assert.Equal(2, await s.Callback(1));
        Assert.Equal(1, await s.Callback(230000));
        long revision = 0;
        await s.Source.WithDb(async db => { var order = await db.Orders.SingleAsync(o => o.Reference == s.Receipt.Reference); Assert.Equal("paid", order.PaymentStatus); Assert.Equal("pending", order.Status); revision = order.Revision; });
        Assert.Equal(1, await s.Callback(230000));
        Assert.Equal(2, await s.Callback(230000, providerId: 888));
        await s.Source.WithDb(async db => {
            Assert.Equal(revision, (await db.Orders.SingleAsync(o => o.Reference == s.Receipt.Reference)).Revision);
            Assert.Equal(3, await db.Set<ProductVariant>().Where(v => v.Id == s.Source.VariantId).Select(v => v.StockQty).SingleAsync());
        });
    }
    [DatabaseFact]
    public async Task Server_query_checks_amount_before_accepting_payment()
    {
        await using var s = await Session.Create(); using var create = await s.Post(s.Path, new {});
        s.Gateway.Code = 1; s.Gateway.Amount = 1;
        using var mismatch = await s.Check(); Assert.Equal(HttpStatusCode.ServiceUnavailable, mismatch.StatusCode);
        await s.Source.WithDb(async db => Assert.Equal("unpaid", (await db.Orders.SingleAsync(o => o.Reference == s.Receipt.Reference)).PaymentStatus));
        s.Gateway.Amount = 230000;
        using var verified = await s.Check(); Assert.Equal(HttpStatusCode.OK, verified.StatusCode);
        Assert.Equal("paid", (await verified.Content.ReadFromJsonAsync<PaymentView>())!.PaymentStatus);
    }
    [DatabaseFact]
    public async Task Verified_expiry_restores_stock_once_and_late_payment_requires_refund()
    {
        await using var s = await Session.Create(); using var create = await s.Post(s.Path, new {});
        s.Source.Clock.Advance(TimeSpan.FromMinutes(16)); s.Gateway.Code = 2;
        using var expired = await s.Check(); Assert.Equal(HttpStatusCode.OK, expired.StatusCode);
        Assert.Equal("expired", (await expired.Content.ReadFromJsonAsync<PaymentView>())!.State);
        using var repeat = await s.Check();
        await s.Source.WithDb(async db => {
            Assert.Equal("cancelled", (await db.Orders.SingleAsync(o => o.Reference == s.Receipt.Reference)).Status);
            Assert.Equal(5, await db.Set<ProductVariant>().Where(v => v.Id == s.Source.VariantId).Select(v => v.StockQty).SingleAsync());
        });
        Assert.Equal(1, await s.Callback(230000));
        await s.Source.WithDb(async db => {
            var order = await db.Orders.SingleAsync(o => o.Reference == s.Receipt.Reference);
            Assert.Equal("cancelled", order.Status); Assert.Equal("refund_required", order.PaymentStatus);
            Assert.Equal(5, await db.Set<ProductVariant>().Where(v => v.Id == s.Source.VariantId).Select(v => v.StockQty).SingleAsync());
        });
    }
    [DatabaseFact]
    public async Task Uncertain_create_retries_same_durable_provider_identity()
    {
        await using var s = await Session.Create(); s.Gateway.FailOnce = true;
        using var failed = await s.Post(s.Path, new {}); Assert.Equal(HttpStatusCode.ServiceUnavailable, failed.StatusCode);
        var id = s.Gateway.Form["app_trans_id"];
        using var retry = await s.Post(s.Path, new {}); Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Equal(id, s.Gateway.Form["app_trans_id"]); Assert.Equal(2, s.Gateway.Creates);
        await s.Source.WithDb(async db => Assert.Equal(1, await db.Set<ZaloPayment>().CountAsync(p => p.AppTransId == id)));
    }
    internal sealed class GatewayHandler : HttpMessageHandler
    {
        public Dictionary<string,string> Form = []; public int Creates; public int Code = 3; public long Amount = 230000; public bool FailOnce;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var fields = (await request.Content!.ReadAsStringAsync(ct)).Split('&').Select(p => p.Split('=', 2)).ToDictionary(p => WebUtility.UrlDecode(p[0]), p => WebUtility.UrlDecode(p[1]));
            if (request.RequestUri!.AbsolutePath.EndsWith("/create")) {
                Form = fields; Creates++;
                if (FailOnce) { FailOnce = false; throw new HttpRequestException("Interrupted response"); }
                return new(HttpStatusCode.OK) { Content = JsonContent.Create(new {return_code = 1, order_url = "https://qcgateway.zalopay.vn/payment/test"}) };
            }
            Assert.Equal(ZaloGateway.Sign("create-test", "2554|" + fields["app_trans_id"] + "|create-test"), fields["mac"]);
            return new(HttpStatusCode.OK) { Content = JsonContent.Create(new {return_code = Code, amount = Amount, zp_trans_id = 123456L, is_processing = Code == 3}) };
        }
    }
    internal sealed class Session : IAsyncDisposable
    {
        public CheckoutTests.Fixture Source = null!; public WebApplicationFactory<Program> Factory = null!;
        public HttpClient Client = null!; public GatewayHandler Gateway = new(); public OrderReceipt Receipt = null!;
        public string Path => "/api/v1/orders/" + Receipt.Reference + "/zalopay/";
        public static async Task<Session> Create()
        {
            var s = new Session {Source = await CheckoutTests.Fixture.Create(5)};
            s.Factory = s.Source.Factory.WithWebHostBuilder(b => b.ConfigureTestServices(services => {
                services.PostConfigure<ZaloOptions>(o => { o.AppId = 2554; o.Key1 = "create-test"; o.Key2 = "callback-test"; });
                services.AddHttpClient<IZaloGateway,ZaloGateway>().ConfigurePrimaryHttpMessageHandler(() => s.Gateway);
            }));
            s.Client = s.Factory.CreateClient(new WebApplicationFactoryClientOptions {BaseAddress = new Uri("https://localhost")});
            using var quoted = await s.Post("/api/v1/cart/quote", new QuoteRequest([new(s.Source.VariantId,2)]));
            var quote = (await quoted.Content.ReadFromJsonAsync<CartQuote>())!;
            using var placed = await s.Post("/api/v1/orders", s.Source.Command(quote) with {PaymentMethod = "zalopay"}, key: Guid.NewGuid());
            Assert.Equal(HttpStatusCode.Created, placed.StatusCode); s.Receipt = (await placed.Content.ReadFromJsonAsync<OrderReceipt>())!;
            return s;
        }
        public async Task<HttpResponseMessage> Post(string path, object body, string? secret = null, Guid? key = null)
        {
            var csrf = (await Client.GetFromJsonAsync<Dictionary<string,string>>("/api/v1/auth/csrf"))!["requestToken"];
            using var request = new HttpRequestMessage(HttpMethod.Post,path) {Content = JsonContent.Create(body)};
            request.Headers.Add("X-CSRF-TOKEN",csrf); if (Receipt is not null) request.Headers.Add("X-Order-Token",secret ?? Receipt.AccessToken);
            if (key.HasValue) request.Headers.Add("Idempotency-Key",key.ToString()); return await Client.SendAsync(request);
        }
        public async Task<HttpResponseMessage> Check()
        {
            using var request = new HttpRequestMessage(HttpMethod.Get,Path); request.Headers.Add("X-Order-Token",Receipt.AccessToken); return await Client.SendAsync(request);
        }
        public async Task<int> Callback(long amount, bool valid = true, long providerId = 123456)
        {
            var data = JsonSerializer.Serialize(new {app_id = 2554, app_trans_id = Gateway.Form["app_trans_id"], amount, zp_trans_id = providerId});
            using var response = await Client.PostAsJsonAsync("/api/v1/payments/zalopay/callback", new {data, mac = valid ? ZaloGateway.Sign("callback-test", data) : new string('0',64), type = 1});
            Assert.Equal(HttpStatusCode.OK,response.StatusCode); return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("return_code").GetInt32();
        }
        public async ValueTask DisposeAsync() { Client.Dispose(); await Factory.DisposeAsync(); await Source.DisposeAsync(); }
    }
}
