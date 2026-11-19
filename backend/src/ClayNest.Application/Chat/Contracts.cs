namespace ClayNest.Application.Chat;

public sealed record ChatTurn(string Role, string Content);
public sealed record ChatFilters(string? Q = null, string? Category = null, long? MinPrice = null, long? MaxPrice = null,
    string? Glaze = null, string? Use = null, bool InStock = true, decimal? MaxHeightCm = null, int? MinCapacityMl = null);
public sealed record ChatRequest(string Message, List<ChatTurn>? History = null, ChatFilters? Filters = null);
public sealed record ChatChoice(Guid VariantId, string Reason);
public sealed record AiDecision(string Topic, ChatFilters Filters, List<ChatChoice> Choices, string? KnowledgeKey = null, List<Guid>? ChunkIds = null, string? ProductSlug = null, bool SafetyOnly = false);
public sealed record ChatFact(Guid VariantId, Guid ProductId, string Name, string Slug, string Sku, string VariantName,
    string Description, string Material, string Glaze, string Use, long PriceVnd, int StockQty, decimal? HeightCm, int? CapacityMl, string Image);
public sealed record ChatProduct(ChatFact Product, string Reason);
public sealed record ChatAction(string Label, string Url);
public sealed record ChatSource(string Title, string Version, string Section, string Url);
public sealed record ChatResponse(string Message, List<ChatProduct> Products, List<ChatAction> Actions, List<ChatSource>? Sources = null);
public sealed record KnowledgeArticle(string Key, string Title, string Version, string Content, string Url);
public sealed record CatalogIndexEntry(string Name, string Slug, string Category, string Material);
public sealed record ChatContext(List<KnowledgeArticle> Knowledge, List<CatalogIndexEntry> Catalog, bool CatalogTruncated);
public sealed class ChatValidationException(string message) : Exception(message);
public sealed class ChatUnavailableException : Exception;
public interface IChatCatalog
{
    Task<ChatContext> ContextAsync(CancellationToken ct);
    Task<List<ChatFact>> SearchAsync(ChatFilters filters, CancellationToken ct);
    Task<List<ChatFact>> DetailAsync(string slug, CancellationToken ct);
    Task<List<ChatFact>> ResolveAsync(List<Guid> ids, ChatFilters filters, CancellationToken ct);
}
public interface IChatGateway { Task<AiDecision> AskAsync(ChatRequest request, CancellationToken ct); }
public interface IChatService { Task<ChatResponse> AskAsync(ChatRequest request, CancellationToken ct); }
