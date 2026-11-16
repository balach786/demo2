/**
 * DEMO DATA MODEL — AI Business Secretary & Accountant
 *
 * Everything in this file describes the ISOLATED demonstration dataset.
 * There is no database connection, no external API and no production data here.
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  group: string;
  normalBalance: NormalBalance;
  isCash?: boolean;
  isBank?: boolean;
  bankName?: string;
  accountTitle?: string;
  accountNumber?: string;
  description?: string;
  /** Opening balance as posted on the first day of the demo period (natural side). */
  openingBalance: number;
}

export interface Party {
  id: string;
  code: string;
  name: string;
  type: 'customer' | 'supplier';
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  ntn: string;
  paymentTerms: string;
  creditLimit: number;
  since: string;
  openingBalance: number;
  openingBalanceType: NormalBalance;
}

export type TransactionType =
  | 'opening'
  | 'sales'
  | 'purchase'
  | 'receipt'
  | 'payment'
  | 'expense'
  | 'deposit'
  | 'withdrawal'
  | 'transfer';

export type EntrySource = 'seed' | 'manual' | 'ai' | 'document';

export interface JournalLine {
  accountId: string;
  partyId?: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  reference: string;
  date: string; // ISO yyyy-mm-dd
  type: TransactionType;
  description: string;
  lines: JournalLine[];
  createdAt: string;
  source: EntrySource;
  status: 'posted';
}

export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'completed' | 'rejected';

export interface DraftTransaction {
  type: TransactionType;
  date: string;
  amount: number;
  partyId?: string;
  /** Cash / bank account used (or expense account for expense drafts). */
  accountId: string;
  /** Expense/income head when relevant. */
  categoryAccountId?: string;
  description: string;
  lines: JournalLine[];
}

export interface Approval {
  id: string;
  reference: string;
  createdAt: string;
  origin: 'ai' | 'document' | 'manual';
  title: string;
  subtitle: string;
  command?: string;
  status: ApprovalStatus;
  draft: DraftTransaction;
  confidence?: number;
  uncertainties?: string[];
  documentId?: string;
  approvedAt?: string;
  approvedBy?: string;
  postedEntryId?: string;
  rejectionReason?: string;
  simulated: true;
}

export type DocumentKind = 'bank-slip' | 'payment-receipt' | 'purchase-invoice' | 'sales-invoice';

export interface DemoDocument {
  id: string;
  name: string;
  kind: DocumentKind;
  uploadedAt: string;
  uploadedBy: string;
  sizeLabel: string;
  /** True for the three bundled sample documents shipped with the demo. */
  isSample: boolean;
  /** Simulated extraction result (never derived from the real file content). */
  extraction: {
    documentType: string;
    partyId?: string;
    partyName: string;
    amount: number;
    date: string;
    reference?: string;
    bankAccountId?: string;
    confidence: number;
    missingFields: string[];
  };
  status: 'extracted' | 'draft-created' | 'posted';
  previewKind?: DocumentKind;
  fileUrl?: string;
}

export interface Activity {
  id: string;
  at: string;
  actor: 'ai' | 'user' | 'system';
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
}

import type {
  WarehouseLocation,
  InventoryProduct,
  StockTransfer,
  ImportShipment,
  ExportShipment,
  FxTransaction,
} from './tradeTypes';

export * from './tradeTypes';

export interface DemoDataset {
  /** Fixed demo clock so a live presentation is always deterministic. */
  demoToday: string;
  fiscalYearStart: string;
  business: {
    name: string;
    legalName: string;
    currency: string;
    currencyCode: string;
    ntn: string;
    address: string;
    phone: string;
    email: string;
    fiscalYearLabel: string;
    logoInitials: string;
  };
  accounts: Account[];
  parties: Party[];
  entries: JournalEntry[];
  documents: DemoDocument[];
  approvals: Approval[];
  activities: Activity[];
  warehouses: WarehouseLocation[];
  inventory: InventoryProduct[];
  stockTransfers: StockTransfer[];
  imports: ImportShipment[];
  exports: ExportShipment[];
  fxTransactions: FxTransaction[];
}
