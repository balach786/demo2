import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Printer, Users, Layers } from 'lucide-react';
import { Page, Card, CardHead, Segmented, EmptyState, TypeBadge, InfoCallout, Avatar } from '../components/ui';
import { useStore } from '../demo/store';
import { accountLedger, naturalBalance, partyBalance, partyLedger, TYPE_LABELS } from '../demo/accounting';
import { formatDate, formatPKR } from '../lib/format';

type Mode = 'account' | 'party';

export default function Ledgers() {
  const { data } = useStore();
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>('account');
  const [accountId, setAccountId] = useState(params.get('account') ?? '1010');
  const [partyId, setPartyId] = useState(params.get('party') ?? 'CUS-001');
  const [from, setFrom] = useState(data.fiscalYearStart);
  const [to, setTo] = useState(data.demoToday);

  useEffect(() => {
    if (params.get('account')) {
      setMode('account');
      setAccountId(params.get('account')!);
    }
    if (params.get('party')) {
      setMode('party');
      setPartyId(params.get('party')!);
    }
  }, [params]);

  const rows = useMemo(() => {
    return mode === 'account'
      ? accountLedger(data, accountId, from, to)
      : partyLedger(data, partyId, from, to);
  }, [data, mode, accountId, partyId, from, to]);

  const first = rows[0];
  const firstMovement = first
    ? mode === 'party'
      ? first.debit - first.credit
      : isCreditAccount()
        ? first.credit - first.debit
        : first.debit - first.credit
    : 0;
  const opening = first ? first.balance - firstMovement : 0;
  const closing = rows.length ? rows[rows.length - 1]!.balance : 0;
  const totalDr = rows.reduce((s, r) => s + r.debit, 0);
  const totalCr = rows.reduce((s, r) => s + r.credit, 0);
  const selectedParty = data.parties.find((p) => p.id === partyId);
  const selectedAccount = data.accounts.find((a) => a.id === accountId);

  function isCreditAccount() {
    return data.accounts.find((a) => a.id === accountId)?.normalBalance === 'credit';
  }

  return (
    <Page
      eyebrow="Accounting"
      title="Ledgers"
      subtitle="Account ledgers and party ledgers with opening balance, running balance and closing balance for any period."
      actions={
        <>
          <button className="btn" onClick={() => window.print()}><Printer size={15} /> Print</button>
          <Segmented
            value={mode}
            options={[
              { value: 'account', label: 'Account ledger' },
              { value: 'party', label: 'Party ledger' },
            ]}
            onChange={(v) => {
              setMode(v);
              const p = new URLSearchParams();
              if (v === 'account') p.set('account', accountId);
              else p.set('party', partyId);
              setParams(p, { replace: true });
            }}
          />
        </>
      }
    >
      <Card pad className="mb-3" style={{ marginBottom: 16 }}>
        <div className="row wrap" style={{ gap: 10 }}>
          {mode === 'account' ? (
            <label className="field" style={{ flex: '1 1 260px' }}>
              <span className="label">Account</span>
              <select className="select" value={accountId} onChange={(e) => { setAccountId(e.target.value); setParams({ account: e.target.value }, { replace: true }); }}>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.type})</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field" style={{ flex: '1 1 260px' }}>
              <span className="label">Party</span>
              <select className="select" value={partyId} onChange={(e) => { setPartyId(e.target.value); setParams({ party: e.target.value }, { replace: true }); }}>
                {data.parties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </label>
          )}
          <label className="field"><span className="label">From</span>
            <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field"><span className="label">To</span>
            <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          <div className="spacer" />
          <div className="row" style={{ gap: 8, alignSelf: 'flex-end' }}>
            <span className="badge blue">{rows.length} entries</span>
            <span className="badge outline">Dr {formatPKR(totalDr)}</span>
            <span className="badge outline">Cr {formatPKR(totalCr)}</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          title={
            mode === 'account' ? (
              <span className="row" style={{ gap: 8 }}><Layers size={15} /> {selectedAccount?.name}</span>
            ) : (
              <span className="row" style={{ gap: 8 }}>
                <Users size={15} /> {selectedParty?.name}
                {selectedParty ? <Avatar name={selectedParty.name} kind={selectedParty.type} size="sm" /> : null}
              </span>
            )
          }
          sub={
            mode === 'account'
              ? `${selectedAccount?.type} · ${selectedAccount?.group} · closing ${formatPKR(naturalBalance(data, accountId, { end: to }))}`
              : `${selectedParty?.type} · ${selectedParty?.paymentTerms} terms · closing ${formatPKR(partyBalance(data, partyId).balance)}`
          }
          icon={<BookOpen size={15} />}
          actions={<span className={`badge ${closing >= 0 ? 'green' : 'red'}`}>Closing {formatPKR(Math.abs(closing))}</span>}
        />
        {rows.length === 0 ? (
          <EmptyState title="No entries in this period" text="Change the date range or select another ledger." />
        ) : (
          <div className="table-wrap" style={{ maxHeight: '58vh', overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>{mode === 'account' ? 'Party' : 'Voucher type'}</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="section"><td colSpan={7}>Opening balance</td><td className="num">{formatPKR(Math.abs(opening))}</td></tr>
                {rows.map((r, i) => (
                  <tr key={`${r.entryId}-${i}`}>
                    <td className="nowrap">{formatDate(r.date)}</td>
                    <td className="mono">{r.reference}</td>
                    <td><TypeBadge type={r.type} label={TYPE_LABELS[r.type]} /></td>
                    <td>{r.description}</td>
                    <td className="small">{mode === 'account' ? r.partyName ?? '—' : TYPE_LABELS[r.type]}</td>
                    <td className="num amount-pos">{r.debit ? formatPKR(r.debit) : '—'}</td>
                    <td className="num amount-neg">{r.credit ? formatPKR(r.credit) : '—'}</td>
                    <td className="num strong">{formatPKR(Math.abs(r.balance))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total">
                  <td colSpan={5}>Closing balance</td>
                  <td className="num">{formatPKR(totalDr)}</td>
                  <td className="num">{formatPKR(totalCr)}</td>
                  <td className="num">{formatPKR(Math.abs(closing))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="card-foot">
          <InfoCallout tone="info">
            {mode === 'account'
              ? 'Balances are shown on the account’s natural side. Opening + debits − credits = closing for this period.'
              : 'Party ledger includes every voucher where this party is tagged, including opening balances.'}
          </InfoCallout>
        </div>
      </Card>
    </Page>
  );
}
