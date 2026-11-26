using System.Net;
using System.Net.Mail;
using ClayNest.Application.Identity;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
namespace ClayNest.Infrastructure.Identity;

public sealed class AccountMailOptions
{
    public string FrontendUrl { get; set; } = "http://127.0.0.1:5173";
    public string PickupPath { get; set; } = "/app/mail";
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string From { get; set; } = "Nàng Gốm <no-reply@nanggom.local>";
    public bool RequireConfirmedEmail { get; set; }
}

public sealed class AccountEmailSender(IOptions<AccountMailOptions> options, IHostEnvironment environment) : IAccountEmailSender
{
    public async Task SendAsync(string recipient, string subject, string body)
    {
        var config = options.Value;
        using var message = new MailMessage { From = new MailAddress(config.From), Subject = subject, Body = body, BodyEncoding = System.Text.Encoding.UTF8, SubjectEncoding = System.Text.Encoding.UTF8 };
        message.To.Add(new MailAddress(recipient));
        using var smtp = new SmtpClient();
        if (string.IsNullOrWhiteSpace(config.Host)) {
            if (!environment.IsDevelopment()) throw new InvalidOperationException("SMTP is required outside Development.");
            Directory.CreateDirectory(config.PickupPath);
            smtp.DeliveryMethod = SmtpDeliveryMethod.SpecifiedPickupDirectory;
            smtp.PickupDirectoryLocation = Path.GetFullPath(config.PickupPath);
        } else {
            smtp.Host = config.Host; smtp.Port = config.Port; smtp.EnableSsl = true;
            smtp.UseDefaultCredentials = false;
            smtp.Credentials = new NetworkCredential(config.Username, config.Password);
            smtp.Timeout = 10000;
        }
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(12));
        await smtp.SendMailAsync(message, timeout.Token);
    }
}
