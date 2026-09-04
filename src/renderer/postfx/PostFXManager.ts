import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { GEffectPass, type GEffectInputs } from './GEffectPass'

export type PostFXQuality = 'HIGH' | 'MEDIUM' | 'LOW'

export const POSTFX_QUALITIES: readonly PostFXQuality[] = ['HIGH', 'MEDIUM', 'LOW']

export const POSTFX_QUALITY_LABELS: Record<PostFXQuality, string> = {
  HIGH:   'High — full bloom, soft shadows',
  MEDIUM: 'Medium — half-res bloom, hard shadows',
  LOW:    'Low — no bloom, no shadows',
}

/**
 * Renderer-level cost knobs for the same quality setting, consumed by
 * `SceneManager`. Shadow map size and device pixel ratio dominate GPU cost far
 * more than the post chain does, so the LOW preset has to reach them too or the
 * setting does nothing for the people who need it.
 */
export const RENDER_QUALITY: Record<PostFXQuality, {
  shadows: boolean
  shadowMapSize: number
  softShadows: boolean
  maxPixelRatio: number
}> = {
  HIGH:   { shadows: true,  shadowMapSize: 2048, softShadows: true,  maxPixelRatio: 2 },
  MEDIUM: { shadows: true,  shadowMapSize: 1024, softShadows: false, maxPixelRatio: 1.5 },
  LOW:    { shadows: false, shadowMapSize: 512,  softShadows: false, maxPixelRatio: 1 },
}

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
  private timeOfDayBloomStrength: number | null = null
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
    this.bloomPass.radius = preset.radius
    this.bloomPass.threshold = preset.threshold
    this.applyBloomStrength()
    this.applyBloomResolution()
  }

  getQuality(): PostFXQuality {
    return this.quality
  }

  setGEffect(e: GEffectInputs): void {
    this.gPass.setEffect(e)
  }

  /** Override the bloom strength for the current time-of-day (day = subtle, night = punchy). */
  setBloomStrength(strength: number): void {
    this.timeOfDayBloomStrength = strength
    this.applyBloomStrength()
  }

  /**
   * Time-of-day sets the absolute look; quality scales it relative to HIGH.
   * Kept as separate inputs because the two are set independently and in
   * either order — a bare assignment from one would clobber the other.
   */
  private applyBloomStrength(): void {
    const preset = QUALITY_PRESETS[this.quality]
    const base = this.timeOfDayBloomStrength ?? preset.strength
    const scale = preset.strength / QUALITY_PRESETS.HIGH.strength
    this.bloomPass.strength = base * scale
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
