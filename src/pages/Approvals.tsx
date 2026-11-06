import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, Check, X, PencilLine, Sparkles, FileText, Clock, CheckCircle2,
  XCircle, AlertTriangle, ArrowRight, UserCheck,
} from 'lucide-react';
import { Page, Card, CardHead, StatusBadge, Modal, Field, InfoCallout, EmptyState, Avatar } from '../components/ui';
import { useStore } from '../demo/store';
import { accountName, partyBalance, partyName } from '../demo/accounting';
import { formatDateTime, formatPKR, formatDate } from '../lib/format';
import { buildLines, emptyForm, type TransactionForm } from '../demo/transactionBuilder';
import type { Approval, ApprovalStatus, DraftTransaction } from '../demo/types';

type Tab = 'pending' | 'draft' | 'completed' | 'rejected' | 'all';

export default function Approvals() {
  const { data, approve, reject, updateApprovalDraft, setApprovalStatus, pushToast, addActivity } = useStore();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  // Guards against a double-click on "Approve" closing the modal and the same
  // click landing on the table underneath, which would open another approval.
  const closedAtRef = useRef(0);
  const approvingRef = useRef(false);

  useEffect(() => {
    const editId = params.get('edit');
    if (editId) {
      setOpenId(editId);
      setEditing(true);
    }
  }, [params]);

  const counts = useMemo(() => {
    const c = { pending: 0, draft: 0, completed: 0, rejected: 0, all: data.approvals.length };
    data.approvals.forEach((a) => {
      if (a.status === 'pending') c.pending++;
      if (a.status === 'draft') c.draft++;
      if (a.status === 'completed') c.completed++;
      if (a.status === 'rejected') c.rejected++;
    });
    return c;
  }, [data.approvals]);

  const rows = useMemo(
    () => data.approvals.filter((a) => (tab === 'all' ? true : a.status === tab)),
    [data.approvals, tab],
  );

  const open = data.approvals.find((a) => a.id === openId) ?? null;

  /** Single entry point for opening a review modal, resistant to click-through. */
  const openReview = (id: string) => {
    if (Date.now() - closedAtRef.current < 400) return;
    setOpenId(id);
  };

  const close = () => {
    closedAtRef.current = Date.now();
    setOpenId(null);
    setEditing(false);
    if (params.get('edit')) {
      const p = new URLSearchParams(params);
      p.delete('edit');
      setParams(p, { replace: true });
    }
  };

  const handleApprove = (a: Approval) => {
    if (approvingRef.current) return;
    approvingRef.current = true;
    window.setTimeout(() => { approvingRef.current = false; }, 500);
    const bal = a.draft.partyId ? partyBalance(data, a.draft.partyId).balance : 0;
    const projected = a.draft.type === 'payment' ? bal - a.draft.amount : bal + a.draft.amount;
    const entry = approve(a.id);
    if (!entry) {
      pushToast({ title: 'Could not post', text: 'The draft is not balanced or is already processed.', tone: 'error' });
      return;
    }
    addActivity({
      at: new Date().toISOString(),
      actor: 'user',
      tone: 'success',
      title: 'Approval posted to the demo ledger',
      detail: `${a.reference} · ${formatPKR(a.draft.amount)} · ${entry.reference}`,
    });
    pushToast({
      title: `Approved · posted as ${entry.reference}`,
      text: `${formatPKR(a.draft.amount)} · ${a.draft.partyId ? `${partyName(data, a.draft.partyId)} balance is now ${formatPKR(Math.abs(projected))}` : 'ledger updated'}.`,
      tone: 'success',
    });
    close();
  };

  const handleReject = () => {
    if (!rejectId) return;
    const a = data.approvals.find((x) => x.id === rejectId);
    reject(rejectId, reason.trim() || 'Rejected by Demo User');
    addActivity({
      at: new Date().toISOString(),
      actor: 'user',
      tone: 'danger',
      title: 'Approval rejected',
      detail: `${a?.reference ?? ''} · ${reason.trim() || 'no reason given'}`,
    });
    pushToast({ title: 'Draft rejected', text: 'No ledger entry was created.', tone: 'info' });
    setRejectId(null);
    setReason('');
    close();
  };

  return (
    <Page
      eyebrow="Automation"
      title="Approvals"
      subtitle="Every AI or document-generated action waits here for a human decision. Nothing posts to the ledger without approval."
      actions={
        <>
          <span className="badge amber"><Clock size={12} /> {counts.pending} pending</span>
          <span className="badge outline">{counts.all} total</span>
        </>
      }
    >
      <div className="row wrap mb-3" style={{ gap: 8, marginBottom: 14 }}>
        {([
          ['all', 'All'],
          ['pending', 'Pending Approval'],
          ['draft', 'Drafts'],
          ['completed', 'Completed'],
          ['rejected', 'Rejected'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} className={`chip ${tab === key ? 'lang' : ''}`} onClick={() => setTab(key)}>
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon amber"><Clock size={16} /></div><div className="kpi-label">Pending approval</div></div>
          <div className="kpi-value">{counts.pending}</div>
          <div className="kpi-meta">awaiting a human decision</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon navy"><FileText size={16} /></div><div className="kpi-label">Saved drafts</div></div>
          <div className="kpi-value">{counts.draft}</div>
          <div className="kpi-meta">not yet submitted</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon green"><CheckCircle2 size={16} /></div><div className="kpi-label">Completed</div></div>
          <div className="kpi-value">{counts.completed}</div>
          <div className="kpi-meta">posted to the ledger</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon red"><XCircle size={16} /></div><div className="kpi-label">Rejected</div></div>
          <div className="kpi-value">{counts.rejected}</div>
          <div className="kpi-meta">no ledger impact</div>
        </div>
      </div>

      <Card>
        <CardHead title="Action queue" sub="AI commands and document extractions that need a decision" icon={<ShieldCheck size={15} />} />
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing in this queue"
            text="Ask the AI Secretary to prepare a payment, or upload a document to create a new draft."
            icon={<ShieldCheck size={20} />}
            action={<button className="btn primary sm" onClick={() => navigate('/ai')}><Sparkles size={14} /> Open AI Command Center</button>}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Action</th>
                  <th>Origin</th>
                  <th>Party</th>
                  <th className="num">Amount</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="clickable" onClick={() => openReview(a.id)}>
                    <td className="mono strong">{a.reference}</td>
                    <td style={{ maxWidth: 300 }}>
                      <div className="cell-title">{a.title}</div>
                      <div className="cell-sub">{a.subtitle}</div>
                    </td>
                    <td>
                      <span className={`badge ${a.origin === 'ai' ? 'violet' : a.origin === 'document' ? 'teal' : 'outline'}`}>
                        {a.origin === 'ai' ? <><Sparkles size={11} /> AI</> : a.origin === 'document' ? <><FileText size={11} /> Document</> : 'Manual'}
                      </span>
                    </td>
                    <td className="small">{a.draft.partyId ? partyName(data, a.draft.partyId) : '—'}</td>
                    <td className="num strong">{formatPKR(a.draft.amount)}</td>
                    <td className="small muted nowrap">{formatDateTime(a.createdAt)}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="right">
                      <button className="btn xs" onClick={(e) => { e.stopPropagation(); openReview(a.id); }}>
                        Review <ArrowRight size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-foot">
          <InfoCallout tone="info">
            Approving a draft posts a balanced journal entry into the isolated demo ledger and updates every screen instantly.
            No bank transfer, email or real payment is ever executed.
          </InfoCallout>
        </div>
      </Card>

      {open ? (
        <Modal
          title={open.title}
          subtitle={`${open.reference} · created ${formatDateTime(open.createdAt)} · ${open.origin === 'ai' ? 'AI Secretary' : open.origin === 'document' ? 'Document Intelligence' : 'Manual entry'}`}
          onClose={close}
          wide
          icon={<ShieldCheck size={16} />}
          footer={
            <>
              <StatusBadge status={open.status} />
              {open.confidence ? <span className="xsmall muted">Confidence {(open.confidence * 100).toFixed(0)}%</span> : null}
              <div className="spacer" />
              {open.status === 'pending' || open.status === 'draft' ? (
                <>
                  <button className="btn" onClick={() => { close(); setRejectId(open.id); setReason(''); }}>
                    <X size={14} /> Reject
                  </button>
                  <button className="btn" onClick={() => setEditing(true)}>
                    <PencilLine size={14} /> Edit draft
                  </button>
                  <button className="btn success" onClick={() => handleApprove(open)}>
                    <Check size={14} /> Approve &amp; post
                  </button>
                </>
              ) : (
                <button className="btn" onClick={close}>Close</button>
              )}
            </>
          }
        >
          {open.command ? (
            <div className="callout info mb-3">
              <Sparkles size={15} />
              <div><strong>Command:</strong> “{open.command}”</div>
            </div>
          ) : null}

          <div className="row" style={{ gap: 12, marginBottom: 14 }}>
            <Avatar name={open.draft.partyId ? partyName(data, open.draft.partyId) : 'NA'} kind={data.parties.find((p) => p.id === open.draft.partyId)?.type ?? 'none'} />
            <div>
              <div className="bold">{open.draft.partyId ? partyName(data, open.draft.partyId) : 'No party linked'}</div>
              <div className="small muted">{open.draft.description}</div>
            </div>
            <span className="spacer" />
            <div className="right">
              <div className="eyebrow">Amount</div>
              <div className="bold tnum" style={{ fontSize: 18 }}>{formatPKR(open.draft.amount)}</div>
            </div>
          </div>

          <div className="grid grid-3 mb-3">
            <div className="bordered rounded" style={{ padding: '9px 11px' }}>
              <div className="eyebrow">Transaction type</div>
              <div className="bold small">{open.draft.type === 'payment' ? 'Payment (Money Paid)' : open.draft.type === 'receipt' ? 'Receipt (Money Received)' : open.draft.type}</div>
            </div>
            <div className="bordered rounded" style={{ padding: '9px 11px' }}>
              <div className="eyebrow">Date</div>
              <div className="bold small">{formatDate(open.draft.date)}</div>
            </div>
            <div className="bordered rounded" style={{ padding: '9px 11px' }}>
              <div className="eyebrow">Account</div>
              <div className="bold small">{accountName(data, open.draft.accountId)}</div>
            </div>
          </div>

          <div className="label mb-2">Journal preview (balanced)</div>
          <div className="table-wrap bordered rounded mb-3">
            <table className="table">
              <thead><tr><th>Account</th><th>Party</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
              <tbody>
                {open.draft.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="strong">{accountName(data, l.accountId)}</td>
                    <td>{l.partyId ? partyName(data, l.partyId) : '—'}</td>
                    <td className="num">{l.debit ? formatPKR(l.debit) : '—'}</td>
                    <td className="num">{l.credit ? formatPKR(l.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total">
                  <td colSpan={2}>Total</td>
                  <td className="num">{formatPKR(open.draft.lines.reduce((s, l) => s + l.debit, 0))}</td>
                  <td className="num">{formatPKR(open.draft.lines.reduce((s, l) => s + l.credit, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {open.uncertainties && open.uncertainties.length > 0 ? (
            <div className="callout warn mb-3">
              <AlertTriangle size={15} />
              <div>
                <strong>Needs attention:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {open.uncertainties.map((u) => <li key={u}>{u}</li>)}
                </ul>
              </div>
            </div>
          ) : null}

          {open.status === 'completed' ? (
            <InfoCallout tone="success" title="Posted">
              Approved by {open.approvedBy} on {open.approvedAt ? formatDateTime(open.approvedAt) : ''}. Ledger entry created and all
              balances updated.
            </InfoCallout>
          ) : null}
          {open.status === 'rejected' ? (
            <InfoCallout tone="danger" title="Rejected"> {open.rejectionReason ?? 'No reason recorded.'}</InfoCallout>
          ) : null}

          <div className="row mt-3" style={{ gap: 6 }}>
            <span className="demo-pill"><span className="demo-dot" /> Demo workflow · no real payment executed</span>
          </div>
        </Modal>
      ) : null}

      {editing && open ? (
        <EditDraftModal
          approval={open}
          onClose={() => setEditing(false)}
          onSave={(draft) => {
            updateApprovalDraft(open.id, draft);
            setApprovalStatus(open.id, 'pending');
            pushToast({ title: 'Draft updated', text: `${open.reference} now reflects your corrections.`, tone: 'success' });
            setEditing(false);
          }}
        />
      ) : null}

      {rejectId ? (
        <Modal
          title="Reject this action?"
          subtitle="The draft will be archived and nothing will be posted to the ledger."
          onClose={() => setRejectId(null)}
          icon={<X size={16} />}
          footer={
            <>
              <button className="btn" onClick={() => setRejectId(null)}>Cancel</button>
              <div className="spacer" />
              <button className="btn danger" onClick={handleReject}><X size={14} /> Confirm rejection</button>
            </>
          }
        >
          <Field label="Reason (optional)">
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate of an existing voucher" />
          </Field>
        </Modal>
      ) : null}
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* edit draft                                                          */
/* ------------------------------------------------------------------ */
function EditDraftModal({
  approval,
  onClose,
  onSave,
}: {
  approval: Approval;
  onClose: () => void;
  onSave: (draft: DraftTransaction) => void;
}) {
  const { data } = useStore();
  const initialType = approval.draft.type;
  const [form, setForm] = useState<TransactionForm>({
    ...emptyForm(data.demoToday),
    type: initialType,
    date: approval.draft.date,
    amount: approval.draft.amount,
    partyId: approval.draft.partyId ?? '',
    accountId: approval.draft.accountId,
    description: approval.draft.description,
  });

  const lines = buildLines(data, form);
  const party = data.parties.find((p) => p.id === form.partyId);
  const dr = lines.reduce((s, l) => s + l.debit, 0);
  const cr = lines.reduce((s, l) => s + l.credit, 0);

  return (
    <Modal
      title="Edit draft"
      subtitle={`${approval.reference} · corrections are saved as a new draft and still require approval`}
      onClose={onClose}
      icon={<PencilLine size={16} />}
      footer={
        <>
          <span className={`badge ${Math.round(dr) === Math.round(cr) && dr > 0 ? 'green' : 'red'}`}>
            Dr {formatPKR(dr)} / Cr {formatPKR(cr)}
          </span>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            disabled={!form.amount || form.amount <= 0 || Math.round(dr) !== Math.round(cr)}
            onClick={() =>
              onSave({
                ...approval.draft,
                date: form.date,
                amount: form.amount,
                partyId: form.partyId || undefined,
                accountId: form.accountId,
                description: form.description,
                lines,
              })
            }
          >
            Save draft
          </button>
        </>
      }
    >
      <div className="grid grid-2">
        <Field label="Date">
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Amount (PKR)">
          <input className="input tnum" type="number" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
        </Field>
        <Field label="Party">
          <select className="select" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })}>
            <option value="">— none —</option>
            {data.parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Cash / bank account">
          <select className="select" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
            {data.accounts.filter((a) => a.isBank || a.isCash).map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Description">
          <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </div>
      {party ? (
        <div className="mt-3">
          <InfoCallout tone="info" icon={<UserCheck size={15} />}>
            {party.name} current balance: {formatPKR(partyBalance(data, party.id).balance)} ({partyBalance(data, party.id).side}).
          </InfoCallout>
        </div>
      ) : null}
    </Modal>
  );
}
