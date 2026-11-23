using ClayNest.Application.AdminAi;
namespace ClayNest.Infrastructure.AdminAi;

public static class AdminAiGuides
{
    public const string Version = "2026-11-23.1";
    public static IReadOnlyList<AdminAiGuide> All { get; } = Array.AsReadOnly(new[]
    {
        new AdminAiGuide("orders", "Xử lý đơn COD",
            "Mở Đơn hàng, lọc trạng thái chờ xác nhận và kiểm tra chi tiết. Luồng xử lý: chờ xác nhận → đã xác nhận → đã đóng gói → đang giao → hoàn tất. Chỉ hoàn tất khi đã giao và xác nhận thu COD. Hủy đơn cần lý do; hệ thống hoàn kho một lần. Không đổi trạng thái hàng loạt qua trợ lý.", "/admin/orders"),
        new AdminAiGuide("inventory", "Nhập và điều chỉnh tồn kho",
            "Mở Quản lý kho, tìm sản phẩm hoặc SKU. Chọn nhập kho khi nhận thêm hàng, điều chỉnh khi kiểm kê; ghi số lượng, lý do và ngưỡng cảnh báo. Kiểm tra lịch sử biến động. Nếu dữ liệu đã thay đổi, tải lại trước khi gửi. Tồn kho hiện tại không bị giới hạn bởi kỳ doanh thu.", "/admin/inventory"),
        new AdminAiGuide("reports", "Đọc báo cáo bán hàng",
            "Doanh thu hoàn tất tính theo ngày hoàn tất, gồm tiền sản phẩm và phí giao hàng đã thu. Giá trị đơn đặt mới gồm cả đơn hủy và tính theo ngày đặt; không phải doanh thu. Giá trị đơn trung bình chỉ tính trên đơn hoàn tất. Kỳ thống kê dùng giờ Việt Nam. Báo cáo không đo lợi nhuận hoặc tỷ lệ chuyển đổi.", "/admin/reports"),
        new AdminAiGuide("knowledge", "Cập nhật kiến thức RAG",
            "Mở Kho kiến thức AI, tải tài liệu văn bản .txt/.md hoặc nhập nội dung và nguồn. Đợi lập chỉ mục, xem nội dung phiên bản rồi duyệt công bố. Chỉ phiên bản đang được duyệt mới được truy xuất. Thu hồi khi nguồn hết hiệu lực. Tài liệu được duyệt ở đây có thể được trích dẫn trên cửa hàng; chỉ đăng nội dung phù hợp công khai.", "/admin/knowledge"),
        new AdminAiGuide("catalog", "Quản lý sản phẩm",
            "Mở Sản phẩm & danh mục để tạo bản nháp, cập nhật thông số, biến thể, giá và hình ảnh, rồi xuất bản khi đủ dữ liệu. Mỗi biến thể có SKU và tồn kho riêng. Ẩn hoặc lưu trữ khi ngừng giới thiệu; giá và tồn được kiểm tra lại khi đặt đơn.", "/admin/products"),
    });
}
