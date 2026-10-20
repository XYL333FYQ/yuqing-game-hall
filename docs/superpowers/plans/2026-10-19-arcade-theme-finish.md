# Arcade theme finish implementation plan

> **For agentic workers:** Use superpowers:executing-plans in this session. The user authorized the visual direction and requires every existing effect to remain.

**Goal:** Give dark, daylight and pink distinct materials and motion while preserving all existing effects.
**Architecture:** Add a focused atmosphere stylesheet after the existing theme palette; enrich the pre-bundle loading screen and existing portal layer without replacing either controller.
**Tech Stack:** Existing TypeScript, CSS, SVG, Web Animations, Vite and Playwright CLI. No new dependencies.
**Spec:** Current chat: dark arcade console, white gallery, soft collectible cards; only enhance existing effects.

## Global constraints
- Preserve both rotating entry rings, reticle, starfield, scan, logo, skip/fail-open, three particle planes (150 desktop / 84 mobile trails), two expanding waves, circular reveal, carousel and hover effects.
- Keep daylight neutral white; preserve dark and pink color identities.
- Keep game behavior, routes and data unchanged. Continue in the current working tree and preserve prior edits.
- No commit, push or deployment requested.

## Review focus
- Rapid theme changes: latest choice wins; temporary layers and animation state clear.
- Navigation during effect: route still opens and effects clean up.
- Unsupported View Transitions: update and existing particle fallback still finish.
- Reduced motion: added ornament is static; entry and theme choice remain usable.
- Mobile/narrow heights: no clipped buttons, horizontal overflow or obstructed content.

## Task 1: Distinct surfaces and responsive card finish
- [x] Add src/styles/atmosphere.css after themes.css and before motion.css.
- [x] Style precision dark panels, white gallery frames, and pink layered cards with distinct radii, textures, borders and focus/hover lighting.
- [x] Release completed card entry transforms so hover remains active; preserve entry animation.
- [x] Verify desktop and 390px screenshots plus actual preview/card hover and restore.

## Task 2: Loading and portal additions
- [x] Enrich index.html entry ornament and public/platform/portal.css with themed floating tiles, material frame and edition label; retain all existing animated nodes.
- [x] Pass target theme into the existing particle layer so extra theme details use the destination style even before palette update.
- [x] Add a restrained moving light detail to existing particle planes without changing trail or wave counts, reveal controller or timing.
- [x] Verify complete entry/transition lifecycle, skip, fail-open, rapid clicks, fallback and reduced motion using browser assertions.

## Task 3: Acceptance
- [x] npm run check:platform, npm test, git diff --check.
- [x] Visual review of three themes, three entries and motion recordings; scoped read-only final review.
- [x] Report tested behavior, artifact paths and remaining subjective acceptance boundary.

Ruling: Do not write snapshot-style unit tests for reversible CSS choices; use live browser behavior assertions and visual review. Existing functional tests remain required.

## Acceptance record
- Platform/type/encoding/boundary checks and all 124 tests passed; Vite frontend production bundle passed.
- Real browser: three distinct surface geometries, preview/card hover and restoration, and dark game-colored hover border verified.
- Preserved 150 desktop / 84 mobile trails, three particle planes, both expanding waves and both entry rings; additive glints verified.
- Rapid choice cancellation, navigation during an effect, missing View Transitions fallback, reduced motion, native skip and fail-open passed with zero page errors on normal application runs.
- Three themes at 390x844, 800x360 and 390x360 passed bounds/skip overlap checks after fixing footer spacing on short screens.
- Read-only final review found a dark hover-border specificity regression; repaired and confirmed via computed border changes in the browser.
- Local dev server cached the missing new stylesheet during its creation. A timestamp-only config reload restored the original :5173 CSS response to HTTP 200; no config content changed.
- Three page/entry screenshot sets and a 27-second real-browser recording are available under output/playwright; review.html presents the comparison.
- No commit, push, deployment or Gemini calls. Subjective visual approval remains with the user.
## Follow-up: theme-specific motion and complementary color
- User requested distinct loading compositions and particle behavior, plus mixed restrained palettes rather than monochrome themes.
- Added constellations / crossing glass prisms / unfolding botanical petals as three first-paint scenes; each has its own entry and satellite keyframes.
- Existing three particle planes now use straight accelerating trails / lateral prismatic flakes / curved drifting petals, with theme-specific signature geometry. Counts, rings, reveal, fail-open and cancellation remain.
- Pink now uses a neutral stone base with rose, sage, apricot and muted violet; daylight retains white with seafoam and coral accents. Bootstrap, runtime color and unit expectations are synchronized.
- Read-only review caught rotated ellipse centering being affected by separate transform properties. Ellipse rotation and aspect now compose after the centering translation inside WAAPI; live wave-center errors are below 0.001px for all themes.
- Live browser verified three different path geometries, three different particle trajectories, one unique loading scene/theme and static reduced-motion scenes.

## Follow-up: recorded rectangular flashes
- The user's MP4 contains a real rectangular background loss around 2.30-2.37s. Stable DOM opacity alone did not detect it; the previous acceptance claim was insufficient.
- Moving the vector clip from the live new page to the old bitmap still produced stale loader rectangles in headed Windows Chrome recordings. Rejected that intermediate implementation.
- Replaced the animated vector clip with a registered length driving a radial gradient mask on the old bitmap. The live new page stays unclipped. Circular reveal, all particle planes, waves, themed motifs and glass filters remain.
- Independent sequential video decoding confirmed the defective recordings and a clean gradient-mask recording at 2552x1400 / DPR 1.5. In a fixed hero-background crop, maximum mean RGB difference from the settled frame was 19.731 for the user recording, 20.647 for the rejected vector variant, and 0.225 for the gradient variant. These are reproduction checks, not a universal GPU guarantee.
- Current browser acceptance: all three theme switches and refreshes, rapid cancellation/cleanup, continuous mask interpolation, unchanged 150 desktop particle paths and zero page errors passed. npm test: 124 passed; tsc --noEmit passed.
- Evidence: output/playwright/user-decoded.png, after-decoded.png (rejected), mask-opening.png, mask-decoded.png, gpu-mask.webm and mask-acceptance.webm. Reproduction scripts and the decoded-frame comparison live alongside those artifacts.
- Used only the existing http://127.0.0.1:5173/ server; no server start/restart, commit, push or deployment.

## Follow-up: featured spread and complementary details
- The user found the large feature empty and the page palettes monotonous. Kept the approved theme direction, existing effects, discovery pool and route behavior.
- Added a masthead, larger balanced title/preview, image caption, and a bottom row of real manifest player/input/mode information. SVG scenery gives night a star chart, daylight overlapping mint/blue/coral geometry, and pink a lilac arch with sage botanical lines and apricot detail.
- Complementary tag and section-icon accents repeat across the discovery cards. Container queries retain a readable two-column spread on desktop and a complete stacked preview on narrow screens.
- Scoped production edits: src/pages/home.ts and src/styles/atmosphere.css. No new dependencies or image requests; loading/transition controllers unchanged.
- Live browser: 320/390/800/1024/1440 widths across all three themes passed horizontal bounds, action hit targets, information/control separation and one visible theme illustration. Eight different carousel slides updated their information correctly; preview hover/restoration and details/back navigation passed.
- Current theme switch/refresh/rapid-switch regression passed with zero page errors, stable opacity/blur and no leftover animation/layer state. Platform boundary/encoding/types checks and all 124 tests passed.
- Independent read-only review found no important issues; its small masthead contrast finding was fixed and verified as 10px with full opacity.
- Evidence: output/playwright/ui-three-themes.png, ui-spread-{dark,light,pink}.png, ui-phone-{dark,light,pink}.png and ui-motion-acceptance.webm. Subjective visual approval remains with the user.

## Follow-up: browser proportions and responsive layout
- The default 887x871 in-app pane was insufficient desktop acceptance. Rechecked the live existing :5173 server at explicit CSS content viewports: 1920x1000, 1536x864, 1366x768, 1024x768, 887x871, 768x1024, 390x844, 320x700 and 844x390; DPR was effectively 1. These are browser viewport checks, not physical-device tests.
- Confirmed layout faults: the feature's fixed minimum height left unused space; overlaid controls reserved a fixed width and broke facts into a 2+1 arrangement; hidden overflow allowed keyboard focus to scroll the slide; portrait trending covers could determine card height on tablet/mobile.
- Replaced that composition with a fluid content/preview stage and a real footer. Controls participate in layout, facts remain three aligned columns, and narrow containers stack the preview beneath the copy. The slide uses non-scrollable clipping; scenery is contained by the preview pane.
- Game screenshots use contain with a cached-image ambient mat; native SVG posters keep their designed central crop. Trending image positioning prevents intrinsic portrait dimensions from stretching cards. Existing loading scenes, particles, waves, reveal and hover effects remain.
- Live browser: all three themes across all nine viewport cases passed horizontal bounds, action/badge bounds, facts alignment, footer control bounds, scenery containment and zero internal slide scroll (27 cases). Preview hover transformed and restored; keyboard details-to-controls navigation kept slide.scrollTop at 0; details and browser-back navigation passed with no console errors.
- Current platform boundary/encoding/type checks and all 124 tests passed after the code changes. A scoped read-only review found no important regression. No server start/restart, commit, push or deployment.
- Evidence: output/playwright/responsive-acceptance.json and responsive-{wide-light-1920x1000,final-1536x864,laptop-dark-1366x768,tablet-768x1024,phone-390x844}.jpg. Browser screenshots are returned proportionally scaled by the capture API (for example 1912x996 from a 1920x1000 CSS viewport); they were not cropped, stretched or stitched afterward.

## Follow-up: whole-homepage visual rework
- Removed the preceding masthead, facts row, caption and repetitive permanent card descriptions. Added a persistent transparent arcade sculpture with a small live game preview, asymmetric trending composition, glass-hand vision banner and compact cover gallery. All 56 discovery candidates remain searchable; the initial 12 can expand to all.
- Three theme surfaces use complementary jade/blue/coral materials and deep petrol/plum sections. Existing portal/load effects and original game assets remain intact. Eight homepage-only vector variants retain their graphic content while omitting duplicate poster typography.
- Actual mouse hover, keyboard focus, search/filter/reset, expand, details/back, sticky offsets, carousel pause and rapid crossfade cleanup passed. The final sculpture composition passed 33 viewport/theme cases (11 sizes, 3 themes), with no horizontal overflow or control bounds failures. Platform checks, 124 tests and frontend build passed; scoped read-only review found no important outstanding regression.
- Current evidence and source prompts: docs/superpowers/specs/2026-10-20-home-gallery-design.md and output/playwright/gallery-acceptance.json. Screenshots: gallery-{light-desktop,pink-desktop,middle-desktop,phone-390x844}.png. Only the existing :5173 server was used; no commit, push or deployment.
