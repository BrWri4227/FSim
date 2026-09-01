import * as THREE from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

/**
 * Screen-space G effects. Driven by the physiological {@link GLOCModel}, which
 * decides how much vision is lost from the accumulated G-time dose — this pass
 * only paints the result. All three inputs are normalised 0..1.
 */
const GEffectShader = {
  uniforms: {
    tDiffuse:  { value: null as THREE.Texture | null },
    uGreyout:  { value: 0.0 },  // peripheral dim + desaturation (leads the tunnel)
    uBlackout: { value: 0.0 },  // central tunnel-vision closure
    uRedout:   { value: 0.0 },  // negative-G redout
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uGreyout;
    uniform float uBlackout;
    uniform float uRedout;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      vec2 center = vUv - 0.5;
      float dist = length(center) / 0.707;  // normalise to corner = 1

      // Greyout — desaturate and gently dim, worst at the edges. Always leads
      // the blackout so peripheral vision fades before the tunnel closes.
      if (uGreyout > 0.0) {
        float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        float periph = mix(0.55, 1.0, dist);            // stronger toward the edge
        float g = clamp(uGreyout * periph, 0.0, 1.0);
        color.rgb = mix(color.rgb, vec3(lum), 0.85 * g);
        color.rgb *= mix(1.0, 0.72, uGreyout);
      }

      // Blackout — tunnel vignette. radius 1.15 (no effect) → 0.10 (full black).
      float vigRadius = mix(1.15, 0.10, uBlackout);
      float vignette = smoothstep(vigRadius, vigRadius * 0.45, dist);
      color.rgb *= vignette;

      // Negative-G redout — reddish wash closing from the edges.
      if (uRedout > 0.0) {
        float redRadius = mix(1.0, 0.30, uRedout);
        float redVig = 1.0 - smoothstep(redRadius, redRadius * 0.5, dist);
        vec3 red = vec3(color.r * 1.2 + 0.15, color.g * 0.2, color.b * 0.2);
        color.rgb = mix(color.rgb, red, redVig * uRedout);
      }

      gl_FragColor = color;
    }
  `
}

export interface GEffectInputs {
  greyout: number
  blackout: number
  redout: number
}

export class GEffectPass extends ShaderPass {
  constructor() {
    super(GEffectShader)
  }

  setEffect(e: GEffectInputs): void {
    this.uniforms['uGreyout']!.value  = e.greyout
    this.uniforms['uBlackout']!.value = e.blackout
    this.uniforms['uRedout']!.value   = e.redout
  }
}
