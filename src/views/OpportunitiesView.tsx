import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Columns3, Search, X } from 'lucide-react';
import type { OpportunityScoreResult, ProductRecord } from '../lib/types';
import { formatVND } from '../lib/format';
import { ActionableEmptyState, ScoreRing, TierLabel } from '../components/ui/Primitives';

type QuickFilter = 'all' | 'high' | 'pending' | 'cn_to_vn';

export function OpportunitiesView({
  items,
  onOpenProduct,
  onInspectProduct,
  onGoToResearch,
}: {
  items: { product: ProductRecord; scoring: OpportunityScoreResult }[];
  onOpenProduct: (productId: string) => void;
  onInspectProduct: (bundle: { product: ProductRecord; scoring: OpportunityScoreResult }) => void;
  onGoToResearch: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QuickFilter>('all');
  const [category, setCategory] = useState('all');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.product.category))),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(({ product, scoring }) => {
      if (filter === 'high' && scoring.tier !== 'Ưu tiên cao') return false;
      if (filter === 'pending' && scoring.tier !== 'Chờ xác minh') return false;
      if (filter === 'cn_to_vn' && !product.hasCnToVnSignal) return false;
      if (category !== 'all' && product.category !== category) return false;
      if (!q) return true;
      return (
        product.nameVi.toLowerCase().includes(q) ||
        product.nameEn.toLowerCase().includes(q) ||
        product.nameZh.toLowerCase().includes(q) ||
        product.aliases.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [items, search, filter, category]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const comparedItems = items.filter((i) => compareIds.includes(i.product.id));

  return (
    <div className="space-y-5">
      {/* Filters & Compare Bar */}
      <div className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm sản phẩm theo tên Việt / Anh / Trung..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Lọc theo danh mục sản phẩm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium"
            >
              <option value="all">Tất cả danh mục</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {compareIds.length >= 2 && (
              <button
                type="button"
                onClick={() => setShowCompare(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium whitespace-nowrap"
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>So sánh ({compareIds.length})</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg w-fit">
          {[
            { id: 'all', label: 'Tất cả sản phẩm' },
            { id: 'high', label: 'Ưu tiên cao' },
            { id: 'pending', label: 'Chờ xác minh' },
            { id: 'cn_to_vn', label: 'Có tín hiệu TQ→VN' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as QuickFilter)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <ActionableEmptyState
          title="Chưa có sản phẩm khớp điều kiện lọc"
          description="Bạn có thể mở Hàng đợi nghiên cứu để chạy phân tích Last30Days Global & CN cho từ khóa sản phẩm mới."
          actionLabel="Chạy nghiên cứu sản phẩm mới"
          onAction={onGoToResearch}
        />
      ) : (
        <div className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-3 pl-5 pr-2 font-medium w-10">So sánh</th>
                  <th className="py-3 px-4 font-medium">Sản phẩm tiềm năng</th>
                  <th className="py-3 px-4 font-medium">Điểm cơ hội & Độ đầy đủ</th>
                  <th className="py-3 px-4 font-medium">Xếp loại & Tin cậy</th>
                  <th className="py-3 px-4 font-medium text-right">Khoảng giá VN</th>
                  <th className="py-3 px-4 font-medium text-right">Hoa hồng</th>
                  <th className="py-3 px-5 font-medium text-right">Hồ sơ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {filtered.map((bundle) => {
                  const { product, scoring } = bundle;
                  const checked = compareIds.includes(product.id);
                  return (
                    <tr
                      key={product.id}
                      onClick={() => onInspectProduct(bundle)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 pl-5 pr-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCompare(product.id)}
                          aria-label={`Chọn so sánh ${product.nameVi}`}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                        />
                      </td>
                      <td className="py-3.5 px-4 max-w-sm">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {product.nameVi}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 truncate">
                          {product.category}
                          {product.hasCnToVnSignal ? ' · Tín hiệu TQ→VN' : ''}
                          {product.nameZh ? ` · ${product.nameZh}` : ''}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                        <ScoreRing
                          scoring={scoring}
                          compact
                          onFillMissing={() => onOpenProduct(product.id)}
                        />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <TierLabel tier={scoring.tier} />
                        <p className="mt-0.5 text-xs text-slate-500">
                          Tin cậy {scoring.evidenceConfidence}% ({scoring.evidenceConfidenceLabel})
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-num text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {product.verifiedPriceRangeVnd.min
                          ? `${formatVND(product.verifiedPriceRangeVnd.min)} – ${formatVND(product.verifiedPriceRangeVnd.max)}`
                          : 'Chưa có dữ liệu'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-num text-xs whitespace-nowrap">
                        {product.verifiedCommissionRange.min !== null ? (
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {product.verifiedCommissionRange.min}% – {product.verifiedCommissionRange.max}%
                          </span>
                        ) : (
                          <span className="text-slate-400">Chưa có dữ liệu</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenProduct(product.id);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <span>Hồ sơ 360°</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Side-by-side Quick Compare Modal */}
      {showCompare && comparedItems.length >= 2 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
          onClick={() => setShowCompare(false)}
          role="dialog"
          aria-modal="true"
          aria-label="So sánh nhanh sản phẩm"
        >
          <div
            className="w-full max-w-5xl max-h-[85vh] overflow-y-auto rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                So sánh nhanh ({comparedItems.length} sản phẩm)
              </h2>
              <button
                type="button"
                onClick={() => setShowCompare(false)}
                aria-label="Đóng bảng so sánh"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
              {comparedItems.map(({ product, scoring }) => (
                <div
                  key={product.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4"
                >
                  <div>
                    <p className="text-xs text-slate-500">{product.category}</p>
                    <h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {product.nameVi}
                    </h3>
                  </div>
                  <ScoreRing scoring={scoring} compact />
                  <div className="space-y-2 text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Xếp loại</span>
                      <TierLabel tier={scoring.tier} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Độ tin cậy</span>
                      <span className="font-mono-num">{scoring.evidenceConfidence}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sẵn sàng Affiliate</span>
                      <span>{scoring.commercialReadiness ? 'Có' : 'Chưa'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Số shop đối chiếu</span>
                      <span className="font-mono-num">{product.marketplaceMatches.length}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompare(false);
                      onOpenProduct(product.id);
                    }}
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                  >
                    Mở hồ sơ chi tiết
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
