using System.Text;
using ClayNest.Infrastructure.Chat;
namespace ClayNest.UnitTests;
public sealed class ServiceSignatureTests
{
    private sealed class Clock : TimeProvider { public DateTimeOffset Now = DateTimeOffset.FromUnixTimeSeconds(1700000000); public override DateTimeOffset GetUtcNow() => Now; }
    [Fact]
    public void Hmac_matches_python_and_rejects_replay_modified_body_scope_and_expired_request()
    {
        var secret = new string('s',64); var body = Encoding.UTF8.GetBytes("{\"message\":\"gốm\"}"); var nonce = new string('1',32);
        var expected = ServiceSignature.Sign(secret,"/internal/chat","chat:public","1700000000",nonce,body);
        Assert.Equal("7476421f62019b732ef5955af2c1a3f4c2a0d708f72609a54a31a68e3f10488a",expected);
        var clock = new Clock(); var verifier = new ServiceSignature(clock);
        Assert.False(verifier.Verify(secret,"/internal/chat","chat:public","1700000000",nonce,expected,Encoding.UTF8.GetBytes("tampered")));
        Assert.False(verifier.Verify(secret,"/internal/chat","catalog:read","1700000000",nonce,expected,body));
        Assert.True(verifier.Verify(secret,"/internal/chat","chat:public","1700000000",nonce,expected,body));
        Assert.False(verifier.Verify(secret,"/internal/chat","chat:public","1700000000",nonce,expected,body));
        clock.Now = clock.Now.AddMinutes(3);
        Assert.False(new ServiceSignature(clock).Verify(secret,"/internal/chat","chat:public","1700000000",nonce,expected,body));
    }
    [Fact]
    public void Chat_redacts_email_phone_lookup_secret_and_google_key_before_provider()
    {
        var token = new string('Z',43); var key = "AIza" + new string('x',35);
        var value = ChatService.Redact($"hello buyer@example.com 0901234567 {token} {key}");
        Assert.DoesNotContain("buyer@example.com",value); Assert.DoesNotContain("0901234567",value); Assert.DoesNotContain(token,value); Assert.DoesNotContain(key,value);
        Assert.Contains("hello",value);
    }
}
