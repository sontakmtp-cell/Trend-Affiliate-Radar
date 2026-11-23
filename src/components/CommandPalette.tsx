import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Flame, Search, Target, X } from 'lucide-react';
import type { ProductRecord, TrendTopic, ViewId } from '../lib/types';

const SCREENS: { id: ViewId; label: string; group: string }[] = [
  { id: 'overview', label: 'Tổng quan vận hành', group: 'Khám phá' },
  { id: 'trends', label: 'Trend Radar & Explorer', group: 'Khám phá' },
  { id: 'opportunities', label: 'Sản phẩm tiềm năng', group: 'Khám phá' },
  { id: 'research_queue', label: 'Hàng đợi nghiên cứu (Last30Days)', group: 'Nghiên cứu & Vận hành' },
  { id: 'content_studio', label: 'Studio nội dung Affiliate', group: 'Nghiên cứu & Vận hành' },
  { id: 'content_calendar', label: 'Lịch nội dung (Kanban & Lịch)', group: 'Nghiên cứu & Vận hành' },
  { id: 'campaigns', label: 'Chiến dịch & Link Affiliate', group: 'Nghiên cứu & Vận hành' },
  { id: 'csv_import', label: 'Nhập báo cáo CSV / XLSX', group: 'Nghiên cứu & Vận hành' },
  { id: 'analytics', label: 'Doanh thu & ROI Analytics', group: 'Nghiên cứu & Vận hành' },
  { id: 'data_sources', label: 'Nguồn dữ liệu & Sức khỏe', group: 'Hệ thống' },
  { id: 'settings', label: 'Cài đặt AI & Hệ thống', group: 'Hệ thống' },
];

export function CommandPalette({
  open,
  onClose,
  trends,
  products,
  onSelectView,
  onSelectTrend,
  onSelectProduct,
}: {
  open: boolean;
  onClose: () => void;
  trends: TrendTopic[];
  products: ProductRecord[];
  onSelectView: (view: ViewId) => void;
  onSelectTrend: (trend: TrendTopic) => void;
  onSelectProduct: (productId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const q = query.trim().toLowerCase();

  const matchedProducts = useMemo(() => {
    if (!q) return products.slice(0, 4);
    return products
      .filter(
        (p) =>
          p.nameVi.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.nameZh.toLowerCase().includes(q) ||
          p.aliases.some((a) => a.toLowerCase().includes(q)),
      )
      .slice(0, 5);
  }, [products, q]);

  const matchedTrends = useMemo(() => {
    if (!q) return trends.slice(0, 4);
    return trends
      .filter(
        (t) =>
          t.titleVi.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          (t.titleEn ?? '').toLowerCase().includes(q) ||
          (t.titleZh ?? '').toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [trends, q]);

  const matchedScreens = useMemo(() => {
    if (!q) return SCREENS.slice(0, 6);
    return SCREENS.filter(
      (s) => s.label.toLowerCase().includes(q) || s.group.toLowerCase().includes(q),
    );
  }, [q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-slate-950/50 backdrop-blur-[1px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Tìm kiếm nhanh toàn cục"
    >
      <div
        className="w-full max-w-xl rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm sản phẩm (Việt / Anh / Trung), xu hướng hoặc chuyển màn hình..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp tìm kiếm"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
          {matchedProducts.length > 0 && (
            <div>
              <p className="px-2 mb-1.5 text-[11px] font-semibold text-slate-400">Sản phẩm tiềm năng</p>
              <div className="space-y-0.5">
                {matchedProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelectProduct(p.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Target className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {p.nameVi}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {p.nameEn} {p.nameZh ? `· ${p.nameZh}` : ''}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedTrends.length > 0 && (
            <div>
              <p className="px-2 mb-1.5 text-[11px] font-semibold text-slate-400">Xu hướng Trend Radar</p>
              <div className="space-y-0.5">
                {matchedTrends.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onSelectTrend(t);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Flame className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {t.titleVi}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {t.region} · {t.intent} · Đà {t.momentumScore}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedScreens.length > 0 && (
            <div>
              <p className="px-2 mb-1.5 text-[11px] font-semibold text-slate-400">Đi tới màn hình</p>
              <div className="space-y-0.5">
                {matchedScreens.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSelectView(s.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span>{s.label}</span>
                    <span className="text-xs text-slate-400">{s.group}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedProducts.length === 0 && matchedTrends.length === 0 && matchedScreens.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              Không tìm thấy kết quả phù hợp cho “{query}”.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
