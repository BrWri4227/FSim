import * as THREE from 'three'
import type { FlareContact } from '../types/ir'
import { nedToThree } from '../utils/MathUtils'

const POOL_SIZE = 24

function makeFlareTexture(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,240,180,1)')
  grad.addColorStop(0.3, 'rgba(255,140,30,0.8)')
  grad.addColorStop(1, 'rgba(255,80,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  return tex
}

export class FlareEffect {
  private sprites: THREE.Sprite[] = []
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
    const tex = makeFlareTexture()
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
      const sprite = new THREE.Sprite(mat)
      sprite.visible = false
      scene.add(sprite)
      this.sprites.push(sprite)
    }
  }

  update(flares: readonly FlareContact[]): void {
    for (let i = 0; i < this.sprites.length; i++) {
      const flare = flares[i]
      const sprite = this.sprites[i]!
      if (!flare) { sprite.visible = false; continue }
      const t = flare.heatSignatureKW / 60
      sprite.visible = t > 0.01
      sprite.position.copy(nedToThree(flare.positionNED))
      const scale = 6 * t + 1
      sprite.scale.set(scale, scale, 1)
      ;(sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, t * 1.5)
    }
  }

  dispose(): void {
    for (const s of this.sprites) this.scene.remove(s)
  }
}
