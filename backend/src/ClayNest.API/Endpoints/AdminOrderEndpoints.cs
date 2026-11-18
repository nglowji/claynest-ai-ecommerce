using System.Security.Claims;
using ClayNest.API.Configuration;
using ClayNest.API.Errors;
using ClayNest.Application.Catalog;
using ClayNest.Application.Identity;
using ClayNest.Application.Orders;
using ClayNest.Domain.Inventory;
using ClayNest.Domain.Orders;
using Microsoft.AspNetCore.Antiforgery;

namespace ClayNest.API.Endpoints;

public static class AdminOrderEndpoints
{
    public static IEndpointRouteBuilder MapAdminOrderEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/admin/orders").WithTags("Admin orders").RequireAuthorization(AdminAuthentication.Policy);
        group.AddEndpointFilter(async (context, next) =>
        {
            var http = context.HttpContext; http.Response.Headers.CacheControl = "no-store";
            http.Response.Headers["Referrer-Policy"] = "no-referrer";
            try
            {
                if (http.Request.Method != "GET") await http.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(http);
                return await next(context);
            }
            catch (AntiforgeryValidationException) { return ApiErrors.Create(http, 400, "invalid_csrf", "Phiên bảo mật không hợp lệ."); }
            catch (OrderRuleException ex) { return ApiErrors.Create(http, 400, "invalid_order", ex.Message); }
            catch (StockRuleException ex) { return ApiErrors.Create(http, 400, "invalid_stock", ex.Message); }
            catch (OrderTransitionException ex) { return ApiErrors.Create(http, 409, "invalid_transition", ex.Message); }
            catch (OrderConflictException ex) { return ApiErrors.Create(http, 409, ex.Code, ex.Message); }
            catch (KeyNotFoundException) { return ApiErrors.Create(http, 404, "not_found", "Không tìm thấy đơn hàng."); }
        });
        group.MapGet("/", (string? q, string? status, DateOnly? from, DateOnly? to, int? page, int? pageSize, IAdminOrderService service, CancellationToken ct) =>
            service.SearchAsync(new(q, status, from, to, page ?? 1, pageSize ?? 20), ct)).Produces<PageResult<AdminOrderRow>>().ProducesProblem(400);
        group.MapGet("/{id:guid}", async (Guid id, IAdminOrderService service, CancellationToken ct) =>
            await service.FindAsync(id, ct) ?? throw new KeyNotFoundException()).Produces<AdminOrderDetail>().ProducesProblem(404);
        group.MapPatch("/{id:guid}/status", async (Guid id, OrderTransition input, IAdminOrderService service, IAdminAuthenticationService auth, HttpContext http, CancellationToken ct) =>
        {
            var actor = await auth.GetProfileAsync(http.User.FindFirstValue(ClaimTypes.NameIdentifier));
            if (actor is null) return ApiErrors.Create(http, 401, "unauthenticated", "Vui lòng đăng nhập lại.");
            return Results.Ok(await service.TransitionAsync(id, input, actor.Id, string.IsNullOrWhiteSpace(actor.DisplayName) ? "Quản trị viên" : actor.DisplayName, ct));
        }).Produces<AdminOrderDetail>().ProducesProblem(400).ProducesProblem(409).ProducesProblem(404);
        return endpoints;
    }
}
