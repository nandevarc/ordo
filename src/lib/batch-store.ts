import { create } from "zustand";

export type RecipientRow = {
  id: string;
  address: string;
  amount: string;
  note: string;
};

export type ExecutionResult = {
  index: number;
  status: "pending" | "success" | "failed";
  error?: string;
};

type BatchState = {
  batchName: string;
  rows: RecipientRow[];
  txHash: string | null;
  results: ExecutionResult[];
  setBatchName: (name: string) => void;
  setRows: (rows: RecipientRow[]) => void;
  addRow: () => void;
  updateRow: (id: string, patch: Partial<RecipientRow>) => void;
  removeRow: (id: string) => void;
  setTxHash: (h: string | null) => void;
  setResults: (r: ExecutionResult[]) => void;
  reset: () => void;
};

function emptyRow(): RecipientRow {
  return {
    id: crypto.randomUUID(),
    address: "",
    amount: "",
    note: "",
  };
}

export const useBatchStore = create<BatchState>((set) => ({
  batchName: "",
  rows: [],
  txHash: null,
  results: [],
  setBatchName: (batchName) => set({ batchName }),
  setRows: (rows) => set({ rows }),
  addRow: () => set((s) => ({ rows: [...s.rows, emptyRow()] })),
  updateRow: (id, patch) =>
    set((s) => ({
      rows: s.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),
  removeRow: (id) =>
    set((s) => ({ rows: s.rows.filter((r) => r.id !== id) })),
  setTxHash: (txHash) => set({ txHash }),
  setResults: (results) => set({ results }),
  reset: () =>
    set({ batchName: "", rows: [], txHash: null, results: [] }),
}));
