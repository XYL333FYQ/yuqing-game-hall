# Credits & Asset Attribution

Sanctuary's End bundles and loads third-party libraries and art assets. The
game's own code is MIT-licensed (see `LICENSE`); the items below keep their
original authors' licenses.

## Libraries

- **Three.js** — 3D rendering engine. © mrdoob and contributors. MIT License.
  Self-hosted (vendored) under `vendor/three-0.184.0/` — see the README and
  LICENSE there. https://threejs.org

- **Cinzel** — display/heading font. © 2020 The Cinzel Project Authors
  (Natanael Gama). Licensed under the **SIL Open Font License 1.1**. Self-hosted
  (vendored) under `vendor/fonts/cinzel/` — see the README and `OFL.txt` there.
  https://github.com/NDISCOVER/Cinzel

## 3D Models (embedded in `sanctuary.html`)

- **KayKit — Adventurers Character Pack** (hero Knight and town NPCs) — by
  **Kay Lousberg**. Licensed **CC0 1.0** (public domain; no attribution
  required, but credited here with thanks). https://kaylousberg.com

- **Quaternius — Ultimate Monsters** (monster roster) — by **Quaternius**.
  Licensed **CC0 1.0** (public domain; no attribution required, credited with
  thanks). https://quaternius.com

- **Low-poly Fox** (from the Khronos glTF Sample Assets) — **split license**:
  - Model by **PixelMannen** — CC0 1.0.
  - Rigging & animation by **@tomkranis** — **CC-BY 4.0** *(attribution required)*.
  - glTF conversion by **@AsoboStudio** and **@scurest** — CC-BY 4.0.
  - Source: https://github.com/KhronosGroup/glTF-Sample-Assets

## Notes

- CC0 assets above are used freely under public-domain terms; per the authors'
  request, unmodified copies are not resold or claimed as original work.
- The Fox's animation/rigging is **CC-BY 4.0**, so attribution is mandatory —
  that is the purpose of this file. If the Fox is ever removed from the build,
  this entry can be dropped.
- All textures in the game are generated procedurally in code (no third-party
  texture assets are bundled).
