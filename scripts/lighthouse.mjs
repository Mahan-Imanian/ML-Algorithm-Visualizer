import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:4173/ML-Algorithm-Visualizer/";
const VERSION = "12.8.2";
const cli = process.env.LIGHTHOUSE_CLI
  ? ["node", [process.env.LIGHTHOUSE_CLI]]
  : ["npx", ["--yes", `lighthouse@${VERSION}`]];
const pages = { explore: "#/", lab: "#/lab?algo=bfs" };
const out = mkdtempSync(path.join(os.tmpdir(), "algoscope-lh-"));

for (const [page, hash] of Object.entries(pages)) {
  for (const formFactor of ["mobile", "desktop"]) {
    const file = path.join(out, `${page}-${formFactor}.json`);
    const args = [
      ...cli[1],
      BASE + hash,
      ...(formFactor === "desktop" ? ["--preset=desktop"] : []),
      "--only-categories=accessibility,performance,best-practices",
      "--chrome-flags=--headless=new",
      "--output=json",
      `--output-path=${file}`,
      "--quiet",
    ];
    const shell = cli[0] === "npx" && process.platform === "win32";
    const run = spawnSync(cli[0], args, { stdio: "inherit", shell });
    if (run.status !== 0) process.exit(run.status ?? 1);
    const r = JSON.parse(readFileSync(file, "utf8"));
    const scores = Object.values(r.categories)
      .map((c) => `${c.id} ${Math.round(c.score * 100)}`)
      .join(" · ");
    const cls = r.audits["cumulative-layout-shift"].displayValue;
    console.log(
      `${page} ${formFactor}: ${scores} · CLS ${cls} · Lighthouse ${r.lighthouseVersion}`,
    );
  }
}
rmSync(out, { recursive: true, force: true });
