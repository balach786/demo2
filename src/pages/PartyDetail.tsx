import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Phone, Mail, MapPin, Building2, Plus, Sparkles, Printer } from 'lucide-react';
import { Page, Card, CardHead, Avatar, EmptyState, TypeBadge, InfoCallout } from '../components/ui';
import { GroupedBarChart } from '../components/charts';
import { useStore } from '../demo/store';
import { partyBalance, partyLedger, TYPE_LABELS } from '../demo/accounting';
import { formatDate, formatPKR, monthKey } from '../lib/format';

export default function PartyDetail() {
  const { id } = useParams<{ id: string }>();
  const { data } = useStore();
  const navigate = useNavigate();
  const party = data.parties.find((p) => p.id === id);
  const [from, setFrom] = useState(data.fiscalYearStart);
  const [to, setTo] = useState(data.demoToday);

  const ledger = useMemo(() => (party ? partyLedger(data, party.id, from, to) : []), [data, party, from, to]);
  const bal = party ? partyBalance(data, party.id) : null;
  const opening = ledger.length ? ledger[0]!.balance - (ledger[0]!.debit - ledger[0]!.credit) : 0;
  const closing = ledger.length ? ledger[ledger.length - 1]!.balance : opening;
  const totalDr = ledger.reduce((s, r) => s + r.debit, 0);
  const totalCr = ledger.reduce((s, r) => s + r.credit, 0);

  const monthly = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>();
    for (const r of partyLedger(data, party?.id ?? '')) {
      const k = monthKey(r.date);
      const cur = map.get(k) ?? { debit: 0, credit: 0 };
      cur.debit += r.debit;
      cur.credit += r.credit;
      map.set(k, cur);
    }
    const keys = [...map.keys()].sort().slice(-8);
    return keys.map((k) => ({ label: k, ...map.get(k)! }));
  }, [data, party]);

  if (!party || !bal) {
    return (
      <Page title="Party not found" subtitle="This party does not exist in the demo dataset.">
        <Card><EmptyState title="Unknown party" text="Return to the parties list to pick a customer or supplier." action={<Link className="btn primary" to="/parties">Back to parties</Link>} /></Card>
      </Page>
    );
  }

  return (
    <Page
      eyebrow={`${party.type === 'customer' ? 'Customer' : 'Supplier'} · ${party.code}`}
      title={party.name}
      subtitle={`Party since ${formatDate(party.since)} · ${party.paymentTerms} payment terms · balances from posted vouchers only`}
      actions={
        <>
          <button className="btn" onClick={() => window.print()}><Printer size={15} /> Print ledger</button>
          <button className="btn" onClick={() => navigate(`/ai`)}><Sparkles size={15} /> Ask AI about {party.name.split(' ')[0]}</button>
          <button className="btn primary" onClick={() => navigate(party.type === 'customer' ? '/transactions?new=1' : '/transactions?new=1')}>
            <Plus size={15} /> New {party.type === 'customer' ? 'receipt' : 'payment'}
          </button>
        </>
      }
    >
      <div className="row mb-3" style={{ gap: 8 }}>
        <Link to="/parties" className="btn sm"><ArrowLeft size={14} /> All parties</Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon blue"><BookOpen size={16} /></div><div className="kpi-label">Current balance</div></div>
          <div className="kpi-value">{formatPKR(bal.balance)}</div>
          <div className="kpi-meta">
            <span className={`badge ${bal.side === 'receivable' ? 'blue' : bal.side === 'payable' ? 'amber' : 'outline'}`}>
              {bal.side === 'receivable' ? 'Receivable' : bal.side === 'payable' ? 'Payable' : 'Settled'}
            </span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon teal"><Building2 size={16} /></div><div className="kpi-label">Opening balance</div></div>
          <div className="kpi-value">{formatPKR(party.openingBalance)}</div>
          <div className="kpi-meta">{party.openingBalanceType === 'debit' ? 'Debit (owed to us)' : 'Credit (we owe)'}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon green"><Plus size={16} /></div><div className="kpi-label">Total debited</div></div>
          <div className="kpi-value">{formatPKR(bal.debit)}</div>
          <div className="kpi-meta">since inception</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon amber"><Plus size={16} /></div><div className="kpi-label">Total credited</div></div>
          <div className="kpi-value">{formatPKR(bal.credit)}</div>
          <div className="kpi-meta">since inception</div>
        </div>
      </div>

      <div className="grid grid-sidebar-left" style={{ marginBottom: 16 }}>
        <Card>
          <CardHead title="Party profile" sub="Fictional demo record" icon={<Building2 size={15} />} />
          <div className="card-body">
            <div className="row" style={{ gap: 12, marginBottom: 14 }}>
              <Avatar name={party.name} kind={party.type} size="lg" />
              <div>
                <div className="bold">{party.name}</div>
                <div className="small muted">{party.contactPerson} · {party.type === 'customer' ? 'Customer' : 'Supplier'}</div>
              </div>
            </div>
            <div className="stack" style={{ gap: 9 }}>
              <div className="row" style={{ gap: 8 }}><Phone size={13} className="muted" /><span className="small">{party.phone}</span></div>
              <div className="row" style={{ gap: 8 }}><Mail size={13} className="muted" /><span className="small">{party.email}</span></div>
              <div className="row" style={{ gap: 8 }}><MapPin size={13} className="muted" /><span className="small">{party.address}</span></div>
            </div>
            <div className="divider dashed" />
            <div className="row between small"><span className="muted">NTN</span><span className="mono">{party.ntn}</span></div>
            <div className="row between small mt-2"><span className="muted">Payment terms</span><span className="tag">{party.paymentTerms}</span></div>
            <div className="row between small mt-2"><span className="muted">City</span><span>{party.city}</span></div>
            {party.creditLimit > 0 ? (
              <div className="row between small mt-2"><span className="muted">Credit limit</span><span className="tnum">{formatPKR(party.creditLimit)}</span></div>
            ) : null}
          </div>
        </Card>

        <Card className="chart-card">
          <CardHead title="Monthly activity" sub="Debits vs credits posted to this party" />
          <div className="card-body">
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-swatch" style={{ background: '#2563eb' }} /> Debit</span>
              <span className="legend-item"><span className="legend-swatch" style={{ background: '#0e9f8a' }} /> Credit</span>
            </div>
            <GroupedBarChart
              labels={monthly.map((m) => m.label)}
              series={[
                { name: 'Debit', color: '#2563eb', values: monthly.map((m) => m.debit) },
                { name: 'Credit', color: '#0e9f8a', values: monthly.map((m) => m.credit) },
              ]}
              height={230}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHead
          title="Ledger history"
          sub={`${ledger.length} entries · opening ${formatPKR(opening)} · closing ${formatPKR(closing)}`}
          icon={<BookOpen size={15} />}
          actions={
            <div className="row" style={{ gap: 6 }}>
              <input className="input" style={{ width: 148 }} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              <span className="small muted">to</span>
              <input className="input" style={{ width: 148 }} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </div>
          }
        />
        {ledger.length === 0 ? (
          <EmptyState title="No ledger activity in this period" text="Widen the date range to see earlier entries." />
        ) : (
          <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                  <th className="num">Running balance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="section"><td colSpan={6}>Opening balance</td><td className="num">{formatPKR(opening)}</td></tr>
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
              <tfoot>
                <tr className="total">
                  <td colSpan={4}>Closing balance</td>
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
            Debit increases what the party owes you; credit reduces it. The closing balance above equals the party balance
            shown across the application.
          </InfoCallout>
        </div>
      </Card>
    </Page>
  );
}
