// Fade the directional shadow out at the edge of its box.
//
// `SunShadow` keeps a tight ortho box on the player because a single box over
// the whole map spends its resolution on geometry nobody is looking at. The
// cost of a tight box is a boundary, and three's `getShadow()` treats that
// boundary as a hard cliff: inside it a surface is shadowed, one texel outside
// it the surface is fully lit. Because the box travels with the player, that
// cliff sweeps across the world as they walk — a shadow that was there is
// suddenly not, and the reverse. Players read it as parts of the map glitching
// out as they move, which is exactly what was reported.
//
// Worth being precise about WHY a receiver-side fade is the whole fix, because
// the obvious worry is casters: surely something just outside the box stops
// casting, and no amount of fading brings its shadow back? No. The light is
// ORTHOGRAPHIC and the shadow map is indexed by light-space xy, so a caster and
// the shadow it throws share the same light-space xy by construction. A caster
// whose shadow would land inside the box is itself inside the box. Nothing is
// missing from the map; the only defect is the cliff at its rim. (The depth
// range is a separate question, and `SunShadow` already sizes near/far around
// the slab that actually contains geometry.)
//
// Three has no hook for this — `getShadow` is a function inside a shared
// ShaderChunk — so the chunk itself is patched, once, before any material
// compiles. That is deliberately global: every shadow receiver in the game,
// including ones added later, gets it with no per-material opt-in to forget.
import * as THREE from 'three';

/**
 * Fraction of the half-extent over which the shadow fades to nothing.
 * 0.14 of a 32m half-extent is a 4.5m ramp — roughly a second of walking, and
 * far wider than the eye can localise as an edge.
 */
export const SHADOW_EDGE_FADE = 0.14;

let installed = false;

/** Patch three's shadow chunk. Idempotent; must run before materials compile. */
export function installShadowEdgeFade(fade = SHADOW_EDGE_FADE) {
  if (installed) return false;
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  // The only `return shadow;` in the chunk belongs to getShadow(); the point
  // shadow path returns expressions. Assert rather than silently no-op, because
  // a three upgrade that renames it must not quietly restore the hard edge.
  const marker = '\n\t\treturn shadow;\n\t}';
  const at = chunk.indexOf(marker);
  if (at < 0 || chunk.indexOf(marker, at + 1) >= 0) {
    console.warn('[shadow] could not patch getShadow() for edge fade; the box edge will be a hard cut');
    return false;
  }
  const start = (1 - fade).toFixed(4);
  const faded = `
		vec2 shadowEdge = abs( shadowCoord.xy - 0.5 ) * 2.0;
		float shadowEdgeT = max( shadowEdge.x, shadowEdge.y );
		shadow = mix( 1.0, shadow, 1.0 - smoothstep( ${start}, 1.0, shadowEdgeT ) );
		return shadow;
	}`;
  THREE.ShaderChunk.shadowmap_pars_fragment = chunk.slice(0, at) + faded + chunk.slice(at + marker.length);
  installed = true;
  return true;
}

/** The same ramp, for shaders that sample the shadow map themselves. */
export const SHADOW_EDGE_FADE_GLSL = /* glsl */`
float shadowEdgeFade(vec2 uv, float fadeFrac) {
  vec2 e = abs(uv - 0.5) * 2.0;
  return 1.0 - smoothstep(1.0 - fadeFrac, 1.0, max(e.x, e.y));
}
`;
