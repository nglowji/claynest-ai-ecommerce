using ClayNest.Domain.Orders;
namespace ClayNest.Application.Orders;

public sealed record CartLine(Guid VariantId, int Quantity);
public sealed record QuoteRequest(List<CartLine> Items);
public sealed record QuoteLine(Guid VariantId, int Quantity, string Name, string VariantName, string Sku, string Slug,
    string Image, long UnitPriceVnd, long? OriginalPriceVnd, long LineTotalVnd, int AvailableQty, string? Issue);
public sealed record CartQuote(List<QuoteLine> Items, long SubtotalVnd, long ShippingFeeVnd, long GrandTotalVnd,
    bool CanCheckout, string? QuoteToken, DateTimeOffset ExpiresAt, string ShippingPolicy, string PackingNote);
public sealed record AcceptedLine(Guid VariantId, int Quantity, long UnitPriceVnd);
public sealed record QuoteSnapshot(List<AcceptedLine> Items, long ShippingFeeVnd, DateTimeOffset ExpiresAt, int PolicyVersion);
public sealed record CheckoutRequest(string QuoteToken, ShippingContact Contact, bool AcceptTerms, string PaymentMethod = "cod");
public sealed record OrderReceipt(string Reference, string AccessToken, DateTimeOffset AccessExpiresAt, long GrandTotalVnd, string Status, string PaymentMethod = "cod");
public sealed record OrderLineDto(string Sku, string ProductName, string VariantName, string Image, int Quantity, long UnitPriceVnd, long LineTotalVnd);
public sealed record OrderProgressDto(string Status, DateTimeOffset ChangedAt);
public sealed record OrderStatusDto(string Reference, string Status, string PaymentMethod, string PaymentStatus,
    long SubtotalVnd, long ShippingFeeVnd, long GrandTotalVnd, DateTimeOffset CreatedAt,
    ShippingContact Contact, List<OrderLineDto> Items, DateTimeOffset? CompletedAt, DateTimeOffset? CancelledAt, List<OrderProgressDto> Timeline);
public sealed class CheckoutConflictException(string code, string message) : Exception(message) { public string Code { get; } = code; }
public interface IOrderService
{
    Task<CartQuote> QuoteAsync(QuoteRequest request, CancellationToken ct);
    Task<OrderReceipt> PlaceAsync(Guid idempotencyKey, CheckoutRequest request, Guid? customerId, CancellationToken ct);
    Task<OrderStatusDto?> StatusAsync(string reference, string? accessToken, Guid? customerId, CancellationToken ct);
    Task<bool> RevokeAccessAsync(string reference, string? accessToken, Guid? customerId, CancellationToken ct);
}
