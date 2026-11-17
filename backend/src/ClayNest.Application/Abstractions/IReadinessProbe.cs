namespace ClayNest.Application.Abstractions;

/// <summary>Commerce dependency readiness; AI availability is deliberately excluded.</summary>
public interface IReadinessProbe
{
    Task<bool> IsReadyAsync(CancellationToken cancellationToken);
}
