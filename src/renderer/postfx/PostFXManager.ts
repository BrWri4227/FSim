import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GEffectPass } from './GEffectPass'

export class PostFXManager {
  private composer: EffectComposer
  private gPass: GEffectPass

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, camera))
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
  }

  dispose(): void {
    this.composer.dispose()
  }
}
