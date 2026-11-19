using System.Data;
using ClayNest.Application.Reports;
using ClayNest.Domain.Catalog;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ClayNest.Infrastructure.Reports;

public sealed class ReportOptions { public bool IsDemo { get; set; } }
public sealed class ReportService(CommerceDbContext db,TimeProvider clock,IOptions<ReportOptions> options) : IReportService
{
    private sealed class TrendRow { public DateOnly Bucket { get; set; } public long SalesVnd { get; set; } public int Orders { get; set; } }
    private sealed class TopRow
    {
        public Guid VariantId { get; set; } public string Sku { get; set; }=""; public string ProductName { get; set; }="";
        public string VariantName { get; set; }=""; public long Quantity { get; set; } public long ProductSalesVnd { get; set; }
    }
    public async Task<SalesReport> GetAsync(ReportQuery query,CancellationToken ct)
    {
        var generated=clock.GetUtcNow(); var period=ReportPeriod.Create(query,generated);
        // All sections use the same database snapshot while fulfilment can continue concurrently.
        await using var transaction=await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead,ct);
        await db.Database.ExecuteSqlRawAsync("SET TRANSACTION READ ONLY",ct);
        var completed=db.Orders.AsNoTracking().Where(o=>o.Status=="completed" && o.CompletedAt>=period.FromUtc && o.CompletedAt<period.ToExclusiveUtc);
        var totals=await completed.GroupBy(_=>1).Select(g=>new { Sales=g.Sum(o=>o.GrandTotalVnd), Products=g.Sum(o=>o.SubtotalVnd), Shipping=g.Sum(o=>o.ShippingFeeVnd), Count=g.Count() }).SingleOrDefaultAsync(ct);
        var placed=await db.Orders.AsNoTracking().Where(o=>o.CreatedAt>=period.FromUtc && o.CreatedAt<period.ToExclusiveUtc).GroupBy(_=>1).Select(g=>new { Total=g.Sum(o=>o.GrandTotalVnd), Count=g.Count() }).SingleOrDefaultAsync(ct);
        var rows=await db.Database.SqlQuery<TrendRow>($"""
            SELECT date_trunc({period.Grain}, "CompletedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS "Bucket",
              sum("GrandTotalVnd")::bigint AS "SalesVnd",count(*)::integer AS "Orders"
            FROM commerce."Orders"
            WHERE "Status"='completed' AND "CompletedAt">={period.FromUtc} AND "CompletedAt"<{period.ToExclusiveUtc}
            GROUP BY 1 ORDER BY 1
            """).ToListAsync(ct);
        var top=await db.Database.SqlQuery<TopRow>($"""
            WITH lines AS (
              SELECT i.*,o."CompletedAt" FROM commerce."OrderItems" i JOIN commerce."Orders" o ON o."Id"=i."OrderId"
              WHERE o."Status"='completed' AND o."CompletedAt">={period.FromUtc} AND o."CompletedAt"<{period.ToExclusiveUtc}
            ), totals AS (
              SELECT "VariantId",sum("Quantity")::bigint AS "Quantity",sum("LineTotalVnd")::bigint AS "ProductSalesVnd" FROM lines GROUP BY "VariantId"
            ), labels AS (
              SELECT DISTINCT ON ("VariantId") "VariantId","Sku","ProductName","VariantName" FROM lines
              ORDER BY "VariantId","CompletedAt" DESC,"OrderId" DESC,"Id" DESC
            )
            SELECT t."VariantId",l."Sku",l."ProductName",l."VariantName",t."Quantity",t."ProductSalesVnd"
            FROM totals t JOIN labels l USING ("VariantId")
            ORDER BY t."Quantity" DESC,t."ProductSalesVnd" DESC,t."VariantId" LIMIT 10
            """).ToListAsync(ct);
        var stock=from v in db.Set<ProductVariant>().AsNoTracking()
                  join p in db.Products.AsNoTracking() on v.ProductId equals p.Id
                  where v.Active && !p.Archived && v.StockQty<=v.LowStockThreshold
                  select new { Variant=v,Product=p };
        var lowCount=await stock.CountAsync(ct);
        var low=await stock.OrderBy(x=>x.Variant.StockQty).ThenBy(x=>x.Variant.Sku).ThenBy(x=>x.Variant.Id).Take(10)
            .Select(x=>new LowStockVariant(x.Variant.Id,x.Variant.Sku,x.Product.Name,x.Variant.Name,x.Variant.StockQty,x.Variant.LowStockThreshold)).ToListAsync(ct);
        var byBucket=rows.ToDictionary(r=>r.Bucket); var trend=new List<SalesBucket>();
        for (var bucket=period.Bucket(period.From);bucket<=period.To;bucket=period.Next(bucket))
        {
            byBucket.TryGetValue(bucket,out var row);
            var end=period.Next(bucket).AddDays(-1);
            trend.Add(new(bucket,bucket<period.From ? period.From : bucket,end>period.To ? period.To : end,row?.SalesVnd ?? 0,row?.Orders ?? 0));
        }
        var count=totals?.Count ?? 0; var sales=totals?.Sales ?? 0;
        var metrics=new ReportMetrics(sales,totals?.Products ?? 0,totals?.Shipping ?? 0,count,count==0 ? null : decimal.Round((decimal)sales/count,2,MidpointRounding.AwayFromZero),placed?.Total ?? 0,placed?.Count ?? 0);
        await transaction.CommitAsync(ct);
        return new(period,generated,"Asia/Ho_Chi_Minh",options.Value.IsDemo,metrics,trend,top.Select(t=>new TopVariant(t.VariantId,t.Sku,t.ProductName,t.VariantName,t.Quantity,t.ProductSalesVnd)).ToList(),lowCount,low);
    }
}
