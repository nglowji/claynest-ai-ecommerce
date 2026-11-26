using System.Security.Claims;
using ClayNest.API.Errors;
using ClayNest.Application.Orders;
using ClayNest.Domain.Orders;
namespace ClayNest.API.Endpoints;
public static class CustomerOrderEndpoints
{
    public static IEndpointRouteBuilder MapCustomerOrderEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/account/orders", async (string? q, string? status, int? page, HttpContext http, ICustomerOrders service, CancellationToken ct) => {
            http.Response.Headers.CacheControl = "no-store";
            http.Response.Headers["X-Robots-Tag"] = "noindex, noarchive";
            var id = Guid.Parse(http.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            try {return Results.Ok(await service.SearchAsync(id, q, status, page ?? 1, ct));}
            catch (OrderRuleException ex) {return ApiErrors.Create(http, 400, "invalid_purchase_query", ex.Message);}
        }).RequireAuthorization().RequireRateLimiting("order-lookup").WithTags("Customer orders");
        return endpoints;
    }
}
