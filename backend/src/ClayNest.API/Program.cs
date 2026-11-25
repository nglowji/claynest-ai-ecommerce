using ClayNest.API.Configuration;
using ClayNest.API.Endpoints;
using ClayNest.API.Errors;
using ClayNest.API.Middleware;
using ClayNest.Infrastructure;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.Options;

var seedActivity = args.Contains("--seed-development-activity");
var seedReportDemo = args.Contains("--seed-report-demo");
var removeSourceImages = args.Contains("--remove-source-images");
var refreshCatalog = args.Contains("--refresh-catalog");
var seedCatalog = args.Contains("--seed-catalog");
var bootstrapAuth = args.Contains("--bootstrap-auth");
var builder = WebApplication.CreateBuilder(args.Where(arg => arg != "--seed-development-activity" && arg != "--seed-report-demo" && arg != "--bootstrap-auth" && arg != "--seed-catalog" && arg != "--refresh-catalog" && arg != "--remove-source-images").ToArray());
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole(options => options.IncludeScopes = true);
builder.Services.AddOpenApi();
builder.Services.AddSingleton<ChatCapacity>();
builder.Services.AddSingleton<AdminAiCapacity>();
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
        .WithHeaders("Content-Type", "Authorization", "Idempotency-Key", "X-Correlation-ID", "X-CSRF-TOKEN", "X-Order-Token")
        .WithExposedHeaders("X-Correlation-ID", "X-Request-ID")));

var app = builder.Build();
if (seedActivity || bootstrapAuth || seedCatalog || refreshCatalog || removeSourceImages || seedReportDemo)
{
    if (seedActivity && !app.Environment.IsDevelopment()) throw new InvalidOperationException("Development activity is disabled outside Development.");
    await using var scope = app.Services.CreateAsyncScope();
    var database = scope.ServiceProvider.GetRequiredService<ClayNest.Infrastructure.Persistence.CommerceDbContext>();
    await Microsoft.EntityFrameworkCore.RelationalDatabaseFacadeExtensions.MigrateAsync(database.Database);
    if (bootstrapAuth) await scope.ServiceProvider.GetRequiredService<ClayNest.Infrastructure.Identity.AdminProvisioner>().EnsureCreatedAsync(
        builder.Configuration["Bootstrap:Email"] ?? string.Empty,
        builder.Configuration["Bootstrap:Password"] ?? string.Empty,
        builder.Configuration["Bootstrap:DisplayName"] ?? "Quản trị Nàng Gốm");
    if (seedCatalog) await scope.ServiceProvider.GetRequiredService<ClayNest.Application.Catalog.ICatalogService>().SeedAsync(CancellationToken.None);
    if (refreshCatalog) await scope.ServiceProvider.GetRequiredService<ClayNest.Application.Catalog.ICatalogService>().RefreshContentAsync(CancellationToken.None);
    if (removeSourceImages) await scope.ServiceProvider.GetRequiredService<ClayNest.Application.Catalog.ICatalogService>().RemoveSourceImagesAsync(CancellationToken.None);
    if (seedActivity) await scope.ServiceProvider.GetRequiredService<ClayNest.Infrastructure.Development.DevelopmentActivitySeeder>().SeedAsync(CancellationToken.None);
    if (seedReportDemo) await scope.ServiceProvider.GetRequiredService<ClayNest.Infrastructure.Reports.ReportDemoSeeder>().SeedAsync(CancellationToken.None);
    return;
}
app.UseMiddleware<CorrelationMiddleware>();
app.UseExceptionHandler(new ExceptionHandlerOptions { SuppressDiagnosticsCallback = _ => true });
app.UseStatusCodePages(async status =>
{
    var code = status.HttpContext.Response.StatusCode;
    await ApiErrors.WriteAsync(status.HttpContext, code, code switch
    {
        400 => "invalid_input", 401 => "unauthenticated", 403 => "forbidden",
        404 => "not_found", 405 => "method_not_allowed", _ => "request_failed"
    }, "Yêu cầu không thể thực hiện. Vui lòng kiểm tra và thử lại.");
});
var imageRoot = ClayNest.Infrastructure.Catalog.LocalCatalogImageStorage.Root(builder.Configuration);
Directory.CreateDirectory(imageRoot);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(imageRoot), RequestPath = "/media/catalog",
    OnPrepareResponse = context => context.Context.Response.Headers["X-Content-Type-Options"] = "nosniff"
});
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapOperationalEndpoints();
app.MapAuthenticationEndpoints();
app.MapCatalogEndpoints();
app.MapInventoryEndpoints();
app.MapOrderEndpoints();
app.MapAdminOrderEndpoints();
app.MapChatEndpoints();
app.MapAdminAiEndpoints();
app.MapKnowledgeEndpoints();
app.MapReportEndpoints();
if (app.Environment.IsDevelopment()) app.MapOpenApi();
app.Run();

// Public entry point for WebApplicationFactory integration tests.
public partial class Program;
