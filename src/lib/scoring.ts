import type {
  AffiliateOrderRecord,
  CriterionScore,
  ExpenseRecord,
  MarketplaceMatch,
  OpportunityScoreResult,
  OpportunityTier,
  ProductEvidenceItem,
  RetrievalMode,
  ScoringThresholds,
  ScoringWeights,
} from './types';

export const DEFAULT_WEIGHTS: ScoringWeights = {
  trendGrowth: 20,
  vietnamDemand: 20,
  competition: 15,
  priceCommission: 20,
  contentPotential: 15,
  supplyRisk: 10,
};

export const DEFAULT_THRESHOLDS: ScoringThresholds = {
  highPriority: 80,
  researchMore: 65,
  watch: 50,
};

const CRITICAL_CRITERIA: (keyof ScoringWeights)[] = [
  'trendGrowth',
  'vietnamDemand',
  'priceCommission',
];

const RETRIEVAL_CONFIDENCE_WEIGHT: Record<RetrievalMode, number> = {
  authenticated: 1.0,
  manual: 0.9,
  hotboard_match: 0.78,
  public_search: 0.58,
};

/**
 * Null-safe Opportunity Scoring Engine (Section 7 of Spec v1.1).
 * - Missing criteria have rating === null and are NEVER assigned 0.
 * - Score is normalized across known criteria (0-100).
 * - Data Completeness is the percentage of total weights that have non-null ratings.
 * - If completeness < 100%, isProvisional = true ("Tạm tính").
 * - If critical criteria are missing, tier falls back to "Chờ xác minh" (Pending Verification).
 */
export function calculateOpportunityScore(
  criteria: CriterionScore[],
  evidence: ProductEvidenceItem[],
  marketplaceMatches: MarketplaceMatch[],
  weights: ScoringWeights = DEFAULT_WEIGHTS,
  thresholds: ScoringThresholds = DEFAULT_THRESHOLDS,
): OpportunityScoreResult {
  const totalConfiguredWeight = Object.values(weights).reduce((acc, w) => acc + Math.max(0, w), 0) || 100;

  let knownWeightSum = 0;
  let weightedScoreSum = 0;
  const missingCriteria: string[] = [];

  const contributions = criteria.map((c) => {
    const w = weights[c.key] ?? c.weight;
    const maxPoints = Number(((w / totalConfiguredWeight) * 100).toFixed(1));
    if (c.rating === null || c.rating === undefined || Number.isNaN(c.rating)) {
      missingCriteria.push(c.label);
      return {
        key: c.key,
        label: c.label,
        weight: w,
        rating: null,
        weightedPoints: null,
        maxPoints,
      };
    }

    const clampedRating = Math.min(5, Math.max(1, c.rating));
    knownWeightSum += w;
    // Rating 1..5 maps linearly to 20..100% of that criterion's weight
    const normalizedRatio = clampedRating / 5;
    weightedScoreSum += normalizedRatio * w;

    return {
      key: c.key,
      label: c.label,
      weight: w,
      rating: clampedRating,
      weightedPoints: Number((normalizedRatio * maxPoints).toFixed(1)),
      maxPoints,
    };
  });

  const dataCompleteness = Math.round((knownWeightSum / totalConfiguredWeight) * 100);
  const isProvisional = dataCompleteness < 100;
  const score =
    knownWeightSum > 0 ? Math.round((weightedScoreSum / knownWeightSum) * 100) : null;

  // Evidence Confidence: based on number of independent verified sources and retrieval modes
  const verifiedOrInferred = evidence.filter((e) => e.status !== 'unknown');
  const uniqueSources = new Set(verifiedOrInferred.map((e) => e.sourceName.toLowerCase()));
  let evidenceConfidence = 0;

  if (verifiedOrInferred.length > 0) {
    const modeAvg =
      verifiedOrInferred.reduce((sum, e) => {
        const modeWeight = RETRIEVAL_CONFIDENCE_WEIGHT[e.retrievalMode] ?? 0.55;
        const statusFactor =
          e.status === 'verified_fact' ? 1.0 : e.status === 'ai_inference' ? 0.72 : 0.45;
        return sum + modeWeight * statusFactor;
      }, 0) / verifiedOrInferred.length;

    const breadthFactor = Math.min(1, uniqueSources.size / 4);
    evidenceConfidence = Math.round((modeAvg * 0.65 + breadthFactor * 0.35) * 100);
  }

  const evidenceConfidenceLabel: 'Cao' | 'Trung bình' | 'Thấp' =
    evidenceConfidence >= 75 ? 'Cao' : evidenceConfidence >= 50 ? 'Trung bình' : 'Thấp';

  // Commercial Readiness: has at least one active marketplace match with verified commission rate
  const commercialReadiness = marketplaceMatches.some(
    (m) =>
      m.productUrl.trim().length > 0 &&
      m.commissionRate !== null &&
      m.commissionRate > 0 &&
      m.affiliateProgramStatus === 'Đang mở',
  );

  // Critical criteria missing check
  const hasMissingCritical = CRITICAL_CRITERIA.some((critKey) => {
    const found = criteria.find((c) => c.key === critKey);
    return !found || found.rating === null;
  });

  let tier: OpportunityTier;
  if (score === null || hasMissingCritical || dataCompleteness < 60) {
    tier = 'Chờ xác minh';
  } else if (score >= thresholds.highPriority && dataCompleteness >= 80 && evidenceConfidence >= 60) {
    tier = 'Ưu tiên cao';
  } else if (score >= thresholds.researchMore) {
    tier = 'Nghiên cứu thêm';
  } else if (score >= thresholds.watch) {
    tier = 'Theo dõi';
  } else {
    tier = 'Ưu tiên thấp';
  }

  return {
    score,
    dataCompleteness,
    isProvisional,
    evidenceConfidence,
    evidenceConfidenceLabel,
    commercialReadiness,
    tier,
    missingCriteria,
    contributions,
  };
}

/**
 * Null-safe Estimated Commission (Section 8).
 * Returns null ("Unknown") if expectedOrderValue or commissionRate is missing.
 */
export function calculateEstimatedCommission(
  expectedOrderValueVnd: number | null | undefined,
  commissionRatePercent: number | null | undefined,
): number | null {
  if (
    expectedOrderValueVnd === null ||
    expectedOrderValueVnd === undefined ||
    commissionRatePercent === null ||
    commissionRatePercent === undefined ||
    expectedOrderValueVnd <= 0 ||
    commissionRatePercent <= 0
  ) {
    return null;
  }
  return Math.round(expectedOrderValueVnd * (commissionRatePercent / 100));
}

/**
 * Multilingual normalization & cosine similarity for Trend Clustering (Section 5.2).
 * Maps cross-language product terms (EN / VI / ZH) into normalized canonical concepts
 * and computes cosine similarity over either provided embedding vectors or normalized semantic tokens.
 */
const MULTILINGUAL_EQUIVALENTS: [RegExp, string][] = [
  [/迷你打印机|pocket printer|mini portable printer|mini thermal printer|máy in mini|máy in nhiệt mini/i, 'concept_mini_printer'],
  [/桌面吸尘器|mini desk vacuum|máy hút bụi mini|hút bụi bàn phím/i, 'concept_desk_vacuum'],
  [/挂脖风扇|neck fan|bladeless neck fan|quạt đeo cổ|quạt mini đeo cổ/i, 'concept_neck_fan'],
  [/筋膜枪|massage gun|mini massage gun|súng massage|máy massage cầm tay/i, 'concept_massage_gun'],
  [/led面罩|led face mask|red light mask|mặt nạ ánh sáng sinh học|mặt nạ led/i, 'concept_led_mask'],
  [/磁吸充电宝|magsafe power bank|sạc dự phòng magsafe|pin dự phòng từ tính/i, 'concept_magsafe_powerbank'],
  [/便携榨汁杯|portable blender|máy xay sinh tố cầm tay/i, 'concept_portable_blender'],
];

export function normalizeMultilingualKey(text: string): string {
  let normalized = text.trim().toLowerCase();
  for (const [pattern, canonical] of MULTILINGUAL_EQUIVALENTS) {
    if (pattern.test(normalized)) {
      return canonical;
    }
  }
  return normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim();
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length === 0 || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function computeMultilingualSimilarity(titleA: string, titleB: string): number {
  const normA = normalizeMultilingualKey(titleA);
  const normB = normalizeMultilingualKey(titleB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const tokensA = new Set(normA.split(/\s+/).filter(Boolean));
  const tokensB = new Set(normB.split(/\s+/).filter(Boolean));
  const vocab = Array.from(new Set([...tokensA, ...tokensB]));
  const vecA = vocab.map((t) => (tokensA.has(t) ? 1 : 0));
  const vecB = vocab.map((t) => (tokensB.has(t) ? 1 : 0));
  return Number(cosineSimilarity(vecA, vecB).toFixed(4));
}

export interface RevenueFunnelSummary {
  totalClicks: number;
  recordedOrders: number;
  approvedOrders: number;
  cancelledOrders: number;
  pendingCommissionVnd: number;
  approvedCommissionVnd: number;
  realizedCommissionVnd: number;
  totalOrderValueVnd: number;
  totalExpensesVnd: number;
  netProfitRealizedVnd: number; // strictly realizedCommission - expenses (NEVER includes estimated or pending)
  roiPercent: number | null;
  byPlatform: {
    platform: string;
    orders: number;
    realizedCommissionVnd: number;
    pendingCommissionVnd: number;
  }[];
}

/**
 * Revenue & ROI Funnel Calculator (Section 11).
 * Strictly separates Recorded / Pending / Approved / Realized commissions.
 * Never merges estimated or pending commission into realized revenue/profit.
 */
export function calculateRevenueFunnel(
  orders: AffiliateOrderRecord[],
  expenses: ExpenseRecord[],
  totalClicks: number,
): RevenueFunnelSummary {
  let recordedOrders = 0;
  let approvedOrders = 0;
  let cancelledOrders = 0;
  let pendingCommissionVnd = 0;
  let approvedCommissionVnd = 0;
  let realizedCommissionVnd = 0;
  let totalOrderValueVnd = 0;

  const platformMap = new Map<
    string,
    { platform: string; orders: number; realizedCommissionVnd: number; pendingCommissionVnd: number }
  >();

  for (const order of orders) {
    recordedOrders += 1;
    if (order.status !== 'Đã hủy') {
      totalOrderValueVnd += order.orderValueVnd;
    }

    const entry = platformMap.get(order.platform) ?? {
      platform: order.platform,
      orders: 0,
      realizedCommissionVnd: 0,
      pendingCommissionVnd: 0,
    };
    entry.orders += 1;

    if (order.status === 'Đã hủy') {
      cancelledOrders += 1;
    } else if (order.status === 'Ghi nhận' || order.status === 'Chờ duyệt') {
      pendingCommissionVnd += order.commissionVnd;
      entry.pendingCommissionVnd += order.commissionVnd;
    } else if (order.status === 'Đã duyệt') {
      approvedOrders += 1;
      approvedCommissionVnd += order.commissionVnd;
    } else if (order.status === 'Thực nhận') {
      approvedOrders += 1;
      realizedCommissionVnd += order.commissionVnd;
      entry.realizedCommissionVnd += order.commissionVnd;
    }

    platformMap.set(order.platform, entry);
  }

  const totalExpensesVnd = expenses.reduce((sum, e) => sum + e.amountVnd, 0);
  const netProfitRealizedVnd = realizedCommissionVnd - totalExpensesVnd;
  const roiPercent =
    totalExpensesVnd > 0 ? Number(((netProfitRealizedVnd / totalExpensesVnd) * 100).toFixed(1)) : null;

  return {
    totalClicks,
    recordedOrders,
    approvedOrders,
    cancelledOrders,
    pendingCommissionVnd,
    approvedCommissionVnd,
    realizedCommissionVnd,
    totalOrderValueVnd,
    totalExpensesVnd,
    netProfitRealizedVnd,
    roiPercent,
    byPlatform: Array.from(platformMap.values()),
  };
}
