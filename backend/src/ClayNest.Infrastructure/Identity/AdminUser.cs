using Microsoft.AspNetCore.Identity;

namespace ClayNest.Infrastructure.Identity;

public sealed class AdminUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = string.Empty;
}
