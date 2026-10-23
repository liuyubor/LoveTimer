import * as THREE from 'three';
import type { Moment } from '../config';
import { palette } from '../config';
import { createSprite } from '../utils/three';

interface Bead {
  root: THREE.Group;
  core: THREE.Mesh;
  glow: THREE.Sprite;
  phase: number;
  baseY: number;
  hovered: boolean;
}

/**
 * 记忆星座：把每个纪念日变成宇宙里的一颗星。
 * 星点之间用一条极淡的曲线相连，悬停可读，点击展开卡片。
 */
export class MemoryBeads {
  readonly group = new THREE.Group();
  readonly pickables: THREE.Mesh[] = [];
  readonly moments: Moment[];

  private readonly beads: Bead[] = [];
  private readonly colors = [palette.gold, palette.rose, palette.cyan, palette.violet];

  constructor(moments: Moment[]) {
    this.moments = moments.slice(0, 9);
    const count = this.moments.length;
    if (count === 0) return;

    const points: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (i / count) * Math.PI * 2 + 0.18;
      const radius = 3.0 + (i % 2) * 0.32;
      const y = Math.sin(i * 1.9) * 1.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * 0.78;

      const root = new THREE.Group();
      root.position.set(x, y, z);

      const color = new THREE.Color(this.colors[i % this.colors.length]);

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 16, 12),
        new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.5), toneMapped: false }),
      );

      const glow = createSprite(this.colors[i % this.colors.length], 0.14, 0.4);

      // 不可见的拾取球，让星点更容易被指到
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.visible = false;
      hit.userData.momentIndex = i;
      this.pickables.push(hit);

      root.add(core, glow, hit);
      this.group.add(root);

      this.beads.push({
        root,
        core,
        glow,
        phase: i * 1.37,
        baseY: y,
        hovered: false,
      });
      points.push(new THREE.Vector3(x, y, z));
    }

    // 串联成星座
    if (points.length > 2) {
      const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.28);
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(260));
      const line = new THREE.Line(
        lineGeometry,
        new THREE.LineBasicMaterial({
          color: new THREE.Color(palette.gold),
          transparent: true,
          opacity: 0.1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      this.group.add(line);
    }
  }

  setHover(index: number | null): void {
    this.beads.forEach((bead, i) => {
      bead.hovered = index === i;
    });
  }

  update(elapsed: number, dt: number): void {
    for (const bead of this.beads) {
      bead.root.position.y = bead.baseY + Math.sin(elapsed * 0.55 + bead.phase) * 0.055;

      const target = bead.hovered ? 1.9 : 1;
      const scale = THREE.MathUtils.damp(bead.core.scale.x, target, 7, dt);
      bead.core.scale.setScalar(scale);
      bead.glow.scale.setScalar(0.14 * (bead.hovered ? 3.2 : 1) * (1 + Math.sin(elapsed * 2 + bead.phase) * 0.1));

      const glowMaterial = bead.glow.material as THREE.SpriteMaterial;
      glowMaterial.opacity = THREE.MathUtils.damp(
        glowMaterial.opacity,
        bead.hovered ? 1 : 0.45,
        8,
        dt,
      );

      bead.core.rotation.y += dt * 0.4;
    }
  }
}
