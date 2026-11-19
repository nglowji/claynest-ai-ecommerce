using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using ClayNest.Application.Chat;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace ClayNest.IntegrationTests;

public sealed class KnowledgeTests
{
    private static readonly Guid ActorId=Guid.NewGuid();
    private sealed class TestAuth(IOptionsMonitor<AuthenticationSchemeOptions> options,Microsoft.Extensions.Logging.ILoggerFactory logger,UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options,logger,encoder)
    {
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var role=Request.Headers["X-Test-Role"].ToString();
            if (string.IsNullOrEmpty(role)) return Task.FromResult(AuthenticateResult.NoResult());
            var identity=new ClaimsIdentity([new(ClaimTypes.NameIdentifier,ActorId.ToString()),new(ClaimTypes.Name,"Synthetic admin"),new(ClaimTypes.Role,role)],Scheme.Name);
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity),Scheme.Name)));
        }
    }
    private sealed class Knowledge : IKnowledgeGateway
    {
        public int Calls;
        public string? Actor;
        public List<KnowledgeExcerpt> Excerpts=[];
        public int? Failure;
        public Task<JsonElement> AdminAsync(string action,JsonElement payload,string actorId,CancellationToken ct)
        {
            Calls++; Actor=actorId;
            if (Failure is {} status) throw new KnowledgeException(status,"knowledge_conflict","Safe failure");
            return Task.FromResult(JsonSerializer.SerializeToElement(new { items=Array.Empty<object>(),totalCount=0 }));
        }
        public Task<List<KnowledgeExcerpt>> ResolveAsync(List<Guid> ids,string? slug,bool safety,CancellationToken ct) => Task.FromResult(Excerpts.Where(e=>ids.Contains(e.ChunkId)).ToList());
        public Task FeedbackAsync(KnowledgeFeedback input,CancellationToken ct) { Calls++; return Task.CompletedTask; }
    }
    private sealed class Chat(Guid chunk) : IChatGateway
    {
        public Task<AiDecision> AskAsync(ChatRequest input,CancellationToken ct) => Task.FromResult(new AiDecision("rag",new(),[],ChunkIds:[chunk]));
    }
    private static WebApplicationFactory<Program> Factory(Knowledge knowledge,IChatGateway? chat=null) => new ApiFactory().WithWebHostBuilder(builder=>builder.ConfigureTestServices(services=>
    {
        services.AddAuthentication(options=> { options.DefaultAuthenticateScheme="KnowledgeTest"; options.DefaultChallengeScheme="KnowledgeTest"; options.DefaultForbidScheme="KnowledgeTest"; }).AddScheme<AuthenticationSchemeOptions,TestAuth>("KnowledgeTest",_=>{});
        services.RemoveAll<IKnowledgeGateway>(); services.AddSingleton<IKnowledgeGateway>(knowledge);
        if (chat!=null) { services.RemoveAll<IChatGateway>(); services.AddSingleton(chat); }
    }));
    private static async Task<string> Csrf(HttpClient client) => (await client.GetFromJsonAsync<Dictionary<string,string>>("/api/v1/auth/csrf"))!["requestToken"];
    private static async Task<HttpResponseMessage> Post(HttpClient client,string path,object payload,bool csrf=true)
    {
        using var request=new HttpRequestMessage(HttpMethod.Post,path) { Content=JsonContent.Create(payload) };
        if (csrf) request.Headers.Add("X-CSRF-TOKEN",await Csrf(client));
        return await client.SendAsync(request);
    }

    [Fact]
    public async Task Admin_facade_requires_role_and_csrf_and_derives_actor_from_authenticated_principal()
    {
        var gateway=new Knowledge(); await using var factory=Factory(gateway); using var client=factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress=new Uri("https://localhost") });
        using var guest=await client.GetAsync("/api/v1/admin/knowledge"); Assert.Equal(HttpStatusCode.Unauthorized,guest.StatusCode);
        client.DefaultRequestHeaders.Add("X-Test-Role","Customer");
        using var buyer=await Post(client,"/api/v1/admin/knowledge",new{},false); Assert.Equal(HttpStatusCode.Forbidden,buyer.StatusCode); Assert.Equal(0,gateway.Calls);
        client.DefaultRequestHeaders.Remove("X-Test-Role"); client.DefaultRequestHeaders.Add("X-Test-Role","Admin");
        using var noCsrf=await Post(client,"/api/v1/admin/knowledge",new{},false); Assert.Equal(HttpStatusCode.BadRequest,noCsrf.StatusCode);
        using var allowed=await Post(client,"/api/v1/admin/knowledge",new { title="Synthetic document",actorId="forged" });
        Assert.Equal(HttpStatusCode.OK,allowed.StatusCode); Assert.Equal(ActorId.ToString(),gateway.Actor); Assert.Equal(1,gateway.Calls);
        Assert.Contains("no-store",allowed.Headers.CacheControl!.ToString());
        gateway.Failure=409;
        using var stale=await Post(client,"/api/v1/admin/knowledge/approve",new{}); Assert.Equal(HttpStatusCode.Conflict,stale.StatusCode);
    }

    [Fact]
    public async Task Admin_upload_is_bounded_before_forwarding_to_python()
    {
        var gateway=new Knowledge(); await using var factory=Factory(gateway); using var client=factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress=new Uri("https://localhost") });
        client.DefaultRequestHeaders.Add("X-Test-Role","Admin");
        using var large=await Post(client,"/api/v1/admin/knowledge",new { content=new string('x',140000) });
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge,large.StatusCode); Assert.Equal(0,gateway.Calls);
    }

    [Fact]
    public async Task Public_chat_revalidates_source_and_cannot_quote_it_after_revocation()
    {
        var chunk=Guid.NewGuid(); var source=new KnowledgeExcerpt(chunk,Guid.NewGuid(),Guid.NewGuid(),"Reviewed guide",1,"Section one","Reviewed public text only.","Verified procedure",null,"general","care");
        var gateway=new Knowledge { Excerpts=[source] };
        await using var factory=Factory(gateway,new Chat(chunk)); using var client=factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress=new Uri("https://localhost") });
        using var current=await Post(client,"/api/v1/chat",new ChatRequest("How to clean?")); Assert.Equal(HttpStatusCode.OK,current.StatusCode);
        var answer=(await current.Content.ReadFromJsonAsync<ChatResponse>())!; Assert.Contains(source.Content,answer.Message); Assert.Equal("/knowledge/"+chunk,answer.Sources!.Single().Url);
        using var published=await client.GetAsync("/api/v1/knowledge/sources/"+chunk); Assert.Equal(HttpStatusCode.OK,published.StatusCode);
        gateway.Excerpts=[];
        using var revoked=await Post(client,"/api/v1/chat",new ChatRequest("Repeat the guide"));
        Assert.DoesNotContain(source.Content,await revoked.Content.ReadAsStringAsync());
        using var hidden=await client.GetAsync("/api/v1/knowledge/sources/"+chunk); Assert.Equal(HttpStatusCode.NotFound,hidden.StatusCode);
        using var noCsrf=await Post(client,"/api/v1/knowledge/feedback",new KnowledgeFeedback(Guid.NewGuid(),chunk,true),false); Assert.Equal(HttpStatusCode.BadRequest,noCsrf.StatusCode);
    }
    [Theory]
    [InlineData("Is this microwave safe?")]
    [InlineData("Is this lead-free and food safe?")]
    [InlineData("Can every cup go in the dishwasher?")]
    public async Task Safety_questions_cannot_use_a_general_unscoped_passage_even_if_model_misclassifies(string question)
    {
        var chunk=Guid.NewGuid();
        var gateway=new Knowledge { Excerpts=[new(chunk,Guid.NewGuid(),Guid.NewGuid(),"Unverified",1,"Section","Unsafe unsupported claim","Not evidence",null,"general","care")] };
        await using var factory=Factory(gateway,new Chat(chunk)); using var client=factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress=new Uri("https://localhost") });
        using var result=await Post(client,"/api/v1/chat",new ChatRequest(question));
        Assert.Equal(HttpStatusCode.OK,result.StatusCode);
        Assert.DoesNotContain("Unsafe unsupported claim",await result.Content.ReadAsStringAsync());
    }

}
