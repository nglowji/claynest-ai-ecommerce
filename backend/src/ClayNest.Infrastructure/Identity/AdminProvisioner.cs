using ClayNest.Domain.Identity;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;

namespace ClayNest.Infrastructure.Identity;

public sealed class AdminProvisioner(UserManager<AdminUser> users, RoleManager<IdentityRole<Guid>> roles, CommerceDbContext db)
{
    public async Task EnsureCreatedAsync(string email, string password, string displayName)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException("Bootstrap admin email and password must be supplied through configuration.");
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(742019001)");
        if (!await roles.RoleExistsAsync(CommerceRoles.Admin))
            Ensure(await roles.CreateAsync(new IdentityRole<Guid>(CommerceRoles.Admin)));
        var existing = await users.FindByEmailAsync(email.Trim());
        if (existing is not null)
        {
            if (!await users.IsInRoleAsync(existing, CommerceRoles.Admin))
                throw new InvalidOperationException("The configured bootstrap account already exists without admin access.");
            return; // Never silently reset an existing administrator's password.
        }
        var user = new AdminUser
        {
            Id = Guid.NewGuid(), UserName = email.Trim(), Email = email.Trim(),
            EmailConfirmed = true, DisplayName = displayName, LockoutEnabled = true
        };
        Ensure(await users.CreateAsync(user, password));
        Ensure(await users.AddToRoleAsync(user, CommerceRoles.Admin));
        await transaction.CommitAsync();
    }

    private static void Ensure(IdentityResult result)
    {
        if (!result.Succeeded)
            throw new InvalidOperationException("Admin provisioning failed: " + string.Join(", ", result.Errors.Select(error => error.Code)));
    }
}
