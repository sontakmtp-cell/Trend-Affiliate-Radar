import React, { useState } from 'react';
import { Check, Copy, Link2, Plus } from 'lucide-react';
import { api } from '../services/api';
import type {
  AffiliateLinkRecord,
  AppSettings,
  CampaignRecord,
  MarketplacePlatform,
  ProductRecord,
} from '../lib/types';
import { formatDateVN, formatVND } from '../lib/format';

export function CampaignsView({
  campaigns,
  links,
  products,
  settings,
  onCampaignCreated,
  onLinkCreated,
  onLinkUpdated,
}: {
  campaigns: CampaignRecord[];
  links: AffiliateLinkRecord[];
  products: ProductRecord[];
  settings: AppSettings;
  onCampaignCreated: (c: CampaignRecord) => void;
  onLinkCreated: (l: AffiliateLinkRecord) => void;
  onLinkUpdated: (l: AffiliateLinkRecord) => void;
}) {
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [cmpName, setCmpName] = useState('');
  const [cmpObjective, setCmpObjective] = useState('');
  const [cmpBudget, setCmpBudget] = useState('500000');

  const [showNewLink, setShowNewLink] = useState(false);
  const [linkProductId, setLinkProductId] = useState(products[0]?.id || '');
  const [linkCampaignId, setLinkCampaignId] = useState(campaigns[0]?.id || '');
  const [linkPlatform, setLinkPlatform] = useState<MarketplacePlatform>('Shopee');
  const [linkOriginalUrl, setLinkOriginalUrl] = useState('');
  const [linkSubId, setLinkSubId] = useState('');
  const [linkUtmSource, setLinkUtmSource] = useState('tiktok');
  const [linkPromoExp, setLinkPromoExp] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmpName.trim()) return;
    const res = await api.createCampaign({
      name: cmpName.trim(),
      objective: cmpObjective.trim() || 'Tối ưu hoa hồng Affiliate',
      budgetVnd: Number(cmpBudget) || 0,
    });
    onCampaignCreated(res.campaign);
    setCmpName('');
    setCmpObjective('');
    setShowNewCampaign(false);
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);
    if (!linkProductId || !linkOriginalUrl.trim() || !linkSubId.trim()) {
      setLinkError('Vui lòng nhập đầy đủ Sản phẩm, Link Affiliate gốc (http/https) và mã Sub_id.');
      return;
    }
    try {
      const res = await api.createAffiliateLink({
        campaignId: linkCampaignId || null,
        productId: linkProductId,
        platform: linkPlatform,
        originalAffiliateUrl: linkOriginalUrl.trim(),
        subId: linkSubId.trim(),
        utmSource: linkUtmSource.trim(),
        promoExpiresAt: linkPromoExp || null,
      });
      onLinkCreated(res.link);
      setLinkOriginalUrl('');
      setLinkSubId('');
      setShowNewLink(false);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Không thể tạo link Affiliate.');
    }
  };

  const handleCopy = async (id: string, url: string) => {
    await navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleStockChange = async (link: AffiliateLinkRecord, stockStatus: AffiliateLinkRecord['stockStatus']) => {
    const res = await api.updateAffiliateLink(link.id, { stockStatus });
    onLinkUpdated(res.link);
  };

  return (
    <div className="space-y-6">
      {/* Localhost vs VPS Tracking Rule Banner (Spec Section 11) */}
      <div className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            Chế độ Tracking hiện tại:{' '}
            <span className="text-blue-600 dark:text-blue-400">
              {settings.publicBaseUrl ? 'URL Redirect Tracker (VPS)' : 'Sub_id / UTM chuẩn sàn (Local Mode)'}
            </span>
          </p>
          <p className="mt-0.5 text-slate-500 dark:text-slate-400">
            {settings.publicBaseUrl
              ? `Đang dùng domain công khai ${settings.publicBaseUrl} để ghi nhận lượt nhấp.`
              : 'Hệ thống không bọc link trái điều khoản sàn; đối chiếu đơn hàng & hoa hồng qua Sub_id khi nhập báo cáo CSV/XLSX. Cấu hình PUBLIC_BASE_URL trong Cài đặt khi triển khai lên VPS.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowNewCampaign((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo chiến dịch</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewLink((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Tạo Link & Sub_id</span>
          </button>
        </div>
      </div>

      {/* Create Campaign Form */}
      {showNewCampaign && (
        <form
          onSubmit={handleCreateCampaign}
          className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs"
        >
          <input
            type="text"
            value={cmpName}
            onChange={(e) => setCmpName(e.target.value)}
            placeholder="Tên chiến dịch *"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={cmpObjective}
            onChange={(e) => setCmpObjective(e.target.value)}
            placeholder="Mục tiêu chiến dịch"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm md:col-span-2"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={cmpBudget}
              onChange={(e) => setCmpBudget(e.target.value)}
              placeholder="Ngân sách (VNĐ)"
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-num"
            />
            <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium">
              Lưu
            </button>
          </div>
        </form>
      )}

      {/* Create Affiliate Link Form */}
      {showNewLink && (
        <form
          onSubmit={handleCreateLink}
          className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-3 text-xs"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Sản phẩm</span>
              <select
                value={linkProductId}
                onChange={(e) => setLinkProductId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameVi}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Chiến dịch</span>
              <select
                value={linkCampaignId}
                onChange={(e) => setLinkCampaignId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2"
              >
                <option value="">Không gắn chiến dịch</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Sàn Affiliate</span>
              <select
                value={linkPlatform}
                onChange={(e) => setLinkPlatform(e.target.value as MarketplacePlatform)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2"
              >
                <option value="Shopee">Shopee</option>
                <option value="TikTok Shop">TikTok Shop</option>
                <option value="Lazada">Lazada</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="space-y-1 md:col-span-2">
              <span className="font-medium text-slate-700 dark:text-slate-300">Link Affiliate gốc từ sàn *</span>
              <input
                type="url"
                value={linkOriginalUrl}
                onChange={(e) => setLinkOriginalUrl(e.target.value)}
                placeholder="https://shope.ee/..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Mã Sub_id *</span>
              <input
                type="text"
                value={linkSubId}
                onChange={(e) => setLinkSubId(e.target.value)}
                placeholder="q4_printer_vid02"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-num"
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">UTM Source / Hết hạn ưu đãi</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={linkUtmSource}
                  onChange={(e) => setLinkUtmSource(e.target.value)}
                  className="w-1/2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-2"
                />
                <input
                  type="date"
                  value={linkPromoExp}
                  onChange={(e) => setLinkPromoExp(e.target.value)}
                  className="w-1/2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-2 font-mono-num"
                />
              </div>
            </label>
          </div>

          {linkError && <p className="text-rose-600 dark:text-rose-400">{linkError}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewLink(false)}
              className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Hủy
            </button>
            <button type="submit" className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-medium">
              Tạo Tracking Link
            </button>
          </div>
        </form>
      )}

      {/* Campaigns Strip */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campaigns.map((cmp) => (
          <div
            key={cmp.id}
            className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-2"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{cmp.status}</span>
              <span className="font-mono-num text-slate-400">
                {formatDateVN(cmp.startDate)} {cmp.endDate ? `→ ${formatDateVN(cmp.endDate)}` : ''}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{cmp.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{cmp.objective}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 pt-1">
              Ngân sách dự kiến:{' '}
              <span className="font-mono-num font-semibold">{formatVND(cmp.budgetVnd)}</span>
              {' · '}
              <span className="font-mono-num">
                {links.filter((l) => l.campaignId === cmp.id).length} link gắn mã Sub_id
              </span>
            </p>
          </div>
        ))}
      </section>

      {/* Affiliate Links Table */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Quản lý Link Affiliate & Mã Sub_id ({links.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <th className="py-3 px-5 font-medium">Sản phẩm & Sàn</th>
                <th className="py-3 px-4 font-medium">Sub_id / Chế độ</th>
                <th className="py-3 px-4 font-medium">Tình trạng kho / Affiliate</th>
                <th className="py-3 px-4 font-medium text-right">Lượt nhấp</th>
                <th className="py-3 px-5 font-medium text-right">Sao chép link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {links.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-5 max-w-xs">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{l.productName}</p>
                    <p className="text-xs text-slate-500">
                      {l.platform} {l.promoExpiresAt ? `· Hết ưu đãi ${l.promoExpiresAt}` : ''}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <p className="font-mono-num font-semibold text-blue-700 dark:text-blue-400">{l.subId}</p>
                    <p className="text-slate-500">{l.trackingMode}</p>
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <select
                      aria-label={`Tình trạng hàng cho ${l.subId}`}
                      value={l.stockStatus}
                      onChange={(e) =>
                        handleStockChange(l, e.target.value as AffiliateLinkRecord['stockStatus'])
                      }
                      className={`rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium ${
                        l.stockStatus === 'Hết hàng' || l.stockStatus === 'Ngừng Affiliate'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <option value="Còn hàng">Còn hàng</option>
                      <option value="Sắp hết">Sắp hết</option>
                      <option value="Hết hàng">Hết hàng</option>
                      <option value="Ngừng Affiliate">Ngừng Affiliate</option>
                    </select>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono-num text-xs text-slate-700 dark:text-slate-300">
                    {l.clicks.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleCopy(l.id, l.trackingUrl)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {copiedId === l.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === l.id ? 'Đã chép' : 'Chép link'}</span>
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
