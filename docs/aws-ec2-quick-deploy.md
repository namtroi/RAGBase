# RAGBase — Deploy Nhanh trên AWS EC2

> **Mục đích:** Triển khai thật trên AWS EC2 để test, sau đó tắt đi.
> **Chi phí dự kiến:** ~$2–3 cho vài giờ test (tính theo giờ, tắt là hết tiền).
> **Thời gian setup:** 30–60 phút.

---

## Điều Kiện Tiên Quyết

- [ ] Tài khoản AWS (đã có billing/credit card)
- [ ] AWS CLI cài trên máy local (`aws configure` đã setup access key)
- [ ] Code RAGBase trên GitHub (hoặc có thể scp lên)
- [ ] Qdrant Cloud đã có collection + API key

---

## Bước 1: Tạo Security Group

Vào **AWS Console → EC2 → Security Groups → Create Security Group**:

| Rule | Type | Port | Source | Mục đích |
|------|------|------|--------|----------|
| SSH | Inbound | 22 | My IP | SSH vào EC2 |
| HTTP | Inbound | 80 | 0.0.0.0/0 | Truy cập frontend |
| Backend API | Inbound | 3000 | 0.0.0.0/0 | Truy cập API (test) |

> [!WARNING]
> Port 3000 mở public chỉ dùng cho **test**. Production thật thì phải dùng Nginx reverse proxy + chỉ mở port 80/443.

---

## Bước 2: Launch EC2 Instance

Vào **AWS Console → EC2 → Launch Instance**:

| Cấu hình | Giá trị | Ghi chú |
|-----------|---------|---------|
| **Name** | `ragbase-test` | |
| **AMI** | Ubuntu Server 24.04 LTS | Free tier eligible |
| **Instance type** | `t3.large` (2 vCPU, 8GB RAM) | ~$0.08/giờ. Đủ cho tất cả services |
| **Key pair** | Tạo mới hoặc dùng key pair có sẵn | Để SSH vào |
| **Security group** | Chọn SG vừa tạo ở Bước 1 | |
| **Storage** | 30 GB gp3 | Free tier cho 30GB |

Click **Launch Instance**.

---

## Bước 3: SSH vào EC2

```bash
# Chờ instance status = "running", lấy Public IP từ console
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

---

## Bước 4: Cài Docker & Docker Compose

Chạy trên EC2:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Logout rồi SSH lại để group docker có hiệu lực
exit
```

SSH lại:
```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Verify Docker
docker --version
docker compose version
```

---

## Bước 5: Clone Repo & Cấu Hình

```bash
# Clone repo
git clone https://github.com/<your-username>/RAGBase.git
cd RAGBase

# Tạo .env từ example
cp .env.example .env
nano .env
```

Sửa file `.env` với nội dung sau:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ragbase
POSTGRES_PASSWORD=<đặt_password_mạnh>

# Redis
REDIS_URL=redis://localhost:6379

# API
PORT=3000
API_KEY=<đặt_api_key_bất_kỳ>

# Internal
CALLBACK_URL=http://backend:3000/internal/callback

# Infrastructure
PDF_CONCURRENCY=1

# Qdrant - dùng giá trị thật của bạn
QDRANT_URL=<your_qdrant_cloud_url>
QDRANT_API_KEY=<your_qdrant_api_key>
QDRANT_COLLECTION=ragbase_hybrid
VECTOR_DB_PROVIDER=qdrant

# Encryption
APP_ENCRYPTION_KEY=<generate_with: openssl rand -hex 32>

# Google OAuth (bỏ trống nếu chưa cần test Drive)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

> [!TIP]
> Generate encryption key nhanh: `openssl rand -hex 32`

---

## Bước 6: Build & Run

```bash
# Build và chạy tất cả services
docker compose -f docker-compose.prod.yml up --build -d

# Xem logs real-time
docker compose -f docker-compose.prod.yml logs -f

# Kiểm tra tất cả services đã healthy
docker compose -f docker-compose.prod.yml ps
```

Chờ khoảng 2-5 phút để tất cả services start lên (AI Worker tải model embedding lần đầu sẽ lâu nhất).

---

## Bước 7: Verify

### Health checks

```bash
# Backend health
curl http://localhost:3000/health

# AI Worker health (từ trong EC2)
docker compose -f docker-compose.prod.yml exec ai-worker curl http://localhost:8000/health

# Frontend
curl -I http://localhost:80
```

### Truy cập từ trình duyệt

```
Frontend:  http://<EC2_PUBLIC_IP>
API:       http://<EC2_PUBLIC_IP>:3000/health
```

---

## Bước 8: Test Xong → TẮT NGAY

> [!CAUTION]
> **EC2 tính tiền theo giờ!** Test xong phải tắt ngay để không bị charge thêm.

### Option A: Stop (giữ data, có thể start lại)
```bash
# Trên EC2: tắt Docker containers
docker compose -f docker-compose.prod.yml down

# Trên AWS Console: EC2 → Select instance → Instance State → Stop
# Hoặc dùng AWS CLI:
aws ec2 stop-instances --instance-ids <INSTANCE_ID>
```
> **Chi phí khi Stop:** ~$0 (chỉ trả tiền EBS storage ~$2.40/tháng cho 30GB)

### Option B: Terminate (xóa hoàn toàn, $0)
```bash
# AWS Console: EC2 → Select instance → Instance State → Terminate
# Hoặc:
aws ec2 terminate-instances --instance-ids <INSTANCE_ID>
```
> **Chi phí:** $0. Mọi data bị xóa hoàn toàn.

---

## Tổng Kết Chi Phí Test

| Hạng mục | Chi phí |
|----------|---------|
| EC2 t3.large × 2 giờ | ~$0.17 |
| EBS 30GB × vài giờ | ~$0.01 |
| Data transfer (ra) | Free (dưới 100GB/tháng) |
| **Tổng cho 1 buổi test** | **< $1** |

> [!NOTE]
> Nếu bạn ở trong 12 tháng Free Tier, EC2 `t2.micro` miễn phí 750h/tháng nhưng **không đủ RAM** cho RAGBase. `t3.large` không nằm trong free tier nhưng chi phí rất thấp khi chỉ chạy vài giờ.

---

## Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| **Cannot connect trên browser** | Kiểm tra Security Group đã mở port 80 và 3000 chưa |
| **AI Worker OOM killed** | Kiểm tra `docker compose logs ai-worker`. Nếu thiếu RAM, upgrade lên `t3.xlarge` |
| **Build quá lâu** | Lần đầu build trên EC2 mất 5-10 phút do pull images + compile. Lần sau nhanh hơn nhờ cache |
| **Frontend 502/503** | Backend chưa healthy. Chờ thêm hoặc kiểm tra logs: `docker compose logs backend` |
| **Database connection refused** | PostgreSQL chưa ready: `docker compose logs postgres` |

---

## Muốn Chạy Lại Lần Sau?

Nếu đã **Stop** (không Terminate):

```bash
# Start EC2 từ Console hoặc CLI
aws ec2 start-instances --instance-ids <INSTANCE_ID>

# SSH vào (IP có thể thay đổi sau restart, check Console)
ssh -i your-key.pem ubuntu@<NEW_PUBLIC_IP>

# Start lại Docker
cd RAGBase
docker compose -f docker-compose.prod.yml up -d
```

> [!TIP]
> Gán **Elastic IP** (free khi EC2 đang chạy) để IP không đổi mỗi lần restart.
