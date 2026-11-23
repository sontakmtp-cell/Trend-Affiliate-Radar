import React, { useMemo, useState } from 'react';
import { Microscope, RefreshCw, Search } from 'lucide-react';
import type { CommercialIntent, TrendTopic } from '../lib/types';
import { formatDateTimeVN } from '../lib/format';
import { ActionableEmptyState, Sparkline } from '../components/ui/Primitives';

const INTENT_FILTERS: { value: 'all' | CommercialIntent; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'Commercial Product', label: 'Sản phẩm thương mại' },
  { value: 'News/Politics', label: 'Tin tức (đã lọc)' },
  { value: 'Tech/Concept Only', label: 'Ý tưởng / Tech' },
  { value: 'Insufficient Data', label: 'Chưa đủ dữ liệu' },
];

const REGION_FILTERS = ['all', 'CN→VN', 'CN', 'Global', 'VN'] as const;

export function TrendRadarView({
  trends,
  syncing,
  syncNotice,
  onSync,
  onSelectTrend,
  onStartResearch,
}: {
  trends: TrendTopic[];
  syncing: boolean;
  syncNotice: string | null;
  onSync: () => void;
  onSelectTrend: (trend: TrendTopic) => void;
  onStartResearch: (keyword: string, trendId?: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [intentFilter, setIntentFilter] = useState<'all' | CommercialIntent>('Commercial Product');
  const [regionFilter, setRegionFilter] = useState<(typeof REGION_FILTERS)[number]>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trends.filter((t) => {
      if (intentFilter !== 'all' && t.intent !== intentFilter) return false;
      if (regionFilter !== 'all' && t.region !== regionFilter) return false;
      if (!q) return true;
      return (
        t.titleVi.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.titleZh ?? '').toLowerCase().includes(q) ||
        (t.titleEn ?? '').toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [trends, search, intentFilter, regionFilter]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Lọc theo tên Việt, Anh, Trung hoặc danh mục..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Lọc theo khu vực"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value as (typeof REGION_FILTERS)[number])}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium"
            >
              <option value="all">Mọi khu vực</option>
              <option value="CN→VN">Lan truyền TQ → VN</option>
              <option value="CN">Trung Quốc</option>
              <option value="Global">Quốc tế</option>
              <option value="VN">Việt Nam</option>
            </select>

            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Đang quét nguồn công khai...' : 'Đồng bộ tín hiệu mới'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg w-fit">
          {INTENT_FILTERS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setIntentFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                intentFilter === opt.value
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {syncNotice && (
          <p className="text-xs text-blue-700 dark:text-blue-400 pt-1">{syncNotice}</p>
        )}
      </div>

      {filtered.length === 0 ? (
        <ActionableEmptyState
          title="Không có chủ đề xu hướng khớp bộ lọc"
          description="Thử chuyển bộ lọc sang Tất cả hoặc bấm Đồng bộ tín hiệu mới để quét dữ liệu trực tiếp từ nguồn công khai."
          actionLabel="Đặt lại bộ lọc"
          onAction={() => {
            setSearch('');
            setIntentFilter('all');
            setRegionFilter('all');
          }}
        />
      ) : (
        <>
          {/* Desktop Data Table */}
          <div className="hidden md:block rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-5 font-medium">Chủ đề & Cụm đa ngôn ngữ</th>
                    <th className="py-3 px-4 font-medium">Ý định thương mại</th>
                    <th className="py-3 px-4 font-medium">Khu vực</th>
                    <th className="py-3 px-4 font-medium">Xu hướng 7 ngày</th>
                    <th className="py-3 px-4 font-medium text-right">Hạng</th>
                    <th className="py-3 px-4 font-medium text-right">Đà tăng</th>
                    <th className="py-3 px-5 font-medium text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => onSelectTrend(t)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-5 max-w-md">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {t.titleVi}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 truncate">
                          {t.category} · {t.platforms.join(', ')}
                          {t.titleZh ? ` · ${t.titleZh}` : ''}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <span
                          className={
                            t.intent === 'Commercial Product'
                              ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                              : t.intent === 'Legal/Safety Risk'
                                ? 'text-rose-600 dark:text-rose-400 font-medium'
                                : 'text-slate-500 dark:text-slate-400'
                          }
                        >
                          {t.intent}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {t.region}
                      </td>
                      <td className="py-3.5 px-4">
                        <Sparkline data={t.sparkline} positive={t.rankDelta >= 0} />
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-num text-xs whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">#{t.rankCurrent}</span>{' '}
                        <span className={t.rankDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                          ({t.rankDelta >= 0 ? `+${t.rankDelta}` : t.rankDelta})
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {t.momentumScore}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartResearch(t.titleVi, t.id);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Microscope className="w-3.5 h-3.5" />
                          <span>Nghiên cứu sâu</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Responsive Card List */}
          <div className="md:hidden space-y-3">
            {filtered.map((t) => (
              <div
                key={t.id}
                onClick={() => onSelectTrend(t)}
                className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{t.region} · {t.category}</span>
                  <span className="font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                    Đà {t.momentumScore}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.titleVi}</p>
                <p className="text-xs text-slate-500">
                  {t.intent} · Cập nhật {formatDateTimeVN(t.lastUpdatedAt)}
                </p>
                <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                  <Sparkline data={t.sparkline} positive={t.rankDelta >= 0} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartResearch(t.titleVi, t.id);
                    }}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400"
                  >
                    Nghiên cứu sâu →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
