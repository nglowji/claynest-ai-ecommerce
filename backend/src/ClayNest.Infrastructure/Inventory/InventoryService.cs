using ClayNest.Application.Catalog;
using ClayNest.Application.Inventory;
using ClayNest.Domain.Catalog;
using ClayNest.Domain.Inventory;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ClayNest.Infrastructure.Inventory;

public sealed class InventoryService(CommerceDbContext db) : IInventoryService
{
    public async Task<PageResult<StockItem>> SearchAsync(StockQuery query, CancellationToken ct)
    {
        if (query.Page is < 1 or > 100000 || query.PageSize is < 1 or > 50 || query.Q?.Length > 180)
            throw new StockRuleException("Bộ lọc kho không hợp lệ.");
        var variants = db.Set<ProductVariant>().AsNoTracking().Where(v => db.Products.Any(p => p.Id == v.ProductId && !p.Archived));
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = Product.NormalizeSearch(query.Q.Trim());
            variants = variants.Where(v => v.Sku.ToLower().Contains(term) || db.Products.Any(p => p.Id == v.ProductId && p.SearchText.Contains(term)));
        }
        if (query.LowOnly) variants = variants.Where(v => v.Active && v.StockQty <= v.LowStockThreshold);
        var total = await variants.CountAsync(ct);
        var items = await Project(variants.OrderBy(v => v.Sku).ThenBy(v => v.Id)).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(ct);
        return new(items, query.Page, query.PageSize, total);
    }

    private IQueryable<StockItem> Project(IQueryable<ProductVariant> variants) =>
        from v in variants join p in db.Products.AsNoTracking() on v.ProductId equals p.Id
        select new StockItem(v.Id, p.Id, p.Name, v.Name, v.Sku, v.StockQty, v.LowStockThreshold,
            v.StockRevision, v.Active, p.Images.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.Url).FirstOrDefault() ?? "");

    public async Task<PageResult<MovementDto>> HistoryAsync(Guid variantId, int page, CancellationToken ct)
    {
        if (page is < 1 or > 100000) throw new StockRuleException("Trang không hợp lệ.");
        if (!await db.Set<ProductVariant>().AnyAsync(v => v.Id == variantId, ct)) throw new KeyNotFoundException();
        var movements = db.StockMovements.AsNoTracking().Where(m => m.VariantId == variantId);
        var total = await movements.CountAsync(ct);
        var items = await movements.OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id).Skip((page - 1) * 20).Take(20)
            .Select(m => new MovementDto(m.Id, m.VariantId, m.Kind, m.QuantityDelta, m.BalanceAfter, m.ThresholdAfter,
                m.Reason, m.ActorId, m.ActorName, m.CreatedAt)).ToListAsync(ct);
        return new(items, page, 20, total);
    }

    public async Task<StockChangeResult> ChangeAsync(Guid variantId, StockChange change, Guid actorId, string actorName, CancellationToken ct)
    {
        if (actorId == Guid.Empty || change.Revision == Guid.Empty || change.QuantityDelta is < -1000000 or > 1000000
            || change.Kind is not ("receipt" or "adjustment" or "threshold"))
            throw new StockRuleException("Thông tin thay đổi kho không hợp lệ.");
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // All inventory writers acquire the same variant row lock before checking the revision/balance.
        var variant = await db.Set<ProductVariant>().FromSqlInterpolated($"SELECT * FROM commerce.\"ProductVariants\" WHERE \"Id\" = {variantId} FOR UPDATE").SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException();
        if (!await db.Products.AnyAsync(p => p.Id == variant.ProductId && !p.Archived, ct))
            throw new StockRuleException("Không thể thay đổi kho sản phẩm đã lưu trữ.");
        if (variant.StockRevision != change.Revision)
            throw new StockConflictException("Tồn kho đã thay đổi. Tải lại số lượng trước khi lưu.");
        if (change.Kind == "threshold" && (!change.LowStockThreshold.HasValue || change.QuantityDelta != 0))
            throw new StockRuleException("Cần ngưỡng cảnh báo và số lượng thay đổi bằng 0.");
        variant.ChangeStock(change.QuantityDelta, change.LowStockThreshold);
        var movement = new StockMovement(variant.Id, change.Kind, change.QuantityDelta, variant.StockQty,
            variant.LowStockThreshold, change.Reason, actorId, actorName);
        db.StockMovements.Add(movement);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { throw new StockConflictException("Tồn kho đã thay đổi. Vui lòng tải lại."); }
        await transaction.CommitAsync(ct);
        var item = await Project(db.Set<ProductVariant>().AsNoTracking().Where(v => v.Id == variantId)).SingleAsync(ct);
        return new(item, new(movement.Id, movement.VariantId, movement.Kind, movement.QuantityDelta, movement.BalanceAfter,
            movement.ThresholdAfter, movement.Reason, movement.ActorId, movement.ActorName, movement.CreatedAt));
    }
}
