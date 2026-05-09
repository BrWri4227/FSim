import * as THREE from 'three'
import type { AircraftState } from '../types/aircraft'
import type { RadarState } from '../types/radar'
import type { RWRState } from '../types/radar'
import type { DataLinkContact } from '../types/radar'
import type { LoadedStore } from '../types/weapons'
import type { TargetingPodState } from '../avionics/TargetingPod'
import type { GroundTarget } from '../entities/GroundTarget'
import { drawRadarPage } from './MFDPages/RadarPage'
import { drawEWPage }    from './MFDPages/EWPage'
import { drawStoresPage } from './MFDPages/StoresPage'
import { drawDataLinkPage } from './MFDPages/DataLinkPage'
import { drawFLIRPage } from './MFDPages/FLIRPage'

type MFDPage = 'RADAR' | 'EW' | 'STORES' | 'DATALINK' | 'FLIR'
const PAGES: MFDPage[] = ['RADAR', 'EW', 'STORES', 'DATALINK', 'FLIR']
const MFD_SIZE = 256

export class MFDRenderer {
  private canvas: HTMLCanvasElement
  private ctx:    CanvasRenderingContext2D
  private texture: THREE.CanvasTexture
  readonly mesh:   THREE.Mesh
  private pageIdx: number

  constructor(initialPage: MFDPage, quadMesh: THREE.Mesh) {
    this.canvas  = document.createElement('canvas')
    this.canvas.width = this.canvas.height = MFD_SIZE
    this.ctx     = this.canvas.getContext('2d')!
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.mesh    = quadMesh
    this.pageIdx = PAGES.indexOf(initialPage)
    if (this.pageIdx < 0) this.pageIdx = 0

    const mat = quadMesh.material as THREE.MeshBasicMaterial
    mat.map = this.texture
    mat.needsUpdate = true
  }

  cycleForward(): void { this.pageIdx = (this.pageIdx + 1) % PAGES.length }
  cycleBackward(): void { this.pageIdx = (this.pageIdx - 1 + PAGES.length) % PAGES.length }

  update(
    state: AircraftState,
    radar: RadarState,
    rwr: RWRState,
    stores: LoadedStore[],
    gunRounds: number,
    selectedWeapon: string,
    flareCount: number,
    chaffCount: number,
    dataLink: DataLinkContact[],
    pod: TargetingPodState | null = null,
    groundTargets: GroundTarget[] = [],
  ): void {
    const page = PAGES[this.pageIdx]!
    const w = MFD_SIZE, h = MFD_SIZE

    switch (page) {
      case 'RADAR':
        drawRadarPage(this.ctx, w, h, radar, state.positionNED)
        break
      case 'EW':
        drawEWPage(this.ctx, w, h, rwr, flareCount, chaffCount, performance.now() / 1000)
        break
      case 'STORES':
        drawStoresPage(this.ctx, w, h, stores, gunRounds, selectedWeapon)
        break
      case 'DATALINK':
        drawDataLinkPage(this.ctx, w, h, dataLink, state.positionNED)
        break
      case 'FLIR':
        if (pod) drawFLIRPage(this.ctx, w, h, pod, state.positionNED, groundTargets)
        else {
          this.ctx.fillStyle = '#0a0a0a'
          this.ctx.fillRect(0, 0, w, h)
        }
        break
    }

    this.texture.needsUpdate = true
  }

  dispose(): void {
    this.texture.dispose()
  }
}
