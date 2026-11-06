import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, X, ArrowLeftRight, Download, Eye, CheckCircle2 } from 'lucide-react';
import { Page, Card, CardHead, TypeBadge, EmptyState, Modal, InfoCallout } from '../components/ui';
import { NewTransactionModal } from '../components/TransactionForm';
import { useStore } from '../demo/store';
import { accountName, entriesInRange, entryAmount, partyName, TYPE_LABELS } from '../demo/accounting';
import { formatDate, formatPKR } from '../lib/format';
import type { TransactionType } from '../demo/types';

const TYPES: TransactionType[] = ['sales', 'purchase', 'receipt', 'payment', 'expense', 'deposit', 'withdrawal', 'transfer', 'opening'];

export default function Transactions() {
  const { data } = useStore();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('all');
  const [from, setFrom] = useState(data.fiscalYearStart);
  const [to, setTo] = useState(data.demoToday);
  const [newOpen, setNewOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => { setPage(1); }, [search, type, from, to]);

  useEffect(() => {
    if (params.get('new')) setNewOpen(true);
    if (params.get('entry')) setDetailId(params.get('entry'));
    if (params.get('type')) setType(params.get('type')!);
  }, [params]);

  const closeNew = () => {
    setNewOpen(false);
    if (params.get('new')) {
      const p = new URLSearchParams(params);
      p.delete('new');
      setParams(p, { replace: true });
    }
  };
  const closeDetail = () => {
    setDetailId(null);
    if (params.get('entry')) {
      const p = new URLSearchParams(params);
      p.delete('entry');
      setParams(p, { replace: true });
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entriesInRange(data, from, to)
      .filter((e) => (type === 'all' ? true : e.type === type))
      .filter((e) => {
        if (!q) return true;
        const party = e.lines.find((l) => l.partyId)?.partyId;
        return (
          e.reference.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          TYPE_LABELS[e.type].toLowerCase().includes(q) ||
          (party ? partyName(data, party).toLowerCase().includes(q) : false)
        );
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));
  }, [data, search, type, from, to]);

  const totals = useMemo(() => {
    const debit = rows.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.debit, 0), 0);
    const credit = rows.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.credit, 0), 0);
    return { debit, credit, count: rows.length };
  }, [rows]);

  const PAGE_SIZE = 50;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const detail = data.entries.find((e) => e.id === detailId);
  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    entriesInRange(data, from, to).forEach((e) => map.set(e.type, (map.get(e.type) ?? 0) + 1));
    return map;
  }, [data, from, to]);

  const exportCsv = () => {
    const header = ['Date', 'Reference', 'Type', 'Description', 'Party', 'Debit', 'Credit', 'Amount'];
    const lines = rows.map((e) => {
      const party = e.lines.find((l) => l.partyId)?.partyId;
      return [
        e.date,
        e.reference,
        TYPE_LABELS[e.type],
        `"${e.description.replace(/"/g, '""')}"`,
        party ? `"${partyName(data, party)}"` : '',
        e.lines.reduce((s, l) => s + l.debit, 0),
        e.lines.reduce((s, l) => s + l.credit, 0),
        entryAmount(e),
      ].join(',');
    });
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `demo-transactions-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page
      eyebrow="Accounting"
      title="Transactions"
      subtitle="Every voucher in the demo ledger. Search, filter, inspect the journal lines, and post new balanced entries."
      actions={
        <>
          <button className="btn" onClick={exportCsv} disabled={!rows.length}>
            <Download size={15} /> Export CSV
          </button>
          <button className="btn primary" onClick={() => setNewOpen(true)}>
            <Plus size={15} /> New transaction
          </button>
        </>
      }
    >
      <Card className="mb-3" pad>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="input-group" style={{ flex: '1 1 260px', minWidth: 220 }}>
            <Search size={15} />
            <input
              className="input"
              placeholder="Search reference, description, party or type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="select" style={{ width: 190 }} value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
            <option value="all">All types ({rows.length})</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]} ({typeCounts.get(t) ?? 0})</option>
            ))}
          </select>
          <div className="row" style={{ gap: 6 }}>
            <span className="small muted"><Filter size={13} style={{ verticalAlign: -2 }} /> From</span>
            <input className="input" style={{ width: 150 }} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            <span className="small muted">to</span>
            <input className="input" style={{ width: 150 }} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(search || type !== 'all' || from !== data.fiscalYearStart || to !== data.demoToday) ? (
            <button className="btn ghost sm" onClick={() => { setSearch(''); setType('all'); setFrom(data.fiscalYearStart); setTo(data.demoToday); }}>
              <X size={13} /> Clear
            </button>
          ) : null}
          <div className="spacer" />
          <div className="row" style={{ gap: 8 }}>
            <span className="badge blue">{totals.count} entries</span>
            <span className="badge outline">Dr {formatPKR(totals.debit)} = Cr {formatPKR(totals.credit)}</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          title="Ledger vouchers"
          sub={`Showing ${rows.length} of ${data.entries.length} entries · double-entry verified`}
          icon={<ArrowLeftRight size={15} />}
          actions={<span className="badge green"><CheckCircle2 size={12} /> Balanced</span>}
        />
        {rows.length === 0 ? (
          <EmptyState
            title="No transactions match those filters"
            text="Try a wider date range, clear the search box, or post a new demo transaction."
            action={<button className="btn primary sm" onClick={() => setNewOpen(true)}><Plus size={14} /> New transaction</button>}
          />
        ) : (
          <>
            <div className="table-wrap" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Party</th>
                    <th className="num">Amount</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((e) => {
                    const party = e.lines.find((l) => l.partyId)?.partyId;
                    return (
                      <tr key={e.id} className="clickable" onClick={() => setDetailId(e.id)}>
                        <td className="nowrap">{formatDate(e.date)}</td>
                        <td className="mono">{e.reference}</td>
                        <td><TypeBadge type={e.type} label={TYPE_LABELS[e.type]} /></td>
                        <td className="strong desc">{e.description}</td>
                        <td>{party ? partyName(data, party) : <span className="muted">—</span>}</td>
                        <td className="num strong">{formatPKR(entryAmount(e))}</td>
                        <td><span className="badge green"><span className="dot" /> Posted</span></td>
                        <td className="right"><button className="btn xs" onClick={(ev) => { ev.stopPropagation(); setDetailId(e.id); }}><Eye size={12} /> View</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="card-foot">
              <div className="row" style={{ gap: 6 }}>
                <button className="btn xs" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
                <span className="xsmall muted">Page {currentPage} of {pageCount}</span>
                <button className="btn xs" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
              </div>
              <span className="spacer" />
              <span className="small muted">Totals across the filtered set</span>
              <span className="spacer" />
              <span className="small tnum"><strong>Dr {formatPKR(totals.debit)}</strong></span>
              <span className="small tnum"><strong>Cr {formatPKR(totals.credit)}</strong></span>
              <span className={`badge ${Math.round(totals.debit) === Math.round(totals.credit) ? 'green' : 'red'}`}>
                {Math.round(totals.debit) === Math.round(totals.credit) ? 'Balanced' : 'Out of balance'}
              </span>
            </div>
          </>
        )}
      </Card>

      {newOpen ? <NewTransactionModal onClose={closeNew} /> : null}

      {detail ? (
        <Modal
          title={`${TYPE_LABELS[detail.type]} · ${detail.reference}`}
          subtitle={`${formatDate(detail.date)} · posted from ${detail.source === 'seed' ? 'demo dataset' : detail.source === 'ai' ? 'AI Secretary approval' : detail.source === 'document' ? 'document extraction approval' : 'manual entry'}`}
          onClose={closeDetail}
          wide
          icon={<ArrowLeftRight size={16} />}
          footer={
            <>
              <span className="badge green"><CheckCircle2 size={12} /> Posted</span>
              <span className="xsmall muted">Created {formatDate(detail.createdAt.slice(0, 10))}</span>
              <div className="spacer" />
              <button className="btn" onClick={closeDetail}>Close</button>
            </>
          }
        >
          <div className="grid grid-3 mb-3">
            <div className="bordered rounded" style={{ padding: '10px 12px' }}>
              <div className="eyebrow">Amount</div>
              <div className="bold tnum" style={{ fontSize: 16 }}>{formatPKR(entryAmount(detail))}</div>
            </div>
            <div className="bordered rounded" style={{ padding: '10px 12px' }}>
              <div className="eyebrow">Type</div>
              <div className="bold" style={{ fontSize: 14 }}>{TYPE_LABELS[detail.type]}</div>
            </div>
            <div className="bordered rounded" style={{ padding: '10px 12px' }}>
              <div className="eyebrow">Journal entry</div>
              <div className="bold mono" style={{ fontSize: 13 }}>{detail.id}</div>
            </div>
          </div>

          <div className="label mb-2">Narration</div>
          <p className="small mb-3">{detail.description}</p>

          <div className="label mb-2">Double-entry lines</div>
          <div className="table-wrap bordered rounded">
            <table className="table">
              <thead>
                <tr><th>Account</th><th>Party</th><th className="num">Debit</th><th className="num">Credit</th></tr>
              </thead>
              <tbody>
                {detail.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="strong">{accountName(data, l.accountId)}</td>
                    <td>{l.partyId ? partyName(data, l.partyId) : <span className="muted">—</span>}</td>
                    <td className="num">{l.debit ? formatPKR(l.debit) : '—'}</td>
                    <td className="num">{l.credit ? formatPKR(l.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total">
                  <td colSpan={2}>Total</td>
                  <td className="num">{formatPKR(detail.lines.reduce((s, l) => s + l.debit, 0))}</td>
                  <td className="num">{formatPKR(detail.lines.reduce((s, l) => s + l.credit, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-3">
            <InfoCallout tone="success" title="Ledger impact">
              This voucher is included in the trial balance, party ledgers and dashboard KPIs for its period.
            </InfoCallout>
          </div>
        </Modal>
      ) : null}
    </Page>
  );
}
