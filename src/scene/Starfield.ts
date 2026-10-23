import * as THREE from 'three';
import { isMobile } from '../utils/three';

/**
 * 星海：一层远景恒星 + 一层近处尘埃。
 * 用自定义 shader 做闪烁与大小衰减，让画面有呼吸感。
 */
export class Starfield {
  readonly group = new THREE.Group();
  private readonly uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: 1 },
  };
  private readonly far: THREE.Points;
  private readonly dust: THREE.Points;

  constructor() {
    const mobile = isMobile();

    this.far = this.createLayer({
      count: mobile ? 2400 : 6000,
      innerRadius: 14,
      outerRadius: 42,
      sizeRange: [0.7, 2.3],
      opacity: 1,
    });

    this.dust = this.createLayer({
      count: mobile ? 320 : 700,
      innerRadius: 5.5,
      outerRadius: 13,
      sizeRange: [0.35, 0.9],
      opacity: 0.5,
    });

    this.group.add(this.far, this.dust);
  }

  private createLayer(opts: {
    count: number;
    innerRadius: number;
    outerRadius: number;
    sizeRange: [number, number];
    opacity: number;
  }): THREE.Points {
    const { count, innerRadius, outerRadius, sizeRange } = opts;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);

    const palette = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#ffd7e2'),
      new THREE.Color('#ffe7c8'),
      new THREE.Color('#c9e9ff'),
      new THREE.Color('#d5c8ff'),
    ];

    const v = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      // 球壳内的均匀分布
      const u = Math.random();
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = innerRadius + Math.pow(u, 0.65) * (outerRadius - innerRadius);

      v.setFromSphericalCoords(r, phi, theta);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;

      const color = palette[Math.floor(Math.random() * palette.length)].clone();
      const brightness = 0.35 + Math.random() * 0.85;
      color.multiplyScalar(brightness);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
      seeds[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        ...this.uniforms,
        uOpacity: { value: opts.opacity },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aSeed;
        uniform float uTime;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vTwinkle;

        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;

          float twinkle = 0.6 + 0.4 * sin(uTime * (0.5 + aSeed * 1.6) + aSeed * 40.0);
          gl_PointSize = aSize * uPixelRatio * (42.0 / max(0.001, -mv.z)) * (0.85 + 0.35 * twinkle);
          gl_PointSize = clamp(gl_PointSize, 0.7, 14.0);

          vColor = aColor;
          vTwinkle = twinkle;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vTwinkle;

        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, d);
          alpha = pow(alpha, 2.4);
          vec3 col = vColor * (0.85 + 0.55 * vTwinkle);
          gl_FragColor = vec4(col, alpha * vTwinkle * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  setPixelRatio(ratio: number): void {
    this.uniforms.uPixelRatio.value = ratio;
  }

  update(elapsed: number, dt: number): void {
    this.uniforms.uTime.value = elapsed;
    this.group.rotation.y += dt * 0.006;
    this.group.rotation.x = Math.sin(elapsed * 0.03) * 0.05;
    this.far.rotation.z += dt * 0.004;
  }
}
