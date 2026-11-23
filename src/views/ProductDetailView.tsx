import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Clapperboard,
  ExternalLink,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../services/api';
import { calculateEstimatedCommission } from '../lib/scoring';
import {
  formatDateVN,
  formatVND,
  isOutdated,
  sanitizeExternalUrl,
} from '../lib/format';
import type {
  MarketplacePlatform,
  OpportunityScoreResult,
  ProductRecord,
} from '../lib/types';
import { EvidenceTag, ScoreRing, TierLabel } from '../components/ui/Primitives';

export function ProductDetailView({
  product,
  scoring,
  onBack,
  onUpdated,
  onCreateContent,
}: {
  product: ProductRecord;
  scoring: OpportunityScoreResult;
  onBack: () => void;
  onUpdated: (product: ProductRecord, scoring: OpportunityScoreResult) => void;
  onCreateContent: (productId: string) => void;
}) {
  const [showAddShop, setShowAddShop] = useState(false);
  const [platform, setPlatform] = useState<MarketplacePlatform>('Shopee');
  const [shopName, setShopName] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [priceVnd, setPriceVnd] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [soldCountLabel, setSoldCountLabel] = useState('');
  const [operatorNote, setOperatorNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsedPrice = Number(priceVnd);
    const parsedComm = commissionRate.trim() ? Number(commissionRate) : null;

    if (!shopName.trim() || !productUrl.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setFormError('Vui lòng nhập Tên shop, URL hợp lệ (http/https) và Giá bán > 0 VNĐ.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.addMarketplaceMatch(product.id, {
        platform,
        shopName: shopName.trim(),
        productUrl: productUrl.trim(),
        priceVnd: parsedPrice,
        commissionRate: parsedComm,
        soldCountLabel: soldCountLabel.trim() || null,
        affiliateProgramStatus: parsedComm && parsedComm > 0 ? 'Đang mở' : 'Chưa xác minh',
        operatorNote: operatorNote.trim(),
      });
      onUpdated(res.product, res.scoring);
      setShowAddShop(false);
      setShopName('');
      setProductUrl('');
      setPriceVnd('');
      setCommissionRate('');
      setSoldCountLabel('');
      setOperatorNote('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể lưu link shop.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    const res = await api.deleteMarketplaceMatch(product.id, matchId);
    onUpdated(res.product, res.scoring);
  };

  const chartData = scoring.contributions.map((c) => ({
    name: c.label.replace('Khả năng tạo nội dung', 'Nội dung').replace('Cung ứng & rủi ro', 'Cung ứng').replace('Tăng trưởng xu hướng', 'Xu hướng').replace('Nhu cầu tại Việt Nam', 'Nhu cầu VN').replace('Mức độ cạnh tranh', 'Cạnh tranh').replace('Giá bán & hoa hồng', 'Giá & HH'),
    diem: c.weightedPoints ?? 0,
    toiDa: c.maxPoints,
    unknown: c.rating === null,
  }));

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại Sản phẩm tiềm năng</span>
          </button>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{product.nameVi}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {[product.nameEn, product.nameZh, product.category].filter(Boolean).join(' · ')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onCreateContent(product.id)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium whitespace-nowrap"
        >
          <Clapperboard className="w-4 h-4" />
          <span>Tạo kịch bản trong Content Studio</span>
        </button>
      </div>

      {/* 2-Column 360° Research Detail Layout (Spec Section 10.4) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 cols): 360° Evidence-Backed Research Profile */}
        <div className="xl:col-span-7 space-y-6">
          <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Hồ sơ phân tích sản phẩm 360°
              </h3>
              <span className="text-xs text-slate-400 font-mono-num">
                Phát hiện: {formatDateVN(product.detectedAt)}
              </span>
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{product.summary}</p>

            <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-sm">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Công dụng chính</p>
                <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">{product.useCase}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Chân dung người mua</p>
                <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">{product.buyerPersona}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nỗi đau khách hàng</p>
              <ul className="mt-1.5 space-y-1 text-sm text-slate-700 dark:text-slate-300 list-disc pl-5">
                {product.customerPainPoints.map((pain) => (
                  <li key={pain}>{pain}</li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Kết luận hỗ trợ quyết định</p>
                <EvidenceTag status="ai_inference" sourceName="AI Research Pipeline 2" recordedAt={product.updatedAt} />
              </div>
              <p className="mt-1.5 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                {product.aiConclusion}
              </p>
            </div>
          </section>

          {/* Market Signals: China / Global / Vietnam with Evidence Badges */}
          <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Tín hiệu theo thị trường & Nguồn bằng chứng
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { key: 'china', label: 'Trung Quốc (Douyin / Xiaohongshu / Bilibili)', sig: product.marketSignals.china },
                { key: 'global', label: 'Quốc tế (Reddit / YouTube / TikTok Global)', sig: product.marketSignals.global },
                { key: 'vietnam', label: 'Việt Nam (Shopee / TikTok Shop / Lazada)', sig: product.marketSignals.vietnam },
              ].map(({ key, label, sig }) => (
                <div key={key} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{label}</span>
                    <EvidenceTag
                      status={sig.status}
                      sourceName={label}
                      sourceUrl={sig.sourceUrl}
                      recordedAt={sig.recordedAt}
                      retrievalMode={sig.retrievalMode}
                    />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{sig.summary}</p>
                </div>
              ))}
            </div>

            {product.evidence.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                  Danh mục bằng chứng kiểm chứng ({product.evidence.length})
                </p>
                <div className="space-y-2">
                  {product.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{ev.field}: </span>
                        <span className="text-slate-600 dark:text-slate-400">{ev.claim}</span>
                      </div>
                      <EvidenceTag
                        status={ev.status}
                        sourceName={ev.sourceName}
                        sourceUrl={ev.sourceUrl}
                        recordedAt={ev.recordedAt}
                        retrievalMode={ev.retrievalMode}
                        note={ev.note}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Content Angles & Risks */}
          <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 grid sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ý tưởng góc nội dung</h3>
              <ul className="mt-2.5 space-y-2 text-sm text-slate-600 dark:text-slate-300 list-disc pl-4">
                {product.contentAngles.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Rủi ro cần lưu ý</h3>
              <div className="mt-2.5 space-y-2.5">
                {product.risks.map((r, idx) => (
                  <div key={idx} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle
                        className={`w-3.5 h-3.5 shrink-0 ${
                          r.severity === 'Cao' ? 'text-rose-600' : 'text-amber-600'
                        }`}
                      />
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {r.type} ({r.severity})
                      </span>
                    </div>
                    <p className="mt-0.5 text-slate-600 dark:text-slate-400 pl-5">{r.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (5 cols): 6-Criteria Opportunity Scoring + Marketplace Comparison */}
        <div className="xl:col-span-5 space-y-6">
          {/* Opportunity Score Breakdown */}
          <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <ScoreRing scoring={scoring} onFillMissing={() => setShowAddShop(true)} />
              <div className="text-right space-y-1">
                <TierLabel tier={scoring.tier} />
                <p className="text-xs text-slate-500">
                  Tin cậy: <span className="font-mono-num font-medium">{scoring.evidenceConfidence}%</span> ({scoring.evidenceConfidenceLabel})
                </p>
                <p className="text-xs text-slate-500">
                  {scoring.commercialReadiness ? 'Đã sẵn sàng Affiliate' : 'Cần xác minh sàn/hoa hồng'}
                </p>
              </div>
            </div>

            {/* Bar Chart Breakdown */}
            <div className="h-48 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} horizontal={false} />
                  <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" width={92} />
                  <Tooltip
                    formatter={(value: unknown) => [`${value} điểm`, 'Đóng góp']}
                    contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                  />
                  <Bar dataKey="diem" fill="#2563EB" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 6 Criteria Table */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {product.criteria.map((c) => (
                <div key={c.key} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{c.label}</span>
                      <span className="font-mono-num text-slate-400">({c.weight}%)</span>
                      <EvidenceTag status={c.verification} sourceUrl={c.sourceUrl} recordedAt={c.recordedAt} />
                    </div>
                    <p className="mt-0.5 text-slate-500 dark:text-slate-400">{c.reason}</p>
                  </div>
                  <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
                    {c.rating !== null ? `${c.rating}/5` : 'Unknown'}
                  </span>
                </div>
              ))}
            </div>

            {/* Score History */}
            {product.scoreHistory.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Lịch sử thay đổi điểm</p>
                {product.scoreHistory.map((h, idx) => (
                  <div key={idx} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="font-mono-num text-slate-400 shrink-0">{h.date}</span>
                    <span className="text-slate-600 dark:text-slate-300 flex-1">{h.reason}</span>
                    <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                      {h.score} ({h.completeness}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Marketplace Comparison & Manual Mode Editor */}
          <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Đối chiếu sàn Việt Nam
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Shopee · TikTok Shop · Lazada (Chế độ xác minh thủ công)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddShop((s) => !s)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm shop thủ công</span>
              </button>
            </div>

            {showAddShop && (
              <form
                onSubmit={handleAddMatch}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label className="space-y-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Sàn TMĐT</span>
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value as MarketplacePlatform)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
                    >
                      <option value="Shopee">Shopee</option>
                      <option value="TikTok Shop">TikTok Shop</option>
                      <option value="Lazada">Lazada</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Tên gian hàng *</span>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="VD: PeriPage Mall VN"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
                    />
                  </label>
                </div>

                <label className="block space-y-1 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Link sản phẩm trên sàn *</span>
                  <input
                    type="url"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    placeholder="https://shopee.vn/..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
                  />
                </label>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <label className="space-y-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Giá bán (VNĐ) *</span>
                    <input
                      type="number"
                      min={1000}
                      value={priceVnd}
                      onChange={(e) => setPriceVnd(e.target.value)}
                      placeholder="329000"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-mono-num"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Hoa hồng (%)</span>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={60}
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(e.target.value)}
                      placeholder="9.5"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-mono-num"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Lượt bán</span>
                    <input
                      type="text"
                      value={soldCountLabel}
                      onChange={(e) => setSoldCountLabel(e.target.value)}
                      placeholder="1,2k đã bán"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
                    />
                  </label>
                </div>

                <label className="block space-y-1 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Ghi chú kiểm tra</span>
                  <input
                    type="text"
                    value={operatorNote}
                    onChange={(e) => setOperatorNote(e.target.value)}
                    placeholder="Chính sách bảo hành, hoa hồng bonus..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
                  />
                </label>

                {formError && <p className="text-xs text-rose-600 dark:text-rose-400">{formError}</p>}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddShop(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200/60"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                  >
                    {submitting ? 'Đang lưu...' : 'Lưu đối chiếu'}
                  </button>
                </div>
              </form>
            )}

            {product.marketplaceMatches.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Chưa có link gian hàng nào được xác minh. Bấm “Thêm shop thủ công” để cập nhật giá & tỷ lệ hoa hồng.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {product.marketplaceMatches.map((m) => {
                  const estComm = calculateEstimatedCommission(m.priceVnd, m.commissionRate);
                  const stale = isOutdated(m.verifiedAt, 7);
                  const href = sanitizeExternalUrl(m.productUrl);

                  return (
                    <div key={m.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-blue-700 dark:text-blue-400">{m.platform}</span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                              {m.shopName}
                            </span>
                            {stale && <EvidenceTag status="outdated" recordedAt={m.verifiedAt} />}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 truncate">{m.productTitle}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {href && (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Mở sản phẩm tại ${m.shopName}`}
                              className="p-1 text-slate-400 hover:text-blue-600"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteMatch(m.id)}
                            aria-label={`Xóa shop ${m.shopName}`}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-slate-400 block">Giá kiểm tra</span>
                          <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                            {formatVND(m.priceVnd)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Hoa hồng</span>
                          <span className="font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                            {m.commissionRate !== null ? `${m.commissionRate}%` : 'Unknown'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Ước tính/đơn</span>
                          <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                            {estComm !== null ? formatVND(estComm) : 'Unknown'}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400">
                        Trạng thái: {m.affiliateProgramStatus} · Kiểm tra ngày {formatDateVN(m.verifiedAt)}
                        {m.soldCountLabel ? ` · ${m.soldCountLabel}` : ''} · Ước tính trước hủy đơn
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
