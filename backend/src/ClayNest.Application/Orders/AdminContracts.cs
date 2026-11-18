using ClayNest.Application.Catalog;
using ClayNest.Domain.Orders;
namespace ClayNest.Application.Orders;

public sealed record AdminOrderQuery(string? Q = null, string? Status = null, DateOnly? From = null, DateOnly? To = null, int Page = 1, int PageSize = 20);
public sealed record AdminOrderRow(Guid Id, string Reference, string CustomerName, string Province, string Status,
    string PaymentStatus, long GrandTotalVnd, int ItemCount, DateTimeOffset CreatedAt, int Revision);
public sealed record AdminOrderEvent(Guid Id, int Sequence, string FromStatus, string ToStatus, string Reason,
    Guid? ActorId, string ActorName, DateTimeOffset CreatedAt);
public sealed record AdminOrderDetail(Guid Id, string Reference, string Status, string PaymentStatus,
    long SubtotalVnd, long ShippingFeeVnd, long GrandTotalVnd, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
    DateTimeOffset? CompletedAt, DateTimeOffset? CancelledAt, DateTimeOffset? RestockedAt, int Revision,
    ShippingContact Contact, List<OrderLineDto> Items, List<AdminOrderEvent> History, List<string> AllowedTransitions);
public sealed record OrderTransition(string Status, int Revision, string Reason, Guid RequestId, bool ConfirmCodCollected = false);
public sealed class OrderConflictException(string code, string message) : Exception(message) { public string Code { get; } = code; }
public interface IAdminOrderService
{
    Task<PageResult<AdminOrderRow>> SearchAsync(AdminOrderQuery query, CancellationToken ct);
    Task<AdminOrderDetail?> FindAsync(Guid id, CancellationToken ct);
    Task<AdminOrderDetail> TransitionAsync(Guid id, OrderTransition input, Guid actorId, string actorName, CancellationToken ct);
}
