# ĐẶC TẢ PHÁT TRIỂN ỨNG DỤNG
# TREND AFFILIATE RADAR — VERSION 1.1

**Loại sản phẩm:** AI-powered Affiliate Product Discovery & Marketing Platform  
**Thị trường mục tiêu:** Việt Nam  
**Nền tảng Affiliate:** Shopee, TikTok Shop, Lazada  
**Ngôn ngữ giao diện:** Tiếng Việt (mặc định)  
**Môi trường triển khai ưu tiên:** Windows 11 + Docker Desktop (sẵn sàng chuyển lên VPS/Cloud)  
**Chiến lược phát hành:** Chia 2 mốc bàn giao có nghiệm thu rõ ràng (**v1.0 Core Radar & Research** → **v1.1 Affiliate Operations**)

---

## 1. VAI TRÒ, NGUYÊN TẮC BẮT BUỘC VÀ CHIẾN LƯỢC BÀN GIAO

Bạn là Senior Software Architect, Full-stack Developer, UI/UX Engineer và AI Automation Engineer.

Nhiệm vụ là **thiết kế, lập trình, kiểm thử và bàn giao ứng dụng Trend Affiliate Radar vận hành thực tế**, theo từng mốc phát hành hoàn chỉnh (không giao bộ khung rỗng, không dùng dữ liệu giả).

### Nguyên tắc bắt buộc

- Không dừng ở việc viết kế hoạch hoặc tạo giao diện tĩnh không có logic phía sau.
- Không dùng dữ liệu giả (mock data) để thay thế dữ liệu thật trong môi trường production.
- Không tự nhận tích hợp thành công nếu chưa chạy kiểm thử thực tế với dữ liệu đầu ra hợp lệ.
- Nếu API bên ngoài chưa được cấp quyền (như Shopee Open API), phải xây dựng luồng thay thế dùng được ngay (`Manual/Import Mode`).
- Nếu tính năng phụ thuộc API key hoặc quyền truy cập chưa cấu hình, phải hiển thị trạng thái `Chờ cấu hình` kèm hướng dẫn mở khóa, tuyệt đối không giả lập thành công.
- **Triển khai theo 2 mốc nghiệm thu (Release Gates):** Hoàn thiện, kiểm thử và nghiệm thu trọn vẹn **Release 1 (v1.0 Core)** trước khi mở rộng sang **Release 2 (v1.1 Operations)** nhằm tránh loãng ngữ cảnh và đảm bảo chất lượng từng màn hình.
- Ưu tiên kiến trúc tinh gọn, tối ưu RAM trên Windows 11 Docker Desktop, dễ bảo trì và kiểm soát chặt chi phí LLM.

---

## 2. MỤC TIÊU SẢN PHẨM & LUỒNG VẬN HÀNH HẰNG NGÀY

Trend Affiliate Radar giúp người vận hành Affiliate tại Việt Nam rút ngắn quy trình tìm sản phẩm thắng và sản xuất nội dung xuống dưới 15 phút mỗi sáng:

1. **Quét rộng tự động:** Thu thập xu hướng nóng đa nền tảng (Trung Quốc & quốc tế) mỗi ngày không cần thao tác tay.
2. **Lọc ý định thương mại:** Tách bỏ tin tức, giải trí, chính trị; chỉ giữ chủ đề có sản phẩm vật lý hoặc số bán được qua Affiliate.
3. **Nghiên cứu sâu theo yêu cầu:** Đào thảo luận thực tế 7–30 ngày qua bằng Last30Days Global/CN để xác thực nhu cầu, phản hồi người dùng và mức độ lan truyền.
4. **Đánh giá cơ hội minh bạch:** Xếp hạng sản phẩm kèm nguồn dẫn, độ đầy đủ dữ liệu và mức độ tin cậy.
5. **Đối chiếu sàn Việt Nam & Vận hành (v1.1):** So sánh sản phẩm trên Shopee/TikTok Shop/Lazada, sản xuất kịch bản nội dung, quản lý link Affiliate và đối chiếu doanh thu từ báo cáo sàn.

Ứng dụng là hệ thống **hỗ trợ ra quyết định có bằng chứng**, không tự khẳng định sản phẩm chắc chắn bán chạy.

---

## 3. KIẾN TRÚC CÔNG NGHỆ TINH GỌN

### 3.1. Ngăn xếp công nghệ (Tối ưu cho Windows 11 + Docker Desktop)

| Thành phần | Công nghệ đề xuất | Ghi chú kiến trúc |
|---|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS | Desktop-first, responsive mobile |
| UI System & Charts | shadcn/ui, Lucide Icons, Recharts (hoặc Tremor) | Tối ưu bảng dữ liệu & biểu đồ tương tác |
| Backend API | Python 3.12+, FastAPI | REST API chuẩn OpenAPI + SSE cho tiến trình job |
| Database & Vector | PostgreSQL 16 + `pgvector` (`pgvector/pgvector:pg16`) | Lưu dữ liệu quan hệ + multilingual embeddings |
| ORM & Migration | SQLAlchemy 2.0 (async), Alembic | Quản lý schema và migration chặt chẽ |
| Background Jobs | Celery + Redis (gộp Worker + Beat ở chế độ local) | Tiết kiệm RAM WSL2, hỗ trợ retry/idempotency |
| AI Integration | Provider abstraction (LiteLLM hoặc OpenAI-compatible SDK) | Hỗ trợ DeepSeek, Gemini, OpenAI, Local LLM |
| Data Collectors | TrendRadar (Docker), Last30Days Global & CN (CLI in Worker) | Phân vai tách biệt, tránh trùng lặp dữ liệu |
| Authentication | Single-Admin Session Auth (HTTP-only cookie) ở v1.0 | Mở rộng Multi-user RBAC ở v1.2 khi cần |
| Deployment | Docker Compose (6 container cốt lõi) | Khởi chạy một lệnh sau khi cấu hình `.env` |
| Testing | Pytest, Vitest, Playwright (luồng chính) | Kiểm thử thật, không giả lập thành công |

### 3.2. Luồng xử lý dữ liệu tổng thể

```text
[1. BROAD DAILY COLLECTION]
  TrendRadar Docker (Hotlist + RSS + Web Search)
        |  (Sync SQLite :ro -> PostgreSQL)
        v
[2. NORMALIZATION & MULTILINGUAL CLUSTERING]
  Standardize -> Deduplicate -> pgvector Embeddings -> Product Intent Triage (Model rẻ)
        |  (Chỉ đẩy chủ đề đạt ngưỡng thương mại)
        v
[3. ON-DEMAND DEEP RESEARCH]
  Last30Days Global CLI (Keyless/API)  +  Last30Days CN CLI (Public / Optional xhs-mcp)
        |  (Structured JSON + Source Health)
        v
[4. PRODUCT INTELLIGENCE & SCORING]
  Product Research Profile -> Evidence Tagging -> Opportunity Scoring (Null-safe)
        |
        v
[5. AFFILIATE OPERATIONS (v1.1)]
  Marketplace Matching -> Content Studio -> Campaign & Sub_id -> CSV/XLSX Import -> Analytics
```

---

## 4. PHÂN VAI VÀ TÍCH HỢP 3 REPOSITORY UPSTREAM

Để tránh trùng lặp dữ liệu, tốn gấp đôi token AI và lỗi đăng nhập cookie trong Docker, 3 repository được phân vai rạch ròi như sau:

### 4.1. TrendRadar — Bộ thu thập tín hiệu rộng hằng ngày

- **Repository:** [sansan0/TrendRadar](https://github.com/sansan0/TrendRadar) (`v6.12.0`, giấy phép **GPL-3.0**).
- **Vai trò:** Chỉ làm bộ thu thập tín hiệu nền (Hotlist, RSS, Web Search định kỳ). **Tắt tính năng AI Analysis và Push Notification nội bộ của TrendRadar** để tránh trùng lặp với Backend và kiểm soát chi phí tập trung.
- **Biên giới giấy phép GPL-3.0:** Chạy bằng image chính thức `wantcat/trendradar` như một container độc lập; không import mã nguồn Python của TrendRadar vào Backend của ứng dụng.
- **Đồng bộ dữ liệu:** Mount thư mục `output/` của TrendRadar vào Backend/Worker ở chế độ **chỉ đọc (`:ro`)**. Adapter đọc định kỳ các tệp SQLite (`output/news/{date}.db`, `output/rss/{date}.db`, `output/search/{date}.db`) ở chế độ read-only/immutable để tránh SQLite lock, sau đó chuẩn hóa và upsert vào PostgreSQL. Container `wantcat/trendradar-mcp` (`:3333/mcp`) được đặt trong Docker Compose `profile: ["mcp"]` (tùy chọn bật khi cần truy vấn lịch sử qua MCP).
- **Quản lý cấu hình từ giao diện:** Vì TrendRadar đọc cấu hình từ tệp tĩnh (`config/config.yaml`, `config/frequency_words.txt`, `config/timeline.yaml`, `config/search_queries.txt`) và không có REST API ghi cấu hình live, màn hình **Data Sources** cung cấp trình chỉnh sửa có kiểm tra cú pháp (YAML/text validation) → ghi tệp vào volume dùng chung `config/` → hiển thị nút/hướng dẫn áp dụng thay đổi (khởi động lại dịch vụ `trendradar` an toàn mà không phơi bày Docker socket ra môi trường công khai).
- **Giới hạn `newsnow` API:** Mặc định cấu hình chu kỳ thu thập hợp lý (30–60 phút/lần), hỗ trợ khai báo `api_url` tự host `newsnow` nếu tần suất tăng cao.

### 4.2. Last30Days Global — Nghiên cứu chuyên sâu thị trường quốc tế (On-Demand)

- **Repository:** [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) (`v4.6.0`, giấy phép **MIT**).
- **Vai trò:** Chỉ chạy theo yêu cầu (on-demand hoặc hàng đợi có giới hạn quota/ngày) cho các chủ đề đã qua bước lọc thương mại (Mục 5.3) hoặc do người vận hành bấm nút **"Nghiên cứu sâu"**.
- **Đóng gói môi trường:** Image `worker` phải cài sẵn Python 3.12+, Node.js (cho Bird client), `yt-dlp` và mã nguồn `last30days-skill`. Gọi trực tiếp qua CLI với cờ `--emit=json` để nhận đầu ra có cấu trúc; dùng `--diagnose` và `doctor` cho kiểm tra sức khỏe nguồn.
- **Chế độ Headless mặc định trong Docker (Không nhắc đăng nhập mỗi ngày):** Thiết lập sẵn biến môi trường `FROM_BROWSER=none` và `LAST30DAYS_DISABLE_BROWSER=1` (theo tài liệu [CONFIGURATION.md](https://github.com/mvanhorn/last30days-skill/blob/main/CONFIGURATION.md)). Ưu tiên tuyệt đối các nguồn không cần key (Reddit, Hacker News, Polymarket, GitHub, keyless TikTok/Instagram fallback) và các API miễn phí/free-tier khi người dùng điền key (`SCRAPECREATORS_API_KEY`, `BRAVE_API_KEY`).
- **Tín hiệu thương mại mở rộng:** Hỗ trợ bật tùy chọn Meta Ads (`LAST30DAYS_META_ADS_COUNTRY`) và Amazon khi người dùng cấu hình khóa tương ứng trong Settings.

### 4.3. Last30Days CN — Nghiên cứu chuyên sâu thị trường Trung Quốc (On-Demand)

- **Repository:** [Jesseovo/last30days-skill-cn](https://github.com/Jesseovo/last30days-skill-cn) (`v4.0.0`, giấy phép **MIT**).
- **Vai trò:** Chỉ sử dụng chế độ **nghiên cứu thảo luận theo chủ đề (7–30 ngày)** trên các nền tảng Trung Quốc (Weibo, Xiaohongshu, Bilibili, Zhihu, Douyin, WeChat OA, Baidu, Toutiao). **Không dùng Hot Board của repo này làm nguồn quét chính** vì trùng lặp với TrendRadar.
- **Chế độ Headless & Phân tách chất lượng dữ liệu:**
  - Mặc định chạy nguồn công khai không phụ thuộc cookie trình duyệt để vận hành tự động ổn định trên Windows Docker.
  - Mọi bản ghi trả về phải gắn nhãn `retrieval_mode` (`authenticated` | `hotboard_match` | `public_search`). Riêng kết quả `public_search` (vốn thiếu số liệu tương tác chính xác và ngày đăng chuẩn) phải được đánh dấu giảm trọng số tin cậy trong Scoring Engine.
- **Cầu nối quét sâu tùy chọn (Host Bridge):** Khi người vận hành cần dữ liệu sâu từ Xiaohongshu/Douyin, cho phép cấu hình URL dịch vụ `xiaohongshu-mcp` chạy trên máy chủ Windows (`http://host.docker.internal:18060`) sử dụng tài khoản phụ; hệ thống kiểm tra trạng thái kết nối trước khi gọi và tự động fallback về nguồn công khai nếu mất phiên.
- **Tuân thủ:** Không vượt CAPTCHA hoặc cơ chế chống bot trái quy định nền tảng.

### 4.4. E-commerce Connectors (Shopee, TikTok Shop, Lazada Việt Nam)

Thiết kế tầng adapter thống nhất cho 3 sàn với 2 chế độ:

- **Automatic Mode:** Gọi API chính thức khi người vận hành có đầy đủ API key/token được sàn phê duyệt.
- **Manual / Import Mode (Mặc định cho Shopee VN):**
  - Thêm/cập nhật link sản phẩm, giá bán, shop, mức hoa hồng thủ công kèm nguồn tham chiếu và ngày kiểm tra.
  - **CSV/XLSX Column Mapping Wizard:** Cho phép tải lên file báo cáo xuất từ Shopee Affiliate, TikTok Shop Affiliate, Lazada Affiliate; hiển thị xem trước 10 dòng đầu, cho phép map cột linh hoạt (Mã đơn, Tên sản phẩm, Giá trị đơn, Hoa hồng, Trạng thái, `Sub_id`, Ngày tạo), lưu preset mapping cho lần import sau và báo lỗi chi tiết theo từng dòng mà không làm hỏng dữ liệu cũ.

### 4.5. Source Health Monitoring

Mỗi nguồn dữ liệu có bản ghi giám sát riêng: trạng thái (`Healthy`, `Degraded`, `Auth Required`, `Rate Limited`, `Unavailable`, `Not Configured`), chế độ dữ liệu (`Full` | `Public Fallback` | `Manual Only`), thời điểm đồng bộ gần nhất, tỷ lệ bản ghi hợp lệ, thời gian phản hồi, thông báo lỗi cuối cùng và nút **"Kiểm tra kết nối"** / **"Chạy thử"** ngay trên UI. Tách biệt rạch ròi giữa `Không có dữ liệu mới` và `Lỗi truy cập`.

---

## 5. PHÁT HIỆN XU HƯỚNG, GOM CỤM ĐA NGÔN NGỮ & LỌC THƯƠNG MẠI

### 5.1. Trend Discovery Engine

- Thu thập và lưu snapshot theo thời gian: chủ đề mới, tần suất xuất hiện, quỹ đạo thứ hạng, mức độ tăng tốc, số nền tảng cùng xuất hiện, khu vực/ngôn ngữ.
- Chuẩn hóa điểm đà tăng trưởng (momentum) theo từng nền tảng; **không so sánh trực tiếp** lượt xem, lượt thích hoặc điểm xếp hạng khác đơn vị giữa các nền tảng.

### 5.2. Multilingual Trend Clustering (`pgvector`)

Gom các tín hiệu đa ngôn ngữ về cùng một nhóm sản phẩm (ví dụ: `Mini portable printer` ↔ `Pocket printer` ↔ `Máy in mini` ↔ `迷你打印机`):

- **Tầng 1 (Nhanh, miễn phí):** Chuẩn hóa văn bản, trích xuất tên sản phẩm/từ khóa song ngữ và so khớp chuỗi.
- **Tầng 2 (Ngữ nghĩa):** Tạo vector bằng model embedding đa ngôn ngữ cấu hình được (OpenAI/Gemini Embedding API hoặc local multilingual model) và lưu trực tiếp vào cột `embedding vector` của `pgvector` với chỉ mục HNSW/IVFFlat để truy vấn tương đồng cosine.
- **Bảo toàn nguồn gốc:** Mọi bản ghi thô sau khi gom cụm đều giữ nguyên liên kết nguồn gốc và URL gốc.

### 5.3. Product Intent Detection (Cổng lọc tiết kiệm chi phí)

Phân loại từng cụm xu hướng thành 6 nhóm: `Commercial Product`, `Entertainment/No Product`, `News/Politics`, `Tech/Concept Only`, `Legal/Safety Risk`, `Insufficient Data`. Chỉ các cụm thuộc `Commercial Product` đạt ngưỡng tối thiểu mới được đưa vào hàng đợi nghiên cứu sản phẩm sâu (Last30Days).

---

## 6. AI PRODUCT RESEARCH ENGINE & KỶ LUẬT BẰNG CHỨNG

Mỗi sản phẩm tiềm năng có hồ sơ nghiên cứu 360° gồm: Tên tiếng Việt / tiếng Trung / tiếng Anh, danh mục, công dụng, nỗi đau khách hàng, chân dung người mua, nguồn & thời điểm phát hiện, tín hiệu theo thị trường (TQ / Quốc tế / VN), sản phẩm tương đương/đối thủ, khoảng giá xác thực, mức hoa hồng xác thực, ý tưởng góc nội dung, rủi ro (vận chuyển, bảo hành, pháp lý, hàng giả), điểm cơ hội và kết luận AI.

Mọi trường dữ liệu quan trọng bắt buộc gắn **trạng thái xác minh**:

1. **Verified Fact:** Có URL nguồn kiểm chứng và ngày ghi nhận.
2. **AI Inference:** Nhận định suy luận từ bằng chứng (nêu rõ cơ sở suy luận).
3. **Unknown:** Chưa có dữ liệu (tuyệt đối không tự bịa doanh số, lượt bán hay tỷ lệ hoa hồng).
4. **Outdated:** Dữ liệu đã quá hạn kiểm tra (mặc định > 7 ngày với giá/hoa hồng, > 30 ngày với xu hướng).

---

## 7. OPPORTUNITY SCORING ENGINE

Thang điểm tổng: 100 (mỗi tiêu chí chấm từ 1–5 kèm giải thích và nguồn dẫn; trọng số chỉnh được trong Settings).

| Tiêu chí | Trọng số mặc định |
|---|---:|
| Tăng trưởng xu hướng | 20% |
| Nhu cầu tại Việt Nam | 20% |
| Mức độ cạnh tranh | 15% |
| Giá bán và kinh tế hoa hồng | 20% |
| Khả năng tạo nội dung video/review hấp dẫn | 15% |
| Khả năng cung ứng và mức độ rủi ro | 10% |

### Quy tắc xử lý dữ liệu thiếu (Null-safe)

- Tiêu chí thiếu dữ liệu mang giá trị `null` (không gán `0`), ghi rõ lý do `Unknown`.
- Hiển thị đồng thời 4 chỉ số độc lập:
  - **Opportunity Score:** Điểm tính trên các tiêu chí có dữ liệu (kèm nhãn `Tạm tính` nếu độ bao phủ < 100%).
  - **Data Completeness (%):** Tổng trọng số của các tiêu chí đã có dữ liệu.
  - **Evidence Confidence:** Độ tin cậy theo số lượng nguồn độc lập và chế độ thu thập (`authenticated` cao hơn `public_search`).
  - **Commercial Readiness:** Sẵn sàng triển khai Affiliate hay chưa (đã có link sàn & hoa hồng xác minh).
- Xếp loại mặc định (chỉnh được trong Settings): `80–100` (Ưu tiên cao — chỉ khi đủ bằng chứng trọng yếu), `65–79` (Nghiên cứu thêm), `50–64` (Theo dõi), `< 50` (Ưu tiên thấp), thiếu tiêu chí trọng yếu → `Pending Verification`.
- Lưu lịch sử điểm theo ngày và ghi rõ nguyên nhân tăng/giảm điểm.

---

## 8. PRODUCT MATCHING & AFFILIATE INTELLIGENCE

- Tìm và lưu nhiều link sản phẩm tương đương trên Shopee, TikTok Shop, Lazada theo từ khóa đa ngôn ngữ.
- So sánh nhiều shop trên cùng một bảng: giá tại thời điểm kiểm tra, lịch sử biến động giá, đánh giá/lượt bán (nếu nguồn hợp lệ cung cấp), trạng thái chương trình Affiliate, tỷ lệ hoa hồng theo tài khoản và ngày hết hạn ưu đãi.
- Tính hoa hồng ước tính: `Estimated Commission = Expected Order Value × Commission Rate` (hiển thị `Unknown` nếu thiếu tỷ lệ hoa hồng, luôn ghi chú là ước tính trước hủy đơn/điều chỉnh).
- Lưu lịch sử chỉnh sửa của người vận hành và cảnh báo khi phát hiện sản phẩm hết hàng hoặc ngừng Affiliate.

---

## 9. KIẾN TRÚC AI PIPELINE TINH GỌN & KIỂM SOÁT CHI PHÍ

Thay vì vận hành 9 agent tách rời gây chậm và tốn token, hệ thống chuẩn hóa thành **3 pipeline có cấu trúc** điều phối qua Backend:

| Pipeline | Nhiệm vụ chính | Model khuyến nghị | Cơ chế kích hoạt |
|---|---|---|---|
| **1. Triage & Extraction** | Dịch tiêu đề, chuẩn hóa từ khóa, lọc ý định thương mại, trích xuất tên sản phẩm | Model nhanh/rẻ (DeepSeek Chat, Gemini Flash) | Tự động theo lịch sau khi đồng bộ TrendRadar |
| **2. Deep Research & Scoring** | Tổng hợp JSON từ Last30Days Global/CN, lập hồ sơ sản phẩm, gắn nhãn bằng chứng, chấm điểm & kiểm định chất lượng (QC) | Model suy luận tốt (Gemini Pro, GPT-4o, DeepSeek Reasoner) | On-demand hoặc hàng đợi giới hạn số sản phẩm/ngày |
| **3. Content Strategist (v1.1)** | Sinh ý tưởng TikTok, kịch bản 15/30/60s, hook, storyboard, caption, hashtag, prompt ảnh/video | Tùy chọn trong AI Settings | Chỉ chạy khi người dùng bấm tạo |

### Yêu cầu kỹ thuật AI Layer

- Ép đầu ra **Structured JSON** có kiểm tra Pydantic schema; tự động retry tối đa 2 lần nếu sai định dạng.
- Hỗ trợ nhiều nhà cung cấp (OpenAI, Gemini, DeepSeek, OpenAI-compatible, Local LLM) và chọn model riêng cho từng pipeline.
- Quản lý phiên bản prompt (prompt versioning), cache kết quả theo hash đầu vào, theo dõi token & chi phí ước tính theo ngày/tác vụ, và **tự động dừng tác vụ nền khi chạm hạn mức ngân sách ngày** (kèm cảnh báo).

---

## 10. THIẾT KẾ GIAO DIỆN NGƯỜI DÙNG (UI/UX DESIGN SYSTEM & TRẢI NGHIỆM TRỰC QUAN)

Giao diện là điểm tiếp xúc hằng ngày của người vận hành (kể cả người không biết lập trình), vì vậy phải đạt chuẩn **trực quan, đẹp mắt, sạch sẽ, phản hồi nhanh và dễ hành động**.

### 10.1. Triết lý thẩm mỹ & Hệ thống thiết kế (Visual Design System)

- **Phong cách tổng thể:** *Editorial Data Workspace* hiện đại (gọn gàng theo tinh thần Linear / Stripe / Vercel Dashboard) — ưu tiên không gian thở, phân cấp thị giác rõ ràng, không dùng hiệu ứng thừa hay nhồi nhét quá nhiều widget trên một màn hình.
- **Chế độ Sáng / Tối (Light & Dark Mode):**
  - **Light Mode (mặc định):** Nền ứng dụng `#F8FAFC`, bề mặt thẻ `#FFFFFF`, viền mảnh `#E2E8F0`, chữ chính `#0F172A`, chữ phụ `#475569`.
  - **Dark Mode:** Nền ứng dụng `#0B1120`, bề mặt thẻ `#111827`, viền `#1E293B`, chữ chính `#F8FAFC`, chữ phụ `#94A3B8`.
  - Mọi cặp màu chữ/nền bắt buộc đạt độ tương phản **WCAG AA (≥ 4.5:1)**.
- **Bảng màu ngữ nghĩa nhất quán toàn hệ thống:**
  - **Primary Accent (`#2563EB` — Indigo/Blue):** Nút hành động chính, tab đang chọn, đường biểu đồ chính.
  - **Emerald (`#10B981`):** `Verified Fact`, nguồn `Healthy`, sản phẩm `Ưu tiên cao`, đà tăng trưởng dương.
  - **Amber (`#F59E0B`):** `AI Inference`, `Cần xác minh`, nguồn `Degraded` / `Public Fallback`.
  - **Slate (`#64748B`):** `Unknown`, `Chờ cấu hình`, dữ liệu chưa có.
  - **Rose (`#EF4444`):** Lỗi truy cập, cookie hết hạn, rủi ro pháp lý/sản phẩm, đà giảm mạnh.
- **Typography tối ưu tiếng Việt:**
  - Font giao diện: `Plus Jakarta Sans` hoặc `Inter` (hỗ trợ đầy đủ dấu tiếng Việt, không lỗi kerning).
  - Font số liệu: `JetBrains Mono` hoặc thuộc tính `font-variant-numeric: tabular-nums` cho toàn bộ cột giá (VNĐ), phần trăm hoa hồng, điểm số và ngày giờ để các con số thẳng hàng tuyệt đối khi quét mắt theo cột.
- **Nhịp điệu bố cục:** Bo góc thống nhất (`rounded-xl` cho thẻ, `rounded-lg` cho nút/input), dùng viền mảnh thay vì đổ bóng nặng; tối đa **4 thẻ KPI** trên một hàng ngang ở màn hình desktop.

### 10.2. Kiến trúc điều hướng & Trải nghiệm sử dụng

- **Sidebar trái thu gọn được (Collapsible Navigation):** Chia 3 nhóm mạch lạc:
  - *Khám phá:* Tổng quan, Trend Radar, Sản phẩm tiềm năng.
  - *Nghiên cứu & Vận hành:* Hàng đợi nghiên cứu, Studio nội dung (v1.1), Lịch nội dung (v1.1), Chiến dịch & Link (v1.1), Doanh thu (v1.1).
  - *Hệ thống:* Nguồn dữ liệu & Sức khỏe, Cài đặt AI & Hệ thống.
- **Command Palette (`Ctrl+K`):** Hộp tìm kiếm nhanh toàn cục cho phép tìm xu hướng, sản phẩm theo tên Việt/Anh/Trung hoặc nhảy nhanh tới bất kỳ màn hình nào.
- **Slide-over Detail Drawer (Ngăn kéo xem nhanh):** Khi bấm vào một dòng trong bảng Trend Radar hoặc Product Opportunities, mở ngăn kéo trượt bên phải hiển thị tóm tắt bằng chứng, biểu đồ thứ hạng và nút hành động nhanh (*"Chạy nghiên cứu sâu"*, *"Mở hồ sơ đầy đủ"*, *"Bỏ qua"*) mà không làm mất bộ lọc hay vị trí cuộn của bảng chính.
- **Onboarding Setup Wizard (Thiết lập lần đầu 3 bước):** Tự động hiện khi mới cài đặt:
  - *Bước 1:* Chọn AI Provider, dán API key và bấm **"Kiểm tra kết nối"**.
  - *Bước 2:* Kiểm tra tự động các nguồn dữ liệu miễn phí (TrendRadar, Last30Days keyless) và hiển thị trạng thái xanh/vàng ngay lập tức.
  - *Bước 3:* Chọn 3–5 nhóm ngành hàng quan tâm (Gia dụng, Làm đẹp, Công nghệ, Mẹ & Bé, Phụ kiện...) để nạp sẵn từ khóa mẫu → vào thẳng Dashboard.

### 10.3. Thành phần trực quan hóa dữ liệu & Micro-UX đặc thù

- **Score Ring + Completeness Meter:** Điểm cơ hội hiển thị bằng vòng tròn tiến độ trực quan đi kèm thanh ngang *Độ đầy đủ dữ liệu (%)*. Nếu còn tiêu chí `Unknown`, tự động gắn nhãn `Tạm tính` màu Amber; di chuột vào hiện danh sách tiêu chí còn thiếu và nút bổ sung nhanh.
- **Evidence Badge & Citation Popover:** Mỗi nhận định trong hồ sơ sản phẩm gắn thẻ trạng thái (`Đã xác minh`, `AI suy luận`, `Chưa có dữ liệu`, `Quá hạn`). Bấm vào thẻ sẽ mở popover hiển thị trích dẫn nguồn, ngày ghi nhận và nút mở URL gốc ở tab mới.
- **Biểu đồ tương tác sạch (Recharts / Tremor):**
  - Sparkline mini trong bảng Trend Radar để thấy ngay hướng tăng/giảm 7 ngày.
  - Biểu đồ đường quỹ đạo xếp hạng đa nền tảng (Trung Quốc vs Quốc tế) có tooltip chi tiết theo giờ/ngày.
  - Biểu đồ Waterfall/Bar phân rã đóng góp của 6 tiêu chí vào điểm Opportunity Score.
- **Trạng thái trống hữu ích (Actionable Empty States) & Live Progress:**
  - Không bao giờ hiển thị màn hình trắng hoặc biểu đồ dữ liệu giả; khi chưa có dữ liệu, hiển thị minh họa tối giản + giải thích rõ nguyên nhân + 1 nút hành động chính (ví dụ: *"Chạy đồng bộ TrendRadar ngay"* hoặc *"Cấu hình khóa API"*).
  - Khi người dùng kích hoạt nghiên cứu sâu (Last30Days), hiển thị **Progress Stepper theo thời gian thực** qua SSE (ví dụ: `Đang gọi Last30Days Global → Đang gọi Last30Days CN → AI đang tổng hợp bằng chứng → Hoàn tất`).
- **Responsive & Thao tác nhanh:** Desktop-first tối ưu cho màn hình từ 1280px; trên điện thoại tự động chuyển bảng dữ liệu thành danh sách thẻ (Card List) gọn gàng; hỗ trợ phím tắt (`/` tìm kiếm, `Esc` đóng drawer, `D` đổi Dark/Light mode).

### 10.4. Danh mục màn hình phân chia theo Release

**Release 1 — v1.0 Core Radar & Research (7 màn hình):**

1. **Overview Dashboard:** 4 thẻ KPI thực tế (Xu hướng mới hôm nay, Sản phẩm đủ điều kiện, Tác vụ đang chạy, Sức khỏe nguồn), danh sách Top cơ hội cần xem ngay, danh sách xu hướng mới nổi và cảnh báo nguồn lỗi.
2. **Trend Radar & Explorer:** Bảng xu hướng trực tiếp + lịch sử có sparkline, lọc theo nền tảng/ngôn ngữ/ý định thương mại, ngăn kéo xem nhanh và nút đẩy sang nghiên cứu sản phẩm.
3. **Product Opportunities:** Bảng xếp hạng sản phẩm với Score Ring, thanh Completeness, bộ lọc thông minh (Ưu tiên cao / Chờ xác minh / Theo danh mục / Có tín hiệu TQ→VN) và so sánh nhanh.
4. **Product Research Detail (Hồ sơ 360°):** Trình bày dạng 2 cột dễ đọc — cột trái là hồ sơ phân tích kèm Evidence Badge và bằng chứng đa nền tảng; cột phải là bảng điểm 6 tiêu chí, lịch sử điểm và khu vực **Marketplace Comparison** (so sánh shop/giá/hoa hồng trên Shopee, TikTok Shop, Lazada + thêm link thủ công).
5. **Research Jobs Queue:** Theo dõi tiến trình chạy Last30Days Global/CN và AI Pipeline theo thời gian thực, xem log rút gọn, chạy lại tác vụ lỗi.
6. **Data Sources & Health:** Thẻ trạng thái từng nguồn (`TrendRadar`, `Last30Days Global`, `Last30Days CN`, `Shopee`, `TikTok Shop`, `Lazada`), nút Test kết nối, chẩn đoán lỗi, trình chỉnh sửa cấu hình TrendRadar có validate và bật/tắt cầu nối `xiaohongshu-mcp`.
7. **Settings & AI Cost Control:** Cấu hình AI Provider/Model cho 3 pipeline, ngân sách token/ngày, tùy chỉnh trọng số & ngưỡng xếp loại Opportunity Score, cấu hình thông báo Telegram/Email và Backup/Restore.

**Release 2 — v1.1 Affiliate Operations (5 màn hình):**

8. **Content Studio:** Sinh kịch bản TikTok 15/30/60s, hook, voice-over, storyboard, caption, hashtag, CTA và prompt ảnh/video; lưu nhiều phiên bản, nút copy một chạm và xuất gói tài nguyên sản xuất thủ công.
9. **Content Calendar:** Chế độ xem Kanban (`Idea → Draft → Review → Approved → Scheduled → Published`) và chế độ Lịch theo tuần/tháng.
10. **Campaign & Affiliate Links Manager:** Tạo chiến dịch, gắn sản phẩm, quản lý link Affiliate, mã `Sub_id` / UTM và trạng thái còn hàng/hết hạn ưu đãi.
11. **CSV/XLSX Revenue Import Wizard:** Tải báo cáo từ Shopee/TikTok Shop/Lazada, map cột trực quan, lưu mẫu mapping, xem trước và đối chiếu trùng lặp trước khi nhập.
12. **Revenue & ROI Analytics:** Phân tích lượt nhấp, đơn hàng ghi nhận/duyệt, hoa hồng chờ duyệt/thực nhận, chi phí nội dung/quảng cáo và lợi nhuận thực tế; tách rõ nguồn số liệu (Tự thu thập / Người dùng nhập / Sàn xác nhận) và xuất CSV/XLSX.

---

## 11. VẬN HÀNH AFFILIATE: CONTENT STUDIO, CAMPAIGN & ANALYTICS (PHẠM VI v1.1)

- **Content Studio & AI Media Adapter:** Thiết kế interface adapter cho dịch vụ tạo ảnh/video/TTS nếu người dùng cấu hình sau này; mặc định xuất đầy đủ prompt, storyboard và kịch bản để sản xuất thủ công, không dựng giao diện giả đã tạo video.
- **Affiliate Tracking & Quy tắc Localhost vs VPS:**
  - Không bọc hoặc chỉnh sửa link Affiliate trái điều khoản sàn.
  - Khi chạy ở **Local Mode (Windows 11)**, quản lý tracking qua mã `Sub_id` / UTM chuẩn của sàn và đối chiếu qua báo cáo CSV/XLSX.
  - Tính năng **URL Redirect Tracker** đo lượt nhấp chỉ được kích hoạt khi người dùng cấu hình `PUBLIC_BASE_URL` (domain công khai trên VPS/Cloud).
- **Phân tách phễu doanh thu:** Phân biệt rạch ròi giữa Lượt nhấp, Đơn hàng ghi nhận, Đơn hàng được duyệt, Hoa hồng chờ duyệt, Hoa hồng được duyệt và Hoa hồng thực nhận. Không bao giờ cộng gộp hoa hồng ước tính vào doanh thu thực nhận.

---

## 12. THÔNG BÁO VÀ TỰ ĐỘNG HÓA

- **Kênh thông báo:** Telegram, Email (SMTP), Web Notification trong ứng dụng; cấu hình tần suất, mức độ ưu tiên và khung giờ im lặng.
- **Quy tắc cảnh báo:** Sản phẩm tiềm năng mới đạt ngưỡng, điểm cơ hội tăng mạnh, xu hướng lan sang Việt Nam, nguồn dữ liệu bị lỗi hoặc chạm giới hạn rate limit, chạm ngưỡng ngân sách AI/ngày, nội dung đến lịch đăng (v1.1).
- **Scheduled Jobs:** Đồng bộ TrendRadar, kiểm tra sức khỏe nguồn, gom cụm `pgvector`, lọc ý định thương mại, tính lại điểm cơ hội, tổng hợp bản tin sáng (Daily Digest) và sao lưu PostgreSQL. Mọi job đều có timeout, exponential backoff retry, khóa chống chạy trùng (Redis lock) và nhật ký chạy xem được trên UI.

---

## 13. THIẾT KẾ CƠ SỞ DỮ LIỆU (POSTGRESQL 16 + PGVECTOR)

### Nhóm bảng Release 1 (v1.0 Core)

- **Data Collection:** `data_sources`, `source_credentials` (mã hóa `AES-256-GCM` hoặc `Fernet` bằng `APP_ENCRYPTION_KEY` trong `.env`), `collection_jobs`, `raw_signals`, `signal_metrics`, `source_health_logs`, `research_runs`.
- **Trend Intelligence:** `trend_topics`, `topic_signals`, `trend_snapshots`, `trend_clusters` (có cột `embedding vector`), `topic_research`.
- **Products & Scoring:** `products`, `product_aliases`, `product_evidence`, `product_scores`, `product_marketplace_matches`, `product_price_history`, `product_verifications`.
- **System & AI Cost:** `users`, `sessions`, `settings`, `ai_usage_logs`, `notifications`, `audit_logs`.

### Nhóm bảng Release 2 (v1.1 Operations)

- **Affiliate Operations:** `affiliate_programs`, `affiliate_links`, `campaigns`, `campaign_products`, `content_assets`, `content_publications`, `csv_import_templates`, `import_batches`, `tracking_events`, `affiliate_orders`, `commissions`, `expenses`.

### Yêu cầu bắt buộc về dữ liệu

- Toàn bộ khóa ngoại, ràng buộc toàn vẹn, unique key chống trùng lặp và index tìm kiếm đầy đủ (bao gồm index HNSW cho `pgvector`).
- Lưu timestamp theo UTC, hiển thị trên UI theo múi giờ `Asia/Ho_Chi_Minh`.
- Không lưu bất kỳ API key, token hay mật khẩu nào dạng plaintext trong DB, log hoặc Git.

---

## 14. BACKEND API DESIGN

Chuẩn hóa REST API dưới tiền tố `/api/v1/*` kèm tài liệu OpenAPI (Swagger UI):

- **v1.0 Core:** `/api/v1/auth/*`, `/api/v1/dashboard/*`, `/api/v1/sources/*`, `/api/v1/trends/*`, `/api/v1/research/*`, `/api/v1/products/*`, `/api/v1/opportunities/*`, `/api/v1/marketplaces/*`, `/api/v1/settings/*`, `/api/v1/system/*`.
- **v1.1 Operations:** `/api/v1/content/*`, `/api/v1/campaigns/*`, `/api/v1/affiliate/*`, `/api/v1/imports/*`, `/api/v1/analytics/*`, `/api/v1/notifications/*`.

Yêu cầu: xác thực session, phân trang chuẩn (`page`, `page_size`, `total`), lọc/tìm kiếm/sắp xếp, kiểm tra dữ liệu bằng Pydantic, giới hạn tốc độ (rate limiting), định dạng lỗi thống nhất (`code`, `message`, `details`), idempotency key cho các tác vụ tạo job lặp, và luồng SSE (`/api/v1/research/runs/{id}/events`) cập nhật tiến trình trực tiếp cho UI.

---

## 15. BẢO MẬT, ĐỘ TIN CẬY VÀ TUÂN THỦ

- **Bảo mật:** Đăng nhập Single-Admin Session (HTTP-only, SameSite cookie, Argon2/bcrypt password hash, rate limit đăng nhập), chống CSRF/XSS/SQL injection, mã hóa bí mật trong DB bằng master key ngoài `.env`, tách biệt biến môi trường frontend và backend.
- **Độ tin cậy:** Tách lỗi từng nguồn (một nguồn lỗi không làm sập pipeline), timeout + retry có backoff, nút chạy lại job lỗi trên UI, script backup/restore PostgreSQL tự động và trang System Health.
- **Tuân thủ:** Tôn trọng điều khoản Shopee/TikTok Shop/Lazada và các nguồn dữ liệu; chạy TrendRadar như container độc lập để tuân thủ GPL-3.0; không sao chép nội dung vi phạm bản quyền; không tạo tuyên bố quảng cáo sai sự thật.

---

## 16. TRIỂN KHAI VÀ CÀI ĐẶT (WINDOWS 11 + DOCKER DESKTOP)

### Kiến trúc Docker Compose tinh gọn

| Service | Bắt buộc | Vai trò |
|---|---|---|
| `frontend` | Có | Next.js Web UI (`http://localhost:3000`) |
| `backend` | Có | FastAPI REST API + SSE (`http://localhost:8000`) |
| `worker` | Có | Celery Worker + Beat + Python 3.12 / Node.js / `yt-dlp` cho Last30Days |
| `postgres` | Có | `pgvector/pgvector:pg16` |
| `redis` | Có | Broker, cache và khóa chống chạy trùng |
| `trendradar` | Có | `wantcat/trendradar:latest` (chia sẻ volume `config/` và `output/:ro`) |
| `trendradar-mcp` | Tùy chọn (`profile: mcp`) | `wantcat/trendradar-mcp:latest` (`127.0.0.1:3333/mcp`) |

- Hỗ trợ kết nối tới dịch vụ `xiaohongshu-mcp` chạy trên host Windows qua `http://host.docker.internal:18060` khi người dùng bật tùy chọn trong Data Sources.
- Cung cấp sẵn: `docker-compose.yml`, `.env.example`, script khởi tạo 1 lệnh (`start.bat` cho Windows & `start.sh` cho Linux/WSL2), Alembic migrations và hướng dẫn cài đặt từng bước bằng tiếng Việt cho người không biết lập trình.
- Ứng dụng phải khởi động trọn vẹn và mở được giao diện ngay cả khi chưa điền bất kỳ API key trả phí nào.

---

## 17. TIÊU CHUẨN KIỂM THỬ, KẾ HOẠCH PHÁT TRIỂN & BÀN GIAO

### Kế hoạch triển khai theo 2 Release có Gate nghiệm thu

**Release 1 — v1.0 Core Radar & Research:**

- **Phase 1 (Foundation & UI Shell):** Repository, Docker Compose 6 service, PostgreSQL + `pgvector`, FastAPI, Next.js + Design System (Light/Dark, Sidebar, Command Palette, Onboarding Wizard), Single-Admin Auth.
- **Phase 2 (3-Repo Data Infrastructure):** Tích hợp TrendRadar (`output/:ro` sync), đóng gói Last30Days Global & CN (headless mặc định `FROM_BROWSER=none`), Source Health & Diagnostics UI, trình chỉnh sửa cấu hình TrendRadar.
- **Phase 3 (AI Intelligence & Research UX):** `pgvector` clustering, Pipeline 1 & 2, Product Research Detail 360°, Opportunity Scoring (null-safe), Marketplace Comparison (Manual Mode), Slide-over Drawer, SSE Live Progress, kiểm thử thực tế & **Nghiệm thu v1.0**.

**Release 2 — v1.1 Affiliate Operations:**

- **Phase 4 (Content, Campaigns & CSV Import):** Content Studio (Pipeline 3), Content Calendar, Campaign & Affiliate Links Manager (`Sub_id` / optional VPS Redirect), CSV/XLSX Column Mapping Wizard.
- **Phase 5 (Analytics, Automation & Production Hardening):** Revenue & ROI Dashboard, Telegram/Email Notifications, Backup/Restore, Security Audit, Playwright E2E, Load Test (1.000 tín hiệu/ngày, truy vấn danh sách < 3 giây trên môi trường ghi rõ cấu hình) & **Nghiệm thu v1.1**.

### Definition of Done & Bàn giao bắt buộc

1. Mã nguồn hoàn chỉnh trên Git repository (frontend, backend, worker, migrations, Docker Compose).
2. Toàn bộ 3 nguồn (TrendRadar, Last30Days Global, Last30Days CN) được kiểm thử thực tế với dữ liệu thật; nguồn thiếu quyền hiển thị đúng trạng thái `Chờ cấu hình`.
3. Giao diện hoàn thiện đúng Design System (không có nút chết, không có dữ liệu mock, dùng tốt trên desktop và mobile).
4. Bộ kiểm thử tự động (Pytest, Vitest, Playwright luồng chính) chạy đạt chuẩn.
5. Tài liệu tiếng Việt đầy đủ: Hướng dẫn cài đặt Windows 11 cho người mới, Danh sách API key (miễn phí & tùy chọn), Tài liệu kiến trúc & OpenAPI, Báo cáo kết quả kiểm thử thực tế, Danh sách giới hạn theo quyền sàn và Quy trình Backup/Restore/Update.
