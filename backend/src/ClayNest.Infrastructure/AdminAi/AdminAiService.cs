using ClayNest.Application.AdminAi;
using ClayNest.Application.Chat;
using ClayNest.Infrastructure.Chat;
namespace ClayNest.Infrastructure.AdminAi;

public sealed class AdminAiService(IAdminAiSnapshot snapshot, IAdminAiGateway gateway,
    IKnowledgeGateway knowledge) : IAdminAiService
{
    public async Task<AdminAiResponse> AskAsync(AdminAiRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Message) || request.Message.Length > 1200 ||
            request.Days is not (7 or 30 or 90))
            throw new ChatValidationException("Nhập câu hỏi tối đa 1.200 ký tự và chọn kỳ 7, 30 hoặc 90 ngày.");
        var context = await snapshot.GetAsync(request, ct);
        var decision = await gateway.AskAsync(context, ct);
        return await ComposeAsync(context, decision, knowledge, ct);
    }

    public static async Task<AdminAiResponse> ComposeAsync(AdminAiContext context, AdminAiDecision decision,
        IKnowledgeGateway knowledge, CancellationToken ct)
    {
        var facts = context.Facts.ToDictionary(f => f.Id);
        var guides = context.Guides.ToDictionary(g => g.Key);
        if (decision.FactIds is null || decision.GuideKeys is null || decision.ChunkIds is null ||
            decision.FactIds.Count > 8 || decision.GuideKeys.Count > 3 || decision.ChunkIds.Count > 2 ||
            decision.FactIds.Any(id => string.IsNullOrWhiteSpace(id) || !facts.ContainsKey(id)) ||
            decision.GuideKeys.Any(key => string.IsNullOrWhiteSpace(key) || !guides.ContainsKey(key)) ||
            decision.FactIds.Distinct().Count() != decision.FactIds.Count ||
            decision.GuideKeys.Distinct().Count() != decision.GuideKeys.Count ||
            decision.ChunkIds.Distinct().Count() != decision.ChunkIds.Count)
            throw new ChatUnavailableException();
        var insights = decision.FactIds.Select(id => facts[id]).ToList();
        var sources = decision.GuideKeys.Select(key => guides[key])
            .Select(g => new AdminAiSource(g.Title, AdminAiGuides.Version, g.Content, g.Url)).ToList();
        if (decision.ChunkIds.Count > 0)
        {
            // Resolve again after generation: revoked versions cannot be cited from a stale retrieval.
            var excerpts = await knowledge.ResolveAsync(decision.ChunkIds, null, false, ct);
            sources.AddRange(excerpts.Select(e => new AdminAiSource(e.Title,
                "Phiên bản " + e.Version + " · " + e.Section, e.Content, ChatService.SourceUrl(e))));
        }
        var message = insights.Count + sources.Count > 0
            ? "Thông tin liên quan đến câu hỏi của bạn. Mở từng nguồn để đối chiếu và thực hiện bước tiếp theo."
            : "Chưa có dữ liệu hoặc nguồn đã duyệt phù hợp. Bạn có thể hỏi về doanh thu, đơn hàng, tồn kho hoặc cách vận hành hệ thống.";
        return new(message, context.From, context.To, context.GeneratedAt, context.IsDemo, insights, sources);
    }
}
