using ClayNest.Application.Payments;
using ClayNest.Domain.Payments;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
namespace ClayNest.Infrastructure.Payments;
public sealed class ZaloReconciliationWorker(IServiceScopeFactory scopes, TimeProvider clock, IOptions<ZaloOptions> settings, ILogger<ZaloReconciliationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(60));
        while (await timer.WaitForNextTickAsync(stoppingToken)) {
            if (!settings.Value.Enabled) continue;
            try {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<CommerceDbContext>();
                var ids = await (from p in db.Set<ZaloPayment>().AsNoTracking() join o in db.Orders.AsNoTracking() on p.OrderId equals o.Id
                    where p.State != "paid" && (p.State != "expired" || o.Status == "pending")
                    orderby p.LastCheckedAt, p.ExpiresAt select p.Id).Take(20).ToListAsync(stoppingToken);
                var cutoff = clock.GetUtcNow().AddMinutes(-15);
                var abandoned = await db.Orders.AsNoTracking().Where(o => o.PaymentMethod == "zalopay" && o.PaymentStatus == "unpaid" && o.Status == "pending"
                    && o.CreatedAt < cutoff && !db.Set<ZaloPayment>().Any(p => p.OrderId == o.Id)).Select(o => new {o.Id, o.Revision}).Take(20).ToListAsync(stoppingToken);
                foreach (var order in abandoned) {
                    try {
                        await using var unit = scopes.CreateAsyncScope();
                        await unit.ServiceProvider.GetRequiredService<ClayNest.Application.Orders.IAdminOrderService>().TransitionAsync(order.Id,
                            new("cancelled", order.Revision, "Không có giao dịch QR trong thời gian thanh toán.", order.Id),
                            Guid.Parse("a81ac344-86c1-49aa-83cd-3957d774b607"), "Đối soát ZaloPay", stoppingToken);
                    } catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) {return;}
                    catch (Exception) {logger.LogWarning("ZaloPay unstarted order reconciliation will retry.");}
                }
                foreach (var id in ids) {
                    try {
                        await using var unit = scopes.CreateAsyncScope();
                        await unit.ServiceProvider.GetRequiredService<IZaloPayments>().ReconcileAsync(id, stoppingToken);
                    } catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
                    catch (Exception) { logger.LogWarning("ZaloPay reconciliation delayed for payment {PaymentId}.", id); }
                }
            } catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception) { logger.LogWarning("ZaloPay reconciliation will retry at the next interval."); }
        }
    }
}
