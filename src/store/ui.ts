import { create } from "zustand";

export type DialogId = "palette" | "share" | "save" | "shortcuts" | "settings" | "import" | null;
export type PresentPanel = "code" | "state" | "explain" | "metrics";

interface UIStore {
  dialog: DialogId;
  setupOpen: boolean;
  tour: number | null;
  present: boolean;
  panels: Record<PresentPanel, boolean>;
  hud: boolean;
  open(d: DialogId): void;
  close(): void;
  setSetupOpen(o: boolean): void;
  setTour(step: number | null): void;
  setPresent(on: boolean): void;
  togglePanel(p: PresentPanel): void;
  setHud(on: boolean): void;
}

export const useUI = create<UIStore>((set, get) => ({
  dialog: null,
  setupOpen: false,
  tour: null,
  present: false,
  panels: { code: true, state: true, explain: true, metrics: true },
  hud: false,
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
  setSetupOpen: (setupOpen) => set({ setupOpen }),
  setTour: (tour) => set({ tour }),
  setPresent: (present) => set({ present }),
  togglePanel: (p) => set({ panels: { ...get().panels, [p]: !get().panels[p] } }),
  setHud: (hud) => set({ hud }),
}));
