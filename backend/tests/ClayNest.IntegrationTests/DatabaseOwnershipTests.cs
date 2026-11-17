using ClayNest.Infrastructure.Health;
using Npgsql;

namespace ClayNest.IntegrationTests;

public sealed class DatabaseOwnershipTests
{
    // Explicit opt-in: API tests run without a DB; Compose test profile runs these against PostgreSQL.
    [DatabaseFact]
    public async Task Commerce_and_ai_roles_are_isolated_and_not_superusers()
    {
        await using var commerce = NpgsqlDataSource.Create(Environment.GetEnvironmentVariable("TEST_COMMERCE_CONNECTION")!);
        await using var ai = NpgsqlDataSource.Create(Environment.GetEnvironmentVariable("TEST_AI_CONNECTION")!);
        Assert.True(await new PostgresReadinessProbe(commerce).IsReadyAsync(CancellationToken.None));
        foreach (var (source, own, other) in new[] { (commerce, "commerce", "ai"), (ai, "ai", "commerce") })
        {
            await using var check = source.CreateCommand("SELECT has_schema_privilege(current_user, @own, 'CREATE'), has_schema_privilege(current_user, @other, 'USAGE'), (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)");
            check.Parameters.AddWithValue("own", own);
            check.Parameters.AddWithValue("other", other);
            await using var reader = await check.ExecuteReaderAsync();
            Assert.True(await reader.ReadAsync());
            Assert.True(reader.GetBoolean(0));
            Assert.False(reader.GetBoolean(1));
            Assert.False(reader.GetBoolean(2));
        }
    }

    [DatabaseFact]
    public async Task Ai_role_cannot_create_commerce_table()
    {
        await using var ai = NpgsqlDataSource.Create(Environment.GetEnvironmentVariable("TEST_AI_CONNECTION")!);
        await using var command = ai.CreateCommand("CREATE TABLE commerce.__forbidden_probe (id integer)");
        var failure = await Assert.ThrowsAsync<PostgresException>(() => command.ExecuteNonQueryAsync());
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, failure.SqlState);
    }

    [DatabaseFact]
    public async Task Commerce_role_cannot_create_ai_table()
    {
        await using var commerce = NpgsqlDataSource.Create(Environment.GetEnvironmentVariable("TEST_COMMERCE_CONNECTION")!);
        await using var command = commerce.CreateCommand("CREATE TABLE ai.__forbidden_probe (id integer)");
        var failure = await Assert.ThrowsAsync<PostgresException>(() => command.ExecuteNonQueryAsync());
        Assert.Equal(PostgresErrorCodes.InsufficientPrivilege, failure.SqlState);
    }
}

internal sealed class DatabaseFactAttribute : FactAttribute
{
    public DatabaseFactAttribute()
    {
        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("TEST_COMMERCE_CONNECTION"))
            || string.IsNullOrEmpty(Environment.GetEnvironmentVariable("TEST_AI_CONNECTION")))
            Skip = "Set TEST_COMMERCE_CONNECTION and TEST_AI_CONNECTION, or use the Compose test profile.";
    }
}
