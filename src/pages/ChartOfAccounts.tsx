import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ListTree, BookOpen, Wallet, Landmark, Boxes } from 'lucide-react';
import { Page, Card, CardHead, InfoCallout } from '../components/ui';
import { useStore } from '../demo/store';
import { balanceSheet, naturalBalance, signedBalance } from '../demo/accounting';
import { formatPKR } from '../lib/format';
import type { AccountType } from '../demo/types';

const GROUPS: { type: AccountType; label: string; tone: string; blurb: string }[] = [
  { type: 'asset', label: 'Assets', tone: 'blue', blurb: 'What the business owns' },
  { type: 'liability', label: 'Liabilities', tone: 'amber', blurb: 'What the business owes' },
  { type: 'equity', label: 'Equity', tone: 'violet', blurb: 'Owner capital and retained earnings' },
  { type: 'income', label: 'Income', tone: 'green', blurb: 'Revenue earned' },
  { type: 'expense', label: 'Expenses', tone: 'red', blurb: 'Costs incurred' },
];

export default function ChartOfAccounts() {
  const { data } = useStore();
  const [search, setSearch] = useState('');
  const bs = useMemo(() => balanceSheet(data, data.demoToday), [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.accounts.filter(
      (a) => !q || a.name.toLowerCase().includes(q) || a.code.includes(q) || a.group.toLowerCase().includes(q),
    );
  }, [data.accounts, search]);

  const counts = (id: string) => data.entries.filter((e) => e.lines.some((l) => l.accountId === id)).length;

  return (
    <Page
      eyebrow="Accounting"
      title="Chart of Accounts"
      subtitle="The five account types, their balances and how each ledger is built from posted journal lines."
      actions={
        <div className="input-group" style={{ width: 250 }}>
          <Search size={15} />
          <input className="input" placeholder="Search code, name or group…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      }
    >
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon blue"><Boxes size={16} /></div><div className="kpi-label">Total assets</div></div>
          <div className="kpi-value">{formatPKR(bs.totalAssets)}</div>
          <div className="kpi-meta">as at demo date</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon amber"><Wallet size={16} /></div><div className="kpi-label">Total liabilities</div></div>
          <div className="kpi-value">{formatPKR(bs.totalLiabilities)}</div>
          <div className="kpi-meta">loan + payables</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon violet"><Landmark size={16} /></div><div className="kpi-label">Total equity</div></div>
          <div className="kpi-value">{formatPKR(bs.totalEquity)}</div>
          <div className="kpi-meta">capital + profit to date</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon green"><ListTree size={16} /></div><div className="kpi-label">Accounts</div></div>
          <div className="kpi-value">{data.accounts.length}</div>
          <div className="kpi-meta">{data.accounts.filter((a) => signedBalance(data, a.id, { end: data.demoToday }) !== 0).length} with balances</div>
        </div>
      </div>

      <div className="stack" style={{ gap: 16 }}>
        {GROUPS.map((g) => {
          const accounts = filtered.filter((a) => a.type === g.type);
          if (!accounts.length) return null;
          const total = accounts.reduce((s, a) => s + naturalBalance(data, a.id, { end: data.demoToday }), 0);
          return (
            <Card key={g.type}>
              <CardHead
                title={<span className="row" style={{ gap: 8 }}>{g.label} <span className={`badge ${g.tone}`}>{g.blurb}</span></span>}
                sub={`${accounts.length} accounts`}
                actions={<span className="bold tnum">{formatPKR(total)}</span>}
              />
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Account name</th>
                      <th>Group</th>
                      <th>Normal balance</th>
                      <th className="num">Opening</th>
                      <th className="num">Current balance</th>
                      <th className="num">Entries</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.id}>
                        <td className="mono strong">{a.code}</td>
                        <td>
                          <div className="cell-title">{a.name}</div>
                          <div className="cell-sub">{a.description}</div>
                        </td>
                        <td className="small">{a.group}</td>
                        <td><span className="badge outline">{a.normalBalance === 'debit' ? 'Debit' : 'Credit'}</span></td>
                        <td className="num muted">{a.openingBalance ? formatPKR(a.openingBalance) : '—'}</td>
                        <td className="num strong">{formatPKR(naturalBalance(data, a.id, { end: data.demoToday }))}</td>
                        <td className="num muted">{counts(a.id)}</td>
                        <td className="right">
                          <Link className="btn xs" to={`/ledgers?account=${a.id}`}><BookOpen size={12} /> Ledger</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-3" style={{ marginTop: 16 }}>
        <InfoCallout tone="info" title="Accounting model">
          This demo uses a simple, consistent model: sales post revenue and cost of goods sold (70% of invoice value) against
          inventory; purchases increase inventory and accounts payable; receipts and payments settle the control accounts
          with the party tagged on the line. Every voucher is stored as balanced journal lines.
        </InfoCallout>
      </div>
    </Page>
  );
}
