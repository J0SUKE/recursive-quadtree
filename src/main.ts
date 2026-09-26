import "./style.css"
import Canvas from "./canvas"
import Debug from "./debug"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Scroll from "./scroll"

gsap.registerPlugin(ScrollTrigger)

class App {
  scroll: Scroll
  canvas: Canvas
  debug: Debug

  constructor() {
    //this.debug = new Debug()
    this.scroll = new Scroll()
    this.canvas = new Canvas()

    this.scroll.onScroll((e) => {
      this.canvas.updateScroll(e.scroll)
    })

    window.addEventListener("resize", this.onResize.bind(this))

    this.render()
  }

  onResize() {
    this.scroll.onResize()
    this.canvas.onResize()
  }

  render() {
    //this.debug.stats.begin()
    this.canvas.render()
    //this.debug.stats.end()
    requestAnimationFrame(this.render.bind(this))
  }
}

export default new App()
