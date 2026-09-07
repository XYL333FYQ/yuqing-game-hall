# NOTICE

This file records what the MIT license in [`LICENSE`](LICENSE) does and does not cover. Read it before redistributing any part of this repository.

## Scope of the MIT license

**The MIT license covers the source code only** — everything under `js/`, `scripts/`, `api/`, the HTML, and the CSS, except where a file states otherwise.

**It does not cover the contents of `assets/`.** Those files are a mix of public-domain dedications, third-party licenses, and — in one case — material owned by a third party that is not ours to license. Do not assume any file under `assets/` is MIT-licensed.

## Third-party code

| Component | Location | License |
|---|---|---|
| [Three.js](https://threejs.org) | `vendor/three.module.js`, `vendor/loaders/`, `vendor/utils/`, `vendor/SkeletonUtils.js` | MIT, three.js authors |
| [PeerJS](https://peerjs.com) | `vendor/peerjs.min.js` | MIT, Michelle Bu and Eric Zhang |

Vendored unmodified. Their own license terms apply.

## Assets

### Public domain (CC0)

| Asset | Source |
|---|---|
| Two rigged zombie meshes, two blood decals | [Quaternius](https://quaternius.com) |
| Brick, concrete, rusted metal, wood, diamond plate, dirt textures | [ambientCG](https://ambientcg.com) |

CC0 1.0 Universal — no rights reserved, no attribution required. Credited here anyway.

### Fonts

Special Elite and Staatliches, in `assets/fonts/`, are licensed under the SIL Open Font License. See [`assets/fonts/LICENSE.txt`](assets/fonts/LICENSE.txt).

### Original to this project

All other geometry, textures, shaders, and UI are generated in code or drawn to canvas at runtime, and are covered by the MIT license with the rest of the source.

The menu background footage (`assets/menu/`), the social preview image, and the repository banner (`.github/banner.webp`) are original artwork made for this project.

All sound effects, ambiences, and character voice performances were generated with [ElevenLabs](https://elevenlabs.io) for this project. The four character voices are original AI-generated performances intended to evoke the spirit of the classic crew. They are **not** official recordings, and are not presented as genuine performances by any real person or rights holder.

### Not ours — included as fan tribute

**`assets/audio/beauty-of-annihilation.mp3`**

"Beauty of Annihilation", written and composed by **Kevin Sherwood**, performed by **Elena Siegman**. Originally released in *Call of Duty: World at War* (2009).

**Copyright Activision Publishing, Inc. and/or Treyarch.** All rights reserved by its owners.

This track is **not** covered by the MIT license, is **not** licensed to this project, and is **not** ours to sublicense or grant to you. It is included as part of a non-commercial fan tribute. If you fork, redistribute, or deploy this project, you are responsible for your own use of this file — the safest course is to remove it.

It is referenced in exactly two places:

- `js/audio.js` — playback
- `js/assets-page.js` — the asset archive listing

## Trademarks

*Call of Duty*, *Der Riese*, Pack-a-Punch, Juggernog, Quick Revive, Speed Cola, Double Tap, Mule Kick, Monkey Bomb, Ray Gun, Wunderwaffe, and the characters Tank Dempsey, Nikolai Belinski, Takeo Masaki, and Edward Richtofen are trademarks and/or copyrights of Activision Publishing, Inc. and/or Treyarch.

This project is unofficial and **not affiliated with, endorsed by, or associated with** Activision or Treyarch. No claim of ownership is made to any of it. Use of these names is nominative — to describe what this tribute is a tribute to.
