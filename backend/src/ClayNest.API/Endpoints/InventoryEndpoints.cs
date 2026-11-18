using System.Security.Claims;
using ClayNest.API.Configuration;
using ClayNest.API.Errors;
using ClayNest.Application.Catalog;
using ClayNest.Application.Identity;
using ClayNest.Application.Inventory;
using ClayNest.Domain.Inventory;
using Microsoft.AspNetCore.Antiforgery;

namespace ClayNest.API.Endpoints;

public static class InventoryEndpoints
{
    public static IEndpointRouteBuilder MapInventoryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/admin/inventory").WithTags("Admin inventory").RequireAuthorization(AdminAuthentication.Policy);
        group.AddEndpointFilter(async (context, next) =>
        {
            var http = context.HttpContext; http.Response.Headers.CacheControl = "no-store";
            try
            {
                if (http.Request.Method != "GET") await http.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(http);
                return await next(context);
            }
            catch (AntiforgeryValidationException) { return ApiErrors.Create(http, 400, "invalid_csrf", "Phiên bảo mật không hợp lệ."); }
            catch (StockRuleException ex) { return ApiErrors.Create(http, 400, "invalid_stock", ex.Message); }
            catch (StockConflictException ex) { return ApiErrors.Create(http, 409, "stock_conflict", ex.Message); }
            catch (KeyNotFoundException) { return ApiErrors.Create(http, 404, "not_found", "Không tìm thấy biến thể sản phẩm."); }
        });
        group.MapGet("/", (string? q, bool? lowOnly, int? page, int? pageSize, IInventoryService service, CancellationToken ct) =>
            service.SearchAsync(new(q, lowOnly ?? false, page ?? 1, pageSize ?? 20), ct)).Produces<PageResult<StockItem>>().ProducesProblem(400);
        group.MapGet("/{variantId:guid}/movements", (Guid variantId, int? page, IInventoryService service, CancellationToken ct) =>
            service.HistoryAsync(variantId, page ?? 1, ct)).Produces<PageResult<MovementDto>>().ProducesProblem(404);
        group.MapPost("/{variantId:guid}/movements", async (Guid variantId, StockChange input, IInventoryService service,
            IAdminAuthenticationService auth, HttpContext http, CancellationToken ct) =>
        {
            var actor = await auth.GetProfileAsync(http.User.FindFirstValue(ClaimTypes.NameIdentifier));
            if (actor is null) return ApiErrors.Create(http, 401, "unauthenticated", "Vui lòng đăng nhập lại.");
            return Results.Ok(await service.ChangeAsync(variantId, input, actor.Id, string.IsNullOrWhiteSpace(actor.DisplayName) ? "Quản trị viên" : actor.DisplayName, ct));
        }).Produces<StockChangeResult>().ProducesProblem(400).ProducesProblem(409);
        return endpoints;
    }
}
