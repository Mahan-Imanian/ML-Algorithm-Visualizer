import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
  action?: { label: string; onClick: () => void };
}

interface ToastStore {
  items: Toast[];
  push(t: Omit<Toast, "id">): void;
  dismiss(id: number): void;
}

let next = 1;

export const useToasts = create<ToastStore>((set, get) => ({
  items: [],
  push(t) {
    const id = next++;
    set({ items: [...get().items.slice(-2), { ...t, id }] });
    window.setTimeout(() => get().dismiss(id), t.action ? 6000 : 3200);
  },
  dismiss(id) {
    set({ items: get().items.filter((x) => x.id !== id) });
  },
}));

type Opts = { action?: Toast["action"] };

export const toast = Object.assign(
  (message: string, o: Opts = {}) => useToasts.getState().push({ message, tone: "info", ...o }),
  {
    success: (message: string, o: Opts = {}) =>
      useToasts.getState().push({ message, tone: "success", ...o }),
    error: (message: string, o: Opts = {}) =>
      useToasts.getState().push({ message, tone: "error", ...o }),
  },
);
