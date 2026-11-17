using System.Reflection;
using ClayNest.Application.Abstractions;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ClayNest.UnitTests;

public sealed class ArchitectureTests
{
    [Theory]
    [InlineData("ClayNest.Domain")]
    [InlineData("ClayNest.Application")]
    public void Inner_layers_have_no_infrastructure_or_http_dependencies(string name)
    {
        var forbidden = new[] { "ClayNest.API", "ClayNest.Infrastructure", "Microsoft.EntityFrameworkCore", "Npgsql", "Microsoft.AspNetCore" };
        var references = Assembly.Load(name).GetReferencedAssemblies().Select(reference => reference.Name ?? string.Empty);
        Assert.DoesNotContain(references, reference => forbidden.Any(reference.StartsWith));
    }

    [Fact]
    public void Infrastructure_does_not_reference_api()
    {
        Assert.DoesNotContain(typeof(CommerceDbContext).Assembly.GetReferencedAssemblies(), reference => reference.Name == "ClayNest.API");
        Assert.True(typeof(IReadinessProbe).IsAssignableFrom(typeof(ClayNest.Infrastructure.Health.PostgresReadinessProbe)));
    }

    [Fact]
    public void Commerce_model_is_scoped_to_its_owned_schema()
    {
        var options = new DbContextOptionsBuilder<CommerceDbContext>()
            .UseNpgsql("Host=localhost;Database=unused;Username=unused").Options;
        using var context = new CommerceDbContext(options);
        Assert.Equal("commerce", context.Model.GetDefaultSchema());
        Assert.All(context.Model.GetEntityTypes(), entity => Assert.Equal("commerce", entity.GetSchema()));
    }
}
