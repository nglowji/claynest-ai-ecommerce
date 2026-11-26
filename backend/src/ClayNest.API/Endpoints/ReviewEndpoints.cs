using System.Security.Claims;
using ClayNest.API.Errors;
using ClayNest.Application.Reviews;
using ClayNest.Domain.Reviews;
using Microsoft.AspNetCore.Antiforgery;
namespace ClayNest.API.Endpoints;
public static class ReviewEndpoints
{
    private static Guid Customer(HttpContext http) => Guid.Parse(http.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public static IEndpointRouteBuilder MapReviewEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/products/{productId:guid}/reviews").WithTags("Product reviews");
        group.AddEndpointFilter(async (context, next) => {
            var http = context.HttpContext;
            http.Response.Headers.CacheControl = "no-store";
            try {
                if (http.Request.Method != "GET") await http.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(http);
                return await next(context);
            }
            catch (AntiforgeryValidationException) { return ApiErrors.Create(http, 400, "invalid_csrf", "Phiên bảo mật không hợp lệ."); }
            catch (ReviewRuleException ex) { return ApiErrors.Create(http, 400, "invalid_review", ex.Message); }
            catch (KeyNotFoundException) { return ApiErrors.Create(http, 404, "product_not_found", "Không tìm thấy sản phẩm."); }
            catch (UnauthorizedAccessException) { return ApiErrors.Create(http, 403, "purchase_required", "Bạn cần có đơn hàng đã hoàn tất chứa sản phẩm này để đánh giá."); }
        });
        group.MapGet("/", (Guid productId, int? page, int? rating, IProductReviews service, CancellationToken ct) => service.ListAsync(productId, page ?? 1, rating, ct)).RequireRateLimiting("reviews-read");
        group.MapGet("/mine", (Guid productId, HttpContext http, IProductReviews service, CancellationToken ct) => service.MineAsync(productId, Customer(http), ct)).RequireAuthorization().RequireRateLimiting("reviews-read");
        group.MapPut("/mine", (Guid productId, ReviewInput input, HttpContext http, IProductReviews service, CancellationToken ct) => service.SaveAsync(productId, Customer(http), input, ct)).RequireAuthorization().RequireRateLimiting("reviews-write");
        return endpoints;
    }
}
