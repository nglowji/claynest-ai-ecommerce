namespace ClayNest.Domain.Orders;

public sealed class OrderTransitionException(string message) : Exception(message);

public static class OrderFlow
{
    public static bool IsState(string? state) => state is "pending" or "confirmed" or "packed" or "shipped" or "completed" or "cancelled";
    public static IReadOnlyList<string> Next(string state) => state switch
    {
        "pending" => ["confirmed", "cancelled"],
        "confirmed" => ["packed", "cancelled"],
        "packed" => ["shipped"],
        "shipped" => ["completed"],
        _ => []
    };
    public static DateTimeOffset Timestamp(DateTimeOffset now) => new(now.UtcTicks - now.UtcTicks % 10, TimeSpan.Zero);
}

public sealed class OrderStatusChange
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid OrderId { get; private set; }
    public int Sequence { get; private set; }
    public string FromStatus { get; private set; } = string.Empty;
    public string ToStatus { get; private set; } = string.Empty;
    public string Reason { get; private set; } = string.Empty;
    public Guid? ActorId { get; private set; }
    public string ActorName { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }
    public Guid? RequestId { get; private set; }
    public string PayloadHash { get; private set; } = string.Empty;
    private OrderStatusChange() { }
    public OrderStatusChange(Guid orderId, int sequence, string from, string to, string reason,
        Guid? actorId, string actorName, DateTimeOffset now, Guid? requestId = null, string payloadHash = "")
    {
        reason = reason?.Trim() ?? ""; actorName = actorName?.Trim() ?? "";
        if (orderId == Guid.Empty || sequence < 0 || !OrderFlow.IsState(to) || reason.Length is < 3 or > 500
            || actorName.Length is < 1 or > 100 || reason.Any(c => char.IsControl(c) && c is not ('\r' or '\n')))
            throw new OrderRuleException("Thông tin lịch sử xử lý đơn không hợp lệ.");
        if (sequence == 0 ? from != "" || requestId.HasValue : !OrderFlow.Next(from).Contains(to)
            || actorId is null || actorId == Guid.Empty || requestId is null || requestId == Guid.Empty || payloadHash.Length != 64)
            throw new OrderRuleException("Lịch sử chuyển trạng thái không hợp lệ.");
        OrderId = orderId; Sequence = sequence; FromStatus = from; ToStatus = to; Reason = reason;
        ActorId = actorId; ActorName = actorName; CreatedAt = OrderFlow.Timestamp(now);
        RequestId = requestId; PayloadHash = payloadHash;
    }
}
