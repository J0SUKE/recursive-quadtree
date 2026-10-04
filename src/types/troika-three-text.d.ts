// The typings shipped with troika-three-text are generated from JSDoc and
// unusable (Text doesn't extend Mesh, wrong prop types), so declare what we use.
declare module "troika-three-text" {
  import { Color, Material, Mesh } from "three"

  export class Text extends Mesh {
    text: string
    font?: string
    fontSize: number
    lineHeight: number | "normal"
    letterSpacing: number
    maxWidth: number
    whiteSpace: "normal" | "nowrap"
    textAlign: "left" | "right" | "center" | "justify"
    anchorX: number | "left" | "center" | "right" | string
    anchorY: number | "top" | "top-baseline" | "middle" | "bottom-baseline" | "bottom" | string
    color: string | number | Color
    sdfGlyphSize: number
    material: Material
    createDerivedMaterial(baseMaterial: Material): Material
    sync(callback?: () => void): void
    dispose(): void
  }
}

declare module "troika-three-utils" {
  import { IUniform, Material } from "three"

  export function createDerivedMaterial<T extends Material>(
    baseMaterial: T,
    options: {
      defines?: Record<string, string | number>
      uniforms?: Record<string, IUniform>
      timeUniform?: string
      vertexDefs?: string
      vertexMainIntro?: string
      vertexMainOutro?: string
      vertexTransform?: string
      fragmentDefs?: string
      fragmentMainIntro?: string
      fragmentMainOutro?: string
      fragmentColorTransform?: string
      customRewriter?: (shaders: {
        vertexShader: string
        fragmentShader: string
      }) => { vertexShader: string; fragmentShader: string }
      chained?: boolean
    },
  ): T
}
