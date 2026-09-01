import * as THREE from 'three'
import { getWeather, type CloudCover } from '../physics/WeatherState'
import type { TimeOfDayConfig } from './TimeOfDay'

const SUN_DIR = new THREE.Vector3(50000, 80000, -20000).normalize()

const CLOUD_AMOUNT: Record<CloudCover, number> = {
  CLEAR: 0.12,
  SCATTERED: 0.42,
  BROKEN: 0.7,
  OVERCAST: 0.97,
}

export class Sky {
  private mesh: THREE.Mesh
  private scene: THREE.Scene
  private readonly mat: THREE.ShaderMaterial
  private readonly startMs = (typeof performance !== 'undefined' ? performance.now() : 0)
  private readonly stars: THREE.Points
  private readonly starMat: THREE.PointsMaterial

  constructor(scene: THREE.Scene) {
    this.scene = scene
    const geo = new THREE.SphereGeometry(180000, 48, 24)

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor:     { value: new THREE.Color(0x0a2b6b) },
        highColor:    { value: new THREE.Color(0x1f6fc4) },
        midColor:     { value: new THREE.Color(0x5aa8dc) },
        horizonColor: { value: new THREE.Color(0x9fd0e6) },
        groundColor:  { value: new THREE.Color(0x223417) },
        sunDir:       { value: SUN_DIR.clone() },
        sunColor:     { value: new THREE.Color(1.0, 0.96, 0.82) },
        sunHaloColor: { value: new THREE.Color(1.0, 0.78, 0.5) },
        cloudColor:   { value: new THREE.Color(0.96, 0.97, 1.0) },
        cloudAmount:  { value: CLOUD_AMOUNT[getWeather().cloudCover] },
        uTime:        { value: 0 },
        exponent:     { value: 0.55 },
        horizonBlend: { value: 0.045 },
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
        uniform vec3  highColor;
        uniform vec3  midColor;
        uniform vec3  horizonColor;
        uniform vec3  groundColor;
        uniform vec3  sunDir;
        uniform vec3  sunColor;
        uniform vec3  sunHaloColor;
        uniform vec3  cloudColor;
        uniform float cloudAmount;
        uniform float uTime;
        uniform float exponent;
        uniform float horizonBlend;
        varying vec3  vWorldDir;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 345.45));
          p += dot(p, p + 34.345);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 5; i++) {
            v += amp * noise(p);
            p = p * 2.03 + 1.7;
            amp *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 d = normalize(vWorldDir);
          float h = d.y;  // -1 nadir, +1 zenith

          // Multi-stop vertical gradient
          float g = pow(max(h, 0.0), exponent);
          vec3 skyCol = horizonColor;
          skyCol = mix(skyCol, midColor,  smoothstep(0.0, 0.28, g));
          skyCol = mix(skyCol, highColor, smoothstep(0.22, 0.6, g));
          skyCol = mix(skyCol, topColor,  smoothstep(0.55, 1.0, g));

          // Warm the sky toward the sun azimuth near the horizon
          float sunAz = max(0.0, dot(normalize(vec3(sunDir.x, 0.0, sunDir.z)),
                                     normalize(vec3(d.x, 0.0, d.z))));
          vec3 warm = mix(horizonColor, vec3(1.0, 0.72, 0.46), sunAz * 0.4);
          skyCol = mix(warm, skyCol, clamp(h * 3.5 + 0.28, 0.0, 1.0));

          // Procedural cloud sheet, projected onto a virtual layer
          float dy = max(d.y, 0.05);
          vec2 cuv = d.xz / dy;
          cuv = cuv * 1.4 + vec2(uTime * 0.008, uTime * 0.003);
          float clouds = fbm(cuv);
          float coverage = mix(0.62, 0.18, cloudAmount);
          float cloudMask = smoothstep(coverage, coverage + 0.28, clouds);
          cloudMask *= smoothstep(0.03, 0.22, d.y);          // fade into the haze
          float shade = 0.55 + 0.45 * fbm(cuv * 2.1 + 5.0);  // puffy internal shading
          vec3 lit = mix(cloudColor * 0.72, cloudColor, shade);
          lit = mix(lit, sunHaloColor, sunAz * 0.25);
          skyCol = mix(skyCol, lit, cloudMask * clamp(cloudAmount * 1.3, 0.0, 1.0));

          // Sun halo and disc
          float sunDot = dot(d, sunDir);
          float halo   = smoothstep(0.90, 0.9975, sunDot);
          float disc   = smoothstep(0.9985, 0.9995, sunDot);
          skyCol = mix(skyCol, sunHaloColor, halo * 0.5);
          skyCol = mix(skyCol, sunColor,     disc);

          // Blend to hazy ground below the horizon
          float t = smoothstep(-horizonBlend, horizonBlend, h);
          vec3 hazyGround = mix(groundColor, horizonColor, 0.35);
          vec3 col = mix(hazyGround, skyCol, t);

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

    // ── Star field (only visible at dusk / night, driven by starOpacity) ──────
    const STAR_COUNT = 1400
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(STAR_COUNT * 3)
    for (let i = 0; i < STAR_COUNT; i++) {
      // Uniform points on a hemisphere-biased sphere (skip the lowest band).
      const u = Math.random() * 2 - 1
      const theta = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.max(0, 1 - u * u))
      const y = Math.abs(u) * 0.9 + 0.05
      starPos[i * 3]     = Math.cos(theta) * r * 150000
      starPos[i * 3 + 1] = y * 150000
      starPos[i * 3 + 2] = Math.sin(theta) * r * 150000
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    this.starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 700,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })
    this.stars = new THREE.Points(starGeo, this.starMat)
    this.stars.renderOrder = -0.9
    this.stars.visible = false
    scene.add(this.stars)
  }

  update(cameraPos: THREE.Vector3): void {
    this.mesh.position.copy(cameraPos)
    this.stars.position.copy(cameraPos)
    const nowMs = (typeof performance !== 'undefined' ? performance.now() : 0)
    this.mat.uniforms.uTime!.value = (nowMs - this.startMs) / 1000
  }

  /** Re-read cloud cover after a weather change. */
  refresh(): void {
    this.mat.uniforms.cloudAmount!.value = CLOUD_AMOUNT[getWeather().cloudCover]
  }

  /** Apply a time-of-day lighting preset to the sky gradient, sun and stars. */
  applyTimeOfDay(cfg: TimeOfDayConfig): void {
    const u = this.mat.uniforms
    ;(u.topColor!.value as THREE.Color).setHex(cfg.sky.top)
    ;(u.highColor!.value as THREE.Color).setHex(cfg.sky.high)
    ;(u.midColor!.value as THREE.Color).setHex(cfg.sky.mid)
    ;(u.horizonColor!.value as THREE.Color).setHex(cfg.sky.horizon)
    ;(u.groundColor!.value as THREE.Color).setHex(cfg.sky.ground)
    ;(u.sunColor!.value as THREE.Color).setHex(cfg.sky.sun)
    ;(u.sunHaloColor!.value as THREE.Color).setHex(cfg.sky.sunHalo)
    ;(u.sunDir!.value as THREE.Vector3)
      .set(cfg.sunDirThree[0], cfg.sunDirThree[1], cfg.sunDirThree[2])
      .normalize()
    this.starMat.opacity = cfg.starOpacity
    this.stars.visible = cfg.starOpacity > 0.001
  }

  dispose(): void {
    this.scene.remove(this.mesh)
    this.scene.remove(this.stars)
    this.mat.dispose()
    this.mesh.geometry.dispose()
    this.stars.geometry.dispose()
    this.starMat.dispose()
  }
}
