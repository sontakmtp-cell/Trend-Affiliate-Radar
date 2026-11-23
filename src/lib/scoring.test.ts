import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEstimatedCommission,
  calculateOpportunityScore,
  calculateRevenueFunnel,
  computeMultilingualSimilarity,
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
} from './scoring';
import type {
  AffiliateOrderRecord,
  CriterionScore,
  ExpenseRecord,
  MarketplaceMatch,
  ProductEvidenceItem,
} from './types';

const FULL_CRITERIA: CriterionScore[] = [
  { key: 'trendGrowth', label: 'Tăng trưởng xu hướng', weight: 20, rating: 5, reason: 'Đà tăng mạnh', verification: 'verified_fact' },
  { key: 'vietnamDemand', label: 'Nhu cầu tại Việt Nam', weight: 20, rating: 4, reason: 'Nhu cầu cao', verification: 'verified_fact' },
  { key: 'competition', label: 'Mức độ cạnh tranh', weight: 15, rating: 4, reason: 'Cạnh tranh vừa', verification: 'ai_inference' },
  { key: 'priceCommission', label: 'Giá bán & hoa hồng', weight: 20, rating: 5, reason: 'Biên tốt', verification: 'verified_fact' },
  { key: 'contentPotential', label: 'Khả năng tạo nội dung', weight: 15, rating: 5, reason: 'Dễ quay demo', verification: 'ai_inference' },
  { key: 'supplyRisk', label: 'Cung ứng & rủi ro', weight: 10, rating: 4, reason: 'Ổn định', verification: 'verified_fact' },
];

const STRONG_EVIDENCE: ProductEvidenceItem[] = [
  { id: 'e1', productId: 'p1', field: 'trend', claim: 'Trending', status: 'verified_fact', retrievalMode: 'authenticated', sourceName: 'TrendRadar', recordedAt: '2026-11-20T00:00:00Z' },
  { id: 'e2', productId: 'p1', field: 'global', claim: 'Reddit discussion', status: 'verified_fact', retrievalMode: 'hotboard_match', sourceName: 'Reddit', recordedAt: '2026-11-20T00:00:00Z' },
  { id: 'e3', productId: 'p1', field: 'cn', claim: 'XHS posts', status: 'verified_fact', retrievalMode: 'authenticated', sourceName: 'Xiaohongshu', recordedAt: '2026-11-20T00:00:00Z' },
  { id: 'e4', productId: 'p1', field: 'vn', claim: 'Shopee verified', status: 'verified_fact', retrievalMode: 'manual', sourceName: 'Shopee VN', recordedAt: '2026-11-20T00:00:00Z' },
];

const ACTIVE_MATCH: MarketplaceMatch[] = [
  {
    id: 'm1',
    productId: 'p1',
    platform: 'Shopee',
    shopName: 'Mall Official',
    productTitle: 'Máy in nhiệt mini',
    productUrl: 'https://shopee.vn/item/123',
    priceVnd: 329000,
    commissionRate: 9.5,
    rating: 4.9,
    soldCountLabel: '2,4k đã bán',
    affiliateProgramStatus: 'Đang mở',
    dataSource: 'Manual',
    verifiedAt: '2026-11-20T00:00:00Z',
  },
];

test('null-safe scoring computes 100% completeness and Ưu tiên cao when full evidence exists', () => {
  const res = calculateOpportunityScore(FULL_CRITERIA, STRONG_EVIDENCE, ACTIVE_MATCH, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS);
  assert.equal(res.dataCompleteness, 100);
  assert.equal(res.isProvisional, false);
  assert.equal(res.commercialReadiness, true);
  assert.equal(res.tier, 'Ưu tiên cao');
  assert.ok((res.score ?? 0) >= 85);
});

test('null-safe scoring never assigns 0 to null criteria and flags Chờ xác minh when critical criterion missing', () => {
  const partial: CriterionScore[] = FULL_CRITERIA.map((c) =>
    c.key === 'priceCommission' ? { ...c, rating: null, verification: 'unknown' } : c,
  );
  const res = calculateOpportunityScore(partial, STRONG_EVIDENCE, [], DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS);
  assert.equal(res.dataCompleteness, 80);
  assert.equal(res.isProvisional, true);
  assert.equal(res.tier, 'Chờ xác minh');
  assert.equal(res.commercialReadiness, false);
  assert.deepEqual(res.missingCriteria, ['Giá bán & hoa hồng']);
  // Score over known criteria (all 4 or 5) must remain high (~89), NOT dragged down by 0
  assert.ok((res.score ?? 0) >= 85);
});

test('evidence confidence weights authenticated higher than public_search', () => {
  const publicOnly: ProductEvidenceItem[] = STRONG_EVIDENCE.map((e) => ({
    ...e,
    retrievalMode: 'public_search',
  }));
  const authRes = calculateOpportunityScore(FULL_CRITERIA, STRONG_EVIDENCE, ACTIVE_MATCH);
  const pubRes = calculateOpportunityScore(FULL_CRITERIA, publicOnly, ACTIVE_MATCH);
  assert.ok(authRes.evidenceConfidence > pubRes.evidenceConfidence);
});

test('estimated commission returns null when commission rate is unknown', () => {
  assert.equal(calculateEstimatedCommission(320000, 10), 32000);
  assert.equal(calculateEstimatedCommission(320000, null), null);
  assert.equal(calculateEstimatedCommission(0, 10), null);
});

test('multilingual clustering links EN, VI, and ZH equivalents for the same product', () => {
  assert.equal(computeMultilingualSimilarity('Mini portable printer', 'Máy in mini'), 1);
  assert.equal(computeMultilingualSimilarity('Pocket printer', '迷你打印机'), 1);
  assert.equal(computeMultilingualSimilarity('Bladeless neck fan', 'Quạt đeo cổ'), 1);
  assert.ok(computeMultilingualSimilarity('Máy in mini', 'Quạt đeo cổ') < 0.5);
});

test('revenue funnel strictly separates pending, approved, and realized commission from profit', () => {
  const orders: AffiliateOrderRecord[] = [
    { id: '1', batchId: 'b1', platform: 'Shopee', orderCode: 'SP01', productName: 'A', subId: 's1', orderValueVnd: 500000, commissionVnd: 50000, status: 'Thực nhận', dataSource: 'Sàn xác nhận', createdAt: '2026-11-20T00:00:00Z' },
    { id: '2', batchId: 'b1', platform: 'Shopee', orderCode: 'SP02', productName: 'A', subId: 's1', orderValueVnd: 500000, commissionVnd: 45000, status: 'Chờ duyệt', dataSource: 'Sàn xác nhận', createdAt: '2026-11-21T00:00:00Z' },
    { id: '3', batchId: 'b1', platform: 'TikTok Shop', orderCode: 'TT01', productName: 'B', subId: 's2', orderValueVnd: 400000, commissionVnd: 40000, status: 'Đã hủy', dataSource: 'Sàn xác nhận', createdAt: '2026-11-21T00:00:00Z' },
  ];
  const expenses: ExpenseRecord[] = [
    { id: 'ex1', category: 'Sản xuất nội dung', description: 'Đạo cụ quay', amountVnd: 20000, spentAt: '2026-11-20T00:00:00Z' },
  ];
  const funnel = calculateRevenueFunnel(orders, expenses, 1200);
  assert.equal(funnel.recordedOrders, 3);
  assert.equal(funnel.approvedOrders, 1);
  assert.equal(funnel.cancelledOrders, 1);
  assert.equal(funnel.realizedCommissionVnd, 50000);
  assert.equal(funnel.pendingCommissionVnd, 45000);
  // Net profit MUST ONLY use realized commission (50,000 - 20,000 = 30,000), never pending
  assert.equal(funnel.netProfitRealizedVnd, 30000);
  assert.equal(funnel.roiPercent, 150);
});
