import { create } from "zustand";
import { FAMILIES } from "@/core/info";
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

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function isSaved(v: unknown): v is SavedExperiment {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.code === "string" &&
    typeof v.label === "string" &&
    Number.isFinite(v.savedAt) &&
    FAMILIES.some((f) => f.id === v.family)
  );
}

function readItems(): SavedExperiment[] {
  const raw = readJson<unknown>(KEY, []);
  return Array.isArray(raw) ? raw.filter(isSaved) : [];
}

function readLast(): LibraryStore["last"] {
  const raw = readJson<unknown>(LAST, null);
  return isRecord(raw) &&
    typeof raw.code === "string" &&
    typeof raw.label === "string" &&
    Number.isFinite(raw.at)
    ? (raw as LibraryStore["last"])
    : null;
}

export const useLibrary = create<LibraryStore>((set, get) => {
  const persist = () => writeJson(KEY, get().items);
  return {
    items: readItems(),
    last: readLast(),
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
