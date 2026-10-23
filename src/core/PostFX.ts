import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { isMobile } from '../utils/three';

/** 暗角 + 胶片颗粒 + 一点点色散，最后一道「冲印」工序 */
const FinishShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uGrain: { value: 0.028 },
    uAberration: { value: 0.9 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uGrain;
    uniform float uAberration;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 dir = vUv - 0.5;
      float r2 = dot(dir, dir);
      vec2 offset = dir * r2 * 0.012 * uAberration;

      vec3 col;
      col.r = texture2D(tDiffuse, vUv + offset).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - offset).b;

      // 暗角
      float vig = smoothstep(1.05, 0.32, length(dir) * 1.32);
      col *= mix(0.62, 1.0, vig);

      // 颗粒
      float grain = rand(vUv * uResolution + fract(uTime) * 137.0) - 0.5;
      col += grain * uGrain;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class PostFX {
  readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly finish: ShaderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: isMobile() ? 0 : 4,
    });

    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(size, 0.58, 0.7, 0.8);
    this.composer.addPass(this.bloom);

    // 先把线性色彩映射到 sRGB，再做颗粒与暗角
    this.composer.addPass(new OutputPass());

    this.finish = new ShaderPass(FinishShader);
    this.finish.uniforms.uGrain.value = isMobile() ? 0.018 : 0.028;
    this.composer.addPass(this.finish);
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.finish.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
    this.bloom.setSize(width * pixelRatio, height * pixelRatio);
  }

  render(elapsed: number): void {
    this.finish.uniforms.uTime.value = elapsed;
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
  }
}
