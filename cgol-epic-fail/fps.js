
export class Fps {
  constructor() {
    this.frames = []
    this.lastFrameTimeStamp = performance.now()
  }

  render() {
    const now = performance.now()
    const delta = now - this.lastFrameTimeStamp
    this.lastFrameTimeStamp = now
    const fps = 1 / delta * 1000

    this.frames.push(fps)
    if (this.frames.length > 100) {
      this.frames.shift()
    }

    // Find the max, min, and mean of our 100 latest timings.
    const min = Math.min(...this.frames)
    const max = Math.max(...this.frames)
    const mean = this.frames.reduce((p, v) => p + v) / this.frames.length

    return `ins/avg/min/max: ${[fps, mean, min, max].map(v => Math.round(v).toString().padStart(2, ' ')).join('/')}`
  }
}
