using System.Security.Claims;
using System.Text.Json;
using ClayNest.API.Configuration;
using ClayNest.API.Errors;
using ClayNest.Application.Chat;
using Microsoft.AspNetCore.Antiforgery;

namespace ClayNest.API.Endpoints;

public static class KnowledgeEndpoints
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static IEndpointRouteBuilder MapKnowledgeEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var admin=endpoints.MapGroup("/api/v1/admin/knowledge").RequireAuthorization(AdminAuthentication.Policy).WithTags("Knowledge administration");
        admin.AddEndpointFilter(async (context,next)=>
        {
            var http=context.HttpContext; http.Response.Headers.CacheControl="no-store";
            try
            {
                if (http.Request.Method!="GET") await http.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(http);
                return await next(context);
            }
            catch (AntiforgeryValidationException) { return ApiErrors.Create(http,400,"invalid_csrf","Phiên bảo mật không hợp lệ."); }
            catch (KnowledgeException ex) { return ApiErrors.Create(http,ex.Status,ex.Code,ex.Message); }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException) { return ApiErrors.Create(http,503,"knowledge_unavailable","Chưa kết nối được kho kiến thức. Vui lòng thử lại."); }
        });
        admin.MapGet("",(int? page,HttpContext http,IKnowledgeGateway gateway,CancellationToken ct)=>gateway.AdminAsync("list",JsonSerializer.SerializeToElement(new { page=page ?? 1 }),Actor(http),ct));
        admin.MapGet("/{id:guid}",(Guid id,HttpContext http,IKnowledgeGateway gateway,CancellationToken ct)=>gateway.AdminAsync("detail",JsonSerializer.SerializeToElement(new { documentId=id }),Actor(http),ct));
        admin.MapPost("",async (HttpContext http,IKnowledgeGateway gateway,IChatCatalog catalog,CancellationToken ct)=>
        {
            var payload=await Body(http,ct);
            if (payload is null) return ApiErrors.Create(http,413,"invalid_document","Tài liệu vượt kích thước hoặc không phải JSON hợp lệ.");
            if (payload.Value.TryGetProperty("productSlug",out var product) && product.ValueKind==JsonValueKind.String && !string.IsNullOrWhiteSpace(product.GetString()) && (await catalog.DetailAsync(product.GetString()!,ct)).Count==0)
                return ApiErrors.Create(http,400,"invalid_product","Chọn sản phẩm đã xuất bản để gắn nguồn kiến thức.");
            return Results.Ok(await gateway.AdminAsync("save",payload.Value,Actor(http),ct));
        }).RequireRateLimiting("knowledge-admin");
        foreach (var operation in new[] { "approve","revoke","reindex" })
        {
            var action=operation;
            admin.MapPost("/"+action,async (HttpContext http,IKnowledgeGateway gateway,CancellationToken ct)=>
            {
                var payload=await Body(http,ct);
                return payload is null ? ApiErrors.Create(http,400,"invalid_document","Yêu cầu không hợp lệ.") : Results.Ok(await gateway.AdminAsync(action,payload.Value,Actor(http),ct));
            }).RequireRateLimiting("knowledge-admin");
        }
        endpoints.MapGet("/api/v1/knowledge/sources/{id:guid}",async (Guid id,string? product,HttpContext http,IKnowledgeGateway gateway,IChatCatalog catalog,CancellationToken ct)=>
        {
            http.Response.Headers.CacheControl="no-store";
            try
            {
                if (product is not null && (await catalog.DetailAsync(product,ct)).Count==0) return Results.NotFound();
                var sources=await gateway.ResolveAsync([id],product,false,ct);
                return sources.Count==0 ? Results.NotFound() : Results.Ok(sources[0]);
            }
            catch (Exception ex) when (ex is KnowledgeException or HttpRequestException or TaskCanceledException or ChatValidationException or JsonException)
            { return ApiErrors.Create(http,503,"source_unavailable","Nguồn chưa sẵn sàng hoặc đã được thu hồi."); }
        }).RequireRateLimiting("knowledge-read").WithTags("Knowledge sources");
        endpoints.MapPost("/api/v1/knowledge/feedback",async (KnowledgeFeedback input,HttpContext http,IAntiforgery csrf,IKnowledgeGateway gateway,CancellationToken ct)=>
        {
            http.Response.Headers.CacheControl="no-store";
            try { await csrf.ValidateRequestAsync(http); await gateway.FeedbackAsync(input,ct); return Results.NoContent(); }
            catch (AntiforgeryValidationException) { return ApiErrors.Create(http,400,"invalid_csrf","Phiên bảo mật không hợp lệ."); }
            catch (KnowledgeException ex) { return ApiErrors.Create(http,ex.Status,ex.Code,ex.Message); }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException) { return ApiErrors.Create(http,503,"feedback_unavailable","Chưa lưu được phản hồi."); }
        }).RequireRateLimiting("knowledge-feedback").WithTags("Knowledge sources");
        return endpoints;
    }
    private static string Actor(HttpContext http) => http.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new InvalidOperationException("Authenticated actor required");
    private static async Task<JsonElement?> Body(HttpContext http,CancellationToken ct)
    {
        if (http.Request.ContentLength>131072) return null;
        using var data=new MemoryStream(); var buffer=new byte[4096];
        while (true) { var n=await http.Request.Body.ReadAsync(buffer,ct); if (n==0) break; if (data.Length+n>131072) return null; data.Write(buffer,0,n); }
        try { using var json=JsonDocument.Parse(data.ToArray()); return json.RootElement.ValueKind==JsonValueKind.Object ? json.RootElement.Clone() : null; }
        catch (JsonException) { return null; }
    }
}
