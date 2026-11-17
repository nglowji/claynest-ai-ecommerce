using ClayNest.Application.Abstractions;
using Npgsql;

namespace ClayNest.Infrastructure.Health;

public sealed class PostgresReadinessProbe(NpgsqlDataSource dataSource) : IReadinessProbe
{
    public async Task<bool> IsReadyAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var command = dataSource.CreateCommand("SELECT 1");
            return await command.ExecuteScalarAsync(cancellationToken) is 1;
        }
        catch (NpgsqlException)
        {
            return false;
        }
        catch (TimeoutException)
        {
            return false;
        }
    }
}
