# ClayNest AI

Website bán gốm thủ công với trợ lý mua sắm AI, RAG và báo cáo kinh doanh. UI tiếng Việt, tiền tệ VND, múi giờ nghiệp vụ Asia/Ho_Chi_Minh; thời gian trong database sẽ lưu UTC.

## Trạng thái

P0: khung FastAPI + React/TypeScript, PostgreSQL/pgvector, cấu hình và kiểm thử vận hành. Chưa có catalog, đặt hàng, đăng nhập, AI hay dữ liệu mẫu. Không cần API key hoặc dịch vụ trả phí.

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

Frontend đọc biến `VITE_API_BASE_URL` từ `.env` ở gốc, giới hạn chờ API 5 giây và có nút thử lại. Chỉ đặt cấu hình công khai vào `VITE_*`; những giá trị này có thể được đưa vào bundle trình duyệt. Khởi động lại Vite khi sửa `.env`. API chỉ cho phép CORS từ hai origin local đã cấu hình.

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
frontend/src/            React shell, kết nối health và CSS responsive
docs/LEARNING_P0.md       giải thích kiến trúc và đối chiếu ASP.NET Core
```

Chưa có bảng nghiệp vụ, seed hay migration ở P0. Alembic và migration đầu tiên thuộc P1. Chưa triển khai structured logging đầy đủ, rate limiting hoặc xác thực; các phần này sẽ được bổ sung theo phạm vi giai đoạn tương ứng trước khi dùng thực tế.

Tài liệu đặc tả Markdown cục bộ tiếp tục được Git bỏ qua theo quy tắc có sẵn; riêng README và `docs/LEARNING_P0.md` được theo dõi. Không commit `.env`, secret, môi trường ảo hoặc `node_modules`.

## Lộ trình

P1 catalog và auth → P2 đơn hàng/tồn kho → P3 storefront/admin → P4 AI tools → P5 RAG → P6 analytics → P7 bảo mật, đánh giá và đóng gói.
