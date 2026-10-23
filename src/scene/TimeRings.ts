import * as THREE from 'three';
import type { Progress } from '../utils/time';
import { createSprite } from '../utils/three';
import { palette } from '../config';

interface RingConfig {
  key: keyof Progress;
  radius: number;
  color: string;
  ticks: number;
  tilt: [number, number, number];
  spin: number;
  z: number;
}

/**
 * 年 / 月 / 日 三条时间轨道。
 * 每条轨道都是一圈进度弧 + 刻度环 + 一颗领路的星。
 * 年轨道近乎竖直，像一枚光环；月、日轨道倾斜环绕，构成一座浑天仪。
 */
export class TimeRings {
  readonly group = new THREE.Group();
  private readonly rings: Array<{
    config: RingConfig;
    group: THREE.Group;
    arcUniforms: { uProgress: { value: number }; uTime: { value: number }; uColor: { value: THREE.Color } };
    bead: THREE.Mesh;
    glow: THREE.Sprite;
    baseTiltZ: number;
  }> = [];

  constructor() {
    const configs: RingConfig[] = [
      {
        key: 'year',
        radius: 3.5,
        color: '#ffd6a5',
        ticks: 12,
        tilt: [0.14, 0.26, -0.2],
        spin: 0.012,
        z: -0.9,
      },
      {
        key: 'month',
        radius: 3.08,
        color: '#ff8fa5',
        ticks: 30,
        tilt: [0.66, 0.18, -0.5],
        spin: -0.016,
        z: -0.15,
      },
      {
        key: 'day',
        radius: 2.72,
        color: '#9fe8ff',
        ticks: 24,
        tilt: [0.5, -0.2, 0.34],
        spin: 0.02,
        z: 0.22,
      },
    ];

    for (const config of configs) this.addRing(config);
  }

  private addRing(config: RingConfig): void {
    const group = new THREE.Group();
    group.rotation.set(...config.tilt);
    group.position.z = config.z;

    const color = new THREE.Color(config.color);

    // 轨道底环 + 刻度
    const track = new THREE.Mesh(
      new THREE.TorusGeometry(config.radius, 0.0055, 4, 320),
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: color },
          uTicks: { value: config.ticks },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uTicks;
          varying vec2 vUv;

          void main() {
            float f = fract(vUv.x * uTicks);
            float tick = 1.0 - smoothstep(0.0, 0.045, min(f, 1.0 - f));
            float alpha = 0.04 + tick * 0.1;
            gl_FragColor = vec4(uColor * (0.55 + tick * 0.9), alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );

    // 进度弧
    const arcUniforms = {
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uColor: { value: color },
    };
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(config.radius, 0.0075, 6, 400),
      new THREE.ShaderMaterial({
        uniforms: arcUniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uProgress;
          uniform float uTime;
          uniform vec3 uColor;
          varying vec2 vUv;

          void main() {
            if (vUv.x > uProgress) discard;

            float head = smoothstep(uProgress - 0.018, uProgress, vUv.x);
            float tail = smoothstep(0.0, 0.05, vUv.x);
            float shimmer = 0.86 + 0.14 * sin(uTime * 2.2 - vUv.x * 24.0);

            vec3 col = mix(uColor, vec3(1.0), head * 0.85);
            col *= (0.62 + head * 2.1) * shimmer;

            gl_FragColor = vec4(col, 0.32 + head * 0.68) * (0.5 + tail * 0.5);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );

    // 轨道头部的领路星
    const bead = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 12),
      new THREE.MeshBasicMaterial({
        color: color.clone().multiplyScalar(1.4),
        toneMapped: false,
      }),
    );

    const glow = createSprite(config.color, 0.38, 0.75);
    glow.position.copy(bead.position);

    group.add(track, arc, bead, glow);
    this.group.add(group);

    this.rings.push({
      config,
      group,
      arcUniforms,
      bead,
      glow,
      baseTiltZ: config.tilt[2],
    });
  }

  update(progress: Progress, elapsed: number): void {
    for (const ring of this.rings) {
      const p = THREE.MathUtils.clamp(progress[ring.config.key], 0, 1);
      ring.arcUniforms.uProgress.value = p;
      ring.arcUniforms.uTime.value = elapsed;

      const angle = p * Math.PI * 2;
      const r = ring.config.radius;
      ring.bead.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
      ring.glow.position.copy(ring.bead.position);

      // 缓慢自转，让轨道活起来；头部星点会跟着走
      ring.group.rotation.z = ring.baseTiltZ + elapsed * ring.config.spin;

      const pulse = 1 + Math.sin(elapsed * 2.4 + r) * 0.12;
      ring.glow.scale.setScalar(0.38 * pulse);
    }
  }
}
