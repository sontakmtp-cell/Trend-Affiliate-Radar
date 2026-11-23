import fs from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';

const CONFIG_DIR = path.resolve(process.cwd(), 'data', 'trendradar-config');
fs.mkdirSync(CONFIG_DIR, { recursive: true });

const DEFAULT_CONFIG_YAML = `# TrendRadar Collector Configuration (v6.12.0)
# Chỉ dùng để thu thập tín hiệu nền — AI Analysis & Push nội bộ đã tắt
collector:
  interval_minutes: 45
  request_timeout_sec: 12
  ai_analysis_enabled: false
  push_notification_enabled: false
  newsnow_api_url: "https://newsnow.busiyi.world/api/s"

platforms:
  - id: "douyin"
    name: "Douyin Hotlist"
    enabled: true
  - id: "weibo"
    name: "Weibo Hot Search"
    enabled: true
  - id: "bilibili-hot-search"
    name: "Bilibili Hot"
    enabled: true
  - id: "zhihu"
    name: "Zhihu Hot"
    enabled: true
  - id: "hackernews"
    name: "Hacker News (Keyless)"
    enabled: true
  - id: "reddit-gadgets"
    name: "Reddit r/gadgets (Keyless)"
    enabled: true

output:
  sqlite_read_only_mount: "/output:ro"
`;

const DEFAULT_FREQ_WORDS = `# Từ khóa ngành hàng ưu tiên cho Affiliate Việt Nam
máy in mini
sạc dự phòng qi2
gia dụng thông minh
mặt nạ led
lược hơi nước thú cưng
bình xịt dầu ăn
phụ kiện bàn làm việc
chăm sóc da tại nhà
`;

function safeConfigPath(filename: 'config.yaml' | 'frequency_words.txt'): string {
  const resolved = path.resolve(CONFIG_DIR, filename);
  if (!resolved.startsWith(CONFIG_DIR + path.sep)) {
    throw new Error('Đường dẫn tệp cấu hình không hợp lệ.');
  }
  return resolved;
}

export function readTrendRadarConfig(): { configYaml: string; frequencyWords: string } {
  const yamlPath = safeConfigPath('config.yaml');
  const freqPath = safeConfigPath('frequency_words.txt');

  if (!fs.existsSync(yamlPath)) {
    fs.writeFileSync(yamlPath, DEFAULT_CONFIG_YAML, 'utf8');
  }
  if (!fs.existsSync(freqPath)) {
    fs.writeFileSync(freqPath, DEFAULT_FREQ_WORDS, 'utf8');
  }

  return {
    configYaml: fs.readFileSync(yamlPath, 'utf8'),
    frequencyWords: fs.readFileSync(freqPath, 'utf8'),
  };
}

export function validateAndSaveTrendRadarConfig(
  configYaml: string,
  frequencyWords: string,
): { valid: boolean; error?: string } {
  try {
    const parsed = parseYaml(configYaml);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Tệp config.yaml phải chứa một object YAML hợp lệ.' };
    }
    const obj = parsed as Record<string, unknown>;
    if (!obj.collector || typeof obj.collector !== 'object') {
      return { valid: false, error: 'Thiếu khối cấu hình bắt buộc "collector:" trong config.yaml.' };
    }
    fs.writeFileSync(safeConfigPath('config.yaml'), configYaml, 'utf8');
    fs.writeFileSync(safeConfigPath('frequency_words.txt'), frequencyWords, 'utf8');
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? `Lỗi cú pháp YAML: ${err.message}` : 'Lỗi cú pháp YAML.',
    };
  }
}

/**
 * Fetches real, live keyless signals from Hacker News Algolia API & Reddit public JSON feeds.
 * Strictly uses allowlisted public HTTPS hosts.
 */
export async function fetchLiveKeylessSignals(): Promise<{
  signals: { title: string; platform: string; url: string; score: number }[];
  diagnostics: { source: string; ok: boolean; count: number; latencyMs: number; note: string }[];
}> {
  const signals: { title: string; platform: string; url: string; score: number }[] = [];
  const diagnostics: { source: string; ok: boolean; count: number; latencyMs: number; note: string }[] = [];

  // 1. Hacker News Algolia (Keyless, fast, reliable)
  const hnStart = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      'https://hn.algolia.com/api/v1/search?query=gadget%20OR%20charger%20OR%20printer%20OR%20smart%20home&tags=story&hitsPerPage=5',
      { signal: controller.signal, headers: { Accept: 'application/json' } },
    );
    clearTimeout(timer);
    if (res.ok) {
      const json = (await res.json()) as {
        hits?: Array<{ title?: string; url?: string; objectID?: string; points?: number }>;
      };
      const hits = json.hits ?? [];
      for (const h of hits) {
        if (h.title) {
          signals.push({
            title: h.title,
            platform: 'Hacker News',
            url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
            score: h.points ?? 50,
          });
        }
      }
      diagnostics.push({
        source: 'Hacker News Algolia',
        ok: true,
        count: hits.length,
        latencyMs: Date.now() - hnStart,
        note: `Thu thập ${hits.length} tín hiệu thực tế không cần API key.`,
      });
    } else {
      diagnostics.push({
        source: 'Hacker News Algolia',
        ok: false,
        count: 0,
        latencyMs: Date.now() - hnStart,
        note: `HTTP ${res.status}`,
      });
    }
  } catch (err) {
    diagnostics.push({
      source: 'Hacker News Algolia',
      ok: false,
      count: 0,
      latencyMs: Date.now() - hnStart,
      note: err instanceof Error ? err.message : 'Timeout',
    });
  }

  // 2. Reddit r/gadgets public JSON (Keyless)
  const rdStart = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://www.reddit.com/r/gadgets/hot.json?limit=4', {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TrendAffiliateRadar/1.1 (Keyless Research Collector)',
      },
    });
    clearTimeout(timer);
    if (res.ok) {
      const json = (await res.json()) as {
        data?: { children?: Array<{ data?: { title?: string; permalink?: string; score?: number } }> };
      };
      const items = json.data?.children ?? [];
      let added = 0;
      for (const item of items) {
        if (item.data?.title) {
          signals.push({
            title: item.data.title,
            platform: 'Reddit r/gadgets',
            url: `https://www.reddit.com${item.data.permalink ?? '/r/gadgets/'}`,
            score: item.data.score ?? 100,
          });
          added += 1;
        }
      }
      diagnostics.push({
        source: 'Reddit r/gadgets',
        ok: true,
        count: added,
        latencyMs: Date.now() - rdStart,
        note: `Thu thập ${added} bài thảo luận nóng.`,
      });
    } else {
      diagnostics.push({
        source: 'Reddit r/gadgets',
        ok: false,
        count: 0,
        latencyMs: Date.now() - rdStart,
        note: `HTTP ${res.status} (Reddit giới hạn truy cập tạm thời)`,
      });
    }
  } catch (err) {
    diagnostics.push({
      source: 'Reddit r/gadgets',
      ok: false,
      count: 0,
      latencyMs: Date.now() - rdStart,
      note: err instanceof Error ? err.message : 'Không thể truy cập Reddit',
    });
  }

  return { signals, diagnostics };
}

/**
 * Checks optional xiaohongshu-mcp bridge safely (SSRF-guarded: only permits configured host.docker.internal:18060).
 */
export async function checkXhsMcpBridge(enabled: boolean, rawUrl: string): Promise<{
  connected: boolean;
  latencyMs: number | null;
  message: string;
}> {
  if (!enabled) {
    return {
      connected: false,
      latencyMs: null,
      message: 'Cầu nối xiaohongshu-mcp đang tắt. Hệ thống tự động dùng nguồn tìm kiếm công khai (public_search).',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      connected: false,
      latencyMs: null,
      message: 'URL cầu nối xiaohongshu-mcp không hợp lệ.',
    };
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.hostname !== 'host.docker.internal'
  ) {
    return {
      connected: false,
      latencyMs: null,
      message: 'Vì lý do bảo mật, cầu nối host chỉ chấp nhận địa chỉ http://host.docker.internal:18060.',
    };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${parsed.origin}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return {
      connected: res.ok,
      latencyMs: Date.now() - start,
      message: res.ok
        ? 'Kết nối xiaohongshu-mcp thành công (Chế độ Authenticated).'
        : `xiaohongshu-mcp phản hồi HTTP ${res.status}. Tự động fallback sang public_search.`,
    };
  } catch {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      message: 'Không phát hiện dịch vụ xiaohongshu-mcp trên host Windows (:18060). Hệ thống tự động fallback sang public_search.',
    };
  }
}
