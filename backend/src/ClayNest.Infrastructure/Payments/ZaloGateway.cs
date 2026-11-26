using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ClayNest.Application.Payments;
using Microsoft.Extensions.Options;
namespace ClayNest.Infrastructure.Payments;
public sealed class ZaloGateway(HttpClient http, IOptions<ZaloOptions> settings) : IZaloGateway
{
    private ZaloOptions Options => settings.Value;
    public static string Sign(string key, string data) => Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(data)));
    public bool VerifyCallback(string data, string mac)
    {
        if (!Options.Enabled || string.IsNullOrEmpty(data) || data.Length > 16000 || mac?.Length != 64) return false;
        try { return CryptographicOperations.FixedTimeEquals(Convert.FromHexString(Sign(Options.Key2.Trim(), data)), Convert.FromHexString(mac)); }
        catch (FormatException) { return false; }
    }
    private async Task<JsonDocument> Send(string url, Dictionary<string,string> form, CancellationToken ct)
    {
        if (!Options.Enabled) throw new PaymentGatewayException("ZaloPay chưa được cấu hình.");
        try {
            using var response = await http.PostAsync(url, new FormUrlEncodedContent(form), ct);
            if (!response.IsSuccessStatusCode) throw new PaymentGatewayException("ZaloPay chưa phản hồi thành công. Vui lòng thử kiểm tra lại.");
            return JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        } catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException) {
            throw new PaymentGatewayException("Chưa xác nhận được phản hồi ZaloPay. Không tạo đơn mới; hãy kiểm tra lại đơn đã gửi.");
        }
    }
    public async Task<GatewayCreated> CreateAsync(string appTransId, long appTime, long amount, string reference, CancellationToken ct)
    {
        const string user = "NangGom", item = "[]";
        var embed = JsonSerializer.Serialize(new { redirecturl = Options.FrontendUrl.TrimEnd('/') + "/checkout" });
        var appId = Options.AppId.ToString(CultureInfo.InvariantCulture);
        var time = appTime.ToString(CultureInfo.InvariantCulture); var total = amount.ToString(CultureInfo.InvariantCulture);
        var form = new Dictionary<string,string> { ["app_id"] = appId, ["app_user"] = user, ["app_trans_id"] = appTransId,
            ["app_time"] = time, ["amount"] = total, ["item"] = item, ["embed_data"] = embed, ["bank_code"] = "",
            ["expire_duration_seconds"] = "900", ["description"] = "Nang Gom - " + reference,
            ["mac"] = Sign(Options.Key1.Trim(), string.Join("|", appId, appTransId, user, total, time, embed, item)) };
        if (!string.IsNullOrWhiteSpace(Options.CallbackUrl)) {
            if (!Uri.TryCreate(Options.CallbackUrl, UriKind.Absolute, out var callback) || callback.Scheme != "https")
                throw new PaymentGatewayException("URL callback ZaloPay cần là địa chỉ HTTPS công khai.");
            form["callback_url"] = callback.AbsoluteUri;
        }
        using var json = await Send(Options.ApiEndpoint, form, ct); var root = json.RootElement;
        if (!root.TryGetProperty("return_code", out var code) || code.GetInt32() != 1)
            throw new PaymentGatewayException("ZaloPay chưa cấp được mã QR. Hãy kiểm tra trạng thái hoặc thử lại với cùng đơn hàng.");
        var url = root.TryGetProperty("order_url", out var u) ? u.GetString() ?? "" : "";
        var qr = root.TryGetProperty("qr_code", out var q) ? q.GetString() ?? "" : "";
        if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed) || parsed.Scheme != "https" || !(parsed.Host == "zalopay.vn" || parsed.Host.EndsWith(".zalopay.vn", StringComparison.Ordinal)) || url.Length > 2048)
            throw new PaymentGatewayException("Phản hồi cổng thanh toán không hợp lệ.");
        if (qr.Length == 0) qr = url;
        if (qr.Length > 8192) throw new PaymentGatewayException("Dữ liệu QR không hợp lệ.");
        return new(qr, url);
    }
    public async Task<GatewayStatus> QueryAsync(string appTransId, CancellationToken ct)
    {
        var id = Options.AppId.ToString(CultureInfo.InvariantCulture);
        var form = new Dictionary<string,string> {["app_id"] = id, ["app_trans_id"] = appTransId,
            ["mac"] = Sign(Options.Key1.Trim(), id + "|" + appTransId + "|" + Options.Key1.Trim())};
        using var json = await Send("https://sb-openapi.zalopay.vn/v2/query", form, ct); var root = json.RootElement;
        return new(root.GetProperty("return_code").GetInt32(), root.TryGetProperty("amount", out var a) ? a.GetInt64() : 0,
            root.TryGetProperty("zp_trans_id", out var t) ? t.GetInt64() : 0, root.TryGetProperty("is_processing", out var p) && p.ValueKind == JsonValueKind.True);
    }
}
