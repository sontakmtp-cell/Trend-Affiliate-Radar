import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  Info,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type {
  OpportunityScoreResult,
  OpportunityTier,
  RetrievalMode,
  SourceHealthStatus,
  VerificationStatus,
} from '../../lib/types';
import { formatDateTimeVN, sanitizeExternalUrl } from '../../lib/format';

export function ScoreRing({
  scoring,
  compact = false,
  onFillMissing,
}: {
  scoring: OpportunityScoreResult;
  compact?: boolean;
  onFillMissing?: () => void;
}) {
  const [showMissing, setShowMissing] = useState(false);
  const size = compact ? 44 : 76;
  const stroke = compact ? 4 : 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = scoring.score ?? 0;
  const offset = circumference - (value / 100) * circumference;

  const ringColor =
    scoring.score === null
      ? 'stroke-slate-300 dark:stroke-slate-700'
      : scoring.tier === 'Ưu tiên cao'
        ? 'stroke-emerald-500'
        : scoring.tier === 'Chờ xác minh'
          ? 'stroke-amber-500'
          : scoring.score >= 65
            ? 'stroke-blue-600'
            : 'stroke-slate-400';

  return (
    <div className="relative flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-slate-200 dark:stroke-slate-800"
          />
          {scoring.score !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={`${ringColor} transition-all duration-300`}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono-num font-semibold text-slate-900 dark:text-slate-100 ${
              compact ? 'text-xs' : 'text-lg'
            }`}
          >
            {scoring.score !== null ? scoring.score : '—'}
          </span>
          {!compact && <span className="text-[10px] text-slate-500 dark:text-slate-400">/100</span>}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-600 dark:text-slate-400">Độ đầy đủ</span>
          <span className="font-mono-num font-medium text-slate-900 dark:text-slate-100">
            {scoring.dataCompleteness}%
          </span>
          {scoring.isProvisional && (
            <button
              type="button"
              onClick={() => setShowMissing((s) => !s)}
              className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium hover:underline whitespace-nowrap"
              title="Xem các tiêu chí còn thiếu dữ liệu"
            >
              <span>Tạm tính</span>
              <Info className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="mt-1.5 h-1.5 w-full max-w-[140px] rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              scoring.dataCompleteness === 100
                ? 'bg-emerald-500'
                : scoring.dataCompleteness >= 70
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
            }`}
            style={{ width: `${scoring.dataCompleteness}%` }}
          />
        </div>
        {showMissing && scoring.missingCriteria.length > 0 && (
          <div className="mt-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs shadow-sm">
            <p className="font-medium text-slate-900 dark:text-slate-100">
              Thiếu dữ liệu ({scoring.missingCriteria.length} tiêu chí):
            </p>
            <ul className="mt-1 space-y-0.5 text-slate-600 dark:text-slate-400 list-disc pl-4">
              {scoring.missingCriteria.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            {onFillMissing && (
              <button
                type="button"
                onClick={onFillMissing}
                className="mt-2 text-blue-600 dark:text-blue-400 font-medium hover:underline"
              >
                Bổ sung xác minh ngay →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const EVIDENCE_META: Record<
  VerificationStatus,
  { label: string; colorClass: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  verified_fact: {
    label: 'Đã xác minh',
    colorClass: 'text-emerald-700 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
  ai_inference: {
    label: 'AI suy luận',
    colorClass: 'text-amber-700 dark:text-amber-400',
    Icon: Sparkles,
  },
  unknown: {
    label: 'Chưa có dữ liệu',
    colorClass: 'text-slate-500 dark:text-slate-400',
    Icon: HelpCircle,
  },
  outdated: {
    label: 'Quá hạn',
    colorClass: 'text-rose-600 dark:text-rose-400',
    Icon: Clock,
  },
};

const RETRIEVAL_LABELS: Record<RetrievalMode, string> = {
  authenticated: 'Thu thập xác thực (Độ tin cậy cao)',
  hotboard_match: 'Khớp bảng xu hướng (Hotboard)',
  public_search: 'Tìm kiếm công khai (Giảm trọng số tin cậy)',
  manual: 'Người vận hành xác minh thủ công',
};

export function EvidenceTag({
  status,
  sourceName,
  sourceUrl,
  recordedAt,
  retrievalMode,
  note,
}: {
  status: VerificationStatus;
  sourceName?: string;
  sourceUrl?: string;
  recordedAt?: string;
  retrievalMode?: RetrievalMode;
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  const meta = EVIDENCE_META[status];
  const Icon = meta.Icon;
  const safeHref = sanitizeExternalUrl(sourceUrl);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`inline-flex items-center gap-1 text-xs font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded whitespace-nowrap ${meta.colorClass}`}
        aria-expanded={open}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{meta.label}</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-40 w-72 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 shadow-lg text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${meta.colorClass}`}>
              <Icon className="w-3.5 h-3.5" />
              {meta.label}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              Đóng
            </button>
          </div>
          <div className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            {sourceName && (
              <div>
                <span className="text-slate-400">Nguồn: </span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{sourceName}</span>
              </div>
            )}
            {retrievalMode && (
              <div>
                <span className="text-slate-400">Chế độ: </span>
                <span>{RETRIEVAL_LABELS[retrievalMode]}</span>
              </div>
            )}
            {recordedAt && (
              <div>
                <span className="text-slate-400">Ghi nhận: </span>
                <span className="font-mono-num">{formatDateTimeVN(recordedAt)}</span>
              </div>
            )}
            {note && <p className="text-slate-500 dark:text-slate-400 pt-1">{note}</p>}
            {safeHref && (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 pt-1 text-blue-600 dark:text-blue-400 font-medium hover:underline"
              >
                <span>Mở URL nguồn gốc</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

export function TierLabel({ tier }: { tier: OpportunityTier }) {
  const styles: Record<OpportunityTier, string> = {
    'Ưu tiên cao': 'text-emerald-700 dark:text-emerald-400 font-semibold',
    'Nghiên cứu thêm': 'text-blue-700 dark:text-blue-400 font-medium',
    'Theo dõi': 'text-slate-700 dark:text-slate-300 font-medium',
    'Ưu tiên thấp': 'text-slate-500 dark:text-slate-400',
    'Chờ xác minh': 'text-amber-700 dark:text-amber-400 font-semibold',
  };
  return <span className={`text-xs whitespace-nowrap ${styles[tier]}`}>{tier}</span>;
}

export function SourceStatusIndicator({ status }: { status: SourceHealthStatus }) {
  const map: Record<
    SourceHealthStatus,
    { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    Healthy: { label: 'Hoạt động tốt', color: 'text-emerald-700 dark:text-emerald-400', Icon: CheckCircle2 },
    Degraded: { label: 'Chế độ công khai', color: 'text-amber-700 dark:text-amber-400', Icon: AlertTriangle },
    'Auth Required': { label: 'Cần xác thực', color: 'text-amber-700 dark:text-amber-400', Icon: AlertTriangle },
    'Rate Limited': { label: 'Giới hạn tốc độ', color: 'text-rose-600 dark:text-rose-400', Icon: AlertTriangle },
    Unavailable: { label: 'Không khả dụng', color: 'text-rose-600 dark:text-rose-400', Icon: XCircle },
    'Not Configured': { label: 'Chờ cấu hình', color: 'text-slate-500 dark:text-slate-400', Icon: HelpCircle },
  };
  const { label, color, Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

export function Sparkline({ data, positive = true }: { data: number[]; positive?: boolean }) {
  if (!data || data.length < 2) return <span className="text-xs text-slate-400">—</span>;
  const width = 76;
  const height = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <polyline
        fill="none"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className={positive ? 'stroke-emerald-500' : 'stroke-rose-500'}
      />
    </svg>
  );
}

export function ActionableEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
