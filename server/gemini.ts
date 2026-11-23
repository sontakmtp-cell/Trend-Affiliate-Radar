import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'node:crypto';
import { getSettings, getTodayAiTokens, logAiUsage } from './db';
import type {
  ContentAsset,
  ProductRecord,
  TrendTopic,
} from '../src/lib/types';

function createClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình trong môi trường server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function assertBudgetAvailable(isBackground: boolean): void {
  const settings = getSettings();
  const used = getTodayAiTokens();
  if (isBackground && settings.aiDailyBudgetHardStop && used >= settings.aiDailyTokenBudget) {
    throw new Error(
      `Đã chạm hạn mức ngân sách AI ngày (${used.toLocaleString('vi-VN')}/${settings.aiDailyTokenBudget.toLocaleString('vi-VN')} tokens). Tác vụ nền tạm dừng để kiểm soát chi phí.`,
    );
  }
}

export async function testGeminiConnection(): Promise<{
  ok: boolean;
  model: string;
  latencyMs: number;
  message: string;
}> {
  const start = Date.now();
  const settings = getSettings();
  const model = settings.pipelines.triageModel || 'gemini-3.1-flash-lite';
  try {
    const ai = createClient();
    const res = await ai.models.generateContent({
      model,
      contents: 'Trả lời ngắn gọn 1 từ: OK',
    });
    const latencyMs = Date.now() - start;
    const tokens = res.usageMetadata?.totalTokenCount ?? 40;
    logAiUsage({
      id: `ai_${crypto.randomUUID().slice(0, 8)}`,
      pipeline: 'Health Check',
      model,
      tokens,
      costUsd: Number((tokens * 0.0000004).toFixed(6)),
      status: 'Thành công',
    });
    return {
      ok: true,
      model,
      latencyMs,
      message: `Kết nối AI Engine thành công (${model}, ${latencyMs}ms).`,
    };
  } catch (err) {
    return {
      ok: false,
      model,
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : 'Không thể kết nối AI Engine.',
    };
  }
}

/**
 * Pipeline 1: Triage & Extraction
 * Classifies live raw signals into Commercial Product vs non-commercial buckets
 * and extracts Vietnamese/English/Chinese titles + commercial product intent.
 */
export async function runPipeline1Triage(
  rawSignals: { title: string; platform: string; url: string; score: number }[],
): Promise<Partial<TrendTopic>[]> {
  assertBudgetAvailable(true);
  const settings = getSettings();
  const model = settings.pipelines.triageModel || 'gemini-3.1-flash-lite';
  const ai = createClient();

  const prompt = `Bạn là Pipeline 1 (Triage & Extraction) của hệ thống Trend Affiliate Radar cho thị trường Việt Nam.
Phân tích danh sách tín hiệu xu hướng thô sau đây. Với mỗi tín hiệu:
1. Dịch/tóm tắt tên tiếng Việt rõ ràng (titleVi) và giữ titleEn/titleZh nếu có.
2. Phân loại ý định thương mại (intent) CHÍNH XÁC vào 1 trong 6 nhóm:
   - "Commercial Product" (có sản phẩm vật lý/số bán được qua Shopee/TikTok Shop/Lazada)
   - "Entertainment/No Product"
   - "News/Politics"
   - "Tech/Concept Only"
   - "Legal/Safety Risk"
   - "Insufficient Data"
3. Gán danh mục tiếng Việt phù hợp (category) và region ("CN", "Global", "VN", hoặc "CN→VN").
4. Không bịa số liệu bán hàng.

Danh sách tín hiệu thô:
${JSON.stringify(rawSignals.slice(0, 8), null, 2)}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            originalTitle: { type: Type.STRING },
            titleVi: { type: Type.STRING },
            titleEn: { type: Type.STRING },
            titleZh: { type: Type.STRING },
            category: { type: Type.STRING },
            region: { type: Type.STRING },
            intent: { type: Type.STRING },
            momentumScore: { type: Type.NUMBER },
          },
          required: ['originalTitle', 'titleVi', 'category', 'region', 'intent', 'momentumScore'],
        },
      },
    },
  });

  const tokens = response.usageMetadata?.totalTokenCount ?? 850;
  logAiUsage({
    id: `ai_${crypto.randomUUID().slice(0, 8)}`,
    pipeline: 'Pipeline 1 · Triage & Extraction',
    model,
    tokens,
    costUsd: Number((tokens * 0.0000004).toFixed(6)),
    status: 'Thành công',
  });

  const parsed = JSON.parse((response.text ?? '[]').trim()) as Array<{
    originalTitle: string;
    titleVi: string;
    titleEn?: string;
    titleZh?: string;
    category: string;
    region: string;
    intent: string;
    momentumScore: number;
  }>;

  const validIntents = new Set([
    'Commercial Product',
    'Entertainment/No Product',
    'News/Politics',
    'Tech/Concept Only',
    'Legal/Safety Risk',
    'Insufficient Data',
  ]);

  return parsed.map((item, idx) => {
    const src = rawSignals[idx] ?? rawSignals[0];
    const score = Math.min(98, Math.max(35, Math.round(item.momentumScore || 65)));
    return {
      title: item.originalTitle || src.title,
      titleVi: item.titleVi || src.title,
      titleEn: item.titleEn || src.title,
      titleZh: item.titleZh || '',
      category: item.category || 'Phụ kiện công nghệ',
      platforms: [src.platform],
      region: (['CN', 'Global', 'VN', 'CN→VN'].includes(item.region) ? item.region : 'Global') as TrendTopic['region'],
      intent: (validIntents.has(item.intent) ? item.intent : 'Insufficient Data') as TrendTopic['intent'],
      momentumScore: score,
      sourceUrl: src.url,
    };
  });
}

/**
 * Grounded live search for Global & CN 30-day discussions via Gemini Google Search Grounding
 */
export async function runGroundedMarketSearch(
  keyword: string,
  market: 'global' | 'cn',
): Promise<{ summary: string; urls: { uri: string; title: string }[]; tokens: number }> {
  const settings = getSettings();
  const model = settings.pipelines.researchModel || 'gemini-4-hydrogen';
  const ai = createClient();

  const queryPrompt =
    market === 'global'
      ? `Tìm kiếm thảo luận thực tế trong 30 ngày qua trên Reddit, YouTube, TikTok và diễn đàn quốc tế về sản phẩm "${keyword}". Tóm tắt ngắn gọn nhu cầu thực tế, phản hồi khen/chê của người dùng, và khoảng giá phổ biến bằng tiếng Việt. Không bịa đặt số liệu nếu không tìm thấy.`
      : `Tìm kiếm xu hướng thảo luận gần đây trên thị trường Trung Quốc (Xiaohongshu, Douyin, Bilibili, Weibo, Taobao) về sản phẩm "${keyword}". Tóm tắt ngắn gọn tên tiếng Trung tương ứng, lý do sản phẩm gây chú ý và điểm hạn chế người dùng phàn nàn bằng tiếng Việt. Ghi rõ nếu thông tin hạn chế.`;

  const response = await ai.models.generateContent({
    model,
    contents: queryPrompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const urls: { uri: string; title: string }[] = [];
  for (const ch of chunks) {
    const web = (ch as { web?: { uri?: string; title?: string } }).web;
    if (web?.uri) {
      urls.push({ uri: web.uri, title: web.title || web.uri });
    }
  }

  const tokens = response.usageMetadata?.totalTokenCount ?? 1200;
  return {
    summary: (response.text ?? '').trim() || 'Chưa thu thập được thảo luận chi tiết.',
    urls: urls.slice(0, 5),
    tokens,
  };
}

/**
 * Pipeline 2: Deep Research & Scoring
 * Synthesizes Global + CN evidence into a 360-degree structured ProductRecord
 * enforcing Evidence Discipline (Verified Fact / AI Inference / Unknown) and Null-safe scoring.
 */
export async function runPipeline2DeepResearch(params: {
  keyword: string;
  globalResearch: { summary: string; urls: { uri: string; title: string }[] };
  cnResearch: { summary: string; urls: { uri: string; title: string }[] };
  xhsMcpAuthenticated: boolean;
}): Promise<{ product: Omit<ProductRecord, 'id' | 'marketplaceMatches' | 'scoreHistory' | 'updatedAt'>; tokens: number }> {
  const settings = getSettings();
  const model = settings.pipelines.researchModel || 'gemini-4-hydrogen';
  const ai = createClient();

  const prompt = `Bạn là Pipeline 2 (Deep Research & Scoring) của Trend Affiliate Radar Việt Nam.
Dựa CHỈ trên bằng chứng thu thập thực tế bên dưới cho từ khóa "${params.keyword}", hãy lập Hồ sơ Nghiên cứu Sản phẩm 360° dạng JSON chuẩn.

QUY TẮC KỶ LUẬT BẰNG CHỨNG BẮT BUỘC:
- Tuyệt đối KHÔNG tự bịa doanh số, lượt bán hoặc tỷ lệ hoa hồng Shopee/TikTok Shop.
- Đối với tiêu chí "priceCommission" (Giá bán & hoa hồng tại Việt Nam), vì chưa có kết nối Shopee/TikTok Open API chính thức, BẮT BUỘC đặt rating = null và verification = "unknown" để người vận hành tự xác minh thủ công.
- Các tiêu chí có bằng chứng từ thảo luận Global/CN chấm từ 1 đến 5 (số nguyên) kèm lý do ngắn gọn rõ ràng.
- Mọi nội dung viết bằng tiếng Việt tự nhiên, súc tích, thực tế.

BẰNG CHỨNG GLOBAL (Last30Days Global / Search Grounding):
${params.globalResearch.summary}
URLs: ${JSON.stringify(params.globalResearch.urls)}

BẰNG CHỨNG TRUNG QUỐC (Last30Days CN / ${params.xhsMcpAuthenticated ? 'authenticated' : 'public_search'}):
${params.cnResearch.summary}
URLs: ${JSON.stringify(params.cnResearch.urls)}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nameVi: { type: Type.STRING },
          nameZh: { type: Type.STRING },
          nameEn: { type: Type.STRING },
          aliases: { type: Type.ARRAY, items: { type: Type.STRING } },
          category: { type: Type.STRING },
          summary: { type: Type.STRING },
          useCase: { type: Type.STRING },
          customerPainPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          buyerPersona: { type: Type.STRING },
          chinaSignalSummary: { type: Type.STRING },
          globalSignalSummary: { type: Type.STRING },
          vietnamSignalSummary: { type: Type.STRING },
          competitors: { type: Type.ARRAY, items: { type: Type.STRING } },
          contentAngles: { type: Type.ARRAY, items: { type: Type.STRING } },
          risks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                detail: { type: Type.STRING },
                severity: { type: Type.STRING },
              },
              required: ['type', 'detail', 'severity'],
            },
          },
          aiConclusion: { type: Type.STRING },
          hasCnToVnSignal: { type: Type.BOOLEAN },
          ratings: {
            type: Type.OBJECT,
            properties: {
              trendGrowth: { type: Type.INTEGER, nullable: true },
              trendGrowthReason: { type: Type.STRING },
              vietnamDemand: { type: Type.INTEGER, nullable: true },
              vietnamDemandReason: { type: Type.STRING },
              competition: { type: Type.INTEGER, nullable: true },
              competitionReason: { type: Type.STRING },
              contentPotential: { type: Type.INTEGER, nullable: true },
              contentPotentialReason: { type: Type.STRING },
              supplyRisk: { type: Type.INTEGER, nullable: true },
              supplyRiskReason: { type: Type.STRING },
            },
            required: [
              'trendGrowth',
              'trendGrowthReason',
              'vietnamDemand',
              'vietnamDemandReason',
              'competition',
              'competitionReason',
              'contentPotential',
              'contentPotentialReason',
              'supplyRisk',
              'supplyRiskReason',
            ],
          },
        },
        required: [
          'nameVi',
          'nameZh',
          'nameEn',
          'aliases',
          'category',
          'summary',
          'useCase',
          'customerPainPoints',
          'buyerPersona',
          'chinaSignalSummary',
          'globalSignalSummary',
          'vietnamSignalSummary',
          'competitors',
          'contentAngles',
          'risks',
          'aiConclusion',
          'hasCnToVnSignal',
          'ratings',
        ],
      },
    },
  });

  const tokens = response.usageMetadata?.totalTokenCount ?? 2100;
  logAiUsage({
    id: `ai_${crypto.randomUUID().slice(0, 8)}`,
    pipeline: 'Pipeline 2 · Deep Research & Scoring',
    model,
    tokens,
    costUsd: Number((tokens * 0.000001).toFixed(6)),
    status: 'Thành công',
  });

  const data = JSON.parse((response.text ?? '{}').trim());
  const nowIso = new Date().toISOString();
  const cnMode = params.xhsMcpAuthenticated ? 'authenticated' : 'public_search';
  const globalUrl = params.globalResearch.urls[0]?.uri;
  const cnUrl = params.cnResearch.urls[0]?.uri;

  const evidence: ProductRecord['evidence'] = [
    ...params.globalResearch.urls.slice(0, 2).map((u, idx) => ({
      id: `ev_gl_${idx}_${Date.now()}`,
      productId: '',
      field: 'Thảo luận Quốc tế (Last30Days Global)',
      claim: u.title,
      status: 'verified_fact' as const,
      retrievalMode: 'authenticated' as const,
      sourceName: 'Last30Days Global / Web',
      sourceUrl: u.uri,
      recordedAt: nowIso,
    })),
    ...params.cnResearch.urls.slice(0, 2).map((u, idx) => ({
      id: `ev_cn_${idx}_${Date.now()}`,
      productId: '',
      field: 'Tín hiệu Trung Quốc (Last30Days CN)',
      claim: u.title,
      status: 'verified_fact' as const,
      retrievalMode: cnMode as 'authenticated' | 'public_search',
      sourceName: params.xhsMcpAuthenticated ? 'Xiaohongshu MCP' : 'Last30Days CN (Public Search)',
      sourceUrl: u.uri,
      recordedAt: nowIso,
      note: params.xhsMcpAuthenticated ? undefined : 'Thu thập từ nguồn công khai — giảm trọng số tin cậy.',
    })),
    {
      id: `ev_vn_unk_${Date.now()}`,
      productId: '',
      field: 'Giá bán & Hoa hồng Affiliate VN',
      claim: 'Chưa có dữ liệu sàn xác minh (Shopee/TikTok Shop Open API đang Chờ cấu hình).',
      status: 'unknown',
      retrievalMode: 'manual',
      sourceName: 'Chưa xác minh',
      recordedAt: nowIso,
    },
  ];

  const clampOrNull = (val: unknown) =>
    typeof val === 'number' && Number.isFinite(val) ? Math.min(5, Math.max(1, Math.round(val))) : null;

  return {
    tokens,
    product: {
      nameVi: data.nameVi || params.keyword,
      nameZh: data.nameZh || '',
      nameEn: data.nameEn || params.keyword,
      aliases: Array.isArray(data.aliases) ? data.aliases : [params.keyword],
      category: data.category || 'Gia dụng thông minh',
      summary: data.summary || '',
      useCase: data.useCase || '',
      customerPainPoints: Array.isArray(data.customerPainPoints) ? data.customerPainPoints : [],
      buyerPersona: data.buyerPersona || '',
      detectedSource: 'Last30Days Global + CN (On-Demand Research)',
      detectedAt: nowIso,
      marketSignals: {
        china: {
          summary: data.chinaSignalSummary || params.cnResearch.summary.slice(0, 260),
          status: cnUrl ? 'verified_fact' : 'ai_inference',
          sourceUrl: cnUrl,
          retrievalMode: cnMode,
          recordedAt: nowIso,
        },
        global: {
          summary: data.globalSignalSummary || params.globalResearch.summary.slice(0, 260),
          status: globalUrl ? 'verified_fact' : 'ai_inference',
          sourceUrl: globalUrl,
          retrievalMode: 'authenticated',
          recordedAt: nowIso,
        },
        vietnam: {
          summary: data.vietnamSignalSummary || 'Cần kiểm tra trực tiếp gian hàng và hoa hồng trên Shopee/TikTok Shop VN.',
          status: 'unknown',
          retrievalMode: 'manual',
          recordedAt: nowIso,
        },
      },
      competitors: Array.isArray(data.competitors) ? data.competitors : [],
      verifiedPriceRangeVnd: { min: null, max: null, status: 'unknown' },
      verifiedCommissionRange: { min: null, max: null, status: 'unknown' },
      contentAngles: Array.isArray(data.contentAngles) ? data.contentAngles : [],
      risks: Array.isArray(data.risks)
        ? data.risks.map((r: { type: string; detail: string; severity: string }) => ({
            type: r.type,
            detail: r.detail,
            severity: (['Cao', 'Trung bình', 'Thấp'].includes(r.severity) ? r.severity : 'Trung bình') as 'Cao' | 'Trung bình' | 'Thấp',
          }))
        : [],
      aiConclusion: data.aiConclusion || '',
      hasCnToVnSignal: Boolean(data.hasCnToVnSignal),
      criteria: [
        {
          key: 'trendGrowth',
          label: 'Tăng trưởng xu hướng',
          weight: settings.weights.trendGrowth,
          rating: clampOrNull(data.ratings?.trendGrowth),
          reason: data.ratings?.trendGrowthReason || 'Đánh giá từ thảo luận 30 ngày qua.',
          verification: globalUrl || cnUrl ? 'verified_fact' : 'ai_inference',
          sourceUrl: globalUrl || cnUrl,
          recordedAt: nowIso,
        },
        {
          key: 'vietnamDemand',
          label: 'Nhu cầu tại Việt Nam',
          weight: settings.weights.vietnamDemand,
          rating: clampOrNull(data.ratings?.vietnamDemand),
          reason: data.ratings?.vietnamDemandReason || 'Suy luận từ nhu cầu khu vực và tính phù hợp thị trường VN.',
          verification: 'ai_inference',
          recordedAt: nowIso,
        },
        {
          key: 'competition',
          label: 'Mức độ cạnh tranh',
          weight: settings.weights.competition,
          rating: clampOrNull(data.ratings?.competition),
          reason: data.ratings?.competitionReason || 'Suy luận từ mức độ bão hòa nội dung.',
          verification: 'ai_inference',
          recordedAt: nowIso,
        },
        {
          key: 'priceCommission',
          label: 'Giá bán & hoa hồng',
          weight: settings.weights.priceCommission,
          rating: null,
          reason: 'Chưa xác minh giá bán và hoa hồng sàn VN — hãy thêm link shop thủ công để hoàn tất chấm điểm.',
          verification: 'unknown',
        },
        {
          key: 'contentPotential',
          label: 'Khả năng tạo nội dung',
          weight: settings.weights.contentPotential,
          rating: clampOrNull(data.ratings?.contentPotential),
          reason: data.ratings?.contentPotentialReason || 'Đánh giá khả năng quay demo trực quan.',
          verification: 'ai_inference',
          recordedAt: nowIso,
        },
        {
          key: 'supplyRisk',
          label: 'Cung ứng & rủi ro',
          weight: settings.weights.supplyRisk,
          rating: clampOrNull(data.ratings?.supplyRisk),
          reason: data.ratings?.supplyRiskReason || 'Đánh giá sơ bộ rủi ro vận chuyển & bảo hành.',
          verification: 'ai_inference',
          recordedAt: nowIso,
        },
      ],
      evidence,
    },
  };
}

/**
 * Pipeline 3: Content Strategist (v1.1)
 * Generates TikTok / Shopee Video / Reels 15s, 30s, or 60s structured production pack.
 */
export async function runPipeline3ContentStudio(params: {
  product: ProductRecord;
  durationSec: 15 | 30 | 60;
  platform: ContentAsset['platform'];
  angleNote?: string;
}): Promise<Omit<ContentAsset, 'id' | 'version' | 'status' | 'createdAt' | 'updatedAt'>> {
  const settings = getSettings();
  const model = settings.pipelines.contentModel || 'gemini-4-hydrogen';
  const ai = createClient();

  const prompt = `Bạn là Pipeline 3 (Content Strategist) của Trend Affiliate Radar Việt Nam.
Tạo gói kịch bản sản xuất video Affiliate trung thực, hấp dẫn cho nền tảng ${params.platform}, thời lượng ${params.durationSec} giây.
Không tạo tuyên bố sai sự thật hoặc phóng đại y tế/công dụng.

Thông tin sản phẩm:
- Tên: ${params.product.nameVi}
- Danh mục: ${params.product.category}
- Công dụng: ${params.product.useCase}
- Nỗi đau khách hàng: ${params.product.customerPainPoints.join('; ')}
- Chân dung người mua: ${params.product.buyerPersona}
- Lưu ý rủi ro cần minh bạch: ${params.product.risks.map((r) => r.detail).join('; ')}
${params.angleNote ? `- Góc khai thác ưu tiên của người vận hành: ${params.angleNote}` : ''}

Trả về JSON đúng schema tiếng Việt (riêng visualPrompt viết bằng tiếng Anh ngắn gọn để dùng cho công cụ tạo ảnh/video thủ công).`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          hook: { type: Type.STRING },
          voiceOver: { type: Type.STRING },
          storyboard: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING },
                visual: { type: Type.STRING },
                audio: { type: Type.STRING },
                textOverlay: { type: Type.STRING },
              },
              required: ['time', 'visual', 'audio', 'textOverlay'],
            },
          },
          caption: { type: Type.STRING },
          hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
          cta: { type: Type.STRING },
          visualPrompt: { type: Type.STRING },
        },
        required: ['title', 'hook', 'voiceOver', 'storyboard', 'caption', 'hashtags', 'cta', 'visualPrompt'],
      },
    },
  });

  const tokens = response.usageMetadata?.totalTokenCount ?? 1100;
  logAiUsage({
    id: `ai_${crypto.randomUUID().slice(0, 8)}`,
    pipeline: 'Pipeline 3 · Content Strategist',
    model,
    tokens,
    costUsd: Number((tokens * 0.000001).toFixed(6)),
    status: 'Thành công',
  });

  const data = JSON.parse((response.text ?? '{}').trim());
  return {
    productId: params.product.id,
    productName: params.product.nameVi,
    title: data.title || `Kịch bản ${params.durationSec}s — ${params.product.nameVi}`,
    durationSec: params.durationSec,
    platform: params.platform,
    scheduledDate: null,
    hook: data.hook || '',
    voiceOver: data.voiceOver || '',
    storyboard: Array.isArray(data.storyboard) ? data.storyboard : [],
    caption: data.caption || '',
    hashtags: Array.isArray(data.hashtags) ? data.hashtags : ['#affiliatevn', '#reviewthat'],
    cta: data.cta || '',
    visualPrompt: data.visualPrompt || '',
  };
}
