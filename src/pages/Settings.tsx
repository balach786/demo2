import { useMemo, useState } from 'react';
import { Database, Download, RotateCcw, ShieldCheck, HardDrive, AlertTriangle, CheckCircle2, Clock, Building2, Trash2, Info } from 'lucide-react';
import { Page, Card, CardHead, InfoCallout, Modal, ProgressBar } from '../components/ui';
import { useStore } from '../demo/store';
import { formatDate, formatPKR } from '../lib/format';
import { trialBalance } from '../demo/accounting';

const FEATURES: { module: string; status: 'working' | 'simulated' | 'planned'; note: string }[] = [
  { module: 'Executive dashboard & KPIs', status: 'working', note: 'All figures derived from journal lines; period filter applies everywhere.' },
  { module: 'Chart of accounts & ledgers', status: 'working', note: 'Account and party ledgers with running balances.' },
  { module: 'Transactions (8 voucher types)', status: 'working', note: 'Add, search, filter, inspect; balanced double entry enforced.' },
  { module: 'Financial reports', status: 'working', note: 'P&L, cash flow, trial balance, balance sheet, party & account ledgers.' },
  { module: 'Bank accounts & statements', status: 'simulated', note: 'Demo accounts only — no bank API or IBAN connectivity.' },
  { module: 'AI Secretary (English + Roman Urdu)', status: 'simulated', note: 'Deterministic rule-based engine over demo data. OpenAI API not connected.' },
  { module: 'Document intelligence / OCR', status: 'simulated', note: 'Sample extractions are pre-authored and labelled. No OCR engine runs on uploads.' },
  { module: 'Approvals workflow', status: 'working', note: 'Approve / reject / edit drafts; posting updates the demo ledger.' },
  { module: 'MongoDB Atlas persistence', status: 'planned', note: 'Not connected. Demo state lives in this browser only.' },
  { module: 'Authentication & roles', status: 'planned', note: 'Demo runs as a single "Demo User" without login.' },
  { module: 'Tax / sales tax invoices', status: 'planned', note: 'Out of scope for this demonstration.' },
  { module: 'Report export (PDF/Excel server-side)', status: 'planned', note: 'Browser print-to-PDF is available today.' },
];

const STATUS_BADGE = {
  working: { cls: 'green', label: 'Working in demo' },
  simulated: { cls: 'amber', label: 'Simulated' },
  planned: { cls: 'outline', label: 'Planned' },
} as const;

export default function Settings() {
  const { data, resetDemo, pushToast, isPersisted, clearPersistence, pendingCount } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const tb = useMemo(() => trialBalance(data, data.demoToday), [data]);

  const storageUsed = useMemo(() => {
    try {
      const raw = localStorage.getItem('absa.demo.state.v1') ?? '';
      return Math.min(100, (raw.length / (5 * 1024 * 1024)) * 100);
    } catch {
      return 0;
    }
  }, [data]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'abc-trading-demo-dataset.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page
      eyebrow="System"
      title="Settings"
      subtitle="Demo workspace configuration, data controls and an honest statement of what is real, simulated and planned."
      actions={<span className="badge amber"><span className="dot" /> Demo Mode</span>}
    >
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <Card>
          <CardHead title="Business profile" sub="Fictional demo entity" icon={<Building2 size={15} />} />
          <div className="card-body">
            <div className="field-row"><span className="f-label">Business name</span><span className="f-value">{data.business.name}</span></div>
            <div className="field-row"><span className="f-label">Legal form</span><span className="f-value">{data.business.legalName}</span></div>
            <div className="field-row"><span className="f-label">Currency</span><span className="f-value">{data.business.currency} ({data.business.currencyCode})</span></div>
            <div className="field-row"><span className="f-label">NTN</span><span className="f-value mono">{data.business.ntn}</span></div>
            <div className="field-row"><span className="f-label">Address</span><span className="f-value small">{data.business.address}</span></div>
            <div className="field-row"><span className="f-label">Fiscal year</span><span className="f-value">{data.business.fiscalYearLabel}</span></div>
            <div className="field-row"><span className="f-label">Demo clock</span><span className="f-value">{formatDate(data.demoToday)} <span className="xsmall muted">(fixed for stable presentations)</span></span></div>
          </div>
        </Card>

        <Card>
          <CardHead title="Demo data" sub="Isolated, browser-only state" icon={<Database size={15} />} />
          <div className="card-body">
            <div className="grid grid-3" style={{ gap: 10, marginBottom: 12 }}>
              <div className="bordered rounded" style={{ padding: '9px 11px' }}>
                <div className="eyebrow">Journal entries</div>
                <div className="bold tnum">{data.entries.length}</div>
              </div>
              <div className="bordered rounded" style={{ padding: '9px 11px' }}>
                <div className="eyebrow">Approvals</div>
                <div className="bold tnum">{data.approvals.length}</div>
              </div>
              <div className="bordered rounded" style={{ padding: '9px 11px' }}>
                <div className="eyebrow">Documents</div>
                <div className="bold tnum">{data.documents.length}</div>
              </div>
            </div>
            <div className="row between small mb-2">
              <span className="muted"><HardDrive size={12} style={{ verticalAlign: -2 }} /> Browser storage</span>
              <span>{isPersisted ? 'Persisted (localStorage)' : 'In memory only'}</span>
            </div>
            <ProgressBar pct={Math.max(2, storageUsed)} />
            <div className="xsmall muted mt-2">
              Demo state is stored under the key <span className="mono">absa.demo.state.v1</span>. Nothing is sent to a server.
            </div>
            <div className="divider dashed" />
            <div className="row wrap" style={{ gap: 8 }}>
              <button className="btn sm" onClick={exportJson}><Download size={14} /> Export dataset (JSON)</button>
              <button className="btn sm" onClick={() => setConfirmReset(true)}><RotateCcw size={14} /> Reset demo data</button>
              <button
                className="btn sm danger"
                onClick={() => {
                  clearPersistence();
                  pushToast({ title: 'Browser storage cleared', text: 'Current session remains in memory until you reload.', tone: 'info' });
                }}
              >
                <Trash2 size={14} /> Clear saved state
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <Card>
          <CardHead title="Ledger health" sub="Checked live" icon={<ShieldCheck size={15} />} />
          <div className="card-body">
            <div className="row between small"><span className="muted">Trial balance</span><span className={`badge ${tb.balanced ? 'green' : 'red'}`}>{tb.balanced ? 'Balanced' : 'Out of balance'}</span></div>
            <div className="row between small mt-2"><span className="muted">Total debits</span><span className="tnum">{formatPKR(tb.totalDebit)}</span></div>
            <div className="row between small mt-2"><span className="muted">Total credits</span><span className="tnum">{formatPKR(tb.totalCredit)}</span></div>
            <div className="row between small mt-2"><span className="muted">Difference</span><span className="tnum">{formatPKR(tb.difference)}</span></div>
            <div className="row between small mt-2"><span className="muted">Pending approvals</span><span className="tnum">{pendingCount}</span></div>
          </div>
        </Card>

        <Card>
          <CardHead title="Integrations" sub="Deliberately disconnected" icon={<AlertTriangle size={15} />} />
          <div className="card-body">
            {[
              ['MongoDB Atlas', 'Not connected'],
              ['OpenAI API', 'Not connected'],
              ['Bank / payment rails', 'Not connected'],
              ['Email / WhatsApp', 'Not connected'],
              ['OCR / Vision', 'Not connected'],
            ].map(([name, status]) => (
              <div className="row between small" key={name} style={{ padding: '4px 0' }}>
                <span className="muted">{name}</span>
                <span className="badge outline">{status}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Safety scope" sub="What this build does not do" />
          <div className="card-body small" style={{ display: 'grid', gap: 7 }}>
            <div className="row" style={{ gap: 7 }}><CheckCircle2 size={13} color="var(--green)" /> No production database writes</div>
            <div className="row" style={{ gap: 7 }}><CheckCircle2 size={13} color="var(--green)" /> No migrations or schema changes</div>
            <div className="row" style={{ gap: 7 }}><CheckCircle2 size={13} color="var(--green)" /> No .env or credential changes</div>
            <div className="row" style={{ gap: 7 }}><CheckCircle2 size={13} color="var(--green)" /> No real payments or emails</div>
            <div className="row" style={{ gap: 7 }}><CheckCircle2 size={13} color="var(--green)" /> All records are fictional</div>
            <div className="row" style={{ gap: 7 }}><Info size={13} color="var(--blue-600)" /> Security is not claimed as “100% verified”</div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Feature status matrix" sub="Honest view of what the demonstration covers" icon={<Clock size={15} />} />
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Module</th><th>Status</th><th>Notes</th></tr></thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f.module}>
                  <td className="strong">{f.module}</td>
                  <td><span className={`badge ${STATUS_BADGE[f.status].cls}`}>{STATUS_BADGE[f.status].label}</span></td>
                  <td className="small muted">{f.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <InfoCallout tone="info">
            The demonstration is designed to show product direction and workflow value. Anything labelled “planned” is not
            implemented in this build and is not presented as if it were.
          </InfoCallout>
        </div>
      </Card>

      {confirmReset ? (
        <Modal
          title="Reset all demo data?"
          subtitle="Restores the seeded fictional dataset and clears your demo changes."
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
              <div className="spacer" />
              <button
                className="btn danger"
                onClick={() => {
                  resetDemo();
                  setConfirmReset(false);
                  pushToast({ title: 'Demo data restored', text: 'All transactions, approvals and documents are back to their original state.', tone: 'success' });
                }}
              >
                <RotateCcw size={14} /> Reset demo data
              </button>
            </>
          }
        >
          <p className="small muted">
            This only affects data in this browser tab. No server, database or external service is touched.
          </p>
        </Modal>
      ) : null}
    </Page>
  );
}
