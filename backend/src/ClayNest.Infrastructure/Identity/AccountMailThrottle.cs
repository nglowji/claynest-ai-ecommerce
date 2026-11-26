using System.Security.Cryptography;
using System.Text;
namespace ClayNest.Infrastructure.Identity;

public sealed class AccountMailThrottle(TimeProvider clock)
{
    private readonly Dictionary<string, DateTimeOffset> entries = new();
    private readonly object gate = new();
    public bool TryAcquire(string target)
    {
        var key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(target)));
        lock (gate) {
            var now = clock.GetUtcNow();
            foreach (var expired in entries.Where(e => e.Value <= now).Select(e => e.Key).ToArray()) entries.Remove(expired);
            if (entries.ContainsKey(key) || entries.Count >= 10000) return false;
            entries[key] = now.AddMinutes(1); return true;
        }
    }
}
