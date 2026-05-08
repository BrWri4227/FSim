import * as THREE from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

const GEffectShader = {
  uniforms: {
    tDiffuse:    { value: null as THREE.Texture | null },
    uGLoad:      { value: 1.0 },
    uNegG:       { value: 0.0 }
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
    uniform float uGLoad;
    uniform float uNegG;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // G tunnel vignette — onset 4.5 G, full blackout at 9 G
      float vigRadius = clamp(1.0 - (uGLoad - 4.5) / 4.5, 0.1, 1.0);
      vec2 center = vUv - 0.5;
      float dist = length(center) / 0.707;  // normalise to corner = 1
      float vignette = smoothstep(vigRadius, vigRadius * 0.45, dist);
      color.rgb *= vignette;

      // Greyscale desaturation 7 G → 9 G
      float desat = clamp((uGLoad - 7.0) / 2.0, 0.0, 1.0);
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(color.rgb, vec3(lum), desat);

      // Negative-G redout
      if (uNegG > 0.0) {
        float redRadius = clamp(1.0 - uNegG * 0.4, 0.3, 1.0);
        float redVig = 1.0 - smoothstep(redRadius, redRadius * 0.5, dist);
        color.rgb = mix(color.rgb, vec3(color.r * 1.2, color.g * 0.2, color.b * 0.2), redVig * uNegG);
      }

      gl_FragColor = color;
    }
  `
}

export class GEffectPass extends ShaderPass {
  constructor() {
    super(GEffectShader)
  }

  setGLoad(g: number): void {
    this.uniforms['uGLoad']!.value = g
    // Negative-G redout: activate below -2G
    const negG = g < -2 ? Math.min((-g - 2) / 3, 1) : 0
    this.uniforms['uNegG']!.value = negG
  }
}
