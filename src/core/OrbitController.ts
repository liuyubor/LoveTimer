import * as THREE from 'three';

/**
 * 轻量的轨道控制：拖动旋转、滚轮缩放、静止后缓慢自转。
 * 没有引入 OrbitControls，是因为这里想要更克制的阻尼和更小的交互面积。
 */
export class OrbitController {
  yaw = -0.55;
  pitch = 0.04;
  targetYaw = -0.55;
  targetPitch = 0.04;

  /** 用户的滚轮缩放增量 */
  zoom = 0;
  private targetZoom = 0;

  /** 指针的归一化位置，用于视差 */
  readonly pointer = new THREE.Vector2();
  private readonly pointerSmooth = new THREE.Vector2();

  baseDistance = 9.6;
  autoRotate = true;

  dragging = false;
  movedDistance = 0;

  private lastX = 0;
  private lastY = 0;
  private lastInteract = performance.now();
  private readonly reducedMotion: boolean;

  constructor(reducedMotion = false) {
    this.reducedMotion = reducedMotion;
  }

  startDrag(x: number, y: number): void {
    this.dragging = true;
    this.movedDistance = 0;
    this.lastX = x;
    this.lastY = y;
    this.lastInteract = performance.now();
  }

  move(x: number, y: number): void {
    this.pointer.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);

    if (!this.dragging) return;

    const dx = x - this.lastX;
    const dy = y - this.lastY;
    this.lastX = x;
    this.lastY = y;
    this.movedDistance += Math.hypot(dx, dy);

    this.targetYaw += dx * 0.0045;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * 0.0028, -0.5, 0.5);
    this.lastInteract = performance.now();
  }

  endDrag(): void {
    this.dragging = false;
    this.lastInteract = performance.now();
  }

  onWheel(deltaY: number): void {
    this.targetZoom = THREE.MathUtils.clamp(this.targetZoom + deltaY * 0.0014, -2.2, 3.4);
    this.lastInteract = performance.now();
  }

  get distance(): number {
    return this.baseDistance + this.zoom;
  }

  get parallax(): THREE.Vector2 {
    return this.pointerSmooth;
  }

  update(dt: number): void {
    const idle = performance.now() - this.lastInteract > 3600;

    if (this.autoRotate && !this.dragging && idle && !this.reducedMotion) {
      this.targetYaw += dt * 0.075;
    }

    this.yaw = THREE.MathUtils.damp(this.yaw, this.targetYaw, 4.5, dt);
    this.pitch = THREE.MathUtils.damp(this.pitch, this.targetPitch, 4.5, dt);
    this.zoom = THREE.MathUtils.damp(this.zoom, this.targetZoom, 4, dt);

    this.pointerSmooth.x = THREE.MathUtils.damp(this.pointerSmooth.x, this.pointer.x, 3.2, dt);
    this.pointerSmooth.y = THREE.MathUtils.damp(this.pointerSmooth.y, this.pointer.y, 3.2, dt);
  }
}
