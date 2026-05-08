import * as THREE from 'three'

const TERRAIN_SIZE = 300000  // 300 km

export class Terrain {
  private mesh: THREE.Mesh

  constructor(scene: THREE.Scene) {
    // Large flat terrain with grid texture
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 64, 64)
    geo.rotateX(-Math.PI / 2)

    // Procedural canvas texture
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    const ctx = canvas.getContext('2d')!

    // Base color
    ctx.fillStyle = '#3a5c2a'
    ctx.fillRect(0, 0, 1024, 1024)

    // Grid lines
    ctx.strokeStyle = '#2a4a1a'
    ctx.lineWidth = 1
    const gridSize = 64
    for (let i = 0; i <= 1024; i += gridSize) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1024); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke()
    }

    // Roads (lighter lines)
    ctx.strokeStyle = '#6a7a5a'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(0, 512); ctx.lineTo(1024, 512); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(512, 0); ctx.lineTo(512, 1024); ctx.stroke()

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(200, 200)

    const mat = new THREE.MeshLambertMaterial({ map: tex })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.receiveShadow = true
    this.mesh.position.y = 0
    scene.add(this.mesh)
  }
}
