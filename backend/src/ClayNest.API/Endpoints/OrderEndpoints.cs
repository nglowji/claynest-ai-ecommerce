using System.Security.Claims;
using ClayNest.API.Errors;
using ClayNest.Application.Orders;
using ClayNest.Domain.Orders;
using Microsoft.AspNetCore.Antiforgery;

namespace ClayNest.API.Endpoints;

public static class OrderEndpoints
{
    private static Guid? Customer(HttpContext http) => Guid.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    public static IEndpointRouteBuilder MapOrderEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1").WithTags("Checkout and orders");
        group.AddEndpointFilter(async (context, next) =>
        {
            var http = context.HttpContext;
            http.Response.Headers.CacheControl = "no-store";
            http.Response.Headers["Referrer-Policy"] = "no-referrer";
            http.Response.Headers["X-Robots-Tag"] = "noindex, noarchive";
            try
            {
                if (http.Request.Method != "GET") await http.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(http);
                return await next(context);
            }
            catch (AntiforgeryValidationException) { return ApiErrors.Create(http, 400, "invalid_csrf", "Phiên bảo mật không hợp lệ. Vui lòng thử lại."); }
            catch (OrderRuleException ex) { return ApiErrors.Create(http, 400, "invalid_order", ex.Message); }
            catch (CheckoutConflictException ex) { return ApiErrors.Create(http, 409, ex.Code, ex.Message); }
        });
        group.MapPost("/cart/quote", (QuoteRequest request, IOrderService orders, CancellationToken ct) => orders.QuoteAsync(request, ct))
            .RequireRateLimiting("cart-quote").Produces<CartQuote>().ProducesProblem(400).ProducesProblem(429);
        group.MapPost("/orders", async (CheckoutRequest request, HttpContext http, IOrderService orders, CancellationToken ct) =>
        {
            if (!Guid.TryParse(http.Request.Headers["Idempotency-Key"], out var key) || key == Guid.Empty)
                return ApiErrors.Create(http, 400, "invalid_idempotency_key", "Cần mã yêu cầu đặt hàng hợp lệ.");
            return Results.Json(await orders.PlaceAsync(key, request, Customer(http), ct), statusCode: 201);
        }).RequireRateLimiting("checkout").Produces<OrderReceipt>(201).ProducesProblem(400).ProducesProblem(409).ProducesProblem(429);
        group.MapGet("/orders/{reference}/status", async (string reference, HttpContext http, IOrderService orders, CancellationToken ct) =>
            await orders.StatusAsync(reference, http.Request.Headers["X-Order-Token"], Customer(http), ct) is { } status
                ? Results.Ok(status) : ApiErrors.Create(http, 404, "order_not_found", "Không tìm thấy đơn hoặc mã truy cập không hợp lệ."))
            .RequireRateLimiting("order-lookup").Produces<OrderStatusDto>().ProducesProblem(404).ProducesProblem(429);
        group.MapPost("/orders/{reference}/revoke-access", async (string reference, HttpContext http, IOrderService orders, CancellationToken ct) =>
            await orders.RevokeAccessAsync(reference, http.Request.Headers["X-Order-Token"], Customer(http), ct)
                ? Results.NoContent() : ApiErrors.Create(http, 404, "order_not_found", "Không tìm thấy đơn hoặc mã truy cập không hợp lệ."))
            .RequireRateLimiting("order-lookup").Produces(204).ProducesProblem(400).ProducesProblem(404);
        return endpoints;
    }
}
