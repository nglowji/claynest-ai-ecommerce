using System.Net.Http.Json;
using System.Text.Json;
using ClayNest.Application.Chat;
using Microsoft.Extensions.Options;

namespace ClayNest.Infrastructure.Chat;

public sealed class KnowledgeGateway(HttpClient http, IOptions<ChatOptions> config, TimeProvider clock,
    Microsoft.AspNetCore.Http.IHttpContextAccessor context) : IKnowledgeGateway
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private async Task<JsonElement> SendAsync(string path, string scope, string secret, object payload, CancellationToken ct)
    {
        if (secret.Length < 32) throw new KnowledgeException(503,"knowledge_unavailable","Chưa kết nối được kho kiến thức. Vui lòng thử lại.");
        var body = JsonSerializer.SerializeToUtf8Bytes(payload,Json);
        using var request = new HttpRequestMessage(HttpMethod.Post,new Uri(new Uri(config.Value.BaseUrl),path)) { Content = new ByteArrayContent(body) };
        request.Content.Headers.ContentType = new("application/json");
        var timestamp=clock.GetUtcNow().ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);
        var nonce=Guid.NewGuid().ToString("N");
        request.Headers.Add("X-Service-Time",timestamp); request.Headers.Add("X-Service-Nonce",nonce); request.Headers.Add("X-Service-Scope",scope);
        request.Headers.Add("X-Service-Signature",ServiceSignature.Sign(secret,path,scope,timestamp,nonce,body));
        request.Headers.Add("X-Correlation-ID",context.HttpContext?.TraceIdentifier ?? Guid.NewGuid().ToString("N"));
        using var response=await http.SendAsync(request,HttpCompletionOption.ResponseHeadersRead,ct);
        await using var stream=await response.Content.ReadAsStreamAsync(ct);
        using var memory=new MemoryStream(); var buffer=new byte[8192];
        while (true) { var count=await stream.ReadAsync(buffer,ct); if (count==0) break; if (memory.Length+count>8388608) throw new KnowledgeException(503,"knowledge_unavailable","Phản hồi kho kiến thức quá lớn."); memory.Write(buffer,0,count); }
        if (!response.IsSuccessStatusCode)
        {
            var status=(int)response.StatusCode;
            if (status is 400 or 404 or 409 or 413)
                throw new KnowledgeException(status,status==409 ? "knowledge_conflict" : "invalid_knowledge",status==409 ? "Tài liệu đã thay đổi hoặc chưa sẵn sàng. Hãy tải lại trước khi tiếp tục." : status==404 ? "Không tìm thấy nguồn đang công bố." : "Dữ liệu không hợp lệ. Chỉ nhận văn bản .txt/.md, tối đa 20.000 ký tự và chứng cứ an toàn phải gắn sản phẩm.");
            throw new KnowledgeException(503,"knowledge_unavailable","Chưa kết nối được kho kiến thức. Vui lòng thử lại.");
        }
        using var document=JsonDocument.Parse(memory.ToArray());
        return document.RootElement.Clone();
    }
    public Task<JsonElement> AdminAsync(string action,JsonElement payload,string actorId,CancellationToken ct) =>
        SendAsync("/internal/knowledge/admin","knowledge:admin",config.Value.KnowledgeAdminSecret,new { action,payload,actorId },ct);
    public async Task<List<KnowledgeExcerpt>> ResolveAsync(List<Guid> ids,string? slug,bool safety,CancellationToken ct)
    {
        if (ids.Count>3) throw new ChatUnavailableException();
        var result=await SendAsync("/internal/knowledge/resolve","knowledge:read",config.Value.GatewaySecret,new { chunkIds=ids,productSlug=slug,safetyOnly=safety },ct);
        var excerpts=result.Deserialize<List<KnowledgeExcerpt>>(Json) ?? throw new ChatUnavailableException();
        if (excerpts.Count>3 || excerpts.Any(e=>e is null || !ids.Contains(e.ChunkId) || string.IsNullOrWhiteSpace(e.Content) || e.Content.Length>1200 || e.Version<1 || string.IsNullOrWhiteSpace(e.Title) || e.Title.Length>180 || string.IsNullOrWhiteSpace(e.Section) || e.Section.Length>180 || (e.ProductSlug!=null && e.ProductSlug!=slug) || (safety && (slug==null || e.ProductSlug!=slug || e.EvidenceType!="safety_evidence")))) throw new ChatUnavailableException();
        return excerpts;
    }
    public async Task FeedbackAsync(KnowledgeFeedback input,CancellationToken ct) =>
        _ = await SendAsync("/internal/knowledge/feedback","knowledge:feedback",config.Value.GatewaySecret,input,ct);
}
