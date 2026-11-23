using System.Globalization;
using System.Text.Json;
using ClayNest.Application.AdminAi;
using ClayNest.Application.Chat;
using ClayNest.Infrastructure.Chat;
using Microsoft.Extensions.Options;
namespace ClayNest.Infrastructure.AdminAi;

public sealed class AdminAiGateway(HttpClient http, IOptions<ChatOptions> options, TimeProvider clock,
    Microsoft.AspNetCore.Http.IHttpContextAccessor context) : IAdminAiGateway
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow
    };
    public async Task<AdminAiDecision> AskAsync(AdminAiContext input, CancellationToken ct)
    {
        var config = options.Value;
        if (config.GatewaySecret.Length < 32) throw new ChatUnavailableException();
        const string path = "/internal/admin-assistant", scope = "chat:admin";
        var body = JsonSerializer.SerializeToUtf8Bytes(input, Json);
        var timestamp = clock.GetUtcNow().ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        var nonce = Guid.NewGuid().ToString("N");
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(new Uri(config.BaseUrl), path))
        {
            Content = new ByteArrayContent(body)
        };
        request.Content.Headers.ContentType = new("application/json");
        request.Headers.Add("X-Service-Time", timestamp);
        request.Headers.Add("X-Service-Nonce", nonce);
        request.Headers.Add("X-Service-Scope", scope);
        request.Headers.Add("X-Service-Signature", ServiceSignature.Sign(config.GatewaySecret, path, scope, timestamp, nonce, body));
        request.Headers.Add("X-Correlation-ID", context.HttpContext?.TraceIdentifier ?? Guid.NewGuid().ToString("N"));
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!response.IsSuccessStatusCode) throw new ChatUnavailableException();
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var memory = new MemoryStream();
        var buffer = new byte[4096];
        while (true)
        {
            var count = await stream.ReadAsync(buffer, ct);
            if (count == 0) break;
            if (memory.Length + count > 16384) throw new ChatUnavailableException();
            memory.Write(buffer, 0, count);
        }
        return JsonSerializer.Deserialize<AdminAiDecision>(memory.ToArray(), Json) ?? throw new ChatUnavailableException();
    }
}
