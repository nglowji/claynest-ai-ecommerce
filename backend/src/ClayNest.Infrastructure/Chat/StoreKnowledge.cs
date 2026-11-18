using ClayNest.Application.Chat;
using ClayNest.Domain.Orders;

namespace ClayNest.Infrastructure.Chat;

// Reviewed public facts only. Changes are reviewed together with the implemented store flow.
// Never ingest repository files, environment variables, customer records or admin credentials.
public static class StoreKnowledge
{
    public const string Version = "2026-11-18.1";
    public static IReadOnlyList<KnowledgeArticle> Articles { get; } = Array.AsReadOnly(new[]
    {
        Article("about", "Về Nàng Gốm", "Nàng Gốm là cửa hàng đồ gốm cho không gian sống: cốc và tách, bình hoa, bát đĩa, bộ sưu tập và gốm trang trí. Bạn có thể khám phá sản phẩm, câu chuyện và những góc nhà trên website.", "/"),
        Article("catalog", "Chọn và tìm sản phẩm", "Vào trang Sản phẩm để tìm theo tên, danh mục và khoảng giá. Mở từng sản phẩm để xem biến thể, hình ảnh, chất liệu, men, kích thước, dung tích, giá và tình trạng còn hàng. Giá và tồn kho được kiểm tra lại lúc đặt hàng; không phải sản phẩm nào cũng có đủ mọi thông số.", "/products"),
        Article("cart", "Giỏ hàng", "Chọn sản phẩm và biến thể, nhập số lượng rồi thêm vào giỏ. Bạn có thể tăng giảm số lượng hoặc xóa món trong giỏ trước khi thanh toán. Giỏ hàng lưu trên trình duyệt đang dùng; thêm vào giỏ chưa giữ chỗ tồn kho.", "/cart"),
        Article("checkout", "Cách đặt hàng", "Bạn có thể đặt hàng với tư cách khách hoặc đăng nhập tài khoản. Từ giỏ hàng, đến thanh toán, nhập thông tin người nhận và địa chỉ giao hàng, kiểm tra sản phẩm cùng tổng tiền, xác nhận điều kiện rồi đặt hàng. Báo giá có hiệu lực 5 phút; nếu giá hoặc tồn kho thay đổi, hệ thống yêu cầu kiểm tra lại trước khi xác nhận.", "/cart"),
        Article("payment", "Thanh toán COD", "Website hiện hỗ trợ COD: thanh toán khi nhận hàng. Đặt hàng thành công không có nghĩa đã thanh toán. Chưa có thanh toán thẻ, chuyển khoản tự động, ví điện tử hoặc hoàn tiền trực tuyến trong luồng hiện tại.", "/cart"),
        Article("shipping", "Giao hàng và đóng gói", CommercePolicy.ShippingDescription + " " + CommercePolicy.PackingDescription, "/cart"),
        Article("tracking", "Theo dõi đơn hàng", "Đăng nhập tài khoản đã đặt đơn để xem đơn của bạn, hoặc vào trang Tra cứu đơn hàng và dùng mã đơn cùng mã truy cập riêng được cấp sau khi đặt. Giữ kín mã truy cập; chỉ có mã đơn sẽ không xem được thông tin riêng tư. Chat không tra cứu thông tin người nhận hay thay đổi đơn hàng.", "/orders"),
        Article("order-status", "Trạng thái đơn hàng", "Đơn lần lượt có thể ở trạng thái chờ xác nhận, đã xác nhận, đã đóng gói, đang giao và hoàn tất. Cửa hàng xử lý trạng thái và xác nhận thu tiền COD khi hoàn tất. Đơn chờ xác nhận hoặc đã xác nhận có thể được cửa hàng hủy; chưa có chức năng tự hủy đơn dành cho khách trong chat.", "/orders"),
        Article("account", "Đăng nhập và tài khoản", "Trang đăng nhập có lựa chọn đăng ký bằng họ tên, email và mật khẩu. Mật khẩu tối thiểu 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt. Đăng nhập bằng email và mật khẩu; khách hàng vào trang tài khoản, quản trị viên vào trang quản trị theo quyền được cấp. Trang tài khoản hiển thị hồ sơ và liên kết đơn hàng. Chưa có luồng tự đặt lại mật khẩu qua email.", "/login"),
        Article("location", "Địa điểm và bản đồ", "Trang chủ có bản đồ một điểm gần Đại học Trà Vinh. Đây chưa phải địa chỉ cửa hàng đã được xác minh; không xem điểm ghim là Đại học Trà Vinh hoặc địa chỉ nhận hàng chính thức. Chưa có giờ mở cửa hay số điện thoại được xác minh để cung cấp.", "/#location"),
        Article("returns", "Đổi trả và bảo hành", "Cửa hàng chưa công bố chính sách đổi trả, thời hạn bảo hành hay quy trình hoàn tiền đã được xác minh trong nguồn kiến thức hiện tại. Nàng chưa thể hứa thời hạn hoặc điều kiện cụ thể. Bạn nên xác nhận trực tiếp với cửa hàng trước khi mua nếu cần điều kiện này.", "/products"),
        Article("safety", "Thông tin an toàn và sử dụng", "Nàng chưa có đủ thông tin kiểm chứng. Nguồn hiện tại chưa có chứng nhận kiểm chứng về an toàn thực phẩm, không chì, lò vi sóng, máy rửa bát hoặc giới hạn chịu nhiệt cho từng sản phẩm. Chất liệu hay tên men không đủ để khẳng định các khả năng đó. Nàng sẽ không tự suy luận hoặc đưa ra bảo đảm an toàn khi thiếu chứng cứ.", "/products"),
        Article("assistant", "Nàng có thể giúp gì?", "Nàng hỗ trợ tìm sản phẩm theo ngân sách, danh mục, sắc men, kích thước, dung tích và dịp tặng; giải thích thông tin sản phẩm đã công bố và cách dùng website. Giá, tồn kho lấy từ catalog hiện tại. Nàng không đọc mật khẩu, tài khoản người khác, thông tin đơn riêng, không sửa kho, tự đặt hay hủy đơn và không cung cấp thông tin vận hành nội bộ.", "/products")
    });

    public static KnowledgeArticle? Find(string? key) => Articles.SingleOrDefault(a => a.Key == key);
    private static KnowledgeArticle Article(string key, string title, string content, string url) => new(key, title, Version, content, url);
}
