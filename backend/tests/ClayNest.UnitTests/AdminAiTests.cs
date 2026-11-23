using System.Text.Json;
using ClayNest.Application.AdminAi;
using ClayNest.Application.Chat;
using ClayNest.Infrastructure.AdminAi;
namespace ClayNest.UnitTests;

public sealed class AdminAiTests
{
    private static AdminAiContext Context() => new("Cần làm gì?", new(2026, 11, 1), new(2026, 11, 30),
        DateTimeOffset.UtcNow, false, [new("sales", "Doanh thu", "1.000.000 ₫", "Đơn hoàn tất", "/admin/reports")], AdminAiGuides.All.ToList());
    private sealed class Knowledge : IKnowledgeGateway
    {
        public int Calls;
        public Task<List<KnowledgeExcerpt>> ResolveAsync(List<Guid> ids, string? slug, bool safety, CancellationToken ct)
        {
            Calls++; Assert.Null(slug); Assert.False(safety);
            return Task.FromResult(new List<KnowledgeExcerpt>());
        }
        public Task<JsonElement> AdminAsync(string action, JsonElement payload, string actorId, CancellationToken ct) => throw new InvalidOperationException();
        public Task FeedbackAsync(KnowledgeFeedback input, CancellationToken ct) => throw new InvalidOperationException();
    }
    [Fact]
    public async Task Answers_use_server_facts_and_versioned_guides_not_model_prose()
    {
        var knowledge = new Knowledge();
        var answer = await AdminAiService.ComposeAsync(Context(), new(["sales"], ["reports"], []), knowledge, default);
        Assert.Equal("1.000.000 ₫", Assert.Single(answer.Insights).Value);
        Assert.Equal(AdminAiGuides.Version, Assert.Single(answer.Sources).Version);
        Assert.Equal("/admin/reports", answer.Sources[0].Url);
        Assert.Equal(0, knowledge.Calls);
    }
    [Fact]
    public async Task Unknown_or_duplicate_identifiers_fail_closed()
    {
        foreach (var decision in new AdminAiDecision[] {
            new(["invented"], [], []), new(["sales", "sales"], [], []),
            new([], ["secrets"], []), new([], ["orders", "orders"], []),
            new(null!, [], []), new([null!], [], []), new([], [], [Guid.Empty, Guid.Empty]),
        }) await Assert.ThrowsAsync<ChatUnavailableException>(() => AdminAiService.ComposeAsync(Context(), decision, new Knowledge(), default));
    }
    [Fact]
    public async Task Revoked_rag_sources_are_resolved_again_and_not_cited()
    {
        var knowledge = new Knowledge();
        var answer = await AdminAiService.ComposeAsync(Context(), new([], [], [Guid.NewGuid()]), knowledge, default);
        Assert.Equal(1, knowledge.Calls); Assert.Empty(answer.Sources); Assert.Empty(answer.Insights);
        Assert.Contains("Chưa có dữ liệu", answer.Message);
    }
    private sealed class Snapshot : IAdminAiSnapshot
    {
        public int Calls;
        public Task<AdminAiContext> GetAsync(AdminAiRequest request, CancellationToken ct) { Calls++; return Task.FromResult(Context()); }
    }
    private sealed class Gateway : IAdminAiGateway
    {
        public Task<AdminAiDecision> AskAsync(AdminAiContext context, CancellationToken ct) => Task.FromResult(new AdminAiDecision([], [], []));
    }
    [Theory]
    [InlineData("", 30)]
    [InlineData(" ", 7)]
    [InlineData("Câu hỏi", 365)]
    public async Task Invalid_requests_never_fetch_business_data(string message, int days)
    {
        var snapshot = new Snapshot(); var service = new AdminAiService(snapshot, new Gateway(), new Knowledge());
        await Assert.ThrowsAsync<ChatValidationException>(() => service.AskAsync(new(message, days), default));
        Assert.Equal(0, snapshot.Calls);
    }
}
