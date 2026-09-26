import * as THREE from "three"
import { Dimensions, Size } from "./types/types"
import GUI from "lil-gui"

import RucursiveQuadtree from "./recursive-quadtree-effect"

export default class Canvas {
  element: HTMLCanvasElement
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  sizes: Size
  dimensions: Dimensions
  debug: GUI
  recursiveMedias: RucursiveQuadtree[] = []

  constructor() {
    this.element = document.getElementById("webgl") as HTMLCanvasElement
    this.createScene()
    this.createCamera()
    this.createRenderer()
    this.setSizes()
    this.createRecursiveMedia()
    this.render()
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
    this.renderer.setSize(this.dimensions.width, this.dimensions.height)
    this.renderer.render(this.scene, this.camera)

    this.renderer.setPixelRatio(this.dimensions.pixelRatio)
  }

  updateScroll(scroll: number) {
    this.recursiveMedias.forEach((media) => media.updateScroll(scroll))
  }

  createRecursiveMedia() {
    const elements = [
      ...document.querySelectorAll("[data-recursive-effect]"),
    ] as HTMLElement[]
    this.recursiveMedias = elements.map(
      (element) =>
        new RucursiveQuadtree({
          scene: this.scene,
          element,
          sizes: this.sizes,
          renderer: this.renderer,
          debug: this.debug,
        }),
    )
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

    this.renderer.setPixelRatio(this.dimensions.pixelRatio)
    this.renderer.setSize(this.dimensions.width, this.dimensions.height)

    this.recursiveMedias.forEach((media) => media.onResize(this.sizes))
  }

  render() {
    this.recursiveMedias.forEach((media) => media.update())
    this.renderer.render(this.scene, this.camera)
  }
}
