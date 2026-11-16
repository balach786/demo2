import { useMemo, useState } from 'react';
import {
  Coins, Search, Filter, ArrowUpRight, ArrowDownLeft,
  TrendingUp, ShieldAlert, Clock
} from 'lucide-react';
import { Page, Card, CardHead, Kpi, Modal, EmptyState } from '../components/ui';
import { useStore } from '../demo/store';
import { formatDate, formatPKR } from '../lib/format';
import {
  CURRENCY_METADATA,
  computeFxBalances,
  formatFxAmount,
  formatFxRate
} from '../demo/tradeLogic';
import type { FxCurrency, FxTransaction, FxType } from '../demo/tradeTypes';

export default function CurrencyExchange() {
  const { data, addFxTransaction, pushToast } = useStore();

  const [search, setSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | FxCurrency>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | FxType>('all');

  // Modals
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [activeModalCurrency, setActiveModalCurrency] = useState<FxCurrency>('USD');

  // Form State: Buy
  const [buyAmount, setBuyAmount] = useState(10000);
  const [buyRate, setBuyRate] = useState(280.0);
  const [buyCounterparty, setBuyCounterparty] = useState('Al-Falah Exchange Co. LLC');
  const [buyAccountId, setBuyAccountId] = useState('1010');
  const [buyAccountName, setBuyAccountName] = useState('HBL Business Account');
  const [buyNotes, setNotes] = useState('Forex desk liquidity purchase for commercial import settlement.');

  // Form State: Sell
  const [sellAmount, setSellAmount] = useState(5000);
  const [sellRate, setSellRate] = useState(283.5);
  const [sellCounterparty, setSellCounterparty] = useState('Pak-Dubai Commercial Traders');
  const [sellAccountId, setSellAccountId] = useState('1020');
  const [sellAccountName, setSellAccountName] = useState('Meezan Business Account');
  const [sellNotes, setSellNotes] = useState('Forex disposal for local working capital.');

  // Live Balances via Weighted Average Cost
  const fxBalances = useMemo(() => {
    return computeFxBalances(data.fxTransactions);
  }, [data.fxTransactions]);

  // Aggregate totals across all currencies
  const aggregateTotals = useMemo(() => {
    let totalInvestedPKR = 0;
    let totalRealizedGainPKR = 0;
    for (const cur of Object.values(fxBalances)) {
      totalInvestedPKR += cur.totalPKRInvested;
      totalRealizedGainPKR += cur.totalRealizedProfitLossPKR;
    }
    return { totalInvestedPKR, totalRealizedGainPKR };
  }, [fxBalances]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return data.fxTransactions.filter((tx) => {
      if (currencyFilter !== 'all' && tx.currency !== currencyFilter) return false;
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const party = (tx.partyName || tx.counterparty || '').toLowerCase();
      const acct = (tx.accountName || tx.settlementAccount || '').toLowerCase();
      return (
        tx.reference.toLowerCase().includes(q) ||
        party.includes(q) ||
        tx.currency.toLowerCase().includes(q) ||
        acct.includes(q)
      );
    });
  }, [data.fxTransactions, currencyFilter, typeFilter, search]);

  // Modal open helpers
  const openBuyModal = (curr: FxCurrency) => {
    setActiveModalCurrency(curr);
    setBuyRate(CURRENCY_METADATA[curr].defaultSampleRate);
    setBuyAmount(curr === 'IRR' ? 100000000 : 5000);
    setBuyModalOpen(true);
  };

  const openSellModal = (curr: FxCurrency) => {
    setActiveModalCurrency(curr);
    const balance = fxBalances[curr]?.availableBalance || 0;
    const wac = fxBalances[curr]?.weightedAvgCostRate || CURRENCY_METADATA[curr].defaultSampleRate;
    const markupRate = curr === 'IRR' ? wac * 1.05 : Number((wac * 1.015).toFixed(2));
    setSellRate(markupRate);
    setSellAmount(curr === 'IRR' ? Math.min(balance, 50000000) : Math.min(balance, 2000));
    setSellModalOpen(true);
  };

  // Handle Buy Submission
  const handleBuySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalPKR = buyAmount * buyRate;

    const created = addFxTransaction({
      date: new Date().toISOString().split('T')[0],
      type: 'purchase',
      currency: activeModalCurrency,
      foreignAmount: buyAmount,
      exchangeRate: buyRate,
      totalPKR,
      partyName: buyCounterparty,
      counterparty: buyCounterparty,
      paymentMethod: 'bank_transfer',
      accountId: buyAccountId,
      accountName: buyAccountName,
      settlementAccount: buyAccountName,
      chargesPKR: 0,
      notes: buyNotes,
    });

    pushToast({
      tone: 'success',
      title: 'Currency Purchased',
      text: `Purchased ${formatFxAmount(buyAmount, activeModalCurrency)} for ${formatPKR(totalPKR)} (Ref: ${created.reference}).`,
    });
    setBuyModalOpen(false);
  };

  // Handle Sell Submission
  const handleSellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currSummary = fxBalances[activeModalCurrency];
    const available = currSummary?.availableBalance ?? 0;

    if (sellAmount > available) {
      pushToast({
        tone: 'error',
        title: 'Insufficient Balance',
        text: `Cannot sell ${formatFxAmount(sellAmount, activeModalCurrency)}: Available balance is only ${formatFxAmount(available, activeModalCurrency)}.`,
      });
      return;
    }

    const totalPKR = sellAmount * sellRate;
    const avgCostRate = currSummary?.weightedAvgCostRate ?? sellRate;
    const costBasisPKR = sellAmount * avgCostRate;
    const realizedGainLossPKR = totalPKR - costBasisPKR;

    const created = addFxTransaction({
      date: new Date().toISOString().split('T')[0],
      type: 'sale',
      currency: activeModalCurrency,
      foreignAmount: sellAmount,
      exchangeRate: sellRate,
      totalPKR,
      costBasisPKR,
      realizedGainLossPKR,
      partyName: sellCounterparty,
      counterparty: sellCounterparty,
      paymentMethod: 'bank_transfer',
      accountId: sellAccountId,
      accountName: sellAccountName,
      settlementAccount: sellAccountName,
      chargesPKR: 0,
      notes: sellNotes,
    });

    const isProfit = realizedGainLossPKR >= 0;
    pushToast({
      tone: 'success',
      title: 'Currency Sold',
      text: `Sold ${formatFxAmount(sellAmount, activeModalCurrency)} for ${formatPKR(totalPKR)}. Realized ${isProfit ? 'Profit' : 'Loss'}: ${formatPKR(Math.abs(realizedGainLossPKR))}.`,
    });
    setSellModalOpen(false);
  };

  return (
    <Page
      title="Foreign Currency Exchange Desk"
      eyebrow="Currency Management"
      subtitle="Multi-currency liquidity tracking, Weighted Average Cost (WAC) valuation, and realized exchange P&amp;L."
      actions={
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn navy" onClick={() => openBuyModal('USD')}>
            <ArrowDownLeft size={15} />
            <span>Buy Currency</span>
          </button>
          <button className="btn primary" onClick={() => openSellModal('USD')}>
            <ArrowUpRight size={15} />
            <span>Sell Currency</span>
          </button>
        </div>
      }
    >
      {/* Strict Iranian Rial vs Toman Banner */}
      <div className="callout warn" style={{ marginBottom: 18, borderLeft: '4px solid var(--amber)' }}>
        <ShieldAlert size={18} />
        <div>
          <strong>IRANIAN RIAL (IRR) CONVENTION &amp; ACCOUNTING RULES</strong>
          <div style={{ fontSize: 12.5, marginTop: 2 }}>
            Demonstration accounts record the <strong>Official ISO Iranian Rial (IRR)</strong> with zero decimals,
            <strong> NOT Toman</strong>. (Note: 1 Toman = 10 IRR; never conflate denominations).
            Exchange rates are calculated per Rial.
          </div>
        </div>
      </div>

      {/* Aggregate Overview KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <Kpi
          label="Total Foreign Portfolio Value (PKR)"
          value={formatPKR(aggregateTotals.totalInvestedPKR)}
          icon={<Coins size={17} />}
          tone="blue"
          hint="Combined cost basis across USD, AED, and IRR"
        />
        <Kpi
          label="Cumulative Realized Exchange Gain"
          value={formatPKR(aggregateTotals.totalRealizedGainPKR)}
          icon={<TrendingUp size={17} />}
          tone={aggregateTotals.totalRealizedGainPKR >= 0 ? 'green' : 'red'}
          hint="Calculated strictly via Weighted Average Cost"
        />
        <Kpi
          label="Total FX Transactions Recorded"
          value={String(data.fxTransactions.length)}
          icon={<Clock size={17} />}
          tone="navy"
          hint="Purchases and sales in demo register"
        />
      </div>

      {/* 3 Dedicated Currency Cards: USD, AED, IRR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {(['USD', 'AED', 'IRR'] as FxCurrency[]).map((curr) => {
          const summary = fxBalances[curr];
          const meta = CURRENCY_METADATA[curr];
          const hasBalance = summary.availableBalance > 0;
          const isProfit = summary.totalRealizedProfitLossPKR >= 0;

          return (
            <Card key={curr} pad style={{ borderTop: `4px solid ${curr === 'USD' ? 'var(--blue-600)' : curr === 'AED' ? 'var(--teal-600)' : 'var(--amber)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="mono strong" style={{ fontSize: 16 }}>{curr}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>· {meta.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{meta.denominationNote}</div>
                </div>
                <div className={`badge ${curr === 'USD' ? 'blue' : curr === 'AED' ? 'teal' : 'amber'}`}>
                  {meta.symbol}
                </div>
              </div>

              {/* Balance & Cost Info */}
              <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 'var(--radius)', marginBottom: 14 }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 2 }}>Available Liquid Balance</div>
                <div className="mono strong" style={{ fontSize: 20, color: hasBalance ? 'var(--text)' : 'var(--muted)' }}>
                  {formatFxAmount(summary.availableBalance, curr)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                  <span style={{ color: 'var(--muted)' }}>Weighted Avg Cost:</span>
                  <span className="mono strong">
                    {summary.weightedAvgCostRate > 0 ? formatFxRate(summary.weightedAvgCostRate, curr) : 'No Stock'}
                  </span>
                </div>
              </div>

              {/* Financial Metrics */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Invested Cost Basis:</span>
                  <span className="mono strong">{formatPKR(summary.totalPKRInvested)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Realized Profit / Loss:</span>
                  <span className={`mono strong ${isProfit ? 'amount-pos' : 'amount-neg'}`}>
                    {isProfit ? '+' : ''}{formatPKR(summary.totalRealizedProfitLossPKR)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Total Inflow / Sold:</span>
                  <span className="mono" style={{ fontSize: 11.5 }}>
                    {formatFxAmount(summary.totalPurchased, curr)} in / {formatFxAmount(summary.totalSold, curr)} out
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button className="btn sm navy" onClick={() => openBuyModal(curr)}>
                  <ArrowDownLeft size={13} /> Buy {curr}
                </button>
                <button
                  className="btn sm primary"
                  disabled={summary.availableBalance <= 0}
                  onClick={() => openSellModal(curr)}
                >
                  <ArrowUpRight size={13} /> Sell {curr}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Search and Filters */}
      <Card style={{ marginBottom: 18 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="input-group" style={{ flex: '1 1 240px' }}>
            <Search size={15} />
            <input
              type="text"
              className="input"
              placeholder="Search by reference, counterparty, account..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Filter size={15} style={{ color: 'var(--muted)' }} />
            <div className="segmented">
              <button
                className={currencyFilter === 'all' ? 'active' : ''}
                onClick={() => setCurrencyFilter('all')}
              >
                All Currencies
              </button>
              <button
                className={currencyFilter === 'USD' ? 'active' : ''}
                onClick={() => setCurrencyFilter('USD')}
              >
                USD
              </button>
              <button
                className={currencyFilter === 'AED' ? 'active' : ''}
                onClick={() => setCurrencyFilter('AED')}
              >
                AED
              </button>
              <button
                className={currencyFilter === 'IRR' ? 'active' : ''}
                onClick={() => setCurrencyFilter('IRR')}
              >
                IRR
              </button>
            </div>

            <div className="segmented">
              <button
                className={typeFilter === 'all' ? 'active' : ''}
                onClick={() => setTypeFilter('all')}
              >
                All Types
              </button>
              <button
                className={typeFilter === 'purchase' ? 'active' : ''}
                onClick={() => setTypeFilter('purchase')}
              >
                Purchases
              </button>
              <button
                className={typeFilter === 'sale' ? 'active' : ''}
                onClick={() => setTypeFilter('sale')}
              >
                Sales
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Transaction Register Table */}
      <Card>
        <CardHead
          title="Multi-Currency Transaction Register"
          sub={`${filteredTransactions.length} purchases and sales logged in demo ledger`}
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Type</th>
                <th>Currency &amp; Foreign Amount</th>
                <th className="num">Exchange Rate</th>
                <th className="num">Total PKR</th>
                <th className="num">Cost Basis</th>
                <th className="num">Realized P&amp;L</th>
                <th>Counterparty / Dealer</th>
                <th>Settlement Account</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => {
                const isPurchase = tx.type === 'purchase';
                const isProfit = (tx.realizedGainLossPKR ?? 0) >= 0;
                const party = tx.partyName || tx.counterparty || '';
                const acct = tx.accountName || tx.settlementAccount || '';
                return (
                  <tr key={tx.id}>
                    <td className="strong mono">{tx.reference}</td>
                    <td>{formatDate(tx.date)}</td>
                    <td>
                      <span className={`badge ${isPurchase ? 'blue' : 'green'}`}>
                        {isPurchase ? 'PURCHASE (IN)' : 'SALE (OUT)'}
                      </span>
                    </td>
                    <td>
                      <div className="strong mono">{formatFxAmount(tx.foreignAmount, tx.currency)}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{CURRENCY_METADATA[tx.currency].name}</div>
                    </td>
                    <td className="num mono strong">{formatFxRate(tx.exchangeRate, tx.currency)}</td>
                    <td className="num strong mono">{formatPKR(tx.totalPKR)}</td>
                    <td className="num mono">
                      {tx.costBasisPKR ? formatPKR(tx.costBasisPKR) : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td className="num mono">
                      {tx.type === 'sale' && tx.realizedGainLossPKR !== undefined ? (
                        <span className={`strong ${isProfit ? 'amount-pos' : 'amount-neg'}`}>
                          {isProfit ? '+' : ''}{formatPKR(tx.realizedGainLossPKR)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div className="cell-title">{party}</div>
                      {tx.notes && <div className="cell-sub">{tx.notes}</div>}
                    </td>
                    <td>
                      <span className="tag">{acct}</span>
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <EmptyState
                      title="No currency transactions found"
                      text="Try clearing the search query or changing filters."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Buy Currency Modal */}
      {buyModalOpen && (
        <Modal
          title={`Purchase ${activeModalCurrency} — Currency Inflow`}
          subtitle="Record foreign exchange purchase and recalculate Weighted Average Cost. (DEMO DATA)"
          onClose={() => setBuyModalOpen(false)}
        >
          <form onSubmit={handleBuySubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label className="label">Currency</label>
                <select
                  className="select"
                  value={activeModalCurrency}
                  onChange={(e) => {
                    const c = e.target.value as FxCurrency;
                    setActiveModalCurrency(c);
                    setBuyRate(CURRENCY_METADATA[c].defaultSampleRate);
                    setBuyAmount(c === 'IRR' ? 100000000 : 5000);
                  }}
                >
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="IRR">IRR — Iranian Rial (ISO IRR)</option>
                </select>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                  {CURRENCY_METADATA[activeModalCurrency].denominationNote}
                </div>
              </div>

              <div className="field">
                <label className="label">Foreign Currency Amount</label>
                <input
                  type="number"
                  step={activeModalCurrency === 'IRR' ? '1' : '0.01'}
                  min="1"
                  className="input"
                  required
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(Number(e.target.value))}
                />
              </div>

              <div className="field">
                <label className="label">Exchange Purchase Rate (PKR per 1 Foreign Unit)</label>
                <input
                  type="number"
                  step="any"
                  min="0.000001"
                  className="input"
                  required
                  value={buyRate}
                  onChange={(e) => setBuyRate(Number(e.target.value))}
                />
              </div>

              <div className="field">
                <label className="label">Exchange Company / Dealer / Counterparty</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={buyCounterparty}
                  onChange={(e) => setBuyCounterparty(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="label">Settlement Bank / Cash Account (Source of PKR)</label>
                <select
                  className="select"
                  value={buyAccountId}
                  onChange={(e) => {
                    setBuyAccountId(e.target.value);
                    const acct = data.accounts.find((a) => a.id === e.target.value);
                    if (acct) setBuyAccountName(acct.name);
                  }}
                >
                  <option value="1010">HBL Business Account (1010)</option>
                  <option value="1020">Meezan Business Account (1020)</option>
                  <option value="1000">Cash in Hand (1000)</option>
                </select>
              </div>

              <div className="field">
                <label className="label">Transaction Notes / Purpose</label>
                <input
                  type="text"
                  className="input"
                  value={buyNotes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Purchase Cost Summary */}
              <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>Foreign Amount: <strong>{formatFxAmount(buyAmount, activeModalCurrency)}</strong></span>
                  <span>Rate: <strong>{formatFxRate(buyRate, activeModalCurrency)}</strong></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--navy-700)' }}>
                  <span>Total PKR Outflow:</span>
                  <span>{formatPKR(buyAmount * buyRate)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" className="btn ghost" onClick={() => setBuyModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Confirm Purchase &amp; Recalculate WAC
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Sell Currency Modal */}
      {sellModalOpen && (
        <Modal
          title={`Sell ${activeModalCurrency} — Realize Exchange Profit/Loss`}
          subtitle="Record disposal of foreign currency against Weighted Average Cost basis. (DEMO DATA)"
          onClose={() => setSellModalOpen(false)}
        >
          <form onSubmit={handleSellSubmit}>
            {(() => {
              const summary = fxBalances[activeModalCurrency];
              const available = summary?.availableBalance || 0;
              const wacRate = summary?.weightedAvgCostRate || 0;
              const isInsufficient = sellAmount > available;
              const grossPKR = sellAmount * sellRate;
              const costBasisPKR = sellAmount * wacRate;
              const profitPKR = grossPKR - costBasisPKR;
              const isProfit = profitPKR >= 0;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="field">
                    <label className="label">Currency</label>
                    <select
                      className="select"
                      value={activeModalCurrency}
                      onChange={(e) => {
                        const c = e.target.value as FxCurrency;
                        setActiveModalCurrency(c);
                        const bal = fxBalances[c]?.availableBalance || 0;
                        const wac = fxBalances[c]?.weightedAvgCostRate || CURRENCY_METADATA[c].defaultSampleRate;
                        setSellRate(c === 'IRR' ? wac * 1.05 : Number((wac * 1.015).toFixed(2)));
                        setSellAmount(c === 'IRR' ? Math.min(bal, 50000000) : Math.min(bal, 2000));
                      }}
                    >
                      <option value="USD">USD — US Dollar ($)</option>
                      <option value="AED">AED — UAE Dirham</option>
                      <option value="IRR">IRR — Iranian Rial (ISO IRR)</option>
                    </select>
                    <div style={{ fontSize: 11.5, color: isInsufficient ? 'var(--red)' : 'var(--muted)', marginTop: 2 }}>
                      Available Liquid Stock: <strong>{formatFxAmount(available, activeModalCurrency)}</strong>
                    </div>
                  </div>

                  <div className="field">
                    <label className="label">Foreign Currency Amount to Sell</label>
                    <input
                      type="number"
                      step={activeModalCurrency === 'IRR' ? '1' : '0.01'}
                      min="1"
                      className="input"
                      required
                      value={sellAmount}
                      onChange={(e) => setSellAmount(Number(e.target.value))}
                    />
                    {isInsufficient && (
                      <div style={{ color: 'var(--red)', fontSize: 11.5, marginTop: 2 }}>
                        Cannot sell more than available balance ({formatFxAmount(available, activeModalCurrency)})!
                      </div>
                    )}
                  </div>

                  <div className="field">
                    <label className="label">Selling Exchange Rate (PKR per 1 Foreign Unit)</label>
                    <input
                      type="number"
                      step="any"
                      min="0.000001"
                      className="input"
                      required
                      value={sellRate}
                      onChange={(e) => setSellRate(Number(e.target.value))}
                    />
                  </div>

                  <div className="field">
                    <label className="label">Counterparty / Buyer / Exchange House</label>
                    <input
                      type="text"
                      className="input"
                      required
                      value={sellCounterparty}
                      onChange={(e) => setSellCounterparty(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label className="label">Settlement Bank / Cash Account (Destination of PKR)</label>
                    <select
                      className="select"
                      value={sellAccountId}
                      onChange={(e) => {
                        setSellAccountId(e.target.value);
                        const acct = data.accounts.find((a) => a.id === e.target.value);
                        if (acct) setSellAccountName(acct.name);
                      }}
                    >
                      <option value="1020">Meezan Business Account (1020)</option>
                      <option value="1010">HBL Business Account (1010)</option>
                      <option value="1000">Cash in Hand (1000)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label className="label">Notes</label>
                    <input
                      type="text"
                      className="input"
                      value={sellNotes}
                      onChange={(e) => setSellNotes(e.target.value)}
                    />
                  </div>

                  {/* Realized Profit/Loss Computation Preview */}
                  <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>
                      WEIGHTED AVERAGE COST (WAC) SETTLEMENT PREVIEW:
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                      <span>Gross PKR Proceeds:</span>
                      <span className="mono strong">{formatPKR(grossPKR)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                      <span>Cost Basis ({formatFxRate(wacRate, activeModalCurrency)}):</span>
                      <span className="mono">{formatPKR(costBasisPKR)}</span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
                      <span>Realized Exchange {isProfit ? 'Profit' : 'Loss'}:</span>
                      <span className={`mono ${isProfit ? 'amount-pos' : 'amount-neg'}`}>
                        {isProfit ? '+' : ''}{formatPKR(profitPKR)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                    <button type="button" className="btn ghost" onClick={() => setSellModalOpen(false)}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn primary"
                      disabled={isInsufficient || sellAmount <= 0}
                    >
                      Confirm Sale &amp; Lock Realized P&amp;L
                    </button>
                  </div>
                </div>
              );
            })()}
          </form>
        </Modal>
      )}
    </Page>
  );
}
