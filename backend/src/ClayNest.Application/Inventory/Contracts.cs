using ClayNest.Application.Catalog;
namespace ClayNest.Application.Inventory;

public sealed record StockQuery(string? Q = null, bool LowOnly = false, int Page = 1, int PageSize = 20);
public sealed record StockItem(Guid VariantId, Guid ProductId, string ProductName, string VariantName, string Sku,
    int StockQty, int LowStockThreshold, Guid Revision, bool Active, string Image);
public sealed record StockChange(string Kind, int QuantityDelta, string Reason, Guid Revision, int? LowStockThreshold = null);
public sealed record MovementDto(Guid Id, Guid VariantId, string Kind, int QuantityDelta, int BalanceAfter,
    int ThresholdAfter, string Reason, Guid? ActorId, string ActorName, DateTimeOffset CreatedAt);
public sealed record StockChangeResult(StockItem Item, MovementDto Movement);
public sealed class StockConflictException(string message) : Exception(message);
public interface IInventoryService
{
    Task<PageResult<StockItem>> SearchAsync(StockQuery query, CancellationToken ct);
    Task<PageResult<MovementDto>> HistoryAsync(Guid variantId, int page, CancellationToken ct);
    Task<StockChangeResult> ChangeAsync(Guid variantId, StockChange change, Guid actorId, string actorName, CancellationToken ct);
}
