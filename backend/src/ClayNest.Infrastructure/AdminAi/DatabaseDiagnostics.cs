using System.Globalization;
using ClayNest.Application.AdminAi;
using ClayNest.Application.Reports;
using ClayNest.Domain.Catalog;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace ClayNest.Infrastructure.AdminAi;

public static class DatabaseDiagnostics
{
    public static async Task<List<AdminAiFact>> ReadAsync(CommerceDbContext db, IReportService reports,
        ReportPeriod period, long sales, DateTimeOffset now, CancellationToken ct)
    {
        var vi = CultureInfo.GetCultureInfo("vi-VN");
        var previous = await reports.GetAsync(new(period.From.AddDays(-(period.To.DayNumber - period.From.DayNumber + 1)), period.From.AddDays(-1)), ct);
        var prior = previous.Metrics.CompletedSalesVnd;
        var change = prior == 0 ? "Chưa có nền so sánh" : (((decimal)sales - prior) / prior * 100).ToString("N2", vi) + "%";
        var placed = db.Orders.AsNoTracking().Where(o => o.CreatedAt >= period.FromUtc && o.CreatedAt < period.ToExclusiveUtc);
        var placedCount = await placed.CountAsync(ct);
        var cancelled = await placed.CountAsync(o => o.Status == "cancelled", ct);
        var cutoff = now.AddHours(-24);
        var stalled = await db.Orders.AsNoTracking().CountAsync(o => o.Status == "pending" && o.CreatedAt < cutoff, ct);
        var variants = db.Set<ProductVariant>().AsNoTracking().Where(v => v.Active && !db.Products.Any(p => p.Id == v.ProductId && p.Archived));
        var empty = await variants.CountAsync(v => v.StockQty == 0, ct);
        var drafts = await db.Products.AsNoTracking().CountAsync(p => !p.Archived && !p.Published, ct);
        var sold = db.Orders.AsNoTracking().Where(o => o.Status == "completed" && o.CompletedAt >= period.FromUtc && o.CompletedAt < period.ToExclusiveUtc)
            .SelectMany(o => o.Items).Select(i => i.VariantId);
        var unsold = variants.Where(v => v.StockQty > 0 && !sold.Contains(v.Id));
        var unsoldCount = await unsold.CountAsync(ct);
        var facts = new List<AdminAiFact>
        {
            new("sales-change", "Doanh thu so với kỳ trước", change, "So sánh hai kỳ bằng nhau theo ngày hoàn tất; kỳ trước " + previous.Period.From + " đến " + previous.Period.To + ". Không suy ra nguyên nhân từ biến động này.", "/admin/reports"),
            new("previous-sales", "Doanh thu kỳ trước", prior.ToString("N0", vi) + " ₫", "Kỳ liền trước có cùng số ngày, gồm phí giao hàng đã thu.", "/admin/reports"),
            new("cancellation-rate", "Tỷ lệ hủy của đơn đặt trong kỳ", placedCount == 0 ? "Chưa có đơn đặt" : ((decimal)cancelled / placedCount * 100).ToString("N2", vi) + "%", cancelled + " đơn đã hủy trên " + placedCount + " đơn đặt trong kỳ. Trạng thái tính tại thời điểm truy vấn; xem lý do hủy trước khi kết luận.", "/admin/orders?status=cancelled"),
            new("stalled-orders", "Đơn chờ xác nhận quá 24 giờ", stalled.ToString("N0", vi), "Toàn bộ hàng đợi hiện tại; ưu tiên kiểm tra đơn cũ và thông tin xử lý trước khi xác nhận.", "/admin/orders?status=pending"),
            new("out-of-stock", "Biến thể đang hết hàng", empty.ToString("N0", vi), "Biến thể hoạt động của sản phẩm chưa lưu trữ, tồn bằng không. Đối chiếu nhu cầu trước khi nhập hàng.", "/admin/inventory?lowOnly=true"),
            new("unsold-stock", "SKU có tồn, chưa có đơn hoàn tất trong kỳ", unsoldCount.ToString("N0", vi), "Đây là dấu hiệu cần xem xét, không chứng minh hàng tồn lâu: có thể là sản phẩm mới hoặc có đơn đang giao.", "/admin/inventory"),
            new("draft-products", "Sản phẩm chưa xuất bản", drafts.ToString("N0", vi), "Sản phẩm chưa lưu trữ và chưa xuất bản. Kiểm tra ảnh, biến thể và mô tả trước khi công bố.", "/admin/products"),
        };
        return facts;
    }
}
