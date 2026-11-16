import { useMemo, useState } from 'react';
import {
  Download, Filter, TrendingUp,
  Coins, DollarSign, ShieldAlert
} from 'lucide-react';
import { Page, Card, CardHead, Kpi, EmptyState } from '../components/ui';
import { useStore } from '../demo/store';
import { formatDate, formatPKR } from '../lib/format';
import {
  CURRENCY_METADATA,
  computeFxBalances,
  formatFxAmount,
  formatFxRate
} from '../demo/tradeLogic';
import type { FxCurrency, FxTransaction } from '../demo/tradeTypes';

export default function CurrencyReports() {
  const { data, pushToast } = useStore();

  const [activeReport, setActiveReport] = useState<'realized' | 'purchases' | 'sales' | 'dealers'>('realized');
  const [selectedCurrency, setSelectedCurrency] = useState<'all' | FxCurrency>('all');

  const fxBalances = useMemo(() => {
    return computeFxBalances(data.fxTransactions);
  }, [data.fxTransactions]);

  // Aggregate Stats
  const totals = useMemo(() => {
    let totalPurchasesPKR = 0;
    let totalSalesPKR = 0;
    let totalRealizedGainPKR = 0;

    for (const tx of data.fxTransactions) {
      if (tx.type === 'purchase') {
        totalPurchasesPKR += tx.totalPKR;
      } else if (tx.type === 'sale') {
        totalSalesPKR += tx.totalPKR;
      }
    }

    for (const cur of Object.values(fxBalances)) {
      totalRealizedGainPKR += cur.totalRealizedProfitLossPKR;
    }

    return { totalPurchasesPKR, totalSalesPKR, totalRealizedGainPKR };
  }, [data.fxTransactions, fxBalances]);

  // Purchases
  const purchases = useMemo(() => {
    return data.fxTransactions
      .filter((t) => t.type === 'purchase' && (selectedCurrency === 'all' || t.currency === selectedCurrency))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.fxTransactions, selectedCurrency]);

  // Sales
  const sales = useMemo(() => {
    return data.fxTransactions
      .filter((t) => t.type === 'sale' && (selectedCurrency === 'all' || t.currency === selectedCurrency))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.fxTransactions, selectedCurrency]);

  // Dealer / Counterparty Breakdown
  const dealerBreakdown = useMemo(() => {
    const map = new Map<string, { party: string; buyPKR: number; sellPKR: number; txCount: number }>();

    for (const tx of data.fxTransactions) {
      if (selectedCurrency !== 'all' && tx.currency !== selectedCurrency) continue;
      const party = tx.partyName || tx.counterparty || 'General Counterparty';
      const existing = map.get(party) || {
        party,
        buyPKR: 0,
        sellPKR: 0,
        txCount: 0,
      };

      if (tx.type === 'purchase') {
        existing.buyPKR += tx.totalPKR;
      } else {
        existing.sellPKR += tx.totalPKR;
      }
      existing.txCount++;
      map.set(party, existing);
    }

    return Array.from(map.values()).sort((a, b) => (b.buyPKR + b.sellPKR) - (a.buyPKR + a.sellPKR));
  }, [data.fxTransactions, selectedCurrency]);

  const handleExportCsv = () => {
    const header = 'Reference,Date,Type,Currency,ForeignAmount,ExchangeRate,TotalPKR,CostBasisPKR,RealizedGainLossPKR,Counterparty,SettlementAccount\n';
    const rows = data.fxTransactions.map((tx) => {
      const party = tx.partyName || tx.counterparty || '';
      const acct = tx.accountName || tx.settlementAccount || '';
      return `"${tx.reference}","${tx.date}","${tx.type}","${tx.currency}",${tx.foreignAmount},${tx.exchangeRate},${tx.totalPKR},${tx.costBasisPKR ?? ''},${tx.realizedGainLossPKR ?? ''},"${party}","${acct}"`;
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `forex-currency-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    pushToast({
      tone: 'success',
      title: 'CSV Export Generated',
      text: 'Currency transaction ledger exported to CSV successfully.',
    });
  };

  return (
    <Page
      title="Foreign Currency Reports &amp; Analytics"
      eyebrow="Currency Management"
      subtitle="Audit-ready Forex registers, realized exchange gain/loss statements, and counterparty volume breakdown."
      actions={
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn primary" onClick={handleExportCsv}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      }
    >
      {/* Strict Iranian Rial vs Toman Banner */}
      <div className="callout info" style={{ marginBottom: 18, borderLeft: '4px solid var(--blue-600)' }}>
        <ShieldAlert size={18} />
        <div>
          <strong>CURRENCY VALUATION &amp; GAIN/LOSS METHODOLOGY (DEMO DATA)</strong>
          <div style={{ fontSize: 12.5, marginTop: 2, color: 'var(--text-2)' }}>
            Realized exchange gain/loss is computed using the <strong>Weighted Average Cost (WAC)</strong> method.
            Iranian Rial (IRR) reports strictly reflect official ISO Rials (0 decimals), not Toman (1 Toman = 10 IRR).
          </div>
        </div>
      </div>

      {/* Aggregate KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <Kpi
          label="Total Realized Exchange Gain"
          value={formatPKR(totals.totalRealizedGainPKR)}
          icon={<TrendingUp size={17} />}
          tone={totals.totalRealizedGainPKR >= 0 ? 'green' : 'red'}
          hint="Net currency trading profit realized"
        />
        <Kpi
          label="Total Foreign Purchases (Inflow)"
          value={formatPKR(totals.totalPurchasesPKR)}
          icon={<DollarSign size={17} />}
          tone="blue"
          hint="Total PKR deployed in foreign currency"
        />
        <Kpi
          label="Total Foreign Sales (Outflow)"
          value={formatPKR(totals.totalSalesPKR)}
          icon={<Coins size={17} />}
          tone="teal"
          hint="Gross PKR proceeds realized from sales"
        />
      </div>

      {/* Navigation tabs & currency filters */}
      <Card style={{ marginBottom: 18 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div className="segmented">
            <button
              className={activeReport === 'realized' ? 'active' : ''}
              onClick={() => setActiveReport('realized')}
            >
              Realized P&amp;L Summary
            </button>
            <button
              className={activeReport === 'purchases' ? 'active' : ''}
              onClick={() => setActiveReport('purchases')}
            >
              Purchase Register ({purchases.length})
            </button>
            <button
              className={activeReport === 'sales' ? 'active' : ''}
              onClick={() => setActiveReport('sales')}
            >
              Sales Register ({sales.length})
            </button>
            <button
              className={activeReport === 'dealers' ? 'active' : ''}
              onClick={() => setActiveReport('dealers')}
            >
              Dealer Breakdown ({dealerBreakdown.length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Filter size={15} style={{ color: 'var(--muted)' }} />
            <select
              className="select"
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value as any)}
              style={{ minWidth: 160 }}
            >
              <option value="all">All Currencies</option>
              <option value="USD">USD — US Dollar</option>
              <option value="AED">AED — UAE Dirham</option>
              <option value="IRR">IRR — Iranian Rial</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Section 1: Realized P&L Summary */}
      {activeReport === 'realized' && (
        <Card>
          <CardHead
            title="Realized Exchange Profit &amp; Loss by Currency"
            sub="Calculated on completed foreign currency sales against Weighted Average Cost (WAC) basis"
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Currency</th>
                  <th className="num">Available Liquid Balance</th>
                  <th className="num">Weighted Average Cost</th>
                  <th className="num">Total Inflow (Purchased)</th>
                  <th className="num">Total Outflow (Sold)</th>
                  <th className="num">Invested Cost Basis (PKR)</th>
                  <th className="num">Realized Gain/Loss (PKR)</th>
                </tr>
              </thead>
              <tbody>
                {(['USD', 'AED', 'IRR'] as FxCurrency[]).map((curr) => {
                  if (selectedCurrency !== 'all' && selectedCurrency !== curr) return null;
                  const s = fxBalances[curr];
                  const isProfit = s.totalRealizedProfitLossPKR >= 0;
                  return (
                    <tr key={curr}>
                      <td>
                        <div className="cell-title mono strong">{curr}</div>
                        <div className="cell-sub">{CURRENCY_METADATA[curr].name}</div>
                      </td>
                      <td className="num strong mono">{formatFxAmount(s.availableBalance, curr)}</td>
                      <td className="num mono">
                        {s.weightedAvgCostRate > 0 ? formatFxRate(s.weightedAvgCostRate, curr) : '—'}
                      </td>
                      <td className="num mono">{formatFxAmount(s.totalPurchased, curr)}</td>
                      <td className="num mono">{formatFxAmount(s.totalSold, curr)}</td>
                      <td className="num strong mono">{formatPKR(s.totalPKRInvested)}</td>
                      <td className={`num strong mono ${isProfit ? 'amount-pos' : 'amount-neg'}`}>
                        {isProfit ? '+' : ''}{formatPKR(s.totalRealizedProfitLossPKR)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Section 2: Purchase Register */}
      {activeReport === 'purchases' && (
        <Card>
          <CardHead
            title="Foreign Currency Purchase Register"
            sub="All foreign currency inflows and conversion costs into Pakistani Rupee"
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Date</th>
                  <th>Currency</th>
                  <th className="num">Foreign Amount</th>
                  <th className="num">Purchase Rate</th>
                  <th className="num">Total PKR Deployed</th>
                  <th>Counterparty</th>
                  <th>Settlement Account</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((tx) => (
                  <tr key={tx.id}>
                    <td className="strong mono">{tx.reference}</td>
                    <td>{formatDate(tx.date)}</td>
                    <td><span className="badge blue">{tx.currency}</span></td>
                    <td className="num strong mono">{formatFxAmount(tx.foreignAmount, tx.currency)}</td>
                    <td className="num mono">{formatFxRate(tx.exchangeRate, tx.currency)}</td>
                    <td className="num strong mono">{formatPKR(tx.totalPKR)}</td>
                    <td>{tx.partyName || tx.counterparty}</td>
                    <td><span className="tag">{tx.accountName || tx.settlementAccount}</span></td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState title="No currency purchases found" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Section 3: Sales Register */}
      {activeReport === 'sales' && (
        <Card>
          <CardHead
            title="Foreign Currency Sales Register"
            sub="Disposals of foreign currency showing selling rate, cost rate, and realized profit/loss"
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Date</th>
                  <th>Currency</th>
                  <th className="num">Foreign Sold</th>
                  <th className="num">Selling Rate</th>
                  <th className="num">Gross PKR Proceeds</th>
                  <th className="num">Cost Basis (WAC)</th>
                  <th className="num">Realized P&amp;L</th>
                  <th>Buyer / Counterparty</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((tx) => {
                  const isProfit = (tx.realizedGainLossPKR ?? 0) >= 0;
                  return (
                    <tr key={tx.id}>
                      <td className="strong mono">{tx.reference}</td>
                      <td>{formatDate(tx.date)}</td>
                      <td><span className="badge green">{tx.currency}</span></td>
                      <td className="num strong mono">{formatFxAmount(tx.foreignAmount, tx.currency)}</td>
                      <td className="num mono">{formatFxRate(tx.exchangeRate, tx.currency)}</td>
                      <td className="num strong mono">{formatPKR(tx.totalPKR)}</td>
                      <td className="num mono">{tx.costBasisPKR ? formatPKR(tx.costBasisPKR) : '—'}</td>
                      <td className={`num strong mono ${isProfit ? 'amount-pos' : 'amount-neg'}`}>
                        {isProfit ? '+' : ''}{formatPKR(tx.realizedGainLossPKR ?? 0)}
                      </td>
                      <td>{tx.partyName || tx.counterparty}</td>
                    </tr>
                  );
                })}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState title="No currency sales found" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Section 4: Dealer / Counterparty Breakdown */}
      {activeReport === 'dealers' && (
        <Card>
          <CardHead
            title="Exchange Company &amp; Dealer Volume Breakdown"
            sub="Trading volumes and counterparty concentration across currency operations"
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Counterparty / Dealer Name</th>
                  <th className="num">Total Buy Volume (PKR)</th>
                  <th className="num">Total Sell Volume (PKR)</th>
                  <th className="num">Net Trading Volume (PKR)</th>
                  <th className="num">Transaction Count</th>
                </tr>
              </thead>
              <tbody>
                {dealerBreakdown.map((d) => (
                  <tr key={d.party}>
                    <td className="strong">
                      <div className="cell-title">{d.party}</div>
                    </td>
                    <td className="num mono">{formatPKR(d.buyPKR)}</td>
                    <td className="num mono">{formatPKR(d.sellPKR)}</td>
                    <td className="num strong mono amount-pos">{formatPKR(d.buyPKR + d.sellPKR)}</td>
                    <td className="num">{d.txCount} txs</td>
                  </tr>
                ))}
                {dealerBreakdown.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState title="No counterparty records available" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>
  );
}
