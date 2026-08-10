import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(websiteRoot);
const outputRoot = path.join(websiteRoot, "dist");

const staticFiles = [
  "index.html",
  "styles.css",
  "script.js",
  "CNAME",
  ".nojekyll",
  "robots.txt",
  "sitemap.xml",
];

const productAssets = [
  ["assets/kronterm-sandbox-screenshot.png", "assets/workspace.png"],
  ["assets/kronterm-sidepanel.png", "assets/kronoscode-workspace.png"],
  ["output/kronterm-chamber-chat.png", "assets/kronoscode-chat.jpg"],
  ["docs/static/img/drag-move-24fps-crf43.mp4", "assets/drag-blocks.mp4"],
  ["docs/static/img/resize-24fps-crf43.mp4", "assets/resize-blocks.mp4"],
  ["frontend/app/asset/logo.svg", "assets/kronterm-logo.svg"],
];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(path.join(outputRoot, "assets", "idle"), { recursive: true });

for (const file of staticFiles) {
  await cp(path.join(websiteRoot, file), path.join(outputRoot, file));
}

for (const [source, destination] of productAssets) {
  await cp(
    path.join(repositoryRoot, source),
    path.join(outputRoot, destination),
  );
}

const idleFrames = (await readdir(path.join(repositoryRoot, "assets", "idle")))
  .filter((file) => /^idle-\d+\.png$/.test(file))
  .sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true }),
  );

for (const frame of idleFrames) {
  await cp(
    path.join(repositoryRoot, "assets", "idle", frame),
    path.join(outputRoot, "assets", "idle", frame),
  );
}

console.log(
  `Built website/dist with ${staticFiles.length} static files, ${productAssets.length} product assets, and ${idleFrames.length} mascot frames.`,
);
