import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { GEffectPass } from './GEffectPass'

export type PostFXQuality = 'HIGH' | 'MEDIUM' | 'LOW'

const QUALITY_PRESETS: Record<PostFXQuality, { strength: number; radius: number; threshold: number; halfResBloom: boolean; bloomEnabled: boolean }> = {
  HIGH:   { strength: 0.45, radius: 0.40, threshold: 0.88, halfResBloom: false, bloomEnabled: true },
  MEDIUM: { strength: 0.40, radius: 0.35, threshold: 0.90, halfResBloom: true,  bloomEnabled: true },
  LOW:    { strength: 0.30, radius: 0.30, threshold: 0.92, halfResBloom: true,  bloomEnabled: false },
}

export class PostFXManager {
  private composer: EffectComposer
  private gPass: GEffectPass
  private bloomPass: UnrealBloomPass
  private quality: PostFXQuality = 'HIGH'
  private viewportW = 1
  private viewportH = 1

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, quality: PostFXQuality = 'HIGH') {
    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, camera))

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.40, 0.88)
    this.composer.addPass(this.bloomPass)

    this.gPass = new GEffectPass()
    this.composer.addPass(this.gPass)

    this.setQuality(quality)
  }

  setQuality(quality: PostFXQuality): void {
    this.quality = quality
    const preset = QUALITY_PRESETS[quality]
    this.bloomPass.enabled = preset.bloomEnabled
    this.bloomPass.strength = preset.strength
    this.bloomPass.radius = preset.radius
    this.bloomPass.threshold = preset.threshold
    this.applyBloomResolution()
  }

  getQuality(): PostFXQuality {
    return this.quality
  }

  setGLoad(g: number): void {
    this.gPass.setGLoad(g)
  }

  render(): void {
    this.composer.render()
  }

  setSize(w: number, h: number): void {
    this.viewportW = w
    this.viewportH = h
    this.composer.setSize(w, h)
    this.applyBloomResolution()
  }

  private applyBloomResolution(): void {
    const preset = QUALITY_PRESETS[this.quality]
    const bloomW = preset.halfResBloom ? Math.max(1, Math.floor(this.viewportW * 0.5)) : this.viewportW
    const bloomH = preset.halfResBloom ? Math.max(1, Math.floor(this.viewportH * 0.5)) : this.viewportH
    this.bloomPass.resolution.set(bloomW, bloomH)
  }

  dispose(): void {
    this.composer.dispose()
  }
}
