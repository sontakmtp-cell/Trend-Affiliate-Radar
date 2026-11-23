import React, { useState } from 'react';
import { Calendar as CalendarIcon, Columns, Plus } from 'lucide-react';
import { api } from '../services/api';
import type { ContentAsset, ContentStatus, ProductRecord } from '../lib/types';

const STATUS_COLUMNS: { id: ContentStatus; label: string }[] = [
  { id: 'Idea', label: 'Ý tưởng (Idea)' },
  { id: 'Draft', label: 'Bản nháp (Draft)' },
  { id: 'Review', label: 'Chờ duyệt (Review)' },
  { id: 'Approved', label: 'Đã duyệt (Approved)' },
  { id: 'Scheduled', label: 'Đã lên lịch' },
  { id: 'Published', label: 'Đã đăng (Published)' },
];

export function ContentCalendarView({
  assets,
  products,
  onAssetCreated,
  onAssetUpdated,
}: {
  assets: ContentAsset[];
  products: ProductRecord[];
  onAssetCreated: (asset: ContentAsset) => void;
  onAssetUpdated: (asset: ContentAsset) => void;
}) {
  const [mode, setMode] = useState<'kanban' | 'calendar'>('kanban');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [platform, setPlatform] = useState<ContentAsset['platform']>('TikTok');

  const handleMoveStatus = async (asset: ContentAsset, status: ContentStatus) => {
    const res = await api.updateContentAsset(asset.id, { status });
    onAssetUpdated(res.asset);
  };

  const handleDateChange = async (asset: ContentAsset, newDate: string) => {
    const res = await api.updateContentAsset(asset.id, { scheduledDate: newDate });
    onAssetUpdated(res.asset);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !productId) return;
    const prod = products.find((p) => p.id === productId);
    const res = await api.createContentAsset({
      title: title.trim(),
      productId,
      productName: prod?.nameVi || 'Sản phẩm',
      platform,
      durationSec: 30,
      status: 'Idea',
      scheduledDate,
    });
    onAssetCreated(res.asset);
    setTitle('');
    setShowQuickAdd(false);
  };

  // Build 14-day schedule timeline for Calendar mode
  const calendarDays = Array.from({ length: 14 }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() + idx - 2);
    const iso = d.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    }).format(d);
    return { iso, label, items: assets.filter((a) => a.scheduledDate === iso) };
  });

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
          <button
            type="button"
            onClick={() => setMode('kanban')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
              mode === 'kanban'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Bảng Kanban</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('calendar')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
              mode === 'calendar'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Lịch 2 tuần</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowQuickAdd((s) => !s)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm ý tưởng / lịch đăng</span>
        </button>
      </div>

      {showQuickAdd && (
        <form
          onSubmit={handleQuickAdd}
          className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề video / bài review *"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm md:col-span-2"
          />
          <select
            aria-label="Chọn sản phẩm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameVi}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 font-mono-num"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium whitespace-nowrap"
            >
              Lưu
            </button>
          </div>
          <div className="md:col-span-4 flex items-center gap-3 text-slate-500">
            <span>Kênh đăng:</span>
            {(['TikTok', 'Shopee Video', 'Reels', 'YouTube Shorts'] as const).map((pl) => (
              <button
                key={pl}
                type="button"
                onClick={() => setPlatform(pl)}
                className={`px-2 py-1 rounded ${
                  platform === pl ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-semibold' : ''
                }`}
              >
                {pl}
              </button>
            ))}
          </div>
        </form>
      )}

      {mode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 items-start">
          {STATUS_COLUMNS.map((col) => {
            const colItems = assets.filter((a) => a.status === col.id);
            return (
              <div
                key={col.id}
                className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-3 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">{col.label}</h3>
                  <span className="font-mono-num text-xs text-slate-400">{colItems.length}</span>
                </div>

                <div className="space-y-2.5 min-h-[120px]">
                  {colItems.length === 0 ? (
                    <p className="text-[11px] text-slate-400 py-6 text-center">Trống</p>
                  ) : (
                    colItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-2"
                      >
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.platform} · {item.durationSec}s
                        </p>
                        <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800 space-y-1.5">
                          <select
                            aria-label={`Chuyển trạng thái cho ${item.title}`}
                            value={item.status}
                            onChange={(e) => handleMoveStatus(item, e.target.value as ContentStatus)}
                            className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px]"
                          >
                            {STATUS_COLUMNS.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            aria-label={`Ngày đăng dự kiến cho ${item.title}`}
                            value={item.scheduledDate || ''}
                            onChange={(e) => handleDateChange(item, e.target.value)}
                            className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] font-mono-num"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {calendarDays.map((day) => (
            <div
              key={day.iso}
              className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-3 min-h-[140px] flex flex-col"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{day.label}</span>
                <span className="font-mono-num text-[11px] text-slate-400">{day.items.length}</span>
              </div>
              <div className="mt-2 space-y-2 flex-1">
                {day.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 text-[11px]"
                  >
                    <p className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      {item.platform} · {item.status}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
