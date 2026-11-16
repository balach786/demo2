import { useMemo, useState } from 'react';
import {
  Ship, Plus, Search, Filter, CheckCircle2,
  Clock, Truck, AlertCircle, DollarSign, Globe
} from 'lucide-react';
import { Page, Card, CardHead, Kpi, Modal, EmptyState } from '../components/ui';
import { useStore } from '../demo/store';
import { formatDate, formatPKR } from '../lib/format';
import { CURRENCY_METADATA, formatFxAmount, formatFxRate } from '../demo/tradeLogic';
import type { FxCurrency, ImportShipment, ImportStatus } from '../demo/tradeTypes';

const STATUS_CONFIG: Record<ImportStatus, { label: string; cls: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', cls: 'outline', icon: Clock },
  ordered: { label: 'Ordered', cls: 'amber', icon: Clock },
  in_transit: { label: 'In Transit', cls: 'blue', icon: Ship },
  received: { label: 'Received', cls: 'green', icon: CheckCircle2 },
  partially_received: { label: 'Partially Received', cls: 'teal', icon: Truck },
  cancelled: { label: 'Cancelled', cls: 'red', icon: AlertCircle },
};

export default function Imports() {
  const { data, addImport, updateImportStatus, pushToast } = useStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ImportStatus>('all');
  const [selectedShipment, setSelectedShipment] = useState<ImportShipment | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Form State for New Import
  const [supplierName, setSupplierName] = useState('Guangzhou Apex Electronics Co.');
  const [countryOfOrigin, setCountryOfOrigin] = useState('China');
  const [productId, setProductId] = useState(data.inventory[0]?.id || '');
  const [quantity, setQuantity] = useState(200);
  const [receivingLocationId, setReceivingLocationId] = useState(data.warehouses[0]?.id || 'LOC-MAIN');
  const [currency, setCurrency] = useState<FxCurrency>('USD');
  const [purchaseRateForeign, setPurchaseRateForeign] = useState(120);
  const [exchangeRate, setExchangeRate] = useState(280.5);
  const [shippingChargesPKR, setShippingChargesPKR] = useState(145000);
  const [customsChargesPKR, setCustomsChargesPKR] = useState(225000);
  const [otherExpensesPKR, setOtherExpensesPKR] = useState(45000);
  const [portOfEntry, setPortOfEntry] = useState('Karachi Port (KICT)');
  const [blNumber, setBlNumber] = useState('BL-COSCO-2026-9041');
  const [notes, setNotes] = useState('Commercial electronics consignment for Q1 distribution.');
  const [initialStatus, setInitialStatus] = useState<ImportStatus>('in_transit');

  // Dynamic calculations for form
  const totalPurchaseForeign = quantity * purchaseRateForeign;
  const totalPurchasePKR = totalPurchaseForeign * exchangeRate;
  const totalLandedCostPKR = totalPurchasePKR + shippingChargesPKR + customsChargesPKR + otherExpensesPKR;

  // Filtered shipments
  const filteredShipments = useMemo(() => {
    return data.imports.filter((shipment) => {
      if (statusFilter !== 'all' && shipment.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        shipment.reference.toLowerCase().includes(q) ||
        shipment.supplierName.toLowerCase().includes(q) ||
        shipment.productName.toLowerCase().includes(q) ||
        shipment.countryOfOrigin.toLowerCase().includes(q) ||
        shipment.currency.toLowerCase().includes(q)
      );
    });
  }, [data.imports, search, statusFilter]);

  // Aggregate KPIs
  const kpis = useMemo(() => {
    const totalLanded = data.imports.reduce((acc, s) => acc + s.totalLandedCostPKR, 0);
    const activeCount = data.imports.filter((s) => s.status === 'in_transit' || s.status === 'ordered').length;
    const customsTotal = data.imports.reduce((acc, s) => acc + s.customsChargesPKR, 0);
    const receivedCount = data.imports.filter((s) => s.status === 'received').length;

    return { totalLanded, activeCount, customsTotal, receivedCount };
  }, [data.imports]);

  const handleCreateImport = (e: React.FormEvent) => {
    e.preventDefault();
    const product = data.inventory.find((p) => p.id === productId);
    if (!product) {
      pushToast({ tone: 'error', title: 'Invalid Product', text: 'Please select a valid product.' });
      return;
    }

    const wh = data.warehouses.find((w) => w.id === receivingLocationId);

    const newShipment = addImport({
      date: new Date().toISOString().split('T')[0],
      supplierId: `SUP-${Date.now().toString().slice(-4)}`,
      supplierName,
      countryOfOrigin,
      productId: product.id,
      productName: product.name,
      category: product.category,
      quantity,
      unit: product.unit,
      purchaseRate: purchaseRateForeign,
      currency,
      exchangeRate,
      totalPurchaseAmountForeign: totalPurchaseForeign,
      totalPurchaseAmountPKR: totalPurchasePKR,
      shippingChargesPKR,
      customsChargesPKR,
      otherExpensesPKR,
      totalLandedCostPKR,
      unitLandedCostPKR: Math.round(totalLandedCostPKR / quantity),
      receivingLocationId,
      receivingLocationName: wh?.name ?? receivingLocationId,
      status: initialStatus,
      receivedQuantity: initialStatus === 'received' ? quantity : 0,
      portOfEntry,
      blNumber,
      notes,
    });

    pushToast({
      tone: 'success',
      title: 'Import Shipment Created',
      text: `Shipment ${newShipment.reference} recorded successfully.`,
    });
    setCreateModalOpen(false);
  };

  const handleStatusChange = (shipmentId: string, newStatus: ImportStatus) => {
    updateImportStatus(shipmentId, newStatus);
    pushToast({
      tone: 'info',
      title: 'Status Updated',
      text: `Shipment status updated to ${STATUS_CONFIG[newStatus].label}. Warehouse stock synced.`,
    });
    if (selectedShipment?.id === shipmentId) {
      setSelectedShipment(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  return (
    <Page
      title="Import Management"
      eyebrow="Trade & Logistics"
      subtitle="International shipments, customs duty clearance, landed cost accounting, and container tracking."
      actions={
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn primary" onClick={() => setCreateModalOpen(true)}>
            <Plus size={15} />
            <span>New Import Shipment</span>
          </button>
        </div>
      }
    >
      {/* Demo Notice Banner */}
      <div className="callout info" style={{ marginBottom: 18, borderLeft: '4px solid var(--blue-600)' }}>
        <Globe size={18} />
        <div>
          <strong>DEMO DATA — Fictional Import Shipments</strong>
          <div style={{ fontSize: 12.5, marginTop: 2, color: 'var(--text-2)' }}>
            All foreign supplier names, bill of lading numbers, and landed cost rates are demonstration samples.
            Receiving a shipment automatically increases stock in the target warehouse.
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <Kpi
          label="Total Landed Imports (PKR)"
          value={formatPKR(kpis.totalLanded)}
          icon={<Ship size={17} />}
          tone="blue"
          hint={`${data.imports.length} total import consignments`}
        />
        <Kpi
          label="Active Shipments"
          value={String(kpis.activeCount)}
          icon={<Truck size={17} />}
          tone="teal"
          hint="Consignments in-transit or on order"
        />
        <Kpi
          label="Customs & Port Charges (PKR)"
          value={formatPKR(kpis.customsTotal)}
          icon={<DollarSign size={17} />}
          tone="navy"
          hint="Total duties, taxes & clearance paid"
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
              placeholder="Search by reference, supplier, product, country..."
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
                All ({data.imports.length})
              </button>
              <button
                className={statusFilter === 'in_transit' ? 'active' : ''}
                onClick={() => setStatusFilter('in_transit')}
              >
                In Transit
              </button>
              <button
                className={statusFilter === 'ordered' ? 'active' : ''}
                onClick={() => setStatusFilter('ordered')}
              >
                Ordered
              </button>
              <button
                className={statusFilter === 'received' ? 'active' : ''}
                onClick={() => setStatusFilter('received')}
              >
                Received
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

      {/* Table of Shipments */}
      <Card>
        <CardHead
          title="Import Consignments Register"
          sub={`${filteredShipments.length} shipments matching current filter`}
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Supplier &amp; Origin</th>
                <th>Product &amp; Qty</th>
                <th>Currency &amp; Value</th>
                <th className="num">Landed Cost (PKR)</th>
                <th>Destination WH</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredShipments.map((shipment) => {
                const wh = data.warehouses.find((w) => w.id === shipment.receivingLocationId);
                const statusMeta = STATUS_CONFIG[shipment.status];
                return (
                  <tr key={shipment.id} className="clickable" onClick={() => setSelectedShipment(shipment)}>
                    <td className="strong mono">{shipment.reference}</td>
                    <td>{formatDate(shipment.date)}</td>
                    <td>
                      <div className="cell-title">{shipment.supplierName}</div>
                      <div className="cell-sub">{shipment.countryOfOrigin} {shipment.blNumber ? `· ${shipment.blNumber}` : ''}</div>
                    </td>
                    <td>
                      <div className="cell-title">{shipment.productName}</div>
                      <div className="cell-sub">{shipment.quantity.toLocaleString()} {shipment.unit}</div>
                    </td>
                    <td>
                      <div className="cell-title">{formatFxAmount(shipment.totalPurchaseAmountForeign, shipment.currency)}</div>
                      <div className="cell-sub">@{formatFxRate(shipment.purchaseRate, shipment.currency)} (PKR {shipment.exchangeRate})</div>
                    </td>
                    <td className="num strong">{formatPKR(shipment.totalLandedCostPKR)}</td>
                    <td>
                      <span className="tag">{wh?.name ?? shipment.receivingLocationName}</span>
                    </td>
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
                          setSelectedShipment(shipment);
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredShipments.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="No import shipments found"
                      text="Try clearing the search query or changing the status filter."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Shipment Detail Modal */}
      {selectedShipment && (
        <Modal
          title={`Import Consignment: ${selectedShipment.reference}`}
          subtitle={`Origin: ${selectedShipment.countryOfOrigin} · Supplier: ${selectedShipment.supplierName}`}
          onClose={() => setSelectedShipment(null)}
          wide
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <Card pad>
              <div className="label" style={{ marginBottom: 12 }}>Shipment Overview</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div><strong>Product:</strong> {selectedShipment.productName} ({selectedShipment.category})</div>
                <div><strong>Quantity:</strong> {selectedShipment.quantity.toLocaleString()} {selectedShipment.unit}</div>
                <div><strong>Port of Entry:</strong> {selectedShipment.portOfEntry || 'N/A'}</div>
                <div><strong>Bill of Lading / AWB:</strong> <span className="mono">{selectedShipment.blNumber || 'N/A'}</span></div>
                <div>
                  <strong>Receiving Location:</strong>{' '}
                  {data.warehouses.find((w) => w.id === selectedShipment.receivingLocationId)?.name || selectedShipment.receivingLocationName}
                </div>
                <div><strong>Date Recorded:</strong> {formatDate(selectedShipment.date)}</div>
                <div><strong>Current Status:</strong> <span className={`badge ${STATUS_CONFIG[selectedShipment.status].cls}`}>{STATUS_CONFIG[selectedShipment.status].label}</span></div>
                {selectedShipment.notes && <div><strong>Notes:</strong> {selectedShipment.notes}</div>}
              </div>
            </Card>

            <Card pad>
              <div className="label" style={{ marginBottom: 12 }}>Landed Cost Breakdown (PKR)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Foreign Purchase ({formatFxAmount(selectedShipment.totalPurchaseAmountForeign, selectedShipment.currency)} @ {selectedShipment.exchangeRate}):</span>
                  <span className="mono">{formatPKR(selectedShipment.totalPurchaseAmountPKR)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Freight &amp; Shipping Charges:</span>
                  <span className="mono">{formatPKR(selectedShipment.shippingChargesPKR)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Customs &amp; Tariffs:</span>
                  <span className="mono">{formatPKR(selectedShipment.customsChargesPKR)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Port Clearance &amp; Other Expenses:</span>
                  <span className="mono">{formatPKR(selectedShipment.otherExpensesPKR)}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                  <span>Total Landed Cost:</span>
                  <span className="mono" style={{ color: 'var(--blue-700)' }}>{formatPKR(selectedShipment.totalLandedCostPKR)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Per Unit Landed Cost: {formatPKR(selectedShipment.unitLandedCostPKR)} / {selectedShipment.unit}
                </div>
              </div>
            </Card>
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Status controls update warehouse stock automatically upon verified receipt.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedShipment.status !== 'received' && (
                <button
                  className="btn success sm"
                  onClick={() => handleStatusChange(selectedShipment.id, 'received')}
                >
                  <CheckCircle2 size={14} /> Mark as Received (Add to Stock)
                </button>
              )}
              {selectedShipment.status !== 'in_transit' && selectedShipment.status !== 'received' && (
                <button
                  className="btn primary sm"
                  onClick={() => handleStatusChange(selectedShipment.id, 'in_transit')}
                >
                  <Ship size={14} /> Mark as In Transit
                </button>
              )}
              {selectedShipment.status !== 'cancelled' && (
                <button
                  className="btn danger sm"
                  onClick={() => handleStatusChange(selectedShipment.id, 'cancelled')}
                >
                  Cancel Shipment
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* New Import Shipment Modal */}
      {createModalOpen && (
        <Modal
          title="Record New Import Consignment"
          subtitle="Record international purchase, customs valuation, and freight costs. (DEMO DATA)"
          onClose={() => setCreateModalOpen(false)}
          wide
        >
          <form onSubmit={handleCreateImport}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div className="field">
                <label className="label">Supplier Name</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="label">Country of Origin</label>
                <input
                  type="text"
                  className="input"
                  required
                  value={countryOfOrigin}
                  onChange={(e) => setCountryOfOrigin(e.target.value)}
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
                <label className="label">Quantity</label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
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
                <label className="label">Foreign Purchase Rate (Per Unit)</label>
                <input
                  type="number"
                  step="any"
                  min="0.000001"
                  className="input"
                  required
                  value={purchaseRateForeign}
                  onChange={(e) => setPurchaseRateForeign(Number(e.target.value))}
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
                <label className="label">Receiving Warehouse Location</label>
                <select
                  className="select"
                  value={receivingLocationId}
                  onChange={(e) => setReceivingLocationId(e.target.value)}
                >
                  {data.warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.city}, {w.country})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label">Freight &amp; Shipping Charges (PKR)</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={shippingChargesPKR}
                  onChange={(e) => setShippingChargesPKR(Number(e.target.value))}
                />
              </div>

              <div className="field">
                <label className="label">Customs &amp; Tariffs (PKR)</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={customsChargesPKR}
                  onChange={(e) => setCustomsChargesPKR(Number(e.target.value))}
                />
              </div>

              <div className="field">
                <label className="label">Other Port Clearance Charges (PKR)</label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={otherExpensesPKR}
                  onChange={(e) => setOtherExpensesPKR(Number(e.target.value))}
                />
              </div>

              <div className="field">
                <label className="label">Initial Status</label>
                <select
                  className="select"
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value as ImportStatus)}
                >
                  <option value="in_transit">In Transit (En Route)</option>
                  <option value="ordered">Ordered (Awaiting Dispatch)</option>
                  <option value="draft">Draft</option>
                  <option value="received">Received (Immediately Add to Warehouse Stock)</option>
                </select>
              </div>

              <div className="field">
                <label className="label">Bill of Lading / Tracking Ref</label>
                <input
                  type="text"
                  className="input"
                  value={blNumber}
                  onChange={(e) => setBlNumber(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="label">Port of Entry</label>
                <input
                  type="text"
                  className="input"
                  value={portOfEntry}
                  onChange={(e) => setPortOfEntry(e.target.value)}
                />
              </div>
            </div>

            {/* Landed Cost Realtime Summary */}
            <div style={{ marginTop: 16, padding: 14, background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span>Foreign Total: <strong>{formatFxAmount(totalPurchaseForeign, currency)}</strong></span>
                <span>PKR Conversion: <strong>{formatPKR(totalPurchasePKR)}</strong></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--blue-700)' }}>
                <span>Computed Landed Cost (PKR):</span>
                <span>{formatPKR(totalLandedCostPKR)}</span>
              </div>
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn ghost" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Confirm &amp; Record Import
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Page>
  );
}
