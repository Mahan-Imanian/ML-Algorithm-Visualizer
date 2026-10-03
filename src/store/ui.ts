import { create } from "zustand";

export type DialogId = "palette" | "share" | "save" | "shortcuts" | "settings" | "import" | null;

interface UIStore {
  dialog: DialogId;
  setupOpen: boolean;
  tour: number | null;
  open(d: DialogId): void;
  close(): void;
  setSetupOpen(o: boolean): void;
  setTour(step: number | null): void;
}

export const useUI = create<UIStore>((set) => ({
  dialog: null,
  setupOpen: false,
  tour: null,
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
  setSetupOpen: (setupOpen) => set({ setupOpen }),
  setTour: (tour) => set({ tour }),
}));
