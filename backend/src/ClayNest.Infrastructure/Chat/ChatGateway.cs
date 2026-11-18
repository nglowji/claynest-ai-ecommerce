using System.Net.Http.Json;
using System.Text.Json;
using ClayNest.Application.Chat;
using Microsoft.Extensions.Options;
namespace ClayNest.Infrastructure.Chat;

public sealed class ChatGateway(HttpClient http,IOptions<ChatOptions> options,TimeProvider clock, Microsoft.AspNetCore.Http.IHttpContextAccessor context) : IChatGateway
{
    public async Task<AiDecision> AskAsync(ChatRequest request,CancellationToken ct)
    {
        var config = options.Value;
        if (config.GatewaySecret.Length < 32) throw new ChatUnavailableException();
        var body = JsonSerializer.SerializeToUtf8Bytes(request,new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var timestamp = clock.GetUtcNow().ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);
        var nonce = Guid.NewGuid().ToString("N"); const string path = "/internal/chat"; const string scope = "chat:public";
        using var message = new HttpRequestMessage(HttpMethod.Post,new Uri(new Uri(config.BaseUrl),path)) { Content = new ByteArrayContent(body) };
        message.Content.Headers.ContentType = new("application/json");
        message.Headers.Add("X-Correlation-ID",context.HttpContext?.TraceIdentifier ?? Guid.NewGuid().ToString("N"));
        message.Headers.Add("X-Service-Time",timestamp); message.Headers.Add("X-Service-Nonce",nonce); message.Headers.Add("X-Service-Scope",scope);
        message.Headers.Add("X-Service-Signature",ServiceSignature.Sign(config.GatewaySecret,path,scope,timestamp,nonce,body));
        using var response = await http.SendAsync(message,ct);
        if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > 32768) throw new ChatUnavailableException();
        var bytes = await response.Content.ReadAsByteArrayAsync(ct);
        if (bytes.Length > 32768) throw new ChatUnavailableException();
        return JsonSerializer.Deserialize<AiDecision>(bytes,new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? throw new ChatUnavailableException();
    }
}
