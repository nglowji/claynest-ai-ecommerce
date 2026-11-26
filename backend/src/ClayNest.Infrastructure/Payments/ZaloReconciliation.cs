using ClayNest.Application.Orders;
using ClayNest.Application.Payments;
using ClayNest.Domain.Orders;
using ClayNest.Domain.Payments;
using Microsoft.EntityFrameworkCore;
namespace ClayNest.Infrastructure.Payments;
public sealed partial class ZaloPaymentService
{
    private async Task<bool> AcceptAsync(Guid paymentId, long amount, long providerId, CancellationToken ct)
    {
        var orderId = await db.Set<ZaloPayment>().Where(p => p.Id == paymentId).Select(p => p.OrderId).SingleAsync(ct);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var order = await Locked(orderId, ct);
        var payment = await db.Set<ZaloPayment>().SingleAsync(p => p.Id == paymentId, ct); await db.Entry(payment).ReloadAsync(ct);
        if (payment.AppId != settings.Value.AppId || amount != payment.Amount || amount != order.GrandTotalVnd || providerId <= 0 || order.PaymentMethod != "zalopay") return false;
        if (payment.State == "paid") return payment.ProviderTransactionId == providerId;
        payment.Paid(providerId); order.ConfirmZaloPayment(clock.GetUtcNow());
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return true;
    }
    public async Task ReconcileAsync(Guid paymentId, CancellationToken ct)
    {
        if (!settings.Value.Enabled) throw new PaymentGatewayException("ZaloPay chưa được cấu hình.");
        var orderId = await db.Set<ZaloPayment>().Where(p => p.Id == paymentId).Select(p => p.OrderId).SingleAsync(ct);
        Order order; ZaloPayment payment;
        await using (var transaction = await db.Database.BeginTransactionAsync(ct)) {
            order = await Locked(orderId, ct);
            payment = await db.Set<ZaloPayment>().SingleAsync(p => p.Id == paymentId, ct); await db.Entry(payment).ReloadAsync(ct);
            if (payment.AppId != settings.Value.AppId) throw new PaymentGatewayException("Giao dịch cần đối soát với cấu hình ứng dụng ban đầu.");
            if (payment.State == "paid") return;
            if (payment.State != "expired" && (payment.LastCheckedAt is null || payment.LastCheckedAt <= clock.GetUtcNow().AddSeconds(-5))) {
                var result = await gateway.QueryAsync(payment.AppTransId, ct);
                payment.Checked(clock.GetUtcNow());
                if (result.Code == 1) {
                    if (result.Amount != payment.Amount || result.Amount != order.GrandTotalVnd || result.TransactionId <= 0)
                        throw new PaymentGatewayException("Số tiền giao dịch chưa khớp với đơn hàng; cần đối soát ZaloPay.");
                    payment.Paid(result.TransactionId); order.ConfirmZaloPayment(clock.GetUtcNow());
                } else if (result.Code == 2 && !result.Processing && payment.ExpiresAt <= clock.GetUtcNow()) payment.Expire();
                await db.SaveChangesAsync(ct);
            }
            await transaction.CommitAsync(ct);
        }
        if (payment.State == "expired" && order.Status == "pending" && order.PaymentStatus == "unpaid") {
            try {
                await adminOrders.TransitionAsync(order.Id, new("cancelled", order.Revision, "Hết hạn QR; ZaloPay xác nhận giao dịch chưa thành công.", payment.Id),
                    Guid.Parse("a81ac344-86c1-49aa-83cd-3957d774b607"), "Đối soát ZaloPay", ct);
            } catch (Exception ex) when (ex is OrderConflictException or OrderRuleException or OrderTransitionException) {
                // A callback or administrator won the order lock. Re-read on the next reconciliation.
            }
        }
    }
}
