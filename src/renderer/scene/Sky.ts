import * as THREE from 'three'

const SUN_DIR = new THREE.Vector3(50000, 80000, -20000).normalize()

export class Sky {
  private mesh: THREE.Mesh
  private scene: THREE.Scene
  private readonly mat: THREE.ShaderMaterial

  constructor(scene: THREE.Scene) {
    this.scene = scene
    const geo = new THREE.SphereGeometry(180000, 32, 16)

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor:     { value: new THREE.Color(0x061030) },
        midColor:     { value: new THREE.Color(0x2a90d0) },
        horizonColor: { value: new THREE.Color(0x5ac8e8) },
        groundColor:  { value: new THREE.Color(0x324822) },
        sunDir:       { value: SUN_DIR.clone() },
        sunColor:     { value: new THREE.Color(1.0, 0.95, 0.75) },
        sunHaloColor: { value: new THREE.Color(0.95, 0.65, 0.35) },
        exponent:     { value: 0.5 },
        horizonBlend: { value: 0.04 },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3  topColor;
        uniform vec3  midColor;
        uniform vec3  horizonColor;
        uniform vec3  groundColor;
        uniform vec3  sunDir;
        uniform vec3  sunColor;
        uniform vec3  sunHaloColor;
        uniform float exponent;
        uniform float horizonBlend;
        varying vec3  vWorldDir;

        void main() {
          vec3 d = normalize(vWorldDir);
          float h = d.y;  // -1 = nadir, +1 = zenith

          // Sky gradient: ground → horizon → mid → top
          float t = smoothstep(-horizonBlend, horizonBlend, h);
          vec3 skyCol = mix(horizonColor, topColor, pow(max(h, 0.0), exponent));
          // Warm the horizon toward the sun azimuth
          float sunAz = max(0.0, dot(normalize(vec3(sunDir.x, 0.0, sunDir.z)),
                                     normalize(vec3(d.x, 0.0, d.z))));
          vec3 warmHorizon = mix(horizonColor, vec3(0.95, 0.7, 0.45), sunAz * 0.35);
          skyCol = mix(warmHorizon, skyCol, clamp(h * 4.0 + 0.3, 0.0, 1.0));

          // Sun halo and disc
          float sunDot = dot(d, sunDir);
          float halo   = smoothstep(0.92, 0.97, sunDot);
          float disc   = smoothstep(0.997, 1.0,  sunDot);
          skyCol = mix(skyCol, sunHaloColor, halo * 0.6);
          skyCol = mix(skyCol, sunColor,     disc);

          // Blend to ground color below horizon
          vec3 col = mix(groundColor, skyCol, t);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    })

    this.mesh = new THREE.Mesh(geo, this.mat)
    this.mesh.renderOrder = -1
    scene.add(this.mesh)
  }

  update(cameraPos: THREE.Vector3): void {
    this.mesh.position.copy(cameraPos)
  }

  dispose(): void {
    this.scene.remove(this.mesh)
    this.mat.dispose()
    this.mesh.geometry.dispose()
  }
}
