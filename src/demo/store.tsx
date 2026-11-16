/**
 * DEMO STORE — isolated, in-memory demo state (optionally persisted to
 * localStorage under a demo-only key).
 *
 * No network calls, no database, no bank/email integration. Every mutation
 * stays inside the browser session and can be reset from Settings or the topbar.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  Activity,
  Approval,
  ApprovalStatus,
  DemoDataset,
  DemoDocument,
  DraftTransaction,
  JournalEntry,
  TransactionType,
  ImportShipment,
  ImportStatus,
  ExportShipment,
  ExportStatus,
  StockTransfer,
  TransferStatus,
  FxTransaction,
  InventoryProduct,
} from './types';
import { DEMO_STORAGE_KEY, buildDemoDataset } from './seed';
import { computeFxBalances } from './tradeLogic';

const TYPE_PREFIX: Record<TransactionType, string> = {
  opening: 'OPS',
  sales: 'INV',
  purchase: 'BILL',
  receipt: 'RV',
  payment: 'PV',
  expense: 'EXP',
  deposit: 'DEP',
  withdrawal: 'WDR',
  transfer: 'TRF',
};

export interface Toast {
  id: number;
  title: string;
  text?: string;
  tone: 'success' | 'error' | 'info';
}

interface StoreValue {
  data: DemoDataset;
  toasts: Toast[];
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  postEntry: (input: {
    type: TransactionType;
    date: string;
    description: string;
    lines: DraftTransaction['lines'];
    source: 'manual' | 'ai' | 'document';
  }) => JournalEntry;
  createApproval: (input: {
    title: string;
    subtitle: string;
    origin: Approval['origin'];
    draft: DraftTransaction;
    command?: string;
    confidence?: number;
    uncertainties?: string[];
    documentId?: string;
    status?: ApprovalStatus;
  }) => Approval;
  updateApprovalDraft: (id: string, draft: DraftTransaction) => void;
  setApprovalStatus: (id: string, status: ApprovalStatus, note?: string) => void;
  approve: (id: string) => JournalEntry | null;
  reject: (id: string, reason: string) => void;
  addDocument: (doc: DemoDocument) => void;
  updateDocument: (id: string, patch: Partial<DemoDocument>) => void;
  addActivity: (a: Omit<Activity, 'id'>) => void;
  resetDemo: () => void;
  pendingCount: number;
  isPersisted: boolean;
  clearPersistence: () => void;

  /* Trade & Currency operations */
  addImport: (shipment: Omit<ImportShipment, 'id' | 'reference' | 'simulated'>) => ImportShipment;
  updateImportStatus: (id: string, status: ImportStatus, receivedQty?: number) => void;
  addExport: (shipment: Omit<ExportShipment, 'id' | 'reference' | 'simulated'>) => ExportShipment;
  updateExportStatus: (id: string, status: ExportStatus) => void;
  addStockTransfer: (transfer: Omit<StockTransfer, 'id' | 'reference' | 'simulated' | 'initiatedAt'>) => StockTransfer;
  receiveStockTransfer: (id: string) => void;
  addFxTransaction: (tx: Omit<FxTransaction, 'id' | 'reference' | 'simulated'>) => FxTransaction;
  updateInventoryStock: (productId: string, warehouseId: string, available: number, reserved?: number) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function loadInitial(): DemoDataset {
  const fresh = buildDemoDataset();
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as { version: number; data: DemoDataset };
    if (parsed.version !== 1 || !parsed.data?.entries) return fresh;
    // Guard: only accept a dataset that still describes the demo business.
    if (parsed.data.business?.name !== fresh.business.name) return fresh;

    // Ensure all trade & FX collections are populated even if loaded from older localStorage
    return {
      ...fresh,
      ...parsed.data,
      warehouses: parsed.data.warehouses?.length ? parsed.data.warehouses : fresh.warehouses,
      inventory: parsed.data.inventory?.length ? parsed.data.inventory : fresh.inventory,
      stockTransfers: parsed.data.stockTransfers?.length ? parsed.data.stockTransfers : fresh.stockTransfers,
      imports: parsed.data.imports?.length ? parsed.data.imports : fresh.imports,
      exports: parsed.data.exports?.length ? parsed.data.exports : fresh.exports,
      fxTransactions: parsed.data.fxTransactions?.length ? parsed.data.fxTransactions : fresh.fxTransactions,
    };
  } catch {
    return fresh;
  }
}

function nextReference(entries: JournalEntry[], type: TransactionType, dateIso: string): string {
  const year = dateIso.slice(0, 4);
  const prefix = `${TYPE_PREFIX[type]}-${year}-`;
  const used = entries
    .filter((e) => e.reference.startsWith(prefix))
    .map((e) => Number(e.reference.slice(prefix.length)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

function nextApprovalRef(data: DemoDataset): string {
  const used = data.approvals
    .map((a) => Number(a.reference.replace('APR-2026-', '')))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 140) + 1;
  return `APR-2026-${String(next).padStart(4, '0')}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DemoDataset>(() => loadInitial());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);
  const [isPersisted, setIsPersisted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DEMO_STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  });

  /* persist (isolated demo key only) */
  useEffect(() => {
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ version: 1, data }));
      setIsPersisted(true);
    } catch {
      setIsPersisted(false);
    }
  }, [data]);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = toastId.current++;
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 5200);
  }, []);

  const addActivity = useCallback((a: Omit<Activity, 'id'>) => {
    setData((prev) => ({
      ...prev,
      activities: [{ ...a, id: `ACT-${Date.now()}` }, ...prev.activities].slice(0, 40),
    }));
  }, []);

  const postEntry = useCallback<StoreValue['postEntry']>((input) => {
    const entry: JournalEntry = {
      id: `JE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      reference: '',
      date: input.date,
      type: input.type,
      description: input.description,
      lines: input.lines,
      createdAt: new Date().toISOString(),
      source: input.source,
      status: 'posted',
    };
    setData((prev) => {
      entry.reference = nextReference(prev.entries, input.type, input.date);
      return { ...prev, entries: [...prev.entries, entry] };
    });
    return entry;
  }, []);

  const createApproval = useCallback<StoreValue['createApproval']>((input) => {
    const approval: Approval = {
      id: `APR-${Date.now()}`,
      reference: '',
      createdAt: new Date().toISOString(),
      origin: input.origin,
      title: input.title,
      subtitle: input.subtitle,
      command: input.command,
      status: input.status ?? 'pending',
      draft: input.draft,
      confidence: input.confidence,
      uncertainties: input.uncertainties ?? [],
      documentId: input.documentId,
      simulated: true,
    };
    setData((prev) => {
      approval.reference = nextApprovalRef(prev);
      return { ...prev, approvals: [approval, ...prev.approvals] };
    });
    return approval;
  }, []);

  const updateApprovalDraft = useCallback<StoreValue['updateApprovalDraft']>((id, draft) => {
    setData((prev) => ({
      ...prev,
      approvals: prev.approvals.map((a) => (a.id === id ? { ...a, draft } : a)),
    }));
  }, []);

  const setApprovalStatus = useCallback<StoreValue['setApprovalStatus']>((id, status, note) => {
    setData((prev) => ({
      ...prev,
      approvals: prev.approvals.map((a) =>
        a.id === id ? { ...a, status, rejectionReason: status === 'rejected' ? note : a.rejectionReason } : a,
      ),
    }));
  }, []);

  const approve = useCallback<StoreValue['approve']>((id) => {
    let posted: JournalEntry | null = null;
    setData((prev) => {
      const approval = prev.approvals.find((a) => a.id === id);
      if (!approval || (approval.status !== 'pending' && approval.status !== 'draft')) return prev;
      const dr = approval.draft.lines.reduce((s, l) => s + l.debit, 0);
      const cr = approval.draft.lines.reduce((s, l) => s + l.credit, 0);
      if (Math.round(dr) !== Math.round(cr)) return prev; // safety: never post an unbalanced draft
      const entry: JournalEntry = {
        id: `JE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        reference: nextReference(prev.entries, approval.draft.type, approval.draft.date),
        date: approval.draft.date,
        type: approval.draft.type,
        description: approval.draft.description,
        lines: approval.draft.lines,
        createdAt: new Date().toISOString(),
        source: approval.origin === 'ai' ? 'ai' : approval.origin === 'document' ? 'document' : 'manual',
        status: 'posted',
      };
      posted = entry;
      return {
        ...prev,
        entries: [...prev.entries, entry],
        approvals: prev.approvals.map((a) =>
          a.id === id
            ? {
                ...a,
                status: 'completed',
                approvedAt: new Date().toISOString(),
                approvedBy: 'Demo User',
                postedEntryId: entry.id,
              }
            : a,
        ),
        documents: approval.documentId
          ? prev.documents.map((d) => (d.id === approval.documentId ? { ...d, status: 'posted' } : d))
          : prev.documents,
      };
    });
    return posted;
  }, []);

  const reject = useCallback<StoreValue['reject']>((id, reason) => {
    setData((prev) => ({
      ...prev,
      approvals: prev.approvals.map((a) =>
        a.id === id ? { ...a, status: 'rejected', rejectionReason: reason } : a,
      ),
    }));
  }, []);

  const addDocument = useCallback<StoreValue['addDocument']>((doc) => {
    setData((prev) => ({ ...prev, documents: [doc, ...prev.documents] }));
  }, []);

  const updateDocument = useCallback<StoreValue['updateDocument']>((id, patch) => {
    setData((prev) => ({
      ...prev,
      documents: prev.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }, []);

  const resetDemo = useCallback(() => {
    const fresh = buildDemoDataset();
    setData(fresh);
    try {
      localStorage.removeItem(DEMO_STORAGE_KEY);
    } catch {
      /* localStorage unavailable — in-memory reset still works */
    }
    setIsPersisted(false);
  }, []);

  const clearPersistence = useCallback(() => {
    try {
      localStorage.removeItem(DEMO_STORAGE_KEY);
      setIsPersisted(false);
    } catch {
      /* ignore */
    }
  }, []);

  /* ---------------- Trade & Currency Operations ---------------- */
  const addImport = useCallback<StoreValue['addImport']>((input) => {
    let created: ImportShipment;
    setData((prev) => {
      const num = prev.imports.length + 1;
      const reference = `IMP-2026-${String(num).padStart(3, '0')}`;
      created = {
        ...input,
        id: `IMP-${Date.now()}`,
        reference,
        simulated: true,
      };

      let updatedInventory = prev.inventory;
      if (input.status === 'received' && input.quantity > 0) {
        updatedInventory = prev.inventory.map((p) => {
          if (p.id !== input.productId) return p;
          const locs = { ...p.locations };
          const loc = locs[input.receivingLocationId] || { available: 0, reserved: 0 };
          locs[input.receivingLocationId] = {
            ...loc,
            available: loc.available + input.quantity,
          };
          return { ...p, locations: locs };
        });
      }

      return {
        ...prev,
        imports: [created, ...prev.imports],
        inventory: updatedInventory,
      };
    });
    return created!;
  }, []);

  const updateImportStatus = useCallback<StoreValue['updateImportStatus']>((id, status, receivedQty) => {
    setData((prev) => {
      const existing = prev.imports.find((i) => i.id === id);
      if (!existing) return prev;

      const qtyToAdd = receivedQty !== undefined ? receivedQty : (status === 'received' && existing.status !== 'received' ? existing.quantity : 0);

      let updatedInventory = prev.inventory;
      if (qtyToAdd > 0) {
        updatedInventory = prev.inventory.map((p) => {
          if (p.id !== existing.productId) return p;
          const locs = { ...p.locations };
          const loc = locs[existing.receivingLocationId] || { available: 0, reserved: 0 };
          locs[existing.receivingLocationId] = {
            ...loc,
            available: loc.available + qtyToAdd,
          };
          return { ...p, locations: locs };
        });
      }

      return {
        ...prev,
        inventory: updatedInventory,
        imports: prev.imports.map((i) =>
          i.id === id
            ? {
                ...i,
                status,
                receivedQuantity: status === 'received' ? i.quantity : (receivedQty ?? i.receivedQuantity),
              }
            : i
        ),
      };
    });
  }, []);

  const addExport = useCallback<StoreValue['addExport']>((input) => {
    let created: ExportShipment;
    setData((prev) => {
      const num = prev.exports.length + 1;
      const reference = `EXP-2026-${String(num).padStart(3, '0')}`;
      created = {
        ...input,
        id: `EXP-${Date.now()}`,
        reference,
        simulated: true,
      };

      let updatedInventory = prev.inventory;
      if (input.status === 'confirmed' || input.status === 'ready_for_dispatch') {
        updatedInventory = prev.inventory.map((p) => {
          if (p.id !== input.productId) return p;
          const locs = { ...p.locations };
          const loc = locs[input.dispatchLocationId] || { available: 0, reserved: 0 };
          locs[input.dispatchLocationId] = {
            available: Math.max(0, loc.available - input.quantity),
            reserved: loc.reserved + input.quantity,
          };
          return { ...p, locations: locs };
        });
      } else if (input.status === 'dispatched' || input.status === 'delivered') {
        updatedInventory = prev.inventory.map((p) => {
          if (p.id !== input.productId) return p;
          const locs = { ...p.locations };
          const loc = locs[input.dispatchLocationId] || { available: 0, reserved: 0 };
          locs[input.dispatchLocationId] = {
            ...loc,
            available: Math.max(0, loc.available - input.quantity),
          };
          return { ...p, locations: locs };
        });
      }

      return {
        ...prev,
        exports: [created, ...prev.exports],
        inventory: updatedInventory,
      };
    });
    return created!;
  }, []);

  const updateExportStatus = useCallback<StoreValue['updateExportStatus']>((id, status) => {
    setData((prev) => {
      const existing = prev.exports.find((e) => e.id === id);
      if (!existing || existing.status === status) return prev;

      let updatedInventory = prev.inventory;
      const pId = existing.productId;
      const wId = existing.dispatchLocationId;
      const qty = existing.quantity;

      updatedInventory = prev.inventory.map((p) => {
        if (p.id !== pId) return p;
        const locs = { ...p.locations };
        const loc = locs[wId] || { available: 0, reserved: 0 };

        if (existing.status === 'draft' && (status === 'confirmed' || status === 'ready_for_dispatch')) {
          locs[wId] = {
            available: Math.max(0, loc.available - qty),
            reserved: loc.reserved + qty,
          };
        } else if ((existing.status === 'confirmed' || existing.status === 'ready_for_dispatch') && (status === 'dispatched' || status === 'delivered')) {
          locs[wId] = {
            ...loc,
            reserved: Math.max(0, loc.reserved - qty),
          };
        } else if (existing.status === 'draft' && (status === 'dispatched' || status === 'delivered')) {
          locs[wId] = {
            ...loc,
            available: Math.max(0, loc.available - qty),
          };
        } else if ((existing.status === 'confirmed' || existing.status === 'ready_for_dispatch') && status === 'cancelled') {
          locs[wId] = {
            available: loc.available + qty,
            reserved: Math.max(0, loc.reserved - qty),
          };
        }

        return { ...p, locations: locs };
      });

      return {
        ...prev,
        inventory: updatedInventory,
        exports: prev.exports.map((e) => (e.id === id ? { ...e, status } : e)),
      };
    });
  }, []);

  const addStockTransfer = useCallback<StoreValue['addStockTransfer']>((input) => {
    let created: StockTransfer;
    setData((prev) => {
      const num = prev.stockTransfers.length + 1;
      const reference = `TRF-WH-${String(num).padStart(3, '0')}`;
      created = {
        ...input,
        id: `ST-${Date.now()}`,
        reference,
        initiatedAt: new Date().toISOString(),
        simulated: true,
      };

      let updatedInventory = prev.inventory;
      if (input.status === 'in_transit') {
        updatedInventory = prev.inventory.map((p) => {
          if (p.id !== input.productId) return p;
          const locs = { ...p.locations };
          const src = locs[input.sourceLocationId] || { available: 0, reserved: 0 };
          locs[input.sourceLocationId] = {
            available: Math.max(0, src.available - input.quantity),
            reserved: src.reserved + input.quantity,
          };
          return { ...p, locations: locs };
        });
      }

      return {
        ...prev,
        stockTransfers: [created, ...prev.stockTransfers],
        inventory: updatedInventory,
      };
    });
    return created!;
  }, []);

  const receiveStockTransfer = useCallback<StoreValue['receiveStockTransfer']>((id) => {
    setData((prev) => {
      const transfer = prev.stockTransfers.find((t) => t.id === id);
      if (!transfer || transfer.status !== 'in_transit') return prev;

      const pId = transfer.productId;
      const srcId = transfer.sourceLocationId;
      const dstId = transfer.destinationLocationId;
      const qty = transfer.quantity;

      const updatedInventory = prev.inventory.map((p) => {
        if (p.id !== pId) return p;
        const locs = { ...p.locations };
        const src = locs[srcId] || { available: 0, reserved: 0 };
        const dst = locs[dstId] || { available: 0, reserved: 0 };

        locs[srcId] = {
          ...src,
          reserved: Math.max(0, src.reserved - qty),
        };
        locs[dstId] = {
          ...dst,
          available: dst.available + qty,
        };
        return { ...p, locations: locs };
      });

      return {
        ...prev,
        inventory: updatedInventory,
        stockTransfers: prev.stockTransfers.map((t) =>
          t.id === id ? { ...t, status: 'received', receivedAt: new Date().toISOString() } : t
        ),
      };
    });
  }, []);

  const addFxTransaction = useCallback<StoreValue['addFxTransaction']>((input) => {
    let created: FxTransaction;
    setData((prev) => {
      const num = prev.fxTransactions.length + 1;
      const reference = `FX-${input.type.toUpperCase()}-${input.currency}-${String(num).padStart(2, '0')}`;

      let costBasisPKR = input.costBasisPKR;
      let realizedGainLossPKR = input.realizedGainLossPKR;
      if (input.type === 'sale') {
        const balances = computeFxBalances(prev.fxTransactions);
        const curSummary = balances[input.currency];
        const avgRate = curSummary?.weightedAvgCostRate || input.exchangeRate;
        costBasisPKR = input.foreignAmount * avgRate;
        realizedGainLossPKR = input.totalPKR - costBasisPKR;
      }

      created = {
        ...input,
        id: `FX-${Date.now()}`,
        reference,
        costBasisPKR,
        realizedGainLossPKR,
        simulated: true,
      };

      return {
        ...prev,
        fxTransactions: [created, ...prev.fxTransactions],
      };
    });
    return created!;
  }, []);

  const updateInventoryStock = useCallback<StoreValue['updateInventoryStock']>((productId, warehouseId, available, reserved = 0) => {
    setData((prev) => ({
      ...prev,
      inventory: prev.inventory.map((p) => {
        if (p.id !== productId) return p;
        const locs = { ...p.locations };
        locs[warehouseId] = { available, reserved };
        return { ...p, locations: locs };
      }),
    }));
  }, []);

  const pendingCount = useMemo(
    () => data.approvals.filter((a) => a.status === 'pending' || a.status === 'draft').length,
    [data.approvals],
  );

  const value = useMemo<StoreValue>(
    () => ({
      data,
      toasts,
      pushToast,
      dismissToast,
      postEntry,
      createApproval,
      updateApprovalDraft,
      setApprovalStatus,
      approve,
      reject,
      addDocument,
      updateDocument,
      addActivity,
      resetDemo,
      pendingCount,
      isPersisted,
      clearPersistence,
      addImport,
      updateImportStatus,
      addExport,
      updateExportStatus,
      addStockTransfer,
      receiveStockTransfer,
      addFxTransaction,
      updateInventoryStock,
    }),
    [
      data, toasts, pushToast, dismissToast, postEntry, createApproval, updateApprovalDraft,
      setApprovalStatus, approve, reject, addDocument, updateDocument, addActivity, resetDemo,
      pendingCount, isPersisted, clearPersistence, addImport, updateImportStatus, addExport,
      updateExportStatus, addStockTransfer, receiveStockTransfer, addFxTransaction, updateInventoryStock,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

/* ------------------------------------------------------------------ */
/* date range context                                                  */
/* ------------------------------------------------------------------ */

import { buildRange } from './accounting';
import type { DateRange, RangePreset } from './accounting';

interface RangeValue {
  range: DateRange;
  setPreset: (preset: Exclude<RangePreset, 'custom'>) => void;
  setCustom: (start: string, end: string) => void;
}

const RangeContext = createContext<RangeValue | null>(null);

export function RangeProvider({ children }: { children: ReactNode }) {
  const { data } = useStore();
  const [range, setRange] = useState<DateRange>(() => buildRange('year', data.demoToday));
  const setPreset = useCallback(
    (preset: Exclude<RangePreset, 'custom'>) => setRange(buildRange(preset, data.demoToday)),
    [data.demoToday],
  );
  const setCustom = useCallback(
    (start: string, end: string) => {
      if (!start || !end) return;
      const [s, e] = start <= end ? [start, end] : [end, start];
      setRange({ preset: 'custom', start: s, end: e, label: 'Custom Range' });
    },
    [],
  );
  const value = useMemo(() => ({ range, setPreset, setCustom }), [range, setPreset, setCustom]);
  return <RangeContext.Provider value={value}>{children}</RangeContext.Provider>;
}

export function useRange(): RangeValue {
  const ctx = useContext(RangeContext);
  if (!ctx) throw new Error('useRange must be used inside <RangeProvider>');
  return ctx;
}
