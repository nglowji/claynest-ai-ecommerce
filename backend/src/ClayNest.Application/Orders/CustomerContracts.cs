using ClayNest.Application.Catalog;
namespace ClayNest.Application.Orders;
public sealed record PurchaseItem(Guid VariantId, string? Slug, string Name, string VariantName, string Image, int Quantity, long LineTotalVnd, int AvailableQty);
public sealed record PurchaseRow(string Reference, string Status, string PaymentStatus, long GrandTotalVnd, DateTimeOffset CreatedAt, List<PurchaseItem> Items);
public sealed record PurchaseCount(string Status, int Count);
public sealed record PurchaseHistory(PageResult<PurchaseRow> Orders, List<PurchaseCount> Counts);
public interface ICustomerOrders
{
    Task<PurchaseHistory> SearchAsync(Guid customerId, string? query, string? status, int page, CancellationToken ct);
}
