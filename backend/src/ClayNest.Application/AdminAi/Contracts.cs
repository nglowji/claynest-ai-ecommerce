namespace ClayNest.Application.AdminAi;

public sealed record AdminAiRequest(string Message, int Days = 30);
public sealed record AdminAiFact(string Id, string Title, string Value, string Detail, string Url);
public sealed record AdminAiGuide(string Key, string Title, string Content, string Url);
public sealed record AdminAiContext(string Message, DateOnly From, DateOnly To,
    DateTimeOffset GeneratedAt, bool IsDemo, List<AdminAiFact> Facts, List<AdminAiGuide> Guides);
public sealed record AdminAiDecision(List<string> FactIds, List<string> GuideKeys, List<Guid> ChunkIds);
public sealed record AdminAiSource(string Title, string Version, string Content, string Url);
public sealed record AdminAiResponse(string Message, DateOnly From, DateOnly To,
    DateTimeOffset GeneratedAt, bool IsDemo, List<AdminAiFact> Insights, List<AdminAiSource> Sources);
public interface IAdminAiSnapshot
{
    Task<AdminAiContext> GetAsync(AdminAiRequest request, CancellationToken ct);
}
public interface IAdminAiGateway
{
    Task<AdminAiDecision> AskAsync(AdminAiContext context, CancellationToken ct);
}
public interface IAdminAiService
{
    Task<AdminAiResponse> AskAsync(AdminAiRequest request, CancellationToken ct);
}
