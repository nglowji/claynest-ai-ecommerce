using ClayNest.Application.Orders;
using ClayNest.Domain.Catalog;
using ClayNest.Domain.Orders;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace ClayNest.Infrastructure.Orders;
public sealed class CustomerOrders(CommerceDbContext db) : ICustomerOrders
{
    public async Task<PurchaseHistory> SearchAsync(Guid customerId, string? query, string? status, int page, CancellationToken ct)
    {
        if (query?.Length > 32 || page is < 1 or > 100000 || !string.IsNullOrEmpty(status) && !OrderFlow.IsState(status))
            throw new OrderRuleException("Chọn trạng thái, số trang và mã đơn tối đa 32 ký tự hợp lệ.");
        var owned = db.Orders.AsNoTracking().Where(o => o.CustomerId == customerId);
        var counts = await owned.GroupBy(o => o.Status).Select(g => new PurchaseCount(g.Key, g.Count())).ToListAsync(ct);
        if (!string.IsNullOrWhiteSpace(query)) { var term = query.Trim().ToUpperInvariant(); owned = owned.Where(o => o.Reference.Contains(term)); }
        if (!string.IsNullOrEmpty(status)) owned = owned.Where(o => o.Status == status);
        var count = await owned.CountAsync(ct);
        var orders = await owned.OrderByDescending(o => o.CreatedAt).ThenByDescending(o => o.Id).Skip((page - 1) * 5).Take(5).Include(o => o.Items).ToListAsync(ct);
        var ids = orders.SelectMany(o => o.Items).Select(i => i.VariantId).Distinct().ToArray();
        var current = await db.Set<ProductVariant>().AsNoTracking().Where(v => ids.Contains(v.Id) && v.Active)
            .Join(db.Products.Where(p => p.Published && !p.Archived && p.Category.Active), v => v.ProductId, p => p.Id, (v,p) => new {v.Id, p.Slug, v.StockQty})
            .ToDictionaryAsync(v => v.Id, ct);
        var rows = orders.Select(o => new PurchaseRow(o.Reference, o.Status, o.PaymentStatus, o.GrandTotalVnd, o.CreatedAt,
            o.Items.OrderBy(i => i.Sku).Select(i => new PurchaseItem(i.VariantId, current.GetValueOrDefault(i.VariantId)?.Slug, i.ProductName, i.VariantName, i.Image,
                i.Quantity, i.LineTotalVnd, current.GetValueOrDefault(i.VariantId)?.StockQty ?? 0)).ToList(), o.PaymentMethod)).ToList();
        return new(new(rows, page, 5, count), counts);
    }
}
