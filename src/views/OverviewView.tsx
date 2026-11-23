import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Flame,
  Microscope,
} from 'lucide-react';
import type { OverviewResponse } from '../services/api';
import type { TrendTopic, ViewId } from '../lib/types';
import { formatDateTimeVN, formatVND } from '../lib/format';
import {
  ActionableEmptyState,
  ScoreRing,
  SourceStatusIndicator,
  Sparkline,
  TierLabel,
} from '../components/ui/Primitives';

export function OverviewView({
  data,
  loading,
  onNavigate,
  onOpenProduct,
  onInspectTrend,
  onSyncTrends,
  syncing,
}: {
  data: OverviewResponse | null;
  loading: boolean;
  onNavigate: (view: ViewId) => void;
  onOpenProduct: (id: string) => void;
  onInspectTrend: (trend: TrendTopic) => void;
  onSyncTrends: () => void;
  syncing: boolean;
}) {
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <ActionableEmptyState
        title="Chưa tải được dữ liệu tổng quan"
        description="Hệ thống chưa nhận được phản hồi từ máy chủ cục bộ. Vui lòng thử đồng bộ lại."
        actionLabel="Chạy đồng bộ TrendRadar ngay"
        onAction={onSyncTrends}
      />
    );
  }

  const { kpis, topOpportunities, emergingTrends, sourceAlerts, notifications } = data;

  return (
    <div className="space-y-6">
      {/* 4 KPI Cards (Max 4 per desktop row per Spec Section 10.1) */}
      <section aria-label="Chỉ số tổng quan hôm nay" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Xu hướng mới hôm nay</p>
          <p className="mt-2 text-2xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
            {kpis.newTrendsToday}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono-num font-medium text-emerald-700 dark:text-emerald-400">
              {kpis.commercialTrendsCount}
            </span>{' '}
            có ý định thương mại
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sản phẩm đủ điều kiện</p>
          <p className="mt-2 text-2xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
            {kpis.eligibleProducts}
            <span className="text-sm font-normal text-slate-400"> / {kpis.totalProducts}</span>
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Đạt ngưỡng Ưu tiên cao / Nghiên cứu thêm
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tác vụ nghiên cứu</p>
          <p className="mt-2 text-2xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
            {kpis.activeResearchJobs}
            <span className="text-sm font-normal text-slate-400"> đang chạy</span>
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Tổng <span className="font-mono-num">{kpis.totalResearchRuns}</span> phiên Last30Days đã lưu
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sức khỏe nguồn dữ liệu</p>
          <p className="mt-2 text-2xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
            {kpis.healthySources}
            <span className="text-sm font-normal text-slate-400"> / {kpis.totalSources}</span>
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Nguồn miễn phí sẵn sàng · Sàn VN ở chế độ Nhập tay
          </p>
        </div>
      </section>

      {/* Main 2-Column Editorial Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 8 cols: Top Opportunities */}
        <section className="xl:col-span-8 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Top cơ hội sản phẩm cần xem ngay
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Xếp hạng có bằng chứng theo thang 100 điểm · Hiển thị rõ độ đầy đủ dữ liệu
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('opportunities')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {topOpportunities.map(({ product, scoring }) => (
              <div
                key={product.id}
                className="p-4 sm:px-5 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>{product.category}</span>
                    <span aria-hidden="true">·</span>
                    <TierLabel tier={scoring.tier} />
                    {product.hasCnToVnSignal && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">Tín hiệu TQ→VN</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenProduct(product.id)}
                    className="mt-1 text-left text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {product.nameVi}
                  </button>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                    Giá VN:{' '}
                    <span className="font-mono-num text-slate-700 dark:text-slate-300">
                      {product.verifiedPriceRangeVnd.min
                        ? `${formatVND(product.verifiedPriceRangeVnd.min)} – ${formatVND(product.verifiedPriceRangeVnd.max)}`
                        : 'Chưa xác minh'}
                    </span>
                    {' · '}
                    Hoa hồng:{' '}
                    <span className="font-mono-num text-slate-700 dark:text-slate-300">
                      {product.verifiedCommissionRange.min !== null
                        ? `${product.verifiedCommissionRange.min}%–${product.verifiedCommissionRange.max}%`
                        : 'Chưa có dữ liệu'}
                    </span>
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                  <ScoreRing
                    scoring={scoring}
                    compact
                    onFillMissing={() => onOpenProduct(product.id)}
                  />
                  <button
                    type="button"
                    onClick={() => onOpenProduct(product.id)}
                    aria-label={`Mở hồ sơ ${product.nameVi}`}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:border-blue-300 transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right 4 cols: Source Alerts & Daily Notifications */}
        <div className="xl:col-span-4 space-y-6">
          <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Cảnh báo nguồn dữ liệu
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('data_sources')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Kiểm tra
              </button>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {sourceAlerts.length === 0 ? (
                <div className="p-5 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tất cả nguồn dữ liệu đang hoạt động ổn định.</span>
                </div>
              ) : (
                sourceAlerts.slice(0, 4).map((src) => (
                  <div key={src.id} className="px-5 py-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {src.name}
                      </span>
                      <SourceStatusIndicator status={src.status} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {src.lastMessage}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] dark:border-[#1E293B]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Nhật ký cảnh báo gần đây
              </h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {notifications.slice(0, 3).map((n) => (
                <div key={n.id} className="px-5 py-3.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                        n.severity === 'success'
                          ? 'text-emerald-600'
                          : n.severity === 'warning'
                            ? 'text-amber-600'
                            : 'text-slate-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{n.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                      <p className="mt-1 text-[11px] font-mono-num text-slate-400">
                        {formatDateTimeVN(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Bottom Row: Emerging Commercial Trends */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] dark:border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Xu hướng thương mại mới nổi (Đã lọc bỏ tin tức & giải trí)
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSyncTrends}
              disabled={syncing}
              className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
            >
              {syncing ? 'Đang đồng bộ...' : 'Đồng bộ tín hiệu mới'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('trends')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>Mở Trend Radar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <th className="py-3 px-5 font-medium">Chủ đề xu hướng</th>
                <th className="py-3 px-4 font-medium">Khu vực</th>
                <th className="py-3 px-4 font-medium">7 ngày</th>
                <th className="py-3 px-4 font-medium text-right">Đà tăng</th>
                <th className="py-3 px-5 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
              {emergingTrends.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => onInspectTrend(t)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-5">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{t.titleVi}</p>
                    <p className="text-xs text-slate-500 truncate max-w-md">
                      {t.platforms.join(' · ')}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {t.region}
                  </td>
                  <td className="py-3 px-4">
                    <Sparkline data={t.sparkline} positive={t.rankDelta >= 0} />
                  </td>
                  <td className="py-3 px-4 text-right font-mono-num font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    {t.momentumScore}
                  </td>
                  <td className="py-3 px-5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectTrend(t);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <Microscope className="w-3.5 h-3.5" />
                      <span>Xem nhanh</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
