import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { GEffectPass } from './GEffectPass'

export class PostFXManager {
  private composer: EffectComposer
  private gPass: GEffectPass
  private bloomPass: UnrealBloomPass

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, camera))

    // Bloom with high threshold — only genuinely bright emissive objects (afterburner,
    // explosions, flare sprites) bloom; dull surfaces are unaffected.
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.45,  // strength
      0.40,  // radius
      0.88   // threshold — only pixels brighter than this bloom
    )
    this.composer.addPass(this.bloomPass)

    this.gPass = new GEffectPass()
    this.composer.addPass(this.gPass)
  }

  setGLoad(g: number): void {
    this.gPass.setGLoad(g)
  }

  render(): void {
    this.composer.render()
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h)
    this.bloomPass.resolution.set(w, h)
  }

  dispose(): void {
    this.composer.dispose()
  }
}
