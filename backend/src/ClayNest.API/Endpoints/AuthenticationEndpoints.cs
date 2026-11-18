using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using ClayNest.API.Configuration;
using ClayNest.API.Errors;
using ClayNest.Application.Identity;
using Microsoft.AspNetCore.Antiforgery;

namespace ClayNest.API.Endpoints;

public static class AuthenticationEndpoints
{
    public static IEndpointRouteBuilder MapAuthenticationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/auth").WithTags("Authentication")
            .WithDescription("Same-origin Identity cookie authentication. Mutations require X-CSRF-TOKEN from /api/v1/auth/csrf. Public registration never grants Admin.")
            .AddEndpointFilter(async (context, next) =>
            {
                context.HttpContext.Response.Headers.CacheControl = "no-cache, no-store";
                context.HttpContext.Response.Headers.Pragma = "no-cache";
                return await next(context);
            });
        group.MapGet("/csrf", (HttpContext context, IAntiforgery csrf) =>
            TypedResults.Ok(new CsrfResponse(csrf.GetAndStoreTokens(context).RequestToken!)))
            .WithName("GetCsrfToken").Produces<CsrfResponse>();
        group.MapPost("/login", LoginAsync).RequireRateLimiting("admin-login")
            .WithName("Login").Produces<AdminProfile>().ProducesProblem(400).ProducesProblem(401).ProducesProblem(429);
        group.MapGet("/me", async (HttpContext context, IAdminAuthenticationService auth) =>
        {
            var profile = await auth.GetProfileAsync(context.User.FindFirstValue(ClaimTypes.NameIdentifier));
            return profile is null ? ApiErrors.Create(context, 401, "unauthenticated", "Vui lòng đăng nhập lại.") : Results.Ok(profile);
        }).RequireAuthorization().WithName("GetCurrentUser").Produces<AdminProfile>().ProducesProblem(401);
        group.MapPost("/logout", async (HttpContext context, IAntiforgery csrf, IAdminAuthenticationService auth) =>
        {
            if (!await ValidCsrfAsync(context, csrf)) return CsrfFailure(context);
            await auth.LogoutAsync(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            return Results.NoContent();
        }).RequireAuthorization().WithName("Logout").Produces(204).ProducesProblem(400).ProducesProblem(401);
        group.MapPost("/register", async (RegisterRequest request, HttpContext context, IAntiforgery csrf, IAdminAuthenticationService auth) =>
        {
            if (!await ValidCsrfAsync(context, csrf)) return CsrfFailure(context);
            var errors = new List<ValidationResult>();
            if (!Validator.TryValidateObject(request, new ValidationContext(request), errors, true)
                || string.IsNullOrWhiteSpace(request.DisplayName))
                return ApiErrors.Create(context, 400, "invalid_registration", "Thông tin đăng ký chưa hợp lệ.");
            var result = await auth.RegisterAsync(new RegisterCommand(request.DisplayName, request.Email, request.Password));
            return result.Succeeded ? Results.StatusCode(201)
                : ApiErrors.Create(context, 400, "registration_failed", "Không thể tạo tài khoản với thông tin này.");
        }).RequireRateLimiting("admin-login").WithName("Register").Produces(201).ProducesProblem(400).ProducesProblem(429);
        endpoints.MapGet("/api/v1/admin/session", async (HttpContext context, IAdminAuthenticationService auth) =>
        {
            context.Response.Headers.CacheControl = "no-cache, no-store";
            return Results.Ok(await auth.GetProfileAsync(context.User.FindFirstValue(ClaimTypes.NameIdentifier)));
        }).RequireAuthorization(AdminAuthentication.Policy).WithName("GetAdminSession")
            .Produces<AdminProfile>().ProducesProblem(401).ProducesProblem(403);
        return endpoints;
    }

    private static async Task<IResult> LoginAsync(LoginRequest request, HttpContext context, IAntiforgery csrf, IAdminAuthenticationService auth)
    {
        if (!await ValidCsrfAsync(context, csrf)) return CsrfFailure(context);
        var errors = new List<ValidationResult>();
        if (!Validator.TryValidateObject(request, new ValidationContext(request), errors, validateAllProperties: true))
            return ApiErrors.Create(context, 400, "invalid_input", "Thông tin đăng nhập chưa hợp lệ.", errors.GroupBy(error => error.MemberNames.FirstOrDefault() ?? "request")
                .ToDictionary(group => group.Key, group => group.Select(error => error.ErrorMessage ?? "Invalid input").ToArray()));
        var profile = await auth.LoginAsync(new AdminLoginCommand(request.Email, request.Password, request.RememberMe));
        return profile is null
            ? ApiErrors.Create(context, 401, "invalid_credentials", "Email hoặc mật khẩu không đúng, hoặc tài khoản tạm thời không thể đăng nhập.")
            : Results.Ok(profile);
    }

    private static async Task<bool> ValidCsrfAsync(HttpContext context, IAntiforgery csrf)
    {
        try { await csrf.ValidateRequestAsync(context); return true; }
        catch (AntiforgeryValidationException) { return false; }
    }

    private static IResult CsrfFailure(HttpContext context) => ApiErrors.Create(context, 400, "invalid_csrf", "Phiên bảo mật không hợp lệ. Vui lòng thử lại.");

    public sealed record CsrfResponse(string RequestToken);

    public sealed record RegisterRequest(
        [property: Required, MaxLength(100)] string DisplayName,
        [property: Required, EmailAddress, MaxLength(254)] string Email,
        [property: Required, MinLength(12), MaxLength(256)] string Password);

    public sealed record LoginRequest(
        [property: Required, EmailAddress, MaxLength(254)] string Email,
        [property: Required, MaxLength(256)] string Password,
        bool RememberMe = false);
}
