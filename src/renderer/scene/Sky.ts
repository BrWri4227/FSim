import * as THREE from 'three'

export class Sky {
  private mesh: THREE.Mesh
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
    const geo = new THREE.SphereGeometry(180000, 32, 16)
    // No scale flip — BackSide renders interior facing the camera correctly

    // Gradient sky shader
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor:    { value: new THREE.Color(0x05103a) },
        horizonColor:{ value: new THREE.Color(0x3ab8f0) },
        groundColor: { value: new THREE.Color(0x355327) },
        offset:      { value: 500 },
        exponent:    { value: 0.45 },
        horizonBlend:{ value: 0.035 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 groundColor;
        uniform float offset;
        uniform float exponent;
        uniform float horizonBlend;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
          vec3 skyCol = mix(horizonColor, topColor, pow(max(h, 0.0), exponent));
          // Smoothly blend around the horizon to avoid a hard seam/line.
          float t = smoothstep(-horizonBlend, horizonBlend, h);
          vec3 col = mix(groundColor, skyCol, t);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,    // always render behind everything
      toneMapped: false,   // skip ACESFilmic so sky colours display as authored
    })

    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.renderOrder = -1   // draw first, before any opaque geometry
    scene.add(this.mesh)
  }

  /** Keep the sky dome centred on the camera so it never clips. */
  update(cameraPos: THREE.Vector3): void {
    this.mesh.position.copy(cameraPos)
  }

  dispose(): void {
    this.scene.remove(this.mesh)
    ;(this.mesh.material as THREE.ShaderMaterial).dispose()
    this.mesh.geometry.dispose()
  }
}
