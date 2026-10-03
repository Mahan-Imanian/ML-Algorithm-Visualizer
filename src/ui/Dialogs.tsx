import { useEffect, useRef, useState } from "react";
import { toast } from "./toastStore";
import { variantLabel } from "@/core/experiment";
import { familyName } from "@/core/info";
import { decode, encode, fromFile } from "@/core/share";
import { appBaseUrl, isMac } from "@/lib/utils";
import { navigate } from "@/lib/router";
import { useLab } from "@/store/lab";
import { useLibrary } from "@/store/library";
import { useSettings, type MotionPref, type ThemePref } from "@/store/settings";
import { useUI } from "@/store/ui";
import { exportExperiment, labelForCurrent, startTour } from "./commands";
import { Check, Link } from "./icons";
import { Button, Dialog, Field, Kbd, Segmented, Toggle } from "./primitives";

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function ShareDialog() {
  const open = useUI((s) => s.dialog === "share");
  const close = useUI((s) => s.close);
  const exp = useLab((s) => s.exp);
  const cursor = useLab((s) => s.cursorA);
  const [atStep, setAtStep] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = `${appBaseUrl()}#/lab?e=${encode(exp, atStep ? cursor : 0)}`;
  useEffect(() => setCopied(false), [url, open]);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const seed = "seed" in exp.input ? exp.input.seed : 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title="Share this experiment"
      description="Anyone with the link sees exactly this setup. Nothing is uploaded; everything is in the link."
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            aria-label="Experiment link"
            className="readout h-9 min-w-0 flex-1 rounded border border-rule-strong bg-sunken px-2.5 text-xs"
          />
          <Button
            variant="primary"
            className="h-9"
            onClick={async () => {
              const ok = await copy(url);
              setCopied(ok);
              if (ok) toast.success("Link copied");
              else toast.error("Copy failed. Select the link and copy it manually.");
            }}
          >
            {copied ? <Check /> : <Link />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <Toggle
          label={`Open at step ${cursor}`}
          hint="Otherwise the link opens at the beginning of the run."
          checked={atStep}
          onChange={setAtStep}
        />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-rule pt-3 text-sm">
          <dt className="text-ink-3">Family</dt>
          <dd>{familyName(exp.family)}</dd>
          <dt className="text-ink-3">Run A</dt>
          <dd>{variantLabel(exp.a)}</dd>
          {exp.b && (
            <>
              <dt className="text-ink-3">Run B</dt>
              <dd>{variantLabel(exp.b)}</dd>
            </>
          )}
          <dt className="text-ink-3">Input</dt>
          <dd>
            {exp.family === "grid"
              ? `${exp.input.w}×${exp.input.h} ${exp.input.terrain === "custom" ? "hand-edited" : exp.input.terrain} grid`
              : exp.family === "sort"
                ? `${exp.input.values.length} values, ${exp.input.preset}`
                : exp.family === "search"
                  ? `${exp.input.values.length} values, target ${exp.input.target}`
                  : exp.family === "graph"
                    ? `${exp.input.nodes.length} nodes, ${exp.input.edges.length} edges`
                    : `${exp.input.dataset}, ${exp.input.n} points`}{" "}
            · seed {seed}
          </dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          {canShare && (
            <Button
              onClick={() => {
                navigator
                  .share({ title: "Algoscope experiment", text: labelForCurrent(), url })
                  .catch(() => undefined);
              }}
            >
              Share…
            </Button>
          )}
          <Button variant="ghost" onClick={exportExperiment}>
            Download as file
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function SaveDialog() {
  const open = useUI((s) => s.dialog === "save");
  const close = useUI((s) => s.close);
  const exp = useLab((s) => s.exp);
  const save = useLibrary((s) => s.save);
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName(labelForCurrent());
  }, [open]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const label = labelForCurrent();
    save({ name: name.trim() || label, code: encode(exp), family: exp.family, label });
    close();
    toast.success("Saved to your library", {
      action: { label: "View", onClick: () => navigate("/saved") },
    });
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title="Save experiment"
      description="Saved in this browser. Use Share to move it somewhere else."
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="save-name">
          <input
            id="save-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="h-9 rounded border border-rule-strong bg-surface px-2.5 text-sm"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ImportDialog() {
  const open = useUI((s) => s.dialog === "import");
  const close = useUI((s) => s.close);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setError(null);
      setLink("");
    }
  }, [open]);
  const loadCode = (code: string, cursor = 0) => {
    close();
    navigate(`/lab?e=${code}`);
    if (cursor) setTimeout(() => useLab.getState().seek(cursor), 50);
    toast.success("Experiment loaded");
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000)
      return setError("That file is too large to be an Algoscope experiment.");
    const r = fromFile(await f.text());
    if (!r.ok) return setError(r.error);
    loadCode(encode(r.exp), r.cursor);
  };
  const onLink = (e: React.FormEvent) => {
    e.preventDefault();
    const m = link.match(/[?&]e=([A-Za-z0-9_-]+)/);
    const code = m ? m[1] : link.trim();
    const r = decode(code);
    if (!r.ok) return setError(r.error);
    loadCode(encode(r.exp), r.cursor);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title="Import an experiment"
      description="Open a file exported from Algoscope, or paste a shared link."
    >
      <div className="space-y-5">
        <div>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            id="import-file"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button variant="outline" className="w-full" onClick={() => file.current?.click()}>
            Choose a .json file
          </Button>
        </div>
        <form onSubmit={onLink} className="space-y-2">
          <Field label="Or paste a link" htmlFor="import-link">
            <input
              id="import-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…#/lab?e=…"
              className="readout h-9 rounded border border-rule-strong bg-surface px-2.5 text-xs"
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={!link.trim()}>
              Open link
            </Button>
          </div>
        </form>
        {error && (
          <p role="alert" className="border-l-2 border-signal pl-3 text-sm text-signal-ink">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

const MOD = isMac ? "⌘" : "Ctrl";

const SHORTCUTS: [string, string[]][] = [
  ["Play / pause", ["Space"]],
  ["Step forward / back", ["→", "←"]],
  ["Single operation forward / back", ["⇧ →", "⇧ ←"]],
  ["Jump to start / end", ["Home", "End"]],
  ["Previous / next checkpoint", ["[", "]"]],
  ["Replay from the start", ["R"]],
  ["Slower / faster", ["−", "="]],
  ["Toggle step size (step / op)", ["G"]],
  ["New random input", ["N"]],
  ["Generate a maze", ["M"]],
  ["Compare with a suggested partner", ["C"]],
  ["Grid tools: wall, mud, erase, start, target", ["1", "2", "3", "4", "5"]],
  ["Command palette", [`${MOD} K`, "/"]],
  ["Save experiment", [`${MOD} S`]],
  ["This list", ["?"]],
];

export function ShortcutsDialog() {
  const open = useUI((s) => s.dialog === "shortcuts");
  const close = useUI((s) => s.close);
  const singleKey = useSettings((s) => s.singleKey);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()} title="Keyboard shortcuts" wide>
      <table className="w-full text-sm">
        <tbody>
          {SHORTCUTS.map(([label, keys]) => (
            <tr key={label} className="border-t border-rule first:border-t-0">
              <td className="py-1.5 pr-4">{label}</td>
              <td className="py-1.5 text-right">
                <span className="inline-flex flex-wrap justify-end gap-1">
                  {keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 border-t border-rule pt-3 text-sm text-ink-2">
        <p className="mb-2 font-medium text-ink">On the grid</p>
        <p>
          Tab to the grid, then use the arrow keys to move a cursor. Space applies the current tool,
          S places the start, T places the target.
        </p>
        {!singleKey && (
          <p className="mt-2 text-signal-ink">Single-key shortcuts are turned off in Settings.</p>
        )}
      </div>
    </Dialog>
  );
}

export function SettingsDialog() {
  const open = useUI((s) => s.dialog === "settings");
  const close = useUI((s) => s.close);
  const st = useSettings();
  const clear = useLibrary((s) => s.clear);
  const count = useLibrary((s) => s.items.length);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setConfirm(false), [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()} title="Settings">
      <div className="space-y-5">
        <Field label="Theme">
          <Segmented<ThemePref>
            label="Theme"
            value={st.theme}
            onChange={(theme) => st.set({ theme })}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Paper" },
              { value: "dark", label: "Scope" },
            ]}
            className="w-full"
          />
        </Field>
        <Field
          label="Motion"
          hint="Reduced motion removes cell flashes, path drawing and bar travel. System follows your device setting."
        >
          <Segmented<MotionPref>
            label="Motion"
            value={st.motion}
            onChange={(motion) => st.set({ motion })}
            options={[
              { value: "system", label: "System" },
              { value: "reduce", label: "Reduced" },
              { value: "full", label: "Full" },
            ]}
            className="w-full"
          />
        </Field>
        <Toggle
          label="Single-key shortcuts"
          hint="Letters and numbers like N, M, R and 1–5. Turn off if they clash with your assistive technology."
          checked={st.singleKey}
          onChange={(singleKey) => st.set({ singleKey })}
        />
        <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
          <Button
            variant="outline"
            onClick={() => {
              close();
              st.set({ tourDone: false });
              startTour();
            }}
          >
            Replay the tour
          </Button>
          <Button
            variant="ghost"
            disabled={!count}
            onClick={() => {
              if (!confirm) return setConfirm(true);
              clear();
              setConfirm(false);
              toast("Saved experiments cleared");
            }}
            className={confirm ? "text-signal-ink" : undefined}
          >
            {confirm ? `Really delete ${count}?` : "Clear saved experiments"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
