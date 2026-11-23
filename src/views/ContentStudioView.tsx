import React, { useMemo, useState } from 'react';
import {
  CalendarPlus,
  Check,
  Copy,
  Download,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import type { ContentAsset, ProductRecord } from '../lib/types';
import { formatDateTimeVN } from '../lib/format';
import { ActionableEmptyState } from '../components/ui/Primitives';

export function ContentStudioView({
  products,
  assets,
  initialProductId,
  onAssetCreated,
  onAssetUpdated,
  onNavigateCalendar,
}: {
  products: ProductRecord[];
  assets: ContentAsset[];
  initialProductId?: string | null;
  onAssetCreated: (asset: ContentAsset) => void;
  onAssetUpdated: (asset: ContentAsset) => void;
  onNavigateCalendar: () => void;
}) {
  const [selectedProductId, setSelectedProductId] = useState(
    initialProductId || products[0]?.id || '',
  );
  const [durationSec, setDurationSec] = useState<15 | 30 | 60>(30);
  const [platform, setPlatform] = useState<ContentAsset['platform']>('TikTok');
  const [angleNote, setAngleNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAssetId, setActiveAssetId] = useState<string>(assets[0]?.id || '');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeAsset = useMemo(
    () => assets.find((a) => a.id === activeAssetId) ?? assets[0] ?? null,
    [assets, activeAssetId],
  );

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedProductId) {
      setError('Vui lòng chọn một sản phẩm để sinh kịch bản.');
      return;
    }
    setGenerating(true);
    try {
      const res = await api.generateContent({
        productId: selectedProductId,
        durationSec,
        platform,
        angleNote: angleNote.trim() || undefined,
      });
      onAssetCreated(res.asset);
      setActiveAssetId(res.asset.id);
      setAngleNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể sinh kịch bản từ AI Pipeline 3.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (key: string, text: string) => {
    await navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const handleExportPack = (asset: ContentAsset) => {
    const md = [
      `# ${asset.title}`,
      `Sản phẩm: ${asset.productName}`,
      `Nền tảng: ${asset.platform} · Thời lượng: ${asset.durationSec}s · Phiên bản v${asset.version}`,
      '',
      `## Hook (3 giây đầu)`,
      asset.hook,
      '',
      `## Lời thoại (Voice-over)`,
      asset.voiceOver,
      '',
      `## Storyboard`,
      ...asset.storyboard.map(
        (s) => `- **${s.time}** | Hình ảnh: ${s.visual} | Âm thanh: ${s.audio} | Chữ trên màn hình: ${s.textOverlay}`,
      ),
      '',
      `## Caption & Hashtags`,
      asset.caption,
      asset.hashtags.join(' '),
      '',
      `## CTA`,
      asset.cta,
      '',
      `## Prompt ảnh/video tham khảo (Sản xuất thủ công / Media Adapter)`,
      asset.visualPrompt,
    ].join('\n');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kich-ban-${asset.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePushToSchedule = async (asset: ContentAsset) => {
    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    const res = await api.updateContentAsset(asset.id, {
      status: 'Scheduled',
      scheduledDate: asset.scheduledDate || tomorrow,
    });
    onAssetUpdated(res.asset);
    onNavigateCalendar();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left 4 cols: Generator Controls + Saved Versions */}
      <div className="xl:col-span-4 space-y-5">
        <form
          onSubmit={handleGenerate}
          className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-4"
        >
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              AI Pipeline 3 · Content Strategist
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Chỉ kích hoạt khi bạn bấm tạo. Xuất trọn gói kịch bản, storyboard và prompt để quay/sản xuất thủ công.
            </p>
          </div>

          <label className="block space-y-1.5 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">Sản phẩm mục tiêu</span>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameVi}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="space-y-1.5">
              <span className="font-medium text-slate-700 dark:text-slate-300">Nền tảng</span>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as ContentAsset['platform'])}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
              >
                <option value="TikTok">TikTok</option>
                <option value="Shopee Video">Shopee Video</option>
                <option value="Reels">Facebook / IG Reels</option>
                <option value="YouTube Shorts">YouTube Shorts</option>
              </select>
            </label>

            <div className="space-y-1.5">
              <span className="font-medium text-slate-700 dark:text-slate-300 block">Thời lượng</span>
              <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 dark:bg-slate-900 rounded-lg">
                {([15, 30, 60] as const).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setDurationSec(sec)}
                    className={`py-1.5 rounded-md text-xs font-mono-num font-medium transition-colors ${
                      durationSec === sec
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-500'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="block space-y-1.5 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Góc khai thác mong muốn (tùy chọn)
            </span>
            <textarea
              rows={2}
              value={angleNote}
              onChange={(e) => setAngleNote(e.target.value)}
              placeholder="VD: So sánh trực tiếp với hàng giá rẻ, nhấn mạnh độ bền và chế độ bảo hành..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>

          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={generating}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{generating ? 'Đang tạo kịch bản...' : 'Sinh gói kịch bản bằng AI'}</span>
          </button>
        </form>

        {/* Saved Script Versions */}
        <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Thư viện kịch bản đã lưu ({assets.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[380px] overflow-y-auto">
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setActiveAssetId(a.id)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  activeAsset?.id === a.id
                    ? 'bg-blue-50/70 dark:bg-blue-950/40'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                  {a.title}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {a.platform} · {a.durationSec}s · v{a.version} · {a.status}
                </p>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Right 8 cols: Active Production Pack Viewer */}
      <div className="xl:col-span-8">
        {!activeAsset ? (
          <ActionableEmptyState
            title="Chưa có kịch bản nào được chọn"
            description="Chọn sản phẩm bên trái và bấm Sinh gói kịch bản bằng AI để tạo Hook, Voice-over, Storyboard và Prompt."
          />
        ) : (
          <article className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">
                  {activeAsset.platform} · {activeAsset.durationSec} giây · Phiên bản v{activeAsset.version} · Trạng thái: {activeAsset.status}
                </p>
                <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                  {activeAsset.title}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Sản phẩm: {activeAsset.productName} · Cập nhật {formatDateTimeVN(activeAsset.updatedAt)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleExportPack(activeAsset)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất gói .MD</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePushToSchedule(activeAsset)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span>Đưa lên Lịch đăng</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Hook & Voice-over */}
              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Hook mở đầu (3 giây đầu)
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleCopy('hook', activeAsset.hook)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {copiedKey === 'hook' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'hook' ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    {activeAsset.hook}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Lời thoại (Voice-over)
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleCopy('vo', activeAsset.voiceOver)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {copiedKey === 'vo' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'vo' ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    {activeAsset.voiceOver}
                  </p>
                </div>
              </div>

              {/* Storyboard Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Storyboard phân cảnh sản xuất
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2.5 px-3 font-medium whitespace-nowrap">Thời gian</th>
                        <th className="py-2.5 px-3 font-medium">Cảnh quay / Hình ảnh</th>
                        <th className="py-2.5 px-3 font-medium">Âm thanh / Thoại</th>
                        <th className="py-2.5 px-3 font-medium">Chữ trên màn hình</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {activeAsset.storyboard.map((row, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3 font-mono-num font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {row.time}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{row.visual}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{row.audio}</td>
                          <td className="py-2.5 px-3 font-medium text-blue-700 dark:text-blue-400">
                            {row.textOverlay}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Caption, Hashtags, CTA */}
              <div className="grid md:grid-cols-2 gap-5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Caption & Hashtags</span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy('cap', `${activeAsset.caption}\n\n${activeAsset.hashtags.join(' ')}`)
                      }
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {copiedKey === 'cap' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'cap' ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{activeAsset.caption}</p>
                  <p className="text-blue-600 dark:text-blue-400 font-medium">
                    {activeAsset.hashtags.join(' ')}
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                    Lời kêu gọi hành động (CTA)
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{activeAsset.cta}</p>

                  <div className="pt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Prompt sản xuất ảnh/video thủ công (AI Media Adapter: Chờ cấu hình)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy('prompt', activeAsset.visualPrompt)}
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {copiedKey === 'prompt' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'prompt' ? 'Đã chép' : 'Chép'}</span>
                      </button>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      {activeAsset.visualPrompt}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
