import * as THREE from "three"
import { Text } from "troika-three-text"
import { createDerivedMaterial } from "troika-three-utils"

const FRAGMENT_UNIFORMS = /* glsl */ `
uniform float uGlyphScale;
uniform float uBlur;
uniform float uThreshold;
uniform float uEdgeSoftness;
`

const MORPH_SAMPLES = 16

const FRAGMENT_FUNCTIONS = /* glsl */ `
// Same as troikaGetFragDistValue, but at any point of the quad, and with the
// glyph scaled around the quad center: the quad keeps its size, only the shape
// sampled inside shrinks.
float blurTextGetDistAt(vec2 quadUV) {
  vec2 glyphUV = (quadUV - 0.5) / uGlyphScale + 0.5;
  vec2 clampedUV = clamp(glyphUV, 0.5 / uTroikaSDFGlyphSize, 1.0 - 0.5 / uTroikaSDFGlyphSize);
  float distance = troikaGlyphUvToDistance(clampedUV);
  distance += clampedUV == glyphUV ? 0.0 : length((glyphUV - clampedUV) * vTroikaGlyphDimensions);
  return distance * uGlyphScale;
}

float blurTextGetFragDistValue() {
  return blurTextGetDistAt(vTroikaGlyphUV);
}

// Blur then threshold, like a gooey/morph filter: average the glyph coverage
// over a disk of radius uBlur, then cut it at uThreshold. Corners round off,
// thin parts erode and close parts merge, but the edge stays crisp.
// At 0.5 the result stays within the glyph's own extent; lower thresholds
// spread it outward (up to uBlur), and it can then get cut by the quad.
float blurTextGetMorphAlpha(float aaDist) {
  // soft samples so the average doesn't band with only a few taps
  float softness = max(uBlur * 0.6, aaDist);
  float coverage = 0.0;

  for (int i = 0; i < ${MORPH_SAMPLES}; i++) {
    // golden angle spiral, evenly covers the disk
    float radius = sqrt((float(i) + 0.5) / ${MORPH_SAMPLES}.0) * uBlur;
    float angle = float(i) * 2.39996323;
    vec2 offset = vec2(cos(angle), sin(angle)) * radius;
    float distance = blurTextGetDistAt(vTroikaGlyphUV + offset / vTroikaGlyphDimensions);
    coverage += smoothstep(softness, -softness, distance);
  }
  coverage /= ${MORPH_SAMPLES}.0;

  // cut at uThreshold with a fade of uEdgeSoftness (in coverage units) on
  // each side, never sharper than one pixel
  float aa = max(fwidth(coverage) * 0.5, 1e-4);
  float fade = max(uEdgeSoftness, aa);
  return smoothstep(uThreshold - fade, uThreshold + fade, coverage);
}
`

// How far the glyph quads grow around the glyph box, in morph radiuses. A low
// threshold spreads the shape up to ~uBlur past the outline, and the edge
// softness fades a bit further.
const QUAD_PADDING = 1.5

const VERTEX_UNIFORMS = /* glsl */ `
uniform float uBlur;
`

// Injection points in troika's vertex shader (troika-three-text 0.52). Troika
// already grows the quads there for outlines, so add our padding to it.
// vTroikaGlyphUV/Dimensions stay relative to the glyph box, so the fragment
// shader just extrapolates the distance in the extra space.
const VERTEX_REPLACEMENTS: [string, string][] = [
  [
    "bounds.xy - uTroikaEdgeOffset - uTroikaBlurRadius",
    `bounds.xy - uTroikaEdgeOffset - uTroikaBlurRadius - uBlur * ${QUAD_PADDING.toFixed(2)}`,
  ],
  [
    "bounds.zw + uTroikaEdgeOffset + uTroikaBlurRadius",
    `bounds.zw + uTroikaEdgeOffset + uTroikaBlurRadius + uBlur * ${QUAD_PADDING.toFixed(2)}`,
  ],
]

// Injection points in troika's fragment shader (troika-three-text 0.52)
const REPLACEMENTS: [string, string][] = [
  [
    "float troikaGetEdgeAlpha(",
    `${FRAGMENT_FUNCTIONS}\nfloat troikaGetEdgeAlpha(`,
  ],
  [
    "float fragDistance = troikaGetFragDistValue();",
    "float fragDistance = blurTextGetFragDistValue();",
  ],
  [
    "troikaGetEdgeAlpha(fragDistance, uTroikaEdgeOffset, max(aaDist, uTroikaBlurRadius))",
    "blurTextGetMorphAlpha(aaDist)",
  ],
]

function rewriteShaders({
  vertexShader,
  fragmentShader,
}: {
  vertexShader: string
  fragmentShader: string
}) {
  const replace = (shader: string, replacements: [string, string][]) => {
    for (const [from, to] of replacements) {
      if (!shader.includes(from)) {
        console.warn(`BlurText: "${from}" not found in troika shader`)
      }
      shader = shader.replace(from, to)
    }
    return shader
  }

  return {
    vertexShader: VERTEX_UNIFORMS + replace(vertexShader, VERTEX_REPLACEMENTS),
    fragmentShader: FRAGMENT_UNIFORMS + replace(fragmentShader, REPLACEMENTS),
  }
}

export default class BlurText extends Text {
  /** blur radius, in em */
  blur = 0
  /** glyph scale inside its fixed quad, 0 to 1 */
  glyphScale = 1
  /** coverage cut: 0.5 = original edge, lower spreads outward, higher erodes */
  threshold = 0.5
  /** fade around the threshold, in coverage units: 0 = crisp, 0.5 = plain blur */
  edgeSoftness = 0

  // `declare` so the field isn't reset after super(), in case troika builds
  // the material during construction
  declare private blurUniforms?: {
    uBlur: THREE.IUniform<number>
    uGlyphScale: THREE.IUniform<number>
    uThreshold: THREE.IUniform<number>
    uEdgeSoftness: THREE.IUniform<number>
  }

  getBlurUniforms() {
    return (this.blurUniforms ??= {
      uBlur: { value: 0 },
      uGlyphScale: { value: 1 },
      uThreshold: { value: 0.5 },
      uEdgeSoftness: { value: 0 },
    })
  }

  createDerivedMaterial(baseMaterial: THREE.Material) {
    return createDerivedMaterial(super.createDerivedMaterial(baseMaterial), {
      // prototype-chain instead of cloning, a clone loses the
      // isTroikaTextMaterial flag and troika then never binds its SDF texture
      chained: true,
      uniforms: this.getBlurUniforms(),
      customRewriter: rewriteShaders,
    })
  }

  onBeforeRender(...args: Parameters<THREE.Object3D["onBeforeRender"]>) {
    super.onBeforeRender(...args)

    const uniforms = this.getBlurUniforms()
    uniforms.uBlur.value = this.blur * this.fontSize
    uniforms.uGlyphScale.value = Math.max(this.glyphScale, 0.001)
    uniforms.uThreshold.value = this.threshold
    uniforms.uEdgeSoftness.value = this.edgeSoftness
  }
}
