import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Loader2,
  Microscope,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { api } from '../services/api';
import type { ResearchRun } from '../lib/types';
import { formatDateTimeVN } from '../lib/format';
import { ActionableEmptyState } from '../components/ui/Primitives';

export function ResearchQueueView({
  runs,
  onRunUpdated,
  onRunCreated,
  onOpenProduct,
}: {
  runs: ResearchRun[];
  onRunUpdated: (run: ResearchRun) => void;
  onRunCreated: (run: ResearchRun) => void;
  onOpenProduct: (productId: string) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeStreams = useRef<Map<string, EventSource>>(new Map());

  // Subscribe to SSE progress streams for all queued/running jobs
  useEffect(() => {
    const activeIds = new Set(
      runs.filter((r) => r.status === 'queued' || r.status === 'running').map((r) => r.id),
    );

    for (const id of activeIds) {
      if (!activeStreams.current.has(id)) {
        const es = new EventSource(`/api/v1/research/runs/${id}/events`);
        es.onmessage = (evt) => {
          try {
            const updated = JSON.parse(evt.data) as ResearchRun;
            onRunUpdated(updated);
            if (updated.status === 'completed' || updated.status === 'failed') {
              es.close();
              activeStreams.current.delete(id);
            }
          } catch {
            // ignore parse error
          }
        };
        es.onerror = () => {
          es.close();
          activeStreams.current.delete(id);
        };
        activeStreams.current.set(id, es);
      }
    }

    return () => {
      // Keep open while mounted; cleanup on unmount below
    };
  }, [runs, onRunUpdated]);

  useEffect(() => {
    const map = activeStreams.current;
    return () => {
      map.forEach((es) => es.close());
      map.clear();
    };
  }, []);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!keyword.trim()) {
      setError('Vui lòng nhập tên sản phẩm hoặc từ khóa cần nghiên cứu sâu.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.startResearchRun({ keyword: keyword.trim() });
      onRunCreated(res.run);
      setKeyword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể khởi chạy tác vụ nghiên cứu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async (id: string) => {
    const res = await api.retryResearchRun(id);
    onRunUpdated(res.run);
  };

  return (
    <div className="space-y-6">
      {/* On-Demand Deep Research Trigger */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Chạy nghiên cứu sâu theo yêu cầu (Last30Days Global + CN + AI Pipeline 2)
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Hệ thống chỉ chạy nghiên cứu sâu khi bạn kích hoạt để tiết kiệm ngân sách token AI. Tiến trình được cập nhật trực tiếp theo thời gian thực qua SSE.
        </p>

        <form onSubmit={handleLaunch} className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Nhập tên sản phẩm hoặc từ khóa (VD: Máy ép chậm mini cầm tay, Bàn phím cơ low-profile...)"
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium whitespace-nowrap shrink-0"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Microscope className="w-4 h-4" />}
            <span>Chạy nghiên cứu sâu</span>
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </section>

      {/* Runs List with Real-time Stepper */}
      {runs.length === 0 ? (
        <ActionableEmptyState
          title="Chưa có phiên nghiên cứu sâu nào"
          description="Nhập tên sản phẩm ở khung phía trên hoặc chọn một chủ đề trong Trend Radar để chạy Last30Days Global & CN."
        />
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <article
              key={run.id}
              className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`font-semibold ${
                        run.status === 'completed'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : run.status === 'failed'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {run.status === 'completed'
                        ? 'Hoàn tất'
                        : run.status === 'failed'
                          ? 'Thất bại'
                          : run.status === 'running'
                            ? 'Đang chạy trực tiếp'
                            : 'Đang xếp hàng'}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="font-mono-num text-slate-400">{formatDateTimeVN(run.createdAt)}</span>
                    {run.tokensUsed > 0 && (
                      <>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="font-mono-num text-slate-500">
                          {run.tokensUsed.toLocaleString('vi-VN')} tokens
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                    {run.keyword}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {run.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => handleRetry(run.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Chạy lại</span>
                    </button>
                  )}
                  {run.productId && (
                    <button
                      type="button"
                      onClick={() => onOpenProduct(run.productId!)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                    >
                      <span>Mở hồ sơ 360°</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    run.status === 'failed'
                      ? 'bg-rose-500'
                      : run.status === 'completed'
                        ? 'bg-emerald-500'
                        : 'bg-blue-600'
                  }`}
                  style={{ width: `${run.progress}%` }}
                />
              </div>

              {/* 4-Step Live Progress Stepper */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {run.steps.map((st) => (
                  <div
                    key={st.step}
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800"
                  >
                    <div className="mt-0.5 shrink-0">
                      {st.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      {st.status === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      {st.status === 'running' && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                      {st.status === 'failed' && <XCircle className="w-4 h-4 text-rose-600" />}
                      {st.status === 'pending' && <Clock className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="min-w-0 text-xs">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{st.label}</p>
                      <p className="mt-0.5 text-slate-500 dark:text-slate-400">{st.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
