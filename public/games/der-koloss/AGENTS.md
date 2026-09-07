# Der Koloss repository guardrails

Before any production deployment, run every validator:

```sh
for f in scripts/*.mjs; do node "$f" || exit 1; done
```

`validate-game-invariants.mjs` is the broadest, but `validate-movement-feel.mjs`
and `validate-performance-invariants.mjs` guard fixes that are expensive to
rediscover: a control-key collision, an unstable camera spring, and the
allocation budget of the collision and particle hot paths.

All shipped GLTF files currently contain embedded `data:` buffers and bufferView
images that GLTFLoader materializes as `blob:` URLs. Their bytes, declared lengths,
and CSP compatibility are deployment invariants. Never remove `data:` or `blob:`
from the `connect-src` directive without first converting every model to same-origin
external buffers and images and updating the validator. `img-src` must continue to
permit `blob:` while bufferView images are shipped.

Do not let a missing, delayed, or failed visual asset change an entity's gameplay
identity. In particular, normal zombies must use a humanoid fallback and must never
fall back to a hellhound model. Hellhounds may spawn only on the scheduled dedicated
dog rounds.

After changes to spawning, rounds, models, or asset loading, verify at least one
normal round and one scheduled dog round in the browser before deploying.
