using ClayNest.API.Configuration;
using ClayNest.API.Endpoints;
using ClayNest.API.Errors;
using ClayNest.API.Middleware;
using ClayNest.Infrastructure;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.Options;

var bootstrapAuth = args.Contains("--bootstrap-auth");
var builder = WebApplication.CreateBuilder(args.Where(arg => arg != "--bootstrap-auth").ToArray());
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole(options => options.IncludeScopes = true);
builder.Services.AddOpenApi();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddAdminAuthentication(builder.Configuration, builder.Environment);
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddOptions<ClientOptions>()
    .Bind(builder.Configuration.GetSection(ClientOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(ClientOptions.HasValidOrigins, "CORS origins must be explicit HTTP(S) origins.")
    .ValidateOnStart();
builder.Services.AddCors();
builder.Services.AddOptions<CorsOptions>().Configure<IOptions<ClientOptions>>((options, clients) =>
    options.AddDefaultPolicy(policy => policy.WithOrigins(clients.Value.AllowedOrigins)
        .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        .WithHeaders("Content-Type", "Authorization", "Idempotency-Key", "X-Correlation-ID")
        .WithExposedHeaders("X-Correlation-ID", "X-Request-ID")));

var app = builder.Build();
if (bootstrapAuth)
{
    await using var scope = app.Services.CreateAsyncScope();
    var database = scope.ServiceProvider.GetRequiredService<ClayNest.Infrastructure.Persistence.CommerceDbContext>();
    await Microsoft.EntityFrameworkCore.RelationalDatabaseFacadeExtensions.MigrateAsync(database.Database);
    await scope.ServiceProvider.GetRequiredService<ClayNest.Infrastructure.Identity.AdminProvisioner>().EnsureCreatedAsync(
        builder.Configuration["Bootstrap:Email"] ?? string.Empty,
        builder.Configuration["Bootstrap:Password"] ?? string.Empty,
        builder.Configuration["Bootstrap:DisplayName"] ?? "Quản trị Nàng Gốm");
    return;
}
app.UseMiddleware<CorrelationMiddleware>();
app.UseExceptionHandler(new ExceptionHandlerOptions { SuppressDiagnosticsCallback = _ => true });
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapOperationalEndpoints();
app.MapAuthenticationEndpoints();
if (app.Environment.IsDevelopment()) app.MapOpenApi();
app.Run();

// Public entry point for WebApplicationFactory integration tests.
public partial class Program;
