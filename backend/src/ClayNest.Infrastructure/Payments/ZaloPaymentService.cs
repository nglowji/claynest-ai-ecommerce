using System.Text.Json;
using ClayNest.Application.Orders;
using ClayNest.Application.Payments;
using ClayNest.Domain.Orders;
using ClayNest.Domain.Payments;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace ClayNest.Infrastructure.Payments;
public sealed partial class ZaloPaymentService(CommerceDbContext db, IOrderService orders, IAdminOrderService adminOrders, IZaloGateway gateway, IOptions<ZaloOptions> settings, TimeProvider clock) : IZaloPayments
{
    private async Task<Guid> Authorize(string reference, string? token, Guid? customerId, CancellationToken ct)
    {
        var order = await orders.StatusAsync(reference, token, customerId, ct) ?? throw new KeyNotFoundException();
        if (order.PaymentMethod != "zalopay") throw new OrderRuleException("Đơn này không thanh toán qua ZaloPay.");
        return await db.Orders.Where(o => o.Reference == reference).Select(o => o.Id).SingleAsync(ct);
    }
    private async Task<Order> Locked(Guid id, CancellationToken ct)
    {
        var order = await db.Orders.FromSqlInterpolated($"SELECT * FROM commerce.\"Orders\" WHERE \"Id\" = {id} FOR UPDATE").SingleAsync(ct);
        await db.Entry(order).ReloadAsync(ct); return order;
    }
    private static PaymentView View(Order order, ZaloPayment payment) => new(order.Reference,
        order.PaymentStatus == "refund_required" ? "refund_required" : payment.State, order.PaymentStatus, payment.Amount,
        payment.QrPayload, payment.OrderUrl, payment.ExpiresAt);
    public async Task<PaymentView> CreateAsync(string reference, string? token, Guid? customerId, CancellationToken ct)
    {
        if (!settings.Value.Enabled) throw new PaymentGatewayException("ZaloPay chưa được cấu hình.");
        var id = await Authorize(reference, token, customerId, ct);
        // Persist the fixed transaction ID before contacting the provider. A lost response never creates a new payment identity.
        await using (var initial = await db.Database.BeginTransactionAsync(ct)) {
            var order = await Locked(id, ct);
            if (order.Status == "cancelled") throw new OrderRuleException("Đơn đã hủy, không tạo thêm giao dịch thanh toán.");
            if (!await db.Set<ZaloPayment>().AnyAsync(p => p.OrderId == id, ct)) {
                db.Add(new ZaloPayment(id, settings.Value.AppId, order.GrandTotalVnd, clock.GetUtcNow())); await db.SaveChangesAsync(ct);
            }
            await initial.CommitAsync(ct);
        }
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var current = await Locked(id, ct);
        var payment = await db.Set<ZaloPayment>().SingleAsync(p => p.OrderId == id, ct); await db.Entry(payment).ReloadAsync(ct);
        if (payment.AppId != settings.Value.AppId || payment.Amount != current.GrandTotalVnd) throw new OrderRuleException("Cấu hình giao dịch đã thay đổi; cần đối soát đơn hàng.");
        if (current.Status == "cancelled" || payment.State == "paid" || payment.QrPayload.Length > 0 || payment.ExpiresAt <= clock.GetUtcNow()) return View(current, payment);
        try {
            // Finish storing a bounded provider response even if the browser disconnects.
            var result = await gateway.CreateAsync(payment.AppTransId, payment.AppTime, payment.Amount, current.Reference, CancellationToken.None);
            payment.Ready(result.QrPayload, result.OrderUrl); await db.SaveChangesAsync(CancellationToken.None);
            await transaction.CommitAsync(CancellationToken.None); return View(current, payment);
        } catch (PaymentGatewayException) { await transaction.CommitAsync(CancellationToken.None); throw; }
    }
    public async Task<PaymentView> CheckAsync(string reference, string? token, Guid? customerId, CancellationToken ct)
    {
        var id = await Authorize(reference, token, customerId, ct);
        var paymentId = await db.Set<ZaloPayment>().Where(p => p.OrderId == id).Select(p => (Guid?)p.Id).SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException();
        await ReconcileAsync(paymentId, ct);
        var order = await db.Orders.AsNoTracking().SingleAsync(o => o.Id == id, ct);
        var payment = await db.Set<ZaloPayment>().AsNoTracking().SingleAsync(p => p.Id == paymentId, ct);
        return View(order, payment);
    }
    public async Task<bool> CallbackAsync(ZaloCallback callback, CancellationToken ct)
    {
        if (callback.Type != 1 || !gateway.VerifyCallback(callback.Data, callback.Mac)) return false;
        try {
            using var json = JsonDocument.Parse(callback.Data); var data = json.RootElement;
            if (data.GetProperty("app_id").GetInt32() != settings.Value.AppId) return false;
            var txid = data.GetProperty("app_trans_id").GetString();
            var paymentId = await db.Set<ZaloPayment>().Where(p => p.AppTransId == txid).Select(p => (Guid?)p.Id).SingleOrDefaultAsync(ct);
            if (paymentId is null) return false;
            return await AcceptAsync(paymentId.Value, data.GetProperty("amount").GetInt64(), data.GetProperty("zp_trans_id").GetInt64(), ct);
        } catch (Exception ex) when (ex is JsonException or InvalidOperationException or KeyNotFoundException or FormatException) {return false;}
    }
}
