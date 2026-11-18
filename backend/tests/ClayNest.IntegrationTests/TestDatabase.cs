using Npgsql;

namespace ClayNest.IntegrationTests;

internal static class TestDatabase
{
    public static string Connection(string variable)
    {
        var connection = Environment.GetEnvironmentVariable(variable)
            ?? throw new InvalidOperationException("Integration test connection is missing.");
        EnsureSafe(connection);
        return connection;
    }

    public static void EnsureSafe(string connection)
    {
        var parsed = new NpgsqlConnectionStringBuilder(connection);
        if (parsed.Database != "claynest_test" || parsed.Host != "db-test")
            throw new InvalidOperationException("Integration tests require the isolated db-test/claynest_test database.");
    }
}

public sealed class TestDatabaseSafetyTests
{
    [Theory]
    [InlineData("Host=db;Database=claynest;Username=commerce_app")]
    [InlineData("Host=db-test;Database=claynest;Username=commerce_app")]
    [InlineData("Host=db;Database=claynest_test;Username=commerce_app")]
    public void Rejects_any_connection_outside_test_service(string connection) =>
        Assert.Throws<InvalidOperationException>(() => TestDatabase.EnsureSafe(connection));
}
