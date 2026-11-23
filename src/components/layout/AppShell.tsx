import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Database,
  FileSpreadsheet,
  Flame,
  LayoutDashboard,
  Link2,
  Menu,
  Moon,
  Radar,
  Search,
  Settings,
  Sun,
  Target,
  X,
} from 'lucide-react';
import type { ViewId } from '../../lib/types';

interface NavGroup {
  label: string;
  items: { id: ViewId; label: string; Icon: React.ComponentType<{ className?: string }> }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Khám phá',
    items: [
      { id: 'overview', label: 'Tổng quan', Icon: LayoutDashboard },
      { id: 'trends', label: 'Trend Radar', Icon: Flame },
      { id: 'opportunities', label: 'Sản phẩm tiềm năng', Icon: Target },
    ],
  },
  {
    label: 'Nghiên cứu & Vận hành',
    items: [
      { id: 'research_queue', label: 'Hàng đợi nghiên cứu', Icon: Activity },
      { id: 'content_studio', label: 'Studio nội dung', Icon: Clapperboard },
      { id: 'content_calendar', label: 'Lịch nội dung', Icon: Calendar },
      { id: 'campaigns', label: 'Chiến dịch & Link', Icon: Link2 },
      { id: 'csv_import', label: 'Nhập CSV / XLSX', Icon: FileSpreadsheet },
      { id: 'analytics', label: 'Doanh thu & ROI', Icon: BarChart3 },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { id: 'data_sources', label: 'Nguồn dữ liệu', Icon: Database },
      { id: 'settings', label: 'Cài đặt AI & Hệ thống', Icon: Settings },
    ],
  },
];

const VIEW_TITLES: Record<ViewId, { section: string; title: string }> = {
  overview: { section: 'Khám phá', title: 'Tổng quan vận hành' },
  trends: { section: 'Khám phá', title: 'Trend Radar & Explorer' },
  opportunities: { section: 'Khám phá', title: 'Sản phẩm tiềm năng' },
  product_detail: { section: 'Sản phẩm tiềm năng', title: 'Hồ sơ nghiên cứu 360°' },
  research_queue: { section: 'Nghiên cứu & Vận hành', title: 'Hàng đợi nghiên cứu' },
  content_studio: { section: 'Nghiên cứu & Vận hành', title: 'Studio nội dung Affiliate' },
  content_calendar: { section: 'Nghiên cứu & Vận hành', title: 'Lịch nội dung' },
  campaigns: { section: 'Nghiên cứu & Vận hành', title: 'Chiến dịch & Link Affiliate' },
  csv_import: { section: 'Nghiên cứu & Vận hành', title: 'Nhập báo cáo CSV / XLSX' },
  analytics: { section: 'Nghiên cứu & Vận hành', title: 'Doanh thu & ROI' },
  data_sources: { section: 'Hệ thống', title: 'Nguồn dữ liệu & Sức khỏe' },
  settings: { section: 'Hệ thống', title: 'Cài đặt AI & Hệ thống' },
};

export function AppShell({
  activeView,
  onNavigate,
  darkMode,
  onToggleDarkMode,
  onOpenCommandPalette,
  primaryAction,
  children,
}: {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenCommandPalette: () => void;
  primaryAction?: { label: string; mobileLabel?: string; onClick: () => void; loading?: boolean };
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const breadcrumb = VIEW_TITLES[activeView];

  const handleNavClick = (id: ViewId) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#0B1120] text-[#0F172A] dark:text-[#F8FAFC]">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111827] transition-all duration-200 ${
          collapsed ? 'w-[72px]' : 'w-[252px]'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B]">
          <button
            type="button"
            onClick={() => handleNavClick('overview')}
            className="flex items-center gap-2.5 min-w-0 text-left focus-visible:outline-none"
          >
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Radar className="w-4 h-4" />
            </span>
            {!collapsed && (
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap truncate">
                Trend Affiliate Radar
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Điều hướng chính">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-2.5 mb-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map(({ id, label, Icon }) => {
                  const isActive =
                    activeView === id || (id === 'opportunities' && activeView === 'product_detail');
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => handleNavClick(id)}
                        title={collapsed ? label : undefined}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {!collapsed && <span className="truncate">{label}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-[#E2E8F0] dark:border-[#1E293B]">
          {!collapsed ? (
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-2">
              <span>Thị trường VN</span>
              <span className="font-mono-num">UTC+7</span>
            </div>
          ) : (
            <div className="text-center text-[11px] font-mono-num text-slate-400">VN</div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-white dark:bg-[#111827] h-full flex flex-col border-r border-slate-200 dark:border-slate-800">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Radar className="w-4 h-4" />
                </span>
                <span className="font-bold text-sm">Trend Affiliate Radar</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Đóng menu"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-5">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="px-2.5 mb-1.5 text-[11px] font-semibold text-slate-400">{group.label}</p>
                  <ul className="space-y-1">
                    {group.items.map(({ id, label, Icon }) => {
                      const isActive = activeView === id;
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => handleNavClick(id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm ${
                              isActive
                                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-semibold'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-14 lg:h-16 bg-white/95 dark:bg-[#111827]/95 backdrop-blur border-b border-[#E2E8F0] dark:border-[#1E293B] px-4 lg:px-6 flex items-center justify-between gap-4">
          {/* Left: Mobile Menu + Contextual Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Mở menu điều hướng"
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400 dark:text-slate-500 whitespace-nowrap">
                {breadcrumb.section}
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm sm:text-base">
                {breadcrumb.title}
              </h1>
            </div>
          </div>

          {/* Right: Command Palette, Theme Toggle, Single Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              aria-label="Tìm kiếm nhanh (Ctrl+K)"
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Tìm xu hướng, sản phẩm...</span>
              <kbd className="hidden sm:inline font-mono-num text-[11px] text-slate-400">Ctrl K</kbd>
            </button>

            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              title="Đổi chế độ Sáng / Tối (Phím D)"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {primaryAction && (
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={primaryAction.loading}
                className="px-2.5 sm:px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0"
              >
                {primaryAction.loading ? 'Đang chạy...' : (
                  <>
                    <span className="sm:hidden">{primaryAction.mobileLabel ?? primaryAction.label}</span>
                    <span className="hidden sm:inline">{primaryAction.label}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
