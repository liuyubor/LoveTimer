import * as THREE from 'three';
import { createHeartGeometry } from '../utils/heart';
import { createGlowTexture, createSprite } from '../utils/three';
import { palette } from '../config';

/**
 * 场景的主角：一颗半透明、会呼吸的心。
 * 核心是挤出几何 + 自定义 shader（菲涅尔边缘光、虹彩、心跳位移），
 * 外面再罩一层加色的光晕壳，最后点一颗背后的光斑。
 */
export class Heart {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;

  private readonly uniforms: {
    uTime: { value: number };
    uBeat: { value: number };
    uDeep: { value: THREE.Color };
    uRose: { value: THREE.Color };
    uGold: { value: THREE.Color };
    uIris: { value: THREE.Color };
  };
  private readonly auraUniforms: {
    uBeat: { value: number };
    uColor: { value: THREE.Color };
    uStrength: { value: number };
  };
  private readonly aura: THREE.Mesh;
  private readonly halo: THREE.Sprite;
  private impulse = 0;

  constructor(reducedMotion = false) {
    this.uniforms = {
      uTime: { value: 0 },
      uBeat: { value: 0 },
      uDeep: { value: new THREE.Color('#380616') },
      uRose: { value: new THREE.Color('#ff4a6e') },
      uGold: { value: new THREE.Color('#ffcf9a') },
      uIris: { value: new THREE.Color('#a98bff') },
    };

    const geometry = createHeartGeometry(5);

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        uniform float uBeat;
        varying vec3 vNormalV;
        varying vec3 vViewPos;
        varying vec3 vPos;

        void main() {
          vec3 p = position + normal * (uBeat * 0.035);
          vPos = p;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vViewPos = mv.xyz;
          vNormalV = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uBeat;
        uniform vec3 uDeep;
        uniform vec3 uRose;
        uniform vec3 uGold;
        uniform vec3 uIris;

        varying vec3 vNormalV;
        varying vec3 vViewPos;
        varying vec3 vPos;

        float hash(vec3 p) {
          return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        }

        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(
              mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
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
          for (int i = 0; i < 3; i++) {
            v += a * noise(p);
            p = p * 2.1 + vec3(1.3, 7.1, 4.7);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 N = normalize(vNormalV);
          vec3 V = normalize(-vViewPos);
          float ndv = clamp(dot(N, V), 0.0, 1.0);
          float fres = pow(1.0 - ndv, 2.4);

          // 从下到上的深酒红 → 玫瑰 → 暖金
          vec3 base = mix(uDeep, uRose, smoothstep(-1.6, 1.35, vPos.y));
          base = mix(base, uGold, smoothstep(0.35, 1.6, vPos.y) * 0.32);
          base *= 0.62 + 0.5 * smoothstep(-1.6, 1.3, vPos.y);

          // 薄膜虹彩
          float irid = 0.5 + 0.5 * sin(vPos.y * 5.2 + fres * 8.0 + uTime * 0.45);
          base = mix(base, uIris, irid * fres * 0.42);

          // 表面缓慢流动的纹理
          float n = fbm(vPos * 4.1 + vec3(0.0, uTime * 0.05, 0.0));
          base *= 0.9 + 0.2 * n;

          vec3 L = normalize(vec3(-0.45, 0.75, 0.65));
          vec3 H = normalize(L + V);
          float spec = pow(max(dot(N, H), 0.0), 88.0);
          float hotspot = pow(max(dot(N, H), 0.0), 260.0);

          vec3 L2 = normalize(vec3(0.7, -0.35, 0.5));
          vec3 H2 = normalize(L2 + V);
          float spec2 = pow(max(dot(N, H2), 0.0), 30.0);

          vec3 col = base;
          col += vec3(1.0, 0.86, 0.72) * spec * 0.35;
          col += vec3(1.0, 0.95, 0.9) * hotspot * 0.45;
          col += vec3(0.42, 0.78, 1.0) * spec2 * 0.3;

          // 伪环境反射：上方冷光 + 一条暖色地平线，让表面像玻璃而不是糖果
          vec3 R = reflect(-V, N);
          float up = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 env = mix(vec3(0.015, 0.008, 0.05), vec3(0.42, 0.17, 0.26), pow(up, 2.4));
          float horizon = exp(-pow((R.y - 0.1) * 4.5, 2.0));
          env += vec3(0.8, 0.5, 0.42) * horizon * 0.25;
          col += env * (0.3 + fres * 0.7) * 0.5;

          // 内部透出来的暖光
          col += uGold * pow(ndv, 3.5) * 0.16;

          // 边缘的呼吸光
          col += uRose * fres * (0.7 + uBeat * 1.5);
          col += uGold * pow(smoothstep(0.62, 1.0, n), 3.0) * 0.12;
          col += vec3(1.0, 0.55, 0.62) * uBeat * 0.16;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geometry, material);

    // 外发光壳
    this.auraUniforms = {
      uBeat: { value: 0 },
      uColor: { value: new THREE.Color(palette.rose) },
      uStrength: { value: 0.55 },
    };
    const auraMaterial = new THREE.ShaderMaterial({
      uniforms: this.auraUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vNormalV;
        varying vec3 vViewPos;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vViewPos = mv.xyz;
          vNormalV = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uStrength;
        uniform float uBeat;
        varying vec3 vNormalV;
        varying vec3 vViewPos;
        void main() {
          vec3 N = normalize(vNormalV);
          vec3 V = normalize(-vViewPos);
          float fres = pow(1.0 - abs(dot(N, V)), 3.0);
          float a = fres * uStrength * (0.8 + uBeat * 0.8);
          gl_FragColor = vec4(uColor * a * 2.2, a);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this.aura = new THREE.Mesh(geometry, auraMaterial);
    this.aura.scale.setScalar(1.045);

    // 背后的大光斑，让心从深空里浮起来
    this.halo = createSprite(palette.rose, 6.2, 0.08);
    this.halo.position.z = -3;

    this.group.add(this.halo, this.mesh, this.aura);
    this.group.position.y = 0.55;
    this.group.rotation.x = -0.04;

    if (reducedMotion) {
      this.uniforms.uBeat.value = 0.15;
    }
  }

  /** 点击一次，心跳更用力一点 */
  pulse(): void {
    this.impulse = 1;
  }

  update(elapsed: number, dt: number): number {
    // 1.15 秒一个心动周期，双峰模拟「咚—哒」
    const period = 1.15;
    const phase = (elapsed % period) / period;
    const b1 = Math.exp(-Math.pow(phase / 0.05, 2));
    const b2 = 0.55 * Math.exp(-Math.pow((phase - 0.13) / 0.065, 2));
    const beat = b1 + b2;

    this.impulse = Math.max(0, this.impulse - dt * 1.7);

    const pulse = beat + this.impulse * 1.5;
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uBeat.value = pulse;
    this.auraUniforms.uBeat.value = pulse;
    this.auraUniforms.uStrength.value = 0.5 + this.impulse * 0.55;

    const scale = 1 + beat * 0.03 + this.impulse * 0.065;
    this.mesh.scale.setScalar(scale);
    this.aura.scale.setScalar(scale * 1.045);

    this.group.rotation.y = Math.sin(elapsed * 0.32) * 0.16;
    this.group.rotation.z = Math.sin(elapsed * 0.21) * 0.025;
    this.group.position.y = 0.55 + Math.sin(elapsed * 0.7) * 0.035;

    return beat;
  }
}
