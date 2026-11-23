import type { AffiliateOrderRecord, CsvColumnMapping, MarketplacePlatform } from './types';

export interface ParsedRowValidation {
  rowIndex: number;
  valid: boolean;
  isDuplicate: boolean;
  error?: string;
  record?: Omit<AffiliateOrderRecord, 'id' | 'batchId'>;
}

export function parseVndAmount(raw: unknown): number | null {
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    return Math.round(raw);
  }
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .trim()
    .replace(/[₫đVNDvnd\s]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(/,/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.round(num) : null;
}

export function normalizeOrderStatus(
  raw: unknown,
): AffiliateOrderRecord['status'] {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s.includes('thực nhận') || s.includes('paid') || s.includes('settled') || s.includes('hoàn tất')) {
    return 'Thực nhận';
  }
  if (s.includes('đã duyệt') || s.includes('approved') || s.includes('completed') || s.includes('xác nhận')) {
    return 'Đã duyệt';
  }
  if (s.includes('hủy') || s.includes('cancel') || s.includes('invalid') || s.includes('trả hàng')) {
    return 'Đã hủy';
  }
  if (s.includes('chờ duyệt') || s.includes('pending') || s.includes('processing')) {
    return 'Chờ duyệt';
  }
  return 'Ghi nhận';
}

export function autoDetectColumnMapping(headers: string[]): CsvColumnMapping {
  const findCol = (patterns: RegExp[]) =>
    headers.find((h) => patterns.some((p) => p.test(h.trim().toLowerCase()))) ?? '';

  return {
    orderCode: findCol([/mã đơn|order[_\s-]?id|order[_\s-]?sn|order[_\s-]?code/]),
    productName: findCol([/tên sản phẩm|sản phẩm|product[_\s-]?name|item[_\s-]?name/]),
    orderValueVnd: findCol([/giá trị|tổng tiền|gmv|order[_\s-]?amount|order[_\s-]?value|doanh số/]),
    commissionVnd: findCol([/hoa hồng|commission|est.*comm|net.*comm/]),
    orderStatus: findCol([/trạng thái|status|order[_\s-]?status/]),
    subId: findCol([/sub[_\s-]?id|utm|tracking|kênh|chiến dịch/]),
    createdAt: findCol([/ngày|thời gian|created|date|order[_\s-]?time/]),
  };
}

export function validateMappedRows(
  rows: Record<string, unknown>[],
  mapping: CsvColumnMapping,
  platform: MarketplacePlatform,
  existingOrderCodes: Set<string>,
): ParsedRowValidation[] {
  const seenInBatch = new Set<string>();

  return rows.map((row, idx) => {
    const rowIndex = idx + 1;
    const orderCode = String(row[mapping.orderCode] ?? '').trim();
    const productName = String(row[mapping.productName] ?? '').trim();
    const orderValueVnd = parseVndAmount(row[mapping.orderValueVnd]);
    const commissionVnd = parseVndAmount(row[mapping.commissionVnd]);
    const rawStatus = row[mapping.orderStatus];
    const subId = mapping.subId ? String(row[mapping.subId] ?? '').trim() : '';
    const rawDate = mapping.createdAt ? String(row[mapping.createdAt] ?? '').trim() : '';

    if (!orderCode) {
      return { rowIndex, valid: false, isDuplicate: false, error: 'Thiếu Mã đơn hàng' };
    }
    if (!productName) {
      return { rowIndex, valid: false, isDuplicate: false, error: 'Thiếu Tên sản phẩm' };
    }
    if (orderValueVnd === null || orderValueVnd < 0) {
      return { rowIndex, valid: false, isDuplicate: false, error: 'Giá trị đơn không hợp lệ' };
    }
    if (commissionVnd === null || commissionVnd < 0) {
      return { rowIndex, valid: false, isDuplicate: false, error: 'Giá trị hoa hồng không hợp lệ' };
    }

    const dedupeKey = `${platform}:${orderCode}`;
    const isDuplicate = existingOrderCodes.has(dedupeKey) || seenInBatch.has(dedupeKey);
    seenInBatch.add(dedupeKey);

    let isoDate = new Date().toISOString();
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!Number.isNaN(parsed.getTime())) {
        isoDate = parsed.toISOString();
      }
    }

    return {
      rowIndex,
      valid: true,
      isDuplicate,
      error: isDuplicate ? `Trùng mã đơn ${orderCode} (sẽ bỏ qua khi nhập)` : undefined,
      record: {
        platform,
        orderCode,
        productName,
        subId: subId || 'unassigned',
        orderValueVnd,
        commissionVnd,
        status: normalizeOrderStatus(rawStatus),
        dataSource: 'Sàn xác nhận',
        createdAt: isoDate,
      },
    };
  });
}
