import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Plus } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../services/api';
import type { RevenueFunnelSummary } from '../lib/scoring';
import type { AffiliateOrderRecord, ExpenseRecord } from '../lib/types';
import { formatDateVN, formatVND } from '../lib/format';

export function AnalyticsView({
  funnel,
  orders,
  expenses,
  onExpenseAdded,
}: {
  funnel: RevenueFunnelSummary | null;
  orders: AffiliateOrderRecord[];
  expenses: ExpenseRecord[];
  onExpenseAdded: () => void;
}) {
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [category, setCategory] = useState<ExpenseRecord['category']>('Sản xuất nội dung');
  const [description, setDescription] = useState('');
  const [amountVnd, setAmountVnd] = useState('');
  const [expError, setExpError] = useState<string | null>(null);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpError(null);
    const val = Number(amountVnd);
    if (!description.trim() || !Number.isFinite(val) || val <= 0) {
      setExpError('Vui lòng nhập mô tả và số tiền > 0 VNĐ.');
      return;
    }
    try {
      await api.addExpense({ category, description: description.trim(), amountVnd: val });
      setDescription('');
      setAmountVnd('');
      setShowAddExpense(false);
      onExpenseAdded();
    } catch (err) {
      setExpError(err instanceof Error ? err.message : 'Không thể lưu chi phí.');
    }
  };

  const handleExportXlsx = () => {
    const sheetData = orders.map((o) => ({
      'Sàn': o.platform,
      'Mã đơn': o.orderCode,
      'Sản phẩm': o.productName,
      'Sub_id': o.subId,
      'Giá trị đơn (VNĐ)': o.orderValueVnd,
      'Hoa hồng (VNĐ)': o.commissionVnd,
      'Trạng thái': o.status,
      'Nguồn số liệu': o.dataSource,
      'Ngày tạo': formatDateVN(o.createdAt),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'DoanhThuAffiliate');
    XLSX.writeFile(wb, `trend-affiliate-revenue-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!funnel) return null;

  return (
    <div className="space-y-6">
      {/* 4 Strict Funnel KPI Cards (Never mixing Pending/Estimated into Realized) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5">
          <p className="text-xs font-medium text-slate-500">Hoa hồng thực nhận (Sàn xác nhận)</p>
          <p className="mt-2 text-2xl font-bold font-mono-num text-emerald-700 dark:text-emerald-400">
            {formatVND(funnel.realizedCommissionVnd)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Không gộp hoa hồng chờ duyệt hay ước tính
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5">
          <p className="text-xs font-medium text-slate-500">Chờ duyệt & Đã duyệt (Chưa chi trả)</p>
          <p className="mt-2 text-2xl font-bold font-mono-num text-amber-600 dark:text-amber-400">
            {formatVND(funnel.pendingCommissionVnd + funnel.approvedCommissionVnd)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono-num">
            Chờ duyệt: {formatVND(funnel.pendingCommissionVnd)} · Đã duyệt: {formatVND(funnel.approvedCommissionVnd)}
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5">
          <p className="text-xs font-medium text-slate-500">Chi phí vận hành (Người dùng nhập)</p>
          <p className="mt-2 text-2xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
            {formatVND(funnel.totalExpensesVnd)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {expenses.length} khoản chi mẫu, nội dung & quảng cáo
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5">
          <p className="text-xs font-medium text-slate-500">Lợi nhuận ròng thực nhận</p>
          <p
            className={`mt-2 text-2xl font-bold font-mono-num ${
              funnel.netProfitRealizedVnd >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatVND(funnel.netProfitRealizedVnd)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono-num">
            ROI thực nhận: {funnel.roiPercent !== null ? `${funnel.roiPercent}%` : 'Chưa có chi phí'}
          </p>
        </div>
      </section>

      {/* Funnel Conversion Strip + Actions */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Phễu chuyển đổi minh bạch & Phân bổ theo sàn
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Lượt nhấp: <span className="font-mono-num font-semibold">{funnel.totalClicks.toLocaleString('vi-VN')}</span>
              {' → '}Đơn ghi nhận: <span className="font-mono-num font-semibold">{funnel.recordedOrders}</span>
              {' → '}Đơn được duyệt/thực nhận: <span className="font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">{funnel.approvedOrders}</span>
              {' · '}Đã hủy: <span className="font-mono-num text-rose-600">{funnel.cancelledOrders}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportXlsx}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnel.byPlatform} margin={{ top: 8, right: 12, left: 12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
              <XAxis dataKey="platform" tick={{ fontSize: 12 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
              <Tooltip formatter={(val: unknown) => formatVND(Number(val))} contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="realizedCommissionVnd" name="Hoa hồng thực nhận" fill="#10B981" radius={[4, 4, 0, 0]} barSize={28} />
              <Bar dataKey="pendingCommissionVnd" name="Hoa hồng chờ duyệt" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Orders Ledger + Expenses Side-by-Side */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <section className="xl:col-span-8 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Sổ đối chiếu đơn hàng Affiliate ({orders.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 px-4 font-medium">Mã đơn / Sàn</th>
                  <th className="py-2.5 px-4 font-medium">Sản phẩm & Sub_id</th>
                  <th className="py-2.5 px-4 font-medium text-right">Hoa hồng</th>
                  <th className="py-2.5 px-4 font-medium">Trạng thái</th>
                  <th className="py-2.5 px-4 font-medium">Nguồn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {orders.slice(0, 20).map((o) => (
                  <tr key={o.id}>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <p className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">{o.orderCode}</p>
                      <p className="text-slate-400">{o.platform} · {formatDateVN(o.createdAt)}</p>
                    </td>
                    <td className="py-2.5 px-4 max-w-xs">
                      <p className="text-slate-800 dark:text-slate-200 truncate">{o.productName}</p>
                      <p className="font-mono-num text-slate-400">{o.subId}</p>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatVND(o.commissionVnd)}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={
                          o.status === 'Thực nhận'
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : o.status === 'Đã hủy'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                        }
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{o.dataSource}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="xl:col-span-4 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Chi phí triển khai</h3>
            <button
              type="button"
              onClick={() => setShowAddExpense((s) => !s)}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ghi chi phí</span>
            </button>
          </div>

          {showAddExpense && (
            <form onSubmit={handleAddExpense} className="space-y-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseRecord['category'])}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
              >
                <option value="Sản xuất nội dung">Sản xuất nội dung</option>
                <option value="Mẫu sản phẩm">Mẫu sản phẩm</option>
                <option value="Quảng cáo">Quảng cáo</option>
                <option value="Công cụ & AI">Công cụ & AI</option>
              </select>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả khoản chi *"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
              />
              <input
                type="number"
                value={amountVnd}
                onChange={(e) => setAmountVnd(e.target.value)}
                placeholder="Số tiền (VNĐ) *"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-mono-num"
              />
              {expError && <p className="text-rose-600">{expError}</p>}
              <button type="submit" className="w-full py-1.5 rounded-lg bg-blue-600 text-white font-medium">
                Lưu chi phí
              </button>
            </form>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {expenses.map((ex) => (
              <div key={ex.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{ex.description}</p>
                  <p className="text-slate-400">{ex.category} · {ex.spentAt}</p>
                </div>
                <span className="font-mono-num font-semibold text-slate-800 dark:text-slate-200 shrink-0">
                  {formatVND(ex.amountVnd)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
