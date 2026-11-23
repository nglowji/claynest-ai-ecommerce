using System.Text.Json;
using ClayNest.API.Configuration;
using ClayNest.API.Errors;
using ClayNest.Application.AdminAi;
using ClayNest.Application.Chat;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
namespace ClayNest.API.Endpoints;

public sealed class AdminAiCapacity
{
    public SemaphoreSlim Slots { get; } = new(2, 2);
}
public static class AdminAiEndpoints
{
    public static IEndpointRouteBuilder MapAdminAiEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/v1/admin/assistant", async (AdminAiRequest input, HttpContext http,
            IAdminAiService service, AdminAiCapacity capacity, IAntiforgery csrf, CancellationToken ct) =>
        {
            http.Response.Headers.CacheControl = "no-store";
            http.Response.Headers["X-Content-Type-Options"] = "nosniff";
            try { await csrf.ValidateRequestAsync(http); }
            catch (AntiforgeryValidationException)
            {
                return ApiErrors.Create(http, 400, "invalid_csrf", "Phiên bảo mật không hợp lệ. Vui lòng thử lại.");
            }
            if (!await capacity.Slots.WaitAsync(0, ct))
                return ApiErrors.Create(http, 503, "assistant_busy", "Trợ lý đang bận. Vui lòng thử lại sau.");
            try { return Results.Ok(await service.AskAsync(input, ct)); }
            catch (ChatValidationException ex) { return ApiErrors.Create(http, 400, "invalid_assistant", ex.Message); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return Results.StatusCode(499); }
            catch (Exception ex) when (ex is ChatUnavailableException or KnowledgeException or HttpRequestException or JsonException or OperationCanceledException)
            {
                return ApiErrors.Create(http, 503, "assistant_unavailable", "Chưa kết nối được trợ lý quản trị. Bạn có thể tiếp tục dùng các màn hình quản lý.");
            }
            finally { capacity.Slots.Release(); }
        }).RequireAuthorization(AdminAuthentication.Policy).RequireRateLimiting("admin-assistant")
            .WithMetadata(new RequestSizeLimitAttribute(8192)).WithTags("Admin assistant")
            .Produces<AdminAiResponse>().ProducesProblem(400).ProducesProblem(401)
            .ProducesProblem(403).ProducesProblem(429).ProducesProblem(503);
        return endpoints;
    }
}
