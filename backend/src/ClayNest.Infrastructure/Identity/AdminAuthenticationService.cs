using ClayNest.Application.Identity;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using ClayNest.Domain.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;

namespace ClayNest.Infrastructure.Identity;

public sealed class AdminAuthenticationService(
    UserManager<AdminUser> users, SignInManager<AdminUser> signIn,
    IPasswordHasher<AdminUser> passwords, CommerceDbContext db, RoleManager<IdentityRole<Guid>> roles, TimeProvider clock, Microsoft.Extensions.Options.IOptions<AccountMailOptions> mail) : IAdminAuthenticationService
{
    private static readonly AdminUser DummyUser = new();
    private static readonly string DummyHash = new PasswordHasher<AdminUser>()
        .HashPassword(DummyUser, Guid.NewGuid().ToString());

    public async Task<AdminProfile?> LoginAsync(AdminLoginCommand command)
    {
        var user = await users.FindByEmailAsync(command.Email.Trim());
        if (user is null)
        {
            // Perform a real password derivation even when the account does not exist.
            passwords.VerifyHashedPassword(DummyUser, DummyHash, command.Password);
            return null;
        }
        var result = await signIn.CheckPasswordSignInAsync(user, command.Password, lockoutOnFailure: true);
        if (!result.Succeeded || mail.Value.RequireConfirmedEmail && !user.EmailConfirmed) return null;
        await signIn.SignInAsync(user, new AuthenticationProperties
        {
            IsPersistent = command.RememberMe,
            ExpiresUtc = clock.GetUtcNow().Add(command.RememberMe ? TimeSpan.FromDays(7) : TimeSpan.FromHours(8)),
            AllowRefresh = true
        });
        return await ProfileAsync(user);
    }

    public async Task<AdminProfile?> GetProfileAsync(string? userId)
    {
        if (!Guid.TryParse(userId, out _)) return null;
        var user = await users.FindByIdAsync(userId!);
        return user is not null ? await ProfileAsync(user) : null;
    }

    public async Task LogoutAsync(string userId)
    {
        var user = await users.FindByIdAsync(userId);
        if (user is not null)
        {
            // Validate the stamp on every request so replaying a signed-out cookie fails.
            var result = await users.UpdateSecurityStampAsync(user);
            if (!result.Succeeded) throw new InvalidOperationException("Session revocation failed.");
        }
        await signIn.SignOutAsync();
    }

    public async Task<RegistrationResult> RegisterAsync(RegisterCommand command)
    {
        var user = new AdminUser { Id = Guid.NewGuid(), UserName = command.Email.Trim(), Email = command.Email.Trim(), DisplayName = command.DisplayName.Trim() };
        // Serialize registration and configured bootstrap across API instances.
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(742019001)");
        var firstAccount = !await users.Users.AnyAsync();
        var result = await users.CreateAsync(user, command.Password);
        if (!result.Succeeded) return new RegistrationResult(false);
        if (firstAccount)
        {
            if (!await roles.RoleExistsAsync(CommerceRoles.Admin))
            {
                var role = await roles.CreateAsync(new IdentityRole<Guid>(CommerceRoles.Admin));
                if (!role.Succeeded) throw new InvalidOperationException("Cannot initialize admin role.");
            }
            if (!(await users.AddToRoleAsync(user, CommerceRoles.Admin)).Succeeded)
                throw new InvalidOperationException("Cannot initialize first administrator.");
        }
        await transaction.CommitAsync();
        return new RegistrationResult(true);
    }

    private async Task<AdminProfile> ProfileAsync(AdminUser user) => new(user.Id, user.Email!, user.DisplayName,
        await users.IsInRoleAsync(user, CommerceRoles.Admin) ? CommerceRoles.Admin : CommerceRoles.Customer, user.EmailConfirmed);
}
