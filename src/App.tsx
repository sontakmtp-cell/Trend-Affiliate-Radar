/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type OverviewResponse } from './services/api';
import type { RevenueFunnelSummary } from './lib/scoring';
import type {
  AffiliateLinkRecord,
  AffiliateOrderRecord,
  AiUsageSummary,
  AppSettings,
  CampaignRecord,
  ContentAsset,
  DataSourceRecord,
  ExpenseRecord,
  OpportunityScoreResult,
  ProductRecord,
  ResearchRun,
  TrendTopic,
  ViewId,
} from './lib/types';
import { AppShell } from './components/layout/AppShell';
import { CommandPalette } from './components/CommandPalette';
import { OnboardingWizard } from './components/OnboardingWizard';
import { TrendDrawer } from './components/TrendDrawer';
import { OverviewView } from './views/OverviewView';
import { TrendRadarView } from './views/TrendRadarView';
import { OpportunitiesView } from './views/OpportunitiesView';
import { ProductDetailView } from './views/ProductDetailView';
import { ResearchQueueView } from './views/ResearchQueueView';
import { ContentStudioView } from './views/ContentStudioView';
import { ContentCalendarView } from './views/ContentCalendarView';
import { CampaignsView } from './views/CampaignsView';
import { CsvImportView } from './views/CsvImportView';
import { AnalyticsView } from './views/AnalyticsView';
import { DataSourcesView } from './views/DataSourcesView';
import { SettingsView } from './views/SettingsView';

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>('overview');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('tar_theme') === 'dark';
  });

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [trends, setTrends] = useState<TrendTopic[]>([]);
  const [products, setProducts] = useState<{ product: ProductRecord; scoring: OpportunityScoreResult }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [researchRuns, setResearchRuns] = useState<ResearchRun[]>([]);
  const [sources, setSources] = useState<DataSourceRecord[]>([]);
  const [trendRadarConfig, setTrendRadarConfig] = useState({ configYaml: '', frequencyWords: '' });
  const [contentAssets, setContentAssets] = useState<ContentAsset[]>([]);
  const [studioProductId, setStudioProductId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLinkRecord[]>([]);
  const [analytics, setAnalytics] = useState<{
    funnel: RevenueFunnelSummary | null;
    orders: AffiliateOrderRecord[];
    expenses: ExpenseRecord[];
  }>({ funnel: null, orders: [], expenses: [] });
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsageSummary | null>(null);

  const [cmdOpen, setCmdOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [drawerTrend, setDrawerTrend] = useState<TrendTopic | null>(null);
  const [drawerProduct, setDrawerProduct] = useState<{
    product: ProductRecord;
    scoring: OpportunityScoreResult;
  } | null>(null);
  const [syncingTrends, setSyncingTrends] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Sync Tailwind dark class
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
    window.localStorage.setItem('tar_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const loadAllData = useCallback(async (isInitial = false) => {
    try {
      const [ov, tr, pr, runs, src, cnt, cmp, ana, setRes] = await Promise.all([
        api.getOverview(),
        api.getTrends(),
        api.getProducts(),
        api.getResearchRuns(),
        api.getSources(),
        api.getContentAssets(),
        api.getCampaigns(),
        api.getAnalytics(),
        api.getSettings(),
      ]);

      setOverview(ov);
      setTrends(tr.items);
      setProducts(pr.items);
      setResearchRuns(runs.items);
      setSources(src.sources);
      setTrendRadarConfig(src.trendRadarConfig);
      setContentAssets(cnt.items);
      setCampaigns(cmp.campaigns);
      setAffiliateLinks(cmp.links);
      setAnalytics(ana);
      setSettings(setRes.settings);
      setAiUsage(setRes.aiUsage);

      if (isInitial) {
        const params = new URLSearchParams(window.location.search);
        const autostart = params.get('autostart') === '1';
        if (!setRes.settings.onboardingCompleted && !autostart) {
          setShowOnboarding(true);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllData(true);
  }, [loadAllData]);

  // Global keyboard shortcuts: Ctrl+K, /, Esc, D (Dark/Light toggle)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setCmdOpen(false);
        setDrawerTrend(null);
        setDrawerProduct(null);
        return;
      }
      if (!isTyping && e.key === '/') {
        e.preventDefault();
        setCmdOpen(true);
        return;
      }
      if (!isTyping && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'd') {
        setDarkMode((d) => !d);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSyncTrends = async () => {
    setSyncingTrends(true);
    setSyncNotice(null);
    try {
      const res = await api.syncTrends();
      setSyncNotice(res.message);
      await loadAllData(false);
    } catch (err) {
      setSyncNotice(err instanceof Error ? err.message : 'Đồng bộ tín hiệu thất bại.');
    } finally {
      setSyncingTrends(false);
    }
  };

  const handleDismissTrend = async (trendId: string) => {
    await api.dismissTrend(trendId);
    setTrends((prev) => prev.filter((t) => t.id !== trendId));
    void loadAllData(false);
  };

  const handleStartResearch = async (keyword: string, trendId?: string) => {
    const res = await api.startResearchRun({ keyword, trendId });
    setResearchRuns((prev) => [res.run, ...prev]);
    setActiveView('research_queue');
  };

  const handleOpenProduct = (productId: string) => {
    setSelectedProductId(productId);
    setActiveView('product_detail');
  };

  const handleRunUpdated = useCallback((updated: ResearchRun) => {
    setResearchRuns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (updated.status === 'completed') {
      void loadAllData(false);
    }
  }, [loadAllData]);

  const selectedProductBundle = useMemo(
    () => products.find((p) => p.product.id === selectedProductId) ?? products[0] ?? null,
    [products, selectedProductId],
  );

  const primaryAction = useMemo(() => {
    if (activeView === 'overview' || activeView === 'trends') {
      return {
        label: 'Đồng bộ TrendRadar',
        mobileLabel: 'Đồng bộ',
        onClick: () => void handleSyncTrends(),
        loading: syncingTrends,
      };
    }
    if (activeView === 'opportunities') {
      return {
        label: 'Nghiên cứu sản phẩm mới',
        mobileLabel: 'Nghiên cứu',
        onClick: () => setActiveView('research_queue'),
      };
    }
    if (activeView === 'analytics') {
      return {
        label: 'Nhập báo cáo CSV/XLSX',
        mobileLabel: 'Nhập CSV',
        onClick: () => setActiveView('csv_import'),
      };
    }
    return undefined;
  }, [activeView, syncingTrends]);

  const rawProductsList = useMemo(() => products.map((p) => p.product), [products]);

  return (
    <>
      <AppShell
        activeView={activeView}
        onNavigate={(v) => setActiveView(v)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        onOpenCommandPalette={() => setCmdOpen(true)}
        primaryAction={primaryAction}
      >
        {activeView === 'overview' && (
          <OverviewView
            data={overview}
            loading={loading}
            onNavigate={setActiveView}
            onOpenProduct={handleOpenProduct}
            onInspectTrend={(t) => {
              setDrawerProduct(
                t.linkedProductId
                  ? products.find((p) => p.product.id === t.linkedProductId) ?? null
                  : null,
              );
              setDrawerTrend(t);
            }}
            onSyncTrends={() => void handleSyncTrends()}
            syncing={syncingTrends}
          />
        )}

        {activeView === 'trends' && (
          <TrendRadarView
            trends={trends}
            syncing={syncingTrends}
            syncNotice={syncNotice}
            onSync={() => void handleSyncTrends()}
            onSelectTrend={(t) => {
              setDrawerProduct(
                t.linkedProductId
                  ? products.find((p) => p.product.id === t.linkedProductId) ?? null
                  : null,
              );
              setDrawerTrend(t);
            }}
            onStartResearch={(kw, tid) => void handleStartResearch(kw, tid)}
          />
        )}

        {activeView === 'opportunities' && (
          <OpportunitiesView
            items={products}
            onOpenProduct={handleOpenProduct}
            onInspectProduct={(bundle) => {
              setDrawerTrend(null);
              setDrawerProduct(bundle);
            }}
            onGoToResearch={() => setActiveView('research_queue')}
          />
        )}

        {activeView === 'product_detail' && selectedProductBundle && (
          <ProductDetailView
            product={selectedProductBundle.product}
            scoring={selectedProductBundle.scoring}
            onBack={() => setActiveView('opportunities')}
            onUpdated={(updatedProduct, updatedScoring) => {
              setProducts((prev) =>
                prev.map((item) =>
                  item.product.id === updatedProduct.id
                    ? { product: updatedProduct, scoring: updatedScoring }
                    : item,
                ),
              );
              void loadAllData(false);
            }}
            onCreateContent={(pid) => {
              setStudioProductId(pid);
              setActiveView('content_studio');
            }}
          />
        )}

        {activeView === 'research_queue' && (
          <ResearchQueueView
            runs={researchRuns}
            onRunUpdated={handleRunUpdated}
            onRunCreated={(run) => setResearchRuns((prev) => [run, ...prev])}
            onOpenProduct={handleOpenProduct}
          />
        )}

        {activeView === 'content_studio' && (
          <ContentStudioView
            products={rawProductsList}
            assets={contentAssets}
            initialProductId={studioProductId}
            onAssetCreated={(asset) => setContentAssets((prev) => [asset, ...prev])}
            onAssetUpdated={(asset) =>
              setContentAssets((prev) => prev.map((a) => (a.id === asset.id ? asset : a)))
            }
            onNavigateCalendar={() => setActiveView('content_calendar')}
          />
        )}

        {activeView === 'content_calendar' && (
          <ContentCalendarView
            assets={contentAssets}
            products={rawProductsList}
            onAssetCreated={(asset) => setContentAssets((prev) => [asset, ...prev])}
            onAssetUpdated={(asset) =>
              setContentAssets((prev) => prev.map((a) => (a.id === asset.id ? asset : a)))
            }
          />
        )}

        {activeView === 'campaigns' && settings && (
          <CampaignsView
            campaigns={campaigns}
            links={affiliateLinks}
            products={rawProductsList}
            settings={settings}
            onCampaignCreated={(c) => setCampaigns((prev) => [c, ...prev])}
            onLinkCreated={(l) => setAffiliateLinks((prev) => [l, ...prev])}
            onLinkUpdated={(l) =>
              setAffiliateLinks((prev) => prev.map((item) => (item.id === l.id ? l : item)))
            }
          />
        )}

        {activeView === 'csv_import' && (
          <CsvImportView onImportCommitted={() => void loadAllData(false)} />
        )}

        {activeView === 'analytics' && (
          <AnalyticsView
            funnel={analytics.funnel}
            orders={analytics.orders}
            expenses={analytics.expenses}
            onExpenseAdded={() => void loadAllData(false)}
          />
        )}

        {activeView === 'data_sources' && settings && (
          <DataSourcesView
            sources={sources}
            trendRadarConfig={trendRadarConfig}
            settings={settings}
            onSourceUpdated={(src) =>
              setSources((prev) => prev.map((s) => (s.id === src.id ? src : s)))
            }
            onSettingsUpdated={(updated) => setSettings(updated)}
          />
        )}

        {activeView === 'settings' && settings && aiUsage && (
          <SettingsView
            settings={settings}
            aiUsage={aiUsage}
            onSettingsSaved={(updated) => {
              setSettings(updated);
              void loadAllData(false);
            }}
            onReopenOnboarding={() => setShowOnboarding(true)}
          />
        )}
      </AppShell>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        trends={trends}
        products={rawProductsList}
        onSelectView={setActiveView}
        onSelectTrend={(t) => {
          setDrawerProduct(
            t.linkedProductId
              ? products.find((p) => p.product.id === t.linkedProductId) ?? null
              : null,
          );
          setDrawerTrend(t);
        }}
        onSelectProduct={handleOpenProduct}
      />

      <TrendDrawer
        trend={drawerTrend}
        productBundle={drawerProduct}
        onClose={() => {
          setDrawerTrend(null);
          setDrawerProduct(null);
        }}
        onStartResearch={(kw, tid) => void handleStartResearch(kw, tid)}
        onOpenProduct={handleOpenProduct}
        onDismissTrend={(tid) => void handleDismissTrend(tid)}
      />

      {showOnboarding && settings && (
        <OnboardingWizard
          settings={settings}
          sources={sources}
          onComplete={(updated) => {
            setSettings(updated);
            setShowOnboarding(false);
          }}
          onSkip={() => {
            setShowOnboarding(false);
            void api.updateSettings({ onboardingCompleted: true }).then((r) => setSettings(r.settings));
          }}
        />
      )}
    </>
  );
}
