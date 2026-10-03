import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = `${root}dist-extension/`;
if (!existsSync(`${dist}index.html`)) throw new Error("Run `vite build --mode extension` first.");

const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));
const manifest = JSON.parse(readFileSync(`${root}extension/manifest.json`, "utf8"));
manifest.version = pkg.version;
writeFileSync(`${dist}manifest.json`, JSON.stringify(manifest, null, 2));
copyFileSync(`${root}extension/background.js`, `${dist}background.js`);

const html = readFileSync(`${dist}index.html`, "utf8");
const inline = html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g);
if (inline) throw new Error("Inline scripts would violate the extension CSP.");
const remote = html.match(/(src|href)="https?:\/\/[^"]+\.(js|css)"/g);
if (remote) throw new Error(`Remote code is not allowed in an extension: ${remote.join(", ")}`);

let bytes = 0;
const walk = (d) =>
  readdirSync(d).forEach((f) =>
    statSync(d + f).isDirectory() ? walk(`${d}${f}/`) : (bytes += statSync(d + f).size),
  );
walk(dist);
console.log(
  `Extension ready in dist-extension/ (${(bytes / 1024).toFixed(0)} KB). Load it via chrome://extensions → Load unpacked.`,
);
