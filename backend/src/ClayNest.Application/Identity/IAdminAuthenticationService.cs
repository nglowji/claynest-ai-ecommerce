namespace ClayNest.Application.Identity;

public sealed record AdminLoginCommand(string Email, string Password, bool RememberMe);
public sealed record AdminProfile(Guid Id, string Email, string DisplayName, string Role);

public sealed record RegisterCommand(string DisplayName, string Email, string Password);
public sealed record RegistrationResult(bool Succeeded);

public interface IAdminAuthenticationService
{
    Task<AdminProfile?> LoginAsync(AdminLoginCommand command);
    Task<AdminProfile?> GetProfileAsync(string? userId);
    Task<RegistrationResult> RegisterAsync(RegisterCommand command);
    Task LogoutAsync(string userId);
}
