import { useMemo, useState } from 'react';
import {
  Send, Plus, Search, Filter, CheckCircle2, Clock, Truck,
  AlertCircle, DollarSign, Globe, PackageCheck, AlertTriangle
} from 'lucide-react';
import { Page, Card, CardHead, Kpi, Modal, EmptyState } from '../components/ui';
import { useStore } from '../demo/store';
import { formatDate, formatPKR } from '../lib/format';
import { CURRENCY_METADATA, formatFxAmount, formatFxRate } from '../demo/tradeLogic';
import type { ExportShipment, ExportStatus, FxCurrency } from '../demo/tradeTypes';

const STATUS_CONFIG: Record<ExportStatus, { label: string; cls: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', cls: 'outline', icon: Clock },
  confirmed: { label: 'Confirmed', cls: 'navy', icon: CheckCircle2 },
  ready_for_dispatch: { label: 'Ready for Dispatch', cls: 'teal', icon: PackageCheck },
  dispatched: { label: 'Dispatched (In Transit)', cls: 'blue', icon: Truck },
  delivered: { label: 'Delivered', cls: 'green', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', cls: 'red', icon: AlertCircle },
};

export default function Exports() {
  const { data, addExport, updateExportStatus, pushToast } = useStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ExportStatus>('all');
  const [selectedExport, setSelectedExport] = useState<ExportShipment | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Form State for New Export
  const [customerName, setCustomerName] = useState('Gulf General Trading LLC');
  const [destinationCountry, setDestinationCountry] = useState('United Arab Emirates');
  const [productId, setProductId] = useState(data.inventory[0]?.id || '');
  const [dispatchLocationId, setDispatchLocationId] = useState(data.warehouses[0]?.id || 'LOC-MAIN');
  const [quantity, setQuantity] = useState(50);
  const [currency, setCurrency] = useState<FxCurrency>('USD');
  const [sellingRateForeign, setSellingRateForeign] = useState(185);
  const [exchangeRate, setExchangeRate] = useState(280.0);
  const [shippingChargesPKR, setShippingChargesPKR] = useState(85000);
  const [otherExpensesPKR, setOtherExpensesPKR] = useState(30000);
  const [portOfExit, setPortOfExit] = useState('Karachi Port (SAPT)');
  const [containerNumber, setContainerNumber] = useState('MSKU-982314-1');
  const [notes, setNotes] = useState('Commercial export contract for Q1 delivery.');
  const [initialStatus, setInitialStatus] = useState<ExportStatus>('ready_for_dispatch');

  // Selected product & warehouse stock check
  const selectedProduct = useMemo(() => {
    return data.inventory.find((p) => p.id === productId);
  }, [data.inventory, productId]);

  const availableStockAtLocation = useMemo(() => {
    if (!selectedProduct) return 0;
    return selectedProduct.locations[dispatchLocationId]?.available ?? 0;
  }, [selectedProduct, dispatchLocationId]);

  const isStockInsufficient = quantity > availableStockAtLocation;

  // Realtime calculations
  const totalSaleForeign = quantity * sellingRateForeign;
  const totalSalePKR = totalSaleForeign * exchangeRate;
  const netRealizationPKR = totalSalePKR - shippingChargesPKR - otherExpensesPKR;

  // Filtered exports
  const filteredExports = useMemo(() => {
    return data.exports.filter((exp) => {
      if (statusFilter !== 'all' && exp.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        exp.reference.toLowerCase().includes(q) ||
        exp.customerName.toLowerCase().includes(q) ||
        exp.productName.toLowerCase().includes(q) ||
        exp.destinationCountry.toLowerCase().includes(q) ||
        exp.currency.toLowerCase().includes(q)
      );
    });
  }, [data.exports, search, statusFilter]);

  // Aggregate KPIs
  const kpis = useMemo(() => {
    const totalSales = data.exports.reduce((acc, e) => acc + e.totalSaleAmountPKR, 0);
    const activeDispatched = data.exports.filter((e) => e.status === 'dispatched' || e.status === 'ready_for_dispatch').length;
    const deliveredCount = data.exports.filter((e) => e.status === 'delivered').length;
    const shippingPaid = data.exports.reduce((acc, e) => acc + e.shippingChargesPKR, 0);

    return { totalSales, activeDispatched, deliveredCount, shippingPaid };
  }, [data.exports]);

  const handleCreateExport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      pushToast({ tone: 'error', title: 'Invalid Product', text: 'Please select a valid product.' });
      return;
    }

    if (isStockInsufficient && initialStatus !== 'draft') {
      pushToast({
        tone: 'error',
        title: 'Insufficient Stock',
        text: `Cannot dispatch ${quantity} units: Only ${availableStockAtLocation} units available at this location.`,
      });
      return;
    }

    const wh = data.warehouses.find((w) => w.id === dispatchLocationId);

    const created = addExport({
      date: new Date().toISOString().split('T')[0],
      customerId: `CUS-${Date.now().toString().slice(-4)}`,
      customerName,
      destinationCountry,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      category: selectedProduct.category,
      quantity,
      unit: selectedProduct.unit,
      sellingRate: sellingRateForeign,
      currency,
      exchangeRate,
      totalSaleAmountForeign: totalSaleForeign,
      totalSaleAmountPKR: totalSalePKR,
      shippingChargesPKR,
      otherExpensesPKR,
      netRealizationPKR,
      dispatchLocationId,
      dispatchLocationName: wh?.name ?? dispatchLocationId,
      status: initialStatus,
      containerNumber,
      portOfExit,
      notes,
    });

    pushToast({
      tone: 'success',
      title: 'Export Consignment Created',
      text: `Export order ${created.reference} created successfully.`,
    });
    setCreateModalOpen(false);
  };

  const handleStatusChange = (exportId: string, newStatus: ExportStatus) => {
    updateExportStatus(exportId, newStatus);
    pushToast({
      tone: 'info',
      title: 'Status Updated',
      text: `Export status updated to ${STATUS_CONFIG[newStatus].label}. Warehouse stock synced.`,
    });
    if (selectedExport?.id === exportId) {
      setSelectedExport(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  return (
    <Page
      title="Export Management"
      eyebrow="Trade & Logistics"
      subtitle="Cross-border sales consignments, foreign currency invoicing, and multi-warehouse dispatch tracking."
      actions={
        <button className="btn primary" onClick={() => setCreateModalOpen(true)}>
          <Plus size={15} />
          <span>New Export Consignment</span>
        </button>
      }
    >
      {/* Demo Notice Banner */}
      <div className="callout info" style={{ marginBottom: 18, borderLeft: '4px solid var(--blue-600)' }}>
        <Globe size={18} />
        <div>
          <strong>DEMO DATA — Fictional Export Consignments</strong>
          <div style={{ fontSize: 12.5, marginTop: 2, color: 'var(--text-2)' }}>
            All foreign customer names, destination ports, and container references are demonstration samples.
            Dispatching an export strictly checks warehouse stock availability before deduction.
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <Kpi
          label="Total Export Value (PKR)"
          value={formatPKR(kpis.totalSales)}
          icon={<DollarSign size={17} />}
          tone="green"
          hint={`${data.exports.length} total export contracts`}
        />
        <Kpi
          label="Active Dispatches"
          value={String(kpis.activeDispatched)}
          icon={<Truck size={17} />}
          tone="teal"
          hint="Consignments in-transit or ready"
        />
        <Kpi
          label="Delivered Consignments"
          value={String(kpis.deliveredCount)}
          icon={<CheckCircle2 size={17} />}
          tone="blue"
          hint="Successfully cleared & completed"
        />
      </div>

      {/* Search and Filters */}
      <Card style={{ marginBottom: 18 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="input-group" style={{ flex: '1 1 240px' }}>
            <Search size={15} />
            <input
              type="text"
              className="input"
              placeholder="Search by reference, customer, destination, product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Filter size={15} style={{ color: 'var(--muted)' }} />
            <div className="segmented">
              <button
                className={statusFilter === 'all' ? 'active' : ''}
                onClick={() => setStatusFilter('all')}
              >
                All ({data.exports.length})
              </button>
              <button
                className={statusFilter === 'ready_for_dispatch' ? 'active' : ''}
                onClick={() => setStatusFilter('ready_for_dispatch')}
              >
                Ready
              </button>
              <button
                className={statusFilter === 'dispatched' ? 'active' : ''}
                onClick={() => setStatusFilter('dispatched')}
              >
                Dispatched
              </button>
              <button
                className={statusFilter === 'delivered' ? 'active' : ''}
                onClick={() => setStatusFilter('delivered')}
              >
                Delivered
              </button>
              <button
                className={statusFilter === 'draft' ? 'active' : ''}
                onClick={() => setStatusFilter('draft')}
              >
                Draft
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Table of Exports */}
      <Card>
        <CardHead
          title="Export Orders &amp; Dispatches"
          sub={`${filteredExports.length} consignments matching current filter`}
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Customer &amp; Destination</th>
                <th>Product &amp; Qty</th>
                <th>Dispatch Warehouse</th>
                <th>Foreign Amount</th>
                <th className="num">Sale Value (PKR)</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredExports.map((exp) => {
                const wh = data.warehouses.find((w) => w.id === exp.dispatchLocationId);
                const statusMeta = STATUS_CONFIG[exp.status];
                return (
                  <tr key={exp.id} className="clickable" onClick={() => setSelectedExport(exp)}>
                    <td className="strong mono">{exp.reference}</td>
                    <td>{formatDate(exp.date)}</td>
                    <td>
                      <div className="cell-title">{exp.customerName}</div>
                      <div className="cell-sub">{exp.destinationCountry} {exp.containerNumber ? `· ${exp.containerNumber}` : ''}</div>
                    </td>
                    <td>
                      <div className="cell-title">{exp.productName}</div>
                      <div className="cell-sub">{exp.quantity.toLocaleString()} {exp.unit}</div>
                    </td>
                    <td>
                      <span className="tag">{wh?.name ?? exp.dispatchLocationName}</span>
                    </td>
                    <td>
                      <div className="cell-title">{formatFxAmount(exp.totalSaleAmountForeign, exp.currency)}</div>
                      <div className="cell-sub">@{formatFxRate(exp.sellingRate, exp.currency)}</div>
                    </td>
                    <td className="num strong amount-pos">{formatPKR(exp.totalSaleAmountPKR)}</td>
                    <td>
                      <span className={`badge ${statusMeta.cls}`}>
                        <span className="dot" />
                        {statusMeta.label}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedExport(exp);
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredExports.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="No export consignments found"
                      text="Try clearing the search query or changing the status filter."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Export Detail Modal */}
      {selectedExport && (
        <Modal
          title={`Export Consignment: ${selectedExport.reference}`}
          subtitle={`Destination: ${selectedExport.destinationCountry} · Customer: ${selectedExport.customerName}`}
          onClose={() => setSelectedExport(null)}
          wide
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <Card pad>
              <div className="label" style={{ marginBottom: 12 }}>Consignment Overview</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div><strong>Product:</strong> {selectedExport.productName} ({selectedExport.category})</div>
                <div><strong>Quantity:</strong> {selectedExport.quantity.toLocaleString()} {selectedExport.unit}</div>
                <div><strong>Port of Exit:</strong> {selectedExport.portOfExit || 'N/A'}</div>
                <div><strong>Container / Tracking Ref:</strong> <span className="mono">{selectedExport.containerNumber || 'N/A'}</span></div>
                <div>
                  <strong>Dispatch Location:</strong>{' '}
                  {data.warehouses.find((w) => w.id === selectedExport.dispatchLocationId)?.name || selectedExport.dispatchLocationName}
                </div>
                <div><strong>Date Recorded:</strong> {formatDate(selectedExport.date)}</div>
                <div><strong>Current Status:</strong> <span className={`badge ${STATUS_CONFIG[selectedExport.status].cls}`}>{STATUS_CONFIG[selectedExport.status].label}</span></div>
                {selectedExport.notes && <div><strong>Notes:</strong> {selectedExport.notes}</div>}
              </div>
            </Card>

            <Card pad>
              <div className="label" style={{ marginBottom: 12 }}>Commercial &amp; Financial Value</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Foreign Invoiced Total:</span>
                  <span className="mono strong">{formatFxAmount(selectedExport.totalSaleAmountForeign, selectedExport.currency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Exchange Rate Applied:</span>
                  <span className="mono">PKR {selectedExport.exchangeRate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Freight &amp; Forwarding Paid:</span>
                  <span className="mono">{formatPKR(selectedExport.shippingChargesPKR)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Port &amp; Handling Expenses:</span>
                  <span className="mono">{formatPKR(selectedExport.otherExpensesPKR)}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                  <span>Total Gross PKR Revenue:</span>
                  <span className="mono amount-pos">{formatPKR(selectedExport.totalSaleAmountPKR)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Per Unit Selling Price: {formatFxAmount(selectedExport.sellingRate, selectedExport.currency)} ({formatPKR(Math.round(selectedExport.totalSaleAmountPKR / selectedExport.quantity))})
                </div>
              </div>
            </Card>
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Progressing to 'Dispatched' deducts stock from the dispatch warehouse.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedExport.status === 'ready_for_dispatch' && (
                <button
                  className="btn primary sm"
                  onClick={() => handleStatusChange(selectedExport.id, 'dispatched')}
                >
                  <Truck size={14} /> Mark as Dispatched
                </button>
              )}
              {selectedExport.status === 'dispatched' && (
                <button
                  className="btn success sm"
                  onClick={() => handleStatusChange(selectedExport.id, 'delivered')}
                >
                  <CheckCircle2 size={14} /> Mark as Delivered
                </button>
              )}
              {selectedExport.status === 'draft' && (
                <button
                  className="btn teal sm"
                  onClick={() => handleStatusChange(selectedExport.id, 'ready_for_dispatch')}
                >
                  Confirm &amp; Mark Ready
                </button>
              )}
              {selectedExport.status !== 'cancelled' && selectedExport.status !== 'delivered' && (
                <button
                  className="btn danger sm"
                  onClick={() => handleStatusChange(selectedExport.id, 'cancelled')}
                >
                  Cancel Export
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* New Export Modal */}
      {createModalOpen && (
        <Modal
          title="Create Export Consignment"
          subtitle="Record international export invoice and dispatch instructions. (DEMO DATA)"
          onClose={() => setCreateModalOpen(false)}
          wide
        >
          <form onSubmit={handleCreateExport}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div className="field">
                <label className="label">Customer Name</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="label">Destination Country</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={destinationCountry}
                  onChange={(e) => setDestinationCountry(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="label">Product</label>
                <select
                  className="select"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  required
                >
                  {data.inventory.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label">Dispatch Warehouse</label>
                <select
                  className="select"
                  value={dispatchLocationId}
                  onChange={(e) => setDispatchLocationId(e.target.value)}
                >
                  {data.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.city})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11.5, color: isStockInsufficient ? 'var(--red)' : 'var(--muted)', marginTop: 2 }}>
                  Stock at this location: <strong>{availableStockAtLocation} available</strong>
                </div>
              </div>

              <div className="field">
                <label className="label">Quantity</label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
                {isStockInsufficient && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--red)', fontSize: 11.5, marginTop: 2 }}>
                    <AlertTriangle size={13} />
                    <span>Insufficient stock! Available: {availableStockAtLocation}</span>
                  </div>
                )}
              </div>

              <div className="field">
                <label className="label">Currency</label>
                <select
                  className="select"
                  value={currency}
                  onChange={(e) => {
                    const c = e.target.value as FxCurrency;
                    setCurrency(c);
                    setExchangeRate(CURRENCY_METADATA[c].defaultSampleRate);
                  }}
                >
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="IRR">IRR — Iranian Rial (ISO IRR)</option>
                </select>
              </div>

              <div className="field">
                <label className="label">Selling Rate (Per Unit in Foreign Currency)</label>
                <input
                  type="number"
                  step="any"
                  min="0.000001"
                  className="input"
                  required
                  value={sellingRateForeign}
                  onChange={(e) => setSellingRateForeign(Number(e.target.value))}
                />
              </div>

              <div className="field">
                <label className="label">Exchange Rate (PKR per 1 Foreign Unit)</label>
                <input
                  type="number"
                  step="any"
                  min="0.000001"
                  className="input"
                  required
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value))}
                />
              </div>

              <div className="field">
                <label className="label">Freight &amp; Forwarding Charges (PKR)</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={shippingChargesPKR}
                  onChange={(e) => setShippingChargesPKR(Number(e.target.value))}
                />
              </div>

              <div className="field">
                <label className="label">Other Export Expenses (PKR)</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={otherExpensesPKR}
                  onChange={(e) => setOtherExpensesPKR(Number(e.target.value))}
                />
              </div>

              <div className="field">
                <label className="label">Port of Exit</label>
                <input
                  type="text"
                  className="input"
                  value={portOfExit}
                  onChange={(e) => setPortOfExit(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="label">Container / Shipping Line Ref</label>
                <input
                  type="text"
                  className="input"
                  value={containerNumber}
                  onChange={(e) => setContainerNumber(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="label">Initial Consignment Status</label>
                <select
                  className="select"
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value as ExportStatus)}
                >
                  <option value="ready_for_dispatch">Ready for Dispatch</option>
                  <option value="dispatched">Dispatched (Immediately Deduct Warehouse Stock)</option>
                  <option value="draft">Draft (No Stock Hold)</option>
                  <option value="confirmed">Confirmed</option>
                </select>
              </div>

              <div className="field">
                <label className="label">Notes / Customer Contract Ref</label>
                <input
                  type="text"
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Total Preview */}
            <div style={{ marginTop: 16, padding: 14, background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span>Foreign Invoiced Value: <strong>{formatFxAmount(totalSaleForeign, currency)}</strong></span>
                <span>Conversion Rate: <strong>PKR {exchangeRate}</strong></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>
                <span>Gross Realizable Sales (PKR):</span>
                <span>{formatPKR(totalSalePKR)}</span>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn ghost" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={isStockInsufficient && initialStatus !== 'draft'}
              >
                Confirm &amp; Record Export
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Page>
  );
}
