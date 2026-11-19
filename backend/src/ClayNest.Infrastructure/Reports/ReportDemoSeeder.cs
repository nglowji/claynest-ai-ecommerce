using ClayNest.Domain.Catalog;
using ClayNest.Domain.Inventory;
using ClayNest.Domain.Orders;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace ClayNest.Infrastructure.Reports;
public sealed class ReportDemoSeeder(CommerceDbContext db,TimeProvider clock,IOptions<ReportOptions> options)
{
    public async Task SeedAsync(CancellationToken ct)
    {
        var connection=new NpgsqlConnectionStringBuilder(db.Database.GetDbConnection().ConnectionString);
        if (!options.Value.IsDemo || connection.Host!="db-test" || connection.Database!="claynest_test")
            throw new InvalidOperationException("DEMO DATA seeding requires the isolated db-test/claynest_test database and Reports:IsDemo=true.");
        await using var tx=await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(742019008)",ct);
        const string slug="demo-data-report-fixture";
        if (await db.Products.AnyAsync(p=>p.Slug==slug,ct)) { await tx.CommitAsync(ct); return; }
        var category=new Category("DEMO DATA · Báo cáo",slug,false);
        var product=new Product(); product.Update(category.Id,"DEMO DATA · Gốm báo cáo",slug,"DEMO DATA — isolated reporting fixtures, not operating orders.","","Gốm","","",false);
        var variant=new ProductVariant(product.Id,50); variant.Update("DEMO-REPORT-CUP","DEMO DATA","Xanh","Trang trí",300,null,10,null,120000,null,true,"","",false); variant.ChangeStock(0,35); product.Variants.Add(variant);
        db.Categories.Add(category); db.Products.Add(product);
        db.StockMovements.Add(new(variant.Id,"opening",50,50,35,"DEMO DATA · opening",null,"DEMO DATA"));
        var today=DateOnly.FromDateTime(clock.GetUtcNow().ToOffset(TimeSpan.FromHours(7)).DateTime);
        var actor=Guid.NewGuid(); var hash=new string('a',64);
        for (var i=1;i<=10;i++)
        {
            var completed=new DateTimeOffset(today.AddDays(-i).ToDateTime(new TimeOnly(10,0)),TimeSpan.FromHours(7)).ToUniversalTime();
            var order=new Order("DEMO-"+today.ToString("yyyyMMdd")+"-"+i,null,new("DEMO DATA","0900000000","demo@example.invalid","DEMO DATA","DEMO DATA - isolated test address","DEMO DATA"),30000,Guid.NewGuid(),hash,hash,"",completed.AddDays(-1));
            var quantity=i<=8 ? 1+i%3 : 2;
            order.AddItem(variant.Id,variant.Sku,product.Name,variant.Name,"",quantity,120000+i*10000);
            db.Orders.Add(order); db.OrderStatusChanges.Add(new(order.Id,0,"","pending","DEMO DATA · created",null,"DEMO DATA",order.CreatedAt));
            variant.ChangeStock(-quantity); db.StockMovements.Add(new(variant.Id,"sale",-quantity,variant.StockQty,35,"DEMO DATA · sale",null,"DEMO DATA",order.Id));
            void Change(string target)
            {
                var from=order.Status; order.TransitionTo(target,target=="completed",completed);
                db.OrderStatusChanges.Add(new(order.Id,order.Revision,from,target,"DEMO DATA · "+target,actor,"DEMO DATA",completed,Guid.NewGuid(),hash));
            }
            if (i<=8) foreach (var state in new[] { "confirmed","packed","shipped","completed" }) Change(state);
            if (i==10) { Change("cancelled"); order.MarkRestocked(); variant.ChangeStock(quantity); db.StockMovements.Add(new(variant.Id,"restock",quantity,variant.StockQty,35,"DEMO DATA · restock",null,"DEMO DATA",order.Id)); }
        }
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
}
