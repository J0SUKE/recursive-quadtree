import * as THREE from "three"

import vertexShader from "./shaders/vertex.glsl"
import fragmentShader from "./shaders/fragment.glsl"
import downsampleVertexShader from "./shaders/downsample.vertex.glsl"
import downsampleFragmentShader from "./shaders/downsample.fragment.glsl"
import GUI from "lil-gui"
import { Size } from "./types/types"
import gsap from "gsap"

const STATS_LEVELS = 9 // quadtree depth limit
const STATS_SIZE = 2 ** STATS_LEVELS // 512

interface Props {
  element: HTMLElement
  scene: THREE.Scene
  sizes: Size
  renderer: THREE.WebGLRenderer
  debug?: GUI
}
enum TextureType {
  VIDEO,
  IMAGE,
}

export default class RucursiveQuadtree {
  element: HTMLImageElement | HTMLVideoElement
  debug?: GUI
  material: THREE.ShaderMaterial
  geometry: THREE.PlaneGeometry
  mesh: THREE.Mesh
  scene: THREE.Scene
  sizes: Size
  textureType: TextureType
  renderer: THREE.WebGLRenderer
  statsTarget: THREE.WebGLRenderTarget
  statsMaterial: THREE.ShaderMaterial
  statsQuad: THREE.Mesh
  statsScene: THREE.Scene
  statsCamera = new THREE.Camera() // unused, the downsample quad writes clip space directly
  statsNeedUpdate = false
  matrix: {
    x: number
    y: number
    width: number
    height: number
  }
  scroll = 0
  maxDepth: number
  duration: number

  constructor({ element, scene, sizes, debug, renderer }: Props) {
    if (element instanceof HTMLImageElement) {
      this.textureType = TextureType.IMAGE
      this.element = element
    } else if (element instanceof HTMLVideoElement) {
      this.textureType = TextureType.VIDEO
      this.element = element
    } else return

    this.maxDepth = parseInt(this.element.getAttribute("data-max-depth") || "8")
    this.duration = parseInt(this.element.getAttribute("data-duration") || "2")
    this.scene = scene
    this.sizes = sizes
    this.debug = debug
    this.renderer = renderer
    this.scroll =
      (document.documentElement.scrollTop * this.sizes.height) /
      window.innerHeight

    this.createStats()
    this.createGeometry()
    this.createMaterial()
    this.createMesh()
    this.updateMatrix()
    this.scaleMesh()
    this.positionMesh()

    this.element.addEventListener("click", () => {
      this.animate()
    })
  }

  createGeometry() {
    this.geometry = new THREE.PlaneGeometry(1, 1)
  }

  // Every source (any size, image or video) is shrunk into a fixed
  // STATS_SIZE x STATS_SIZE mipmapped target. Each quadtree cell then maps
  // to exactly one texel of one mip level, so the effect costs the same
  // whatever the source resolution.
  createStats() {
    const source =
      this.element instanceof HTMLImageElement
        ? new THREE.TextureLoader().load(this.element.src, () => {
            this.statsNeedUpdate = true
          })
        : new THREE.VideoTexture(this.element)

    this.statsTarget = new THREE.WebGLRenderTarget(STATS_SIZE, STATS_SIZE, {
      type: THREE.HalfFloatType, // squared colors need more than 8 bits
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      depthBuffer: false,
    })

    this.statsMaterial = new THREE.ShaderMaterial({
      vertexShader: downsampleVertexShader,
      fragmentShader: downsampleFragmentShader,
      uniforms: {
        uSource: new THREE.Uniform(source),
        uSize: new THREE.Uniform(STATS_SIZE),
      },
    })

    this.statsQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      this.statsMaterial,
    )
    this.statsQuad.frustumCulled = false
    this.statsScene = new THREE.Scene()
    this.statsScene.add(this.statsQuad)
  }

  updateStats() {
    const previousTarget = this.renderer.getRenderTarget()
    this.renderer.setRenderTarget(this.statsTarget)
    this.renderer.render(this.statsScene, this.statsCamera)
    this.renderer.setRenderTarget(previousTarget)
  }

  update() {
    if (!this.statsTarget) return
    // Images only need one pass once loaded, videos need one per frame
    if (this.textureType === TextureType.VIDEO || this.statsNeedUpdate) {
      this.updateStats()
      this.statsNeedUpdate = false
    }
  }

  onResize(sizes: Size) {
    this.sizes = sizes

    this.updateMatrix()
    this.scaleMesh()
    this.positionMesh()
    this.updateScroll(this.scroll)
  }

  createMaterial() {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      defines: {
        STATS_LEVELS: STATS_LEVELS,
      },
      uniforms: {
        uStats: new THREE.Uniform(this.statsTarget.texture),
        uThreshold: new THREE.Uniform(0.08),
        uMaxDepth: new THREE.Uniform(1),
        uStagger: new THREE.Uniform(1),
      },
    })
  }

  animate() {
    gsap.to(this.material.uniforms.uMaxDepth, {
      value: this.maxDepth,
      duration: this.duration,
      ease: "power2.out",
    })
  }

  createMesh() {
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.scene.add(this.mesh)
  }

  updateMatrix() {
    const bounds = this.element.getBoundingClientRect()

    const width = (bounds.width * this.sizes.width) / window.innerWidth
    const height = (bounds.height * this.sizes.height) / window.innerHeight

    const x =
      ((bounds.left - window.innerWidth * 0.5 + bounds.width * 0.5) *
        this.sizes.width) /
      window.innerWidth

    const y =
      ((window.innerHeight * 0.5 -
        bounds.top -
        bounds.height * 0.5 -
        document.documentElement.scrollTop) *
        this.sizes.height) /
      window.innerHeight

    this.matrix = {
      width,
      height,
      x,
      y,
    }
  }

  scaleMesh() {
    this.mesh.scale.x = this.matrix.width
    this.mesh.scale.y = this.matrix.height
  }

  positionMesh() {
    this.mesh.position.x = this.matrix.x
    this.mesh.position.y = this.matrix.y
  }

  updateScroll(scroll: number) {
    this.scroll = scroll
    const normalizeScroll = (scroll * this.sizes.height) / window.innerHeight

    this.mesh.position.y = this.matrix.y + normalizeScroll
  }
}
