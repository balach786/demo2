import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, ArrowRight, Plus } from 'lucide-react';
import { Modal, Field, InfoCallout } from './ui';
import { useStore } from '../demo/store';
import { buildLines, emptyForm, TYPE_OPTIONS, validateForm, type TransactionForm } from '../demo/transactionBuilder';
import { accountName, partyName } from '../demo/accounting';
import { formatPKR } from '../lib/format';
import type { TransactionType } from '../demo/types';

export function NewTransactionModal({
  onClose,
  presetType,
}: {
  onClose: () => void;
  presetType?: TransactionType;
}) {
  const { data, postEntry, pushToast, addActivity } = useStore();
  const [form, setForm] = useState<TransactionForm>(() => ({ ...emptyForm(data.demoToday), type: presetType ?? 'receipt' }));
  const [touched, setTouched] = useState(false);

  const lines = useMemo(() => buildLines(data, form), [data, form]);
  const dr = lines.reduce((s, l) => s + l.debit, 0);
  const cr = lines.reduce((s, l) => s + l.credit, 0);
  const balanced = lines.length > 0 && Math.round(dr) === Math.round(cr) && dr > 0;
  const errors = validateForm(data, form);

  const set = <K extends keyof TransactionForm>(key: K, value: TransactionForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const bankAccounts = data.accounts.filter((a) => a.isBank || a.isCash);
  const parties = data.parties.filter((p) =>
    form.type === 'receipt' || form.type === 'sales' ? p.type === 'customer' : p.type === 'supplier',
  );
  const expenseAccounts = data.accounts.filter((a) => a.type === 'expense');
  const typeMeta = TYPE_OPTIONS.find((o) => o.value === form.type)!;

  const save = () => {
    setTouched(true);
    if (errors.length) return;
    const entry = postEntry({
      type: form.type,
      date: form.date,
      description: form.description.trim(),
      lines,
      source: 'manual',
    });
    addActivity({
      at: new Date().toISOString(),
      actor: 'user',
      tone: 'success',
      title: `${typeMeta.label} recorded`,
      detail: `${formatPKR(form.amount)} · posted to the demo ledger`,
    });
    pushToast({
      title: `${typeMeta.label} posted`,
      text: `Reference ${entry.reference} · ${formatPKR(form.amount)}. Dashboard and ledgers updated.`,
      tone: 'success',
    });
    onClose();
  };

  return (
    <Modal
      title="New transaction"
      subtitle="Every voucher is posted as a balanced double entry into the demo ledger."
      onClose={onClose}
      wide
      icon={<Plus size={16} />}
      footer={
        <>
          <div className="row" style={{ gap: 8 }}>
            {balanced ? (
              <span className="badge green"><CheckCircle2 size={12} /> Debits = Credits</span>
            ) : (
              <span className="badge red"><AlertTriangle size={12} /> Not balanced yet</span>
            )}
          </div>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={errors.length > 0}>
            Post transaction
          </button>
        </>
      }
    >
      <div className="label mb-2">Transaction type</div>
      <div className="pill-row mb-2">
        {TYPE_OPTIONS.map((o) => (
          <button
            key={o.value}
            className={`chip ${form.type === o.value ? 'lang' : ''}`}
            onClick={() => {
              setForm((f) => ({
                ...f,
                type: o.value,
                partyId: '',
                accountId: o.value === 'transfer' ? '1010' : o.value === 'expense' ? '1000' : f.accountId,
                toAccountId: o.value === 'transfer' ? '1020' : '1010',
                paidImmediately: o.value === 'sales' || o.value === 'purchase' ? f.paidImmediately : false,
              }));
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="callout info mb-3" style={{ fontSize: 12.3 }}>{typeMeta.help}</div>

      <div className="grid grid-2">
        <Field label="Date">
          <input className="input" type="date" value={form.date} max={data.demoToday} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Amount (PKR)">
          <input
            className="input tnum"
            type="number"
            min={0}
            step={50}
            value={form.amount || ''}
            placeholder="e.g. 25000"
            onChange={(e) => set('amount', Number(e.target.value))}
          />
        </Field>
      </div>

      {(form.type === 'receipt' || form.type === 'payment' || form.type === 'sales' || form.type === 'purchase') && (
        <div className="mt-3">
          <Field
            label={form.type === 'receipt' || form.type === 'sales' ? 'Customer' : 'Supplier'}
            hint={form.type === 'sales' || form.type === 'purchase' ? 'Optional for cash transactions' : undefined}
          >
            <select className="select" value={form.partyId} onChange={(e) => set('partyId', e.target.value)}>
              <option value="">— select party —</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {form.type === 'expense' && (
        <div className="mt-3">
          <Field label="Expense head">
            <select className="select" value={form.categoryAccountId} onChange={(e) => set('categoryAccountId', e.target.value)}>
              {expenseAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <div className="grid grid-2 mt-3">
        <Field
          label={
            form.type === 'deposit' ? 'Deposit into (bank)'
              : form.type === 'withdrawal' ? 'Withdraw from (bank)'
              : form.type === 'transfer' ? 'From account'
              : form.type === 'sales' || form.type === 'purchase' ? 'Cash / bank account'
              : 'Paid from / received in'
          }
        >
          <select className="select" value={form.accountId} onChange={(e) => set('accountId', e.target.value)}>
            {(form.type === 'deposit' || form.type === 'transfer' ? data.accounts.filter((a) => a.isBank) : bankAccounts).map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </Field>

        {(form.type === 'deposit' || form.type === 'transfer') && (
          <Field label={form.type === 'deposit' ? 'Source (cash)' : 'To account'}>
            <select className="select" value={form.toAccountId} onChange={(e) => set('toAccountId', e.target.value)}>
              {(form.type === 'deposit' ? data.accounts.filter((a) => a.isCash) : data.accounts.filter((a) => a.isBank)).map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </Field>
        )}

        {(form.type === 'sales' || form.type === 'purchase') && (
          <Field label="Settlement">
            <select
              className="select"
              value={form.paidImmediately ? 'cash' : 'credit'}
              onChange={(e) => set('paidImmediately', e.target.value === 'cash')}
            >
              <option value="credit">{form.type === 'sales' ? 'On credit (Accounts Receivable)' : 'On credit (Accounts Payable)'}</option>
              <option value="cash">{form.type === 'sales' ? 'Cash / bank sale' : 'Paid immediately from bank'}</option>
            </select>
          </Field>
        )}
      </div>

      <div className="mt-3">
        <Field label="Description / narration">
          <input
            className="input"
            value={form.description}
            placeholder={
              form.type === 'receipt' ? 'e.g. Receipt against invoice INV-2026-021'
                : form.type === 'payment' ? 'e.g. Supplier payment against bill BILL-2026-014'
                : 'e.g. Monthly electricity bill'
            }
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
      </div>

      {form.type === 'sales' && (
        <label className="checkbox mt-3">
          <input type="checkbox" checked={form.includeCogs} onChange={(e) => set('includeCogs', e.target.checked)} />
          Also post cost of goods sold (70% of invoice value) against Inventory
        </label>
      )}

      <div className="divider" />
      <div className="row mb-2">
        <span className="label">Journal preview</span>
        <span className="spacer" />
        <span className="xsmall muted">Debits {formatPKR(dr)} · Credits {formatPKR(cr)}</span>
      </div>

      <div className="table-wrap bordered rounded">
        <table className="table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Party</th>
              <th className="num">Debit</th>
              <th className="num">Credit</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={4} className="muted">Enter an amount to preview the journal entry.</td></tr>
            ) : (
              lines.map((l, i) => (
                <tr key={i}>
                  <td className="strong">{accountName(data, l.accountId)}</td>
                  <td>{l.partyId ? partyName(data, l.partyId) : '—'}</td>
                  <td className="num">{l.debit ? formatPKR(l.debit) : '—'}</td>
                  <td className="num">{l.credit ? formatPKR(l.credit) : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="total">
              <td colSpan={2}>Total</td>
              <td className="num">{formatPKR(dr)}</td>
              <td className="num">{formatPKR(cr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {touched && errors.length > 0 ? (
        <div className="mt-3">
          <InfoCallout tone="danger" title="Please fix"> {errors.join(' ')}</InfoCallout>
        </div>
      ) : null}

      <div className="mt-3 xsmall muted row" style={{ gap: 6 }}>
        <ArrowRight size={12} /> Posting this voucher immediately updates Dashboard KPIs, ledgers, trial balance and AI answers.
      </div>
    </Modal>
  );
}
