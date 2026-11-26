using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using ClayNest.API.Errors;
using ClayNest.Application.Identity;
using Microsoft.AspNetCore.Antiforgery;
namespace ClayNest.API.Endpoints;

public static class AccountEndpoints
{
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/auth").WithTags("Account security").RequireRateLimiting("account-write");
        group.AddEndpointFilter(async (context, next) => {
            var http = context.HttpContext;
            http.Response.Headers.CacheControl = "no-store"; http.Response.Headers["Referrer-Policy"] = "no-referrer";
            try { await http.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(http); }
            catch (AntiforgeryValidationException) { return ApiErrors.Create(http, 400, "invalid_csrf", "Phiên bảo mật không hợp lệ. Vui lòng tải lại trang."); }
            foreach (var input in context.Arguments.OfType<IAccountInput>()) {
                if (!Validator.TryValidateObject(input, new ValidationContext(input), new List<ValidationResult>(), true))
                    return ApiErrors.Create(http, 400, "invalid_account_input", "Thông tin chưa hợp lệ. Mật khẩu mới cần ít nhất 12 ký tự.");
            }
            return await next(context);
        });
        group.MapPut("/profile", async (ProfileInput input, HttpContext http, IAccountService service, IAdminAuthenticationService auth) => {
            var id = http.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return await service.UpdateProfileAsync(id, input.DisplayName)
                ? Results.Ok(await auth.GetProfileAsync(id)) : Invalid(http, "Chưa cập nhật được hồ sơ. Tên cần từ 2–100 ký tự.");
        }).RequireAuthorization().Produces<AdminProfile>().ProducesProblem(400).ProducesProblem(401);
        group.MapPost("/change-password", async (PasswordInput input, HttpContext http, IAccountService service) =>
            await service.ChangePasswordAsync(http.User.FindFirstValue(ClaimTypes.NameIdentifier)!, input.CurrentPassword, input.NewPassword)
                ? Results.NoContent() : Invalid(http, "Mật khẩu hiện tại chưa đúng hoặc mật khẩu mới chưa đạt yêu cầu."))
            .RequireAuthorization().Produces(204).ProducesProblem(400).ProducesProblem(401);
        group.MapPost("/forgot-password", async (EmailInput input, IAccountService service) => {
            await service.RequestResetAsync(input.Email); return Results.Accepted(value: new { message = "Nếu email thuộc một tài khoản, hướng dẫn khôi phục sẽ được gửi. Vui lòng kiểm tra hộp thư." });
        }).RequireRateLimiting("account-mail").Produces(202);
        group.MapPost("/request-verification", async (EmailInput input, IAccountService service) => {
            await service.RequestVerificationAsync(input.Email); return Results.Accepted(value: new { message = "Nếu tài khoản cần xác minh, hướng dẫn sẽ được gửi đến email đăng ký." });
        }).RequireRateLimiting("account-mail").Produces(202);
        group.MapPost("/reset-password", async (ResetInput input, HttpContext http, IAccountService service) =>
            await service.ResetAsync(input.UserId, input.Token, input.NewPassword) ? Results.NoContent()
                : Invalid(http, "Liên kết không hợp lệ, đã dùng hoặc hết hạn; hoặc mật khẩu mới chưa đạt yêu cầu."))
            .Produces(204).ProducesProblem(400);
        group.MapPost("/confirm-email", async (ConfirmInput input, HttpContext http, IAccountService service) =>
            await service.ConfirmEmailAsync(input.UserId, input.Token) ? Results.NoContent()
                : Invalid(http, "Liên kết xác minh không hợp lệ hoặc hết hạn."))
            .Produces(204).ProducesProblem(400);
        return endpoints;
    }
    private static IResult Invalid(HttpContext http, string message) => ApiErrors.Create(http, 400, "account_update_failed", message);
    public interface IAccountInput;
    public sealed record ProfileInput([property: Required, MinLength(2), MaxLength(100)] string DisplayName) : IAccountInput;
    public sealed record PasswordInput([property: Required, MaxLength(256)] string CurrentPassword,
        [property: Required, MinLength(12), MaxLength(256)] string NewPassword) : IAccountInput;
    public sealed record EmailInput([property: Required, EmailAddress, MaxLength(254)] string Email) : IAccountInput;
    public sealed record ConfirmInput([property: Required, MaxLength(36)] string UserId,
        [property: Required, MaxLength(4096)] string Token) : IAccountInput;
    public sealed record ResetInput([property: Required, MaxLength(36)] string UserId,
        [property: Required, MaxLength(4096)] string Token,
        [property: Required, MinLength(12), MaxLength(256)] string NewPassword) : IAccountInput;
}
