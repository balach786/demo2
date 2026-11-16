import { useMemo, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Sparkles, Users, ListTree, ArrowLeftRight, BookOpen, Landmark,
  Receipt, FileBarChart, Files, ShieldCheck, Settings as SettingsIcon, Menu, X,
  RotateCcw, CalendarRange, ChevronRight, Search, Clock, Ship, Send, Boxes, Coins,
} from 'lucide-react';
import { useRange, useStore } from '../demo/store';
import { formatDate } from '../lib/format';
import { Modal } from './ui';
import type { RangePreset } from '../demo/accounting';

interface NavEntry { to: string; label: string; icon: ReactNode; badge?: 'approvals' }
interface NavGroup { label: string; items: NavEntry[] }

const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
      { to: '/ai', label: 'AI Command Center', icon: <Sparkles size={17} /> },
    ],
  },
  {
    label: 'Trade & Logistics',
    items: [
      { to: '/imports', label: 'Imports', icon: <Ship size={17} /> },
      { to: '/exports', label: 'Exports', icon: <Send size={17} /> },
      { to: '/inventory', label: 'Inventory', icon: <Boxes size={17} /> },
      { to: '/stock-transfers', label: 'Stock Transfers', icon: <ArrowLeftRight size={17} /> },
    ],
  },
  {
    label: 'Currency Exchange',
    items: [
      { to: '/currency-exchange', label: 'Forex Desk', icon: <Coins size={17} /> },
      { to: '/currency-reports', label: 'Forex Reports', icon: <FileBarChart size={17} /> },
    ],
  },
  {
    label: 'Accounting',
    items: [
      { to: '/parties', label: 'Parties', icon: <Users size={17} /> },
      { to: '/chart-of-accounts', label: 'Chart of Accounts', icon: <ListTree size={17} /> },
      { to: '/transactions', label: 'Transactions', icon: <ArrowLeftRight size={17} /> },
      { to: '/ledgers', label: 'Ledgers', icon: <BookOpen size={17} /> },
      { to: '/banks', label: 'Bank Accounts', icon: <Landmark size={17} /> },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/income-expenses', label: 'Expenses & Income', icon: <Receipt size={17} /> },
      { to: '/reports', label: 'Financial Reports', icon: <FileBarChart size={17} /> },
    ],
  },
  {
    label: 'Automation',
    items: [
      { to: '/documents', label: 'Documents', icon: <Files size={17} /> },
      { to: '/approvals', label: 'Approvals', icon: <ShieldCheck size={17} />, badge: 'approvals' },
    ],
  },
  {
    label: 'System',
    items: [{ to: '/settings', label: 'Settings', icon: <SettingsIcon size={17} /> }],
  },
];

const TITLES: Record<string, { title: string; eyebrow: string }> = {
  '/': { title: 'Executive Dashboard', eyebrow: 'Overview' },
  '/ai': { title: 'AI Command Center', eyebrow: 'AI Secretary' },
  '/imports': { title: 'Import Management', eyebrow: 'Trade & Logistics' },
  '/exports': { title: 'Export Management', eyebrow: 'Trade & Logistics' },
  '/inventory': { title: 'Inventory Management', eyebrow: 'Trade & Logistics' },
  '/stock-transfers': { title: 'Stock Transfers', eyebrow: 'Trade & Logistics' },
  '/currency-exchange': { title: 'Foreign Currency Exchange', eyebrow: 'Currency Management' },
  '/currency-reports': { title: 'Forex Reports & Realized P&L', eyebrow: 'Currency Management' },
  '/parties': { title: 'Parties', eyebrow: 'Accounting' },
  '/chart-of-accounts': { title: 'Chart of Accounts', eyebrow: 'Accounting' },
  '/transactions': { title: 'Transactions', eyebrow: 'Accounting' },
  '/ledgers': { title: 'Ledgers', eyebrow: 'Accounting' },
  '/banks': { title: 'Bank Accounts', eyebrow: 'Accounting' },
  '/income-expenses': { title: 'Expenses & Income', eyebrow: 'Insights' },
  '/reports': { title: 'Financial Reports', eyebrow: 'Insights' },
  '/documents': { title: 'Document Intelligence', eyebrow: 'Automation' },
  '/approvals': { title: 'Approvals', eyebrow: 'Automation' },
  '/settings': { title: 'Settings', eyebrow: 'System' },
};

const RANGE_OPTIONS: { value: Exclude<RangePreset, 'custom'>; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'lastMonth', label: 'Last Month' },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { data, pendingCount, resetDemo, pushToast, isPersisted } = useStore();
  const { range, setPreset, setCustom } = useRange();

  const meta = TITLES[location.pathname] ?? { title: 'AI Business Secretary', eyebrow: 'Demo' };
  const pending = useMemo(() => data.approvals.filter((a) => a.status === 'pending'), [data.approvals]);

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">{data.business.logoInitials}</div>
          <div className="brand-text">
            <div className="brand-title">AI Business Secretary<br />&amp; Accountant</div>
            <div className="brand-sub">Demo workspace</div>
          </div>
          <button className="icon-btn" style={{ marginLeft: 'auto', display: 'none', background: 'transparent', border: 0, color: '#8ea2c0' }} onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar-scroll">
          {NAV.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge === 'approvals' && pendingCount > 0 ? (
                    <span className="nav-badge">{pendingCount}</span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button
            className="sidebar-user"
            style={{ width: '100%', border: 0, cursor: 'pointer', textAlign: 'left' }}
            onClick={() => navigate('/settings')}
          >
            <div className="avatar">{data.business.logoInitials.slice(0, 2)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-user-name">Demo User</div>
              <div className="sidebar-user-role">Owner · {data.business.name}</div>
            </div>
            <ChevronRight size={15} style={{ marginLeft: 'auto', color: '#7a8caa' }} />
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={17} />
          </button>
          <div className="topbar-titles">
            <div className="topbar-eyebrow">{meta.eyebrow}</div>
            <div className="topbar-title">{meta.title}</div>
          </div>
          <div className="topbar-spacer" />

          <div className="topbar-actions">
            <div className="demo-pill" title="All data on this screen is fictional demo data stored in your browser only">
              <span className="demo-dot" /> Demo Mode
            </div>
            <button className="btn sm" onClick={() => setRangeOpen(true)} title="Change reporting period">
              <CalendarRange size={14} />
              <span className="nowrap">{range.preset === 'custom' ? `${formatDate(range.start)} → ${formatDate(range.end)}` : range.label}</span>
            </button>
            <div className="btn sm hide-xs" style={{ cursor: 'default', background: 'var(--surface-2)' }} title="Fixed demo clock — the presentation shows identical figures every time">
              <Clock size={14} />
              <span className="nowrap">{formatDate(data.demoToday)}</span>
            </div>
            <button className="icon-btn hide-xs" onClick={() => navigate('/transactions')} title="Search transactions" aria-label="Search transactions">
              <Search size={16} />
            </button>
            <button className="icon-btn" onClick={() => navigate('/approvals')} title={`${pending.length} item(s) pending approval`} aria-label="Approvals">
              <ShieldCheck size={16} />
            </button>
            <button className="icon-btn" onClick={() => setResetOpen(true)} title="Reset demo data" aria-label="Reset demo data">
              <RotateCcw size={16} />
            </button>
          </div>
        </header>

        {children}
      </div>

      {rangeOpen ? (
        <RangeModal
          current={range}
          onClose={() => setRangeOpen(false)}
          onPreset={(p) => {
            setPreset(p);
            setRangeOpen(false);
            pushToast({ title: 'Reporting period updated', text: 'Dashboard, reports and summaries now use the selected period.', tone: 'info' });
          }}
          onCustom={(s, e) => {
            setCustom(s, e);
            setRangeOpen(false);
            pushToast({ title: 'Custom period applied', text: `${formatDate(s)} → ${formatDate(e)}`, tone: 'info' });
          }}
        />
      ) : null}

      {resetOpen ? (
        <Modal
          title="Reset demo data?"
          subtitle="Restores the original fictional dataset. Nothing outside this browser is affected."
          onClose={() => setResetOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setResetOpen(false)}>Cancel</button>
              <div className="spacer" />
              <button
                className="btn danger"
                onClick={() => {
                  resetDemo();
                  setResetOpen(false);
                  pushToast({ title: 'Demo data restored', text: 'All demo transactions, approvals and documents are back to the original state.', tone: 'success' });
                }}
              >
                <RotateCcw size={14} /> Reset demo data
              </button>
            </>
          }
        >
          <p className="small muted">
            This clears transactions, approvals and documents you created during the demonstration and reloads the seeded
            dataset. {isPersisted ? 'Demo state is currently stored in this browser only.' : 'Demo state is in memory only.'}
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

function RangeModal({
  current,
  onClose,
  onPreset,
  onCustom,
}: {
  current: { start: string; end: string; preset: string };
  onClose: () => void;
  onPreset: (p: Exclude<RangePreset, 'custom'>) => void;
  onCustom: (s: string, e: string) => void;
}) {
  const [start, setStart] = useState(current.start);
  const [end, setEnd] = useState(current.end);
  return (
    <Modal
      title="Reporting period"
      subtitle="Applies to the dashboard, financial reports and expense summaries."
      onClose={onClose}
      icon={<CalendarRange size={16} />}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <div className="spacer" />
          <button className="btn primary" onClick={() => onCustom(start, end)} disabled={!start || !end}>
            Apply custom range
          </button>
        </>
      }
    >
      <div className="label mb-2">Quick periods</div>
      <div className="pill-row">
        {RANGE_OPTIONS.map((o) => (
          <button
            key={o.value}
            className={`chip ${current.preset === o.value ? 'lang' : ''}`}
            onClick={() => onPreset(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="divider" />
      <div className="grid grid-2">
        <label className="field">
          <span className="label">From</span>
          <input className="input" type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">To</span>
          <input className="input" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
    </Modal>
  );
}
