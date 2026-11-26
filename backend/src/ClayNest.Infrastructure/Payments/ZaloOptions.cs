namespace ClayNest.Infrastructure.Payments;
public sealed class ZaloOptions
{
    public int AppId { get; set; }
    public string Key1 { get; set; } = "";
    public string Key2 { get; set; } = "";
    public string ApiEndpoint { get; set; } = "https://sb-openapi.zalopay.vn/v2/create";
    public string CallbackUrl { get; set; } = "";
    public string FrontendUrl { get; set; } = "http://127.0.0.1:5173";
    public bool Enabled => AppId > 0 && !string.IsNullOrWhiteSpace(Key1) && !string.IsNullOrWhiteSpace(Key2)
        && ApiEndpoint == "https://sb-openapi.zalopay.vn/v2/create";
}
