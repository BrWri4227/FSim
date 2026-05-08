import * as THREE from 'three'

export class Sky {
  private mesh: THREE.Mesh

  constructor(scene: THREE.Scene) {
    const geo = new THREE.SphereGeometry(180000, 32, 16)
    geo.scale(-1, 1, 1) // invert normals

    // Gradient sky shader
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor:    { value: new THREE.Color(0x0a1a3a) },
        horizonColor:{ value: new THREE.Color(0x87b8d8) },
        groundColor: { value: new THREE.Color(0x1a2a10) },
        offset:      { value: 400 },
        exponent:    { value: 0.6 },
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
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
          vec3 col;
          if (h > 0.0) {
            col = mix(horizonColor, topColor, pow(max(h, 0.0), exponent));
          } else {
            col = groundColor;
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    })

    this.mesh = new THREE.Mesh(geo, mat)
    scene.add(this.mesh)
  }
}
