# ClayNest AI

Website bán gốm thủ công với trợ lý mua sắm AI, RAG và báo cáo kinh doanh. UI tiếng Việt, tiền tệ VND, múi giờ nghiệp vụ Asia/Ho_Chi_Minh; thời gian trong database sẽ lưu UTC.

## Trạng thái

Backend ở P0: FastAPI, PostgreSQL/pgvector, cấu hình và kiểm thử vận hành. Frontend đã có trang chủ cửa hàng gốm với dữ liệu minh họa, chưa nối nghiệp vụ backend. Chưa có đặt hàng, đăng nhập hay AI. Không cần API key hoặc dịch vụ trả phí.

## Yêu cầu

- Python 3.13 và [uv](https://docs.astral.sh/uv/).
- Node.js 22.12+ (khuyến nghị Node 24), npm.
- Docker Desktop đang chạy Linux containers.

## Chạy cục bộ (PowerShell)

Từ thư mục gốc, tạo cấu hình lần đầu (không ghi đè nếu đã có):

```powershell
Copy-Item .env.example .env

docker compose up -d --wait
```

`.env.example` chỉ chứa mật khẩu demo cục bộ. Nếu thay tài khoản/cổng/mật khẩu PostgreSQL, cập nhật cả `DATABASE_URL`. Mật khẩu có ký tự đặc biệt phải URL-encode trong URL. PostgreSQL chỉ mở cổng loopback. Script `backend/db-init/001-vector.sql` kích hoạt extension khi khởi tạo volume mới. Thay POSTGRES_* không đổi tài khoản trong volume đã tồn tại.

### Backend qua Docker (hỗ trợ máy Windows chặn thư viện native)

```powershell
docker compose --profile app up -d --build --wait
docker compose run --rm --no-deps api pytest -q
```

Sau đó chạy frontend như dưới đây. Không chạy backend Python đồng thời trên cổng 8000.

### Backend Python trực tiếp

Terminal backend:

```powershell
cd backend
uv sync --frozen --extra dev
uv run --frozen uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal frontend:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

- Website: http://127.0.0.1:5173
- API docs: http://127.0.0.1:8000/docs
- Liveness: http://127.0.0.1:8000/health → `200 {"status":"ok"}` (không phụ thuộc database).
- Readiness: http://127.0.0.1:8000/ready → `200 {"status":"ready"}` khi `SELECT 1` thành công; `503 {"status":"unavailable"}` khi database lỗi. Endpoint này chưa kiểm tra schema nghiệp vụ.

Trang chủ hiện chạy độc lập với backend. Vite đọc cấu hình công khai từ `.env` ở gốc; `VITE_API_BASE_URL` dành cho tích hợp API sau này. Chỉ đặt cấu hình công khai vào `VITE_*`; những giá trị này có thể được đưa vào bundle trình duyệt. Khởi động lại Vite khi sửa `.env`. API chỉ cho phép CORS từ hai origin local đã cấu hình.

## Kiểm tra

```powershell
cd backend
uv run --frozen pytest -q
cd ../frontend
npm.cmd run build
cd ..
docker compose config --quiet
docker compose exec -T db psql -U claynest -d claynest -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
```

Backend dùng lockfile `backend/uv.lock`; frontend dùng `frontend/package-lock.json`. Test readiness dùng mock để kiểm tra nhánh thành công/thất bại; lệnh SQL phía trên kiểm tra PostgreSQL thực tế riêng biệt.

Dừng server bằng Ctrl+C, dừng database bằng `docker compose down` (giữ volume). Không dùng `down -v` nếu cần giữ dữ liệu.

## Cấu trúc và phạm vi

```text
backend/app/main.py       FastAPI factory, health/readiness, CORS, request ID
backend/app/core/         cấu hình từ môi trường
backend/app/db/           engine và kiểm tra kết nối
backend/app/modules/      các package nghiệp vụ rỗng cho giai đoạn sau
backend/tests/            smoke test và lỗi vận hành
backend/db-init/          khởi tạo extension pgvector
frontend/src/            trang chủ, danh mục demo, xem nhanh, giỏ minh họa
docs/LEARNING_P0.md       giải thích kiến trúc và đối chiếu ASP.NET Core
```

Chưa có bảng nghiệp vụ, seed hay migration ở P0. Alembic và migration đầu tiên thuộc P1. Chưa triển khai structured logging đầy đủ, rate limiting hoặc xác thực; các phần này sẽ được bổ sung theo phạm vi giai đoạn tương ứng trước khi dùng thực tế.

Tài liệu đặc tả Markdown cục bộ tiếp tục được Git bỏ qua theo quy tắc có sẵn; riêng README và `docs/LEARNING_P0.md` được theo dõi. Không commit `.env`, secret, môi trường ảo hoặc `node_modules`.

## Lộ trình

P1 catalog và auth → P2 đơn hàng/tồn kho → P3 storefront/admin → P4 AI tools → P5 RAG → P6 analytics → P7 bảo mật, đánh giá và đóng gói.

## Kết quả xác minh P0 — 17/11/2026

- `npm.cmd run build`: TypeScript và Vite build thành công.
- `docker compose --profile app up -d --build --wait`: database và API healthy.
- `docker compose exec -T api pytest -q`: 4 passed; 1 cảnh báo thư viện Starlette về TestClient dùng httpx.
- HTTP thực tế: frontend, `/health`, `/ready` đều 200.
- Khi dừng database: `/health` 200, `/ready` 503. Khôi phục database: `/ready` 200.
- SQL xác nhận extension `vector` phiên bản 0.8.7.
- `docker compose config --quiet` và `git diff --check`: đạt.
- Python trực tiếp trên Windows bị Application Control chặn extension native SQLAlchemy; đã kiểm tra backend thành công trong Docker Linux. Dùng cách chạy Docker ở trên trên máy này.
- Chưa xác minh hiển thị trực quan bằng trình duyệt do công cụ browser không khởi tạo được.

Docker cài dependencies từ `backend/requirements.lock` được xuất từ `uv.lock` với hash. Sau khi thay dependencies, tạo lại bằng `uv export --frozen --extra dev --no-emit-project --no-dev --output-file requirements.lock` trong thư mục backend.

## Giao diện trang chủ cửa hàng gốm

Trang chủ tiếng Việt với tông kem/nâu đất, ảnh gốm lưu cục bộ, bố cục cho điện thoại và máy tính. Chạy `npm.cmd run dev` trong `frontend`, mở http://127.0.0.1:5173. Không cần backend để xem giao diện.

Có lọc danh mục, tìm kiếm không phân biệt dấu, xem nhanh bằng dialog, thêm/xóa/đổi số lượng trong giỏ minh họa và menu điện thoại. Giỏ tồn tại trong bộ nhớ trang và đặt lại khi tải lại; không tạo đơn hay giữ hàng. Tên và giá là dữ liệu hư cấu, được ghi rõ trên giao diện. Nguồn ảnh trong `frontend/public/images/README.md`.

Đã kiểm tra TypeScript và Vite production build. Chưa kiểm tra trực quan/tương tác bằng browser vì công cụ trình duyệt lỗi khởi tạo trên máy hiện tại. Phông Google Fonts có font dự phòng khi không có mạng. Backend P1 tạm hoãn để ưu tiên giao diện theo yêu cầu.

### Thiết kế Slow Living

Giao diện được nâng cấp với bảng màu ngà/olive, ảnh riêng cho từng loại sản phẩm, hero mới, các lối chọn theo góc sống, bộ sưu tập Slow Sunday và câu chuyện tạo hình gốm. Có lưu/bỏ lưu yêu thích trong phiên xem, menu mobile, animation nhẹ và hỗ trợ giảm chuyển động.

Bộ 7 ảnh mới tạo bằng công cụ image_gen được lưu tại `frontend/public/images/slow-living/`; prompt tại `prompts.json` trong cùng thư mục. Đây là ảnh AI minh họa, không phải ảnh hàng hoặc xưởng thật. Mỗi sản phẩm có một ảnh khác nhau và nội dung khớp chủ thể ảnh. Ảnh JPEG được tối ưu; tổng bộ ảnh khoảng 1,9 MB.

### Trang chủ tinh gọn và trang sản phẩm

Trang chủ hiện gồm banner ngang toàn chiều rộng với slogan HTML trên ảnh, sản phẩm nổi bật và đoạn giới thiệu thương hiệu. Đã bỏ các badge, dấu tròn, thẻ nổi, dải thông điệp và khối nội dung lặp.

Nút “Xem tất cả”, menu “Sản phẩm” và nút trên banner dẫn tới `/products`. Trang này có tìm kiếm không dấu, lọc danh mục, sắp xếp theo giá và trạng thái rỗng. Bộ lọc được lưu vào query string; routing giữ giỏ hàng trong phiên điều hướng. Đường dẫn lạ hiển thị trang không tìm thấy. Khi triển khai static hosting, cấu hình fallback về `index.html` để mở trực tiếp hoặc refresh `/products` (Vite dev/preview đã hỗ trợ).

Ảnh banner AI mới: `frontend/public/images/slow-living/banner-wide.jpg`; prompt kèm `banner-prompt.json`. `.env.example` tiếp tục được Git bỏ qua.

### Nàng Gốm — thương hiệu và câu chuyện

Tên hiển thị của cửa hàng đổi thành **Nàng Gốm**, với logo chữ, biểu tượng bình gốm và favicon SVG. Tên kỹ thuật repository/backend vẫn giữ theo dự án ClayNest.

Trang chủ được mở rộng thành 9 phần: banner ngang, lời chào thương hiệu, sản phẩm nổi bật, cảm hứng bộ sưu tập, câu chuyện Nàng Gốm, hành trình của gốm, gợi ý quà tặng, nhật ký và lời mời khám phá. Ảnh mới tại `frontend/public/images/nang-gom/`; prompt gốc nằm trong cùng thư mục.

`/stories` là trang nhật ký; `/stories/:slug` có 3 bài viết hoàn chỉnh về buổi sáng chậm, cắm hoa cho góc nhà và quà tặng. Các nút đọc tiếp mở bài viết, các bộ sưu tập dẫn tới `/products?category=...`. Footer có liên kết tới các phần và trang tương ứng. Tất cả hình ảnh và nội dung giới thiệu là bản minh họa; không tạo thông tin nghệ nhân, số liệu kinh doanh hoặc cam kết dịch vụ chưa xác minh.
