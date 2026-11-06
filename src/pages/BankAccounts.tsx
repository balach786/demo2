import { useMemo, useState } from 'react';
import { Landmark, Wallet, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Info, Plus, ShieldCheck } from 'lucide-react';
import { Page, Card, CardHead, TypeBadge, InfoCallout } from '../components/ui';
import { Sparkline } from '../components/charts';
import { NewTransactionModal } from '../components/TransactionForm';
import { useStore } from '../demo/store';
import { accountLedger, naturalBalance, TYPE_LABELS } from '../demo/accounting';
import { formatDate, formatPKR, monthKey } from '../lib/format';
import type { TransactionType } from '../demo/types';

const ACCOUNT_IDS = ['1000', '1010', '1020'];

export default function BankAccounts() {
  const { data } = useStore();
  const [selected, setSelected] = useState('1010');
  const [formType, setFormType] = useState<TransactionType | null>(null);

  const ledger = useMemo(() => accountLedger(data, selected).slice(-14).reverse(), [data, selected]);

  const series = useMemo(() => {
    const acc = accountLedger(data, selected);
    const byMonth = new Map<string, number>();
    for (const r of acc) {
      const k = monthKey(r.date);
      byMonth.set(k, r.balance);
    }
    return [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v).slice(-10);
  }, [data, selected]);

  const selectedAccount = data.accounts.find((a) => a.id === selected)!;

  return (
    <Page
      eyebrow="Accounting"
      title="Bank Accounts"
      subtitle="Demo bank and cash accounts with live balances and statements. No real bank connection is used anywhere in this demo."
      actions={<span className="badge amber"><ShieldCheck size={12} /> Simulated banking · no bank API</span>}
    >
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        {ACCOUNT_IDS.map((id) => {
          const acc = data.accounts.find((a) => a.id === id)!;
          const balance = naturalBalance(data, id, { end: data.demoToday });
          const opening = naturalBalance(data, id, { end: data.fiscalYearStart });
          const isActive = selected === id;
          const monthly = (() => {
            const rows = accountLedger(data, id);
            const map = new Map<string, number>();
            rows.forEach((r) => map.set(monthKey(r.date), r.balance));
            return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v).slice(-10);
          })();
          return (
            <div
              key={id}
              className="card"
              style={{
                cursor: 'pointer',
                borderColor: isActive ? 'var(--blue-500)' : undefined,
                boxShadow: isActive ? '0 0 0 3px rgba(59,130,246,0.14)' : undefined,
              }}
              onClick={() => setSelected(id)}
            >
              <div className="card-body">
                <div className="row" style={{ gap: 10, marginBottom: 10 }}>
                  <div className={`kpi-icon ${acc.isCash ? 'teal' : 'navy'}`}>
                    {acc.isCash ? <Wallet size={16} /> : <Landmark size={16} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="cell-title">{acc.name}</div>
                    <div className="cell-sub">{acc.isCash ? 'Petty cash & counter' : acc.bankName}</div>
                  </div>
                  {isActive ? <span className="badge blue" style={{ marginLeft: 'auto' }}>Selected</span> : null}
                </div>
                <div className="eyebrow">Current balance</div>
                <div className="bold tnum" style={{ fontSize: 21, letterSpacing: '-0.02em' }}>{formatPKR(balance)}</div>
                <div className="row between small muted mt-2">
                  <span>Opening {formatPKR(opening)}</span>
                  <span className="tnum">{acc.accountNumber ? acc.accountNumber.slice(-13) : 'Cash account'}</span>
                </div>
                <div className="row mt-2" style={{ gap: 8 }}>
                  <span className="tag">{acc.accountTitle ?? 'Main Cash Account'}</span>
                  <span className="spacer" />
                  <Sparkline values={monthly.length > 1 ? monthly : series} color={acc.isCash ? '#0e9f8a' : '#2563eb'} width={84} height={26} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-sidebar" style={{ marginBottom: 16 }}>
        <Card>
          <CardHead
            title={`${selectedAccount.name} — statement`}
            sub={`Last ${ledger.length} movements · ${selectedAccount.bankName ?? 'Cash account'}`}
            actions={
              <div className="row" style={{ gap: 6 }}>
                <button className="btn xs" onClick={() => setFormType('deposit')}><ArrowDownToLine size={12} /> Deposit</button>
                <button className="btn xs" onClick={() => setFormType('withdrawal')}><ArrowUpFromLine size={12} /> Withdraw</button>
                <button className="btn xs" onClick={() => setFormType('transfer')}><ArrowLeftRight size={12} /> Transfer</button>
              </div>
            }
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r, i) => (
                  <tr key={`${r.entryId}-${i}`}>
                    <td className="nowrap">{formatDate(r.date)}</td>
                    <td className="mono">{r.reference}</td>
                    <td><TypeBadge type={r.type} label={TYPE_LABELS[r.type]} /></td>
                    <td>{r.description}</td>
                    <td className="num amount-pos">{r.debit ? formatPKR(r.debit) : '—'}</td>
                    <td className="num amount-neg">{r.credit ? formatPKR(r.credit) : '—'}</td>
                    <td className="num strong">{formatPKR(Math.abs(r.balance))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-foot">
            <span className="small muted">Demo statement — generated from journal entries, not from a bank feed.</span>
            <span className="spacer" />
            <button className="btn sm" onClick={() => setFormType('deposit')}><Plus size={14} /> New bank transaction</button>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <CardHead title="Account details" sub="Fictional data" icon={<Landmark size={15} />} />
            <div className="card-body">
              <div className="field-row"><span className="f-label">Account title</span><span className="f-value">{selectedAccount.accountTitle ?? 'ABC Trading Company'}</span></div>
              <div className="field-row"><span className="f-label">Bank</span><span className="f-value">{selectedAccount.bankName ?? 'Cash'}</span></div>
              <div className="field-row"><span className="f-label">IBAN</span><span className="f-value mono" style={{ fontSize: 11.5 }}>{selectedAccount.accountNumber ?? '—'}</span></div>
              <div className="field-row"><span className="f-label">Opening balance</span><span className="f-value tnum">{formatPKR(naturalBalance(data, selected, { end: data.fiscalYearStart }))}</span></div>
              <div className="field-row"><span className="f-label">Current balance</span><span className="f-value tnum">{formatPKR(naturalBalance(data, selected, { end: data.demoToday }))}</span></div>
              <div className="field-row"><span className="f-label">Ledger account</span><span className="f-value mono">{selectedAccount.code}</span></div>
            </div>
          </Card>
          <InfoCallout tone="warn" title="No real banking">
            Deposits, withdrawals and transfers post to the demo ledger only. No bank API, payment rail or IBAN is contacted
            at any point during the demonstration.
          </InfoCallout>
          <InfoCallout tone="info" icon={<Info size={15} />}>
            Use Deposit / Withdraw / Transfer to show how cash movements immediately update the dashboard cash and bank KPIs.
          </InfoCallout>
        </div>
      </div>

      {formType ? <NewTransactionModal onClose={() => setFormType(null)} presetType={formType} /> : null}
    </Page>
  );
}
