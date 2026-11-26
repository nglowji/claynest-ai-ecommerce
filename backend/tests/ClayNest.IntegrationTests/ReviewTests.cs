using System.Net;
using System.Net.Http.Json;
using ClayNest.Application.Reviews;
using Microsoft.AspNetCore.Mvc.Testing;
namespace ClayNest.IntegrationTests;
public sealed class ReviewTests
{
    [DatabaseFact]
    public async Task Reviews_require_a_completed_owned_purchase_and_update_without_duplicates()
    {
        await using var s = await CheckoutTests.Fixture.Create(5);
        using var guest = s.Factory.CreateClient(new WebApplicationFactoryClientOptions {BaseAddress = new("https://localhost")});
        var path = $"/api/v1/products/{s.ProductId}/reviews";
        using var denied = await guest.PutAsJsonAsync(path + "/mine", new ReviewInput(5, "Sản phẩm rất đẹp."));
        Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
        var owner = await s.LoginCustomer();
        async Task<HttpResponseMessage> Save(int rating = 5, string comment = "Sản phẩm rất đẹp, đóng gói cẩn thận.", string? csrf = null) {
            using var request = new HttpRequestMessage(HttpMethod.Put, path + "/mine") {Content = JsonContent.Create(new ReviewInput(rating, comment))};
            request.Headers.Add("X-CSRF-TOKEN", csrf ?? await s.Csrf()); return await s.Client.SendAsync(request);
        }
        using var noPurchase = await Save(); Assert.Equal(HttpStatusCode.Forbidden, noPurchase.StatusCode);
        var quote = await s.Quote(1); using var placed = await s.Post("/api/v1/orders", s.Command(quote), Guid.NewGuid());
        Assert.Equal(HttpStatusCode.Created, placed.StatusCode);
        using var pending = await Save(); Assert.Equal(HttpStatusCode.Forbidden, pending.StatusCode);
        await s.WithDb(async db => {
            var order = db.Orders.Single(o => o.CustomerId == owner);
            foreach (var status in new[] {"confirmed", "packed", "shipped", "completed"}) order.TransitionTo(status, true, DateTimeOffset.UtcNow);
            await db.SaveChangesAsync();
        });
        using var badCsrf = await Save(csrf: "invalid"); Assert.Equal(HttpStatusCode.BadRequest, badCsrf.StatusCode);
        using var invalid = await Save(6); Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        using var created = await Save(); Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var review = (await created.Content.ReadFromJsonAsync<ReviewRow>())!;
        using var updated = await Save(4, "Sản phẩm đẹp, chất men và màu sắc hài hòa."); Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal(review.Id, (await updated.Content.ReadFromJsonAsync<ReviewRow>())!.Id);
        var list = (await guest.GetFromJsonAsync<ProductReviews>(path + "/"))!;
        Assert.Equal(1, list.TotalCount); Assert.Equal(4m, list.AverageRating); Assert.True(Assert.Single(list.Reviews.Items).VerifiedPurchase);
        Assert.DoesNotContain("@", list.Reviews.Items[0].AuthorName);
        Assert.Equal(0, (await guest.GetFromJsonAsync<ProductReviews>(path + "/?rating=5"))!.Reviews.TotalCount);
        Assert.True((await s.Client.GetFromJsonAsync<MyReview>(path + "/mine"))!.Eligible);
        await s.LoginCustomer();
        using var other = await Save(); Assert.Equal(HttpStatusCode.Forbidden, other.StatusCode);
        using var badPage = await guest.GetAsync(path + "/?page=0"); Assert.Equal(HttpStatusCode.BadRequest, badPage.StatusCode);
        using var missing = await guest.GetAsync($"/api/v1/products/{Guid.NewGuid()}/reviews/"); Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }
}
