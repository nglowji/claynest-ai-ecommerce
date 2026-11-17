using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using ClayNest.API.Configuration;
using ClayNest.Application.Identity;
using Microsoft.AspNetCore.Antiforgery;

namespace ClayNest.API.Endpoints;

public static class AuthenticationEndpoints
{
    public static IEndpointRouteBuilder MapAuthenticationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/auth").WithTags("Authentication")
            .AddEndpointFilter(async (context, next) =>
            {
                context.HttpContext.Response.Headers.CacheControl = "no-cache, no-store";
                return await next(context);
            });
        group.MapGet("/csrf", (HttpContext context, IAntiforgery csrf) =>
            TypedResults.Ok(new { requestToken = csrf.GetAndStoreTokens(context).RequestToken }));
        group.MapPost("/login", LoginAsync).RequireRateLimiting("admin-login");
        group.MapGet("/me", async (HttpContext context, IAdminAuthenticationService auth) =>
        {
            var profile = await auth.GetProfileAsync(context.User.FindFirstValue(ClaimTypes.NameIdentifier));
            return profile is null ? Results.Unauthorized() : Results.Ok(profile);
        }).RequireAuthorization();
        group.MapPost("/logout", async (HttpContext context, IAntiforgery csrf, IAdminAuthenticationService auth) =>
        {
            if (!await ValidCsrfAsync(context, csrf)) return CsrfFailure();
            await auth.LogoutAsync(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            return Results.NoContent();
        }).RequireAuthorization();
        group.MapPost("/register", async (RegisterRequest request, HttpContext context, IAntiforgery csrf, IAdminAuthenticationService auth) =>
        {
            if (!await ValidCsrfAsync(context, csrf)) return CsrfFailure();
            var errors = new List<ValidationResult>();
            if (!Validator.TryValidateObject(request, new ValidationContext(request), errors, true)
                || string.IsNullOrWhiteSpace(request.DisplayName))
                return Results.BadRequest(new { code = "invalid_registration" });
            var result = await auth.RegisterAsync(new RegisterCommand(request.DisplayName, request.Email, request.Password));
            return result.Succeeded ? Results.StatusCode(201)
                : Results.BadRequest(new { code = "registration_failed" });
        }).RequireRateLimiting("admin-login");
        endpoints.MapGet("/api/v1/admin/session", async (HttpContext context, IAdminAuthenticationService auth) =>
            Results.Ok(await auth.GetProfileAsync(context.User.FindFirstValue(ClaimTypes.NameIdentifier))))
            .RequireAuthorization(AdminAuthentication.Policy);
        return endpoints;
    }

    private static async Task<IResult> LoginAsync(LoginRequest request, HttpContext context, IAntiforgery csrf, IAdminAuthenticationService auth)
    {
        if (!await ValidCsrfAsync(context, csrf)) return CsrfFailure();
        var errors = new List<ValidationResult>();
        if (!Validator.TryValidateObject(request, new ValidationContext(request), errors, validateAllProperties: true))
            return Results.ValidationProblem(errors.GroupBy(error => error.MemberNames.FirstOrDefault() ?? "request")
                .ToDictionary(group => group.Key, group => group.Select(error => error.ErrorMessage ?? "Invalid input").ToArray()));
        var profile = await auth.LoginAsync(new AdminLoginCommand(request.Email, request.Password, request.RememberMe));
        return profile is null
            ? Results.Json(new { code = "invalid_credentials", detail = "Email hoặc mật khẩu không đúng, hoặc tài khoản tạm thời không thể đăng nhập." }, statusCode: 401)
            : Results.Ok(profile);
    }

    private static async Task<bool> ValidCsrfAsync(HttpContext context, IAntiforgery csrf)
    {
        try { await csrf.ValidateRequestAsync(context); return true; }
        catch (AntiforgeryValidationException) { return false; }
    }

    private static IResult CsrfFailure() => Results.Json(new { code = "invalid_csrf", detail = "Phiên bảo mật không hợp lệ. Vui lòng thử lại." }, statusCode: 400);

    public sealed record RegisterRequest(
        [property: Required, MaxLength(100)] string DisplayName,
        [property: Required, EmailAddress, MaxLength(254)] string Email,
        [property: Required, MinLength(12), MaxLength(256)] string Password);

    public sealed record LoginRequest(
        [property: Required, EmailAddress, MaxLength(254)] string Email,
        [property: Required, MaxLength(256)] string Password,
        bool RememberMe = false);
}
