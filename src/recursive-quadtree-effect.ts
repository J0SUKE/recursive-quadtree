import * as THREE from "three"

import vertexShader from "./shaders/vertex.glsl"
import fragmentShader from "./shaders/fragment.glsl"
import GUI from "lil-gui"
import { Size } from "./types/types"

interface Props {
  element: HTMLElement
  scene: THREE.Scene
  sizes: Size
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
  matrix: {
    x: number
    y: number
    width: number
    height: number
  }

  constructor({ element, scene, sizes, debug }: Props) {
    if (element instanceof HTMLImageElement) {
      this.textureType = TextureType.IMAGE
      this.element = element
    } else if (element instanceof HTMLVideoElement) {
      this.textureType = TextureType.VIDEO
      this.element = element
    } else return
    this.scene = scene
    this.sizes = sizes
    this.debug = debug

    this.createGeometry()
    this.createMaterial()
    this.createDebug()
    this.createMesh()
    this.updateMatrix()
    this.scaleMesh()
    this.positionMesh()
  }

  createMaterial() {
    this.geometry = new THREE.PlaneGeometry(1, 1)
  }

  createGeometry() {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: new THREE.Uniform(
          this.textureType === TextureType.IMAGE
            ? new THREE.TextureLoader().load(this.element.src)
            : new THREE.VideoTexture(this.element),
        ),
        uThreshold: new THREE.Uniform(0.08),
        uMaxDepth: new THREE.Uniform(7),
        uLineWidth: new THREE.Uniform(1),
      },
    })
  }

  createDebug() {
    if (!this.debug) return
    const folder = this.debug.addFolder("Quadtree")
    const { uThreshold, uMaxDepth, uLineWidth } = this.material.uniforms
    folder.add(uThreshold, "value", 0, 0.5, 0.001).name("threshold")
    folder.add(uMaxDepth, "value", 1, 9, 1).name("max depth")
    folder.add(uLineWidth, "value", 0, 4, 0.1).name("line width")
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
      ((window.innerHeight * 0.5 - bounds.top - bounds.height * 0.5) *
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
}
