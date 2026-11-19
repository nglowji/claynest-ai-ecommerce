using System.Text.Json;
namespace ClayNest.Application.Chat;

public sealed record KnowledgeExcerpt(Guid ChunkId, Guid DocumentId, Guid VersionId, string Title, int Version,
    string Section, string Content, string SourceLabel, string? ProductSlug, string EvidenceType, string Topic);
public sealed record KnowledgeFeedback(Guid RequestId, Guid ChunkId, bool Useful);
public sealed class KnowledgeException(int status, string code, string message) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
}
public interface IKnowledgeGateway
{
    Task<JsonElement> AdminAsync(string action, JsonElement payload, string actorId, CancellationToken ct);
    Task<List<KnowledgeExcerpt>> ResolveAsync(List<Guid> ids, string? slug, bool safety, CancellationToken ct);
    Task FeedbackAsync(KnowledgeFeedback input, CancellationToken ct);
}
