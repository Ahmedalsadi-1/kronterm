# KronTerm Website

The public product website for KronTerm and the KronosCode agent engine.

## Preview locally

From the repository root:

```bash
node website/build.mjs
python3 -m http.server 8080 --directory website/dist
```

Then open `http://localhost:8080`.

## Validate

```bash
node website/build.mjs
node website/check.mjs
```

The build assembles the marketing site with product media already stored in
the main KronTerm repository. The GitHub Pages workflow runs the same build and
validation before publishing `website/dist`.
