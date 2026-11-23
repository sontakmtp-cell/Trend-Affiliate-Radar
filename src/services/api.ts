import type {
  AffiliateLinkRecord,
  AffiliateOrderRecord,
  AiUsageSummary,
  AppSettings,
  CampaignRecord,
  ContentAsset,
  CsvImportPreset,
  DataSourceRecord,
  ExpenseRecord,
  MarketplaceMatch,
  NotificationItem,
  OpportunityScoreResult,
  ProductRecord,
  ResearchRun,
  TrendTopic,
} from '../lib/types';
import type { RevenueFunnelSummary } from '../lib/scoring';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `Lỗi máy chủ (${res.status})`);
  }
  return data as T;
}

export interface OverviewResponse {
  kpis: {
    newTrendsToday: number;
    commercialTrendsCount: number;
    eligibleProducts: number;
    totalProducts: number;
    activeResearchJobs: number;
    totalResearchRuns: number;
    healthySources: number;
    totalSources: number;
  };
  topOpportunities: { product: ProductRecord; scoring: OpportunityScoreResult }[];
  emergingTrends: TrendTopic[];
  sourceAlerts: DataSourceRecord[];
  notifications: NotificationItem[];
}

export const api = {
  getOverview: () => request<OverviewResponse>('/dashboard/overview'),

  testAiConnection: () =>
    request<{ ok: boolean; model: string; latencyMs: number; message: string }>('/system/test-ai', {
      method: 'POST',
    }),

  getTrends: (params?: { intent?: string; region?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.intent) qs.set('intent', params.intent);
    if (params?.region) qs.set('region', params.region);
    if (params?.q) qs.set('q', params.q);
    const query = qs.toString();
    return request<{ items: TrendTopic[]; total: number }>(`/trends${query ? `?${query}` : ''}`);
  },

  syncTrends: () =>
    request<{
      syncedCount: number;
      rawCount: number;
      usedAi: boolean;
      message: string;
      diagnostics: { source: string; ok: boolean; count: number; latencyMs: number; note: string }[];
    }>('/trends/sync', { method: 'POST' }),

  dismissTrend: (id: string) => request<{ ok: boolean }>(`/trends/${id}/dismiss`, { method: 'POST' }),

  getProducts: () =>
    request<{
      items: { product: ProductRecord; scoring: OpportunityScoreResult }[];
      total: number;
    }>('/products'),

  getProductDetail: (id: string) =>
    request<{ product: ProductRecord; scoring: OpportunityScoreResult }>(`/products/${id}`),

  addMarketplaceMatch: (productId: string, payload: Partial<MarketplaceMatch>) =>
    request<{ product: ProductRecord; scoring: OpportunityScoreResult; match: MarketplaceMatch }>(
      `/products/${productId}/marketplace-matches`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),

  deleteMarketplaceMatch: (productId: string, matchId: string) =>
    request<{ product: ProductRecord; scoring: OpportunityScoreResult }>(
      `/products/${productId}/marketplace-matches/${matchId}`,
      { method: 'DELETE' },
    ),

  getResearchRuns: () => request<{ items: ResearchRun[] }>('/research/runs'),

  startResearchRun: (payload: { keyword: string; trendId?: string }) =>
    request<{ run: ResearchRun }>('/research/runs', { method: 'POST', body: JSON.stringify(payload) }),

  retryResearchRun: (id: string) =>
    request<{ run: ResearchRun }>(`/research/runs/${id}/retry`, { method: 'POST' }),

  getSources: () =>
    request<{
      sources: DataSourceRecord[];
      trendRadarConfig: { configYaml: string; frequencyWords: string };
    }>('/sources'),

  testSource: (id: string) => request<{ source: DataSourceRecord }>(`/sources/${id}/test`, { method: 'POST' }),

  saveTrendRadarConfig: (configYaml: string, frequencyWords: string) =>
    request<{ ok: boolean; message: string }>('/sources/trendradar/config', {
      method: 'PUT',
      body: JSON.stringify({ configYaml, frequencyWords }),
    }),

  getContentAssets: () => request<{ items: ContentAsset[] }>('/content'),

  generateContent: (payload: {
    productId: string;
    durationSec: 15 | 30 | 60;
    platform: ContentAsset['platform'];
    angleNote?: string;
  }) =>
    request<{ asset: ContentAsset }>('/content/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createContentAsset: (payload: Partial<ContentAsset>) =>
    request<{ asset: ContentAsset }>('/content', { method: 'POST', body: JSON.stringify(payload) }),

  updateContentAsset: (id: string, patch: Partial<ContentAsset>) =>
    request<{ asset: ContentAsset }>(`/content/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  getCampaigns: () => request<{ campaigns: CampaignRecord[]; links: AffiliateLinkRecord[] }>('/campaigns'),

  createCampaign: (payload: Partial<CampaignRecord>) =>
    request<{ campaign: CampaignRecord }>('/campaigns', { method: 'POST', body: JSON.stringify(payload) }),

  createAffiliateLink: (payload: Partial<AffiliateLinkRecord>) =>
    request<{ link: AffiliateLinkRecord }>('/affiliate/links', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAffiliateLink: (id: string, patch: Partial<AffiliateLinkRecord>) =>
    request<{ link: AffiliateLinkRecord }>(`/affiliate/links/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  getImportMeta: () =>
    request<{ presets: CsvImportPreset[]; existingOrderKeys: string[] }>('/imports/meta'),

  saveImportPreset: (payload: Omit<CsvImportPreset, 'id'>) =>
    request<{ preset: CsvImportPreset }>('/imports/presets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  commitImport: (records: Omit<AffiliateOrderRecord, 'id' | 'batchId'>[]) =>
    request<{
      batchId: string;
      insertedCount: number;
      skippedDuplicates: number;
      message: string;
    }>('/imports/commit', { method: 'POST', body: JSON.stringify({ records }) }),

  getAnalytics: () =>
    request<{
      funnel: RevenueFunnelSummary;
      orders: AffiliateOrderRecord[];
      expenses: ExpenseRecord[];
    }>('/analytics/summary'),

  addExpense: (payload: Partial<ExpenseRecord>) =>
    request<{ expense: ExpenseRecord }>('/analytics/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSettings: () => request<{ settings: AppSettings; aiUsage: AiUsageSummary }>('/settings'),

  updateSettings: (patch: Partial<AppSettings>) =>
    request<{ settings: AppSettings }>('/settings', { method: 'PUT', body: JSON.stringify(patch) }),

  markNotificationRead: (id: string) =>
    request<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),

  getBackup: () => request<Record<string, unknown>>('/system/backup'),

  restoreBackup: (dump: Record<string, unknown>) =>
    request<{ ok: boolean; message: string }>('/system/restore', {
      method: 'POST',
      body: JSON.stringify(dump),
    }),
};
