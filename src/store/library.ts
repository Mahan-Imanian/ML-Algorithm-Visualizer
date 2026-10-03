import { create } from "zustand";
import type { Family } from "@/core/types";
import { readJson, writeJson } from "@/lib/storage";

export interface SavedExperiment {
  id: string;
  name: string;
  savedAt: number;
  code: string;
  family: Family;
  label: string;
}

interface LibraryStore {
  items: SavedExperiment[];
  last: { code: string; label: string; at: number } | null;
  save(item: Omit<SavedExperiment, "id" | "savedAt">): SavedExperiment;
  rename(id: string, name: string): void;
  remove(id: string): SavedExperiment | undefined;
  restore(item: SavedExperiment): void;
  remember(code: string, label: string): void;
  clear(): void;
}

const KEY = "algoscope.library.v1";
const LAST = "algoscope.last.v1";

export const useLibrary = create<LibraryStore>((set, get) => {
  const persist = () => writeJson(KEY, get().items);
  return {
    items: readJson<SavedExperiment[]>(KEY, []).filter((x) => x && typeof x.code === "string"),
    last: readJson<LibraryStore["last"]>(LAST, null),
    save(item) {
      const saved: SavedExperiment = {
        ...item,
        id: `x${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
        savedAt: Date.now(),
      };
      set({ items: [saved, ...get().items] });
      persist();
      return saved;
    },
    rename(id, name) {
      set({ items: get().items.map((x) => (x.id === id ? { ...x, name } : x)) });
      persist();
    },
    remove(id) {
      const found = get().items.find((x) => x.id === id);
      set({ items: get().items.filter((x) => x.id !== id) });
      persist();
      return found;
    },
    restore(item) {
      set({
        items: [item, ...get().items.filter((x) => x.id !== item.id)].sort(
          (a, b) => b.savedAt - a.savedAt,
        ),
      });
      persist();
    },
    remember(code, label) {
      const last = { code, label, at: Date.now() };
      set({ last });
      writeJson(LAST, last);
    },
    clear() {
      set({ items: [] });
      persist();
    },
  };
});
