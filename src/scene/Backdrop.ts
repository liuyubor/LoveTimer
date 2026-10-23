import * as THREE from 'three';
import { isMobile } from '../utils/three';

/**
 * 场景背景：一颗从内部观看的球体，用域扭曲的 FBM 噪声画出星云。
 * 不依赖任何贴图，颜色极暗，只负责给前景的心与星轨提供层次。
 */
export class Backdrop {
  readonly mesh: THREE.Mesh;
  private readonly uniforms: {
    uTime: { value: number };
  };

  constructor() {
    this.uniforms = { uTime: { value: 0 } };

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      // 移动端减一层噪声，星云的观感几乎不变，但省下约 1/4 的像素计算
      defines: isMobile() ? { MOBILE: 1 } : {},
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position.z = gl_Position.w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vDir;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float noise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(
              mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
              mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
              f.y
            ),
            mix(
              mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
              mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
              f.y
            ),
            f.z
          );
        }

        float fbm(vec3 p) {
          float v = 0.0;
          float a = 0.5;
          #ifdef MOBILE
          for (int i = 0; i < 3; i++) {
          #else
          for (int i = 0; i < 4; i++) {
          #endif
            v += a * noise(p);
            p = p * 2.03 + vec3(1.7, 9.2, 3.1);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 d = normalize(vDir);
          vec3 p = d * 2.4;
          float t = uTime * 0.012;

          vec3 warp = vec3(
            fbm(p + vec3(t, 0.0, 0.0)),
            fbm(p + vec3(4.2, t * 1.3, 1.7)),
            #ifdef MOBILE
            0.5
            #else
            fbm(p + vec3(0.0, 8.1, t * 0.7))
            #endif
          );

          float f = fbm(p * 1.8 + warp * 1.5);

          // 一条柔和的银河带，斜穿过画面
          float band = exp(-pow(abs(dot(d, normalize(vec3(0.15, 0.92, 0.32)))) * 3.2, 2.0));
          f = clamp(f * (0.55 + band * 0.9), 0.0, 1.0);

          vec3 deep = vec3(0.0045, 0.0025, 0.012);
          vec3 mid = vec3(0.040, 0.012, 0.085);
          vec3 warm = vec3(0.110, 0.040, 0.075);

          vec3 col = deep;
          col += mid * smoothstep(0.42, 0.98, f);
          col += warm * pow(smoothstep(0.62, 1.0, f), 2.0) * 0.85;

          // 画面中央的一点暖光，把视线拉向心
          float center = pow(max(dot(d, vec3(0.0, 0.0, -1.0)), 0.0), 7.0);
          col += vec3(0.045, 0.012, 0.022) * center;

          col *= 0.9 + 0.1 * band;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(60, 64, 48), material);
    this.mesh.renderOrder = -100;
    this.mesh.frustumCulled = false;
  }

  update(elapsed: number, dt: number): void {
    this.uniforms.uTime.value += dt;
    void elapsed;
  }
}
