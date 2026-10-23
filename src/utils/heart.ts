import * as THREE from 'three';

/**
 * 心形的隐函数（Taubin surface）：
 *   (x² + 9/4·y² + z² − 1)³ − x²z³ − 9/80·y²z³ = 0
 * 其中 z 轴向上、y 轴是厚度。它比二维轮廓挤出的心更饱满，
 * 而且从原点出发的每条射线只与曲面相交一次，适合用球面方向求半径。
 */

/** 隐函数坐标里，心的几何中心在 z 方向上的偏移 */
const CENTER_Z = 0.1245;
/** 隐函数单位 → 场景单位 */
export const HEART_SCALE = 1.42;

function implicitF(x: number, y: number, z: number): number {
  const a = x * x + 2.25 * y * y + z * z - 1;
  return a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z;
}

/**
 * 沿单位方向求心形表面的半径。
 * 三个参数是 three.js 的坐标 (x, y=上, z=厚)，
 * 内部会换成隐函数的 (x, y=厚, z=上)。
 */
export function solveHeartRadius(dx: number, dy: number, dz: number): number {
  // 隐函数坐标
  const ix = dx;
  const iy = dz;
  const iz = dy;

  let lo = 0.02;
  let hi = 2.0;

  for (let i = 0; i < 42; i++) {
    const mid = (lo + hi) * 0.5;
    if (implicitF(ix * mid, iy * mid, iz * mid) < 0) lo = mid;
    else hi = mid;
  }

  return (lo + hi) * 0.5;
}

/** 解析法线：隐函数梯度，永远比三角面法线光滑 */
function implicitGradient(
  x: number,
  y: number,
  z: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const a = x * x + 2.25 * y * y + z * z - 1;
  const a2 = a * a;
  const z3 = z * z * z;

  const gx = 6 * x * a2 - 2 * x * z3;
  const gy = 13.5 * y * a2 - 0.225 * y * z3;
  const gz = 6 * z * a2 - 3 * x * x * z * z - 0.3375 * y * y * z * z;

  return out.set(gx, gz, gy);
}

/** 把一个单位方向映射到心形表面上的点（three.js 坐标，已缩放居中） */
export function heartSurfacePoint(
  direction: THREE.Vector3,
  out = new THREE.Vector3(),
  shell = 1,
): THREE.Vector3 {
  const r = solveHeartRadius(direction.x, direction.y, direction.z);
  const ix = direction.x * r;
  const iy = direction.z * r;
  const iz = direction.y * r;

  return out
    .set(ix * HEART_SCALE, (iz - CENTER_Z) * HEART_SCALE, iy * HEART_SCALE)
    .multiplyScalar(shell);
}

/** 表面法线（three.js 坐标，已归一化） */
export function heartSurfaceNormal(
  direction: THREE.Vector3,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const r = solveHeartRadius(direction.x, direction.y, direction.z);
  const ix = direction.x * r;
  const iy = direction.z * r;
  const iz = direction.y * r;

  implicitGradient(ix, iy, iz, out);
  if (out.lengthSq() < 1e-8) out.set(direction.x, direction.y, direction.z);
  return out.normalize();
}

/**
 * 用 icosphere 的顶点方向逐点求半径，得到一张光滑的心形网格。
 * detail=5 → 20480 个三角面，对一颗心来说足够细腻。
 */
export function createHeartGeometry(detail = 5): THREE.BufferGeometry {
  const source = new THREE.IcosahedronGeometry(1, detail);
  const input = source.attributes.position as THREE.BufferAttribute;
  const count = input.count;

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);

  const dir = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    dir.fromBufferAttribute(input, i).normalize();

    const r = solveHeartRadius(dir.x, dir.y, dir.z);
    const ix = dir.x * r;
    const iy = dir.z * r;
    const iz = dir.y * r;

    positions[i * 3] = ix * HEART_SCALE;
    positions[i * 3 + 1] = (iz - CENTER_Z) * HEART_SCALE;
    positions[i * 3 + 2] = iy * HEART_SCALE;

    implicitGradient(ix, iy, iz, n);
    if (n.lengthSq() < 1e-8) n.set(dir.x, dir.y, dir.z);
    n.normalize();

    normals[i * 3] = n.x;
    normals[i * 3 + 1] = n.y;
    normals[i * 3 + 2] = n.z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  source.dispose();
  return geometry;
}

/** 在球面上均匀取一个方向 */
export function randomDirection(out = new THREE.Vector3()): THREE.Vector3 {
  const u = Math.random() * 2 - 1;
  const phi = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return out.set(s * Math.cos(phi), u, s * Math.sin(phi));
}

/**
 * 供粒子使用：大部分粒子聚在心的轮廓附近（法线朝向屏幕边缘的方向），
 * 形成一圈发光的粉尘轮廓；少量粒子散在远处做星尘。
 */
export function sampleHeartParticle(out = new THREE.Vector3()): THREE.Vector3 {
  const dir = randomDirection(new THREE.Vector3());
  const normal = new THREE.Vector3();
  const roll = Math.random();

  if (roll < 0.18) {
    // 远离表面的星尘
    return heartSurfacePoint(dir, out, 1.12 + Math.random() * 0.45);
  }

  if (roll < 0.57) {
    // 贴着表面的细碎星点
    heartSurfacePoint(dir, out, 1.0 + Math.random() * 0.04);
    out.x += (Math.random() - 0.5) * 0.03;
    out.y += (Math.random() - 0.5) * 0.03;
    out.z += (Math.random() - 0.5) * 0.03;
    return out;
  }

  // 在 5 个随机方向里挑最"侧面"的那个，让粒子沿轮廓聚成光边
  let bestDir = dir;
  let bestGrazing = 1;
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? dir : randomDirection(new THREE.Vector3());
    heartSurfaceNormal(candidate, normal);
    const grazing = Math.abs(normal.z);
    if (grazing < bestGrazing) {
      bestGrazing = grazing;
      bestDir = candidate;
    }
  }

  heartSurfacePoint(bestDir, out, 1.0 + Math.random() * 0.05);
  out.x += (Math.random() - 0.5) * 0.02;
  out.y += (Math.random() - 0.5) * 0.02;
  out.z += (Math.random() - 0.5) * 0.02;
  return out;
}
