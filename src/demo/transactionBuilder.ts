import type { DemoDataset, JournalLine, TransactionType } from './types';

export interface TransactionForm {
  type: TransactionType;
  date: string;
  amount: number;
  partyId: string;
  /** Bank / cash account used. */
  accountId: string;
  /** Destination account for transfers. */
  toAccountId: string;
  /** Expense / income head. */
  categoryAccountId: string;
  description: string;
  /** Sales & purchases: treat as cash/bank transaction instead of credit. */
  paidImmediately: boolean;
  /** Sales: also post 70% cost of goods sold against inventory. */
  includeCogs: boolean;
}

export const TYPE_OPTIONS: { value: TransactionType; label: string; help: string }[] = [
  { value: 'receipt', label: 'Money Received', help: 'Customer pays you — debit cash/bank, credit Accounts Receivable.' },
  { value: 'payment', label: 'Money Paid', help: 'You pay a supplier — debit Accounts Payable, credit cash/bank.' },
  { value: 'sales', label: 'Sales Invoice', help: 'Credit sale posts to Accounts Receivable; cash sale posts to cash/bank. Cost of goods sold is posted automatically.' },
  { value: 'purchase', label: 'Purchase Invoice', help: 'Stock received — debit Inventory, credit Accounts Payable (or bank).' },
  { value: 'expense', label: 'Expense', help: 'Operating expense — debit the expense head, credit cash/bank.' },
  { value: 'deposit', label: 'Cash Deposit', help: 'Move cash into a bank account.' },
  { value: 'withdrawal', label: 'Cash Withdrawal', help: 'Move money from a bank account into cash.' },
  { value: 'transfer', label: 'Bank Transfer', help: 'Move funds between two bank accounts.' },
];

export function emptyForm(today: string): TransactionForm {
  return {
    type: 'receipt',
    date: today,
    amount: 0,
    partyId: '',
    accountId: '1010',
    toAccountId: '1020',
    categoryAccountId: '5140',
    description: '',
    paidImmediately: false,
    includeCogs: true,
  };
}

export function buildLines(ds: DemoDataset, form: TransactionForm): JournalLine[] {
  const amount = Math.max(0, Math.round(form.amount || 0));
  const bankOrCash = form.accountId;
  switch (form.type) {
    case 'receipt':
      return [
        { accountId: bankOrCash, debit: amount, credit: 0 },
        { accountId: '1100', debit: 0, credit: amount, partyId: form.partyId || undefined },
      ];
    case 'payment':
      return [
        { accountId: '2000', debit: amount, credit: 0, partyId: form.partyId || undefined },
        { accountId: bankOrCash, debit: 0, credit: amount },
      ];
    case 'sales': {
      const cogs = form.includeCogs ? Math.round(amount * 0.7) : 0;
      const lines: JournalLine[] = form.paidImmediately
        ? [{ accountId: bankOrCash, debit: amount, credit: 0 }, { accountId: '4000', debit: 0, credit: amount }]
        : [{ accountId: '1100', debit: amount, credit: 0, partyId: form.partyId || undefined }, { accountId: '4000', debit: 0, credit: amount }];
      if (cogs > 0) {
        lines.push({ accountId: '5000', debit: cogs, credit: 0 });
        lines.push({ accountId: '1200', debit: 0, credit: cogs });
      }
      return lines;
    }
    case 'purchase':
      return form.paidImmediately
        ? [{ accountId: '1200', debit: amount, credit: 0 }, { accountId: bankOrCash, debit: 0, credit: amount }]
        : [{ accountId: '1200', debit: amount, credit: 0 }, { accountId: '2000', debit: 0, credit: amount, partyId: form.partyId || undefined }];
    case 'expense':
      return [
        { accountId: form.categoryAccountId, debit: amount, credit: 0 },
        { accountId: bankOrCash, debit: 0, credit: amount },
      ];
    case 'deposit':
      return [
        { accountId: form.toAccountId, debit: amount, credit: 0 },
        { accountId: '1000', debit: 0, credit: amount },
      ];
    case 'withdrawal':
      return [
        { accountId: '1000', debit: amount, credit: 0 },
        { accountId: form.accountId, debit: 0, credit: amount },
      ];
    case 'transfer':
      return [
        { accountId: form.toAccountId, debit: amount, credit: 0 },
        { accountId: form.accountId, debit: 0, credit: amount },
      ];
    default:
      return [];
  }
}

export function validateForm(ds: DemoDataset, form: TransactionForm): string[] {
  const errors: string[] = [];
  if (!form.date) errors.push('Select a transaction date.');
  if (!form.amount || form.amount <= 0) errors.push('Enter an amount greater than zero.');
  if ((form.type === 'receipt' || form.type === 'payment') && !form.partyId) {
    errors.push(`Select a ${form.type === 'receipt' ? 'customer' : 'supplier'} for this ${form.type}.`);
  }
  if (form.type === 'transfer' && form.accountId === form.toAccountId) {
    errors.push('Choose two different bank accounts for a transfer.');
  }
  if (!form.description.trim()) errors.push('Add a short description / narration.');
  const lines = buildLines(ds, form);
  const dr = lines.reduce((s, l) => s + l.debit, 0);
  const cr = lines.reduce((s, l) => s + l.credit, 0);
  if (lines.length && Math.round(dr) !== Math.round(cr)) errors.push('Draft is not balanced.');
  return errors;
}
