import React, { useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  Server,
  XCircle,
} from 'lucide-react';
import { api } from '../services/api';
import type { AppSettings, DataSourceRecord } from '../lib/types';
import { formatDateTimeVN } from '../lib/format';
import { SourceStatusIndicator } from '../components/ui/Primitives';

export function DataSourcesView({
  sources,
  trendRadarConfig,
  settings,
  onSourceUpdated,
  onSettingsUpdated,
}: {
  sources: DataSourceRecord[];
  trendRadarConfig: { configYaml: string; frequencyWords: string };
  settings: AppSettings;
  onSourceUpdated: (source: DataSourceRecord) => void;
  onSettingsUpdated: (settings: AppSettings) => void;
}) {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [configYaml, setConfigYaml] = useState(trendRadarConfig.configYaml);
  const [frequencyWords, setFrequencyWords] = useState(trendRadarConfig.frequencyWords);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const [xhsEnabled, setXhsEnabled] = useState(settings.xhsMcpEnabled);
  const [xhsUrl, setXhsUrl] = useState(settings.xhsMcpUrl);
  const [savingBridge, setSavingBridge] = useState(false);

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await api.testSource(id);
      onSourceUpdated(res.source);
    } finally {
      setTestingId(null);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setConfigFeedback(null);
    try {
      const res = await api.saveTrendRadarConfig(configYaml, frequencyWords);
      setConfigFeedback({ ok: true, message: res.message });
    } catch (err) {
      setConfigFeedback({
        ok: false,
        message: err instanceof Error ? err.message : 'Lỗi kiểm tra cấu hình YAML.',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveXhsBridge = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBridge(true);
    try {
      const res = await api.updateSettings({
        xhsMcpEnabled: xhsEnabled,
        xhsMcpUrl: xhsUrl.trim(),
      });
      onSettingsUpdated(res.settings);
      const testRes = await api.testSource('last30days_cn');
      onSourceUpdated(testRes.source);
    } finally {
      setSavingBridge(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 6 Source Health Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sources.map((src) => (
          <article
            key={src.id}
            className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] text-slate-400">
                    {src.category} · Chế độ {src.dataMode}
                  </p>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {src.name}
                  </h2>
                </div>
                <SourceStatusIndicator status={src.status} />
              </div>

              <p className="text-xs text-slate-500 font-mono">{src.repoOrPlatform}</p>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {src.lastMessage}
              </p>
              <p className="text-[11px] text-slate-400">{src.configHint}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Đồng bộ gần nhất</span>
                  <span className="font-mono-num text-slate-700 dark:text-slate-300">
                    {src.lastSyncedAt ? formatDateTimeVN(src.lastSyncedAt).split(' ')[0] : 'Chưa có'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Tỷ lệ hợp lệ</span>
                  <span className="font-mono-num text-slate-700 dark:text-slate-300">
                    {src.validRecordRate !== null ? `${src.validRecordRate}%` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Phản hồi</span>
                  <span className="font-mono-num text-slate-700 dark:text-slate-300">
                    {src.latencyMs !== null ? `${src.latencyMs}ms` : '—'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleTest(src.id)}
                disabled={testingId === src.id}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
              >
                {testingId === src.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Kiểm tra kết nối / Chẩn đoán</span>
              </button>
            </div>
          </article>
        ))}
      </section>

      {/* Xiaohongshu-MCP Optional Host Bridge Toggle (Spec Section 4.3) */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5">
        <div className="flex items-start gap-3">
          <Server className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Cầu nối quét sâu tùy chọn: xiaohongshu-mcp (Windows Host Bridge)
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Mặc định Last30Days CN chạy bằng nguồn tìm kiếm công khai (không cần đăng nhập cookie mỗi ngày). Chỉ bật tùy chọn này khi bạn chạy dịch vụ <code className="font-mono">xiaohongshu-mcp</code> trên máy host Windows bằng tài khoản phụ; hệ thống tự động fallback nếu mất phiên.
              </p>
            </div>

            <form onSubmit={handleSaveXhsBridge} className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={xhsEnabled}
                  onChange={(e) => setXhsEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <span>Bật cầu nối xiaohongshu-mcp</span>
              </label>

              <input
                type="url"
                value={xhsUrl}
                onChange={(e) => setXhsUrl(e.target.value)}
                disabled={!xhsEnabled}
                placeholder="http://host.docker.internal:18060"
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 disabled:opacity-50 px-3 py-2 font-mono text-xs"
              />

              <button
                type="submit"
                disabled={savingBridge}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium whitespace-nowrap"
              >
                {savingBridge ? 'Đang kiểm tra...' : 'Lưu & Kiểm tra cầu nối'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* TrendRadar Static Config YAML Editor with Validation (Spec Section 4.1) */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Trình chỉnh sửa cấu hình TrendRadar (Kiểm tra cú pháp YAML)
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Chỉnh sửa <code className="font-mono">config/config.yaml</code> và <code className="font-mono">config/frequency_words.txt</code> ghi vào volume dùng chung. Hệ thống không phơi bày Docker socket; sau khi lưu trên bản Docker, chạy <code className="font-mono">docker compose restart trendradar</code> để áp dụng.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={savingConfig}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingConfig ? 'Đang kiểm tra YAML...' : 'Validate & Lưu cấu hình'}</span>
          </button>
        </div>

        {configFeedback && (
          <div
            className={`flex items-center gap-2 text-xs font-medium ${
              configFeedback.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {configFeedback.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            <span>{configFeedback.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <label className="lg:col-span-8 space-y-1.5 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">config/config.yaml</span>
            <textarea
              rows={14}
              value={configYaml}
              onChange={(e) => setConfigYaml(e.target.value)}
              spellCheck={false}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="lg:col-span-4 space-y-1.5 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">config/frequency_words.txt</span>
            <textarea
              rows={14}
              value={frequencyWords}
              onChange={(e) => setFrequencyWords(e.target.value)}
              spellCheck={false}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
