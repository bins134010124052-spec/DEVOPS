# Báo cáo cá nhân - DevOps cho ứng dụng web Node.js

## 1. Thông tin cá nhân

- Họ tên: [Họ và tên học viên]
- Mã số học viên: [MSSV]
- Lớp: [Tên lớp]
- Tên bài tập: DevOps cho ứng dụng web Node.js

---

## 2. Mục tiêu và phạm vi bài làm

Bài tập này nhằm xây dựng một ứng dụng web Node.js đơn giản, áp dụng quy trình DevOps từ phát triển đến triển khai tự động. Mục tiêu chính là:

- Xây dựng REST API sử dụng Express.js
- Kết nối với SQLite trong môi trường local và Docker
- Dockerize ứng dụng bằng Dockerfile và docker-compose
- Thiết lập pipeline CI với GitHub Actions: install, lint, test
- Thiết lập pipeline CD để build Docker image và deploy lên môi trường đích
- Quản lý cấu hình và secrets qua GitHub Secrets
- Viết tài liệu và báo cáo đầy đủ để dễ theo dõi và triển khai lại

Phạm vi bài làm gồm: backend API, cấu hình biến môi trường, Docker, CI/CD, README, và báo cáo kỹ thuật. Mỗi thành phần được thiết kế để có thể vận hành độc lập và có thể triển khai lên môi trường production hoặc staging.

---

## 3. Kiến trúc hệ thống

### 3.1 Sơ đồ kiến trúc

```text
Client
  |
  v
GitHub Repository
  |
  +--> CI Workflow (.github/workflows/ci.yml)
  |        - npm ci
  |        - npm run lint
  |        - npm test
  |
  +--> CD Workflow (.github/workflows/deploy.yml)
           - docker build
           - docker push to GitHub Container Registry
           - trigger Render deployment

Render Web Service
  |
  +--> Node.js + Express.js
  +--> SQLite Database
  +--> /health endpoint
  +--> CRUD API
```

### 3.2 Thành phần chính

- Node.js app: xây dựng REST API để quản lý sản phẩm và tồn kho
- SQLite: lưu trữ dữ liệu local và trong container
- Docker: đóng gói ứng dụng để chạy nhất quán trên nhiều môi trường
- GitHub Actions: tự động hóa kiểm tra, build, deploy
- GitHub Secrets: lưu Render deploy hook; GitHub token cấp quyền push image lên GHCR

---

## 4. Các bước thực hiện chi tiết

### 4.1 Khởi tạo ứng dụng Node.js

Dự án bắt đầu bằng việc khởi tạo package.json với các dependency cần thiết như Express, SQLite, dotenv, Winston, Morgan, Jest, Supertest, ESLint. Cấu trúc thư mục được tổ chức rõ ràng gồm `src/`, `tests/`, `data/`, `.github/workflows/`.

### 4.2 Xây dựng REST API

Ứng dụng cung cấp các endpoint sau:

- `GET /health`
- `GET /api/products` và `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

Các endpoint thực hiện CRUD sản phẩm từ SQLite. API xác thực tên, giá, tồn kho và SKU; SKU được đặt unique để tránh trùng mã sản phẩm.

### 4.3 Kết nối database và cấu hình môi trường

Dùng SQLite để đơn giản hóa triển khai mà vẫn đảm bảo tính thực tế của bài tập. Đường dẫn database được cấu hình qua biến môi trường `DB_PATH`. File `.env.example` được khai báo rõ ràng, giúp dễ chạy local mà không có dữ liệu nhạy cảm bị commit vào git.

### 4.4 Dockerize ứng dụng

Dockerfile được thiết kế theo dạng multi-stage:

- Stage `base`: install dependencies ở runtime
- Stage `build`: chạy lints/tests để đảm bảo chất lượng
- Stage `final`: copy app minimal để chạy production

Docker Compose file định nghĩa service `app` và expose port `3000`, giúp người dùng chạy nhanh bằng lệnh:

```bash
docker compose up --build
```

Render Blueprint (`render.yaml`) khai báo Docker web service, health check `/health`, và persistent disk mount tại `/app/data` để lưu SQLite qua các lần deploy.

### 4.5 CI pipeline với GitHub Actions

Workflow `.github/workflows/ci.yml` chạy trên push hoặc pull request. Quy trình gồm:

1. Checkout source code
2. Setup Node.js 22
3. Install dependencies bằng `npm ci`
4. Chạy `npm run lint`
5. Chạy `npm test`
6. Chạy `npm run security` để audit dependency

Nếu bước nào fail thì pipeline dừng ngay, đảm bảo không merge code lỗi vào hệ thống.

### 4.6 CD pipeline với GitHub Actions

Workflow `.github/workflows/deploy.yml` được thiết kế để:

- Chạy khi CI pass và trên nhánh `main`
- Checkout đúng commit đã pass CI
- Build Docker image và push lên GitHub Container Registry (GHCR)
- Gọi Render deploy hook để triển khai service từ repository đã liên kết

Render deploy hook URL được lưu trong GitHub Secret `RENDER_DEPLOY_HOOK`. `GITHUB_TOKEN` được GitHub Actions cấp cho job để push image lên GHCR; token không được ghi vào mã nguồn.

---

## 5. Khó khăn gặp phải và cách giải quyết

### 5.1 Vấn đề định dạng file và ESLint

Ban đầu, project xuất hiện lỗi `linebreak-style` do file có định dạng CRLF trên Windows. Cách giải quyết là normalizing file line endings về LF và đảm bảo toàn bộ repo có format đồng nhất.

### 5.2 Kết nối SQLite với Express

SQLite cần phải đảm bảo database file được tạo và thư mục dữ liệu tồn tại trước khi app chạy. Giải pháp là tạo thư mục `data/` và gọi `initializeDatabase()` khi server khởi động, đồng thời kiểm tra lỗi rõ ràng nếu database không thể tạo.

### 5.3 CI/CD secrets management

Một thách thức quan trọng là không để secrets được hardcode. Giải pháp là dùng GitHub Secrets và chỉ tham chiếu biến môi trường trên workflow, tránh lưu nhạy cảm trong mã nguồn.

### 5.4 Docker runtime và deployment

Khi chạy container, cần đảm bảo port, environment variables, và database path được cấu hình đúng. Health check dùng biến `PORT` để tương thích với cổng do Render cấp; persistent disk giữ dữ liệu SQLite qua các lần deploy. Việc tách `base`, `build`, `final` stage giúp giảm kích thước image và giữ ổn định quá trình triển khai.

---

## 6. Lessons learned

- DevOps không chỉ là pipeline mà còn là cách tổ chức repo và cấu hình rõ ràng.
- Docker giúp giảm nguy cơ “works on my machine” vì môi trường runtime được chuẩn hóa.
- CI/CD nên chạy chậm và rõ ràng thay vì đặt quá nhiều bước phức tạp ngay từ đầu.
- Secrets management cần được ưu tiên ngay từ đầu để đảm bảo an toàn và tuân thủ tốt hơn.
- Test và lint là lớp bảo vệ quan trọng trước khi deploy vào production.

---

## 7. Hướng phát triển tiếp theo

- Thêm staging environment tách biệt cụ thể cho production và staging
- Thêm Prometheus/Grafana hoặc logging trung tâm để giám sát hệ thống
- Thêm image scan như Trivy hoặc Snyk Container
- Tích hợp rollback script khi deploy thất bại
- Tạo kịch bản deploy tự động theo tag release

---

## 8. Link tham khảo

- GitHub Repository: [Link GitHub repo]
- Deployed App URL: [Link public app]
- Video demo: [Link YouTube hoặc drive]
- README: [README.md]

---

## 9. Kết luận

Bài làm đã có REST API, database, Docker, CI, cấu hình CD cho Render, secrets management và tài liệu. Để hoàn tất lần deploy public, cần tạo GitHub repository, kết nối repository với Render, cấu hình secret `RENDER_DEPLOY_HOOK`, rồi xác nhận pipeline và URL thực tế sau khi deploy.
