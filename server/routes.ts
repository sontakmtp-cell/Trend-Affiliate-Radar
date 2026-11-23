import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import express, { type Request, type Response } from 'express';
import {
  checkXhsMcpBridge,
  fetchLiveKeylessSignals,
  readTrendRadarConfig,
  validateAndSaveTrendRadarConfig,
} from './collectors';
import {
  db,
  getSettings,
  getTodayAiTokens,
  saveSettings,
} from './db';
import {
  runGroundedMarketSearch,
  runPipeline1Triage,
  runPipeline2DeepResearch,
  runPipeline3ContentStudio,
  testGeminiConnection,
} from './gemini';
import {
  calculateOpportunityScore,
  calculateRevenueFunnel,
  normalizeMultilingualKey,
} from '../src/lib/scoring';
import { sanitizeExternalUrl } from '../src/lib/format';
import type {
  AffiliateLinkRecord,
  AffiliateOrderRecord,
  AppSettings,
  CampaignRecord,
  ContentAsset,
  ContentStatus,
  CsvImportPreset,
  DataSourceRecord,
  ExpenseRecord,
  MarketplaceMatch,
  NotificationItem,
  ProductRecord,
  ResearchRun,
  TrendTopic,
} from '../src/lib/types';

export const apiRouter = express.Router();
const researchEvents = new EventEmitter();
researchEvents.setMaxListeners(50);

function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  return res.status(status).json({ code, message, details });
}

function getAllFromTable<T>(table: string, orderBy = 'rowid DESC'): T[] {
  const rows = db.prepare(`SELECT payload_json FROM ${table} ORDER BY ${orderBy}`).all() as {
    payload_json: string;
  }[];
  return rows.map((r) => JSON.parse(r.payload_json) as T);
}

// ---------- SYSTEM & DASHBOARD ----------
apiRouter.get('/system/health', (_req, res) => {
  const settings = getSettings();
  res.json({
    status: 'ok',
    version: '1.1.0',
    timezone: 'Asia/Ho_Chi_Minh',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    trackingMode: settings.publicBaseUrl ? 'Redirect Tracker (VPS)' : 'Sub_id / UTM (Local)',
    timestamp: new Date().toISOString(),
  });
});

apiRouter.post('/system/test-ai', async (_req, res) => {
  const result = await testGeminiConnection();
  res.json(result);
});

apiRouter.get('/dashboard/overview', (_req, res) => {
  const settings = getSettings();
  const trends = getAllFromTable<TrendTopic>('trend_topics', 'momentum_score DESC').filter(
    (t) => !t.dismissed,
  );
  const products = getAllFromTable<ProductRecord>('products', 'updated_at DESC');
  const sources = getAllFromTable<DataSourceRecord>('data_sources', 'rowid ASC');
  const runs = getAllFromTable<ResearchRun>('research_runs', 'created_at DESC');
  const notifications = getAllFromTable<NotificationItem>('notifications', 'created_at DESC');

  const scoredProducts = products.map((p) => ({
    product: p,
    scoring: calculateOpportunityScore(
      p.criteria,
      p.evidence,
      p.marketplaceMatches,
      settings.weights,
      settings.thresholds,
    ),
  }));

  scoredProducts.sort((a, b) => (b.scoring.score ?? 0) - (a.scoring.score ?? 0));

  const healthySources = sources.filter((s) => s.status === 'Healthy').length;
  const activeRuns = runs.filter((r) => r.status === 'running' || r.status === 'queued').length;
  const commercialTrendsCount = trends.filter((t) => t.intent === 'Commercial Product').length;
  const eligibleProducts = scoredProducts.filter(
    (s) => s.scoring.tier === 'Ưu tiên cao' || s.scoring.tier === 'Nghiên cứu thêm',
  ).length;

  res.json({
    kpis: {
      newTrendsToday: trends.length,
      commercialTrendsCount,
      eligibleProducts,
      totalProducts: products.length,
      activeResearchJobs: activeRuns,
      totalResearchRuns: runs.length,
      healthySources,
      totalSources: sources.length,
    },
    topOpportunities: scoredProducts.slice(0, 4),
    emergingTrends: trends.filter((t) => t.intent === 'Commercial Product').slice(0, 5),
    sourceAlerts: sources.filter((s) => s.status !== 'Healthy'),
    notifications: notifications.slice(0, 6),
  });
});

// ---------- DATA SOURCES & TRENDRADAR CONFIG ----------
apiRouter.get('/sources', (_req, res) => {
  const sources = getAllFromTable<DataSourceRecord>('data_sources', 'rowid ASC');
  const config = readTrendRadarConfig();
  res.json({ sources, trendRadarConfig: config });
});

apiRouter.post('/sources/:id/test', async (req, res) => {
  const { id } = req.params;
  const row = db.prepare('SELECT payload_json FROM data_sources WHERE id = ?').get(id) as
    | { payload_json: string }
    | undefined;
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Không tìm thấy nguồn dữ liệu.');

  const source = JSON.parse(row.payload_json) as DataSourceRecord;
  const settings = getSettings();
  const now = new Date().toISOString();

  if (id === 'trendradar' || id === 'last30days_global') {
    const live = await fetchLiveKeylessSignals();
    const okCount = live.diagnostics.filter((d) => d.ok).length;
    const avgLatency = Math.round(
      live.diagnostics.reduce((sum, d) => sum + d.latencyMs, 0) / Math.max(1, live.diagnostics.length),
    );
    source.status = okCount > 0 ? 'Healthy' : 'Degraded';
    source.dataMode = okCount > 0 ? 'Full' : 'Public Fallback';
    source.lastSyncedAt = now;
    source.latencyMs = avgLatency;
    source.validRecordRate = live.signals.length > 0 ? 100 : source.validRecordRate;
    source.lastMessage = live.diagnostics.map((d) => `${d.source}: ${d.note}`).join(' | ');
  } else if (id === 'last30days_cn') {
    const bridge = await checkXhsMcpBridge(settings.xhsMcpEnabled, settings.xhsMcpUrl);
    source.status = bridge.connected ? 'Healthy' : 'Degraded';
    source.dataMode = bridge.connected ? 'Full' : 'Public Fallback';
    source.lastSyncedAt = now;
    source.latencyMs = bridge.latencyMs ?? 420;
    source.lastMessage = bridge.message;
  } else {
    // Marketplace APIs: honestly report Not Configured until official partner keys exist
    source.status = 'Not Configured';
    source.dataMode = 'Manual Only';
    source.lastMessage = `Chờ cấu hình — Chưa có khóa API chính thức cho ${source.name}. Hãy dùng chế độ Nhập tay & Import CSV/XLSX.`;
  }

  db.prepare('UPDATE data_sources SET payload_json = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(source),
    now,
    id,
  );
  res.json({ source });
});

apiRouter.put('/sources/trendradar/config', (req, res) => {
  const { configYaml, frequencyWords } = req.body as {
    configYaml?: string;
    frequencyWords?: string;
  };
  if (typeof configYaml !== 'string' || typeof frequencyWords !== 'string') {
    return sendError(res, 400, 'INVALID_INPUT', 'Thiếu nội dung config.yaml hoặc frequency_words.txt.');
  }
  const result = validateAndSaveTrendRadarConfig(configYaml, frequencyWords);
  if (!result.valid) {
    return sendError(res, 400, 'YAML_VALIDATION_ERROR', result.error || 'Cấu hình YAML không hợp lệ.');
  }
  res.json({
    ok: true,
    message: 'Đã kiểm tra cú pháp YAML hợp lệ và lưu vào volume config/.',
  });
});

// ---------- TRENDS & SYNC ----------
apiRouter.get('/trends', (req, res) => {
  const { intent, region, q, includeDismissed } = req.query as Record<string, string | undefined>;
  let trends = getAllFromTable<TrendTopic>('trend_topics', 'momentum_score DESC');
  if (includeDismissed !== 'true') {
    trends = trends.filter((t) => !t.dismissed);
  }
  if (intent && intent !== 'all') {
    trends = trends.filter((t) => t.intent === intent);
  }
  if (region && region !== 'all') {
    trends = trends.filter((t) => t.region === region);
  }
  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    trends = trends.filter(
      (t) =>
        t.titleVi.toLowerCase().includes(needle) ||
        t.title.toLowerCase().includes(needle) ||
        (t.titleEn ?? '').toLowerCase().includes(needle) ||
        (t.titleZh ?? '').toLowerCase().includes(needle) ||
        t.category.toLowerCase().includes(needle),
    );
  }
  res.json({ items: trends, total: trends.length });
});

apiRouter.post('/trends/sync', async (_req, res) => {
  try {
    const live = await fetchLiveKeylessSignals();
    if (live.signals.length === 0) {
      return res.json({
        syncedCount: 0,
        diagnostics: live.diagnostics,
        message: 'Không có tín hiệu mới từ nguồn công khai tại thời điểm này (không phải lỗi hệ thống).',
      });
    }

    let triaged: Partial<TrendTopic>[] = [];
    let usedAi = false;
    if (process.env.GEMINI_API_KEY) {
      try {
        triaged = await runPipeline1Triage(live.signals);
        usedAi = true;
      } catch {
        // If AI fails or budget reached, still store raw keyless signals honestly as Insufficient Data
        triaged = live.signals.slice(0, 5).map((s) => ({
          title: s.title,
          titleVi: s.title,
          titleEn: s.title,
          category: 'Chưa phân loại',
          platforms: [s.platform],
          region: 'Global' as const,
          intent: 'Insufficient Data' as const,
          momentumScore: Math.min(95, Math.max(40, Math.round(Math.log10(Math.max(10, s.score)) * 32))),
          sourceUrl: s.url,
        }));
      }
    } else {
      triaged = live.signals.slice(0, 5).map((s) => ({
        title: s.title,
        titleVi: s.title,
        titleEn: s.title,
        category: 'Chưa phân loại',
        platforms: [s.platform],
        region: 'Global' as const,
        intent: 'Insufficient Data' as const,
        momentumScore: 60,
        sourceUrl: s.url,
      }));
    }

    const now = new Date().toISOString();
    const existingRows = db.prepare('SELECT cluster_key FROM trend_topics').all() as { cluster_key: string }[];
    const existingKeys = new Set(existingRows.map((r) => r.cluster_key));

    let added = 0;
    const insertTrend = db.prepare(
      `INSERT INTO trend_topics (id, cluster_key, intent, region, momentum_score, dismissed, payload_json, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    );

    for (const item of triaged) {
      const clusterKey = normalizeMultilingualKey(item.titleEn || item.titleVi || item.title || '');
      if (!clusterKey || existingKeys.has(clusterKey)) continue;
      existingKeys.add(clusterKey);

      const id = `tr_live_${crypto.randomUUID().slice(0, 8)}`;
      const score = item.momentumScore ?? 65;
      const record: TrendTopic = {
        id,
        title: item.title || item.titleVi || 'Tín hiệu mới',
        titleVi: item.titleVi || item.title || 'Tín hiệu mới',
        titleZh: item.titleZh || '',
        titleEn: item.titleEn || item.title || '',
        clusterKey,
        category: item.category || 'Phụ kiện công nghệ',
        platforms: item.platforms ?? ['Hacker News'],
        region: item.region ?? 'Global',
        language: 'en',
        intent: item.intent ?? 'Insufficient Data',
        momentumScore: score,
        mentionCount: Math.round(score * 9),
        rankCurrent: 15 + added,
        rankDelta: 3,
        sparkline: [Math.max(20, score - 18), Math.max(25, score - 12), Math.max(30, score - 8), Math.max(35, score - 4), score],
        rankHistory: [
          { label: 'T-2', cnRank: null, globalRank: 28, vnInterest: null },
          { label: 'T-1', cnRank: null, globalRank: 21, vnInterest: null },
          { label: 'Hôm nay', cnRank: null, globalRank: 15 + added, vnInterest: null },
        ],
        sourceUrl: sanitizeExternalUrl(item.sourceUrl) ?? 'https://news.ycombinator.com/',
        retrievalMode: 'public_search',
        firstSeenAt: now,
        lastUpdatedAt: now,
        linkedProductId: null,
      };
      insertTrend.run(id, clusterKey, record.intent, record.region, record.momentumScore, JSON.stringify(record), now);
      added += 1;
    }

    // Update TrendRadar last synced timestamp
    const srcRow = db.prepare('SELECT payload_json FROM data_sources WHERE id = ?').get('trendradar') as
      | { payload_json: string }
      | undefined;
    if (srcRow) {
      const src = JSON.parse(srcRow.payload_json) as DataSourceRecord;
      src.lastSyncedAt = now;
      src.status = 'Healthy';
      src.lastMessage = `Đã đồng bộ ${live.signals.length} tín hiệu công khai (${added} cụm mới${usedAi ? ', đã qua lọc AI Pipeline 1' : ''}).`;
      db.prepare('UPDATE data_sources SET payload_json = ?, updated_at = ? WHERE id = ?').run(
        JSON.stringify(src),
        now,
        'trendradar',
      );
    }

    res.json({
      syncedCount: added,
      rawCount: live.signals.length,
      usedAi,
      diagnostics: live.diagnostics,
      message:
        added > 0
          ? `Đã đồng bộ thành công ${added} cụm xu hướng mới từ nguồn công khai.`
          : 'Tất cả tín hiệu thu thập đã tồn tại trong danh sách (đã gom cụm chống trùng lặp).',
    });
  } catch (err) {
    sendError(
      res,
      500,
      'SYNC_FAILED',
      err instanceof Error ? err.message : 'Đồng bộ tín hiệu thất bại.',
    );
  }
});

apiRouter.post('/trends/:id/dismiss', (req, res) => {
  const { id } = req.params;
  const row = db.prepare('SELECT payload_json FROM trend_topics WHERE id = ?').get(id) as
    | { payload_json: string }
    | undefined;
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Không tìm thấy xu hướng.');
  const trend = JSON.parse(row.payload_json) as TrendTopic;
  trend.dismissed = true;
  db.prepare('UPDATE trend_topics SET dismissed = 1, payload_json = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(trend),
    new Date().toISOString(),
    id,
  );
  res.json({ ok: true });
});

// ---------- PRODUCTS & OPPORTUNITIES ----------
apiRouter.get('/products', (_req, res) => {
  const settings = getSettings();
  const products = getAllFromTable<ProductRecord>('products', 'updated_at DESC');
  const items = products.map((product) => ({
    product,
    scoring: calculateOpportunityScore(
      product.criteria,
      product.evidence,
      product.marketplaceMatches,
      settings.weights,
      settings.thresholds,
    ),
  }));
  items.sort((a, b) => (b.scoring.score ?? -1) - (a.scoring.score ?? -1));
  res.json({ items, total: items.length });
});

apiRouter.get('/products/:id', (req, res) => {
  const row = db.prepare('SELECT payload_json FROM products WHERE id = ?').get(req.params.id) as
    | { payload_json: string }
    | undefined;
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sản phẩm.');
  const product = JSON.parse(row.payload_json) as ProductRecord;
  const settings = getSettings();
  const scoring = calculateOpportunityScore(
    product.criteria,
    product.evidence,
    product.marketplaceMatches,
    settings.weights,
    settings.thresholds,
  );
  res.json({ product, scoring });
});

// Manual Marketplace Match Addition / Update (Spec Section 4.4 & 8)
apiRouter.post('/products/:id/marketplace-matches', (req, res) => {
  const row = db.prepare('SELECT payload_json FROM products WHERE id = ?').get(req.params.id) as
    | { payload_json: string }
    | undefined;
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Không tìm thấy hồ sơ sản phẩm.');

  const body = req.body as Partial<MarketplaceMatch>;
  if (!body.platform || !body.shopName?.trim() || !body.productUrl?.trim() || !body.priceVnd || body.priceVnd <= 0) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Vui lòng nhập đầy đủ Sàn, Tên Shop, URL hợp lệ và Giá bán (> 0 VNĐ).',
    );
  }
  const safeUrl = sanitizeExternalUrl(body.productUrl);
  if (!safeUrl) {
    return sendError(res, 400, 'INVALID_URL', 'URL sản phẩm phải bắt đầu bằng http:// hoặc https://.');
  }

  const product = JSON.parse(row.payload_json) as ProductRecord;
  const nowIso = new Date().toISOString();

  const newMatch: MarketplaceMatch = {
    id: `mm_${crypto.randomUUID().slice(0, 8)}`,
    productId: product.id,
    platform: body.platform,
    shopName: body.shopName.trim(),
    productTitle: body.productTitle?.trim() || product.nameVi,
    productUrl: safeUrl,
    priceVnd: Math.round(Number(body.priceVnd)),
    commissionRate:
      body.commissionRate !== undefined && body.commissionRate !== null && Number(body.commissionRate) > 0
        ? Number(body.commissionRate)
        : null,
    rating: body.rating ? Number(body.rating) : null,
    soldCountLabel: body.soldCountLabel?.trim() || null,
    affiliateProgramStatus: body.affiliateProgramStatus || 'Đang mở',
    promoExpiresAt: body.promoExpiresAt || null,
    dataSource: 'Manual',
    verifiedAt: nowIso,
    priceHistory: [{ date: nowIso.slice(0, 10), priceVnd: Math.round(Number(body.priceVnd)) }],
    operatorNote: body.operatorNote?.trim() || '',
  };

  product.marketplaceMatches.unshift(newMatch);

  // Recalculate verified price & commission range + update priceCommission criterion if verified!
  const prices = product.marketplaceMatches.map((m) => m.priceVnd).filter((v) => v > 0);
  if (prices.length > 0) {
    product.verifiedPriceRangeVnd = {
      min: Math.min(...prices),
      max: Math.max(...prices),
      status: 'verified_fact',
      recordedAt: nowIso,
    };
  }
  const comms = product.marketplaceMatches
    .map((m) => m.commissionRate)
    .filter((c): c is number => c !== null && c > 0);
  if (comms.length > 0) {
    const maxComm = Math.max(...comms);
    product.verifiedCommissionRange = {
      min: Math.min(...comms),
      max: maxComm,
      status: 'verified_fact',
      recordedAt: nowIso,
    };
    const crit = product.criteria.find((c) => c.key === 'priceCommission');
    if (crit) {
      crit.rating = maxComm >= 10 ? 5 : maxComm >= 7 ? 4 : maxComm >= 4 ? 3 : 2;
      crit.verification = 'verified_fact';
      crit.sourceUrl = safeUrl;
      crit.recordedAt = nowIso;
      crit.reason = `Đã xác minh thủ công trên ${body.platform}: ${newMatch.priceVnd.toLocaleString('vi-VN')}đ · Hoa hồng ${newMatch.commissionRate}%.`;
    }
    product.evidence.unshift({
      id: `ev_mm_${crypto.randomUUID().slice(0, 6)}`,
      productId: product.id,
      field: `Đối chiếu ${body.platform} (Thủ công)`,
      claim: `${newMatch.shopName} — ${newMatch.priceVnd.toLocaleString('vi-VN')}đ · Hoa hồng ${newMatch.commissionRate}%`,
      status: 'verified_fact',
      retrievalMode: 'manual',
      sourceName: `${body.platform} VN (Manual)`,
      sourceUrl: safeUrl,
      recordedAt: nowIso,
    });
  }

  const settings = getSettings();
  const scoring = calculateOpportunityScore(
    product.criteria,
    product.evidence,
    product.marketplaceMatches,
    settings.weights,
    settings.thresholds,
  );
  if (scoring.score !== null) {
    product.scoreHistory.push({
      date: nowIso.slice(0, 10),
      score: scoring.score,
      completeness: scoring.dataCompleteness,
      reason: `Người vận hành bổ sung shop ${newMatch.shopName} (${newMatch.platform}).`,
    });
  }
  product.updatedAt = nowIso;

  db.prepare('UPDATE products SET payload_json = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(product),
    nowIso,
    product.id,
  );

  res.status(201).json({ product, scoring, match: newMatch });
});

apiRouter.delete('/products/:id/marketplace-matches/:matchId', (req, res) => {
  const row = db.prepare('SELECT payload_json FROM products WHERE id = ?').get(req.params.id) as
    | { payload_json: string }
    | undefined;
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Không tìm thấy sản phẩm.');
  const product = JSON.parse(row.payload_json) as ProductRecord;
  product.marketplaceMatches = product.marketplaceMatches.filter((m) => m.id !== req.params.matchId);
  product.updatedAt = new Date().toISOString();
  db.prepare('UPDATE products SET payload_json = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(product),
    product.updatedAt,
    product.id,
  );
  const settings = getSettings();
  const scoring = calculateOpportunityScore(
    product.criteria,
    product.evidence,
    product.marketplaceMatches,
    settings.weights,
    settings.thresholds,
  );
  res.json({ product, scoring });
});

// ---------- ON-DEMAND DEEP RESEARCH JOBS & SSE ----------
function saveRun(run: ResearchRun) {
  db.prepare(
    `INSERT INTO research_runs (id, keyword, status, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status, payload_json = excluded.payload_json`,
  ).run(run.id, run.keyword, run.status, JSON.stringify(run), run.createdAt);
  researchEvents.emit(run.id, run);
}

async function executeResearchPipeline(run: ResearchRun) {
  const settings = getSettings();
  try {
    run.status = 'running';
    run.progress = 15;
    run.steps[0].status = 'running';
    run.steps[0].timestamp = new Date().toISOString();
    saveRun(run);

    // Step 1: Global Last30Days / Grounded Web Search
    const globalRes = await runGroundedMarketSearch(run.keyword, 'global');
    run.tokensUsed += globalRes.tokens;
    run.steps[0].status = 'completed';
    run.steps[0].detail = `Tìm thấy ${globalRes.urls.length} nguồn dẫn quốc tế (Last30Days Global / Web Grounding).`;
    run.steps[0].timestamp = new Date().toISOString();
    run.progress = 45;
    run.steps[1].status = 'running';
    run.steps[1].timestamp = new Date().toISOString();
    saveRun(run);

    // Step 2: CN Last30Days (check xhs-mcp bridge first)
    const bridge = await checkXhsMcpBridge(settings.xhsMcpEnabled, settings.xhsMcpUrl);
    const cnRes = await runGroundedMarketSearch(run.keyword, 'cn');
    run.tokensUsed += cnRes.tokens;
    run.retrievalModes = bridge.connected ? ['authenticated', 'authenticated'] : ['authenticated', 'public_search'];
    run.steps[1].status = bridge.connected ? 'completed' : 'warning';
    run.steps[1].detail = bridge.connected
      ? `Thu thập qua cầu nối xiaohongshu-mcp (${cnRes.urls.length} nguồn).`
      : `Thu thập qua nguồn công khai (public_search — ${cnRes.urls.length} nguồn, tự động giảm trọng số tin cậy).`;
    run.steps[1].timestamp = new Date().toISOString();
    run.progress = 72;
    run.steps[2].status = 'running';
    run.steps[2].timestamp = new Date().toISOString();
    saveRun(run);

    // Step 3: Pipeline 2 Structured Product Profile & Evidence Tagging
    const aiOut = await runPipeline2DeepResearch({
      keyword: run.keyword,
      globalResearch: globalRes,
      cnResearch: cnRes,
      xhsMcpAuthenticated: bridge.connected,
    });
    run.tokensUsed += aiOut.tokens;
    run.estimatedCostUsd = Number((run.tokensUsed * 0.000001).toFixed(5));
    run.steps[2].status = 'completed';
    run.steps[2].detail = `Đã tổng hợp hồ sơ 360° "${aiOut.product.nameVi}" với ${aiOut.product.evidence.length} mục bằng chứng.`;
    run.steps[2].timestamp = new Date().toISOString();
    run.progress = 90;
    run.steps[3].status = 'running';
    run.steps[3].timestamp = new Date().toISOString();
    saveRun(run);

    // Step 4: Null-Safe Opportunity Scoring & Persist Product
    const productId = `prod_${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();
    const evidenceWithProdId = aiOut.product.evidence.map((e) => ({ ...e, productId }));
    const scoring = calculateOpportunityScore(
      aiOut.product.criteria,
      evidenceWithProdId,
      [],
      settings.weights,
      settings.thresholds,
    );

    const product: ProductRecord = {
      ...aiOut.product,
      id: productId,
      trendId: run.trendId ?? null,
      evidence: evidenceWithProdId,
      marketplaceMatches: [],
      scoreHistory: [
        {
          date: nowIso.slice(0, 10),
          score: scoring.score ?? 0,
          completeness: scoring.dataCompleteness,
          reason: `Nghiên cứu sâu tự động hoàn tất (${scoring.isProvisional ? 'Tạm tính — thiếu giá/hoa hồng VN' : 'Đủ dữ liệu'}).`,
        },
      ],
      updatedAt: nowIso,
    };

    db.prepare(
      'INSERT INTO products (id, trend_id, category, name_vi, payload_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(product.id, product.trendId ?? null, product.category, product.nameVi, JSON.stringify(product), nowIso);

    if (run.trendId) {
      const trRow = db.prepare('SELECT payload_json FROM trend_topics WHERE id = ?').get(run.trendId) as
        | { payload_json: string }
        | undefined;
      if (trRow) {
        const trend = JSON.parse(trRow.payload_json) as TrendTopic;
        trend.linkedProductId = productId;
        db.prepare('UPDATE trend_topics SET payload_json = ?, updated_at = ? WHERE id = ?').run(
          JSON.stringify(trend),
          nowIso,
          run.trendId,
        );
      }
    }

    run.productId = productId;
    run.status = 'completed';
    run.progress = 100;
    run.completedAt = nowIso;
    run.steps[3].status = 'completed';
    run.steps[3].detail = `Điểm cơ hội: ${scoring.score ?? '—'}/100 (${scoring.isProvisional ? 'Tạm tính' : 'Đủ'}) · Độ đầy đủ ${scoring.dataCompleteness}% · ${scoring.tier}.`;
    run.steps[3].timestamp = nowIso;
    saveRun(run);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định trong tiến trình nghiên cứu.';
    run.status = 'failed';
    run.errorMessage = message;
    const activeStep = run.steps.find((s) => s.status === 'running') ?? run.steps[0];
    if (activeStep) {
      activeStep.status = 'failed';
      activeStep.detail = message;
      activeStep.timestamp = new Date().toISOString();
    }
    saveRun(run);
  }
}

apiRouter.get('/research/runs', (_req, res) => {
  const runs = getAllFromTable<ResearchRun>('research_runs', 'created_at DESC');
  res.json({ items: runs });
});

apiRouter.post('/research/runs', (req, res) => {
  const { keyword, trendId } = req.body as { keyword?: string; trendId?: string };
  if (!keyword || !keyword.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Vui lòng nhập từ khóa hoặc chọn xu hướng cần nghiên cứu sâu.');
  }
  const nowIso = new Date().toISOString();
  const run: ResearchRun = {
    id: `run_${crypto.randomUUID().slice(0, 8)}`,
    keyword: keyword.trim(),
    trendId: trendId || null,
    productId: null,
    status: 'queued',
    progress: 5,
    sourcesUsed: ['Last30Days Global (Web Grounding)', 'Last30Days CN (Public/Bridge)', 'Gemini Pipeline 2'],
    retrievalModes: [],
    steps: [
      { step: 'global', label: 'Gọi Last30Days Global (Thảo luận quốc tế 30 ngày)', status: 'pending', detail: 'Đang chờ khởi chạy...', timestamp: nowIso },
      { step: 'cn', label: 'Gọi Last30Days CN (Thảo luận Trung Quốc)', status: 'pending', detail: 'Đang chờ khởi chạy...', timestamp: nowIso },
      { step: 'extract', label: 'AI Pipeline 2: Tổng hợp hồ sơ & gắn nhãn bằng chứng', status: 'pending', detail: 'Đang chờ khởi chạy...', timestamp: nowIso },
      { step: 'score', label: 'Chấm điểm cơ hội Null-safe & lưu hồ sơ 360°', status: 'pending', detail: 'Đang chờ khởi chạy...', timestamp: nowIso },
    ],
    tokensUsed: 0,
    estimatedCostUsd: 0,
    createdAt: nowIso,
  };
  saveRun(run);
  void executeResearchPipeline(run);
  res.status(201).json({ run });
});

apiRouter.post('/research/runs/:id/retry', (req, res) => {
  const row = db.prepare('SELECT payload_json FROM research_runs WHERE id = ?').get(req.params.id) as
    | { payload_json: string }
    | undefined;
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Không tìm thấy tác vụ nghiên cứu.');
  const prev = JSON.parse(row.payload_json) as ResearchRun;
  const nowIso = new Date().toISOString();
  const retried: ResearchRun = {
    ...prev,
    status: 'queued',
    progress: 5,
    errorMessage: null,
    completedAt: null,
    steps: prev.steps.map((s) => ({ ...s, status: 'pending', detail: 'Đang chạy lại...', timestamp: nowIso })),
  };
  saveRun(retried);
  void executeResearchPipeline(retried);
  res.json({ run: retried });
});

apiRouter.get('/research/runs/:id/events', (req: Request, res: Response) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const row = db.prepare('SELECT payload_json FROM research_runs WHERE id = ?').get(id) as
    | { payload_json: string }
    | undefined;
  if (row) {
    res.write(`data: ${row.payload_json}\n\n`);
  }

  const listener = (updated: ResearchRun) => {
    res.write(`data: ${JSON.stringify(updated)}\n\n`);
    if (updated.status === 'completed' || updated.status === 'failed') {
      res.end();
    }
  };

  researchEvents.on(id, listener);
  req.on('close', () => {
    researchEvents.off(id, listener);
  });
});

// ---------- CONTENT STUDIO & CALENDAR (v1.1) ----------
apiRouter.get('/content', (_req, res) => {
  const items = getAllFromTable<ContentAsset>('content_assets', 'updated_at DESC');
  res.json({ items });
});

apiRouter.post('/content/generate', async (req, res) => {
  const { productId, durationSec, platform, angleNote } = req.body as {
    productId?: string;
    durationSec?: 15 | 30 | 60;
    platform?: ContentAsset['platform'];
    angleNote?: string;
  };
  if (!productId) return sendError(res, 400, 'VALIDATION_ERROR', 'Vui lòng chọn sản phẩm cần tạo kịch bản.');
  const prodRow = db.prepare('SELECT payload_json FROM products WHERE id = ?').get(productId) as
    | { payload_json: string }
    | undefined;
  if (!prodRow) return sendError(res, 404, 'NOT_FOUND', 'Không tìm thấy sản phẩm.');
  const product = JSON.parse(prodRow.payload_json) as ProductRecord;

  try {
    const generated = await runPipeline3ContentStudio({
      product,
      durationSec: durationSec || 30,
      platform: platform || 'TikTok',
      angleNote,
    });
    const existingForProduct = db
      .prepare('SELECT COUNT(*) AS cnt FROM content_assets WHERE product_id = ?')
      .get(productId) as { cnt: number };

    const nowIso = new Date().toISOString();
    const asset: ContentAsset = {
      ...generated,
      id: `cnt_${crypto.randomUUID().slice(0, 8)}`,
      version: existingForProduct.cnt + 1,
      status: 'Draft',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.prepare(
      'INSERT INTO content_assets (id, product_id, status, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).run(asset.id, asset.productId, asset.status, JSON.stringify(asset), nowIso);

    res.status(201).json({ asset });
  } catch (err) {
    sendError(
      res,
      500,
      'CONTENT_GENERATION_FAILED',
      err instanceof Error ? err.message : 'Không thể sinh kịch bản từ AI Pipeline 3.',
    );
  }
});

apiRouter.post('/content', (req, res) => {
  const body = req.body as Partial<ContentAsset>;
  if (!body.productId || !body.title?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Vui lòng nhập tiêu đề và chọn sản phẩm.');
  }
  const nowIso = new Date().toISOString();
  const asset: ContentAsset = {
    id: `cnt_${crypto.randomUUID().slice(0, 8)}`,
    productId: body.productId,
    productName: body.productName || 'Sản phẩm',
    title: body.title.trim(),
    durationSec: body.durationSec || 30,
    platform: body.platform || 'TikTok',
    version: 1,
    status: body.status || 'Idea',
    scheduledDate: body.scheduledDate || null,
    hook: body.hook || '',
    voiceOver: body.voiceOver || '',
    storyboard: body.storyboard || [],
    caption: body.caption || '',
    hashtags: body.hashtags || [],
    cta: body.cta || '',
    visualPrompt: body.visualPrompt || '',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  db.prepare(
    'INSERT INTO content_assets (id, product_id, status, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run(asset.id, asset.productId, asset.status, JSON.stringify(asset), nowIso);
  res.status(201).json({ asset });
});

apiRouter.patch('/content/:id', (req, res) => {
  const row = db.prepare('SELECT payload_json FROM content_assets WHERE id = ?').get(req.params.id) as
    | { payload_json: string }
    | undefined;
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Không tìm thấy nội dung.');
  const existing = JSON.parse(row.payload_json) as ContentAsset;
  const patch = req.body as Partial<ContentAsset>;
  const updated: ContentAsset = {
    ...existing,
    ...patch,
    id: existing.id,
    status: (patch.status ?? existing.status) as ContentStatus,
    updatedAt: new Date().toISOString(),
  };
  db.prepare('UPDATE content_assets SET status = ?, payload_json = ?, updated_at = ? WHERE id = ?').run(
    updated.status,
    JSON.stringify(updated),
    updated.updatedAt,
    updated.id,
  );
  res.json({ asset: updated });
});

// ---------- CAMPAIGNS & AFFILIATE LINKS (v1.1) ----------
apiRouter.get('/campaigns', (_req, res) => {
  const campaigns = getAllFromTable<CampaignRecord>('campaigns', 'created_at DESC');
  const links = getAllFromTable<AffiliateLinkRecord>('affiliate_links', 'created_at DESC');
  res.json({ campaigns, links });
});

apiRouter.post('/campaigns', (req, res) => {
  const body = req.body as Partial<CampaignRecord>;
  if (!body.name?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Vui lòng nhập tên chiến dịch.');
  }
  const nowIso = new Date().toISOString();
  const campaign: CampaignRecord = {
    id: `cmp_${crypto.randomUUID().slice(0, 8)}`,
    name: body.name.trim(),
    objective: body.objective?.trim() || 'Tối ưu chuyển đổi Affiliate',
    status: body.status || 'Đang chạy',
    startDate: body.startDate || nowIso.slice(0, 10),
    endDate: body.endDate || null,
    budgetVnd: Math.max(0, Math.round(Number(body.budgetVnd ?? 0))),
    productIds: Array.isArray(body.productIds) ? body.productIds : [],
    createdAt: nowIso,
  };
  db.prepare('INSERT INTO campaigns (id, status, payload_json, created_at) VALUES (?, ?, ?, ?)').run(
    campaign.id,
    campaign.status,
    JSON.stringify(campaign),
    nowIso,
  );
  res.status(201).json({ campaign });
});

apiRouter.post('/affiliate/links', (req, res) => {
  const body = req.body as Partial<AffiliateLinkRecord>;
  const safeUrl = sanitizeExternalUrl(body.originalAffiliateUrl);
  if (!body.productId || !body.platform || !safeUrl || !body.subId?.trim()) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Vui lòng nhập Sản phẩm, Sàn, Link Affiliate hợp lệ (http/https) và mã Sub_id.',
    );
  }

  const settings = getSettings();
  const id = `lnk_${crypto.randomUUID().slice(0, 8)}`;
  const subId = body.subId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const utmSource = (body.utmSource || 'tiktok').trim();
  const utmCampaign = (body.utmCampaign || 'aff_radar').trim();

  let trackingUrl: string;
  let trackingMode: AffiliateLinkRecord['trackingMode'];
  if (settings.publicBaseUrl && sanitizeExternalUrl(settings.publicBaseUrl)) {
    const base = settings.publicBaseUrl.replace(/\/+$/, '');
    trackingUrl = `${base}/r/${id}?sub_id=${encodeURIComponent(subId)}`;
    trackingMode = 'Redirect Tracker (VPS)';
  } else {
    const parsed = new URL(safeUrl);
    parsed.searchParams.set('sub_id', subId);
    if (utmSource) parsed.searchParams.set('utm_source', utmSource);
    if (utmCampaign) parsed.searchParams.set('utm_campaign', utmCampaign);
    trackingUrl = parsed.toString();
    trackingMode = 'Sub_id / UTM (Local)';
  }

  const prodRow = db.prepare('SELECT payload_json FROM products WHERE id = ?').get(body.productId) as
    | { payload_json: string }
    | undefined;
  const prodName = prodRow ? (JSON.parse(prodRow.payload_json) as ProductRecord).nameVi : body.productName || 'Sản phẩm';

  const link: AffiliateLinkRecord = {
    id,
    campaignId: body.campaignId || null,
    productId: body.productId,
    productName: prodName,
    platform: body.platform,
    originalAffiliateUrl: safeUrl,
    subId,
    utmSource,
    utmCampaign,
    trackingUrl,
    trackingMode,
    stockStatus: body.stockStatus || 'Còn hàng',
    promoExpiresAt: body.promoExpiresAt || null,
    clicks: 0,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    'INSERT INTO affiliate_links (id, campaign_id, product_id, platform, sub_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(link.id, link.campaignId, link.productId, link.platform, link.subId, JSON.stringify(link), link.createdAt);

  res.status(201).json({ link });
});

apiRouter.patch('/affiliate/links/:id', (req, res) => {
  const row = db.prepare('SELECT payload_json FROM affiliate_links WHERE id = ?').get(req.params.id) as
    | { payload_json: string }
    | undefined;
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Không tìm thấy link Affiliate.');
  const existing = JSON.parse(row.payload_json) as AffiliateLinkRecord;
  const updated: AffiliateLinkRecord = { ...existing, ...(req.body as Partial<AffiliateLinkRecord>), id: existing.id };
  db.prepare('UPDATE affiliate_links SET payload_json = ? WHERE id = ?').run(JSON.stringify(updated), updated.id);
  res.json({ link: updated });
});

// ---------- CSV/XLSX IMPORT WIZARD & PRESETS (v1.1) ----------
apiRouter.get('/imports/meta', (_req, res) => {
  const presets = getAllFromTable<CsvImportPreset>('csv_import_presets', 'rowid ASC');
  const existingRows = db.prepare('SELECT platform, order_code FROM affiliate_orders').all() as {
    platform: string;
    order_code: string;
  }[];
  res.json({
    presets,
    existingOrderKeys: existingRows.map((r) => `${r.platform}:${r.order_code}`),
  });
});

apiRouter.post('/imports/presets', (req, res) => {
  const { name, platform, mapping } = req.body as Partial<CsvImportPreset>;
  if (!name?.trim() || !platform || !mapping) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Thiếu tên preset hoặc thông tin mapping cột.');
  }
  const preset: CsvImportPreset = {
    id: `preset_${crypto.randomUUID().slice(0, 8)}`,
    name: name.trim(),
    platform,
    mapping,
  };
  db.prepare('INSERT INTO csv_import_presets (id, platform, payload_json) VALUES (?, ?, ?)').run(
    preset.id,
    preset.platform,
    JSON.stringify(preset),
  );
  res.status(201).json({ preset });
});

apiRouter.post('/imports/commit', (req, res) => {
  const { records } = req.body as {
    records?: Omit<AffiliateOrderRecord, 'id' | 'batchId'>[];
  };
  if (!Array.isArray(records) || records.length === 0) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Không có bản ghi hợp lệ nào để nhập.');
  }

  const batchId = `batch_${crypto.randomUUID().slice(0, 8)}`;
  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO affiliate_orders (id, batch_id, platform, order_code, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  let insertedCount = 0;
  let skippedDuplicates = 0;

  const tx = db.transaction((items: Omit<AffiliateOrderRecord, 'id' | 'batchId'>[]) => {
    for (const item of items) {
      const id = `ord_${crypto.randomUUID().slice(0, 8)}`;
      const full: AffiliateOrderRecord = { ...item, id, batchId };
      const info = insertStmt.run(
        full.id,
        full.batchId,
        full.platform,
        full.orderCode,
        JSON.stringify(full),
        full.createdAt,
      );
      if (info.changes > 0) insertedCount += 1;
      else skippedDuplicates += 1;
    }
  });

  tx(records);
  res.status(201).json({
    batchId,
    insertedCount,
    skippedDuplicates,
    message: `Đã nhập thành công ${insertedCount} đơn hàng mới${skippedDuplicates > 0 ? ` (bỏ qua ${skippedDuplicates} mã đơn trùng lặp)` : ''}.`,
  });
});

// ---------- REVENUE & ROI ANALYTICS (v1.1) ----------
apiRouter.get('/analytics/summary', (_req, res) => {
  const orders = getAllFromTable<AffiliateOrderRecord>('affiliate_orders', 'created_at DESC');
  const expenses = getAllFromTable<ExpenseRecord>('expenses', 'spent_at DESC');
  const links = getAllFromTable<AffiliateLinkRecord>('affiliate_links', 'created_at DESC');
  const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
  const funnel = calculateRevenueFunnel(orders, expenses, totalClicks);
  res.json({ funnel, orders, expenses });
});

apiRouter.post('/analytics/expenses', (req, res) => {
  const body = req.body as Partial<ExpenseRecord>;
  if (!body.category || !body.description?.trim() || !body.amountVnd || Number(body.amountVnd) <= 0) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Vui lòng nhập Danh mục, Mô tả và Số tiền > 0 VNĐ.');
  }
  const expense: ExpenseRecord = {
    id: `exp_${crypto.randomUUID().slice(0, 8)}`,
    category: body.category,
    description: body.description.trim(),
    amountVnd: Math.round(Number(body.amountVnd)),
    campaignId: body.campaignId || null,
    spentAt: body.spentAt || new Date().toISOString().slice(0, 10),
  };
  db.prepare(
    'INSERT INTO expenses (id, category, amount_vnd, payload_json, spent_at) VALUES (?, ?, ?, ?, ?)',
  ).run(expense.id, expense.category, expense.amountVnd, JSON.stringify(expense), expense.spentAt);
  res.status(201).json({ expense });
});

// ---------- SETTINGS, AI COST CONTROL, NOTIFICATIONS & BACKUP ----------
apiRouter.get('/settings', (_req, res) => {
  const settings = getSettings();
  const todayTokens = getTodayAiTokens();
  const todayPrefix = new Date().toISOString().slice(0, 10);

  const byPipeline = db
    .prepare(
      `SELECT pipeline, SUM(tokens) AS tokens, COUNT(*) AS calls, SUM(cost_usd) AS costUsd
       FROM ai_usage_logs WHERE created_at LIKE ? GROUP BY pipeline`,
    )
    .all(`${todayPrefix}%`) as { pipeline: string; tokens: number; calls: number; costUsd: number }[];

  const recentLogs = db
    .prepare('SELECT id, pipeline, model, tokens, cost_usd AS costUsd, status, created_at AS createdAt FROM ai_usage_logs ORDER BY created_at DESC LIMIT 12')
    .all() as { id: string; pipeline: string; model: string; tokens: number; costUsd: number; status: string; createdAt: string }[];

  const todayCostUsd = byPipeline.reduce((sum, p) => sum + (p.costUsd || 0), 0);

  res.json({
    settings,
    aiUsage: {
      todayTokens,
      todayCostUsd: Number(todayCostUsd.toFixed(6)),
      dailyBudgetTokens: settings.aiDailyTokenBudget,
      budgetReached: todayTokens >= settings.aiDailyTokenBudget,
      byPipeline,
      recentLogs,
    },
  });
});

apiRouter.put('/settings', (req, res) => {
  const current = getSettings();
  const incoming = req.body as Partial<AppSettings>;

  if (incoming.weights) {
    const sum = Object.values(incoming.weights).reduce((a, b) => a + Number(b), 0);
    if (Math.round(sum) !== 100) {
      return sendError(res, 400, 'INVALID_WEIGHTS', `Tổng trọng số 6 tiêu chí phải bằng 100% (hiện tại: ${sum}%).`);
    }
  }

  const merged: AppSettings = {
    ...current,
    ...incoming,
    pipelines: { ...current.pipelines, ...(incoming.pipelines ?? {}) },
    weights: { ...current.weights, ...(incoming.weights ?? {}) },
    thresholds: { ...current.thresholds, ...(incoming.thresholds ?? {}) },
    notifications: { ...current.notifications, ...(incoming.notifications ?? {}) },
  };
  saveSettings(merged);
  res.json({ settings: merged });
});

apiRouter.post('/notifications/:id/read', (req, res) => {
  const row = db.prepare('SELECT payload_json FROM notifications WHERE id = ?').get(req.params.id) as
    | { payload_json: string }
    | undefined;
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Không tìm thấy thông báo.');
  const n = JSON.parse(row.payload_json) as NotificationItem;
  n.read = true;
  db.prepare('UPDATE notifications SET read = 1, payload_json = ? WHERE id = ?').run(JSON.stringify(n), n.id);
  res.json({ ok: true });
});

apiRouter.get('/system/backup', (_req, res) => {
  const dump = {
    exportedAt: new Date().toISOString(),
    version: '1.1.0',
    settings: getSettings(),
    trends: getAllFromTable<TrendTopic>('trend_topics'),
    products: getAllFromTable<ProductRecord>('products'),
    contentAssets: getAllFromTable<ContentAsset>('content_assets'),
    campaigns: getAllFromTable<CampaignRecord>('campaigns'),
    affiliateLinks: getAllFromTable<AffiliateLinkRecord>('affiliate_links'),
    affiliateOrders: getAllFromTable<AffiliateOrderRecord>('affiliate_orders'),
    expenses: getAllFromTable<ExpenseRecord>('expenses'),
  };
  res.json(dump);
});

apiRouter.post('/system/restore', (req, res) => {
  const dump = req.body as { settings?: AppSettings };
  if (!dump || typeof dump !== 'object' || !dump.settings) {
    return sendError(res, 400, 'INVALID_BACKUP', 'Tệp sao lưu JSON không đúng định dạng Trend Affiliate Radar.');
  }
  saveSettings(dump.settings);
  res.json({ ok: true, message: 'Đã khôi phục cấu hình từ bản sao lưu thành công.' });
});
