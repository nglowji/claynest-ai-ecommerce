namespace ClayNest.Application.Payments;
public sealed record PaymentView(string Reference, string State, string PaymentStatus, long Amount, string QrPayload, string OrderUrl, DateTimeOffset ExpiresAt, bool Sandbox = true);
public sealed record GatewayCreated(string QrPayload, string OrderUrl);
public sealed record GatewayStatus(int Code, long Amount, long TransactionId, bool Processing);
public sealed record ZaloCallback(string Data, string Mac, int Type);
public sealed class PaymentGatewayException(string message) : Exception(message);
public interface IZaloGateway
{
    Task<GatewayCreated> CreateAsync(string appTransId, long appTime, long amount, string reference, CancellationToken ct);
    Task<GatewayStatus> QueryAsync(string appTransId, CancellationToken ct);
    bool VerifyCallback(string data, string mac);
}
public interface IZaloPayments
{
    Task<PaymentView> CreateAsync(string reference, string? token, Guid? customerId, CancellationToken ct);
    Task<PaymentView> CheckAsync(string reference, string? token, Guid? customerId, CancellationToken ct);
    Task<bool> CallbackAsync(ZaloCallback callback, CancellationToken ct);
    Task ReconcileAsync(Guid paymentId, CancellationToken ct);
}
