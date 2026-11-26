using System.Threading.RateLimiting;
using ClayNest.API.Errors;
using ClayNest.Domain.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;

namespace ClayNest.API.Configuration;

public static class AdminAuthentication
{
    public const string Policy = "AdminOnly";

    public static IServiceCollection AddAdminAuthentication(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        services.AddDataProtection().SetApplicationName("ClayNest.Commerce")
            .PersistKeysToFileSystem(new DirectoryInfo(configuration["DataProtection:KeysPath"]
                ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NangGom", "Keys")));
        services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
        services.ConfigureApplicationCookie(options =>
            {
                options.Cookie.Name = "nang_gom.admin";
                options.Cookie.Path = "/api";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Strict;
                options.Cookie.SecurePolicy = environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.SlidingExpiration = true;
                options.Events.OnValidatePrincipal = SecurityStampValidator.ValidatePrincipalAsync;
                options.Events.OnRedirectToLogin = context => ApiErrors.WriteAsync(context.HttpContext, 401, "unauthenticated", "Vui lòng đăng nhập lại.");
                options.Events.OnRedirectToAccessDenied = context => ApiErrors.WriteAsync(context.HttpContext, 403, "forbidden", "Bạn không có quyền truy cập.");
            });
        services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.Zero);
        services.AddAuthorizationBuilder().AddPolicy(Policy, policy => policy.RequireAuthenticatedUser().RequireRole(CommerceRoles.Admin));
        services.AddAntiforgery(options =>
        {
            options.HeaderName = "X-CSRF-TOKEN";
            options.Cookie.Name = "nang_gom.csrf";
            options.Cookie.Path = "/api";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.SecurePolicy = environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        });
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, _) =>
            {
                context.HttpContext.Response.Headers.RetryAfter = "60";
                await ApiErrors.WriteAsync(context.HttpContext, 429, "rate_limited", "Vui lòng chờ một phút rồi thử lại.");
            };
            foreach (var (name, limit) in new[] { ("reviews-read", 120), ("reviews-write", 10), ("admin-assistant", 8), ("reports", 30), ("knowledge-admin", 30), ("knowledge-read", 120), ("knowledge-feedback", 20), ("public-chat", 8), ("cart-quote", 120), ("checkout", 20), ("order-lookup", 60) })
                options.AddPolicy(name, context => RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
                    { PermitLimit = limit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
            options.AddPolicy("admin-login", context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
                { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
        });
        return services;
    }
}
