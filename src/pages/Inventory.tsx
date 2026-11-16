import { useMemo, useState } from 'react';
import {
  Boxes, Search, Filter, AlertTriangle, Building2,
  DollarSign, TrendingDown, Layers, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { Page, Card, CardHead, Kpi, Modal, EmptyState } from '../components/ui';
import { useStore } from '../demo/store';
import { formatDate, formatPKR } from '../lib/format';
import {
  calculateTotalInventoryValuation,
  getProductTotalStock,
  getProductValuation,
  isLowStock
} from '../demo/tradeLogic';
import type { InventoryProduct, StockMovement } from '../demo/tradeTypes';

export default function Inventory() {
  const { data } = useStore();

  const [activeTab, setActiveTab] = useState<'catalog' | 'locations' | 'movements'>('catalog');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);

  // Available categories
  const categories = useMemo(() => {
    const set = new Set(data.inventory.map((p) => p.category));
    return Array.from(set);
  }, [data.inventory]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return data.inventory.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [data.inventory, search, categoryFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalValuation = calculateTotalInventoryValuation(data.inventory);
    let totalUnits = 0;
    let lowStockCount = 0;

    for (const p of data.inventory) {
      const stock = getProductTotalStock(p);
      totalUnits += stock.total;
      if (isLowStock(p)) lowStockCount++;
    }

    return { totalValuation, totalUnits, lowStockCount };
  }, [data.inventory]);

  // Dynamically constructed audit movements from operational records
  const allMovements = useMemo(() => {
    const list: Array<{
      id: string;
      productId: string;
      productName: string;
      date: string;
      type: string;
      quantity: number;
      locationName: string;
      reference: string;
      notes?: string;
    }> = [];

    // 1. Imports
    for (const imp of data.imports) {
      if (imp.status === 'received') {
        list.push({
          id: `MOV-${imp.id}`,
          productId: imp.productId,
          productName: imp.productName,
          date: imp.date,
          type: 'Import Received',
          quantity: imp.quantity,
          locationName: imp.receivingLocationName,
          reference: imp.reference,
          notes: `Supplier: ${imp.supplierName} (${imp.countryOfOrigin})`,
        });
      }
    }

    // 2. Exports
    for (const exp of data.exports) {
      if (exp.status === 'dispatched' || exp.status === 'delivered') {
        list.push({
          id: `MOV-${exp.id}`,
          productId: exp.productId,
          productName: exp.productName,
          date: exp.date,
          type: 'Export Dispatched',
          quantity: -exp.quantity,
          locationName: exp.dispatchLocationName,
          reference: exp.reference,
          notes: `Customer: ${exp.customerName} (${exp.destinationCountry})`,
        });
      }
    }

    // 3. Stock Transfers
    for (const trf of data.stockTransfers) {
      if (trf.status === 'received') {
        list.push({
          id: `MOV-${trf.id}-OUT`,
          productId: trf.productId,
          productName: trf.productName,
          date: trf.date,
          type: 'Inter-WH Transfer Out',
          quantity: -trf.quantity,
          locationName: trf.sourceLocationName,
          reference: trf.reference,
          notes: `Transferred to ${trf.destinationLocationName}`,
        });
        list.push({
          id: `MOV-${trf.id}-IN`,
          productId: trf.productId,
          productName: trf.productName,
          date: trf.date,
          type: 'Inter-WH Transfer In',
          quantity: trf.quantity,
          locationName: trf.destinationLocationName,
          reference: trf.reference,
          notes: `Received from ${trf.sourceLocationName}`,
        });
      }
    }

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [data.imports, data.exports, data.stockTransfers]);

  const lowStockItems = useMemo(() => {
    return data.inventory.filter(isLowStock);
  }, [data.inventory]);

  return (
    <Page
      title="Inventory Management"
      eyebrow="Trade & Logistics"
      subtitle="Multi-warehouse stock balances, valuation ledger, replenishment thresholds, and audit trails."
      actions={
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="segmented">
            <button
              className={activeTab === 'catalog' ? 'active' : ''}
              onClick={() => setActiveTab('catalog')}
            >
              Product Catalog
            </button>
            <button
              className={activeTab === 'locations' ? 'active' : ''}
              onClick={() => setActiveTab('locations')}
            >
              Location Matrix
            </button>
            <button
              className={activeTab === 'movements' ? 'active' : ''}
              onClick={() => setActiveTab('movements')}
            >
              Stock Audit Trail ({allMovements.length})
            </button>
          </div>
        </div>
      }
    >
      {/* Demo Notice Banner */}
      <div className="callout info" style={{ marginBottom: 18, borderLeft: '4px solid var(--blue-600)' }}>
        <Building2 size={18} />
        <div>
          <strong>DEMO DATA — Fictional Warehouse Distribution</strong>
          <div style={{ fontSize: 12.5, marginTop: 2, color: 'var(--text-2)' }}>
            Warehouse locations (Main, Karachi Port, Dubai, Lahore) and stock valuation figures are fictional samples.
            Stock automatically syncs with verified import receipts, export dispatches, and inter-warehouse transfers.
          </div>
        </div>
      </div>

      {/* Low Stock Alert if any */}
      {lowStockItems.length > 0 && (
        <div className="callout warn" style={{ marginBottom: 18, borderLeft: '4px solid var(--amber)' }}>
          <AlertTriangle size={18} />
          <div>
            <strong>Low Stock Reorder Alert ({lowStockItems.length} Products)</strong>
            <div style={{ fontSize: 12.5, marginTop: 2 }}>
              {lowStockItems.map((p) => {
                const s = getProductTotalStock(p);
                return `${p.name} (Available: ${s.available} vs Min: ${p.minStockLevel})`;
              }).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <Kpi
          label="Total Inventory Valuation"
          value={formatPKR(stats.totalValuation)}
          icon={<DollarSign size={17} />}
          tone="blue"
          hint="Across all warehouses at cost price"
        />
        <Kpi
          label="Total Units in Stock"
          value={stats.totalUnits.toLocaleString()}
          icon={<Boxes size={17} />}
          tone="teal"
          hint={`${data.inventory.length} distinct SKUs tracked`}
        />
        <Kpi
          label="Low Stock Items"
          value={String(stats.lowStockCount)}
          icon={<TrendingDown size={17} />}
          tone={stats.lowStockCount > 0 ? 'amber' : 'green'}
          hint="Items at or below safety reorder level"
        />
      </div>

      {/* Tab 1: Product Catalog */}
      {activeTab === 'catalog' && (
        <>
          <Card style={{ marginBottom: 18 }}>
            <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="input-group" style={{ flex: '1 1 240px' }}>
                <Search size={15} />
                <input
                  type="text"
                  className="input"
                  placeholder="Search products by SKU, name, category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Filter size={15} style={{ color: 'var(--muted)' }} />
                <select
                  className="select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ minWidth: 160 }}
                >
                  <option value="all">All Categories ({data.inventory.length})</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead
              title="Products &amp; Stock Valuation"
              sub={`${filteredProducts.length} items listed`}
            />
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product Name &amp; Category</th>
                    <th className="num">Cost (PKR)</th>
                    <th className="num">Selling (PKR)</th>
                    <th className="num">Available</th>
                    <th className="num">Reserved</th>
                    <th className="num">Total Stock</th>
                    <th className="num">Stock Valuation</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const s = getProductTotalStock(p);
                    const val = getProductValuation(p);
                    const low = isLowStock(p);
                    return (
                      <tr key={p.id} className="clickable" onClick={() => setSelectedProduct(p)}>
                        <td className="strong mono">{p.sku}</td>
                        <td>
                          <div className="cell-title">{p.name}</div>
                          <div className="cell-sub">{p.category} · Unit: {p.unit}</div>
                        </td>
                        <td className="num">{formatPKR(p.costPricePKR)}</td>
                        <td className="num">{formatPKR(p.sellingPricePKR)}</td>
                        <td className="num strong">{s.available.toLocaleString()}</td>
                        <td className="num">{s.reserved > 0 ? <span className="badge amber">{s.reserved}</span> : '0'}</td>
                        <td className="num strong">{s.total.toLocaleString()}</td>
                        <td className="num strong amount-pos">{formatPKR(val)}</td>
                        <td>
                          {low ? (
                            <span className="badge amber">
                              <span className="dot" />
                              Low Stock (≤{p.minStockLevel})
                            </span>
                          ) : (
                            <span className="badge green">
                              <span className="dot" />
                              Optimal Stock
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(p);
                            }}
                          >
                            Locations
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={10}>
                        <EmptyState
                          title="No products found"
                          text="Try adjusting your search or category filter."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Tab 2: Location-wise Stock Matrix */}
      {activeTab === 'locations' && (
        <Card>
          <CardHead
            title="Warehouse Location Distribution Matrix"
            sub="Breakdown of Available vs Reserved stock across all 4 demonstration facilities"
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  {data.warehouses.map((wh) => (
                    <th key={wh.id} className="num" style={{ minWidth: 140 }}>
                      <div>{wh.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'none' }}>{wh.city}</div>
                    </th>
                  ))}
                  <th className="num">Consolidated</th>
                </tr>
              </thead>
              <tbody>
                {data.inventory.map((p) => {
                  const total = getProductTotalStock(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="cell-title">{p.name}</div>
                        <div className="cell-sub mono">{p.sku} · {p.unit}</div>
                      </td>
                      {data.warehouses.map((wh) => {
                        const loc = p.locations[wh.id] || { available: 0, reserved: 0 };
                        return (
                          <td key={wh.id} className="num">
                            <div className="strong">{loc.available.toLocaleString()} avail</div>
                            {loc.reserved > 0 ? (
                              <div style={{ fontSize: 11, color: 'var(--amber)' }}>{loc.reserved} rsvd</div>
                            ) : (
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>0 rsvd</div>
                            )}
                          </td>
                        );
                      })}
                      <td className="num strong" style={{ background: 'var(--surface-2)' }}>
                        <div className="amount-pos">{total.available.toLocaleString()} avail</div>
                        {total.reserved > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--amber)' }}>{total.reserved} rsvd</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Movements Audit Log */}
      {activeTab === 'movements' && (
        <Card>
          <CardHead
            title="Stock Movement Ledger &amp; Audit Trail"
            sub="Chronological history of operational receipts, dispatches, and warehouse transfers"
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Facility</th>
                  <th className="num">Quantity Change</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {allMovements.map((m) => {
                  const isPositive = m.quantity > 0;
                  return (
                    <tr key={m.id}>
                      <td>{formatDate(m.date)}</td>
                      <td>
                        <div className="cell-title">{m.productName}</div>
                      </td>
                      <td>
                        <span className={`badge ${isPositive ? 'green' : 'amber'}`}>
                          {m.type}
                        </span>
                      </td>
                      <td className="mono strong">{m.reference}</td>
                      <td>
                        <span className="tag">{m.locationName}</span>
                      </td>
                      <td className={`num strong ${isPositive ? 'amount-pos' : 'amount-neg'}`}>
                        {isPositive ? `+${m.quantity}` : String(m.quantity)}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{m.notes || '—'}</td>
                    </tr>
                  );
                })}
                {allMovements.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState title="No stock movements recorded yet" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <Modal
          title={selectedProduct.name}
          subtitle={`SKU: ${selectedProduct.sku} · Category: ${selectedProduct.category}`}
          onClose={() => setSelectedProduct(null)}
          wide
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <Card pad>
              <div className="label" style={{ marginBottom: 12 }}>Product Details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div><strong>SKU:</strong> <span className="mono">{selectedProduct.sku}</span></div>
                <div><strong>Category:</strong> {selectedProduct.category}</div>
                <div><strong>Unit of Measure:</strong> {selectedProduct.unit}</div>
                <div><strong>Standard Cost Price:</strong> {formatPKR(selectedProduct.costPricePKR)}</div>
                <div><strong>Target Selling Price:</strong> {formatPKR(selectedProduct.sellingPricePKR)}</div>
                <div><strong>Minimum Reorder Level:</strong> {selectedProduct.minStockLevel} {selectedProduct.unit}</div>
                <div>
                  <strong>Stock Status:</strong>{' '}
                  {isLowStock(selectedProduct) ? (
                    <span className="badge amber">Low Stock Reorder</span>
                  ) : (
                    <span className="badge green">Sufficient</span>
                  )}
                </div>
              </div>
            </Card>

            <Card pad>
              <div className="label" style={{ marginBottom: 12 }}>Warehouse Stock Distribution</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                {data.warehouses.map((wh) => {
                  const loc = selectedProduct.locations[wh.id] || { available: 0, reserved: 0 };
                  return (
                    <div key={wh.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                      <div>
                        <strong>{wh.name}</strong>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{wh.city}, {wh.country}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="strong">{loc.available} {selectedProduct.unit} avail</div>
                        {loc.reserved > 0 && <div style={{ fontSize: 11, color: 'var(--amber)' }}>{loc.reserved} reserved</div>}
                      </div>
                    </div>
                  );
                })}
                <div style={{ paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                  <span>Total Stock Valuation:</span>
                  <span className="mono amount-pos">{formatPKR(getProductValuation(selectedProduct))}</span>
                </div>
              </div>
            </Card>
          </div>
        </Modal>
      )}
    </Page>
  );
}
