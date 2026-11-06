import { useMemo, useState } from 'react';
import { Printer, FileBarChart, ShieldCheck, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { Page, Card, CardHead, InfoCallout, EmptyState } from '../components/ui';
import { useRange, useStore } from '../demo/store';
import {
  accountLedger, balanceSheet, cashFlow, naturalBalance, partyBalance, partyLedger,
  profitAndLoss, trialBalance, TYPE_LABELS,
} from '../demo/accounting';
import { formatDate, formatPKR } from '../lib/format';

type ReportKey = 'pl' | 'cashflow' | 'trial' | 'balance' | 'party' | 'account';

const REPORTS: { key: ReportKey; label: string; blurb: string }[] = [
  { key: 'pl', label: 'Profit & Loss', blurb: 'Revenue, cost of sales and operating expenses for a period' },
  { key: 'cashflow', label: 'Cash Flow', blurb: 'Direct-method movement in cash and bank accounts' },
  { key: 'trial', label: 'Trial Balance', blurb: 'Every account’s debit or credit balance at a date' },
  { key: 'balance', label: 'Balance Sheet', blurb: 'Assets, liabilities and equity at a date' },
  { key: 'party', label: 'Party Ledger', blurb: 'Full ledger of one customer or supplier' },
  { key: 'account', label: 'Account Ledger', blurb: 'Full ledger of one chart-of-accounts entry' },
];

export default function Reports() {
  const { data } = useStore();
  const { range } = useRange();
  const [report, setReport] = useState<ReportKey>('pl');
  const [partyId, setPartyId] = useState('CUS-001');
  const [accountId, setAccountId] = useState('1010');

  const pl = useMemo(() => profitAndLoss(data, range.start, range.end), [data, range]);
  const cf = useMemo(() => cashFlow(data, range.start, range.end), [data, range]);
  const tb = useMemo(() => trialBalance(data, range.end > data.demoToday ? data.demoToday : range.end), [data, range]);
  const bs = useMemo(() => balanceSheet(data, range.end > data.demoToday ? data.demoToday : range.end), [data, range]);
  const pLedger = useMemo(() => partyLedger(data, partyId, range.start, range.end), [data, partyId, range]);
  const aLedger = useMemo(() => accountLedger(data, accountId, range.start, range.end), [data, accountId, range]);
  const party = data.parties.find((p) => p.id === partyId);
  const account = data.accounts.find((a) => a.id === accountId);
  const meta = REPORTS.find((r) => r.key === report)!;

  /** Export the currently displayed report as CSV (client-side, no server). */
  const exportCsv = () => {
    const lines: string[][] = [[data.business.name], [meta.label], [`Period: ${range.start} to ${range.end}`], []];
    if (report === 'pl') {
      lines.push(['Line', 'Amount']);
      pl.revenue.forEach((r) => lines.push([r.account.name, String(r.amount)]));
      lines.push(['Total revenue', String(pl.totalRevenue)]);
      pl.costOfSales.forEach((r) => lines.push([r.account.name, String(-r.amount)]));
      lines.push(['Gross profit', String(pl.grossProfit)]);
      pl.operatingExpenses.forEach((r) => lines.push([r.account.name, String(-r.amount)]));
      pl.otherIncome.forEach((r) => lines.push([r.account.name, String(r.amount)]));
      lines.push(['Net profit', String(pl.netProfit)]);
    } else if (report === 'cashflow') {
      lines.push(['Item', 'Amount']);
      cf.operatingInflows.forEach((l) => lines.push([l.label, String(l.amount)]));
      cf.operatingOutflows.forEach((l) => lines.push([l.label, String(-l.amount)]));
      lines.push(['Net operating', String(cf.netOperating)], ['Opening cash', String(cf.openingCash)], ['Closing cash', String(cf.closingCash)]);
    } else if (report === 'trial') {
      lines.push(['Code', 'Account', 'Debit', 'Credit']);
      tb.rows.forEach((r) => lines.push([r.account.code, r.account.name, String(r.debit), String(r.credit)]));
      lines.push(['', 'Totals', String(tb.totalDebit), String(tb.totalCredit)]);
    } else if (report === 'balance') {
      lines.push(['Line', 'Amount']);
      bs.assets.forEach((r) => lines.push([r.account.name, String(r.amount)]));
      lines.push(['Total assets', String(bs.totalAssets)], ['Total liabilities', String(bs.totalLiabilities)], ['Total equity', String(bs.totalEquity)]);
    } else if (report === 'party') {
      lines.push(['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance']);
      pLedger.forEach((r) => lines.push([r.date, r.reference, r.description, String(r.debit), String(r.credit), String(r.balance)]));
    } else {
      lines.push(['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance']);
      aLedger.forEach((r) => lines.push([r.date, r.reference, r.description, String(r.debit), String(r.credit), String(r.balance)]));
    }
    const csv = lines.map((row) => row.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meta.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${range.start}-to-${range.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page
      eyebrow="Insights"
      title="Financial Reports"
      subtitle="Interactive demo reports generated from posted journal entries. All reports reconcile to the same ledger."
      actions={
        <>
          <button className="btn" onClick={() => window.print()}><Printer size={15} /> Print / PDF</button>
          <button className="btn primary" onClick={exportCsv}><Download size={15} /> Export CSV</button>
        </>
      }
    >
      <div className="row wrap mb-3 no-print" style={{ gap: 8, marginBottom: 14 }}>
        {REPORTS.map((r) => (
          <button
            key={r.key}
            className={`chip ${report === r.key ? 'lang' : ''}`}
            onClick={() => setReport(r.key)}
            title={r.blurb}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="row wrap mb-3 no-print" style={{ gap: 10, marginBottom: 14 }}>
        <span className="badge outline">Period: {range.label}</span>
        <span className="badge outline">{formatDate(range.start)} → {formatDate(range.end)}</span>
        {report === 'party' ? (
          <select className="select" style={{ width: 240 }} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            {data.parties.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
          </select>
        ) : null}
        {report === 'account' ? (
          <select className="select" style={{ width: 280 }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        ) : null}
      </div>

      <Card>
        <div className="card-head" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow">{data.business.name} · {data.business.currencyCode}</div>
            <div className="card-title" style={{ fontSize: 17 }}>{meta.label}</div>
            <div className="card-sub">
              {report === 'trial' || report === 'balance'
                ? `As at ${formatDate(range.end > data.demoToday ? data.demoToday : range.end)}`
                : `${formatDate(range.start)} → ${formatDate(range.end)}`}
              {' · '}
              {meta.blurb}
            </div>
          </div>
          <div className="card-head-actions">
            {report === 'trial' || report === 'balance' ? (
              <span className={`badge ${tb.balanced && bs.balanced ? 'green' : 'red'}`}>
                {tb.balanced && bs.balanced ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {tb.balanced && bs.balanced ? 'Reconciled' : 'Check failed'}
              </span>
            ) : null}
          </div>
        </div>

        {report === 'pl' && (
          <div className="card-body">
            <table className="table">
              <thead>
                <tr><th>Account</th><th className="num">Amount</th><th className="num">% of revenue</th></tr>
              </thead>
              <tbody>
                <tr className="section"><td colSpan={3}>Revenue</td></tr>
                {pl.revenue.map((r) => (
                  <tr key={r.account.id}><td>{r.account.name}</td><td className="num">{formatPKR(r.amount)}</td><td className="num muted">{((r.amount / (pl.totalRevenue || 1)) * 100).toFixed(1)}%</td></tr>
                ))}
                <tr className="total"><td>Total revenue</td><td className="num">{formatPKR(pl.totalRevenue)}</td><td className="num">100.0%</td></tr>

                <tr className="section"><td colSpan={3}>Cost of sales</td></tr>
                {pl.costOfSales.map((r) => (
                  <tr key={r.account.id}><td>{r.account.name}</td><td className="num">({formatPKR(r.amount)})</td><td className="num muted">{((r.amount / (pl.totalRevenue || 1)) * 100).toFixed(1)}%</td></tr>
                ))}
                <tr className="total"><td>Gross profit</td><td className="num">{formatPKR(pl.grossProfit)}</td><td className="num">{pl.grossMarginPct.toFixed(1)}%</td></tr>

                <tr className="section"><td colSpan={3}>Operating expenses</td></tr>
                {pl.operatingExpenses.map((r) => (
                  <tr key={r.account.id}><td>{r.account.name}</td><td className="num">({formatPKR(r.amount)})</td><td className="num muted">{((r.amount / (pl.totalRevenue || 1)) * 100).toFixed(1)}%</td></tr>
                ))}
                <tr className="total"><td>Total operating expenses</td><td className="num">({formatPKR(pl.totalOperatingExpenses)})</td><td className="num">{((pl.totalOperatingExpenses / (pl.totalRevenue || 1)) * 100).toFixed(1)}%</td></tr>

                <tr className="section"><td colSpan={3}>Other income</td></tr>
                {pl.otherIncome.length === 0 ? <tr><td className="muted">None in this period</td><td className="num">—</td><td /></tr> : pl.otherIncome.map((r) => (
                  <tr key={r.account.id}><td>{r.account.name}</td><td className="num">{formatPKR(r.amount)}</td><td className="num muted">{((r.amount / (pl.totalRevenue || 1)) * 100).toFixed(1)}%</td></tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total" style={{ fontSize: 14 }}>
                  <td>Net profit for the period</td>
                  <td className="num">{formatPKR(pl.netProfit)}</td>
                  <td className="num">{pl.netMarginPct.toFixed(1)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {report === 'cashflow' && (
          <div className="card-body">
            <table className="table">
              <thead>
                <tr><th>Cash flow item</th><th className="num">Amount</th></tr>
              </thead>
              <tbody>
                <tr className="section"><td colSpan={2}>Operating activities — inflows</td></tr>
                {cf.operatingInflows.map((l) => <tr key={l.label}><td>{l.label}</td><td className="num">{formatPKR(l.amount)}</td></tr>)}
                <tr className="total"><td>Total inflows</td><td className="num">{formatPKR(cf.operatingInflows.reduce((s, l) => s + l.amount, 0))}</td></tr>
                <tr className="section"><td colSpan={2}>Operating activities — outflows</td></tr>
                {cf.operatingOutflows.map((l) => <tr key={l.label}><td>{l.label}</td><td className="num">({formatPKR(l.amount)})</td></tr>)}
                <tr className="total"><td>Total outflows</td><td className="num">({formatPKR(cf.operatingOutflows.reduce((s, l) => s + l.amount, 0))})</td></tr>
                <tr className="total"><td>Net cash from operating activities</td><td className="num">{formatPKR(cf.netOperating)}</td></tr>
                {cf.financing.length > 0 ? (
                  <>
                    <tr className="section"><td colSpan={2}>Financing activities</td></tr>
                    {cf.financing.map((l) => <tr key={l.label}><td>{l.label}</td><td className="num">{formatPKR(l.amount)}</td></tr>)}
                    <tr className="total"><td>Net cash from financing</td><td className="num">{formatPKR(cf.netFinancing)}</td></tr>
                  </>
                ) : null}
                <tr className="total"><td>Net change in cash &amp; bank</td><td className="num">{formatPKR(cf.netChange)}</td></tr>
              </tbody>
              <tfoot>
                <tr className="total"><td>Opening cash &amp; bank</td><td className="num">{formatPKR(cf.openingCash)}</td></tr>
                <tr className="total" style={{ fontSize: 14 }}><td>Closing cash &amp; bank</td><td className="num">{formatPKR(cf.closingCash)}</td></tr>
              </tfoot>
            </table>
            <div className="mt-3">
              <InfoCallout tone={cf.reconciles ? 'success' : 'danger'} title={cf.reconciles ? 'Reconciles' : 'Does not reconcile'}>
                Opening {formatPKR(cf.openingCash)} + net movement {formatPKR(cf.netChange)} = {formatPKR(cf.openingCash + cf.netChange)} · closing balance {formatPKR(cf.closingCash)}.
              </InfoCallout>
            </div>
          </div>
        )}

        {report === 'trial' && (
          <div className="card-body">
            <table className="table">
              <thead>
                <tr><th>Code</th><th>Account</th><th>Type</th><th className="num">Debit</th><th className="num">Credit</th></tr>
              </thead>
              <tbody>
                {tb.rows.map((r) => (
                  <tr key={r.account.id}>
                    <td className="mono">{r.account.code}</td>
                    <td>{r.account.name}</td>
                    <td className="small muted">{r.account.type}</td>
                    <td className="num">{r.debit ? formatPKR(r.debit) : '—'}</td>
                    <td className="num">{r.credit ? formatPKR(r.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total"><td colSpan={3}>Totals</td><td className="num">{formatPKR(tb.totalDebit)}</td><td className="num">{formatPKR(tb.totalCredit)}</td></tr>
              </tfoot>
            </table>
            <div className="mt-3">
              <InfoCallout tone={tb.balanced ? 'success' : 'danger'} title={tb.balanced ? 'Trial balance agrees' : 'Trial balance does not agree'}>
                Total debits {formatPKR(tb.totalDebit)} and total credits {formatPKR(tb.totalCredit)} · difference {formatPKR(tb.difference)}.
              </InfoCallout>
            </div>
          </div>
        )}

        {report === 'balance' && (
          <div className="card-body">
            {!bs.balanced ? (
              <InfoCallout tone="danger" title="Not presented as a verified statement">
                Assets ({formatPKR(bs.totalAssets)}) do not equal liabilities plus equity
                ({formatPKR(bs.totalLiabilities + bs.totalEquity)}). Difference {formatPKR(bs.difference)}.
              </InfoCallout>
            ) : null}
            <div className="grid grid-2" style={{ gap: 20 }}>
              <div>
                <table className="table">
                  <thead><tr><th>Assets</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    <tr className="section"><td colSpan={2}>Current assets</td></tr>
                    {bs.currentAssets.map((r) => <tr key={r.account.id}><td>{r.account.name}</td><td className="num">{formatPKR(r.amount)}</td></tr>)}
                    <tr className="total"><td>Total current assets</td><td className="num">{formatPKR(bs.currentAssets.reduce((s, r) => s + r.amount, 0))}</td></tr>
                    <tr className="section"><td colSpan={2}>Non-current assets</td></tr>
                    {bs.nonCurrentAssets.map((r) => <tr key={r.account.id}><td>{r.account.name}</td><td className="num">{formatPKR(r.amount)}</td></tr>)}
                    <tr className="total"><td>Total non-current assets</td><td className="num">{formatPKR(bs.nonCurrentAssets.reduce((s, r) => s + r.amount, 0))}</td></tr>
                  </tbody>
                  <tfoot>
                    <tr className="total" style={{ fontSize: 14 }}><td>Total assets</td><td className="num">{formatPKR(bs.totalAssets)}</td></tr>
                  </tfoot>
                </table>
              </div>
              <div>
                <table className="table">
                  <thead><tr><th>Liabilities &amp; equity</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    <tr className="section"><td colSpan={2}>Liabilities</td></tr>
                    {bs.liabilities.map((r) => <tr key={r.account.id}><td>{r.account.name}</td><td className="num">{formatPKR(r.amount)}</td></tr>)}
                    <tr className="total"><td>Total liabilities</td><td className="num">{formatPKR(bs.totalLiabilities)}</td></tr>
                    <tr className="section"><td colSpan={2}>Equity</td></tr>
                    {bs.equity.map((r) => <tr key={r.account.id}><td>{r.account.name}</td><td className="num">{formatPKR(r.amount)}</td></tr>)}
                    <tr className="total"><td>Total equity</td><td className="num">{formatPKR(bs.totalEquity)}</td></tr>
                  </tbody>
                  <tfoot>
                    <tr className="total" style={{ fontSize: 14 }}><td>Total liabilities &amp; equity</td><td className="num">{formatPKR(bs.totalLiabilities + bs.totalEquity)}</td></tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="mt-3">
              <InfoCallout tone={bs.balanced ? 'success' : 'danger'} title={bs.balanced ? 'Assets = Liabilities + Equity' : 'Out of balance'}>
                {formatPKR(bs.totalAssets)} = {formatPKR(bs.totalLiabilities)} + {formatPKR(bs.totalEquity)} · difference {formatPKR(bs.difference)}.
                Retained earnings include net profit to date of {formatPKR(bs.netProfitToDate)}.
              </InfoCallout>
            </div>
          </div>
        )}

        {report === 'party' && (
          <div className="card-body">
            {pLedger.length === 0 ? (
              <EmptyState title="No ledger activity" text="This party has no entries in the selected period." />
            ) : (
              <>
                <div className="grid grid-3 mb-3">
                  <div className="bordered rounded" style={{ padding: '10px 12px' }}>
                    <div className="eyebrow">Party</div>
                    <div className="bold">{party?.name}</div>
                    <div className="xsmall muted">{party?.type} · {party?.paymentTerms}</div>
                  </div>
                  <div className="bordered rounded" style={{ padding: '10px 12px' }}>
                    <div className="eyebrow">Closing balance</div>
                    <div className="bold tnum">{formatPKR(partyBalance(data, partyId).balance)}</div>
                    <div className="xsmall muted">{partyBalance(data, partyId).side}</div>
                  </div>
                  <div className="bordered rounded" style={{ padding: '10px 12px' }}>
                    <div className="eyebrow">Entries in period</div>
                    <div className="bold tnum">{pLedger.length}</div>
                    <div className="xsmall muted">{TYPE_LABELS[pLedger[0]!.type]} to {TYPE_LABELS[pLedger[pLedger.length - 1]!.type]}</div>
                  </div>
                </div>
                <table className="table">
                  <thead>
                    <tr><th>Date</th><th>Reference</th><th>Description</th><th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th></tr>
                  </thead>
                  <tbody>
                    {pLedger.map((r, i) => (
                      <tr key={`${r.entryId}-${i}`}>
                        <td className="nowrap">{formatDate(r.date)}</td>
                        <td className="mono">{r.reference}</td>
                        <td>{r.description}</td>
                        <td className="num">{r.debit ? formatPKR(r.debit) : '—'}</td>
                        <td className="num">{r.credit ? formatPKR(r.credit) : '—'}</td>
                        <td className="num strong">{formatPKR(Math.abs(r.balance))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total">
                      <td colSpan={3}>Totals</td>
                      <td className="num">{formatPKR(pLedger.reduce((s, r) => s + r.debit, 0))}</td>
                      <td className="num">{formatPKR(pLedger.reduce((s, r) => s + r.credit, 0))}</td>
                      <td className="num">{formatPKR(Math.abs(pLedger[pLedger.length - 1]!.balance))}</td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}
          </div>
        )}

        {report === 'account' && (
          <div className="card-body">
            {aLedger.length === 0 ? (
              <EmptyState title="No movements" text="This account has no entries in the selected period." />
            ) : (
              <>
                <div className="row mb-3" style={{ gap: 10 }}>
                  <span className="badge navy">{account?.code} · {account?.name}</span>
                  <span className="badge outline">{account?.type}</span>
                  <span className="spacer" />
                  <span className="small muted">Closing balance</span>
                  <span className="bold tnum">{formatPKR(naturalBalance(data, accountId, { end: range.end }))}</span>
                </div>
                <table className="table">
                  <thead>
                    <tr><th>Date</th><th>Reference</th><th>Type</th><th>Description</th><th>Party</th><th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th></tr>
                  </thead>
                  <tbody>
                    {aLedger.map((r, i) => (
                      <tr key={`${r.entryId}-${i}`}>
                        <td className="nowrap">{formatDate(r.date)}</td>
                        <td className="mono">{r.reference}</td>
                        <td><span className="badge outline">{TYPE_LABELS[r.type]}</span></td>
                        <td>{r.description}</td>
                        <td className="small">{r.partyName ?? '—'}</td>
                        <td className="num">{r.debit ? formatPKR(r.debit) : '—'}</td>
                        <td className="num">{r.credit ? formatPKR(r.credit) : '—'}</td>
                        <td className="num strong">{formatPKR(Math.abs(r.balance))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        <div className="card-foot">
          <ShieldCheck size={14} className="muted" />
          <span className="xsmall muted">
            {data.business.name} · {data.business.fiscalYearLabel} · demo statement generated from the isolated demo ledger.
            Not an audited or statutory financial statement.
          </span>
          <span className="spacer" />
          <span className="xsmall muted">Printed {formatDate(data.demoToday)}</span>
        </div>
      </Card>

      <div className="mt-3" style={{ marginTop: 16 }}>
        <InfoCallout tone="info" title="Report integrity">
          Trial balance {tb.balanced ? 'agrees' : 'does not agree'} · Balance sheet {bs.balanced ? 'balances' : 'does not balance'} ·
          Cash flow {cf.reconciles ? 'reconciles' : 'does not reconcile'}. These checks run on the live demo data every time a
          report is opened.
        </InfoCallout>
      </div>
    </Page>
  );
}
