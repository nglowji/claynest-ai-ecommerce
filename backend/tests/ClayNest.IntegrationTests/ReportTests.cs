using System.Net;
using System.Net.Http.Json;
using System.Text;
using ClayNest.Application.Reports;
using ClayNest.Domain.Catalog;
using ClayNest.Domain.Orders;
using ClayNest.Infrastructure.Persistence;
using ClayNest.Infrastructure.Reports;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace ClayNest.IntegrationTests;
public sealed class ReportTests
{
    private static readonly ShippingContact PrivateContact=new("PRIVATE-REPORT-SENTINEL","0901234567","private-report@example.test","Private province","PRIVATE REPORT ADDRESS MUST NOT BE EXPORTED","");
    private static Order Order(Guid variant,DateTimeOffset created,DateTimeOffset? completed,int quantity,long price,long shipping,string label="Historical product",bool cancelled=false)
    {
        var hash=new string('a',64); var order=new Order("R8-"+Guid.NewGuid().ToString("N")[..24],null,PrivateContact,shipping,Guid.NewGuid(),hash,hash,"",created);
        order.AddItem(variant,"R8-HISTORY",label,"Historical variant","",quantity,price);
        if (completed is {} time) foreach(var status in new[]{"confirmed","packed","shipped","completed"}) order.TransitionTo(status,status=="completed",time);
        if (cancelled) { order.TransitionTo("cancelled",false,created.AddMinutes(1)); order.MarkRestocked(); }
        return order;
    }
    private static async Task<SalesReport> Get(CheckoutTests.Fixture fixture,ReportQuery query)
    {
        await using var scope=fixture.Factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<IReportService>().GetAsync(query,CancellationToken.None);
    }
    [DatabaseFact]
    public async Task Completed_period_uses_vietnam_boundaries_excludes_cancelled_and_matches_reference_sql()
    {
        await using var s=await CheckoutTests.Fixture.Create(30);
        var start=DateTimeOffset.Parse("2040-03-30T17:00:00Z"); var end=start.AddDays(1);
        await s.WithDb(async db=>
        {
            db.Orders.AddRange(
                Order(s.VariantId,start.AddDays(-1),start,2,100000,30000),
                Order(s.VariantId,start.AddHours(8),end.AddTicks(-10),1,300000,0,"=UNTRUSTED()"),
                Order(s.VariantId,start.AddHours(9),null,1,100000,30000),
                Order(s.VariantId,start.AddHours(10),null,1,100000,30000,cancelled:true),
                Order(s.VariantId,start.AddHours(-2),start.AddTicks(-10),1,500000,0),
                Order(s.VariantId,start.AddHours(11),end,1,9999,0));
            await db.SaveChangesAsync();
            Assert.False(db.Database.HasPendingModelChanges());
            Assert.Contains("20261119090000_AddCompletedReportIndex",await db.Database.GetAppliedMigrationsAsync());
        });
        var report=await Get(s,new(new(2040,3,31),new(2040,3,31)));
        Assert.Equal(530000,report.Metrics.CompletedSalesVnd); Assert.Equal(500000,report.Metrics.ProductSalesVnd);
        Assert.Equal(30000,report.Metrics.ShippingCollectedVnd); Assert.Equal(2,report.Metrics.CompletedOrders); Assert.Equal(265000m,report.Metrics.AverageOrderValueVnd);
        Assert.Equal(569999,report.Metrics.GrossPlacedOrderValueVnd); Assert.Equal(4,report.Metrics.PlacedOrders);
        var top=Assert.Single(report.TopVariants); Assert.Equal(3,top.Quantity); Assert.Equal(500000,top.ProductSalesVnd); Assert.Equal("=UNTRUSTED()",top.ProductName);
        var point=Assert.Single(report.Trend); Assert.Equal(530000,point.SalesVnd); Assert.Equal(2,point.CompletedOrders);
        await s.WithDb(async db=>
        {
            var expected=await db.Database.SqlQuery<long>($"""SELECT coalesce(sum("GrandTotalVnd"),0)::bigint AS "Value" FROM commerce."Orders" WHERE "Status"='completed' AND "CompletedAt">={start} AND "CompletedAt"<{end}""").SingleAsync();
            Assert.Equal(expected,report.Metrics.CompletedSalesVnd);
        });
        var csv=Encoding.UTF8.GetString(ReportCsv.Write(report));
        Assert.Contains("530000",csv); Assert.Contains("\"'=UNTRUSTED()\"",csv);
        Assert.DoesNotContain(PrivateContact.Name,csv); Assert.DoesNotContain(PrivateContact.Email,csv); Assert.DoesNotContain(PrivateContact.Phone,csv); Assert.DoesNotContain(PrivateContact.Address,csv);
    }
    [DatabaseFact]
    public async Task Weekly_monthly_and_empty_reports_fill_zero_buckets_and_do_not_invent_aov()
    {
        await using var s=await CheckoutTests.Fixture.Create(30);
        await s.WithDb(async db=>
        {
            db.Orders.Add(Order(s.VariantId,DateTimeOffset.Parse("2041-01-29T00:00:00Z"),DateTimeOffset.Parse("2041-01-31T17:00:00Z"),1,100000,30000));
            await db.SaveChangesAsync();
        });
        var monthly=await Get(s,new(new(2041,1,30),new(2041,3,2),"month"));
        Assert.Equal(3,monthly.Trend.Count); Assert.Equal(new DateOnly(2041,1,30),monthly.Trend[0].From); Assert.Equal(0,monthly.Trend[0].SalesVnd);
        Assert.Equal(130000,monthly.Trend[1].SalesVnd); Assert.Equal(0,monthly.Trend[2].SalesVnd); Assert.Equal(new DateOnly(2041,3,2),monthly.Trend[2].To);
        var weekly=await Get(s,new(new(2041,1,30),new(2041,2,10),"week"));
        Assert.All(weekly.Trend,b=>Assert.Equal(DayOfWeek.Monday,b.BucketStart.DayOfWeek)); Assert.Equal(130000,weekly.Trend.Sum(p=>p.SalesVnd));
        var empty=await Get(s,new(new(2049,4,1),new(2049,4,3)));
        await s.WithDb(async db=>
        {
            var time=DateTimeOffset.Parse("2050-01-01T03:00:00Z");
            foreach (var price in new long[]{100000,100000,100001}) db.Orders.Add(Order(s.VariantId,time.AddHours(-1),time,1,price,0));
            await db.SaveChangesAsync();
        });
        var fractional=await Get(s,new(new(2050,1,1),new(2050,1,1)));
        Assert.Equal(100000.33m,fractional.Metrics.AverageOrderValueVnd);
        Assert.Null(empty.Metrics.AverageOrderValueVnd); Assert.Empty(empty.TopVariants); Assert.All(empty.Trend,b=>Assert.Equal(0,b.SalesVnd)); Assert.Equal(3,empty.Trend.Count);
    }
    [DatabaseFact]
    public async Task Historical_sales_survive_catalog_archive_and_low_stock_is_current_active_inventory()
    {
        await using var s=await CheckoutTests.Fixture.Create(3);
        var completed=DateTimeOffset.Parse("2042-05-01T04:00:00Z");
        await s.WithDb(async db=> { db.Orders.Add(Order(s.VariantId,completed.AddDays(-1),completed,2,120000,30000)); await db.SaveChangesAsync(); });
        var report=await Get(s,new(new(2042,5,1),new(2042,5,1)));
        Assert.Contains(report.LowStock,v=>v.VariantId==s.VariantId && v.StockQty==3 && v.Threshold==5);
        await s.WithDb(async db=> { var product=await db.Products.SingleAsync(p=>p.Id==s.ProductId); product.Archive(); await db.SaveChangesAsync(); });
        var archived=await Get(s,new(new(2042,5,1),new(2042,5,1)));
        Assert.DoesNotContain(archived.LowStock,v=>v.VariantId==s.VariantId);
        Assert.Equal(report.Metrics,archived.Metrics); Assert.Contains(archived.TopVariants,v=>v.VariantId==s.VariantId && v.ProductName=="Historical product");
    }
}
