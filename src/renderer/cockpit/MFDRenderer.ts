import * as THREE from 'three'
import type { AircraftState } from '../types/aircraft'
import type { RadarState } from '../types/radar'
import type { RWRState } from '../types/radar'
import type { DataLinkContact } from '../types/radar'
import type { LoadedStore } from '../types/weapons'
import { drawRadarPage } from './MFDPages/RadarPage'
import { drawEWPage }    from './MFDPages/EWPage'
import { drawStoresPage } from './MFDPages/StoresPage'
import { drawDataLinkPage } from './MFDPages/DataLinkPage'

type MFDPage = 'RADAR' | 'EW' | 'STORES' | 'DATALINK'
const PAGES: MFDPage[] = ['RADAR', 'EW', 'STORES', 'DATALINK']
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
    dataLink: DataLinkContact[]
  ): void {
    const page = PAGES[this.pageIdx]!
    const w = MFD_SIZE, h = MFD_SIZE

    switch (page) {
      case 'RADAR':
        drawRadarPage(this.ctx, w, h, radar, state.positionNED)
        break
      case 'EW':
        drawEWPage(this.ctx, w, h, rwr, flareCount, chaffCount)
        break
      case 'STORES':
        drawStoresPage(this.ctx, w, h, stores, gunRounds, selectedWeapon)
        break
      case 'DATALINK':
        drawDataLinkPage(this.ctx, w, h, dataLink, state.positionNED)
        break
    }

    this.texture.needsUpdate = true
  }

  dispose(): void {
    this.texture.dispose()
  }
}
