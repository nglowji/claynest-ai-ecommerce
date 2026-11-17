using ClayNest.Application.Identity;
using ClayNest.Domain.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;

namespace ClayNest.Infrastructure.Identity;

public sealed class AdminAuthenticationService(
    UserManager<AdminUser> users, SignInManager<AdminUser> signIn,
    IPasswordHasher<AdminUser> passwords) : IAdminAuthenticationService
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
        if (!result.Succeeded) return null;
        await signIn.SignInAsync(user, new AuthenticationProperties
        {
            IsPersistent = command.RememberMe,
            ExpiresUtc = DateTimeOffset.UtcNow.Add(command.RememberMe ? TimeSpan.FromDays(7) : TimeSpan.FromHours(8)),
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
        // Public registration never assigns administrative roles.
        var result = await users.CreateAsync(user, command.Password);
        return new RegistrationResult(result.Succeeded);
    }

    private async Task<AdminProfile> ProfileAsync(AdminUser user) => new(user.Id, user.Email!, user.DisplayName,
        await users.IsInRoleAsync(user, CommerceRoles.Admin) ? CommerceRoles.Admin : CommerceRoles.Customer);
}
