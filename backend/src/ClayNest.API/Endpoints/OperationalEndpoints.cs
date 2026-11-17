using ClayNest.Application.Abstractions;
using Microsoft.AspNetCore.Http.HttpResults;

namespace ClayNest.API.Endpoints;

public static class OperationalEndpoints
{
    public static IEndpointRouteBuilder MapOperationalEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/health", () => TypedResults.Ok(new HealthResponse("ok")))
            .WithName("Liveness").WithTags("Operations");
        endpoints.MapGet("/ready", async Task<Results<Ok<HealthResponse>, JsonHttpResult<HealthResponse>>>
            (IReadinessProbe probe, CancellationToken cancellationToken) =>
                await probe.IsReadyAsync(cancellationToken)
                    ? TypedResults.Ok(new HealthResponse("ready"))
                    : TypedResults.Json(new HealthResponse("unavailable"), statusCode: StatusCodes.Status503ServiceUnavailable))
            .WithName("Readiness").WithTags("Operations");
        return endpoints;
    }

    public sealed record HealthResponse(string Status);
}
