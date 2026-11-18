namespace ClayNest.Domain.Inventory;

public sealed class StockRuleException(string message) : Exception(message);

public sealed class StockMovement
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid VariantId { get; private set; }
    public string Kind { get; private set; } = string.Empty;
    public int QuantityDelta { get; private set; }
    public int BalanceAfter { get; private set; }
    public int ThresholdAfter { get; private set; }
    public string Reason { get; private set; } = string.Empty;
    public Guid? ActorId { get; private set; }
    public string ActorName { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; } = DateTimeOffset.UtcNow;
    private StockMovement() { }
    public StockMovement(Guid variantId, string kind, int delta, int balanceAfter, int thresholdAfter,
        string reason, Guid? actorId, string actorName)
    {
        if (variantId == Guid.Empty || balanceAfter < 0 || thresholdAfter is < 0 or > 1000000)
            throw new StockRuleException("Thông tin tồn kho không hợp lệ.");
        if (kind is not ("opening" or "receipt" or "adjustment" or "threshold")
            || (kind == "receipt" && delta <= 0) || (kind == "adjustment" && delta == 0)
            || (kind == "threshold" && delta != 0) || (kind == "opening" && delta < 0))
            throw new StockRuleException("Loại thay đổi kho không hợp lệ.");
        reason = reason?.Trim() ?? ""; actorName = actorName?.Trim() ?? "";
        if (reason.Length is < 3 or > 500 || actorName.Length is < 1 or > 100)
            throw new StockRuleException("Cần lý do từ 3–500 ký tự và người thực hiện.");
        VariantId = variantId; Kind = kind; QuantityDelta = delta; BalanceAfter = balanceAfter;
        ThresholdAfter = thresholdAfter; Reason = reason; ActorId = actorId; ActorName = actorName;
    }
}
