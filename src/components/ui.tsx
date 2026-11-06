import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCircle2, AlertTriangle, Info, X, XCircle, Inbox } from 'lucide-react';
import type { ApprovalStatus, TransactionType } from '../demo/types';
import { initials } from '../lib/format';
import { useStore } from '../demo/store';

/* ------------------------------------------------------------------ */
/* layout                                                              */
/* ------------------------------------------------------------------ */
export function Page({
  title,
  subtitle,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          {eyebrow ? <div className="eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div> : null}
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="page-head-actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Card({
  children,
  className = '',
  pad = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
  style?: CSSProperties;
}) {
  return <div className={`card ${pad ? 'pad' : ''} ${className}`} style={style}>{children}</div>;
}

export function CardHead({
  title,
  sub,
  actions,
  icon,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="card-head">
      {icon ? <div style={{ color: 'var(--muted)' }}>{icon}</div> : null}
      <div style={{ minWidth: 0 }}>
        <div className="card-title">{title}</div>
        {sub ? <div className="card-sub">{sub}</div> : null}
      </div>
      {actions ? <div className="card-head-actions">{actions}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* badges                                                              */
/* ------------------------------------------------------------------ */
export function StatusBadge({ status }: { status: ApprovalStatus }) {
  const map: Record<ApprovalStatus, { cls: string; label: string }> = {
    draft: { cls: 'outline', label: 'Draft' },
    pending: { cls: 'amber', label: 'Pending Approval' },
    approved: { cls: 'blue', label: 'Approved' },
    completed: { cls: 'green', label: 'Completed' },
    rejected: { cls: 'red', label: 'Rejected' },
  };
  const m = map[status];
  return (
    <span className={`badge ${m.cls}`}>
      <span className="dot" />
      {m.label}
    </span>
  );
}

const TYPE_TONE: Record<TransactionType, string> = {
  opening: 'outline',
  sales: 'blue',
  purchase: 'violet',
  receipt: 'green',
  payment: 'amber',
  expense: 'red',
  deposit: 'teal',
  withdrawal: 'violet',
  transfer: 'navy',
};

export function TypeBadge({ type, label }: { type: TransactionType; label: string }) {
  return <span className={`badge ${TYPE_TONE[type]}`}>{label}</span>;
}

export function Avatar({ name, kind = 'none', size = '' }: { name: string; kind?: 'customer' | 'supplier' | 'none'; size?: 'sm' | 'lg' | '' }) {
  const cls = kind === 'customer' ? 'cust' : kind === 'supplier' ? 'sup' : '';
  return <div className={`avatar ${cls} ${size}`}>{initials(name)}</div>;
}

/* ------------------------------------------------------------------ */
/* KPI                                                                 */
/* ------------------------------------------------------------------ */
export function Kpi({
  label,
  value,
  icon,
  tone = 'blue',
  delta,
  hint,
  link,
  spark,
  small,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: 'blue' | 'teal' | 'green' | 'amber' | 'red' | 'violet' | 'navy';
  delta?: { value: string; direction: 'up' | 'down' | 'flat'; label?: string };
  hint?: string;
  link?: ReactNode;
  spark?: ReactNode;
  small?: boolean;
}) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <div className={`kpi-icon ${tone}`}>{icon}</div>
        <div className="kpi-label">{label}</div>
      </div>
      <div className="kpi-value-row">
        <div className={`kpi-value ${small ? 'sm' : ''}`}>{value}</div>
        {spark ? <span className="spacer" /> : null}
        {spark ? <div className="kpi-spark">{spark}</div> : null}
      </div>
      <div className="kpi-meta">
        {delta ? (
          <span className={`kpi-delta ${delta.direction}`}>
            {delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '•'} {delta.value}
          </span>
        ) : null}
        {hint ? <span>{hint}</span> : null}
        {link ? <span className="kpi-link">{link}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* modal                                                               */
/* ------------------------------------------------------------------ */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  icon?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          {icon ? <div className="kpi-icon blue">{icon}</div> : null}
          <div style={{ minWidth: 0 }}>
            <div className="modal-title">{title}</div>
            {subtitle ? <div className="modal-sub">{subtitle}</div> : null}
          </div>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* empty state                                                         */
/* ------------------------------------------------------------------ */
export function EmptyState({
  title,
  text,
  icon,
  action,
}: {
  title: string;
  text?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? <Inbox size={20} />}</div>
      <div className="empty-title">{title}</div>
      {text ? <div className="empty-text">{text}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* toasts                                                              */
/* ------------------------------------------------------------------ */
export function ToastStack() {
  const { toasts, dismissToast } = useStore();
  if (!toasts.length) return null;
  return createPortal(
    <div className="toast-stack">
      {toasts.map((t) => (
        <div className={`toast ${t.tone}`} key={t.id} role="status">
          <span style={{ marginTop: 1 }}>
            {t.tone === 'success' ? <CheckCircle2 size={16} /> : t.tone === 'error' ? <XCircle size={16} /> : <Bell size={16} />}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="toast-title">{t.title}</div>
            {t.text ? <div className="toast-text">{t.text}</div> : null}
          </div>
          <button className="toast-close" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* misc                                                                */
/* ------------------------------------------------------------------ */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function InfoCallout({
  tone = 'info',
  title,
  children,
  icon,
}: {
  tone?: 'info' | 'warn' | 'success' | 'danger';
  title?: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  const fallback = tone === 'warn' ? <AlertTriangle size={15} /> : tone === 'success' ? <CheckCircle2 size={15} /> : tone === 'danger' ? <XCircle size={15} /> : <Info size={15} />;
  return (
    <div className={`callout ${tone}`}>
      {icon ?? fallback}
      <div>
        {title ? <strong>{title}</strong> : null}
        {title && children ? ' — ' : null}
        {children}
      </div>
    </div>
  );
}

export function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div className="progress">
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}
