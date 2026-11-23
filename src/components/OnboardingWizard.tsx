import React, { useState } from 'react';
import { CheckCircle2, Loader2, Radar, Sparkles, XCircle } from 'lucide-react';
import { api } from '../services/api';
import type { AppSettings, DataSourceRecord } from '../lib/types';
import { SourceStatusIndicator } from './ui/Primitives';

const FOCUS_CATEGORY_OPTIONS = [
  'Gia dụng thông minh',
  'Làm đẹp & Chăm sóc cá nhân',
  'Phụ kiện công nghệ',
  'Mẹ & Bé',
  'Thú cưng & Chăm sóc nhà cửa',
  'Phụ kiện bàn làm việc (Desk Setup)',
  'Thể thao & Dã ngoại',
];

export function OnboardingWizard({
  settings,
  sources,
  onComplete,
  onSkip,
}: {
  settings: AppSettings;
  sources: DataSourceRecord[];
  onComplete: (updated: AppSettings) => void;
  onSkip: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [triageModel, setTriageModel] = useState(settings.pipelines.triageModel);
  const [researchModel, setResearchModel] = useState(settings.pipelines.researchModel);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiResult, setAiResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [sourceChecking, setSourceChecking] = useState(false);
  const [localSources, setLocalSources] = useState<DataSourceRecord[]>(sources);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    settings.focusCategories.length > 0
      ? settings.focusCategories
      : ['Gia dụng thông minh', 'Làm đẹp & Chăm sóc cá nhân', 'Phụ kiện công nghệ'],
  );
  const [saving, setSaving] = useState(false);

  const handleTestAi = async () => {
    setAiTesting(true);
    setAiResult(null);
    try {
      const res = await api.testAiConnection();
      setAiResult({ ok: res.ok, message: res.message });
    } catch (err) {
      setAiResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Kiểm tra kết nối thất bại.',
      });
    } finally {
      setAiTesting(false);
    }
  };

  const handleCheckFreeSources = async () => {
    setSourceChecking(true);
    try {
      const ids = ['trendradar', 'last30days_global', 'last30days_cn'];
      const updated = [...localSources];
      for (const id of ids) {
        const res = await api.testSource(id);
        const idx = updated.findIndex((s) => s.id === id);
        if (idx >= 0) updated[idx] = res.source;
      }
      setLocalSources(updated);
    } finally {
      setSourceChecking(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const res = await api.updateSettings({
        onboardingCompleted: true,
        focusCategories: selectedCategories,
        pipelines: {
          ...settings.pipelines,
          triageModel,
          researchModel,
        },
      });
      onComplete(res.settings);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Radar className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Thiết lập Trend Affiliate Radar
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bước {step} / 3 · Khởi chạy trong dưới 60 giây, không yêu cầu API sàn trả phí
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Bỏ qua thiết lập
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800 text-xs">
          {[
            { num: 1, label: '1. Kết nối AI Engine' },
            { num: 2, label: '2. Kiểm tra nguồn miễn phí' },
            { num: 3, label: '3. Chọn ngành hàng mục tiêu' },
          ].map((item) => (
            <div
              key={item.num}
              className={`px-4 py-2.5 text-center font-medium border-b-2 ${
                step === item.num
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50/40 dark:bg-blue-950/20'
                  : 'border-transparent text-slate-400'
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>

        <div className="p-6 min-h-[270px]">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Cấu hình AI Pipeline (Tối ưu chi phí token)
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Khóa kết nối AI được quản lý an toàn phía máy chủ. Chọn mô hình cho tầng lọc nhanh và tầng nghiên cứu chuyên sâu, sau đó kiểm tra kết nối trực tiếp.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Pipeline 1 · Lọc thương mại nhanh
                  </span>
                  <select
                    value={triageModel}
                    onChange={(e) => setTriageModel(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Tiết kiệm tối đa)</option>
                    <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (Cân bằng)</option>
                  </select>
                </label>

                <label className="block space-y-1.5 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Pipeline 2 & 3 · Nghiên cứu sâu & Nội dung
                  </span>
                  <select
                    value={researchModel}
                    onChange={(e) => setResearchModel(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (Khuyến nghị)</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                  </select>
                </label>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestAi}
                  disabled={aiTesting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium"
                >
                  {aiTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-blue-600" />}
                  <span>Kiểm tra kết nối AI</span>
                </button>
                {aiResult && (
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                      aiResult.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {aiResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span>{aiResult.message}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Kiểm tra nguồn dữ liệu miễn phí (Không cần cookie)
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    TrendRadar và Last30Days hoạt động mặc định ở chế độ Headless. Các sàn Shopee/TikTok/Lazada chưa có API sẽ chạy chế độ Nhập tay & CSV/XLSX.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCheckFreeSources}
                  disabled={sourceChecking}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  {sourceChecking ? 'Đang kiểm tra...' : 'Kiểm tra ngay'}
                </button>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {localSources.slice(0, 4).map((src) => (
                  <div key={src.id} className="px-4 py-3 flex items-center justify-between gap-4 bg-white dark:bg-slate-900/50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{src.name}</p>
                      <p className="text-xs text-slate-500 truncate">{src.lastMessage}</p>
                    </div>
                    <SourceStatusIndicator status={src.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Chọn 3–5 nhóm ngành hàng Affiliate ưu tiên
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Hệ thống sẽ ưu tiên lọc tín hiệu thương mại và gợi ý từ khóa nghiên cứu theo các ngành hàng bạn chọn.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-2.5">
                {FOCUS_CATEGORY_OPTIONS.map((cat) => {
                  const active = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-3.5 py-2.5 rounded-lg border text-left text-sm transition-colors flex items-center justify-between ${
                        active
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{cat}</span>
                      {active && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
            disabled={step === 1}
            className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200/60 dark:hover:bg-slate-800"
          >
            Quay lại
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => ((s + 1) as 1 | 2 | 3))}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              Tiếp tục
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving || selectedCategories.length === 0}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium"
            >
              {saving ? 'Đang lưu...' : 'Vào Dashboard ngay'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
