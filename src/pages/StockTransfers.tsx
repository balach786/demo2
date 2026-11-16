import { useMemo, useState } from 'react';
import {
  ArrowLeftRight, Plus, Search, Filter, CheckCircle2, Clock,
  Truck, AlertCircle, Building2, ShieldCheck, AlertTriangle
} from 'lucide-react';
import { Page, Card, CardHead, Kpi, Modal, EmptyState } from '../components/ui';
import { useStore } from '../demo/store';
import { formatDate } from '../lib/format';
import type { StockTransfer, TransferStatus } from '../demo/tradeTypes';

const STATUS_CONFIG: Record<TransferStatus, { label: string; cls: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', cls: 'outline', icon: Clock },
  in_transit: { label: 'In Transit', cls: 'blue', icon: Truck },
  received: { label: 'Received (Stock Credited)', cls: 'green', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', cls: 'red', icon: AlertCircle },
};

export default function StockTransfers() {
  const { data, addStockTransfer, receiveStockTransfer, pushToast } = useStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TransferStatus>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Form State
  const [productId, setProductId] = useState(data.inventory[0]?.id || '');
  const [sourceLocationId, setSourceLocationId] = useState(data.warehouses[0]?.id || 'LOC-MAIN');
  const [destinationLocationId, setDestinationLocationId] = useState(data.warehouses[1]?.id || 'LOC-LHR');
  const [quantity, setQuantity] = useState(25);
  const [carrier, setCarrier] = useState('TCS Logistics Freight Division');
  const [trackingNumber, setTrackingNumber] = useState('TRK-PK-98214');
  const [notes, setNotes] = useState('Stock rebalancing to meet regional customer demand.');

  // Selected product & source stock check
  const selectedProduct = useMemo(() => {
    return data.inventory.find((p) => p.id === productId);
  }, [data.inventory, productId]);

  const sourceAvailableStock = useMemo(() => {
    if (!selectedProduct) return 0;
    return selectedProduct.locations[sourceLocationId]?.available ?? 0;
  }, [selectedProduct, sourceLocationId]);

  const isStockInsufficient = quantity > sourceAvailableStock;
  const isSameLocation = sourceLocationId === destinationLocationId;

  // Filtered transfers
  const filteredTransfers = useMemo(() => {
    return data.stockTransfers.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        t.reference.toLowerCase().includes(q) ||
        t.productName.toLowerCase().includes(q) ||
        (t.carrier && t.carrier.toLowerCase().includes(q)) ||
        (t.trackingNumber && t.trackingNumber.toLowerCase().includes(q)) ||
        t.sourceLocationName.toLowerCase().includes(q) ||
        t.destinationLocationName.toLowerCase().includes(q)
      );
    });
  }, [data.stockTransfers, search, statusFilter]);

  // Aggregate KPIs
  const kpis = useMemo(() => {
    const totalCount = data.stockTransfers.length;
    const inTransitCount = data.stockTransfers.filter((t) => t.status === 'in_transit').length;
    const receivedCount = data.stockTransfers.filter((t) => t.status === 'received').length;
    const unitsInTransit = data.stockTransfers
      .filter((t) => t.status === 'in_transit')
      .reduce((sum, t) => sum + t.quantity, 0);

    return { totalCount, inTransitCount, receivedCount, unitsInTransit };
  }, [data.stockTransfers]);

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      pushToast({ tone: 'error', title: 'Invalid Product', text: 'Please select a valid product.' });
      return;
    }
    if (isSameLocation) {
      pushToast({ tone: 'error', title: 'Invalid Route', text: 'Source and destination warehouses cannot be the same.' });
      return;
    }
    if (isStockInsufficient) {
      pushToast({
        tone: 'error',
        title: 'Insufficient Stock',
        text: `Insufficient stock at source warehouse! Only ${sourceAvailableStock} available.`,
      });
      return;
    }

    const src = data.warehouses.find((w) => w.id === sourceLocationId);
    const dst = data.warehouses.find((w) => w.id === destinationLocationId);

    const created = addStockTransfer({
      date: new Date().toISOString().split('T')[0],
      sourceLocationId,
      sourceLocationName: src?.name ?? sourceLocationId,
      destinationLocationId,
      destinationLocationName: dst?.name ?? destinationLocationId,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity,
      unit: selectedProduct.unit,
      status: 'in_transit',
      carrier,
      trackingNumber,
      notes,
    });

    pushToast({
      tone: 'success',
      title: 'Stock Transfer Initiated',
      text: `Transfer ${created.reference}: ${quantity} units placed in transit.`,
    });
    setCreateModalOpen(false);
  };

  const handleConfirmReceipt = (transferId: string, reference: string) => {
    receiveStockTransfer(transferId);
    pushToast({
      tone: 'success',
      title: 'Transfer Received',
      text: `Transfer ${reference} marked as received! Destination warehouse stock credited.`,
    });
  };

  return (
    <Page
      title="Inter-Warehouse Stock Transfers"
      eyebrow="Trade & Logistics"
      subtitle="Safely move inventory between facilities with in-transit reservation controls to prevent duplicate counting."
      actions={
        <button className="btn primary" onClick={() => setCreateModalOpen(true)}>
          <Plus size={15} />
          <span>Initiate Stock Transfer</span>
        </button>
      }
    >
      {/* Demo Guardrails Banner */}
      <div className="callout info" style={{ marginBottom: 18, borderLeft: '4px solid var(--blue-600)' }}>
        <ShieldCheck size={18} />
        <div>
          <strong>DUAL-VERIFICATION STOCK INTEGRITY (DEMO DATA)</strong>
          <div style={{ fontSize: 12.5, marginTop: 2, color: 'var(--text-2)' }}>
            Transferred goods are marked <strong>Reserved</strong> at the source warehouse while in transit.
            Destination stock is <strong>strictly credited only after physical receipt is confirmed</strong>, ensuring no duplicate or missing inventory.
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <Kpi
          label="Total Inter-Warehouse Transfers"
          value={String(kpis.totalCount)}
          icon={<ArrowLeftRight size={17} />}
          tone="navy"
          hint="All recorded transfer requests"
        />
        <Kpi
          label="In-Transit Transfers"
          value={String(kpis.inTransitCount)}
          icon={<Truck size={17} />}
          tone="blue"
          hint={`${kpis.unitsInTransit.toLocaleString()} units currently on the road`}
        />
        <Kpi
          label="Completed Receipts"
          value={String(kpis.receivedCount)}
          icon={<CheckCircle2 size={17} />}
          tone="green"
          hint="Safely delivered and reconciled"
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
              placeholder="Search by transfer reference, product, carrier..."
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
                All ({data.stockTransfers.length})
              </button>
              <button
                className={statusFilter === 'in_transit' ? 'active' : ''}
                onClick={() => setStatusFilter('in_transit')}
              >
                In Transit ({kpis.inTransitCount})
              </button>
              <button
                className={statusFilter === 'received' ? 'active' : ''}
                onClick={() => setStatusFilter('received')}
              >
                Received ({kpis.receivedCount})
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Transfers Register */}
      <Card>
        <CardHead
          title="Stock Transfer Register"
          sub={`${filteredTransfers.length} inter-warehouse transfers`}
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Product &amp; Quantity</th>
                <th>Origin Facility</th>
                <th>Destination Facility</th>
                <th>Carrier / Tracking</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.map((t) => {
                const statusMeta = STATUS_CONFIG[t.status];
                return (
                  <tr key={t.id}>
                    <td className="strong mono">{t.reference}</td>
                    <td>{formatDate(t.date)}</td>
                    <td>
                      <div className="cell-title">{t.productName}</div>
                      <div className="cell-sub">{t.quantity.toLocaleString()} {t.unit}</div>
                    </td>
                    <td>
                      <div className="cell-title">{t.sourceLocationName}</div>
                    </td>
                    <td>
                      <div className="cell-title">{t.destinationLocationName}</div>
                    </td>
                    <td>
                      <div className="cell-title">{t.carrier || 'Direct Internal Transfer'}</div>
                      <div className="cell-sub mono">{t.trackingNumber || 'N/A'}</div>
                    </td>
                    <td>
                      <span className={`badge ${statusMeta.cls}`}>
                        <span className="dot" />
                        {statusMeta.label}
                      </span>
                    </td>
                    <td>
                      {t.status === 'in_transit' ? (
                        <button
                          className="btn success sm"
                          onClick={() => handleConfirmReceipt(t.id, t.reference)}
                        >
                          <CheckCircle2 size={13} /> Confirm Receipt
                        </button>
                      ) : (
                        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Reconciled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredTransfers.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="No stock transfers found"
                      text="Try adjusting your filter or search query."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New Transfer Modal */}
      {createModalOpen && (
        <Modal
          title="Initiate Inter-Warehouse Stock Transfer"
          subtitle="Move stock between physical locations with automatic inventory reservation. (DEMO DATA)"
          onClose={() => setCreateModalOpen(false)}
        >
          <form onSubmit={handleCreateTransfer}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label className="label">Source Warehouse (Origin)</label>
                  <select
                    className="select"
                    value={sourceLocationId}
                    onChange={(e) => setSourceLocationId(e.target.value)}
                    required
                  >
                    {data.warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.city})
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11.5, color: isStockInsufficient ? 'var(--red)' : 'var(--muted)', marginTop: 2 }}>
                    Available: <strong>{sourceAvailableStock} units</strong>
                  </div>
                </div>

                <div className="field">
                  <label className="label">Destination Warehouse</label>
                  <select
                    className="select"
                    value={destinationLocationId}
                    onChange={(e) => setDestinationLocationId(e.target.value)}
                    required
                  >
                    {data.warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isSameLocation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red)', fontSize: 12 }}>
                  <AlertTriangle size={14} />
                  <span>Origin and destination cannot be identical!</span>
                </div>
              )}

              <div className="field">
                <label className="label">Transfer Quantity</label>
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
                    <span>Insufficient stock! Only {sourceAvailableStock} available.</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label className="label">Freight Carrier / Trucking Co.</label>
                  <input
                    type="text"
                    className="input"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label className="label">Tracking Number / Bilty</label>
                  <input
                    type="text"
                    className="input"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">Internal Notes</label>
                <input
                  type="text"
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 10, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn ghost" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={isStockInsufficient || isSameLocation}
                >
                  Dispatch &amp; Reserve Stock
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </Page>
  );
}
