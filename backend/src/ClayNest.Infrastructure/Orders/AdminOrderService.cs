using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ClayNest.Application.Catalog;
using ClayNest.Application.Orders;
using ClayNest.Domain.Catalog;
using ClayNest.Domain.Inventory;
using ClayNest.Domain.Orders;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ClayNest.Infrastructure.Orders;

public sealed class AdminOrderService(CommerceDbContext db, TimeProvider clock) : IAdminOrderService
{
    public async Task<PageResult<AdminOrderRow>> SearchAsync(AdminOrderQuery query, CancellationToken ct)
    {
        var term = query.Q?.Trim().ToUpperInvariant() ?? "";
        var state = query.Status?.Trim();
        if (query.Page is < 1 or > 100000 || query.PageSize is < 1 or > 50 || term.Length > 32
            || !Regex.IsMatch(term, "^[A-Z0-9-]*$") || !string.IsNullOrEmpty(state) && !OrderFlow.IsState(state)
            || query.From?.Year is < 2000 or > 2100 || query.To?.Year is < 2000 or > 2100
            || query.From.HasValue && query.To.HasValue && query.From > query.To)
            throw new OrderRuleException("Bộ lọc đơn hàng không hợp lệ; ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");
        var orders = db.Orders.AsNoTracking();
        if (term.Length > 0) orders = orders.Where(o => o.Reference.Contains(term));
        if (!string.IsNullOrEmpty(state)) orders = orders.Where(o => o.Status == state);
        if (query.From.HasValue)
        {
            var from = new DateTimeOffset(query.From.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(7)).ToUniversalTime();
            orders = orders.Where(o => o.CreatedAt >= from);
        }
        if (query.To.HasValue)
        {
            var until = new DateTimeOffset(query.To.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(7)).ToUniversalTime();
            orders = orders.Where(o => o.CreatedAt < until);
        }
        var count = await orders.CountAsync(ct);
        var items = await orders.OrderByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .Select(o => new AdminOrderRow(o.Id, o.Reference, o.CustomerName, o.Province, o.Status, o.PaymentStatus,
                o.GrandTotalVnd, o.Items.Sum(i => i.Quantity), o.CreatedAt, o.Revision)).ToListAsync(ct);
        return new(items, query.Page, query.PageSize, count);
    }
    public async Task<AdminOrderDetail?> FindAsync(Guid id, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().Include(o => o.Items).SingleOrDefaultAsync(o => o.Id == id, ct);
        return order is null ? null : await Detail(order, ct);
    }
    private async Task<AdminOrderDetail> Detail(Order o, CancellationToken ct) => new(o.Id, o.Reference, o.Status, o.PaymentStatus,
        o.SubtotalVnd, o.ShippingFeeVnd, o.GrandTotalVnd, o.CreatedAt, o.UpdatedAt, o.CompletedAt, o.CancelledAt, o.RestockedAt, o.Revision,
        new(o.CustomerName, o.Phone, o.Email, o.Province, o.Address, o.ShippingNote),
        o.Items.OrderBy(i => i.Sku).Select(i => new OrderLineDto(i.Sku, i.ProductName, i.VariantName, i.Image, i.Quantity, i.UnitPriceVnd, i.LineTotalVnd)).ToList(),
        await db.OrderStatusChanges.AsNoTracking().Where(e => e.OrderId == o.Id && e.Sequence <= o.Revision).OrderBy(e => e.Sequence)
            .Select(e => new AdminOrderEvent(e.Id, e.Sequence, e.FromStatus, e.ToStatus, e.Reason, e.ActorId, e.ActorName, e.CreatedAt)).ToListAsync(ct), await Allowed(o, ct), o.PaymentMethod);

    private async Task<List<string>> Allowed(Order order, CancellationToken ct)
    {
        var next = OrderFlow.Next(order.Status).ToList();
        if (order.PaymentMethod != "zalopay") return next;
        if (order.PaymentStatus != "paid") next.RemoveAll(s => s != "cancelled");
        var paymentState = await db.Set<ClayNest.Domain.Payments.ZaloPayment>().Where(p => p.OrderId == order.Id).Select(p => p.State).SingleOrDefaultAsync(ct);
        if (order.PaymentStatus != "unpaid" || paymentState is not (null or "expired")) next.Remove("cancelled");
        return next;
    }
    public async Task<AdminOrderDetail> TransitionAsync(Guid id, OrderTransition input, Guid actorId, string actorName, CancellationToken ct)
    {
        var reason = input.Reason?.Trim() ?? "";
        if (input.RequestId == Guid.Empty || input.Revision < 0 || actorId == Guid.Empty || reason.Length is < 3 or > 500 || !OrderFlow.IsState(input.Status))
            throw new OrderRuleException("Cần trạng thái hợp lệ, mã thao tác và lý do từ 3–500 ký tự.");
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { input.Status, input.Revision, reason, input.ConfirmCodCollected, actorId }))));
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var order = await db.Orders.FromSqlInterpolated($"SELECT * FROM commerce.\"Orders\" WHERE \"Id\" = {id} FOR UPDATE").SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException();
        await db.Entry(order).ReloadAsync(ct);
        await db.Entry(order).Collection(o => o.Items).LoadAsync(ct);
        var previous = await db.OrderStatusChanges.AsNoTracking().SingleOrDefaultAsync(e => e.OrderId == id && e.RequestId == input.RequestId, ct);
        if (previous is not null)
        {
            if (previous.PayloadHash != hash) throw new OrderConflictException("order_request_conflict", "Mã thao tác đã được dùng cho nội dung khác. Vui lòng tải lại đơn.");
            return await Detail(order, ct);
        }
        if (order.Revision != input.Revision) throw new OrderConflictException("order_conflict", "Đơn đã được cập nhật bởi thao tác khác. Vui lòng tải lại trước khi xử lý.");
        if (order.PaymentMethod == "zalopay" && !(await Allowed(order, ct)).Contains(input.Status)) throw new OrderRuleException("Đơn chưa đủ điều kiện chuyển trạng thái. Đơn ZaloPay cần xác nhận thanh toán; giao dịch còn hiệu lực chưa được hủy.");
        var from = order.Status;
        order.TransitionTo(input.Status, input.ConfirmCodCollected, clock.GetUtcNow());
        if (input.Status == "cancelled")
        {
            foreach (var item in order.Items.OrderBy(i => i.VariantId))
            {
                // Lock in the same variant order as checkout. Restore even if the SKU was unpublished/archived.
                var variant = await db.Set<ProductVariant>().FromSqlInterpolated($"SELECT * FROM commerce.\"ProductVariants\" WHERE \"Id\" = {item.VariantId} FOR UPDATE").SingleAsync(ct);
                variant.ChangeStock(item.Quantity);
                db.StockMovements.Add(new StockMovement(variant.Id, "restock", item.Quantity, variant.StockQty,
                    variant.LowStockThreshold, "Hoàn kho đơn " + order.Reference, actorId, actorName, order.Id));
            }
            order.MarkRestocked();
        }
        db.OrderStatusChanges.Add(new OrderStatusChange(order.Id, order.Revision, from, order.Status, reason,
            actorId, actorName, order.UpdatedAt, input.RequestId, hash));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { throw new OrderConflictException("order_conflict", "Đơn hoặc tồn kho đã thay đổi. Vui lòng tải lại."); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { throw new OrderConflictException("order_conflict", "Thao tác này đã được ghi nhận. Vui lòng tải lại đơn."); }
        await transaction.CommitAsync(ct);
        return await Detail(order, ct);
    }
}
