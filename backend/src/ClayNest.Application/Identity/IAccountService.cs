namespace ClayNest.Application.Identity;

public interface IAccountService
{
    Task<bool> UpdateProfileAsync(string userId, string displayName);
    Task<bool> ChangePasswordAsync(string userId, string currentPassword, string newPassword);
    Task RequestResetAsync(string email);
    Task RequestVerificationAsync(string userId);
    Task<bool> ResetAsync(string userId, string token, string newPassword);
    Task<bool> ConfirmEmailAsync(string userId, string token);
}

public interface IAccountEmailSender
{
    Task SendAsync(string recipient, string subject, string body);
}
