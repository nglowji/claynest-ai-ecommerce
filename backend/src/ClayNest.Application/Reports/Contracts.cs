using System.Text.Json.Serialization;
namespace ClayNest.Application.Reports;

public sealed record ReportQuery(DateOnly? From=null, DateOnly? To=null, string Grain="day");
public sealed record ReportPeriod(DateOnly From, DateOnly To, string Grain, DateTimeOffset FromUtc, DateTimeOffset ToExclusiveUtc)
{
    public static ReportPeriod Create(ReportQuery query,DateTimeOffset now)
    {
        var today=DateOnly.FromDateTime(now.ToOffset(TimeSpan.FromHours(7)).DateTime);
        var from=query.From ?? today.AddDays(-29); var to=query.To ?? today;
        if (query.Grain is not ("day" or "week" or "month") || from>to || to.DayNumber-from.DayNumber>=366 || from.Year<2000 || to.Year>2100)
            throw new ReportValidationException("Chọn khoảng ngày hợp lệ, tối đa 366 ngày và nhóm theo ngày, tuần hoặc tháng.");
        DateTimeOffset Boundary(DateOnly date) => new DateTimeOffset(date.ToDateTime(TimeOnly.MinValue,DateTimeKind.Unspecified),TimeSpan.FromHours(7)).ToUniversalTime();
        return new(from,to,query.Grain,Boundary(from),Boundary(to.AddDays(1)));
    }
    public DateOnly Bucket(DateOnly date) => Grain switch
    {
        "week" => date.AddDays(-(((int)date.DayOfWeek+6)%7)),
        "month" => new(date.Year,date.Month,1),
        _ => date
    };
    public DateOnly Next(DateOnly bucket) => Grain switch { "week"=>bucket.AddDays(7), "month"=>bucket.AddMonths(1), _=>bucket.AddDays(1) };
}
public sealed record ReportMetrics([property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)] long CompletedSalesVnd,[property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)] long ProductSalesVnd,[property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)] long ShippingCollectedVnd,int CompletedOrders,[property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)] decimal? AverageOrderValueVnd,[property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)] long GrossPlacedOrderValueVnd,int PlacedOrders);
public sealed record SalesBucket(DateOnly BucketStart,DateOnly From,DateOnly To,[property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)] long SalesVnd,int CompletedOrders);
public sealed record TopVariant(Guid VariantId,string Sku,string ProductName,string VariantName,[property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)] long Quantity,[property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)] long ProductSalesVnd);
public sealed record LowStockVariant(Guid VariantId,string Sku,string ProductName,string VariantName,int StockQty,int Threshold);
public sealed record SalesReport(ReportPeriod Period,DateTimeOffset GeneratedAt,string TimeZone,bool IsDemo,ReportMetrics Metrics,List<SalesBucket> Trend,List<TopVariant> TopVariants,int LowStockTotal,List<LowStockVariant> LowStock);
public sealed class ReportValidationException(string message) : Exception(message);
public interface IReportService { Task<SalesReport> GetAsync(ReportQuery query,CancellationToken ct); }
