import * as THREE from 'three';
import { createHeartTexture, isMobile } from '../utils/three';
import { palette } from '../config';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

/**
 * 点击爱心时的爆发：一群小小的光心向外散开，
 * 外加一圈快速扩散的冲击波。
 */
export class PulseBurst {
  readonly group = new THREE.Group();

  private readonly particles: Particle[] = [];
  private readonly points: THREE.Points;
  private readonly positionAttr: THREE.BufferAttribute;
  private readonly alphaAttr: THREE.BufferAttribute;
  private readonly colorAttr: THREE.BufferAttribute;
  private readonly sizeAttr: THREE.BufferAttribute;
  private readonly shockwave: THREE.Mesh;
  private shockLife = 0;

  constructor() {
    const count = isMobile() ? 90 : 170;
    const rose = new THREE.Color(palette.rose);
    const gold = new THREE.Color(palette.gold);
    const ivory = new THREE.Color('#fff6f0');

    const positions = new Float32Array(count * 3);
    const alphas = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const color = Math.random() < 0.25 ? ivory : rose.clone().lerp(gold, Math.random());
      this.particles.push({
        position: new THREE.Vector3(0, 0.55, 0),
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 2 + Math.random() * 3,
        color,
      });
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = this.particles[i].size;
      positions[i * 3 + 1] = 9999;
    }

    const geometry = new THREE.BufferGeometry();
    this.positionAttr = new THREE.BufferAttribute(positions, 3);
    this.alphaAttr = new THREE.BufferAttribute(alphas, 1);
    this.colorAttr = new THREE.BufferAttribute(colors, 3);
    this.sizeAttr = new THREE.BufferAttribute(sizes, 1);
    geometry.setAttribute('position', this.positionAttr);
    geometry.setAttribute('aAlpha', this.alphaAttr);
    geometry.setAttribute('aColor', this.colorAttr);
    geometry.setAttribute('aSize', this.sizeAttr);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: createHeartTexture(128) },
        uPixelRatio: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute vec3 aColor;
        attribute float aSize;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (16.0 / max(0.001, -mv.z));
          gl_PointSize = clamp(gl_PointSize, 1.0, 26.0);
          vColor = aColor;
          vAlpha = aAlpha;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          if (tex.a < 0.01) discard;
          gl_FragColor = vec4(vColor * 1.5, tex.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;

    this.shockwave = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.47, 128),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(palette.rose),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.shockwave.position.set(0, 0.55, 0.4);

    this.group.add(this.points, this.shockwave);
  }

  setPixelRatio(ratio: number): void {
    (this.points.material as THREE.ShaderMaterial).uniforms.uPixelRatio.value = ratio;
  }

  emit(): void {
    const origin = new THREE.Vector3(0, 0.55, 0.3);
    for (const p of this.particles) {
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      );
      // 让大部分粒子留在心形的平面上
      dir.z *= 0.55;
      dir.normalize();

      p.position.copy(origin).addScaledVector(dir, Math.random() * 0.45);
      p.velocity.copy(dir).multiplyScalar(1.1 + Math.random() * 3.4);
      p.velocity.y += 0.45;
      p.maxLife = 1.1 + Math.random() * 1.4;
      p.life = p.maxLife;
    }

    this.shockLife = 1;
    this.shockwave.scale.setScalar(1);
    (this.shockwave.material as THREE.MeshBasicMaterial).opacity = 0.65;
  }

  update(dt: number): void {
    const positions = this.positionAttr.array as Float32Array;
    const alphas = this.alphaAttr.array as Float32Array;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.life <= 0) {
        alphas[i] = 0;
        positions[i * 3 + 1] = 9999;
        continue;
      }

      p.life -= dt;
      p.velocity.multiplyScalar(Math.pow(0.12, dt));
      p.velocity.y -= dt * 0.35;
      p.position.addScaledVector(p.velocity, dt);

      positions[i * 3] = p.position.x;
      positions[i * 3 + 1] = p.position.y;
      positions[i * 3 + 2] = p.position.z;
      alphas[i] = Math.max(0, p.life / p.maxLife) * Math.min(1, p.life * 2.2);
    }

    this.positionAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;

    if (this.shockLife > 0) {
      this.shockLife = Math.max(0, this.shockLife - dt * 1.35);
      const scale = 1 + (1 - this.shockLife) * 9;
      this.shockwave.scale.setScalar(scale);
      (this.shockwave.material as THREE.MeshBasicMaterial).opacity = this.shockLife * 0.5;
    }
  }
}
