using System.Net.Mail;
using ClayNest.Application.Identity;
using ClayNest.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
namespace ClayNest.Infrastructure.Identity;

public sealed class AccountService(UserManager<AdminUser> users, SignInManager<AdminUser> signIn,
    CommerceDbContext db, IAccountEmailSender email, IOptions<AccountMailOptions> options,
    AccountMailThrottle throttle, ILogger<AccountService> logger) : IAccountService
{
    private async Task<AdminUser?> LockedUser(string id)
    {
        if (!Guid.TryParse(id, out var key)) return null;
        // Serialize password/reset mutations across API instances; load only after acquiring the lock.
        var lockKey = "account:" + key;
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({lockKey}))");
        var user = await users.FindByIdAsync(id);
        if (user is not null) await db.Entry(user).ReloadAsync();
        return user;
    }
    public async Task<bool> UpdateProfileAsync(string userId, string displayName)
    {
        var name = displayName.Trim();
        if (name.Length is < 2 or > 100 || name.Any(char.IsControl)) return false;
        await using var transaction = await db.Database.BeginTransactionAsync();
        var user = await LockedUser(userId); if (user is null) return false;
        user.DisplayName = name;
        if (!(await users.UpdateAsync(user)).Succeeded) return false;
        await transaction.CommitAsync(); return true;
    }
    public async Task<bool> ChangePasswordAsync(string userId, string currentPassword, string newPassword)
    {
        if (currentPassword == newPassword) return false;
        await using var transaction = await db.Database.BeginTransactionAsync();
        var user = await LockedUser(userId); if (user is null) return false;
        if (!(await users.ChangePasswordAsync(user, currentPassword, newPassword)).Succeeded) return false;
        await transaction.CommitAsync();
        await signIn.SignOutAsync(); // Security stamp invalidates other signed-in sessions too.
        return true;
    }
    private string Link(string path, AdminUser user, string token)
    {
        var origin = options.Value.FrontendUrl.TrimEnd('/');
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) || uri.UserInfo.Length > 0 || uri.Query.Length > 0 || uri.Fragment.Length > 0
            || (uri.Scheme != "https" && !(uri.Scheme == "http" && uri.IsLoopback)))
            throw new InvalidOperationException("Account links require a trusted HTTPS frontend URL or localhost.");
        // Fragment keeps recovery secrets out of HTTP request URLs and referrer headers.
        return origin + path + "#user=" + user.Id + "&token=" + Uri.EscapeDataString(token);
    }
    public async Task RequestResetAsync(string address)
    {
        if (!throttle.TryAcquire("reset:" + address.Trim().ToUpperInvariant())) return;
        var user = await users.FindByEmailAsync(address.Trim()); if (user is null) return;
        var token = await users.GeneratePasswordResetTokenAsync(user);
        await Deliver(user.Email!, "Đặt lại mật khẩu Nàng Gốm", "Bạn đã yêu cầu đặt lại mật khẩu. Liên kết có hiệu lực 1 giờ và chỉ dùng một lần.\n\n"
            + Link("/reset-password", user, token) + "\n\nNếu không yêu cầu, bạn có thể bỏ qua email này.");
    }
    public async Task RequestVerificationAsync(string address)
    {
        if (!throttle.TryAcquire("verify:" + address.Trim().ToUpperInvariant())) return;
        var user = await users.FindByEmailAsync(address.Trim());
        if (user is null || user.EmailConfirmed) return;
        var token = await users.GenerateEmailConfirmationTokenAsync(user);
        await Deliver(user.Email!, "Xác minh email Nàng Gốm", "Xác minh địa chỉ email của bạn bằng liên kết sau (có hiệu lực 1 giờ):\n\n"
            + Link("/verify-email", user, token) + "\n\nNếu không yêu cầu, bạn có thể bỏ qua email này.");
    }
    private async Task Deliver(string recipient, string subject, string body)
    {
        try { await email.SendAsync(recipient, subject, body); }
        catch (Exception ex) when (ex is SmtpException or IOException or UnauthorizedAccessException or OperationCanceledException or TimeoutException) {
            // Never log addresses, email content, tokens or SMTP credentials.
            logger.LogWarning("Account email delivery failed; check mail transport configuration.");
        }
    }
    public async Task<bool> ResetAsync(string userId, string token, string newPassword)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        var user = await LockedUser(userId); if (user is null) return false;
        if (!(await users.ResetPasswordAsync(user, token, newPassword)).Succeeded) return false;
        await transaction.CommitAsync(); return true;
    }
    public async Task<bool> ConfirmEmailAsync(string userId, string token)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        var user = await LockedUser(userId); if (user is null) return false;
        if (!(await users.ConfirmEmailAsync(user, token)).Succeeded) return false;
        await transaction.CommitAsync(); return true;
    }
}
