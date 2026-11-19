using System.Globalization;
using System.Text;
using ClayNest.Application.Reports;

namespace ClayNest.Infrastructure.Reports;
public static class ReportCsv
{
    public static string Cell(string value)
    {
        var trimmed=value.TrimStart();
        if (trimmed.Length>0 && "=+-@".Contains(trimmed[0])) value="'"+value;
        return "\""+value.Replace("\"","\"\"")+"\"";
    }
    public static byte[] Write(SalesReport report)
    {
        var text=new StringBuilder();
        void Row(params object?[] fields) => text.Append(string.Join(",",fields.Concat(Enumerable.Repeat<object?>(null,Math.Max(0,13-fields.Length))).Select(f=>f switch { null=>"",string s=>Cell(s),DateOnly d=>d.ToString("yyyy-MM-dd",CultureInfo.InvariantCulture),DateTimeOffset d=>d.ToString("O",CultureInfo.InvariantCulture),IFormattable n=>n.ToString(null,CultureInfo.InvariantCulture),_=>Cell(f.ToString() ?? "") }))).Append("\r\n");
        Row("section","code","label","from","to","count","amount_vnd","sku","product_name","variant_name","stock","threshold","as_of_utc");
        void Metric(string code,string label,int? count,decimal? amount) => Row("summary",code,label,report.Period.From,report.Period.To,count,amount,null,null,null,null,null,report.GeneratedAt);
        Metric("completed_sales","Doanh thu đơn hoàn tất, gồm phí giao hàng",null,report.Metrics.CompletedSalesVnd);
        Metric("product_sales","Giá trị sản phẩm của đơn hoàn tất",null,report.Metrics.ProductSalesVnd);
        Metric("shipping_collected","Phí giao hàng của đơn hoàn tất",null,report.Metrics.ShippingCollectedVnd);
        Metric("completed_orders","Số đơn hoàn tất",report.Metrics.CompletedOrders,null);
        Metric("aov","Giá trị trung bình đơn hoàn tất, N/A nếu trống",null,report.Metrics.AverageOrderValueVnd);
        Metric("gross_placed","Giá trị đơn được đặt, gồm cả đơn hủy; không phải doanh thu",report.Metrics.PlacedOrders,report.Metrics.GrossPlacedOrderValueVnd);
        Metric("low_stock","SKU hoạt động thuộc sản phẩm chưa lưu trữ, tại thời điểm báo cáo",report.LowStockTotal,null);
        Row("metadata","timezone",report.TimeZone,null,null,null,null,null,null,null,null,null,report.GeneratedAt);
        Row("metadata","grain",report.Period.Grain);
        Row("metadata","dataset",report.IsDemo ? "DEMO DATA" : "Dữ liệu vận hành");
        foreach (var point in report.Trend) Row("trend",report.Period.Grain,"Đơn hoàn tất",point.From,point.To,point.CompletedOrders,point.SalesVnd,null,null,null,null,null,report.GeneratedAt);
        foreach (var variant in report.TopVariants) Row("top_variant",variant.VariantId.ToString(),"Số lượng và tiền hàng, không phân bổ phí giao hàng",report.Period.From,report.Period.To,variant.Quantity,variant.ProductSalesVnd,variant.Sku,variant.ProductName,variant.VariantName,null,null,report.GeneratedAt);
        foreach (var variant in report.LowStock) Row("low_stock",variant.VariantId.ToString(),"Tồn kho hiện tại",null,null,null,null,variant.Sku,variant.ProductName,variant.VariantName,variant.StockQty,variant.Threshold,report.GeneratedAt);
        var utf8=new UTF8Encoding(true); return utf8.GetPreamble().Concat(utf8.GetBytes(text.ToString())).ToArray();
    }
}
