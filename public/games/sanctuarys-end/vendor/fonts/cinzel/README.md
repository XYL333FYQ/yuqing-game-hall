# Vendored Cinzel font

Self-hosted copy of the Cinzel display font (SIL Open Font License 1.1 — see
`OFL.txt` here), so the game loads fully offline/same-origin with **zero**
remote runtime dependencies:

- `cinzel-latin.woff2`, `cinzel-latin-ext.woff2` — the variable-weight woff2
  files Google Fonts serves for `css2?family=Cinzel:wght@500;600;700` (Cinzel
  is a variable font, so one file per unicode subset covers all three weights).
- `cinzel.css` — the matching `@font-face` rules with relative URLs, linked
  from `sanctuary.html` in place of the old `fonts.googleapis.com` tags.

`tests/html.test.js` asserts no remote `<link>` sneaks back into the page and
that these files exist on disk, so a regression fails CI instead of flashing
fallback-Georgia in the browser.

To upgrade: fetch `https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&display=swap`
with a modern browser User-Agent, download the woff2 URLs it references, and
mirror the `@font-face` blocks into `cinzel.css` with relative `src` URLs.
