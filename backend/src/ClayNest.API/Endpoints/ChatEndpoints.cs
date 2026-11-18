using System.Text.Json;
using ClayNest.API.Errors;
using ClayNest.Application.Chat;
using ClayNest.Domain.Orders;
using ClayNest.Infrastructure.Chat;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.Extensions.Options;

namespace ClayNest.API.Endpoints;

public sealed class ChatCapacity { public SemaphoreSlim Slots { get; } = new(4,4); }
public static class ChatEndpoints
{
    public static IEndpointRouteBuilder MapChatEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/v1/chat",async (ChatRequest input,HttpContext http,IChatService chat,ChatCapacity capacity,IAntiforgery csrf,CancellationToken ct) =>
        {
            http.Response.Headers.CacheControl = "no-store";
            try { await csrf.ValidateRequestAsync(http); }
            catch (AntiforgeryValidationException) { return ApiErrors.Create(http,400,"invalid_csrf","Phiên bảo mật không hợp lệ. Vui lòng thử lại."); }
            if (!await capacity.Slots.WaitAsync(0,ct)) return ApiErrors.Create(http,503,"chat_busy","Nàng đang bận tư vấn. Bạn thử lại sau một chút nhé.");
            try { return Results.Ok(await chat.AskAsync(input,ct)); }
            catch (ChatValidationException ex) { return ApiErrors.Create(http,400,"invalid_chat",ex.Message); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return Results.StatusCode(499); }
            catch (Exception ex) when (ex is ChatUnavailableException or HttpRequestException or JsonException or OperationCanceledException)
            { return ApiErrors.Create(http,503,"chat_unavailable","Nàng chưa kết nối được trợ lý tư vấn. Bạn vẫn có thể xem sản phẩm và đặt hàng bình thường."); }
            finally { capacity.Slots.Release(); }
        }).WithTags("Product advice").RequireRateLimiting("public-chat").Produces<ChatResponse>().ProducesProblem(400).ProducesProblem(503).ProducesProblem(429);

        var tools = endpoints.MapGroup("/internal/ai/tools").WithTags("Internal read-only catalog tools");
        foreach (var operation in new[] { "search","detail","policy" })
        {
            var name = operation;
            tools.MapPost("/" + name,async (HttpContext http,IOptions<ChatOptions> config,ServiceSignature signatures,IChatCatalog catalog,CancellationToken ct) =>
            {
                http.Response.Headers.CacheControl = "no-store";
                if (http.Request.ContentLength > 32768) return Results.StatusCode(413);
                using var memory = new MemoryStream(); var buffer = new byte[4096];
                while (true) { var count = await http.Request.Body.ReadAsync(buffer,ct); if (count == 0) break; if (memory.Length + count > 32768) return Results.StatusCode(413); memory.Write(buffer,0,count); }
                var body = memory.ToArray(); const string scope = "catalog:read";
                if (http.Request.Headers["X-Service-Scope"] != scope || !signatures.Verify(config.Value.ToolSecret,http.Request.Path,scope,
                    http.Request.Headers["X-Service-Time"].ToString(),http.Request.Headers["X-Service-Nonce"].ToString(),http.Request.Headers["X-Service-Signature"].ToString(),body))
                    return ApiErrors.Create(http,401,"invalid_service_credential","Service credential invalid.");
                try
                {
                    var json = new JsonSerializerOptions(JsonSerializerDefaults.Web) { UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow };
                    if (name == "search") return Results.Ok(await catalog.SearchAsync(JsonSerializer.Deserialize<ChatFilters>(body,json) ?? throw new JsonException(),ct));
                    if (name == "detail") return Results.Ok(await catalog.DetailAsync((JsonSerializer.Deserialize<DetailRequest>(body,json) ?? throw new JsonException()).Slug,ct));
                    if (JsonSerializer.Deserialize<Dictionary<string,JsonElement>>(body,json)?.Count != 0) throw new JsonException();
                    return Results.Ok(new { shipping = CommercePolicy.ShippingDescription, packing = CommercePolicy.PackingDescription });
                }
                catch (Exception ex) when (ex is JsonException or ChatValidationException or ArgumentException)
                { return ApiErrors.Create(http,400,"invalid_tool_input","Tool input invalid."); }
            });
        }
        return endpoints;
    }
    public sealed record DetailRequest(string Slug);
}
