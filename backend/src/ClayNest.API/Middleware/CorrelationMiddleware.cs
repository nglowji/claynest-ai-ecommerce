using System.Diagnostics;

namespace ClayNest.API.Middleware;

public sealed partial class CorrelationMiddleware(RequestDelegate next, ILogger<CorrelationMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = Guid.TryParse(context.Request.Headers["X-Correlation-ID"], out var supplied)
            ? supplied.ToString("N") : Guid.NewGuid().ToString("N");
        context.TraceIdentifier = correlationId;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers["X-Correlation-ID"] = correlationId;
            context.Response.Headers["X-Request-ID"] = correlationId;
            return Task.CompletedTask;
        });
        var started = Stopwatch.GetTimestamp();
        using var scope = logger.BeginScope(new Dictionary<string, object> { ["CorrelationId"] = correlationId });
        try
        {
            await next(context);
        }
        finally
        {
            // Deliberately exclude query strings, headers, request bodies and exception messages.
            RequestCompleted(logger, context.Request.Method, context.Request.Path,
                context.Response.StatusCode, Stopwatch.GetElapsedTime(started).TotalMilliseconds);
        }
    }

    [LoggerMessage(Level = LogLevel.Information,
        Message = "HTTP {Method} {Path} completed {StatusCode} in {ElapsedMs} ms")]
    private static partial void RequestCompleted(ILogger logger, string method, string path, int statusCode, double elapsedMs);
}
