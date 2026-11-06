import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, TrendingUp, Plus, PieChart, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Page, Card, CardHead, EmptyState, InfoCallout } from '../components/ui';
import { BarList } from '../components/charts';
import { DonutChart, GroupedBarChart } from '../components/charts';
import { useRange, useStore } from '../demo/store';
import { entriesInRange, entryAmount, profitAndLoss, monthlySeries, accountName, partyName } from '../demo/accounting';
import { formatCompactPKR, formatDate, formatPKR } from '../lib/format';
import { NewTransactionModal } from '../components/TransactionForm';
import { useState } from 'react';

const COLORS = ['#2563eb', '#0e9f8a', '#d99a2b', '#6d4aff', '#d92d20', '#0b8574', '#8d99ae'];

export default function IncomeExpenses() {
  const { data } = useStore();
  const { range } = useRange();
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);

  const pl = useMemo(() => profitAndLoss(data, range.start, range.end), [data, range]);
  const monthly = useMemo(() => monthlySeries(data, range.start, range.end), [data, range]);

  const expenseEntries = useMemo(
    () =>
      entriesInRange(data, range.start, range.end)
        .filter((e) => e.type === 'expense')
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data, range],
  );

  const incomeEntries = useMemo(
    () =>
      entriesInRange(data, range.start, range.end)
        .filter((e) => e.type === 'sales')
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 12),
    [data, range],
  );

  const donut = pl.operatingExpenses
    .filter((e) => e.amount > 0)
    .map((e, i) => ({ label: e.account.name.replace(/ Expenses?$/, ''), value: e.amount, color: COLORS[i % COLORS.length] }));

  const totalOut = pl.totalOperatingExpenses + pl.totalCostOfSales;

  return (
    <Page
      eyebrow="Insights"
      title="Expenses & Income"
      subtitle={`Period: ${range.label} · ${formatDate(range.start)} → ${formatDate(range.end)}`}
      actions={
        <>
          <button className="btn" onClick={() => setNewOpen(true)}><Plus size={15} /> Record expense</button>
          <button className="btn primary" onClick={() => navigate('/reports')}>Open reports</button>
        </>
      }
    >
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon green"><TrendingUp size={16} /></div><div className="kpi-label">Total income</div></div>
          <div className="kpi-value">{formatPKR(pl.totalRevenue + pl.totalOtherIncome)}</div>
          <div className="kpi-meta">sales + other income</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon red"><Receipt size={16} /></div><div className="kpi-label">Total expenditure</div></div>
          <div className="kpi-value">{formatPKR(totalOut)}</div>
          <div className="kpi-meta">COGS + operating expenses</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon blue"><PieChart size={16} /></div><div className="kpi-label">Gross profit</div></div>
          <div className="kpi-value">{formatPKR(pl.grossProfit)}</div>
          <div className="kpi-meta">{pl.grossMarginPct.toFixed(1)}% gross margin</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-icon violet"><ArrowUpRight size={16} /></div><div className="kpi-label">Net profit</div></div>
          <div className="kpi-value">{formatPKR(pl.netProfit)}</div>
          <div className="kpi-meta">{pl.netMarginPct.toFixed(1)}% net margin</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <Card>
          <CardHead title="Expense breakdown" sub={`Operating expenses ${formatPKR(pl.totalOperatingExpenses)}`} />
          <div className="card-body">
            {donut.length === 0 ? (
              <EmptyState title="No expenses in this period" text="Pick a wider period or record an expense." />
            ) : (
              <DonutChart data={donut} centerLabel="Opex" centerValue={formatCompactPKR(pl.totalOperatingExpenses)} />
            )}
          </div>
        </Card>

        <Card className="chart-card">
          <CardHead title="Income vs expenditure" sub="Monthly comparison for the selected period" />
          <div className="card-body">
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-swatch" style={{ background: '#0e9f8a' }} /> Income</span>
              <span className="legend-item"><span className="legend-swatch" style={{ background: '#d92d20' }} /> Expenditure</span>
            </div>
            <GroupedBarChart
              labels={monthly.map((m) => m.label)}
              series={[
                { name: 'Income', color: '#0e9f8a', values: monthly.map((m) => m.revenue) },
                { name: 'Expenditure', color: '#d92d20', values: monthly.map((m) => m.cogs + m.expenses) },
              ]}
              height={236}
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-sidebar" style={{ marginBottom: 16 }}>
        <Card>
          <CardHead
            title="Expense vouchers"
            sub={`${expenseEntries.length} entries in this period`}
            icon={<ArrowDownRight size={15} />}
            actions={<button className="btn sm" onClick={() => setNewOpen(true)}><Plus size={13} /> New</button>}
          />
          {expenseEntries.length === 0 ? (
            <EmptyState title="No expenses recorded" text="Record an expense to see it here and in the reports." />
          ) : (
            <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Reference</th><th>Expense head</th><th>Description</th><th className="num">Amount</th></tr>
                </thead>
                <tbody>
                  {expenseEntries.map((e) => {
                    const head = e.lines.find((l) => l.debit > 0)?.accountId ?? '';
                    return (
                      <tr key={e.id}>
                        <td className="nowrap">{formatDate(e.date)}</td>
                        <td className="mono">{e.reference}</td>
                        <td className="small">{accountName(data, head)}</td>
                        <td className="desc">{e.description}</td>
                        <td className="num strong">{formatPKR(entryAmount(e))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
          )}
        </Card>

        <div className="stack">
          <Card>
            <CardHead title="Expense heads" sub="Share of operating expenses" />
            <div className="card-body" style={{ paddingTop: 8 }}>
              <BarList
                items={donut.map((d) => ({ label: d.label, value: d.value, color: d.color }))}
                formatValue={formatCompactPKR}
              />
            </div>
          </Card>
          <Card>
            <CardHead title="Income accounts" sub="Credits posted in this period" />
            <div className="card-body">
              {pl.revenue.concat(pl.otherIncome).map((r) => (
                <div className="row between" key={r.account.id} style={{ padding: '6px 0' }}>
                  <span className="small">{r.account.name}</span>
                  <span className="small bold tnum">{formatPKR(r.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
          <InfoCallout tone="info">
            Cost of goods sold is posted automatically at 70% of every sales invoice, so gross profit is always consistent
            with the inventory and revenue ledgers.
          </InfoCallout>
        </div>
      </div>

      <Card>
        <CardHead title="Recent sales invoices" sub="Revenue vouchers in the selected period" icon={<ArrowUpRight size={15} />} />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Reference</th><th>Customer</th><th>Description</th><th>Type</th><th className="num">Amount</th></tr>
            </thead>
            <tbody>
              {incomeEntries.map((e) => {
                const party = e.lines.find((l) => l.partyId)?.partyId;
                return (
                  <tr key={e.id}>
                    <td className="nowrap">{formatDate(e.date)}</td>
                    <td className="mono">{e.reference}</td>
                    <td>{party ? partyName(data, party) : 'Walk-in / cash'}</td>
                    <td className="desc">{e.description}</td>
                    <td><span className={`badge ${party ? 'blue' : 'teal'}`}>{party ? 'Credit sale' : 'Cash sale'}</span></td>
                    <td className="num strong">{formatPKR(entryAmount(e))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {newOpen ? <NewTransactionModal onClose={() => setNewOpen(false)} presetType="expense" /> : null}
    </Page>
  );
}
