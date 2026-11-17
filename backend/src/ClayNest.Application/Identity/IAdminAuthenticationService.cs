namespace ClayNest.Application.Identity;

public sealed record AdminLoginCommand(string Email, string Password, bool RememberMe);
public sealed record AdminProfile(Guid Id, string Email, string DisplayName, string Role);

public interface IAdminAuthenticationService
{
    Task<AdminProfile?> LoginAsync(AdminLoginCommand command);
    Task<AdminProfile?> GetProfileAsync(string? userId);
    Task LogoutAsync(string userId);
}
