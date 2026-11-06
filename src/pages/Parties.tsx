import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Users, Truck, ArrowDownLeft, ArrowUpRight, Phone, Mail, MapPin, BookOpen } from 'lucide-react';
import { Page, Card, CardHead, Avatar, Segmented, EmptyState, InfoCallout } from '../components/ui';
import { useStore } from '../demo/store';
import { partyBalance } from '../demo/accounting';
import { formatPKR, formatDate } from '../lib/format';

type Tab = 'all' | 'customer' | 'supplier';

export default function Parties() {
  const { data } = useStore();
  const [params, setParams] = useSearchParams();
  const initial = (params.get('type') as Tab) ?? 'all';
  const [tab, setTab] = useState<Tab>(initial === 'customer' || initial === 'supplier' ? initial : 'all');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.parties
      .filter((p) => (tab === 'all' ? true : p.type === tab))
      .filter((p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.contactPerson.toLowerCase().includes(q) ||
        p.phone.includes(q),
      )
      .map((p) => ({ party: p, bal: partyBalance(data, p.id) }))
      .sort((a, b) => b.bal.balance - a.bal.balance);
  }, [data, tab, search]);

  const receivable = data.parties.filter((p) => p.type === 'customer').reduce((s, p) => {
    const b = partyBalance(data, p.id);
    return s + (b.side === 'receivable' ? b.balance : 0);
  }, 0);
  const payable = data.parties.filter((p) => p.type === 'supplier').reduce((s, p) => {
    const b = partyBalance(data, p.id);
    return s + (b.side === 'payable' ? b.balance : 0);
  }, 0);

  return (
    <Page
      eyebrow="Accounting"
      title="Parties"
      subtitle="Customers and suppliers with opening balances, live ledgers and outstanding positions — all derived from posted vouchers."
      actions={<Segmented value={tab} options={[{ value: 'all', label: 'All' }, { value: 'customer', label: 'Customers' }, { value: 'supplier', label: 'Suppliers' }]} onChange={(v) => { setTab(v); setParams(v === 'all' ? {} : { type: v }, { replace: true }); }} />}
    >
      <div className="grid grid-4 mb-3" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon blue"><Users size={16} /></div><div className="kpi-label">Customers</div></div>
          <div className="kpi-value">{data.parties.filter((p) => p.type === 'customer').length}</div>
          <div className="kpi-meta">active accounts</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon teal"><Truck size={16} /></div><div className="kpi-label">Suppliers</div></div>
          <div className="kpi-value">{data.parties.filter((p) => p.type === 'supplier').length}</div>
          <div className="kpi-meta">active accounts</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon amber"><ArrowDownLeft size={16} /></div><div className="kpi-label">Total Receivable</div></div>
          <div className="kpi-value">{formatPKR(receivable)}</div>
          <div className="kpi-meta">to be collected</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon red"><ArrowUpRight size={16} /></div><div className="kpi-label">Total Payable</div></div>
          <div className="kpi-value">{formatPKR(payable)}</div>
          <div className="kpi-meta">to be paid</div>
        </div>
      </div>

      <Card>
        <CardHead
          title={tab === 'customer' ? 'Customers' : tab === 'supplier' ? 'Suppliers' : 'All parties'}
          sub={`${rows.length} record${rows.length === 1 ? '' : 's'} · balances as at ${formatDate(data.demoToday)}`}
          actions={
            <div className="input-group" style={{ width: 260 }}>
              <Search size={15} />
              <input className="input" placeholder="Search name, code, city, phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          }
        />
        {rows.length === 0 ? (
          <EmptyState title="No parties found" text="Adjust the search or switch tabs." icon={<Users size={20} />} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Party</th>
                  <th>Contact</th>
                  <th>City</th>
                  <th>Terms</th>
                  <th className="num">Opening</th>
                  <th className="num">Current balance</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ party, bal }) => (
                  <tr key={party.id}>
                    <td>
                      <div className="cell-main">
                        <Avatar name={party.name} kind={party.type} />
                        <div>
                          <Link to={`/parties/${party.id}`} className="cell-title">{party.name}</Link>
                          <div className="cell-sub">{party.code} · {party.type === 'customer' ? 'Customer' : 'Supplier'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="small">{party.contactPerson}</div>
                      <div className="cell-sub row" style={{ gap: 8 }}>
                        <span><Phone size={10} style={{ verticalAlign: -1 }} /> {party.phone}</span>
                      </div>
                    </td>
                    <td className="small">{party.city}</td>
                    <td><span className="tag">{party.paymentTerms}</span></td>
                    <td className="num muted">{party.openingBalance ? formatPKR(party.openingBalance) : '—'}</td>
                    <td className="num strong">{formatPKR(bal.balance)}</td>
                    <td>
                      {bal.side === 'settled' ? (
                        <span className="badge outline">Settled</span>
                      ) : bal.side === 'receivable' ? (
                        <span className="badge blue">Receivable</span>
                      ) : (
                        <span className="badge amber">Payable</span>
                      )}
                    </td>
                    <td className="right">
                      <Link to={`/parties/${party.id}`} className="btn xs"><BookOpen size={12} /> Ledger</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-foot">
          <InfoCallout tone="info">
            Party balances are computed from the party-tagged lines of every posted journal entry — they always agree with
            the Accounts Receivable (1100) and Accounts Payable (2000) control accounts.
          </InfoCallout>
        </div>
      </Card>
    </Page>
  );
}

export function PartyQuickFacts({ id }: { id: string }) {
  const { data } = useStore();
  const party = data.parties.find((p) => p.id === id);
  if (!party) return null;
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 7 }}><Phone size={13} className="muted" /><span className="small">{party.phone}</span></div>
      <div className="row" style={{ gap: 7 }}><Mail size={13} className="muted" /><span className="small">{party.email}</span></div>
      <div className="row" style={{ gap: 7 }}><MapPin size={13} className="muted" /><span className="small">{party.address}</span></div>
    </div>
  );
}
