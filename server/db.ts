import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
} from '../src/lib/scoring';
import type {
  AffiliateLinkRecord,
  AffiliateOrderRecord,
  AppSettings,
  CampaignRecord,
  ContentAsset,
  CsvImportPreset,
  DataSourceRecord,
  ExpenseRecord,
  NotificationItem,
  ProductRecord,
  ResearchRun,
  TrendTopic,
} from '../src/lib/types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'trend_radar.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS data_sources (
      id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trend_topics (
      id TEXT PRIMARY KEY,
      cluster_key TEXT NOT NULL,
      intent TEXT NOT NULL,
      region TEXT NOT NULL,
      momentum_score REAL NOT NULL,
      dismissed INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      trend_id TEXT,
      category TEXT NOT NULL,
      name_vi TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS research_runs (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_assets (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS affiliate_links (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      product_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      sub_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS csv_import_presets (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS affiliate_orders (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      order_code TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(platform, order_code)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      amount_vnd INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      spent_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id TEXT PRIMARY KEY,
      pipeline TEXT NOT NULL,
      model TEXT NOT NULL,
      tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      read INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  seedInitialDataIfEmpty();
}

export function getSettings(): AppSettings {
  const row = db
    .prepare('SELECT value_json FROM kv_settings WHERE key = ?')
    .get('app_settings') as { value_json: string } | undefined;

  if (row) {
    return JSON.parse(row.value_json) as AppSettings;
  }

  const defaults: AppSettings = {
    onboardingCompleted: false,
    focusCategories: ['Gia dụng thông minh', 'Làm đẹp & Chăm sóc cá nhân', 'Phụ kiện công nghệ'],
    pipelines: {
      triageModel: 'gemini-3.1-flash-lite',
      researchModel: 'gemini-4-hydrogen',
      contentModel: 'gemini-4-hydrogen',
    },
    aiDailyTokenBudget: 250000,
    aiDailyBudgetHardStop: true,
    weights: { ...DEFAULT_WEIGHTS },
    thresholds: { ...DEFAULT_THRESHOLDS },
    publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
    xhsMcpEnabled: Boolean(process.env.XHS_MCP_URL),
    xhsMcpUrl: process.env.XHS_MCP_URL || 'http://host.docker.internal:18060',
    notifications: {
      webEnabled: true,
      telegramConfigured: false,
      smtpConfigured: false,
      quietHoursStart: '22:30',
      quietHoursEnd: '07:00',
      minScoreAlert: 80,
    },
  };

  saveSettings(defaults);
  return defaults;
}

export function saveSettings(settings: AppSettings): void {
  db.prepare(
    `INSERT INTO kv_settings (key, value_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
  ).run('app_settings', JSON.stringify(settings), new Date().toISOString());
}

export function logAiUsage(entry: {
  id: string;
  pipeline: string;
  model: string;
  tokens: number;
  costUsd: number;
  status: string;
}): void {
  db.prepare(
    `INSERT INTO ai_usage_logs (id, pipeline, model, tokens, cost_usd, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.id,
    entry.pipeline,
    entry.model,
    entry.tokens,
    entry.costUsd,
    entry.status,
    new Date().toISOString(),
  );
}

export function getTodayAiTokens(): number {
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const row = db
    .prepare('SELECT COALESCE(SUM(tokens), 0) AS total FROM ai_usage_logs WHERE created_at LIKE ?')
    .get(`${todayPrefix}%`) as { total: number };
  return row.total;
}

function seedInitialDataIfEmpty(): void {
  const existingSources = db.prepare('SELECT COUNT(*) AS cnt FROM data_sources').get() as { cnt: number };
  if (existingSources.cnt > 0) return;

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000).toISOString();

  // 1. Data Sources (Honest status separation per Spec Section 4)
  const sources: DataSourceRecord[] = [
    {
      id: 'trendradar',
      name: 'TrendRadar Hotlist & RSS',
      category: 'Collector',
      repoOrPlatform: 'sansan0/TrendRadar (v6.12.0 · GPL-3.0)',
      status: 'Healthy',
      dataMode: 'Full',
      lastSyncedAt: hoursAgo(1),
      validRecordRate: 98.4,
      latencyMs: 380,
      lastMessage: 'Đồng bộ thành công tín hiệu công khai (Hacker News, Reddit, Google Search Grounding).',
      configHint: 'Đọc file cấu hình config.yaml & frequency_words.txt trong trình chỉnh sửa bên dưới.',
      enabled: true,
    },
    {
      id: 'last30days_global',
      name: 'Last30Days Global Research',
      category: 'Deep Research',
      repoOrPlatform: 'mvanhorn/last30days-skill (v4.6.0 · MIT)',
      status: 'Healthy',
      dataMode: 'Full',
      lastSyncedAt: hoursAgo(2),
      validRecordRate: 96.2,
      latencyMs: 640,
      lastMessage: 'Chế độ Headless không cần cookie trình duyệt (FROM_BROWSER=none). Nguồn Reddit/HN/Web sẵn sàng.',
      configHint: 'Ưu tiên tuyệt đối nguồn không cần key; chạy theo yêu cầu qua hàng đợi nghiên cứu.',
      enabled: true,
    },
    {
      id: 'last30days_cn',
      name: 'Last30Days CN Research',
      category: 'Deep Research',
      repoOrPlatform: 'Jesseovo/last30days-skill-cn (v4.0.0 · MIT)',
      status: 'Degraded',
      dataMode: 'Public Fallback',
      lastSyncedAt: hoursAgo(3),
      validRecordRate: 84.0,
      latencyMs: 890,
      lastMessage: 'Đang chạy nguồn tìm kiếm công khai (public_search — giảm trọng số tin cậy). Cầu nối xiaohongshu-mcp chưa bật.',
      configHint: 'Bật cầu nối host http://host.docker.internal:18060 nếu cần dữ liệu tương tác sâu từ Xiaohongshu.',
      enabled: true,
    },
    {
      id: 'shopee_vn',
      name: 'Shopee Affiliate VN',
      category: 'Marketplace',
      repoOrPlatform: 'Shopee Open API / Manual + CSV Import',
      status: 'Not Configured',
      dataMode: 'Manual Only',
      lastSyncedAt: daysAgo(1),
      validRecordRate: 100,
      latencyMs: null,
      lastMessage: 'Chờ cấu hình — Shopee Open API chưa cấp quyền Partner. Đang hoạt động đầy đủ ở chế độ Nhập tay & CSV/XLSX.',
      configHint: 'Dùng nút "Thêm shop thủ công" trong Hồ sơ sản phẩm hoặc tải báo cáo tại Nhập CSV/XLSX.',
      enabled: true,
    },
    {
      id: 'tiktok_shop_vn',
      name: 'TikTok Shop Affiliate VN',
      category: 'Marketplace',
      repoOrPlatform: 'TikTok Shop Partner API / Manual + CSV Import',
      status: 'Not Configured',
      dataMode: 'Manual Only',
      lastSyncedAt: daysAgo(1),
      validRecordRate: 100,
      latencyMs: null,
      lastMessage: 'Chờ cấu hình — Chưa có App Key chính thức. Đang hoạt động ở chế độ Nhập tay & Import báo cáo.',
      configHint: 'Xuất báo cáo hoa hồng từ TikTok Shop Creator Center và nạp qua CSV/XLSX Wizard.',
      enabled: true,
    },
    {
      id: 'lazada_vn',
      name: 'Lazada Affiliate VN',
      category: 'Marketplace',
      repoOrPlatform: 'Lazada Open Platform / Manual + CSV Import',
      status: 'Not Configured',
      dataMode: 'Manual Only',
      lastSyncedAt: null,
      validRecordRate: null,
      latencyMs: null,
      lastMessage: 'Chờ cấu hình — Chưa kết nối API. Hỗ trợ nhập link sản phẩm và báo cáo CSV thủ công.',
      configHint: 'Xuất file báo cáo đơn hàng từ Lazada AdSense / Affiliate Portal để đối chiếu doanh thu.',
      enabled: true,
    },
  ];

  const insertSource = db.prepare('INSERT INTO data_sources (id, payload_json, updated_at) VALUES (?, ?, ?)');
  for (const src of sources) {
    insertSource.run(src.id, JSON.stringify(src), now.toISOString());
  }

  // 2. Starter Trend Topics (realistic multi-language signals + non-commercial filtered items)
  const trends: TrendTopic[] = [
    {
      id: 'tr_mini_printer',
      title: '迷你口袋热敏打印机 / Mini Pocket Thermal Printer',
      titleVi: 'Máy in nhiệt mini bỏ túi không cần mực cho học sinh & ghi chú',
      titleZh: '迷你口袋热敏打印机',
      titleEn: 'Mini Portable Pocket Thermal Printer',
      clusterKey: 'concept_mini_printer',
      category: 'Phụ kiện công nghệ',
      platforms: ['Douyin', 'Xiaohongshu', 'Reddit r/gadgets', 'TikTok Global'],
      region: 'CN→VN',
      language: 'multi',
      intent: 'Commercial Product',
      momentumScore: 91,
      mentionCount: 1840,
      rankCurrent: 4,
      rankDelta: 11,
      sparkline: [32, 41, 48, 56, 72, 84, 91],
      rankHistory: [
        { label: 'T-6', cnRank: 28, globalRank: 45, vnInterest: 22 },
        { label: 'T-5', cnRank: 21, globalRank: 39, vnInterest: 29 },
        { label: 'T-4', cnRank: 16, globalRank: 31, vnInterest: 38 },
        { label: 'T-3', cnRank: 12, globalRank: 25, vnInterest: 51 },
        { label: 'T-2', cnRank: 8, globalRank: 19, vnInterest: 64 },
        { label: 'T-1', cnRank: 5, globalRank: 14, vnInterest: 78 },
        { label: 'Hôm nay', cnRank: 4, globalRank: 11, vnInterest: 86 },
      ],
      sourceUrl: 'https://www.reddit.com/r/gadgets/',
      retrievalMode: 'hotboard_match',
      firstSeenAt: daysAgo(9),
      lastUpdatedAt: hoursAgo(1),
      linkedProductId: 'prod_mini_printer',
    },
    {
      id: 'tr_led_mask',
      title: '红光LED美容面罩 / Red Light LED Facial Therapy Mask',
      titleVi: 'Mặt nạ ánh sáng đỏ LED chăm sóc da tại nhà không dây',
      titleZh: '红光LED美容面罩',
      titleEn: 'Cordless Red Light LED Therapy Mask',
      clusterKey: 'concept_led_mask',
      category: 'Làm đẹp & Chăm sóc cá nhân',
      platforms: ['Xiaohongshu', 'Reddit r/SkincareAddiction', 'TikTok Global'],
      region: 'CN→VN',
      language: 'multi',
      intent: 'Commercial Product',
      momentumScore: 86,
      mentionCount: 1420,
      rankCurrent: 7,
      rankDelta: 8,
      sparkline: [44, 49, 55, 63, 70, 79, 86],
      rankHistory: [
        { label: 'T-6', cnRank: 24, globalRank: 33, vnInterest: 30 },
        { label: 'T-5', cnRank: 19, globalRank: 29, vnInterest: 36 },
        { label: 'T-4', cnRank: 17, globalRank: 24, vnInterest: 42 },
        { label: 'T-3', cnRank: 13, globalRank: 18, vnInterest: 49 },
        { label: 'T-2', cnRank: 10, globalRank: 15, vnInterest: 58 },
        { label: 'T-1', cnRank: 8, globalRank: 12, vnInterest: 67 },
        { label: 'Hôm nay', cnRank: 7, globalRank: 10, vnInterest: 74 },
      ],
      sourceUrl: 'https://www.reddit.com/r/SkincareAddiction/',
      retrievalMode: 'public_search',
      firstSeenAt: daysAgo(12),
      lastUpdatedAt: hoursAgo(2),
      linkedProductId: 'prod_led_mask',
    },
    {
      id: 'tr_magsafe_stand',
      title: '三合一折叠磁吸无线充 / Qi2 Foldable 3-in-1 MagSafe Travel Charger',
      titleVi: 'Đế sạc không dây Qi2 gập gọn 3 trong 1 nam châm du lịch',
      titleZh: '三合一折叠磁吸无线充',
      titleEn: 'Qi2 Foldable 3-in-1 MagSafe Travel Charger',
      clusterKey: 'concept_magsafe_powerbank',
      category: 'Phụ kiện công nghệ',
      platforms: ['Bilibili', 'Hacker News', 'Reddit r/gadgets'],
      region: 'Global',
      language: 'multi',
      intent: 'Commercial Product',
      momentumScore: 82,
      mentionCount: 980,
      rankCurrent: 9,
      rankDelta: 6,
      sparkline: [50, 52, 58, 65, 71, 77, 82],
      rankHistory: [
        { label: 'T-6', cnRank: 30, globalRank: 22, vnInterest: 34 },
        { label: 'T-5', cnRank: 26, globalRank: 19, vnInterest: 39 },
        { label: 'T-4', cnRank: 22, globalRank: 16, vnInterest: 45 },
        { label: 'T-3', cnRank: 18, globalRank: 14, vnInterest: 50 },
        { label: 'T-2', cnRank: 14, globalRank: 12, vnInterest: 56 },
        { label: 'T-1', cnRank: 11, globalRank: 10, vnInterest: 62 },
        { label: 'Hôm nay', cnRank: 9, globalRank: 9, vnInterest: 69 },
      ],
      sourceUrl: 'https://news.ycombinator.com/',
      retrievalMode: 'hotboard_match',
      firstSeenAt: daysAgo(7),
      lastUpdatedAt: hoursAgo(1),
      linkedProductId: 'prod_magsafe_stand',
    },
    {
      id: 'tr_steam_brush',
      title: '宠物蒸汽梳毛刷 / Self-Cleaning Pet Steam Grooming Brush',
      titleVi: 'Lược hơi nước chải lông chó mèo chống bay lông & massage',
      titleZh: '宠物蒸汽梳毛刷',
      titleEn: 'Pet Steam Grooming Brush',
      clusterKey: 'concept_pet_steam_brush',
      category: 'Gia dụng thông minh',
      platforms: ['Douyin', 'Xiaohongshu', 'TikTok Global'],
      region: 'CN→VN',
      language: 'multi',
      intent: 'Commercial Product',
      momentumScore: 79,
      mentionCount: 1190,
      rankCurrent: 12,
      rankDelta: 14,
      sparkline: [25, 34, 42, 54, 63, 71, 79],
      rankHistory: [
        { label: 'T-6', cnRank: 40, globalRank: 48, vnInterest: 15 },
        { label: 'T-5', cnRank: 32, globalRank: 41, vnInterest: 24 },
        { label: 'T-4', cnRank: 26, globalRank: 34, vnInterest: 33 },
        { label: 'T-3', cnRank: 21, globalRank: 27, vnInterest: 45 },
        { label: 'T-2', cnRank: 17, globalRank: 22, vnInterest: 53 },
        { label: 'T-1', cnRank: 14, globalRank: 18, vnInterest: 61 },
        { label: 'Hôm nay', cnRank: 12, globalRank: 15, vnInterest: 68 },
      ],
      sourceUrl: 'https://www.reddit.com/r/pets/',
      retrievalMode: 'public_search',
      firstSeenAt: daysAgo(5),
      lastUpdatedAt: hoursAgo(2),
      linkedProductId: 'prod_steam_brush',
    },
    {
      id: 'tr_oil_sprayer',
      title: '二合一倒油喷油瓶 / 2-in-1 Glass Olive Oil Dispenser & Sprayer',
      titleVi: 'Bình xịt & rót dầu ăn thủy tinh 2 trong 1 cho nồi chiên không dầu',
      titleZh: '二合一倒油喷油瓶',
      titleEn: '2-in-1 Glass Oil Dispenser and Sprayer',
      clusterKey: 'concept_oil_sprayer',
      category: 'Gia dụng thông minh',
      platforms: ['Douyin', 'Reddit r/BuyItForLife', 'Shopee Search'],
      region: 'CN→VN',
      language: 'vi',
      intent: 'Commercial Product',
      momentumScore: 74,
      mentionCount: 830,
      rankCurrent: 15,
      rankDelta: 5,
      sparkline: [55, 58, 60, 64, 67, 71, 74],
      rankHistory: [
        { label: 'T-6', cnRank: 22, globalRank: 30, vnInterest: 48 },
        { label: 'T-5', cnRank: 20, globalRank: 28, vnInterest: 52 },
        { label: 'T-4', cnRank: 19, globalRank: 25, vnInterest: 55 },
        { label: 'T-3', cnRank: 18, globalRank: 23, vnInterest: 58 },
        { label: 'T-2', cnRank: 17, globalRank: 20, vnInterest: 62 },
        { label: 'T-1', cnRank: 16, globalRank: 19, vnInterest: 66 },
        { label: 'Hôm nay', cnRank: 15, globalRank: 18, vnInterest: 70 },
      ],
      sourceUrl: 'https://www.reddit.com/r/BuyItForLife/',
      retrievalMode: 'hotboard_match',
      firstSeenAt: daysAgo(14),
      lastUpdatedAt: hoursAgo(3),
      linkedProductId: null,
    },
    {
      id: 'tr_news_filtered',
      title: 'Cập nhật lịch thi đấu bóng đá khu vực Đông Nam Á',
      titleVi: 'Cập nhật lịch thi đấu bóng đá khu vực Đông Nam Á',
      titleEn: 'SEA Regional Football Tournament Schedule Update',
      clusterKey: 'news_football_sea',
      category: 'Tin tức / Sự kiện',
      platforms: ['Google Trends VN', 'RSS News'],
      region: 'VN',
      language: 'vi',
      intent: 'News/Politics',
      momentumScore: 88,
      mentionCount: 4100,
      rankCurrent: 2,
      rankDelta: 18,
      sparkline: [20, 25, 30, 45, 70, 82, 88],
      rankHistory: [
        { label: 'T-6', cnRank: null, globalRank: null, vnInterest: 20 },
        { label: 'Hôm nay', cnRank: null, globalRank: null, vnInterest: 88 },
      ],
      sourceUrl: 'https://trends.google.com/',
      retrievalMode: 'hotboard_match',
      firstSeenAt: daysAgo(2),
      lastUpdatedAt: hoursAgo(1),
      linkedProductId: null,
    },
    {
      id: 'tr_concept_filtered',
      title: 'Humanoid Robot Prototype Walking Demo',
      titleVi: 'Nguyên mẫu robot hình người đi bộ thử nghiệm (chưa thương mại hóa)',
      titleEn: 'Humanoid Robot Prototype Walking Demo',
      clusterKey: 'tech_humanoid_demo',
      category: 'Công nghệ thử nghiệm',
      platforms: ['Hacker News', 'Weibo'],
      region: 'Global',
      language: 'en',
      intent: 'Tech/Concept Only',
      momentumScore: 76,
      mentionCount: 920,
      rankCurrent: 11,
      rankDelta: 4,
      sparkline: [60, 65, 68, 70, 72, 74, 76],
      rankHistory: [
        { label: 'T-6', cnRank: 18, globalRank: 12, vnInterest: 10 },
        { label: 'Hôm nay', cnRank: 14, globalRank: 11, vnInterest: 14 },
      ],
      sourceUrl: 'https://news.ycombinator.com/',
      retrievalMode: 'hotboard_match',
      firstSeenAt: daysAgo(3),
      lastUpdatedAt: hoursAgo(2),
      linkedProductId: null,
    },
  ];

  const insertTrend = db.prepare(
    `INSERT INTO trend_topics (id, cluster_key, intent, region, momentum_score, dismissed, payload_json, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
  );
  for (const t of trends) {
    insertTrend.run(t.id, t.clusterKey, t.intent, t.region, t.momentumScore, JSON.stringify(t), now.toISOString());
  }

  // 3. Starter Products with rigorous Evidence Discipline (including intentional Unknowns!)
  const products: ProductRecord[] = [
    {
      id: 'prod_mini_printer',
      trendId: 'tr_mini_printer',
      nameVi: 'Máy in nhiệt mini bỏ túi Bluetooth (không dùng mực)',
      nameZh: '迷你口袋热敏打印机',
      nameEn: 'Mini Portable Bluetooth Thermal Printer',
      aliases: ['Máy in mini', 'Pocket printer', 'Máy in ảnh học sinh', '迷你打印机'],
      category: 'Phụ kiện công nghệ',
      summary:
        'Máy in nhiệt kết nối Bluetooth 5.0 nhỏ gọn bằng lòng bàn tay, in ghi chú học tập, nhãn dán và checklist không cần thay hộp mực. Tốc độ lan truyền mạnh từ học sinh/sinh viên Trung Quốc sang cộng đồng StudyTok Việt Nam.',
      useCase: 'In tóm tắt bài học, in công thức, in sticker phân loại đồ bếp và danh sách việc cần làm hằng ngày.',
      customerPainPoints: [
        'Chép lại hình vẽ, sơ đồ hoặc ghi chú dài tốn thời gian',
        'Máy in văn phòng cồng kềnh và tốn chi phí mực in định kỳ',
        'Muốn phân loại lọ gia vị, mỹ phẩm gọn gàng nhưng chữ viết tay dễ nhòe',
      ],
      buyerPersona: 'Học sinh cấp 3, sinh viên đại học (16–23 tuổi), nhân viên văn phòng thích journaling và mẹ bỉm cần in nhãn đồ dùng.',
      detectedSource: 'TrendRadar (Douyin + Reddit r/gadgets)',
      detectedAt: daysAgo(9),
      marketSignals: {
        china: {
          summary: 'Tăng mạnh trong nhóm từ khóa văn phòng phẩm thông minh trên Douyin & Xiaohongshu dịp ôn thi; nhiều video demo in đề toán đạt tương tác cao.',
          status: 'verified_fact',
          sourceUrl: 'https://www.xiaohongshu.com/',
          retrievalMode: 'hotboard_match',
          recordedAt: daysAgo(1),
        },
        global: {
          summary: 'Thảo luận tích cực trên Reddit r/gadgets và StudyTok về bản độ phân giải 304dpi rõ nét hơn dòng 203dpi đời cũ.',
          status: 'verified_fact',
          sourceUrl: 'https://www.reddit.com/r/gadgets/',
          retrievalMode: 'authenticated',
          recordedAt: daysAgo(1),
        },
        vietnam: {
          summary: 'Đã xuất hiện các shop Shopee Mall và TikTok Shop phân phối kèm cuộn giấy in nhiệt; nhu cầu tăng rõ ở nhóm từ khóa "máy in mini học sinh".',
          status: 'verified_fact',
          sourceUrl: 'https://shopee.vn/',
          retrievalMode: 'manual',
          recordedAt: daysAgo(1),
        },
      },
      competitors: ['PeriPage A6', 'Phomemo M02', 'Niimbot D110'],
      verifiedPriceRangeVnd: { min: 245000, max: 489000, status: 'verified_fact', recordedAt: daysAgo(1) },
      verifiedCommissionRange: { min: 7.5, max: 11.0, status: 'verified_fact', recordedAt: daysAgo(1) },
      contentAngles: [
        'Test so sánh bản 203dpi vs 304dpi khi in sơ đồ sinh học nhỏ xíu',
        'Thử thách 15 giây in 5 nhãn dán phân loại tủ bếp siêu gọn',
        'Đập hộp máy in không tốn 1 giọt mực: có đáng tiền cho sinh viên?',
      ],
      risks: [
        { type: 'Chất lượng bản in', detail: 'Giấy in nhiệt giá rẻ dễ mờ chữ sau 6–12 tháng nếu để nơi nóng ẩm.', severity: 'Trung bình' },
        { type: 'Ứng dụng đi kèm', detail: 'Một số mẫu OEM yêu cầu app có quảng cáo hoặc lỗi font tiếng Việt.', severity: 'Trung bình' },
        { type: 'Cạnh tranh giá', detail: 'Phân khúc dưới 200k nhiều hàng không bảo hành gây đánh giá thấp.', severity: 'Thấp' },
      ],
      aiConclusion:
        'Cơ hội ưu tiên cao để triển khai video review thực tế dạng demo 30 giây. Khuyến nghị chỉ chọn link shop bán phiên bản hỗ trợ font tiếng Việt chuẩn và độ phân giải 300–304dpi để giảm tỷ lệ hoàn đơn.',
      criteria: [
        { key: 'trendGrowth', label: 'Tăng trưởng xu hướng', weight: 20, rating: 5, reason: 'Đà tăng liên tục 7 ngày trên cả Douyin và StudyTok (+11 bậc).', verification: 'verified_fact', sourceUrl: 'https://www.reddit.com/r/gadgets/', recordedAt: daysAgo(1) },
        { key: 'vietnamDemand', label: 'Nhu cầu tại Việt Nam', weight: 20, rating: 4, reason: 'Phù hợp tệp học sinh/sinh viên đông đảo, giá bán dễ chốt đơn < 500k.', verification: 'verified_fact', sourceUrl: 'https://shopee.vn/', recordedAt: daysAgo(1) },
        { key: 'competition', label: 'Mức độ cạnh tranh', weight: 15, rating: 4, reason: 'Có đối thủ nhưng góc nội dung so sánh 304dpi & app tiếng Việt vẫn còn khoảng trống.', verification: 'ai_inference', recordedAt: daysAgo(1) },
        { key: 'priceCommission', label: 'Giá bán & hoa hồng', weight: 20, rating: 4, reason: 'Giá 329k–450k, hoa hồng đã xác minh 8.5%–11% trên TikTok Shop/Shopee.', verification: 'verified_fact', sourceUrl: 'https://shopee.vn/', recordedAt: daysAgo(1) },
        { key: 'contentPotential', label: 'Khả năng tạo nội dung', weight: 15, rating: 5, reason: 'Cực kỳ dễ quay cảnh in trực tiếp trong 3 giây đầu (hook thị giác mạnh).', verification: 'ai_inference', recordedAt: daysAgo(1) },
        { key: 'supplyRisk', label: 'Cung ứng & rủi ro', weight: 10, rating: 4, reason: 'Hàng nhẹ dễ vận chuyển, có sẵn kho Việt Nam và giấy in thay thế.', verification: 'verified_fact', recordedAt: daysAgo(1) },
      ],
      scoreHistory: [
        { date: daysAgo(6).slice(0, 10), score: 74, completeness: 80, reason: 'Mới phát hiện tín hiệu từ Douyin, chưa có hoa hồng sàn VN.' },
        { date: daysAgo(3).slice(0, 10), score: 81, completeness: 90, reason: 'Xác thực thảo luận Reddit 304dpi và cập nhật giá Shopee.' },
        { date: daysAgo(1).slice(0, 10), score: 87, completeness: 100, reason: 'Xác minh đầy đủ tỷ lệ hoa hồng 11% tại TikTok Shop VN.' },
      ],
      evidence: [
        { id: 'ev_mp_1', productId: 'prod_mini_printer', field: 'Xu hướng toàn cầu', claim: 'Người dùng Reddit đánh giá cao bản 304dpi dùng in nhãn không mực', status: 'verified_fact', retrievalMode: 'authenticated', sourceName: 'Reddit r/gadgets', sourceUrl: 'https://www.reddit.com/r/gadgets/', recordedAt: daysAgo(1) },
        { id: 'ev_mp_2', productId: 'prod_mini_printer', field: 'Tín hiệu Trung Quốc', claim: 'Lọt Top 10 nhóm văn phòng phẩm học tập tuần qua', status: 'verified_fact', retrievalMode: 'hotboard_match', sourceName: 'TrendRadar CN', sourceUrl: 'https://www.xiaohongshu.com/', recordedAt: daysAgo(1) },
        { id: 'ev_mp_3', productId: 'prod_mini_printer', field: 'Hoa hồng sàn VN', claim: 'Shopee Mall 8.5% và TikTok Shop 11.0% kiểm tra thủ công', status: 'verified_fact', retrievalMode: 'manual', sourceName: 'Shopee & TikTok Shop VN', sourceUrl: 'https://shopee.vn/', recordedAt: daysAgo(1) },
        { id: 'ev_mp_4', productId: 'prod_mini_printer', field: 'Kịch bản chuyển đổi', claim: 'Góc quay in trực tiếp trong 3s đầu phù hợp TikTok Affiliate', status: 'ai_inference', retrievalMode: 'manual', sourceName: 'AI Research Pipeline 2', recordedAt: daysAgo(1), note: 'Suy luận từ định dạng video demo đồ công nghệ mini.' },
      ],
      marketplaceMatches: [
        {
          id: 'mm_mp_1',
          productId: 'prod_mini_printer',
          platform: 'Shopee',
          shopName: 'PeriPage Official Store VN',
          productTitle: 'Máy in nhiệt mini PeriPage A6 Pro 304dpi Bluetooth tặng 3 cuộn giấy',
          productUrl: 'https://shopee.vn/search?keyword=may+in+nhiet+mini+304dpi',
          priceVnd: 449000,
          commissionRate: 8.5,
          rating: 4.9,
          soldCountLabel: '3,2k đã bán',
          affiliateProgramStatus: 'Đang mở',
          promoExpiresAt: '2026-12-15',
          dataSource: 'Manual',
          verifiedAt: daysAgo(1),
          priceHistory: [
            { date: daysAgo(10).slice(0, 10), priceVnd: 479000 },
            { date: daysAgo(1).slice(0, 10), priceVnd: 449000 },
          ],
          operatorNote: 'Hỗ trợ tiếng Việt trong app, kho TP.HCM giao nhanh 2 ngày.',
        },
        {
          id: 'mm_mp_2',
          productId: 'prod_mini_printer',
          platform: 'TikTok Shop',
          shopName: 'Kido Tech Accessories',
          productTitle: 'Máy in mini bỏ túi không mực kèm 5 cuộn giấy sticker',
          productUrl: 'https://shop.tiktok.com/',
          priceVnd: 329000,
          commissionRate: 11.0,
          rating: 4.8,
          soldCountLabel: '1,8k đã bán',
          affiliateProgramStatus: 'Đang mở',
          promoExpiresAt: '2026-12-05',
          dataSource: 'Manual',
          verifiedAt: daysAgo(1),
          priceHistory: [{ date: daysAgo(1).slice(0, 10), priceVnd: 329000 }],
          operatorNote: 'Có chiến dịch hoa hồng cộng thêm 3% cho Creator.',
        },
      ],
      hasCnToVnSignal: true,
      updatedAt: hoursAgo(2),
    },
    {
      id: 'prod_magsafe_stand',
      trendId: 'tr_magsafe_stand',
      nameVi: 'Đế sạc không dây Qi2 gập gọn 3 trong 1 du lịch',
      nameZh: '三合一折叠磁吸无线充',
      nameEn: 'Qi2 Foldable 3-in-1 MagSafe Travel Charger',
      aliases: ['Sạc Qi2 3 trong 1', 'Đế sạc MagSafe gập gọn', 'Qi2 travel charger'],
      category: 'Phụ kiện công nghệ',
      summary:
        'Đế sạc chuẩn Qi2 15W gập mỏng chỉ 18mm, sạc cùng lúc iPhone, Apple Watch và tai nghe chỉ với 1 sợi cáp USB-C. Đang được thảo luận mạnh nhờ chuẩn Qi2 giảm nhiệt độ máy so với sạc không chứng nhận.',
      useCase: 'Mang đi công tác, du lịch hoặc tối giản dây sạc trên bàn làm việc.',
      customerPainPoints: [
        'Đi công tác phải mang 3 củ sạc và 3 dây rối trong balo',
        'Sạc nam châm giá rẻ gây nóng máy và chai pin nhanh',
      ],
      buyerPersona: 'Nhân viên văn phòng, freelancer, người dùng hệ sinh thái Apple thường xuyên di chuyển (24–38 tuổi).',
      detectedSource: 'TrendRadar (Hacker News + Bilibili)',
      detectedAt: daysAgo(7),
      marketSignals: {
        china: {
          summary: 'Nhiều kênh review công nghệ trên Bilibili so sánh tốc độ sạc chuẩn Qi2 15W với MagSafe gốc.',
          status: 'verified_fact',
          sourceUrl: 'https://www.bilibili.com/',
          retrievalMode: 'public_search',
          recordedAt: daysAgo(2),
        },
        global: {
          summary: 'Người dùng Reddit r/gadgets ưu tiên các mẫu có chứng nhận Qi2 và nhiệt độ mặt lưng dưới 39°C.',
          status: 'verified_fact',
          sourceUrl: 'https://www.reddit.com/r/gadgets/',
          retrievalMode: 'authenticated',
          recordedAt: daysAgo(1),
        },
        vietnam: {
          summary: 'Đã có các thương hiệu phụ kiện như Anker, Ugreen, Baseus mở bán chính hãng trên Shopee & Lazada.',
          status: 'verified_fact',
          sourceUrl: 'https://shopee.vn/',
          retrievalMode: 'manual',
          recordedAt: daysAgo(1),
        },
      },
      competitors: ['Anker MagGo 3-in-1', 'Ugreen MagFlow Qi2', 'Baseus Nomos'],
      verifiedPriceRangeVnd: { min: 690000, max: 1850000, status: 'verified_fact', recordedAt: daysAgo(1) },
      verifiedCommissionRange: { min: 6.0, max: 9.0, status: 'verified_fact', recordedAt: daysAgo(1) },
      contentAngles: [
        'Đo nhiệt độ thực tế bằng súng bắn nhiệt khi sạc Qi2 30 phút',
        'Gom toàn bộ đống dây sạc bàn làm việc thành 1 miếng vuông bỏ túi',
      ],
      risks: [
        { type: 'Giá bán trung-cao', detail: 'Giá trên 700k cần nội dung chứng minh độ an toàn pin để thuyết phục người mua.', severity: 'Trung bình' },
        { type: 'Chứng nhận Qi2 giả', detail: 'Cần kiểm tra rõ thương hiệu chính hãng để tránh quảng cáo sai thông số.', severity: 'Cao' },
      ],
      aiConclusion:
        'Giá trị đơn hàng cao mang lại hoa hồng tuyệt đối rất hấp dẫn (~65.000đ–120.000đ/đơn). Phù hợp nội dung review sâu có số liệu đo nhiệt độ và thời gian sạc.',
      criteria: [
        { key: 'trendGrowth', label: 'Tăng trưởng xu hướng', weight: 20, rating: 4, reason: 'Xu hướng chuyển dịch sang chuẩn Qi2 15W tăng đều tại Global và TQ.', verification: 'verified_fact', sourceUrl: 'https://news.ycombinator.com/', recordedAt: daysAgo(1) },
        { key: 'vietnamDemand', label: 'Nhu cầu tại Việt Nam', weight: 20, rating: 4, reason: 'Tệp người dùng iPhone tại VN lớn, nhu cầu tối giản bàn làm việc tăng.', verification: 'ai_inference', recordedAt: daysAgo(1) },
        { key: 'competition', label: 'Mức độ cạnh tranh', weight: 15, rating: 4, reason: 'Phân khúc Qi2 chính hãng ít cạnh tranh giá rẻ hơn sạc không dây thường.', verification: 'verified_fact', recordedAt: daysAgo(1) },
        { key: 'priceCommission', label: 'Giá bán & hoa hồng', weight: 20, rating: 5, reason: 'AOV cao (~950k), hoa hồng 7.5%–9% mang lại biên hoa hồng/đơn lớn.', verification: 'verified_fact', sourceUrl: 'https://shopee.vn/', recordedAt: daysAgo(1) },
        { key: 'contentPotential', label: 'Khả năng tạo nội dung', weight: 15, rating: 4, reason: 'Dễ làm góc setup desk & pack đồ du lịch thẩm mỹ cao.', verification: 'ai_inference', recordedAt: daysAgo(1) },
        { key: 'supplyRisk', label: 'Cung ứng & rủi ro', weight: 10, rating: 4, reason: 'Có Mall chính hãng bảo hành 12–18 tháng tại VN.', verification: 'verified_fact', recordedAt: daysAgo(1) },
      ],
      scoreHistory: [
        { date: daysAgo(5).slice(0, 10), score: 78, completeness: 85, reason: 'Bắt đầu theo dõi từ thảo luận Qi2 trên Reddit.' },
        { date: daysAgo(1).slice(0, 10), score: 84, completeness: 100, reason: 'Xác minh link Shopee Mall và hoa hồng 8%.' },
      ],
      evidence: [
        { id: 'ev_ms_1', productId: 'prod_magsafe_stand', field: 'Tiêu chuẩn kỹ thuật', claim: 'Qi2 cung cấp sạc không dây 15W ổn định cho iPhone 13–16', status: 'verified_fact', retrievalMode: 'authenticated', sourceName: 'Hacker News / Tech Specs', sourceUrl: 'https://news.ycombinator.com/', recordedAt: daysAgo(1) },
        { id: 'ev_ms_2', productId: 'prod_magsafe_stand', field: 'Phân phối VN', claim: 'Ugreen & Baseus có gian hàng Mall và chương trình Affiliate đang mở', status: 'verified_fact', retrievalMode: 'manual', sourceName: 'Shopee Mall VN', sourceUrl: 'https://shopee.vn/', recordedAt: daysAgo(1) },
      ],
      marketplaceMatches: [
        {
          id: 'mm_ms_1',
          productId: 'prod_magsafe_stand',
          platform: 'Shopee',
          shopName: 'UGREEN Official Store',
          productTitle: 'Đế sạc không dây UGREEN Qi2 15W 3 trong 1 gập gọn du lịch',
          productUrl: 'https://shopee.vn/search?keyword=ugreen+qi2+3+in+1',
          priceVnd: 990000,
          commissionRate: 8.0,
          rating: 4.9,
          soldCountLabel: '640 đã bán',
          affiliateProgramStatus: 'Đang mở',
          promoExpiresAt: '2026-12-31',
          dataSource: 'Manual',
          verifiedAt: daysAgo(1),
          priceHistory: [{ date: daysAgo(1).slice(0, 10), priceVnd: 990000 }],
        },
        {
          id: 'mm_ms_2',
          productId: 'prod_magsafe_stand',
          platform: 'Lazada',
          shopName: 'Baseus Flagship Store',
          productTitle: 'Sạc không dây từ tính 3 trong 1 Baseus Qi2 gập mỏng',
          productUrl: 'https://www.lazada.vn/catalog/?q=baseus+qi2+3+in+1',
          priceVnd: 890000,
          commissionRate: 6.5,
          rating: 4.8,
          soldCountLabel: '310 đã bán',
          affiliateProgramStatus: 'Đang mở',
          dataSource: 'Manual',
          verifiedAt: daysAgo(2),
          priceHistory: [{ date: daysAgo(2).slice(0, 10), priceVnd: 890000 }],
        },
      ],
      hasCnToVnSignal: false,
      updatedAt: hoursAgo(3),
    },
    {
      id: 'prod_led_mask',
      trendId: 'tr_led_mask',
      nameVi: 'Mặt nạ ánh sáng đỏ LED không dây chăm sóc da tại nhà',
      nameZh: '红光LED美容面罩',
      nameEn: 'Cordless Red Light LED Facial Mask',
      aliases: ['Mặt nạ LED ánh sáng sinh học', 'Red light mask', '红光面罩'],
      category: 'Làm đẹp & Chăm sóc cá nhân',
      summary:
        'Thiết bị làm đẹp đeo mặt bằng silicone mềm phát ánh sáng đỏ 630nm và cận hồng ngoại 830nm hỗ trợ phục hồi da. Xu hướng mạnh tại Trung Quốc và Âu Mỹ nhưng cần xác minh chứng nhận an toàn mắt & hoa hồng sàn VN.',
      useCase: 'Chăm sóc da buổi tối 10 phút tại nhà không cần dây cắm vướng víu.',
      customerPainPoints: [
        'Chi phí chiếu ánh sáng sinh học tại spa cao và tốn thời gian đi lại',
        'Mặt nạ nhựa cứng đời cũ nặng mặt và khó vừa vặn',
      ],
      buyerPersona: 'Phụ nữ 25–40 tuổi có thói quen skincare nâng cao và thu nhập khá.',
      detectedSource: 'TrendRadar (Xiaohongshu + Reddit r/SkincareAddiction)',
      detectedAt: daysAgo(12),
      marketSignals: {
        china: {
          summary: 'Nhiều bài review so sánh bước sóng 630nm/830nm trên Xiaohongshu (dữ liệu thu thập chế độ public_search, cần xác minh sâu).',
          status: 'ai_inference',
          sourceUrl: 'https://www.xiaohongshu.com/',
          retrievalMode: 'public_search',
          recordedAt: daysAgo(2),
        },
        global: {
          summary: 'Thảo luận lớn trên r/SkincareAddiction nhấn mạnh yếu tố công suất chiếu (mW/cm²) và chứng nhận an toàn mắt.',
          status: 'verified_fact',
          sourceUrl: 'https://www.reddit.com/r/SkincareAddiction/',
          retrievalMode: 'authenticated',
          recordedAt: daysAgo(2),
        },
        vietnam: {
          summary: 'Chưa xác minh mức hoa hồng chính thức trên Shopee/TikTok Shop cho các mẫu có chứng nhận rõ ràng.',
          status: 'unknown',
          retrievalMode: 'manual',
          recordedAt: daysAgo(2),
        },
      },
      competitors: ['CurrentBody Skin LED', 'Omnilux Contour', 'Halio LED Mask'],
      verifiedPriceRangeVnd: { min: 1450000, max: 3900000, status: 'ai_inference', recordedAt: daysAgo(2) },
      verifiedCommissionRange: { min: null, max: null, status: 'unknown' },
      contentAngles: [
        'Giải thích trung thực bước sóng 630nm & lưu ý an toàn khi chọn mặt nạ LED (không phóng đại công dụng y tế)',
      ],
      risks: [
        { type: 'Rủi ro quảng cáo & pháp lý', detail: 'Tuyệt đối không tuyên bố "chữa nám/trị mụn dứt điểm" trái quy định quảng cáo thiết bị làm đẹp.', severity: 'Cao' },
        { type: 'Thiếu dữ liệu hoa hồng', detail: 'Chưa xác minh shop uy tín có bật Affiliate trên sàn VN.', severity: 'Trung bình' },
      ],
      aiConclusion:
        'Tạm xếp loại Chờ xác minh (Pending Verification) vì còn thiếu dữ liệu xác thực về giá bán & tỷ lệ hoa hồng tại Việt Nam. Cần kiểm tra shop chính hãng trước khi lên kịch bản.',
      criteria: [
        { key: 'trendGrowth', label: 'Tăng trưởng xu hướng', weight: 20, rating: 4, reason: 'Tăng ổn định trên cộng đồng skincare quốc tế và TQ.', verification: 'verified_fact', sourceUrl: 'https://www.reddit.com/r/SkincareAddiction/', recordedAt: daysAgo(2) },
        { key: 'vietnamDemand', label: 'Nhu cầu tại Việt Nam', weight: 20, rating: 4, reason: 'Nhóm làm đẹp công nghệ tại VN có sức chi cao.', verification: 'ai_inference', recordedAt: daysAgo(2) },
        { key: 'competition', label: 'Mức độ cạnh tranh', weight: 15, rating: 4, reason: 'Ít creator làm nội dung chuyên sâu chuẩn xác về thông số kỹ thuật.', verification: 'ai_inference', recordedAt: daysAgo(2) },
        { key: 'priceCommission', label: 'Giá bán & hoa hồng', weight: 20, rating: null, reason: 'Chưa có dữ liệu hoa hồng xác minh từ Shopee/TikTok Shop VN.', verification: 'unknown' },
        { key: 'contentPotential', label: 'Khả năng tạo nội dung', weight: 15, rating: 4, reason: 'Hình ảnh thiết bị hiện đại, dễ tạo tò mò nhưng cần kiểm duyệt câu chữ.', verification: 'ai_inference', recordedAt: daysAgo(2) },
        { key: 'supplyRisk', label: 'Cung ứng & rủi ro', weight: 10, rating: 2, reason: 'Rủi ro cao về kiểm duyệt quảng cáo mỹ phẩm/thiết bị và bảo hành.', verification: 'verified_fact', recordedAt: daysAgo(2) },
      ],
      scoreHistory: [
        { date: daysAgo(4).slice(0, 10), score: 75, completeness: 80, reason: 'Tạm tính — thiếu tiêu chí Giá bán & hoa hồng.' },
      ],
      evidence: [
        { id: 'ev_lm_1', productId: 'prod_led_mask', field: 'Phản hồi người dùng', claim: 'Người dùng Reddit cảnh báo tránh mặt nạ giá rẻ không rõ bước sóng', status: 'verified_fact', retrievalMode: 'authenticated', sourceName: 'Reddit r/SkincareAddiction', sourceUrl: 'https://www.reddit.com/r/SkincareAddiction/', recordedAt: daysAgo(2) },
        { id: 'ev_lm_2', productId: 'prod_led_mask', field: 'Hoa hồng Affiliate VN', claim: 'Chưa ghi nhận tỷ lệ hoa hồng xác thực', status: 'unknown', retrievalMode: 'manual', sourceName: 'Chưa cấu hình', recordedAt: daysAgo(2) },
      ],
      marketplaceMatches: [
        {
          id: 'mm_lm_1',
          productId: 'prod_led_mask',
          platform: 'Shopee',
          shopName: 'BeautyTech VN (Chưa xác minh hoa hồng)',
          productTitle: 'Mặt nạ ánh sáng sinh học LED Silicone không dây 630nm',
          productUrl: 'https://shopee.vn/search?keyword=mat+na+led+anh+sang+do',
          priceVnd: 1890000,
          commissionRate: null,
          rating: 4.7,
          soldCountLabel: '120 đã bán',
          affiliateProgramStatus: 'Chưa xác minh',
          dataSource: 'Manual',
          verifiedAt: daysAgo(9), // Intentionally > 7 days to demonstrate Outdated warning
          operatorNote: 'Cần kiểm tra lại chương trình hoa hồng và giấy tờ bảo hành.',
        },
      ],
      hasCnToVnSignal: true,
      updatedAt: hoursAgo(5),
    },
    {
      id: 'prod_steam_brush',
      trendId: 'tr_steam_brush',
      nameVi: 'Lược hơi nước chải lông thú cưng chống bay lông',
      nameZh: '宠物蒸汽梳毛刷',
      nameEn: 'Self-Cleaning Pet Steam Grooming Brush',
      aliases: ['Lược hơi nước chó mèo', 'Pet steam brush', '宠物蒸汽梳'],
      category: 'Gia dụng thông minh',
      summary:
        'Lược chải lông tích hợp bình phun sương siêu mịn giúp gỡ rối, gom lông rụng thành mảng gọn không bay khắp phòng, sạc USB-C. Giá rẻ dễ tạo đơn hàng xung động trên TikTok Shop.',
      useCase: 'Chải lông định kỳ cho mèo và chó lông dài tại căn hộ chung cư.',
      customerPainPoints: [
        'Lông mèo bay lơ lửng khi chải bằng lược thường gây dị ứng',
        'Thú cưng sợ tiếng máy sấy hoặc tắm nước thường xuyên',
      ],
      buyerPersona: 'Người trẻ nuôi mèo/chó tại chung cư (20–35 tuổi).',
      detectedSource: 'TrendRadar (Douyin + TikTok Global)',
      detectedAt: daysAgo(5),
      marketSignals: {
        china: {
          summary: 'Video chải lông mèo phun sương tạo hiệu ứng thị giác mạnh trên Douyin (public_search).',
          status: 'verified_fact',
          sourceUrl: 'https://www.douyin.com/',
          retrievalMode: 'public_search',
          recordedAt: daysAgo(1),
        },
        global: {
          summary: 'Xuất hiện nhiều clip viral trên TikTok US/UK trong 30 ngày qua.',
          status: 'ai_inference',
          retrievalMode: 'public_search',
          recordedAt: daysAgo(1),
        },
        vietnam: {
          summary: 'Giá bán phổ biến 79.000đ–149.000đ, hoa hồng 10%–12% trên TikTok Shop.',
          status: 'verified_fact',
          sourceUrl: 'https://shop.tiktok.com/',
          retrievalMode: 'manual',
          recordedAt: daysAgo(1),
        },
      },
      competitors: ['Lược chải lông có nút bấm đẩy lông', 'Găng tay vuốt lông thú cưng'],
      verifiedPriceRangeVnd: { min: 79000, max: 149000, status: 'verified_fact', recordedAt: daysAgo(1) },
      verifiedCommissionRange: { min: 10.0, max: 12.0, status: 'verified_fact', recordedAt: daysAgo(1) },
      contentAngles: [
        'Cận cảnh lớp sương mịn gom trọn búi lông mèo trong 15 giây mà boss vẫn nằm im',
      ],
      risks: [
        { type: 'Giá trị đơn thấp', detail: 'Hoa hồng mỗi đơn khoảng 10k–15k, cần lượt xem cao hoặc bán kèm combo sữa tắm khô.', severity: 'Trung bình' },
      ],
      aiConclusion:
        'Sản phẩm dễ lên xu hướng video ngắn nhờ hình ảnh thú cưng dễ thương, tỷ lệ chốt đơn xung động cao. Nên bán kèm combo để tăng giá trị đơn hàng.',
      criteria: [
        { key: 'trendGrowth', label: 'Tăng trưởng xu hướng', weight: 20, rating: 4, reason: 'Tăng tốc nhanh (+14 bậc) trong 5 ngày qua.', verification: 'verified_fact', recordedAt: daysAgo(1) },
        { key: 'vietnamDemand', label: 'Nhu cầu tại Việt Nam', weight: 20, rating: 4, reason: 'Cộng đồng nuôi thú cưng đô thị tăng trưởng mạnh.', verification: 'ai_inference', recordedAt: daysAgo(1) },
        { key: 'competition', label: 'Mức độ cạnh tranh', weight: 15, rating: 3, reason: 'Nhiều shop bán giá rẻ nên cần video tự quay chân thực để nổi bật.', verification: 'verified_fact', recordedAt: daysAgo(1) },
        { key: 'priceCommission', label: 'Giá bán & hoa hồng', weight: 20, rating: 3, reason: 'Tỷ lệ hoa hồng tốt (12%) nhưng giá bán thấp (~115k).', verification: 'verified_fact', recordedAt: daysAgo(1) },
        { key: 'contentPotential', label: 'Khả năng tạo nội dung', weight: 15, rating: 5, reason: 'Nội dung thú cưng có tỷ lệ giữ chân 3 giây đầu rất cao.', verification: 'ai_inference', recordedAt: daysAgo(1) },
        { key: 'supplyRisk', label: 'Cung ứng & rủi ro', weight: 10, rating: 4, reason: 'Sẵn hàng, ít lỗi vận chuyển.', verification: 'verified_fact', recordedAt: daysAgo(1) },
      ],
      scoreHistory: [
        { date: daysAgo(3).slice(0, 10), score: 72, completeness: 90, reason: 'Bắt đầu vào radar từ Douyin.' },
        { date: daysAgo(1).slice(0, 10), score: 76, completeness: 100, reason: 'Cập nhật giá và hoa hồng TikTok Shop.' },
      ],
      evidence: [
        { id: 'ev_sb_1', productId: 'prod_steam_brush', field: 'Xu hướng nội dung', claim: 'Video demo chải lông phun sương phổ biến trong nhóm PetTok', status: 'verified_fact', retrievalMode: 'public_search', sourceName: 'Last30Days CN (Public)', recordedAt: daysAgo(1) },
        { id: 'ev_sb_2', productId: 'prod_steam_brush', field: 'Giá & Hoa hồng', claim: '115.000đ · 12% hoa hồng TikTok Shop', status: 'verified_fact', retrievalMode: 'manual', sourceName: 'TikTok Shop VN', recordedAt: daysAgo(1) },
      ],
      marketplaceMatches: [
        {
          id: 'mm_sb_1',
          productId: 'prod_steam_brush',
          platform: 'TikTok Shop',
          shopName: 'MeowHouse Pet Shop',
          productTitle: 'Lược hơi nước chải lông mèo chó 3 trong 1 sạc USB',
          productUrl: 'https://shop.tiktok.com/',
          priceVnd: 115000,
          commissionRate: 12.0,
          rating: 4.8,
          soldCountLabel: '4,1k đã bán',
          affiliateProgramStatus: 'Đang mở',
          dataSource: 'Manual',
          verifiedAt: daysAgo(1),
        },
      ],
      hasCnToVnSignal: true,
      updatedAt: hoursAgo(4),
    },
  ];

  const insertProd = db.prepare(
    'INSERT INTO products (id, trend_id, category, name_vi, payload_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  for (const p of products) {
    insertProd.run(p.id, p.trendId ?? null, p.category, p.nameVi, JSON.stringify(p), now.toISOString());
  }

  // 4. Starter Research Runs
  const runs: ResearchRun[] = [
    {
      id: 'run_seed_1',
      keyword: 'Máy in nhiệt mini bỏ túi 304dpi',
      trendId: 'tr_mini_printer',
      productId: 'prod_mini_printer',
      status: 'completed',
      progress: 100,
      sourcesUsed: ['Last30Days Global (Reddit/Web)', 'Last30Days CN (Public Search)', 'Gemini Pipeline 2'],
      retrievalModes: ['authenticated', 'hotboard_match', 'public_search'],
      steps: [
        { step: 'global', label: 'Quét Last30Days Global (30 ngày)', status: 'completed', detail: 'Thu thập 18 thảo luận Reddit & Web về bản 304dpi vs 203dpi.', timestamp: hoursAgo(4) },
        { step: 'cn', label: 'Quét Last30Days CN (Public Search)', status: 'warning', detail: 'Hoàn tất qua nguồn công khai (public_search — không có phiên xiaohongshu-mcp).', timestamp: hoursAgo(4) },
        { step: 'extract', label: 'AI Pipeline 2: Tổng hợp hồ sơ & gắn nhãn bằng chứng', status: 'completed', detail: 'Tạo hồ sơ 360° với 3 Verified Facts và 1 AI Inference.', timestamp: hoursAgo(4) },
        { step: 'score', label: 'Chấm điểm cơ hội (Null-safe)', status: 'completed', detail: 'Đạt 87/100 · Độ đầy đủ 100% · Xếp loại Ưu tiên cao.', timestamp: hoursAgo(4) },
      ],
      tokensUsed: 4280,
      estimatedCostUsd: 0.0043,
      createdAt: hoursAgo(4),
      completedAt: hoursAgo(4),
    },
  ];

  const insertRun = db.prepare(
    'INSERT INTO research_runs (id, keyword, status, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  for (const r of runs) {
    insertRun.run(r.id, r.keyword, r.status, JSON.stringify(r), r.createdAt);
  }

  // 5. Starter Content Assets (v1.1)
  const contentAssets: ContentAsset[] = [
    {
      id: 'cnt_seed_1',
      productId: 'prod_mini_printer',
      productName: 'Máy in nhiệt mini bỏ túi Bluetooth (không dùng mực)',
      title: 'Test máy in nhiệt mini 304dpi in sơ đồ ôn thi không cần mực',
      durationSec: 30,
      platform: 'TikTok',
      version: 1,
      status: 'Scheduled',
      scheduledDate: new Date(now.getTime() + 86400_000).toISOString().slice(0, 10),
      hook: 'Đừng mua máy in mini 203dpi nữa — xem sự khác biệt khi in chữ nhỏ bằng bản 304dpi không tốn một giọt mực!',
      voiceOver:
        'Nhiều bạn sinh viên mua máy in mini về nhưng in công thức toàn bị mờ. Hôm nay mình test thực tế bản 304dpi kết nối Bluetooth trong 5 giây. Giấy nhiệt có sẵn keo dán, xé ra dán thẳng vào vở hoặc lọ gia vị cực gọn. Điểm cần lưu ý là tránh để giấy gần bếp nóng vì sẽ bị sẫm màu.',
      storyboard: [
        { time: '00:00–00:04', visual: 'Cận cảnh tay xé dải giấy vừa in ra sơ đồ sinh học sắc nét.', audio: 'Hook thoại nhanh + tiếng máy in nhiệt rè nhẹ.', textOverlay: 'Máy in KHÔNG MỰC 304dpi nét cỡ nào?' },
        { time: '00:05–00:14', visual: 'Chia đôi màn hình so sánh bản in 203dpi hơi rỗ với bản 304dpi.', audio: 'Giải thích lý do nên chọn đúng độ phân giải 304dpi.', textOverlay: '203dpi vs 304dpi thực tế' },
        { time: '00:15–00:24', visual: 'Dán trực tiếp sticker nhãn tên lên sổ tay và hộp đồ bếp.', audio: 'Nêu ứng dụng thực tế & điểm trừ trung thực về bảo quản giấy.', textOverlay: 'In ghi chú · Nhãn dán · Checklist' },
        { time: '00:25–00:30', visual: 'Quay trọn bộ hộp máy + 3 cuộn giấy, chỉ tay xuống góc trái.', audio: 'CTA nhẹ nhàng mời xem giỏ hàng kiểm tra bản chính hãng.', textOverlay: 'Bản hỗ trợ tiếng Việt ở giỏ hàng' },
      ],
      caption: 'Test thực tế máy in nhiệt mini 304dpi cho mùa ôn thi — không cần đổ mực, hỗ trợ font tiếng Việt rõ nét. Lưu ý nhỏ ở cuối clip trước khi chốt nha!',
      hashtags: ['#mayinmini', '#studytokvn', '#reviewcongnghe', '#gocbanhoc', '#affiliatevn'],
      cta: 'Bấm vào giỏ hàng góc trái để xem đúng phiên bản 304dpi kèm giấy sticker nhé.',
      visualPrompt: 'Overhead studio desk setup of a compact matte white pocket thermal printer printing clean minimalist study notes next to an open notebook, soft daylight, crisp 9:16 vertical product photography.',
      createdAt: daysAgo(1),
      updatedAt: hoursAgo(6),
    },
    {
      id: 'cnt_seed_2',
      productId: 'prod_magsafe_stand',
      productName: 'Đế sạc không dây Qi2 gập gọn 3 trong 1 du lịch',
      title: 'Đo nhiệt độ thực tế đế sạc Qi2 3-trong-1 khi sạc iPhone 30 phút',
      durationSec: 60,
      platform: 'TikTok',
      version: 1,
      status: 'Review',
      scheduledDate: new Date(now.getTime() + 2 * 86400_000).toISOString().slice(0, 10),
      hook: 'Balo đi công tác hết sạch cảnh rối 3 sợi dây sạc nhờ cục sạc gập mỏng bằng hộp phấn chuẩn Qi2 này!',
      voiceOver:
        'Ai dùng hệ sinh thái Apple đi du lịch đều ngán cảnh mang đủ bộ dây điện thoại, đồng hồ và tai nghe. Đế sạc chuẩn Qi2 15W này gập gọn bỏ vừa túi áo, đo nhiệt độ thực tế sau 30 phút chỉ khoảng 37.8 độ C nhờ chuẩn Qi2 chính thức.',
      storyboard: [
        { time: '00:00–00:05', visual: 'Đổ đống dây sạc rối lên bàn rồi gạt sang, đặt đế sạc gập gọn vào giữa.', audio: 'Hook đối lập trực quan.', textOverlay: 'Gom 3 dây sạc thành 1' },
        { time: '00:06–00:25', visual: 'Mở khớp gập, đặt iPhone, Apple Watch và tai nghe lên sạc cùng lúc.', audio: 'Thuyết minh công suất Qi2 15W.', textOverlay: 'Chuẩn Qi2 15W chính thức' },
        { time: '00:26–00:48', visual: 'Dùng nhiệt kế hồng ngoại đo mặt lưng máy sau 30 phút sạc.', audio: 'Công bố số đo thực tế và đánh giá trung thực.', textOverlay: 'Test nhiệt thực tế sau 30 phút' },
        { time: '00:49–00:60', visual: 'Gập gọn cho vào ngăn nhỏ balo.', audio: 'CTA kiểm tra mã giảm giá trên giỏ hàng.', textOverlay: 'Link gian hàng Mall ở dưới' },
      ],
      caption: 'Tối giản bàn làm việc & đồ đi công tác với đế sạc Qi2 3-in-1 gập gọn. Có test nhiệt thực tế ở giữa video!',
      hashtags: ['#setupbanlamviec', '#qi2', '#phukienapple', '#reviewthat', '#techvn'],
      cta: 'Xem chi tiết gian hàng Mall bảo hành 18 tháng ngay bên dưới.',
      visualPrompt: 'Minimalist walnut wood workspace with a foldable graphite Qi2 3-in-1 magnetic wireless charger charging a smartphone and smartwatch, soft morning window light, 9:16 vertical editorial shot.',
      createdAt: daysAgo(1),
      updatedAt: hoursAgo(3),
    },
    {
      id: 'cnt_seed_3',
      productId: 'prod_steam_brush',
      productName: 'Lược hơi nước chải lông thú cưng chống bay lông',
      title: '15s gom sạch lông mèo không bay bụi với lược phun sương',
      durationSec: 15,
      platform: 'Shopee Video',
      version: 1,
      status: 'Draft',
      scheduledDate: new Date(now.getTime() + 3 * 86400_000).toISOString().slice(0, 10),
      hook: 'Nhà nuôi mèo chung cư nhìn cảnh mảng lông gom lại gọn ơ trong 10 giây này mê liền!',
      voiceOver: 'Bật nút phun sương siêu mịn trước khi chải giúp lông dính gọn vào lược, không bay mù mịt khắp sofa.',
      storyboard: [
        { time: '00:00–00:05', visual: 'Bấm nút phun sương nhẹ lên lược và chải mượt lưng mèo.', audio: 'Nhạc nền nhẹ + thoại ngắn.', textOverlay: 'Chải lông không bay bụi' },
        { time: '00:06–00:15', visual: 'Lột nguyên miếng lông gọn khỏi mặt lược silicon.', audio: 'CTA giỏ hàng Shopee Video.', textOverlay: 'Gom gọn trong 1 lần lột' },
      ],
      caption: 'Cứu tinh cho hội nuôi boss ở chung cư — chải êm, không bay lông lơ lửng!',
      hashtags: ['#nuoimeo', '#luochoinuoc', '#shopeevideo', '#petcarevn'],
      cta: 'Săn voucher Shopee Video trực tiếp ở link sản phẩm nhé.',
      visualPrompt: 'Close-up cozy living room scene brushing a calm British Shorthair cat with a pastel misting pet brush, warm natural lighting, clean editorial style.',
      createdAt: hoursAgo(12),
      updatedAt: hoursAgo(12),
    },
  ];

  const insertContent = db.prepare(
    'INSERT INTO content_assets (id, product_id, status, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)',
  );
  for (const c of contentAssets) {
    insertContent.run(c.id, c.productId, c.status, JSON.stringify(c), c.updatedAt);
  }

  // 6. Starter Campaigns & Affiliate Links (v1.1)
  const campaigns: CampaignRecord[] = [
    {
      id: 'cmp_q4_tech',
      name: 'Chiến dịch Phụ kiện Học tập & Desk Setup Q4',
      objective: 'Tập trung sản phẩm AOV 300k–1 triệu có hoa hồng xác minh ≥ 8% trên Shopee & TikTok Shop.',
      status: 'Đang chạy',
      startDate: daysAgo(14).slice(0, 10),
      endDate: '2026-12-31',
      budgetVnd: 1500000,
      productIds: ['prod_mini_printer', 'prod_magsafe_stand'],
      createdAt: daysAgo(14),
    },
    {
      id: 'cmp_pet_viral',
      name: 'Thử nghiệm Video ngắn Gia dụng & Thú cưng',
      objective: 'Test tỷ lệ chuyển đổi video 15s trên TikTok Shop & Shopee Video.',
      status: 'Đang chạy',
      startDate: daysAgo(5).slice(0, 10),
      endDate: '2026-12-15',
      budgetVnd: 500000,
      productIds: ['prod_steam_brush'],
      createdAt: daysAgo(5),
    },
  ];

  const insertCampaign = db.prepare(
    'INSERT INTO campaigns (id, status, payload_json, created_at) VALUES (?, ?, ?, ?)',
  );
  for (const cmp of campaigns) {
    insertCampaign.run(cmp.id, cmp.status, JSON.stringify(cmp), cmp.createdAt);
  }

  const links: AffiliateLinkRecord[] = [
    {
      id: 'lnk_1',
      campaignId: 'cmp_q4_tech',
      productId: 'prod_mini_printer',
      productName: 'Máy in nhiệt mini bỏ túi Bluetooth (không dùng mực)',
      platform: 'Shopee',
      originalAffiliateUrl: 'https://shope.ee/example-peripage-304dpi',
      subId: 'q4_printer_tt01',
      utmSource: 'tiktok',
      utmCampaign: 'q4_tech_desk',
      trackingUrl: 'https://shope.ee/example-peripage-304dpi?sub_id=q4_printer_tt01&utm_source=tiktok&utm_campaign=q4_tech_desk',
      trackingMode: 'Sub_id / UTM (Local)',
      stockStatus: 'Còn hàng',
      promoExpiresAt: '2026-12-15',
      clicks: 842,
      createdAt: daysAgo(10),
    },
    {
      id: 'lnk_2',
      campaignId: 'cmp_q4_tech',
      productId: 'prod_magsafe_stand',
      productName: 'Đế sạc không dây Qi2 gập gọn 3 trong 1 du lịch',
      platform: 'Shopee',
      originalAffiliateUrl: 'https://shope.ee/example-ugreen-qi2',
      subId: 'q4_qi2_desk02',
      utmSource: 'tiktok',
      utmCampaign: 'q4_tech_desk',
      trackingUrl: 'https://shope.ee/example-ugreen-qi2?sub_id=q4_qi2_desk02&utm_source=tiktok&utm_campaign=q4_tech_desk',
      trackingMode: 'Sub_id / UTM (Local)',
      stockStatus: 'Còn hàng',
      promoExpiresAt: '2026-12-31',
      clicks: 516,
      createdAt: daysAgo(7),
    },
    {
      id: 'lnk_3',
      campaignId: 'cmp_pet_viral',
      productId: 'prod_steam_brush',
      productName: 'Lược hơi nước chải lông thú cưng chống bay lông',
      platform: 'TikTok Shop',
      originalAffiliateUrl: 'https://shop.tiktok.com/view/product/example-pet-brush',
      subId: 'pet_brush_vid01',
      utmSource: 'tiktok_shop',
      utmCampaign: 'pet_viral',
      trackingUrl: 'https://shop.tiktok.com/view/product/example-pet-brush?sub_id=pet_brush_vid01',
      trackingMode: 'Sub_id / UTM (Local)',
      stockStatus: 'Còn hàng',
      promoExpiresAt: '2026-12-10',
      clicks: 690,
      createdAt: daysAgo(4),
    },
  ];

  const insertLink = db.prepare(
    'INSERT INTO affiliate_links (id, campaign_id, product_id, platform, sub_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  for (const l of links) {
    insertLink.run(l.id, l.campaignId, l.productId, l.platform, l.subId, JSON.stringify(l), l.createdAt);
  }

  // 7. Starter CSV Mapping Presets
  const presets: CsvImportPreset[] = [
    {
      id: 'preset_shopee_vn',
      name: 'Shopee Affiliate VN (Chuẩn xuất CSV)',
      platform: 'Shopee',
      mapping: {
        orderCode: 'Mã đơn hàng',
        productName: 'Tên sản phẩm',
        orderValueVnd: 'Giá trị đơn (VNĐ)',
        commissionVnd: 'Hoa hồng (VNĐ)',
        orderStatus: 'Trạng thái',
        subId: 'Sub_id',
        createdAt: 'Ngày tạo đơn',
      },
    },
    {
      id: 'preset_tiktok_vn',
      name: 'TikTok Shop Creator Center',
      platform: 'TikTok Shop',
      mapping: {
        orderCode: 'Order ID',
        productName: 'Product Name',
        orderValueVnd: 'Order Amount',
        commissionVnd: 'Est. Commission',
        orderStatus: 'Order Status',
        subId: 'Sub ID',
        createdAt: 'Created Time',
      },
    },
  ];
  const insertPreset = db.prepare('INSERT INTO csv_import_presets (id, platform, payload_json) VALUES (?, ?, ?)');
  for (const pr of presets) {
    insertPreset.run(pr.id, pr.platform, JSON.stringify(pr));
  }

  // 8. Starter Imported Affiliate Orders & Expenses (strictly tagged by provenance)
  const orders: AffiliateOrderRecord[] = [
    { id: 'ord_1', batchId: 'batch_init', platform: 'Shopee', orderCode: '261112AB91X01', productName: 'Máy in nhiệt mini PeriPage A6 Pro 304dpi', subId: 'q4_printer_tt01', orderValueVnd: 449000, commissionVnd: 38165, status: 'Thực nhận', dataSource: 'Sàn xác nhận', createdAt: daysAgo(10) },
    { id: 'ord_2', batchId: 'batch_init', platform: 'Shopee', orderCode: '261114CD82Y02', productName: 'Máy in nhiệt mini PeriPage A6 Pro 304dpi', subId: 'q4_printer_tt01', orderValueVnd: 898000, commissionVnd: 76330, status: 'Thực nhận', dataSource: 'Sàn xác nhận', createdAt: daysAgo(8) },
    { id: 'ord_3', batchId: 'batch_init', platform: 'Shopee', orderCode: '261116EF33Z03', productName: 'Đế sạc không dây UGREEN Qi2 15W 3 trong 1', subId: 'q4_qi2_desk02', orderValueVnd: 990000, commissionVnd: 79200, status: 'Thực nhận', dataSource: 'Sàn xác nhận', createdAt: daysAgo(6) },
    { id: 'ord_4', batchId: 'batch_init', platform: 'TikTok Shop', orderCode: 'TT5782910441', productName: 'Máy in mini bỏ túi không mực kèm 5 cuộn giấy', subId: 'q4_printer_tt01', orderValueVnd: 329000, commissionVnd: 36190, status: 'Đã duyệt', dataSource: 'Sàn xác nhận', createdAt: daysAgo(4) },
    { id: 'ord_5', batchId: 'batch_init', platform: 'TikTok Shop', orderCode: 'TT5782910442', productName: 'Lược hơi nước chải lông mèo chó 3 trong 1', subId: 'pet_brush_vid01', orderValueVnd: 230000, commissionVnd: 27600, status: 'Chờ duyệt', dataSource: 'Sàn xác nhận', createdAt: daysAgo(2) },
    { id: 'ord_6', batchId: 'batch_init', platform: 'Shopee', orderCode: '261120GH44W06', productName: 'Đế sạc không dây UGREEN Qi2 15W 3 trong 1', subId: 'q4_qi2_desk02', orderValueVnd: 990000, commissionVnd: 79200, status: 'Chờ duyệt', dataSource: 'Sàn xác nhận', createdAt: daysAgo(1) },
    { id: 'ord_7', batchId: 'batch_init', platform: 'TikTok Shop', orderCode: 'TT5782910449', productName: 'Lược hơi nước chải lông mèo chó 3 trong 1', subId: 'pet_brush_vid01', orderValueVnd: 115000, commissionVnd: 13800, status: 'Đã hủy', dataSource: 'Sàn xác nhận', createdAt: daysAgo(1) },
    { id: 'ord_8', batchId: 'batch_init', platform: 'Lazada', orderCode: 'LZ902184421', productName: 'Sạc không dây từ tính 3 trong 1 Baseus Qi2', subId: 'q4_qi2_desk02', orderValueVnd: 890000, commissionVnd: 57850, status: 'Thực nhận', dataSource: 'Sàn xác nhận', createdAt: daysAgo(5) },
  ];

  const insertOrder = db.prepare(
    'INSERT INTO affiliate_orders (id, batch_id, platform, order_code, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  for (const o of orders) {
    insertOrder.run(o.id, o.batchId, o.platform, o.orderCode, JSON.stringify(o), o.createdAt);
  }

  const expenses: ExpenseRecord[] = [
    { id: 'exp_1', category: 'Mẫu sản phẩm', description: 'Mua mẫu Máy in nhiệt mini 304dpi để quay review thực tế', amountVnd: 449000, campaignId: 'cmp_q4_tech', spentAt: daysAgo(12).slice(0, 10) },
    { id: 'exp_2', category: 'Sản xuất nội dung', description: 'Đèn nền bàn làm việc & cuộn giấy in thử', amountVnd: 180000, campaignId: 'cmp_q4_tech', spentAt: daysAgo(9).slice(0, 10) },
    { id: 'exp_3', category: 'Quảng cáo', description: 'Boost video TikTok thử nghiệm nhóm học sinh', amountVnd: 250000, campaignId: 'cmp_q4_tech', spentAt: daysAgo(4).slice(0, 10) },
  ];

  const insertExpense = db.prepare(
    'INSERT INTO expenses (id, category, amount_vnd, payload_json, spent_at) VALUES (?, ?, ?, ?, ?)',
  );
  for (const e of expenses) {
    insertExpense.run(e.id, e.category, e.amountVnd, JSON.stringify(e), e.spentAt);
  }

  // 9. Starter AI usage logs & notifications
  logAiUsage({
    id: 'ai_seed_1',
    pipeline: 'Pipeline 1 · Triage & Extraction',
    model: 'gemini-3.1-flash-lite',
    tokens: 1850,
    costUsd: 0.0006,
    status: 'Thành công',
  });
  logAiUsage({
    id: 'ai_seed_2',
    pipeline: 'Pipeline 2 · Deep Research & Scoring',
    model: 'gemini-4-hydrogen',
    tokens: 4280,
    costUsd: 0.0043,
    status: 'Thành công',
  });

  const notifications: NotificationItem[] = [
    {
      id: 'notif_1',
      type: 'opportunity',
      severity: 'success',
      title: 'Sản phẩm mới đạt ngưỡng Ưu tiên cao',
      message: 'Máy in nhiệt mini bỏ túi 304dpi đạt 87/100 (độ đầy đủ 100%, đã xác minh hoa hồng 11%).',
      read: false,
      createdAt: hoursAgo(2),
    },
    {
      id: 'notif_2',
      type: 'source_alert',
      severity: 'warning',
      title: 'Last30Days CN đang chạy chế độ Public Fallback',
      message: 'Cầu nối xiaohongshu-mcp chưa bật; điểm tin cậy nguồn CN tự động giảm trọng số.',
      read: false,
      createdAt: hoursAgo(3),
    },
    {
      id: 'notif_3',
      type: 'source_alert',
      severity: 'info',
      title: 'Dữ liệu giá Mặt nạ LED đã quá hạn 7 ngày',
      message: 'Bản ghi Shopee cho Mặt nạ ánh sáng đỏ LED cần kiểm tra lại giá và hoa hồng.',
      read: false,
      createdAt: hoursAgo(5),
    },
  ];
  const insertNotif = db.prepare(
    'INSERT INTO notifications (id, read, payload_json, created_at) VALUES (?, ?, ?, ?)',
  );
  for (const n of notifications) {
    insertNotif.run(n.id, n.read ? 1 : 0, JSON.stringify(n), n.createdAt);
  }
}
