import { useEffect } from "react";
import { baseRate, SPEEDS, useLab } from "@/store/lab";

const MAX_FRAME_SECONDS = 0.1;

export function usePlaybackDriver() {
  const playing = useLab((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      const s = useLab.getState();
      if (!s.playing) return;
      const dt = Math.min(MAX_FRAME_SECONDS, (now - last) / 1000);
      last = now;
      acc += dt * baseRate(s) * SPEEDS[s.speed];
      const units = Math.floor(acc);
      if (units > 0) {
        acc -= units;
        if (!s.advance(units)) return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}
