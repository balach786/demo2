import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Wallet, Landmark, TrendingUp, ShoppingCart, Receipt, PiggyBank, ArrowDownLeft,
  ArrowUpRight, Boxes, Sparkles, Plus, FileUp, ShieldCheck, ArrowRight, CheckCircle2,
  Clock3, Activity as ActivityIcon, Users, AlertCircle,
} from 'lucide-react';
import { Page, Card, CardHead, Kpi, TypeBadge, Avatar, InfoCallout } from '../components/ui';
import { LineAreaChart, GroupedBarChart, BarList, Sparkline } from '../components/charts';
import { useRange, useStore } from '../demo/store';
import {
  dashboardSummary, entryAmount, partyBalance, trialBalance, TYPE_LABELS,
} from '../demo/accounting';
import { formatCompactPKR, formatDate, formatPKR, formatRelative } from '../lib/format';

const BLUE = '#2563eb';
const TEAL = '#0e9f8a';
const AMBER = '#d99a2b';
const RED = '#d92d20';
const VIOLET = '#6d4aff';

export default function Dashboard() {
  const { data } = useStore();
  const { range } = useRange();
  const navigate = useNavigate();
  const summary = useMemo(() => dashboardSummary(data, range), [data, range]);
  const tb = useMemo(() => trialBalance(data, data.demoToday), [data]);
  const m = summary.monthly;

  const pct = (curr: number, prior: number) => (prior ? ((curr - prior) / Math.abs(prior)) * 100 : 0);
  const delta = (curr: number, prior: number) => {
    const p = pct(curr, prior);
    return {
      value: `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`,
      direction: (p > 0.4 ? 'up' : p < -0.4 ? 'down' : 'flat') as 'up' | 'down' | 'flat',
      label: 'vs previous period',
    };
  };

  const recent = useMemo(
    () =>
      [...data.entries]
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)))
        .slice(0, 7),
    [data.entries],
  );

  const topCustomers = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of data.entries) {
      if (e.type !== 'sales' || e.date < range.start || e.date > range.end) continue;
      const partyId = e.lines.find((l) => l.partyId)?.partyId;
      if (!partyId) continue;
      const rev = e.lines.filter((l) => l.accountId === '4000').reduce((s, l) => s + l.credit, 0);
      totals.set(partyId, (totals.get(partyId) ?? 0) + rev);
    }
    return [...totals.entries()]
      .map(([id, value]) => ({ label: data.parties.find((p) => p.id === id)?.name ?? id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [data, range]);

  const receivables = useMemo(
    () =>
      data.parties
        .map((p) => ({ party: p, bal: partyBalance(data, p.id) }))
        .filter((x) => x.party.type === 'customer' && x.bal.side === 'receivable')
        .sort((a, b) => b.bal.balance - a.bal.balance)
        .slice(0, 4),
    [data],
  );
  const payables = useMemo(
    () =>
      data.parties
        .map((p) => ({ party: p, bal: partyBalance(data, p.id) }))
        .filter((x) => x.party.type === 'supplier' && x.bal.side === 'payable')
        .sort((a, b) => b.bal.balance - a.bal.balance)
        .slice(0, 4),
    [data],
  );

  const inventorySeries = m.map((p) => p.profit);

  return (
    <Page
      eyebrow="Executive Overview"
      title="Business at a glance"
      subtitle={`${data.business.name} · ${data.business.fiscalYearLabel} · All figures derive from the same journal ledger.`}
      actions={
        <>
          <button className="btn" onClick={() => navigate('/documents')}>
            <FileUp size={15} /> Upload document
          </button>
          <button className="btn primary" onClick={() => navigate('/transactions?new=1')}>
            <Plus size={15} /> New transaction
          </button>
        </>
      }
    >
      {/* demo notice */}
      <div
        className="callout warn mb-3"
        style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}
      >
        <div className="row" style={{ gap: 9 }}>
          <AlertCircle size={15} />
          <div>
            <strong>Demonstration data only.</strong> Fictional business (ABC Trading Company). No production database,
            bank or OpenAI connection is used anywhere in this demo.
          </div>
        </div>
        <Link to="/settings" className="xsmall bold nowrap" style={{ color: 'inherit' }}>
          Demo details →
        </Link>
      </div>

      {/* reconciliation strip */}
      <div className="row wrap" style={{ gap: 10, marginBottom: 14 }}>
        <span className={`badge ${tb.balanced ? 'green' : 'red'}`}>
          {tb.balanced ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          Books {tb.balanced ? 'balanced' : 'out of balance'}
        </span>
        <span className="badge outline">{data.entries.length} journal entries</span>
        <span className="badge outline">{formatPKR(tb.totalDebit)} debit = credit</span>
        <span className="badge outline">Period: {range.label}</span>
        <span className="spacer" />
        <Link to="/reports" className="small bold" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Open financial reports <ArrowRight size={13} />
        </Link>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <Kpi
          label="Total Cash Balance"
          value={formatPKR(summary.cashBalance)}
          icon={<Wallet size={16} />}
          tone="teal"
          hint={`as at ${formatDate(summary.asOf)}`}
          spark={<Sparkline values={m.map((p) => p.cashIn - p.cashOut)} color={TEAL} />}
          link={<Link to="/banks" className="kpi-link">View</Link>}
        />
        <Kpi
          label="Total Bank Balance"
          value={formatPKR(summary.bankBalance)}
          icon={<Landmark size={16} />}
          tone="navy"
          hint="HBL + Meezan"
          spark={<Sparkline values={m.map((p) => p.revenue * 0.1)} color={BLUE} />}
          link={<Link to="/banks" className="kpi-link">View</Link>}
        />
        <Kpi
          label="Total Sales"
          value={formatPKR(summary.totalSales)}
          icon={<TrendingUp size={16} />}
          tone="blue"
          delta={delta(summary.totalSales, summary.prior.totalSales)}
          spark={<Sparkline values={m.map((p) => p.revenue)} color={BLUE} />}
          link={<Link to="/transactions?type=sales" className="kpi-link">View</Link>}
        />
        <Kpi
          label="Net Profit"
          value={formatPKR(summary.netProfit)}
          icon={<PiggyBank size={16} />}
          tone="green"
          delta={delta(summary.netProfit, summary.prior.netProfit)}
          spark={<Sparkline values={inventorySeries} color={VIOLET} />}
          link={<Link to="/reports" className="kpi-link">P&amp;L</Link>}
        />
        <Kpi
          label="Total Purchases"
          value={formatPKR(summary.totalPurchases)}
          icon={<ShoppingCart size={16} />}
          tone="violet"
          delta={delta(summary.totalPurchases, summary.prior.totalPurchases)}
          link={<Link to="/transactions?type=purchase" className="kpi-link">View</Link>}
        />
        <Kpi
          label="Total Expenses"
          value={formatPKR(summary.totalExpenses)}
          icon={<Receipt size={16} />}
          tone="amber"
          delta={delta(summary.totalExpenses, summary.prior.totalExpenses)}
          hint="operating expenses"
          link={<Link to="/income-expenses" className="kpi-link">View</Link>}
        />
        <Kpi
          label="Accounts Receivable"
          value={formatPKR(summary.accountsReceivable)}
          icon={<ArrowDownLeft size={16} />}
          tone="blue"
          hint="customers owe you"
          link={<Link to="/parties?type=customer" className="kpi-link">View</Link>}
        />
        <Kpi
          label="Accounts Payable"
          value={formatPKR(summary.accountsPayable)}
          icon={<ArrowUpRight size={16} />}
          tone="red"
          hint="you owe suppliers"
          link={<Link to="/parties?type=supplier" className="kpi-link">View</Link>}
        />
        <Kpi
          label="Total Inventory Value"
          value={formatPKR(summary.inventoryValue)}
          icon={<Boxes size={16} />}
          tone="teal"
          hint="at cost · from ledger"
          link={<Link to="/chart-of-accounts" className="kpi-link">View</Link>}
        />
      </div>

      {/* AI banner */}
      <div className="card pad mb-3" style={{ background: 'linear-gradient(120deg, #08172e 0%, #12305a 55%, #0b4a49 100%)', border: 'none' }}>
        <div className="row wrap" style={{ gap: 16 }}>
          <div className="ai-orb" style={{ width: 42, height: 42 }}>
            <Sparkles size={19} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Ask your AI Secretary anything about the business</div>
            <div style={{ color: '#a9bdd8', fontSize: 12.6, marginTop: 3 }}>
              “Aaj ki total sales kitni hain?” · “Ahmed ka ledger dikhao.” · “Prepare a payment of Rs. 25,000 to ABC Traders.”
            </div>
          </div>
          <div className="spacer" />
          <button className="btn teal" onClick={() => navigate('/ai')}>
            <Sparkles size={15} /> Open AI Command Center
          </button>
        </div>
      </div>

      {/* charts */}
      <div className="grid grid-2 mb-3" style={{ marginBottom: 16 }}>
        <Card className="chart-card">
          <CardHead
            title="Revenue vs Expenses"
            sub={`${range.label} · monthly`}
            actions={<span className="badge blue">{formatPKR(summary.totalSales)} revenue</span>}
          />
          <div className="card-body">
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-swatch" style={{ background: BLUE }} /> Revenue</span>
              <span className="legend-item"><span className="legend-swatch" style={{ background: RED }} /> Expenses</span>
              <span className="spacer" />
              <span className="xsmall muted">Hover for details</span>
            </div>
            <LineAreaChart
              labels={m.map((p) => p.label)}
              series={[
                { name: 'Revenue', color: BLUE, values: m.map((p) => p.revenue) },
                { name: 'Expenses', color: RED, values: m.map((p) => p.cogs + p.expenses) },
              ]}
              height={268}
            />
          </div>
        </Card>

        <Card className="chart-card">
          <CardHead
            title="Monthly Profit"
            sub={`Net profit ${formatPKR(summary.netProfit)}`}
            actions={<span className="badge green">{summary.netMarginPct.toFixed(1)}% margin</span>}
          />
          <div className="card-body">
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-swatch" style={{ background: TEAL }} /> Net profit</span>
              <span className="spacer" />
              <span className="xsmall muted">Gross profit {formatPKR(summary.grossProfit)}</span>
            </div>
            <GroupedBarChart
              labels={m.map((p) => p.label)}
              series={[{ name: 'Net profit', color: TEAL, values: m.map((p) => p.profit) }]}
              height={268}
              allowNegative
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <Card className="chart-card">
          <CardHead
            title="Cash Flow"
            sub="Money in and out of cash + bank accounts"
            actions={
              <span className={`badge ${summary.netCashFlow >= 0 ? 'green' : 'red'}`}>
                {summary.netCashFlow >= 0 ? '+' : ''}{formatPKR(summary.netCashFlow)} net
              </span>
            }
          />
          <div className="card-body">
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-swatch" style={{ background: TEAL }} /> Cash in</span>
              <span className="legend-item"><span className="legend-swatch" style={{ background: AMBER }} /> Cash out</span>
            </div>
            <LineAreaChart
              labels={m.map((p) => p.label)}
              series={[
                { name: 'Cash in', color: TEAL, values: m.map((p) => p.cashIn) },
                { name: 'Cash out', color: AMBER, values: m.map((p) => p.cashOut) },
              ]}
              height={236}
            />
          </div>
        </Card>

        <Card className="chart-card">
          <CardHead
            title="Sales vs Purchases"
            sub="Trading activity by month"
            actions={<span className="badge outline">GP {summary.grossMarginPct.toFixed(1)}%</span>}
          />
          <div className="card-body">
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-swatch" style={{ background: BLUE }} /> Sales</span>
              <span className="legend-item"><span className="legend-swatch" style={{ background: VIOLET }} /> Purchases</span>
            </div>
            <GroupedBarChart
              labels={m.map((p) => p.label)}
              series={[
                { name: 'Sales', color: BLUE, values: m.map((p) => p.sales) },
                { name: 'Purchases', color: VIOLET, values: m.map((p) => p.purchases) },
              ]}
              height={236}
            />
          </div>
        </Card>
      </div>

      {/* tables */}
      <div className="grid grid-sidebar" style={{ marginBottom: 16 }}>
        <Card>
          <CardHead
            title="Recent Transactions"
            sub="Latest posted vouchers from the shared ledger"
            actions={<Link to="/transactions" className="btn sm">View all</Link>}
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e) => (
                  <tr
                    key={e.id}
                    className="clickable"
                    onClick={() => navigate(`/transactions?entry=${e.id}`)}
                    tabIndex={0}
                    onKeyDown={(ev) => ev.key === 'Enter' && navigate(`/transactions?entry=${e.id}`)}
                  >
                    <td className="nowrap">{formatDate(e.date)}</td>
                    <td className="mono">{e.reference}</td>
                    <td className="strong desc">{e.description}</td>
                    <td><TypeBadge type={e.type} label={TYPE_LABELS[e.type]} /></td>
                    <td className="num strong">{formatPKR(entryAmount(e))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card>
            <CardHead title="Top Customers" sub="By sales in selected period" icon={<Users size={15} />} actions={
              <Link to="/parties?type=customer" className="xsmall bold">All</Link>
            } />
            <div className="card-body" style={{ paddingTop: 8 }}>
              <BarList items={topCustomers} formatValue={formatCompactPKR} />
            </div>
          </Card>

          <Card>
            <CardHead title="Outstanding Payments" sub="Receivable vs payable" icon={<Clock3 size={15} />} />
            <div className="card-body" style={{ paddingTop: 10 }}>
              <div className="row" style={{ gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, background: 'var(--blue-50)', borderRadius: 10, padding: '9px 11px' }}>
                  <div className="xsmall muted bold">RECEIVABLE</div>
                  <div className="tnum bold" style={{ fontSize: 15 }}>{formatPKR(summary.accountsReceivable)}</div>
                </div>
                <div style={{ flex: 1, background: 'var(--red-bg)', borderRadius: 10, padding: '9px 11px' }}>
                  <div className="xsmall muted bold">PAYABLE</div>
                  <div className="tnum bold" style={{ fontSize: 15 }}>{formatPKR(summary.accountsPayable)}</div>
                </div>
              </div>
              <div className="eyebrow mb-2">Top receivables</div>
              {receivables.map((r) => (
                <div className="row" key={r.party.id} style={{ gap: 9, padding: '6px 0' }}>
                  <Avatar name={r.party.name} kind="customer" size="sm" />
                  <Link to={`/parties/${r.party.id}`} className="small" style={{ color: 'var(--text)', fontWeight: 600 }}>
                    {r.party.name}
                  </Link>
                  <span className="spacer" />
                  <span className="small tnum bold">{formatPKR(r.bal.balance)}</span>
                </div>
              ))}
              <div className="divider dashed" />
              <div className="eyebrow mb-2">Top payables</div>
              {payables.map((r) => (
                <div className="row" key={r.party.id} style={{ gap: 9, padding: '6px 0' }}>
                  <Avatar name={r.party.name} kind="supplier" size="sm" />
                  <Link to={`/parties/${r.party.id}`} className="small" style={{ color: 'var(--text)', fontWeight: 600 }}>
                    {r.party.name}
                  </Link>
                  <span className="spacer" />
                  <span className="small tnum bold">{formatPKR(r.bal.balance)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* activity + quick actions */}
      <div className="grid grid-sidebar" style={{ marginBottom: 16 }}>
        <Card>
          <CardHead title="Recent Business Activity" sub="Audit-style feed of the demo workspace" icon={<ActivityIcon size={15} />} />
          <div className="card-body">
            {data.activities.slice(0, 6).map((a, idx) => (
              <div key={a.id} className="row" style={{ gap: 11, alignItems: 'flex-start', paddingBottom: idx === 5 ? 0 : 12 }}>
                <div
                  style={{
                    width: 28, height: 28, borderRadius: 9, display: 'grid', placeItems: 'center', flex: '0 0 auto',
                    background: a.tone === 'success' ? 'var(--green-bg)' : a.tone === 'warning' ? 'var(--amber-bg)' : a.tone === 'danger' ? 'var(--red-bg)' : 'var(--blue-50)',
                    color: a.tone === 'success' ? 'var(--green)' : a.tone === 'warning' ? 'var(--amber)' : a.tone === 'danger' ? 'var(--red)' : 'var(--blue-600)',
                  }}
                >
                  {a.actor === 'ai' ? <Sparkles size={14} /> : a.actor === 'system' ? <CheckCircle2 size={14} /> : <Users size={14} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="small" style={{ fontWeight: 650 }}>{a.title}</div>
                  <div className="xsmall muted">{a.detail}</div>
                </div>
                <span className="spacer" />
                <span className="xsmall muted nowrap">{formatRelative(a.at, data.demoToday)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Quick Actions" sub="Demo workflows to walk through" />
          <div className="card-body stack" style={{ gap: 9 }}>
            <button className="btn block" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/ai')}>
              <Sparkles size={15} /> Ask the AI Secretary
            </button>
            <button className="btn block" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/transactions?new=1')}>
              <Plus size={15} /> Record a transaction
            </button>
            <button className="btn block" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/documents')}>
              <FileUp size={15} /> Upload a receipt / invoice
            </button>
            <button className="btn block" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/approvals')}>
              <ShieldCheck size={15} /> Review pending approvals
            </button>
            <button className="btn block" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/reports')}>
              <Receipt size={15} /> Open financial reports
            </button>
            <InfoCallout tone="info" title="Live consistency">
              Every KPI above recalculates from journal lines the moment a demo action is approved.
            </InfoCallout>
          </div>
        </Card>
      </div>
    </Page>
  );
}
