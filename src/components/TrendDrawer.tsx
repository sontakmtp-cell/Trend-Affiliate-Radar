import React from 'react';
import {
  ArrowUpRight,
  ExternalLink,
  Microscope,
  Trash2,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { OpportunityScoreResult, ProductRecord, TrendTopic } from '../lib/types';
import { formatDateTimeVN, formatVND, sanitizeExternalUrl } from '../lib/format';
import { EvidenceTag, ScoreRing, TierLabel } from './ui/Primitives';

export function TrendDrawer({
  trend,
  productBundle,
  onClose,
  onStartResearch,
  onOpenProduct,
  onDismissTrend,
}: {
  trend: TrendTopic | null;
  productBundle?: { product: ProductRecord; scoring: OpportunityScoreResult } | null;
  onClose: () => void;
  onStartResearch: (keyword: string, trendId?: string) => void;
  onOpenProduct: (productId: string) => void;
  onDismissTrend?: (trendId: string) => void;
}) {
  if (!trend && !productBundle) return null;

  const safeTrendUrl = sanitizeExternalUrl(trend?.sourceUrl);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Ngăn kéo xem nhanh">
      <div className="fixed inset-0 bg-slate-950/35" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 w-full max-w-lg bg-white dark:bg-[#111827] border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {trend ? `${trend.region} · ${trend.category} · ${trend.intent}` : productBundle?.product.category}
            </p>
            <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {trend ? trend.titleVi : productBundle?.product.nameVi}
            </h2>
            {(trend?.titleZh || trend?.titleEn || productBundle?.product.nameZh) && (
              <p className="mt-0.5 text-xs text-slate-500 truncate">
                {trend
                  ? [trend.titleEn, trend.titleZh].filter(Boolean).join(' · ')
                  : [productBundle?.product.nameEn, productBundle?.product.nameZh].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng ngăn kéo"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {trend && (
            <>
              <div className="grid grid-cols-3 gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <p className="text-xs text-slate-500">Đà tăng trưởng</p>
                  <p className="mt-1 text-xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
                    {trend.momentumScore}/100
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Thứ hạng</p>
                  <p className="mt-1 text-xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400">
                    #{trend.rankCurrent}{' '}
                    <span className="text-xs font-medium">
                      ({trend.rankDelta >= 0 ? `+${trend.rankDelta}` : trend.rankDelta})
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Lượt đề cập</p>
                  <p className="mt-1 text-xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
                    {trend.mentionCount.toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Quỹ đạo xếp hạng đa nền tảng (Trung Quốc vs Quốc tế)
                  </h3>
                  <span className="text-[11px] text-slate-400">Số nhỏ hơn = hạng cao hơn</span>
                </div>
                <div className="h-44 w-full rounded-xl border border-slate-200 dark:border-slate-800 p-2 bg-slate-50/50 dark:bg-slate-900/50">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend.rankHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
                      <YAxis reversed tick={{ fontSize: 11 }} stroke="#64748b" width={28} />
                      <Tooltip
                        contentStyle={{
                          fontSize: '12px',
                          borderRadius: '8px',
                          borderColor: '#e2e8f0',
                        }}
                      />
                      <Line type="monotone" dataKey="cnRank" name="Hạng TQ" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="globalRank" name="Hạng Quốc tế" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Nền tảng phát hiện</span>
                  <span className="font-medium text-right">{trend.platforms.join(' · ')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Cập nhật lần cuối</span>
                  <span className="font-mono-num">{formatDateTimeVN(trend.lastUpdatedAt)}</span>
                </div>
                {safeTrendUrl && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Nguồn tham chiếu</span>
                    <a
                      href={safeTrendUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <span>Mở liên kết gốc</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </>
          )}

          {productBundle && (
            <div className="space-y-5 pt-2">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <ScoreRing scoring={productBundle.scoring} />
                <div className="text-right space-y-1">
                  <TierLabel tier={productBundle.scoring.tier} />
                  <p className="text-xs text-slate-500">
                    Độ tin cậy: {productBundle.scoring.evidenceConfidence}% ({productBundle.scoring.evidenceConfidenceLabel})
                  </p>
                  <p className="text-xs text-slate-500">
                    {productBundle.scoring.commercialReadiness ? 'Sẵn sàng Affiliate' : 'Chưa đủ link/hoa hồng'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tóm tắt phân tích
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {productBundle.product.summary}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Khoảng giá VN</span>
                    <EvidenceTag status={productBundle.product.verifiedPriceRangeVnd.status} />
                  </div>
                  <p className="mt-1 font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                    {productBundle.product.verifiedPriceRangeVnd.min
                      ? `${formatVND(productBundle.product.verifiedPriceRangeVnd.min)} – ${formatVND(productBundle.product.verifiedPriceRangeVnd.max)}`
                      : 'Chưa có dữ liệu'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Hoa hồng</span>
                    <EvidenceTag status={productBundle.product.verifiedCommissionRange.status} />
                  </div>
                  <p className="mt-1 font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                    {productBundle.product.verifiedCommissionRange.min !== null
                      ? `${productBundle.product.verifiedCommissionRange.min}% – ${productBundle.product.verifiedCommissionRange.max}%`
                      : 'Chưa có dữ liệu'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-2">
          {trend && onDismissTrend && (
            <button
              type="button"
              onClick={() => {
                onDismissTrend(trend.id);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Bỏ qua</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {productBundle || trend?.linkedProductId ? (
              <button
                type="button"
                onClick={() => {
                  const id = productBundle?.product.id || trend?.linkedProductId;
                  if (id) {
                    onOpenProduct(id);
                    onClose();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
              >
                <span>Mở hồ sơ đầy đủ</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              trend && (
                <button
                  type="button"
                  onClick={() => {
                    onStartResearch(trend.titleVi, trend.id);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                >
                  <Microscope className="w-3.5 h-3.5" />
                  <span>Chạy nghiên cứu sâu</span>
                </button>
              )
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
