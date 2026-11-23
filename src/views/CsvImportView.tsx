import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Save,
  Upload,
} from 'lucide-react';
import { api } from '../services/api';
import {
  autoDetectColumnMapping,
  validateMappedRows,
} from '../lib/csvMapper';
import { formatVND } from '../lib/format';
import type {
  CsvColumnMapping,
  CsvImportPreset,
  MarketplacePlatform,
} from '../lib/types';

const SAMPLE_SHOPEE_ROWS: Record<string, unknown>[] = [
  {
    'Mã đơn hàng': '261122SP99A01',
    'Tên sản phẩm': 'Máy in nhiệt mini PeriPage A6 Pro 304dpi',
    'Giá trị đơn (VNĐ)': '449.000đ',
    'Hoa hồng (VNĐ)': '38.165đ',
    'Trạng thái': 'Thực nhận',
    'Sub_id': 'q4_printer_tt01',
    'Ngày tạo đơn': '2026-11-22',
  },
  {
    'Mã đơn hàng': '261122SP99A02',
    'Tên sản phẩm': 'Đế sạc không dây UGREEN Qi2 15W 3 trong 1',
    'Giá trị đơn (VNĐ)': '990.000đ',
    'Hoa hồng (VNĐ)': '79.200đ',
    'Trạng thái': 'Đã duyệt',
    'Sub_id': 'q4_qi2_desk02',
    'Ngày tạo đơn': '2026-11-22',
  },
  {
    'Mã đơn hàng': '261122SP99A03',
    'Tên sản phẩm': 'Máy in nhiệt mini PeriPage A6 Pro 304dpi',
    'Giá trị đơn (VNĐ)': '449.000đ',
    'Hoa hồng (VNĐ)': '38.165đ',
    'Trạng thái': 'Chờ duyệt',
    'Sub_id': 'q4_printer_tt01',
    'Ngày tạo đơn': '2026-11-22',
  },
];

const FIELD_DEFS: { key: keyof CsvColumnMapping; label: string; required?: boolean }[] = [
  { key: 'orderCode', label: 'Mã đơn hàng', required: true },
  { key: 'productName', label: 'Tên sản phẩm', required: true },
  { key: 'orderValueVnd', label: 'Giá trị đơn (VNĐ)', required: true },
  { key: 'commissionVnd', label: 'Hoa hồng (VNĐ)', required: true },
  { key: 'orderStatus', label: 'Trạng thái đơn' },
  { key: 'subId', label: 'Mã Sub_id / UTM' },
  { key: 'createdAt', label: 'Ngày tạo đơn' },
];

export function CsvImportView({
  onImportCommitted,
}: {
  onImportCommitted: () => void;
}) {
  const [platform, setPlatform] = useState<MarketplacePlatform>('Shopee');
  const [presets, setPresets] = useState<CsvImportPreset[]>([]);
  const [existingOrderKeys, setExistingOrderKeys] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<CsvColumnMapping>({
    orderCode: '',
    productName: '',
    orderValueVnd: '',
    commissionVnd: '',
    orderStatus: '',
    subId: '',
    createdAt: '',
  });
  const [presetName, setPresetName] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  const loadMeta = async () => {
    const meta = await api.getImportMeta();
    setPresets(meta.presets);
    setExistingOrderKeys(new Set(meta.existingOrderKeys));
  };

  useEffect(() => {
    void loadMeta();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setStatusMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const parsedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (parsedRows.length === 0) {
        setErrorMessage('Tệp báo cáo không có dòng dữ liệu nào.');
        return;
      }
      const cols = Object.keys(parsedRows[0]);
      setFileName(file.name);
      setHeaders(cols);
      setRows(parsedRows);
      setMapping(autoDetectColumnMapping(cols));
    } catch {
      setErrorMessage('Không thể đọc tệp CSV/XLSX. Vui lòng kiểm tra lại định dạng tệp.');
    }
  };

  const handleLoadSample = () => {
    setErrorMessage(null);
    setStatusMessage(null);
    const cols = Object.keys(SAMPLE_SHOPEE_ROWS[0]);
    setPlatform('Shopee');
    setFileName('bao_cao_shopee_affiliate_mau.csv');
    setHeaders(cols);
    setRows(SAMPLE_SHOPEE_ROWS);
    setMapping(autoDetectColumnMapping(cols));
  };

  const validations = useMemo(() => {
    if (rows.length === 0) return [];
    return validateMappedRows(rows, mapping, platform, existingOrderKeys);
  }, [rows, mapping, platform, existingOrderKeys]);

  const validNewRecords = useMemo(
    () => validations.filter((v) => v.valid && !v.isDuplicate && v.record).map((v) => v.record!),
    [validations],
  );
  const duplicateCount = validations.filter((v) => v.isDuplicate).length;
  const errorCount = validations.filter((v) => !v.valid).length;

  const handleApplyPreset = (presetId: string) => {
    const found = presets.find((p) => p.id === presetId);
    if (!found) return;
    setPlatform(found.platform);
    setMapping(found.mapping);
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    const res = await api.saveImportPreset({
      name: presetName.trim(),
      platform,
      mapping,
    });
    setPresets((prev) => [...prev, res.preset]);
    setPresetName('');
    setStatusMessage(`Đã lưu mẫu mapping "${res.preset.name}" cho các lần nhập sau.`);
  };

  const handleCommit = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    if (validNewRecords.length === 0) {
      setErrorMessage('Không có dòng hợp lệ mới nào để nhập (tất cả đều lỗi hoặc trùng mã đơn).');
      return;
    }
    setCommitting(true);
    try {
      const res = await api.commitImport(validNewRecords);
      setStatusMessage(res.message);
      await loadMeta();
      onImportCommitted();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Nhập dữ liệu thất bại.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Upload File & Platform Selection */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Bước 1 · Tải báo cáo xuất từ sàn Affiliate (CSV / XLSX)
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Luồng thay thế chuẩn khi Shopee/TikTok Shop/Lazada Open API chưa cấp quyền. Dữ liệu lỗi theo dòng sẽ được báo rõ và không làm hỏng dữ liệu đã nhập.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
            <span>Nạp file báo cáo mẫu Shopee</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <label className="space-y-1.5 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">Sàn xuất báo cáo</span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as MarketplacePlatform)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="Shopee">Shopee Affiliate VN</option>
              <option value="TikTok Shop">TikTok Shop Creator Center</option>
              <option value="Lazada">Lazada Affiliate VN</option>
            </select>
          </label>

          <label className="space-y-1.5 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">Áp dụng mẫu mapping đã lưu</span>
            <select
              onChange={(e) => handleApplyPreset(e.target.value)}
              defaultValue=""
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="">Tự động nhận diện cột</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-200">
            <Upload className="w-4 h-4 text-blue-600" />
            <span className="truncate">{fileName || 'Chọn file .csv hoặc .xlsx'}</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="sr-only"
            />
          </label>
        </div>
      </section>

      {/* Step 2: Column Mapping */}
      {headers.length > 0 && (
        <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Bước 2 · Ánh xạ cột (Column Mapping) — {rows.length} dòng trong tệp
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Tên mẫu mapping mới..."
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu preset</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {FIELD_DEFS.map((field) => (
              <label key={field.key} className="space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {field.label} {field.required ? '*' : ''}
                </span>
                <select
                  value={mapping[field.key]}
                  onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2"
                >
                  <option value="">-- Không chọn --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Step 3: 10-Row Validation Preview & Commit */}
      {validations.length > 0 && (
        <section className="rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs space-y-1">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Bước 3 · Xem trước 10 dòng đầu & Kiểm tra trùng lặp
              </h2>
              <p className="text-slate-500">
                Hợp lệ mới:{' '}
                <span className="font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                  {validNewRecords.length}
                </span>
                {' · '}
                Trùng mã đơn (tự bỏ qua):{' '}
                <span className="font-mono-num font-semibold text-amber-600">{duplicateCount}</span>
                {' · '}
                Dòng lỗi:{' '}
                <span className="font-mono-num font-semibold text-rose-600">{errorCount}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={handleCommit}
              disabled={committing || validNewRecords.length === 0}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium whitespace-nowrap"
            >
              {committing ? 'Đang nhập...' : `Nhập ${validNewRecords.length} đơn hợp lệ vào Doanh thu`}
            </button>
          </div>

          {statusMessage && (
            <div className="px-5 py-3 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="px-5 py-3 bg-rose-50/70 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 px-4 font-medium">Dòng</th>
                  <th className="py-2.5 px-4 font-medium">Mã đơn</th>
                  <th className="py-2.5 px-4 font-medium">Tên sản phẩm</th>
                  <th className="py-2.5 px-4 font-medium text-right">Giá trị đơn</th>
                  <th className="py-2.5 px-4 font-medium text-right">Hoa hồng</th>
                  <th className="py-2.5 px-4 font-medium">Trạng thái</th>
                  <th className="py-2.5 px-4 font-medium">Kiểm tra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {validations.slice(0, 10).map((v) => (
                  <tr key={v.rowIndex}>
                    <td className="py-2.5 px-4 font-mono-num text-slate-400">#{v.rowIndex}</td>
                    <td className="py-2.5 px-4 font-mono-num text-slate-900 dark:text-slate-100">
                      {v.record?.orderCode || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                      {v.record?.productName || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num">
                      {v.record ? formatVND(v.record.orderValueVnd) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                      {v.record ? formatVND(v.record.commissionVnd) : '—'}
                    </td>
                    <td className="py-2.5 px-4">{v.record?.status || '—'}</td>
                    <td className="py-2.5 px-4">
                      {!v.valid ? (
                        <span className="text-rose-600 dark:text-rose-400 font-medium">{v.error}</span>
                      ) : v.isDuplicate ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">{v.error}</span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">Hợp lệ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
