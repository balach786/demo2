/**
 * TRADE & MULTI-CURRENCY DEMO TYPE DEFINITIONS
 * AI Business Secretary & Accountant
 *
 * All records in this file represent fictional sample demonstration data.
 * No external database or real banking/exchange connection is used.
 */

/* ------------------------------------------------------------------ */
/* 1. Warehouses & Locations                                           */
/* ------------------------------------------------------------------ */

export interface WarehouseLocation {
  id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  address: string;
  contactPerson: string;
  phone: string;
  isFictionalDemo: true;
}

/* ------------------------------------------------------------------ */
/* 2. Product Catalog & Inventory                                      */
/* ------------------------------------------------------------------ */

export type ProductUnit = 'MT' | 'Bales' | 'Units' | 'Kg' | 'Cartons' | 'Bags';

export interface LocationStock {
  available: number;
  reserved: number;
}

export interface InventoryProduct {
  id: string;
  sku: string;
  name: string;
  category: 'Textiles' | 'Electronics' | 'Agriculture & Food' | 'Industrial Hardware' | 'Spices' | 'General Cargo';
  unit: ProductUnit;
  costPricePKR: number; // Benchmark unit cost in PKR
  sellingPricePKR: number; // Benchmark unit selling price in PKR
  minStockLevel: number;
  /** Stock by warehouse location ID */
  locations: Record<string, LocationStock>;
  description?: string;
  hscode?: string;
  movements?: StockMovement[];
}

export type StockMovementType =
  | 'import_received'
  | 'export_dispatched'
  | 'transfer_out'
  | 'transfer_in'
  | 'opening_stock'
  | 'stock_adjustment';

export interface StockMovement {
  id: string;
  date: string; // ISO yyyy-mm-dd
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  type: StockMovementType;
  quantityChange: number; // positive for additions, negative for reductions
  balanceAfter: number;
  reference: string;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* 3. Inter-Warehouse Stock Transfers                                 */
/* ------------------------------------------------------------------ */

export type TransferStatus = 'draft' | 'in_transit' | 'received' | 'cancelled';
export type StockTransferStatus = TransferStatus;

export interface StockTransfer {
  id: string;
  reference: string;
  date: string; // ISO yyyy-mm-dd
  productId: string;
  productName: string;
  sourceLocationId: string;
  sourceLocationName: string;
  destinationLocationId: string;
  destinationLocationName: string;
  quantity: number;
  unit: ProductUnit;
  status: TransferStatus;
  carrier?: string;
  trackingNumber?: string;
  notes?: string;
  initiatedAt: string;
  receivedAt?: string;
  simulated: true;
}

/* ------------------------------------------------------------------ */
/* 4. Import Shipments                                                 */
/* ------------------------------------------------------------------ */

export type ImportStatus =
  | 'draft'
  | 'ordered'
  | 'in_transit'
  | 'received'
  | 'partially_received'
  | 'cancelled';

export interface ImportShipment {
  id: string;
  reference: string; // e.g. IMP-2026-001
  date: string; // ISO yyyy-mm-dd
  supplierId: string;
  supplierName: string;
  countryOfOrigin: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unit: ProductUnit;
  purchaseRate: number; // In foreign currency (or PKR if local)
  currency: 'USD' | 'AED' | 'IRR' | 'PKR';
  exchangeRate: number; // PKR per 1 foreign currency unit
  totalPurchaseAmountForeign: number;
  totalPurchaseAmountPKR: number;
  shippingChargesPKR: number;
  customsChargesPKR: number;
  otherExpensesPKR: number;
  totalLandedCostPKR: number; // Purchase in PKR + shipping + customs + other
  unitLandedCostPKR: number; // totalLandedCostPKR / quantity
  receivingLocationId: string;
  receivingLocationName: string;
  status: ImportStatus;
  receivedQuantity: number;
  blNumber?: string;
  portOfEntry?: string;
  notes?: string;
  accountingVoucherRef?: string;
  simulated: true;
}

/* ------------------------------------------------------------------ */
/* 5. Export Shipments                                                 */
/* ------------------------------------------------------------------ */

export type ExportStatus =
  | 'draft'
  | 'confirmed'
  | 'ready_for_dispatch'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

export interface ExportShipment {
  id: string;
  reference: string; // e.g. EXP-2026-001
  date: string; // ISO yyyy-mm-dd
  customerId: string;
  customerName: string;
  destinationCountry: string;
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unit: ProductUnit;
  sellingRate: number; // In foreign currency (or PKR if local)
  currency: 'USD' | 'AED' | 'IRR' | 'PKR';
  exchangeRate: number; // PKR per 1 foreign currency unit
  totalSaleAmountForeign: number;
  totalSaleAmountPKR: number;
  shippingChargesPKR: number;
  otherExpensesPKR: number;
  netRealizationPKR: number; // totalSaleAmountPKR - shipping - other expenses
  dispatchLocationId: string;
  dispatchLocationName: string;
  status: ExportStatus;
  containerNumber?: string;
  portOfExit?: string;
  notes?: string;
  accountingVoucherRef?: string;
  simulated: true;
}

/* ------------------------------------------------------------------ */
/* 6. Multi-Currency Exchange Management                              */
/* ------------------------------------------------------------------ */

export type FxCurrency = 'USD' | 'AED' | 'IRR';

export type FxTransactionType = 'purchase' | 'sale';
export type FxType = FxTransactionType;

export interface FxTransaction {
  id: string;
  reference: string; // e.g. FX-2026-001
  date: string; // ISO yyyy-mm-dd
  type: FxTransactionType;
  currency: FxCurrency;
  foreignAmount: number; // Foreign currency amount (e.g. 10,000 USD)
  exchangeRate: number; // Exchange rate (PKR per 1 foreign currency unit)
  totalPKR: number; // foreignAmount * exchangeRate
  costBasisPKR?: number; // Weighted average cost basis in PKR at the time of sale
  realizedGainLossPKR?: number; // totalPKR - costBasisPKR (for sales only)
  partyName: string; // Counterparty/Customer/Seller
  counterparty?: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque';
  accountId: string; // PKR account used (1000 Cash, 1010 HBL, 1020 Meezan)
  accountName: string;
  settlementAccount?: string;
  chargesPKR: number;
  notes?: string;
  accountingVoucherRef?: string;
  simulated: true;
}

export interface FxBalanceSummary {
  currency: FxCurrency;
  currencyName: string;
  symbol: string;
  availableBalance: number;
  totalPurchased: number;
  totalSold: number;
  weightedAvgCostRate: number; // PKR per 1 unit
  totalPKRInvested: number; // availableBalance * weightedAvgCostRate
  totalRealizedProfitLossPKR: number;
  denominationNote?: string;
}
