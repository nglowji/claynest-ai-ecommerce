using System.Globalization;
using ClayNest.Application.AdminAi;
using ClayNest.Application.Reports;
using ClayNest.Infrastructure.Chat;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace ClayNest.Infrastructure.AdminAi;

public sealed class AdminAiSnapshot(IReportService reports, CommerceDbContext db, TimeProvider clock) : IAdminAiSnapshot
{
    private static readonly CultureInfo Vi = CultureInfo.GetCultureInfo("vi-VN");
    private static string Money(decimal value) => value.ToString("N2", Vi).TrimEnd('0').TrimEnd(',') + " ₫";
    public async Task<AdminAiContext> GetAsync(AdminAiRequest request, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(clock.GetUtcNow().ToOffset(TimeSpan.FromHours(7)).DateTime);
        var report = await reports.GetAsync(new(today.AddDays(1 - request.Days), today), ct);
        // Project counts only: names, shipping details and order access tokens never enter LLM context.
        var counts = await db.Orders.AsNoTracking().GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Status, x => x.Count, ct);
        var metrics = report.Metrics;
        var url = $"/admin/reports?from={report.Period.From:yyyy-MM-dd}&to={report.Period.To:yyyy-MM-dd}&grain=day";
        var facts = new List<AdminAiFact>
        {
            new("sales", "Doanh thu hoàn tất", Money(metrics.CompletedSalesVnd), "Gồm phí giao hàng, theo ngày hoàn tất trong kỳ. Xem báo cáo để đối chiếu trước khi quyết định.", url),
            new("completed", "Đơn hoàn tất", metrics.CompletedOrders.ToString("N0", Vi), "Số đơn hoàn tất trong kỳ đã chọn.", url),
            new("average", "Giá trị đơn trung bình", metrics.AverageOrderValueVnd is { } average ? Money(average) : "Chưa có đơn hoàn tất", "Tính trên đơn hoàn tất; không phải lợi nhuận.", url),
            new("placed", "Đơn đặt mới", metrics.PlacedOrders.ToString("N0", Vi), "Theo ngày đặt trong kỳ, gồm cả đơn hủy.", url),
            new("gross", "Giá trị đơn đặt mới", Money(metrics.GrossPlacedOrderValueVnd), "Gồm cả đơn đã hủy; không dùng thay doanh thu hoàn tất.", url),
            new("low-stock", "SKU cần chú ý", report.LowStockTotal.ToString("N0", Vi), "Tồn kho hiện tại chạm ngưỡng cảnh báo. Kiểm tra kho trước khi nhập thêm.", "/admin/inventory?lowOnly=true"),
        };
        foreach (var (status, label, detail) in new[]
        {
            ("pending", "Chờ xác nhận", "Ưu tiên kiểm tra và xác nhận các đơn mới."),
            ("confirmed", "Cần đóng gói", "Chuẩn bị sản phẩm và đóng gói chống vỡ."),
            ("packed", "Chờ bàn giao", "Kiểm tra kiện hàng trước khi giao vận chuyển."),
            ("shipped", "Đang giao hàng", "Theo dõi giao hàng; chỉ hoàn tất khi đã giao và xác nhận thanh toán COD/ZaloPay."),
        }) facts.Add(new(status, label, counts.GetValueOrDefault(status).ToString("N0", Vi),
            "Tất cả đơn hiện tại, không giới hạn theo kỳ. " + detail, "/admin/orders?status=" + status));
        foreach (var item in report.LowStock.Take(3))
            facts.Add(new("stock-" + item.VariantId, item.ProductName + " · " + item.Sku,
                "Còn " + item.StockQty.ToString("N0", Vi), "Ngưỡng cảnh báo " + item.Threshold + ". Kiểm kê và xem lịch sử trước khi điều chỉnh.",
                "/admin/inventory?q=" + Uri.EscapeDataString(item.Sku)));
        foreach (var item in report.TopVariants.Take(3))
            facts.Add(new("top-" + item.VariantId, item.ProductName + " · " + item.Sku,
                item.Quantity.ToString("N0", Vi) + " món", "Số lượng bán trong đơn hoàn tất của kỳ; cân nhắc theo dõi tồn trước khi bổ sung hàng.", url));
        facts.AddRange(await DatabaseDiagnostics.ReadAsync(db, reports, report.Period, metrics.CompletedSalesVnd, clock.GetUtcNow(), ct));
        return new(ChatService.Redact(request.Message.Trim()), report.Period.From, report.Period.To,
            clock.GetUtcNow(), report.IsDemo, facts, AdminAiGuides.All.ToList());
    }
}
