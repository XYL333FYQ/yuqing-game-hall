# Vendored three.js 0.184.0

Self-hosted copy of the exact files the game imports (MIT — see `LICENSE` here),
so the game loads fully offline/same-origin with no CDN dependency:

- `build/three.webgpu.js`, `build/three.tsl.js` (+ `build/three.core.js`, their shared core)
- the 7 addons the `sanctuary.html` shim imports (Bloom/GTAO/SMAA TSL nodes,
  GLTFLoader, HDRLoader, KTX2Loader, SkeletonUtils) **plus their transitive
  relative imports** (ktx-parse, zstddec, ColorSpaces, BufferGeometryUtils,
  WorkerPool).

`tests/html.test.js` walks the real import graph from the shim's entry points on
every CI run, so a missing file here fails loudly instead of 404ing in the browser.

To upgrade: `npm pack three@<version>`, re-run the closure copy from the new
tarball (fetch every `from './…'` reachable from the entries above), update the
import map paths in `sanctuary.html`, and rename this directory to match.
