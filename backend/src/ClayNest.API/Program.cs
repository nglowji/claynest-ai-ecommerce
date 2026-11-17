using ClayNest.API.Configuration;
using ClayNest.API.Endpoints;
using ClayNest.API.Errors;
using ClayNest.API.Middleware;
using ClayNest.Infrastructure;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole(options => options.IncludeScopes = true);
builder.Services.AddOpenApi();
builder.Services.AddInfrastructure(builder.Configuration);
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
app.UseMiddleware<CorrelationMiddleware>();
app.UseExceptionHandler(new ExceptionHandlerOptions { SuppressDiagnosticsCallback = _ => true });
app.UseCors();
app.MapOperationalEndpoints();
if (app.Environment.IsDevelopment()) app.MapOpenApi();
app.Run();

// Public entry point for WebApplicationFactory integration tests.
public partial class Program;
