import { useEffect, useRef, useState } from "react";
import { defaultExperiment, variantLabel } from "@/core/experiment";
import { isAlgoId } from "@/core/info";
import { getScenario } from "@/core/scenarios";
import { decode, encode } from "@/core/share";
import { isCompactWidth } from "@/lib/layout";
import { replaceHash } from "@/lib/router";
import { useLab } from "@/store/lab";
import { useLibrary } from "@/store/library";

const URL_WRITE_DELAY_MS = 350;

export function useLabRoute(query: URLSearchParams) {
  const [error, setError] = useState<string | null>(null);
  const key = query.toString();
  const lastWritten = useRef<string>("");
  useEffect(() => {
    const q = new URLSearchParams(key);
    const compact = isCompactWidth(window.innerWidth);
    const e = q.get("e");
    const s = q.get("s");
    const algo = q.get("algo");
    if (e) {
      if (e === lastWritten.current) return;
      const r = decode(e);
      if (r.ok) {
        useLab.getState().load(r.exp, r.cursor);
        setError(null);
      } else {
        setError(r.error);
        useLab.getState().load(defaultExperiment("bfs", { compact }));
      }
      return;
    }
    setError(null);
    if (s && getScenario(s)) useLab.getState().load(getScenario(s)!.build(compact));
    else if (algo && isAlgoId(algo)) useLab.getState().load(defaultExperiment(algo, { compact }));
    else if (!useLab.getState().revision)
      useLab.getState().load(defaultExperiment("bfs", { compact }));
  }, [key]);

  useEffect(() => {
    let t = 0;
    const unsub = useLab.subscribe((st, prev) => {
      if (st.exp === prev.exp || st.editing) return;
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const code = encode(st.exp);
        lastWritten.current = code;
        replaceHash(`/lab?e=${code}`);
        useLibrary
          .getState()
          .remember(
            code,
            `${variantLabel(st.exp.a)}${st.exp.b ? ` vs ${variantLabel(st.exp.b)}` : ""}`,
          );
      }, URL_WRITE_DELAY_MS);
    });
    return () => {
      unsub();
      window.clearTimeout(t);
    };
  }, []);

  return [error, () => setError(null)] as const;
}
