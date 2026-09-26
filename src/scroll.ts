import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "lenis"

export default class Scroll {
  lenis: Lenis

  constructor() {
    this.lenis = new Lenis({
      autoResize: false,
    })

    this.lenis.on("scroll", ScrollTrigger.update)

    // Add Lenis's requestAnimationFrame (raf) method to GSAP's ticker
    // This ensures Lenis's smooth scroll animation updates on each GSAP tick
    gsap.ticker.add((time) => {
      this.lenis.raf(time * 1000) // Convert time from seconds to milliseconds
    })

    // Disable lag smoothing in GSAP to prevent any delay in scroll animations
    gsap.ticker.lagSmoothing(0)
  }

  onResize() {
    this.lenis.resize()
  }

  onScroll(callback: (e: Lenis) => void) {
    this.lenis.on("scroll", callback)
  }
}
