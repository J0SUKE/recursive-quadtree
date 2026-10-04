import * as THREE from "three"
import { Dimensions, Size } from "./types/types"
import GUI from "lil-gui"

import RucursiveQuadtree from "./recursive-quadtree-effect"
import WebglText from "./webgl-text"

export default class Canvas {
  element: HTMLCanvasElement
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  sizes: Size
  dimensions: Dimensions
  debug: GUI
  recursiveMedias: RucursiveQuadtree[] = []
  webglText: WebglText

  constructor() {
    this.element = document.getElementById("webgl") as HTMLCanvasElement
    this.createScene()
    this.createCamera()
    this.createRenderer()
    this.setSizes()
    this.render()

    this.webglText = new WebglText({ scene: this.scene, sizes: this.sizes })

    window.visualViewport?.addEventListener("resize", () =>
      this.updateViewport(),
    )
    window.visualViewport?.addEventListener("scroll", () =>
      this.updateViewport(),
    )
  }

  createScene() {
    this.scene = new THREE.Scene()
  }

  createCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    )
    this.scene.add(this.camera)
    this.camera.position.z = 10
  }

  createRenderer() {
    this.dimensions = {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: Math.min(2, window.devicePixelRatio),
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.element,
      alpha: true,
    })
    this.updateViewport()
    this.renderer.render(this.scene, this.camera)
  }

  // Pinch-zoom doesn't change devicePixelRatio: the browser just magnifies the
  // canvas bitmap, so the WebGL text gets blurry. Instead, shrink the canvas to
  // the visible part of the page and render only that region (camera view
  // offset) at dpr * zoom, which keeps the pixel count constant.
  updateViewport() {
    const viewport = window.visualViewport
    const scale = viewport?.scale ?? 1
    const left = viewport?.offsetLeft ?? 0
    const top = viewport?.offsetTop ?? 0
    const width = viewport?.width ?? this.dimensions.width
    const height = viewport?.height ?? this.dimensions.height

    this.element.style.left = `${left}px`
    this.element.style.top = `${top}px`

    // resizing clears the drawing buffer, only do it when needed
    const pixelRatio = this.dimensions.pixelRatio * scale
    const size = this.renderer.getSize(new THREE.Vector2())
    if (
      pixelRatio !== this.renderer.getPixelRatio() ||
      width !== size.x ||
      height !== size.y
    ) {
      this.renderer.setPixelRatio(pixelRatio)
      this.renderer.setSize(width, height)
    }

    this.camera.setViewOffset(
      this.dimensions.width,
      this.dimensions.height,
      left,
      top,
      width,
      height,
    )
  }

  updateScroll(scroll: number) {
    this.recursiveMedias.forEach((media) => media.updateScroll(scroll))
    this.webglText.updateScroll(scroll)
  }

  setSizes() {
    let fov = this.camera.fov * (Math.PI / 180)
    let height = this.camera.position.z * Math.tan(fov / 2) * 2
    let width = height * this.camera.aspect

    this.sizes = {
      width: width,
      height: height,
    }
  }

  onResize() {
    this.dimensions = {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: Math.min(2, window.devicePixelRatio),
    }

    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.setSizes()

    this.updateViewport()

    this.recursiveMedias.forEach((media) => media.onResize(this.sizes))
    this.webglText.onResize(this.sizes)
  }

  render() {
    this.recursiveMedias.forEach((media) => media.update())
    this.renderer.render(this.scene, this.camera)
  }
}
