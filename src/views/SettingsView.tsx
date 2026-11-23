import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
  Upload,
} from 'lucide-react';
import { api } from '../services/api';
import type { AiUsageSummary, AppSettings, ScoringWeights } from '../lib/types';
import { formatDateTimeVN } from '../lib/format';

const WEIGHT_LABELS: { key: keyof ScoringWeights; label: string }[] = [
  { key: 'trendGrowth', label: 'Tăng trưởng xu hướng' },
  { key: 'vietnamDemand', label: 'Nhu cầu tại Việt Nam' },
  { key: 'competition', label: 'Mức độ cạnh tranh' },
  { key: 'priceCommission', label: 'Giá bán & kinh tế hoa hồng' },
  { key: 'contentPotential', label: 'Khả năng tạo nội dung video/review' },
  { key: 'supplyRisk', label: 'Khả năng cung ứng & rủi ro' },
];

export function SettingsView({
  settings,
  aiUsage,
  onSettingsSaved,
  onReopenOnboarding,
}: {
  settings: AppSettings;
  aiUsage: AiUsageSummary;
  onSettingsSaved: (updated: AppSettings) => void;
  onReopenOnboarding: () => void;
}) {
  const [form, setForm] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestMsg, setAiTestMsg] = useState<string | null>(null);

  const weightTotal = Object.values(form.weights).reduce((a, b) => a + Number(b), 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (weightTotal !== 100) {
      setFeedback({
        ok: false,
        text: `Tổng trọng số 6 tiêu chí phải bằng 100% (hiện tại là ${weightTotal}%).`,
      });
      return;
    }
    setSaving(true);
    try {
      const res = await api.updateSettings(form);
      onSettingsSaved(res.settings);
      setFeedback({ ok: true, text: 'Đã lưu cấu hình AI, trọng số chấm điểm và thông báo.' });
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Lưu cài đặt thất bại.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestAi = async () => {
    setAiTesting(true);
    setAiTestMsg(null);
    try {
      const res = await api.testAiConnection();
      setAiTestMsg(res.message);
    } finally {
      setAiTesting(false);
    }
  };

  const handleBackup = async () => {
    const dump = await api.getBackup();
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trend-affiliate-radar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const res = await api.restoreBackup(parsed);
      setFeedback({ ok: true, text: res.message });
    } catch {
      setFeedback({ ok: false, text: 'Tệp JSON khôi phục không hợp lệ.' });
    }
  };

  const usagePercent = Math.min(
    100,
    Math.round((aiUsage.todayTokens / Math.max(1, aiUsage.dailyBudgetTokens)) * 100),
  );

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* AI Cost Control & 3-Pipeline Models */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Cấu hình 3 AI Pipeline & Kiểm soát chi phí Token ngày
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Khóa kết nối Gemini được quản lý tập trung trên máy chủ. Tự động tạm dừng tác vụ nền khi chạm hạn mức ngân sách ngày.
            </p>
          </div>
          <button
            type="button"
            onClick={handleTestAi}
            disabled={aiTesting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium"
          >
            {aiTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-blue-600" />}
            <span>Kiểm tra kết nối AI</span>
          </button>
        </div>

        {aiTestMsg && <p className="text-xs text-blue-700 dark:text-blue-400">{aiTestMsg}</p>}

        {/* Today Token Usage Meter */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Tiêu thụ hôm nay: <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100">{aiUsage.todayTokens.toLocaleString('vi-VN')}</span> /{' '}
              <span className="font-mono-num">{aiUsage.dailyBudgetTokens.toLocaleString('vi-VN')}</span> tokens ({usagePercent}%)
            </span>
            <span className="font-mono-num text-slate-500">
              Chi phí ước tính: ${aiUsage.todayCostUsd.toFixed(5)}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all ${
                usagePercent >= 90 ? 'bg-rose-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <label className="space-y-1.5">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Pipeline 1 · Triage & Extraction
            </span>
            <select
              value={form.pipelines.triageModel}
              onChange={(e) =>
                setForm({ ...form, pipelines: { ...form.pipelines, triageModel: e.target.value } })
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Nhanh / Rẻ)</option>
              <option value="gemini-4-hydrogen">gemini-4-hydrogen</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Pipeline 2 · Deep Research & Scoring
            </span>
            <select
              value={form.pipelines.researchModel}
              onChange={(e) =>
                setForm({ ...form, pipelines: { ...form.pipelines, researchModel: e.target.value } })
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="gemini-4-hydrogen">gemini-4-hydrogen (Khuyến nghị)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Pipeline 3 · Content Strategist
            </span>
            <select
              value={form.pipelines.contentModel}
              onChange={(e) =>
                setForm({ ...form, pipelines: { ...form.pipelines, contentModel: e.target.value } })
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="gemini-4-hydrogen">gemini-4-hydrogen (Khuyến nghị)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center text-xs pt-1">
          <label className="space-y-1.5">
            <span className="font-medium text-slate-700 dark:text-slate-300">Hạn mức ngân sách Token / ngày</span>
            <input
              type="number"
              min={10000}
              step={10000}
              value={form.aiDailyTokenBudget}
              onChange={(e) => setForm({ ...form, aiDailyTokenBudget: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-num text-sm"
            />
          </label>

          <label className="inline-flex items-center gap-2.5 pt-4 font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.aiDailyBudgetHardStop}
              onChange={(e) => setForm({ ...form, aiDailyBudgetHardStop: e.target.checked })}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>Tự động dừng tác vụ nền khi chạm hạn mức ngày</span>
          </label>
        </div>
      </section>

      {/* Opportunity Scoring Weights & Thresholds */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Trọng số 6 tiêu chí Opportunity Score & Ngưỡng xếp loại
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Tổng trọng số bắt buộc bằng 100%. Mọi thay đổi áp dụng tức thì cho bảng xếp hạng sản phẩm.
            </p>
          </div>
          <span
            className={`font-mono-num text-sm font-bold ${
              weightTotal === 100 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'
            }`}
          >
            Tổng: {weightTotal}%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {WEIGHT_LABELS.map(({ key, label }) => (
            <label key={key} className="space-y-1.5">
              <div className="flex justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
                <span className="font-mono-num font-semibold">{form.weights[key]}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                step={5}
                value={form.weights[key]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    weights: { ...form.weights, [key]: Number(e.target.value) },
                  })
                }
                className="w-full accent-blue-600"
              />
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <label className="space-y-1">
            <span className="font-medium text-slate-700 dark:text-slate-300">Ngưỡng Ưu tiên cao (≥)</span>
            <input
              type="number"
              min={60}
              max={95}
              value={form.thresholds.highPriority}
              onChange={(e) =>
                setForm({
                  ...form,
                  thresholds: { ...form.thresholds, highPriority: Number(e.target.value) },
                })
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-num"
            />
          </label>
          <label className="space-y-1">
            <span className="font-medium text-slate-700 dark:text-slate-300">Ngưỡng Nghiên cứu thêm (≥)</span>
            <input
              type="number"
              min={45}
              max={85}
              value={form.thresholds.researchMore}
              onChange={(e) =>
                setForm({
                  ...form,
                  thresholds: { ...form.thresholds, researchMore: Number(e.target.value) },
                })
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-num"
            />
          </label>
          <label className="space-y-1">
            <span className="font-medium text-slate-700 dark:text-slate-300">Ngưỡng Theo dõi (≥)</span>
            <input
              type="number"
              min={30}
              max={70}
              value={form.thresholds.watch}
              onChange={(e) =>
                setForm({
                  ...form,
                  thresholds: { ...form.thresholds, watch: Number(e.target.value) },
                })
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-num"
            />
          </label>
        </div>
      </section>

      {/* Public Base URL, Notifications & Backup/Restore */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-4 text-xs">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Tracking Mode & Thông báo tự động
          </h3>

          <label className="block space-y-1">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              PUBLIC_BASE_URL (Chỉ điền khi triển khai trên VPS/Cloud)
            </span>
            <input
              type="url"
              value={form.publicBaseUrl}
              onChange={(e) => setForm({ ...form, publicBaseUrl: e.target.value })}
              placeholder="Để trống ở chế độ Local (dùng Sub_id / UTM chuẩn sàn)"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Giờ im lặng từ</span>
              <input
                type="time"
                value={form.notifications.quietHoursStart}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notifications: { ...form.notifications, quietHoursStart: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-num"
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Đến</span>
              <input
                type="time"
                value={form.notifications.quietHoursEnd}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notifications: { ...form.notifications, quietHoursEnd: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-num"
              />
            </label>
          </div>

          <p className="text-slate-500">
            Telegram Bot & SMTP Email: <span className="font-medium text-slate-700 dark:text-slate-300">Chờ cấu hình trong biến môi trường máy chủ</span> · Thông báo Web trong ứng dụng đang bật.
          </p>
        </section>

        <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-4 text-xs">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Sao lưu, Khôi phục & Nhật ký gọi AI
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleBackup}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải bản sao lưu (.JSON)</span>
            </button>

            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Khôi phục cấu hình</span>
              <input type="file" accept=".json" onChange={handleRestore} className="sr-only" />
            </label>

            <button
              type="button"
              onClick={onReopenOnboarding}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mở lại hướng dẫn 3 bước</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 max-h-36 overflow-y-auto">
            {aiUsage.recentLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-700 dark:text-slate-300 truncate">{log.pipeline}</span>
                <span className="font-mono-num text-slate-500 whitespace-nowrap">
                  {log.tokens.toLocaleString('vi-VN')} tok · {formatDateTimeVN(log.createdAt).split(' ')[1]}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Save Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div>
          {feedback && (
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                feedback.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {feedback.ok && <CheckCircle2 className="w-4 h-4" />}
              <span>{feedback.text}</span>
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={saving || weightTotal !== 100}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Đang lưu...' : 'Lưu toàn bộ cài đặt'}</span>
        </button>
      </div>
    </form>
  );
}
