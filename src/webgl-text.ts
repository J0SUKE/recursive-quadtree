import * as THREE from "three"
import gsap from "gsap"
import GUI from "lil-gui"
import BlurText from "./blur-text"
import { Size } from "./types/types"

// starting state of the reveal animation
const REVEAL_BLUR = 0.06 // em, morph radius: thin parts vanish quickly past ~0.1

interface Props {
  scene: THREE.Scene
  sizes: Size
  root?: HTMLElement
}

interface FontSource {
  family: string
  weight: number
  url: string
}

interface TextItem {
  element: HTMLElement
  mesh: BlurText
  // first line baseline, in page px (scroll independent)
  pageBaseline: number
}

// The DOM stays the source of truth for layout (wrapping, text-balance, grid...).
// Each text element is measured, its line breaks are read back with Ranges,
// and troika only draws those exact lines with SDF glyphs.
export default class WebglText {
  scene: THREE.Scene
  sizes: Size
  fonts: FontSource[]
  items: TextItem[] = []
  scroll = window.scrollY

  constructor({ scene, sizes, root = document.getElementById("app")! }: Props) {
    this.scene = scene
    this.sizes = sizes
    this.fonts = this.readFontFaces()

    const elements = this.findTextElements(root)
    this.items = elements.map((element) => {
      const mesh = new BlurText()
      mesh.color = this.readColor(element)
      mesh.whiteSpace = "nowrap" // lines are already broken by the DOM
      mesh.blur = REVEAL_BLUR
      this.scene.add(mesh)
      return { element, mesh, pageBaseline: 0 }
    })

    // hide the DOM glyphs but keep them for layout, selection and a11y
    elements.forEach((element) => element.setAttribute("data-webgl-text", ""))

    // metrics are wrong until the webfonts are loaded
    document.fonts.ready.then(() => {
      this.layout()
    })

    this.createGui()
  }

  // Manual control of the effect, instead of playing reveal()
  createGui() {
    const params = {
      blur: REVEAL_BLUR,
      threshold: 0.5,
      edgeSoftness: 0.2,
    }
    const apply = () =>
      this.items.forEach(({ mesh }) => {
        mesh.glyphScale = 1
        mesh.blur = params.blur
        mesh.threshold = params.threshold
        mesh.edgeSoftness = params.edgeSoftness
      })

    const gui = new GUI({ title: "Text blur" })
    gui.add(params, "blur", 0, 0.4, 0.001).name("morph (em)").onChange(apply)
    // lower = spreads outward, higher = erodes
    gui
      .add(params, "threshold", 0.01, 0.99, 0.01)
      .name("threshold")
      .onChange(apply)
    gui
      .add(params, "edgeSoftness", 0, 0.5, 0.005)
      .name("edge softness")
      .onChange(apply)

    apply()
  }

  // Glyphs grow inside their fixed quads while getting sharp
  reveal({ element, mesh }: TextItem) {
    gsap.to(mesh, {
      glyphScale: 1,
      blur: 0,
      duration: 1.8,
      ease: "expo.out",
      scrollTrigger: {
        trigger: element,
        start: "top 90%",
        once: true,
      },
    })
  }

  // Elements owning direct, non-empty text. Descendants of a picked element are
  // merged into it (one font style per element).
  findTextElements(root: HTMLElement) {
    const elements: HTMLElement[] = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      if (!node.data.trim()) continue

      const parent = node.parentElement
      if (!parent || elements.some((el) => el.contains(parent))) continue
      elements.push(parent)
    }

    return elements
  }

  // Map @font-face rules from the stylesheets to their urls, so fonts only
  // need to be declared once in CSS.
  readFontFaces() {
    const fonts: FontSource[] = []

    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue // cross-origin sheet
      }

      for (const rule of rules) {
        if (!(rule instanceof CSSFontFaceRule)) continue

        const family = rule.style.getPropertyValue("font-family")
        const src = rule.style.getPropertyValue("src")
        const url = src.match(/url\(["']?(.*?)["']?\)/)?.[1]
        if (!url) continue

        fonts.push({
          family: this.cleanFamily(family),
          weight: parseInt(rule.style.getPropertyValue("font-weight")) || 400,
          url,
        })
      }
    }

    return fonts
  }

  cleanFamily(family: string) {
    return family.split(",")[0].trim().replace(/["']/g, "").toLowerCase()
  }

  findFont(style: CSSStyleDeclaration) {
    const family = this.cleanFamily(style.fontFamily)
    const weight = parseInt(style.fontWeight) || 400
    const candidates = this.fonts.filter((font) => font.family === family)

    candidates.sort(
      (a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight),
    )

    return candidates[0]?.url
  }

  // Resolve any css color (oklch, named...) to sRGB through a 2d canvas
  readColor(element: HTMLElement) {
    const ctx = document.createElement("canvas").getContext("2d")!
    ctx.fillStyle = getComputedStyle(element).color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data

    return new THREE.Color().setRGB(
      r / 255,
      g / 255,
      b / 255,
      THREE.SRGBColorSpace,
    )
  }

  // Group words by their rendered line using Ranges
  readLines(element: HTMLElement, fontSize: number) {
    const lines: string[][] = []
    const tops: number[] = []
    const range = document.createRange()
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let lastTop = -Infinity

    while (walker.nextNode()) {
      const node = walker.currentNode as Text

      for (const match of node.data.matchAll(/\S+/g)) {
        range.setStart(node, match.index!)
        range.setEnd(node, match.index! + match[0].length)
        const rect = range.getClientRects()[0]
        if (!rect) continue

        if (rect.top > lastTop + fontSize * 0.5) {
          lines.push([])
          tops.push(rect.top)
          lastTop = rect.top
        }
        lines[lines.length - 1].push(match[0])
      }
    }

    return { lines: lines.map((words) => words.join(" ")), tops }
  }

  // Exact baseline of the first line as laid out by the browser: an empty
  // inline-block's baseline is its bottom edge. Avoids relying on font metrics,
  // which differ between troika (OS/2 typo) and browsers (hhea / win).
  readBaseline(element: HTMLElement) {
    const probe = document.createElement("span")
    probe.style.cssText = "display:inline-block;width:0;height:0;"
    element.prepend(probe)
    const rect = probe.getBoundingClientRect()
    probe.remove()

    return { x: rect.left, y: rect.top }
  }

  transformText(text: string, transform: string) {
    if (transform === "uppercase") return text.toUpperCase()
    if (transform === "lowercase") return text.toLowerCase()
    return text
  }

  layout() {
    const pxToWorld = this.sizes.height / window.innerHeight

    this.items.forEach((item) => {
      const { element, mesh } = item
      const style = getComputedStyle(element)
      const bounds = element.getBoundingClientRect()

      const fontSize = parseFloat(style.fontSize)
      const letterSpacing =
        style.letterSpacing === "normal"
          ? 0
          : parseFloat(style.letterSpacing) / fontSize

      const { lines, tops } = this.readLines(element, fontSize)
      mesh.visible = lines.length > 0
      if (!mesh.visible) return

      // "normal" depends on font metrics too, so read the real line pitch
      let lineHeight = parseFloat(style.lineHeight) / fontSize
      if (style.lineHeight === "normal") {
        lineHeight =
          tops.length > 1
            ? (tops[tops.length - 1] - tops[0]) / (tops.length - 1) / fontSize
            : 1.2
      }

      const baseline = this.readBaseline(element)

      // content box, in page px
      const left =
        bounds.left +
        parseFloat(style.paddingLeft) +
        parseFloat(style.borderLeftWidth)
      const right =
        bounds.right -
        parseFloat(style.paddingRight) -
        parseFloat(style.borderRightWidth)

      let anchorX: "left" | "center" | "right" = "left"
      let x = baseline.x
      if (style.textAlign === "center") {
        anchorX = "center"
        x = (left + right) / 2
      } else if (style.textAlign === "right" || style.textAlign === "end") {
        anchorX = "right"
        x = right
      }

      mesh.text = this.transformText(lines.join("\n"), style.textTransform)
      mesh.font = this.findFont(style)
      mesh.fontSize = fontSize * pxToWorld
      mesh.lineHeight = lineHeight
      mesh.letterSpacing = letterSpacing
      mesh.textAlign = anchorX
      mesh.anchorX = anchorX
      mesh.anchorY = "top-baseline"
      // 64 (default) visibly rounds corners on large or pinch-zoomed text
      mesh.sdfGlyphSize = fontSize >= 48 ? 256 : 128
      mesh.position.x = (x - window.innerWidth * 0.5) * pxToWorld

      item.pageBaseline = baseline.y + window.scrollY
    })

    this.updateScroll(this.scroll)
  }

  updateScroll(scroll: number) {
    this.scroll = scroll
    const pxToWorld = this.sizes.height / window.innerHeight

    this.items.forEach(({ mesh, pageBaseline }) => {
      mesh.position.y =
        (window.innerHeight * 0.5 - pageBaseline + scroll) * pxToWorld
    })
  }

  onResize(sizes: Size) {
    this.sizes = sizes
    this.layout()
  }

  destroy() {
    this.items.forEach(({ element, mesh }) => {
      element.removeAttribute("data-webgl-text")
      this.scene.remove(mesh)
      mesh.dispose()
    })
    this.items = []
  }
}
