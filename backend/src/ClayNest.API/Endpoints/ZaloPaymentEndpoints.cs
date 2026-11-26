using System.Security.Claims;
using ClayNest.API.Errors;
using ClayNest.Application.Payments;
using ClayNest.Domain.Orders;
using ClayNest.Infrastructure.Payments;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.Extensions.Options;
namespace ClayNest.API.Endpoints;
public static class ZaloPaymentEndpoints
{
    private static Guid? Customer(HttpContext http) => Guid.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    public static IEndpointRouteBuilder MapZaloPaymentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/payments/methods", (IOptions<ZaloOptions> config, HttpContext http) => {
            http.Response.Headers.CacheControl = "no-store"; return Results.Ok(new {zaloPayEnabled = config.Value.Enabled, sandbox = true});
        });
        var group = endpoints.MapGroup("/api/v1/orders/{reference}/zalopay").WithTags("ZaloPay payment").RequireRateLimiting("payments");
        group.AddEndpointFilter(async (context, next) => {
            var http = context.HttpContext; http.Response.Headers.CacheControl = "no-store"; http.Response.Headers["Referrer-Policy"] = "no-referrer";
            try {
                if (http.Request.Method != "GET") await http.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(http);
                return await next(context);
            } catch (AntiforgeryValidationException) {return ApiErrors.Create(http, 400, "invalid_csrf", "Phiên bảo mật không hợp lệ.");}
            catch (KeyNotFoundException) {return ApiErrors.Create(http, 404, "payment_not_found", "Không tìm thấy giao dịch hoặc quyền truy cập không hợp lệ.");}
            catch (OrderRuleException ex) {return ApiErrors.Create(http, 400, "invalid_payment", ex.Message);}
            catch (PaymentGatewayException ex) {return ApiErrors.Create(http, 503, "payment_unavailable", ex.Message);}
        });
        group.MapPost("/", (string reference, HttpContext http, IZaloPayments payments, CancellationToken ct) => payments.CreateAsync(reference, http.Request.Headers["X-Order-Token"], Customer(http), ct));
        group.MapGet("/", (string reference, HttpContext http, IZaloPayments payments, CancellationToken ct) => payments.CheckAsync(reference, http.Request.Headers["X-Order-Token"], Customer(http), ct));
        endpoints.MapPost("/api/v1/payments/zalopay/callback", async (ZaloCallback callback, IZaloPayments payments, CancellationToken ct) =>
            await payments.CallbackAsync(callback, ct) ? Results.Ok(new {return_code = 1, return_message = "Success"}) : Results.Ok(new {return_code = 2, return_message = "Invalid"}))
            .RequireRateLimiting("payment-callback").WithTags("ZaloPay callback");
        return endpoints;
    }
}
