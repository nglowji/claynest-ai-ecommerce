using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
namespace ClayNest.Infrastructure.Chat;

public sealed class ChatOptions
{
    public string BaseUrl { get; set; } = "http://ai-service:8001";
    public string GatewaySecret { get; set; } = "";
    public string ToolSecret { get; set; } = "";
}
public sealed class ServiceSignature(TimeProvider clock)
{
    private readonly Dictionary<string,long> nonces = [];
    private readonly object gate = new();
    public static string Sign(string secret, string path, string scope, string timestamp, string nonce, byte[] body)
    {
        var canonical = $"POST\n{path}\n{scope}\n{timestamp}\n{nonce}\n{Convert.ToHexString(SHA256.HashData(body)).ToLowerInvariant()}";
        return Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
    }
    public bool Verify(string secret, string path, string scope, string timestamp, string nonce, string signature, byte[] body)
    {
        var now = clock.GetUtcNow().ToUnixTimeSeconds();
        if (secret.Length < 32 || !long.TryParse(timestamp,out var time) || time < now - 60 || time > now + 60
            || !Guid.TryParseExact(nonce,"N",out _) || signature.Length != 64) return false;
        byte[] supplied;
        try { supplied = Convert.FromHexString(signature); } catch (FormatException) { return false; }
        if (!CryptographicOperations.FixedTimeEquals(supplied,Convert.FromHexString(Sign(secret,path,scope,timestamp,nonce,body)))) return false;
        lock (gate)
        {
            foreach (var key in nonces.Where(pair => pair.Value < now).Select(pair => pair.Key).ToArray()) nonces.Remove(key);
            if (nonces.ContainsKey(nonce) || nonces.Count >= 10000) return false;
            nonces[nonce] = now + 120; return true;
        }
    }
}
