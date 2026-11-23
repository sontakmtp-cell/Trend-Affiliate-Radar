export type ViewId =
  | 'overview'
  | 'trends'
  | 'opportunities'
  | 'product_detail'
  | 'research_queue'
  | 'content_studio'
  | 'content_calendar'
  | 'campaigns'
  | 'csv_import'
  | 'analytics'
  | 'data_sources'
  | 'settings';

export type VerificationStatus = 'verified_fact' | 'ai_inference' | 'unknown' | 'outdated';

export type RetrievalMode = 'authenticated' | 'hotboard_match' | 'public_search' | 'manual';

export type CommercialIntent =
  | 'Commercial Product'
  | 'Entertainment/No Product'
  | 'News/Politics'
  | 'Tech/Concept Only'
  | 'Legal/Safety Risk'
  | 'Insufficient Data';

export type SourceHealthStatus =
  | 'Healthy'
  | 'Degraded'
  | 'Auth Required'
  | 'Rate Limited'
  | 'Unavailable'
  | 'Not Configured';

export type SourceDataMode = 'Full' | 'Public Fallback' | 'Manual Only';

export type MarketplacePlatform = 'Shopee' | 'TikTok Shop' | 'Lazada';

export type ContentStatus = 'Idea' | 'Draft' | 'Review' | 'Approved' | 'Scheduled' | 'Published';

export type OpportunityTier =
  | 'Ưu tiên cao'
  | 'Nghiên cứu thêm'
  | 'Theo dõi'
  | 'Ưu tiên thấp'
  | 'Chờ xác minh';

export interface ScoringWeights {
  trendGrowth: number; // default 20
  vietnamDemand: number; // default 20
  competition: number; // default 15
  priceCommission: number; // default 20
  contentPotential: number; // default 15
  supplyRisk: number; // default 10
}

export interface ScoringThresholds {
  highPriority: number; // default 80
  researchMore: number; // default 65
  watch: number; // default 50
}

export interface CriterionScore {
  key: keyof ScoringWeights;
  label: string;
  weight: number;
  rating: number | null; // 1-5 or null when Unknown
  reason: string;
  verification: VerificationStatus;
  sourceUrl?: string;
  recordedAt?: string;
}

export interface OpportunityScoreResult {
  score: number | null; // 0-100 computed over known criteria
  dataCompleteness: number; // 0-100 %
  isProvisional: boolean; // true if completeness < 100%
  evidenceConfidence: number; // 0-100 %
  evidenceConfidenceLabel: 'Cao' | 'Trung bình' | 'Thấp';
  commercialReadiness: boolean;
  tier: OpportunityTier;
  missingCriteria: string[];
  contributions: {
    key: keyof ScoringWeights;
    label: string;
    weight: number;
    rating: number | null;
    weightedPoints: number | null;
    maxPoints: number;
  }[];
}

export interface TrendTopic {
  id: string;
  title: string;
  titleVi: string;
  titleZh?: string;
  titleEn?: string;
  clusterKey: string;
  category: string;
  platforms: string[];
  region: 'CN' | 'Global' | 'VN' | 'CN→VN';
  language: 'vi' | 'zh' | 'en' | 'multi';
  intent: CommercialIntent;
  momentumScore: number; // normalized 0-100 per platform
  mentionCount: number;
  rankCurrent: number;
  rankDelta: number; // positive means climbed up
  sparkline: number[]; // 7-day normalized points
  rankHistory: { label: string; cnRank: number | null; globalRank: number | null; vnInterest: number | null }[];
  sourceUrl: string;
  retrievalMode: RetrievalMode;
  firstSeenAt: string;
  lastUpdatedAt: string;
  linkedProductId?: string | null;
  dismissed?: boolean;
}

export interface ProductEvidenceItem {
  id: string;
  productId: string;
  field: string;
  claim: string;
  status: VerificationStatus;
  retrievalMode: RetrievalMode;
  sourceName: string;
  sourceUrl?: string;
  recordedAt: string;
  note?: string;
}

export interface MarketplaceMatch {
  id: string;
  productId: string;
  platform: MarketplacePlatform;
  shopName: string;
  productTitle: string;
  productUrl: string;
  priceVnd: number;
  commissionRate: number | null; // percentage e.g. 8.5, or null if Unknown
  rating: number | null;
  soldCountLabel: string | null;
  affiliateProgramStatus: 'Đang mở' | 'Tạm dừng' | 'Chưa xác minh' | 'Hết hàng';
  promoExpiresAt?: string | null;
  dataSource: 'Manual' | 'CSV Import' | 'API';
  verifiedAt: string;
  priceHistory?: { date: string; priceVnd: number }[];
  operatorNote?: string;
}

export interface ProductScoreHistoryPoint {
  date: string;
  score: number;
  completeness: number;
  reason: string;
}

export interface ProductRecord {
  id: string;
  trendId?: string | null;
  nameVi: string;
  nameZh: string;
  nameEn: string;
  aliases: string[];
  category: string;
  summary: string;
  useCase: string;
  customerPainPoints: string[];
  buyerPersona: string;
  detectedSource: string;
  detectedAt: string;
  marketSignals: {
    china: { summary: string; status: VerificationStatus; sourceUrl?: string; retrievalMode: RetrievalMode; recordedAt: string };
    global: { summary: string; status: VerificationStatus; sourceUrl?: string; retrievalMode: RetrievalMode; recordedAt: string };
    vietnam: { summary: string; status: VerificationStatus; sourceUrl?: string; retrievalMode: RetrievalMode; recordedAt: string };
  };
  competitors: string[];
  verifiedPriceRangeVnd: { min: number | null; max: number | null; status: VerificationStatus; recordedAt?: string };
  verifiedCommissionRange: { min: number | null; max: number | null; status: VerificationStatus; recordedAt?: string };
  contentAngles: string[];
  risks: { type: string; detail: string; severity: 'Cao' | 'Trung bình' | 'Thấp' }[];
  aiConclusion: string;
  criteria: CriterionScore[];
  scoreHistory: ProductScoreHistoryPoint[];
  evidence: ProductEvidenceItem[];
  marketplaceMatches: MarketplaceMatch[];
  hasCnToVnSignal: boolean;
  updatedAt: string;
}

export interface ResearchStepLog {
  step: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'warning' | 'failed';
  detail: string;
  timestamp: string;
}

export interface ResearchRun {
  id: string;
  keyword: string;
  trendId?: string | null;
  productId?: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  sourcesUsed: string[];
  retrievalModes: RetrievalMode[];
  steps: ResearchStepLog[];
  errorMessage?: string | null;
  tokensUsed: number;
  estimatedCostUsd: number;
  createdAt: string;
  completedAt?: string | null;
}

export interface DataSourceRecord {
  id: string;
  name: string;
  category: 'Collector' | 'Deep Research' | 'Marketplace';
  repoOrPlatform: string;
  status: SourceHealthStatus;
  dataMode: SourceDataMode;
  lastSyncedAt: string | null;
  validRecordRate: number | null; // percentage
  latencyMs: number | null;
  lastMessage: string;
  configHint: string;
  enabled: boolean;
  meta?: Record<string, unknown>;
}

export interface ContentAsset {
  id: string;
  productId: string;
  productName: string;
  title: string;
  durationSec: 15 | 30 | 60;
  platform: 'TikTok' | 'Shopee Video' | 'Reels' | 'YouTube Shorts';
  version: number;
  status: ContentStatus;
  scheduledDate?: string | null;
  hook: string;
  voiceOver: string;
  storyboard: { time: string; visual: string; audio: string; textOverlay: string }[];
  caption: string;
  hashtags: string[];
  cta: string;
  visualPrompt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignRecord {
  id: string;
  name: string;
  objective: string;
  status: 'Đang chạy' | 'Tạm dừng' | 'Hoàn thành' | 'Nháp';
  startDate: string;
  endDate?: string | null;
  budgetVnd: number;
  productIds: string[];
  createdAt: string;
}

export interface AffiliateLinkRecord {
  id: string;
  campaignId: string | null;
  productId: string;
  productName: string;
  platform: MarketplacePlatform;
  originalAffiliateUrl: string;
  subId: string;
  utmSource: string;
  utmCampaign: string;
  trackingUrl: string; // Either standard URL with Sub_id/UTM or Redirect URL if PUBLIC_BASE_URL set
  trackingMode: 'Sub_id / UTM (Local)' | 'Redirect Tracker (VPS)';
  stockStatus: 'Còn hàng' | 'Sắp hết' | 'Hết hàng' | 'Ngừng Affiliate';
  promoExpiresAt?: string | null;
  clicks: number;
  createdAt: string;
}

export interface CsvColumnMapping {
  orderCode: string;
  productName: string;
  orderValueVnd: string;
  commissionVnd: string;
  orderStatus: string;
  subId: string;
  createdAt: string;
}

export interface CsvImportPreset {
  id: string;
  name: string;
  platform: MarketplacePlatform;
  mapping: CsvColumnMapping;
}

export interface AffiliateOrderRecord {
  id: string;
  batchId: string;
  platform: MarketplacePlatform;
  orderCode: string;
  productName: string;
  subId: string;
  orderValueVnd: number;
  commissionVnd: number;
  status: 'Ghi nhận' | 'Chờ duyệt' | 'Đã duyệt' | 'Thực nhận' | 'Đã hủy';
  dataSource: 'Sàn xác nhận' | 'Người dùng nhập';
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  category: 'Quảng cáo' | 'Sản xuất nội dung' | 'Mẫu sản phẩm' | 'Công cụ & AI';
  description: string;
  amountVnd: number;
  campaignId?: string | null;
  spentAt: string;
}

export interface AppSettings {
  onboardingCompleted: boolean;
  focusCategories: string[];
  pipelines: {
    triageModel: string;
    researchModel: string;
    contentModel: string;
  };
  aiDailyTokenBudget: number;
  aiDailyBudgetHardStop: boolean;
  weights: ScoringWeights;
  thresholds: ScoringThresholds;
  publicBaseUrl: string;
  xhsMcpEnabled: boolean;
  xhsMcpUrl: string;
  notifications: {
    webEnabled: boolean;
    telegramConfigured: boolean;
    smtpConfigured: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    minScoreAlert: number;
  };
}

export interface AiUsageSummary {
  todayTokens: number;
  todayCostUsd: number;
  dailyBudgetTokens: number;
  budgetReached: boolean;
  byPipeline: { pipeline: string; tokens: number; calls: number; costUsd: number }[];
  recentLogs: { id: string; pipeline: string; model: string; tokens: number; costUsd: number; status: string; createdAt: string }[];
}

export interface NotificationItem {
  id: string;
  type: 'opportunity' | 'trend_vn' | 'source_alert' | 'budget_alert' | 'content_due';
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
