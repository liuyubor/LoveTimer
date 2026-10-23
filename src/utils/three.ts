import * as THREE from 'three';

/** 软圆点贴图：粒子与光晕都靠它，避免加载任何外部资源 */
export function createGlowTexture(size = 128, stops: Array<[number, string]> = [
  [0, 'rgba(255,255,255,1)'],
  [0.35, 'rgba(255,255,255,0.55)'],
  [1, 'rgba(255,255,255,0)'],
]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 心形粒子贴图。颜色由 vertexColors 决定，这里只画白色形状。 */
export function createHeartTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  const s = size / 32;

  ctx.translate(c, c + size * 0.06);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(0, 2, -3, -2, -8, -2);
  ctx.bezierCurveTo(-14, -2, -16, 4, -16, 7);
  ctx.bezierCurveTo(-16, 13, -10, 18, 0, 24);
  ctx.bezierCurveTo(10, 18, 16, 13, 16, 7);
  ctx.bezierCurveTo(16, 4, 14, -2, 8, -2);
  ctx.bezierCurveTo(3, -2, 0, 2, 0, 6);
  ctx.closePath();

  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = size * 0.08;
  ctx.fillStyle = '#fff';
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSprite(
  color: string,
  scale: number,
  opacity = 1,
): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: createGlowTexture(64),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(scale);
  return sprite;
}

/** 帧率无关的指数阻尼 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

export function isMobile(): boolean {
  return window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 线性插值 + 缓动，用于数字滚动 */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
