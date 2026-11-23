import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoDetectColumnMapping,
  normalizeOrderStatus,
  parseVndAmount,
  validateMappedRows,
} from './csvMapper';

test('parseVndAmount handles Vietnamese formatted currency strings and numbers', () => {
  assert.equal(parseVndAmount('329.000 đ'), 329000);
  assert.equal(parseVndAmount('1,250,000 VND'), 1250000);
  assert.equal(parseVndAmount(85000), 85000);
  assert.equal(parseVndAmount('không hợp lệ'), null);
});

test('autoDetectColumnMapping identifies Vietnamese Shopee/TikTok Affiliate headers', () => {
  const headers = [
    'Mã đơn hàng',
    'Tên sản phẩm',
    'Giá trị đơn (VNĐ)',
    'Hoa hồng thực nhận',
    'Trạng thái đơn',
    'Sub_id',
    'Ngày tạo',
  ];
  const mapping = autoDetectColumnMapping(headers);
  assert.equal(mapping.orderCode, 'Mã đơn hàng');
  assert.equal(mapping.productName, 'Tên sản phẩm');
  assert.equal(mapping.orderValueVnd, 'Giá trị đơn (VNĐ)');
  assert.equal(mapping.commissionVnd, 'Hoa hồng thực nhận');
  assert.equal(mapping.orderStatus, 'Trạng thái đơn');
  assert.equal(mapping.subId, 'Sub_id');
  assert.equal(mapping.createdAt, 'Ngày tạo');
});

test('validateMappedRows catches missing fields and duplicate order codes without corrupting valid rows', () => {
  const headers = ['Mã đơn', 'Tên sản phẩm', 'Giá trị', 'Hoa hồng', 'Trạng thái', 'Sub_id', 'Ngày'];
  const mapping = autoDetectColumnMapping(headers);
  const rows = [
    { 'Mã đơn': 'SP-1001', 'Tên sản phẩm': 'Máy in mini', 'Giá trị': '329.000đ', 'Hoa hồng': '31.255đ', 'Trạng thái': 'Thực nhận', 'Sub_id': 'tt_vid01', 'Ngày': '2026-11-20' },
    { 'Mã đơn': 'SP-1001', 'Tên sản phẩm': 'Máy in mini', 'Giá trị': '329.000đ', 'Hoa hồng': '31.255đ', 'Trạng thái': 'Thực nhận', 'Sub_id': 'tt_vid01', 'Ngày': '2026-11-20' },
    { 'Mã đơn': '', 'Tên sản phẩm': 'Thiếu mã', 'Giá trị': '100000', 'Hoa hồng': '5000', 'Trạng thái': 'Chờ duyệt', 'Sub_id': '', 'Ngày': '2026-11-20' },
  ];
  const existing = new Set<string>(['Shopee:SP-0999']);
  const results = validateMappedRows(rows, mapping, 'Shopee', existing);

  assert.equal(results[0].valid, true);
  assert.equal(results[0].isDuplicate, false);
  assert.equal(results[0].record?.commissionVnd, 31255);
  assert.equal(results[0].record?.status, 'Thực nhận');

  assert.equal(results[1].valid, true);
  assert.equal(results[1].isDuplicate, true);

  assert.equal(results[2].valid, false);
  assert.ok(results[2].error?.includes('Thiếu Mã đơn'));
});

test('normalizeOrderStatus maps Vietnamese and English marketplace statuses', () => {
  assert.equal(normalizeOrderStatus('Settled / Paid'), 'Thực nhận');
  assert.equal(normalizeOrderStatus('Approved'), 'Đã duyệt');
  assert.equal(normalizeOrderStatus('Cancelled'), 'Đã hủy');
  assert.equal(normalizeOrderStatus('Pending'), 'Chờ duyệt');
});
