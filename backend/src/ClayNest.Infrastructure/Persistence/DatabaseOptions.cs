using System.ComponentModel.DataAnnotations;

namespace ClayNest.Infrastructure.Persistence;

public sealed class DatabaseOptions
{
    public const string SectionName = "ConnectionStrings";

    [Required]
    public string Commerce { get; init; } = string.Empty;
}
