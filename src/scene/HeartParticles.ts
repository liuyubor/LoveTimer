import * as THREE from 'three';
import { sampleHeartParticle } from '../utils/heart';
import { isMobile } from '../utils/three';

/**
 * 心的星尘壳：几千个粒子贴着心形表面飘动。
 * 点击时 uBurst 会把它们向外推一下，像心跳震散了光。
 */
export class HeartParticles {
  readonly group = new THREE.Group();
  private readonly uniforms = {
    uTime: { value: 0 },
    uBurst: { value: 0 },
    uPixelRatio: { value: 1 },
    uOpacity: { value: 1 },
  };
  private burst = 0;

  constructor() {
    const count = isMobile() ? 1600 : 3400;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);

    const rose = new THREE.Color('#ff5f7e');
    const gold = new THREE.Color('#ffcf9a');
    const ivory = new THREE.Color('#fff4ee');
    const tmp = new THREE.Vector3();
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      sampleHeartParticle(tmp);

      positions[i * 3] = tmp.x;
      positions[i * 3 + 1] = tmp.y;
      positions[i * 3 + 2] = tmp.z;

      const h = THREE.MathUtils.clamp((tmp.y + 1.6) / 3.2, 0, 1);
      if (Math.random() < 0.1) {
        color.copy(ivory);
      } else {
        color.copy(rose).lerp(gold, h * 0.9);
      }
      color.multiplyScalar(0.8 + Math.random() * 0.8);

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = 0.6 + Math.random() * 0.8;
      seeds[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aSeed;
        uniform float uTime;
        uniform float uBurst;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec3 p = position;
          float s = aSeed * 6.2831853;
          p.x += sin(uTime * 0.65 + s) * 0.03;
          p.y += cos(uTime * 0.52 + s * 1.7) * 0.03;
          p.z += sin(uTime * 0.44 + s * 2.1) * 0.05;
          p *= 1.0 + uBurst * 0.34;

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (30.0 / max(0.001, -mv.z)) * (1.0 + uBurst * 1.1);
          gl_PointSize = clamp(gl_PointSize, 0.8, 10.0);

          vColor = aColor;
          vAlpha = 0.55 + 0.45 * sin(uTime * 1.3 + aSeed * 30.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          if (d > 0.5) discard;
          float alpha = pow(smoothstep(0.5, 0.0, d), 2.0);
          gl_FragColor = vec4(vColor * 1.3, alpha * (0.55 + 0.45 * vAlpha) * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.position.y = 0.55;

    this.group.add(points);
    this.group.rotation.x = -0.04;
  }

  burstOnce(): void {
    this.burst = 1;
  }

  setPixelRatio(ratio: number): void {
    this.uniforms.uPixelRatio.value = ratio;
  }

  /** 屏幕越小，星尘越密；适当降低不透明度，避免心被糊成一团光 */
  setIntensity(value: number): void {
    this.uniforms.uOpacity.value = value;
  }

  update(elapsed: number, dt: number): void {
    this.burst = Math.max(0, this.burst - dt * 1.6);
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uBurst.value = this.burst;
    this.group.rotation.y = -elapsed * 0.035;
  }
}
