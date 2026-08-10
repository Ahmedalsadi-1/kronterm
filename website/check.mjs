import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = path.dirname(fileURLToPath(import.meta.url));
const requestedDirectory = process.argv[2] ?? "dist";
const root = path.resolve(websiteRoot, requestedDirectory);
const requiredFiles = [
  "index.html",
  "styles.css",
  "script.js",
  "CNAME",
  ".nojekyll",
  "robots.txt",
  "sitemap.xml",
];

for (const file of requiredFiles) {
  await access(path.join(root, file));
}

const html = await readFile(path.join(root, "index.html"), "utf8");
const localReferences = [
  ...html.matchAll(
    /(?:src|href)=["'](?!https?:|mailto:|#)([^"'?]+)(?:\?[^"']*)?["']/g,
  ),
].map((match) => match[1]);

for (const reference of new Set(localReferences)) {
  await access(path.join(root, reference));
}

const requiredAnchors = ["product", "kronoscode", "security", "faq"];
for (const anchor of requiredAnchors) {
  if (!html.includes(`id="${anchor}"`)) {
    throw new Error(`Missing section anchor: ${anchor}`);
  }
}

if (html.includes('href="#"')) {
  throw new Error("Placeholder links are not allowed.");
}

if (!html.includes("<title>") || !html.includes('name="description"')) {
  throw new Error("Required SEO metadata is missing.");
}

console.log(
  `Website validation passed in ${path.relative(websiteRoot, root)}: ${requiredFiles.length} core files and ${new Set(localReferences).size} local references checked.`,
);
