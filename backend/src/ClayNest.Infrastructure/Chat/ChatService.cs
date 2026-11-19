using System.Text.RegularExpressions;
using ClayNest.Application.Chat;
using ClayNest.Domain.Orders;
using ClayNest.Domain.Catalog;
namespace ClayNest.Infrastructure.Chat;

public sealed class ChatService(IChatGateway gateway,IChatCatalog catalog, IKnowledgeGateway knowledge) : IChatService
{
    private static readonly Dictionary<string,string> Reasons = new()
    {
        ["match"] = "Một lựa chọn để bạn cân nhắc.", ["budget"] = "Phù hợp khoảng ngân sách bạn chọn.",
        ["glaze"] = "Sắc men để bạn cân nhắc cho góc nhà.", ["size"] = "Kích thước phù hợp bộ lọc bạn chọn.",
        ["gift"] = "Một gợi ý để bạn cân nhắc làm quà.", ["everyday"] = "Gợi ý cho những khoảnh khắc thường ngày.", ["decor"] = "Một điểm nhấn gốm cho góc nhà."
    };
    public static string SourceUrl(KnowledgeExcerpt p) => "/knowledge/"+p.ChunkId+(p.ProductSlug is null ? "" : "?product="+Uri.EscapeDataString(p.ProductSlug));
    public static string Redact(string text)
    {
        text = Regex.Replace(text,@"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}","[email đã ẩn]");
        text = Regex.Replace(text,@"(?<!\w)(?:\+84|0)[0-9 .-]{8,14}[0-9](?!\w)","[số điện thoại đã ẩn]");
        return Regex.Replace(text,@"(?<![\w-])(?:AIza[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{40,})(?![\w-])","[mã riêng đã ẩn]");
    }
    public async Task<ChatResponse> AskAsync(ChatRequest request,CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Message) || request.Message.Length > 1200 || request.History?.Count > 6
            || request.History?.Any(t => t is null || t.Role is not ("user" or "assistant") || string.IsNullOrWhiteSpace(t.Content) || t.Content.Length > 1200) == true)
            throw new ChatValidationException("Tin nhắn tối đa 1.200 ký tự và lịch sử tối đa 6 lượt.");
        if (request.Filters is not null) ChatCatalog.Validate(request.Filters);
        var safe = request with { Message = Redact(request.Message), History = request.History?.Select(t => t with { Content = Redact(t.Content) }).ToList() };
        var result = await gateway.AskAsync(safe,ct);
        if (result.Filters is null || result.Choices is null || result.Choices.Count > 3 || result.Choices.Any(c => c is null || string.IsNullOrEmpty(c.Reason) || !Reasons.ContainsKey(c.Reason))) throw new ChatUnavailableException();
        try { ChatCatalog.Validate(result.Filters); } catch (ChatValidationException) { throw new ChatUnavailableException(); }
        if (result.Topic == "rag")
        {
            var passageIds=result.ChunkIds ?? [];
            var query=Product.NormalizeSearch(request.Message);
            var safety=result.SafetyOnly || new[] { "an toan thuc pham","khong chi","lo vi song","may rua bat","chiu nhiet","food safe","food-safe","lead free","lead-free","microwave","dishwasher" }.Any(query.Contains);
            if (safety && result.ProductSlug is null) passageIds=[];
            if (passageIds.Count>2 || passageIds.Distinct().Count()!=passageIds.Count) throw new ChatUnavailableException();
            if (result.ProductSlug is { } slug && (await catalog.DetailAsync(slug,ct)).Count==0) passageIds=[];
            var passages=passageIds.Count==0 ? [] : await knowledge.ResolveAsync(passageIds,result.ProductSlug,safety,ct);
            if (passages.Count==0) return new("Nàng chưa có nguồn đã duyệt đủ phù hợp để trả lời câu hỏi này. Bạn có thể xem thông tin sản phẩm hoặc nhờ cửa hàng kiểm tra thêm.",[],[new("Xem sản phẩm","/products")]);
            return new("Theo tài liệu đã được cửa hàng duyệt:\n\n"+string.Join("\n\n",passages.Select(p=>p.Content)),[],[],
                passages.Select(p=>new ChatSource(p.Title,"v"+p.Version,p.Section,SourceUrl(p))).ToList());
        }
        var knowledgeKey = result.Topic switch
        {
            "knowledge" => result.KnowledgeKey,
            "safety" => "safety",
            "policy" => "shipping",
            _ => null
        };
        if (result.Topic is "knowledge" or "safety" or "policy")
        {
            var article = StoreKnowledge.Find(knowledgeKey) ?? throw new ChatUnavailableException();
            return new(article.Content, [], [new(article.Title, article.Url)],
                [new("Nàng Gốm · Hướng dẫn cửa hàng", article.Version, article.Title, article.Url)]);
        }
        if (result.Topic == "order") return new("Mình không tra cứu hoặc thay đổi đơn trong cuộc trò chuyện. Bạn hãy dùng trang tra cứu riêng nhé.",[],[new("Tra cứu đơn hàng","/orders")]);
        if (result.Topic == "other") return new("Mình có thể giúp bạn chọn gốm theo ngân sách, sắc men, kích thước hoặc dịp tặng. Bạn đang tìm món gì cho nhà?",[],[]);
        if (result.Topic is not ("recommend" or "detail")) throw new ChatUnavailableException();
        var filters = result.Filters;
        if (request.Filters is { } explicitFilters)
            filters = filters with { MaxPrice = explicitFilters.MaxPrice ?? filters.MaxPrice, MinPrice = explicitFilters.MinPrice ?? filters.MinPrice,
                Category = explicitFilters.Category ?? filters.Category, Glaze = explicitFilters.Glaze ?? filters.Glaze, Use = explicitFilters.Use ?? filters.Use,
                MaxHeightCm = explicitFilters.MaxHeightCm ?? filters.MaxHeightCm, MinCapacityMl = explicitFilters.MinCapacityMl ?? filters.MinCapacityMl, InStock = explicitFilters.InStock };
        var ids = result.Choices.Select(c => c.VariantId).Distinct().ToList();
        var live = await catalog.ResolveAsync(ids,filters,ct);
        var products = result.Choices.DistinctBy(c => c.VariantId).Where(c => live.Any(v => v.VariantId == c.VariantId))
            .Select(c => new ChatProduct(live.Single(v => v.VariantId == c.VariantId),Reasons[c.Reason == "budget" && filters.MaxPrice is null && filters.MinPrice is null || c.Reason == "size" && filters.MaxHeightCm is null && filters.MinCapacityMl is null ? "match" : c.Reason])).ToList();
        if (result.Topic == "detail" && products.Count > 0)
        {
            var item = products[0].Product;
            var description = $"{item.Name}. {item.Description} Chất liệu: {item.Material}. Men: {item.Glaze}.";
            return new(description, products, [new("Xem thông tin sản phẩm", "/products/" + item.Slug)],
                [new(item.Name, "Hiện tại", "Thông tin catalog", "/products/" + item.Slug)]);
        }
        return new(products.Count > 0 ? "Nàng chọn được vài món để bạn xem thử. Giá và số lượng dưới đây vừa được kiểm tra lại ở cửa hàng." : "Nàng chưa tìm được món còn phù hợp bộ lọc hiện tại. Bạn thử đổi ngân sách hoặc sắc men nhé.",products,[new("Khám phá cửa hàng","/products")]);
    }
}
