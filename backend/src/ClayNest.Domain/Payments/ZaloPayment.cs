namespace ClayNest.Domain.Payments;
public sealed class ZaloPayment
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid OrderId { get; private set; }
    public int AppId { get; private set; }
    public string AppTransId { get; private set; } = "";
    public long Amount { get; private set; }
    public long AppTime { get; private set; }
    public string State { get; private set; } = "created";
    public string QrPayload { get; private set; } = "";
    public string OrderUrl { get; private set; } = "";
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? LastCheckedAt { get; private set; }
    public long? ProviderTransactionId { get; private set; }
    private ZaloPayment() { }
    public ZaloPayment(Guid orderId, int appId, long amount, DateTimeOffset now)
    {
        if (appId <= 0 || amount <= 0) throw new InvalidOperationException("Invalid payment configuration or amount.");
        OrderId = orderId; AppId = appId; Amount = amount; AppTime = now.ToUnixTimeMilliseconds();
        AppTransId = now.ToOffset(TimeSpan.FromHours(7)).ToString("yyMMdd", System.Globalization.CultureInfo.InvariantCulture) + "_" + Id.ToString("N")[..24];
        ExpiresAt = now.AddMinutes(15);
    }
    public void Ready(string qr, string url) { QrPayload = qr; OrderUrl = url; State = "pending"; }
    public void Checked(DateTimeOffset now) => LastCheckedAt = now;
    public void Paid(long transactionId) { ProviderTransactionId = transactionId; State = "paid"; }
    public void Expire() { if (State != "paid") State = "expired"; }
}
