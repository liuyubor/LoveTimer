import * as THREE from 'three';
import { config } from '../config';
import { Backdrop } from '../scene/Backdrop';
import { Heart } from '../scene/Heart';
import { HeartParticles } from '../scene/HeartParticles';
import { MemoryBeads } from '../scene/MemoryBeads';
import { PulseBurst } from '../scene/PulseBurst';
import { Starfield } from '../scene/Starfield';
import { TimeRings } from '../scene/TimeRings';
import { OrbitController } from './OrbitController';
import { PostFX } from './PostFX';
import { AudioEngine } from '../ui/Audio';
import { Hud, type HudData } from '../ui/Hud';
import {
  collectMoments,
  DAY_MS,
  getProgress,
  getStats,
  getTimeParts,
  nextAnniversary,
  parseDate,
} from '../utils/time';
import { isMobile, prefersReducedMotion } from '../utils/three';

/**
 * 把场景、后期、交互、HUD 串起来的地方。
 * 一切时间都来自 config.startDate，画面只是它的三次元投影。
 */
export class App {
  private readonly host: HTMLElement;
  private readonly start: Date;
  private readonly reducedMotion: boolean;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private post!: PostFX;

  private world!: THREE.Group;
  private backdrop!: Backdrop;
  private stars!: Starfield;
  private heart!: Heart;
  private particles!: HeartParticles;
  private rings!: TimeRings;
  private memories!: MemoryBeads;
  private burst!: PulseBurst;

  private orbit!: OrbitController;
  private hud!: Hud;
  private audio = new AudioEngine();

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly timer = new THREE.Timer();

  private hoveredBead: number | null = null;
  private latestDays = 0;
  private kick = 0;
  private intro = 3.2;
  private introStartedAt = 0;
  private lookY = 0.15;
  private cameraX = 0;
  private soundOn = false;
  private readonly stillMode = new URLSearchParams(window.location.search).has('still');
  private bound = false;

  private lastPointerX = 0;
  private lastBeatSound = 0;
  private lastPointerY = 0;

  constructor(host: HTMLElement) {
    this.host = host;
    this.start = new Date(config.startDate);
    this.reducedMotion = prefersReducedMotion();
  }

  async init(): Promise<void> {
    this.setupRenderer();
    this.setupScene();
    this.setupWorld();
    this.setupPost();
    this.setupUi();
    this.bindEvents();
    this.layout();

    this.timer.connect(document);
    if (this.stillMode) {
      this.orbit.autoRotate = false;
      this.intro = 0;
      this.introStartedAt = 0;
      this.camera.position.z = this.orbit.distance;
      this.camera.position.y = this.lookY;
      this.camera.position.x = this.cameraX;
      this.renderer.setAnimationLoop(this.tick);
      this.hud.setReady();
      window.setTimeout(() => {
        document.getElementById('loader')?.classList.add('is-hidden');
      }, 60);
      return;
    }

    this.renderer.setAnimationLoop(this.tick);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.hud.setReady();
        this.introStartedAt = performance.now();
        this.intro = 3.2;
      });
    });
  }

  private setupRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.setClearColor(0x05030b, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.setAttribute('aria-label', '会跳动的 3D 心与时间轨道');
    this.renderer.domElement.setAttribute('role', 'img');
    this.host.appendChild(this.renderer.domElement);
  }

  private setupScene(): void {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    this.camera.position.set(0, 0.15, 13.4);

    this.backdrop = new Backdrop();
    this.stars = new Starfield();
    this.scene.add(this.backdrop.mesh, this.stars.group);
  }

  private setupWorld(): void {
    this.world = new THREE.Group();
    this.world.position.y = 0.08;
    this.scene.add(this.world);

    this.heart = new Heart(this.reducedMotion);
    this.particles = new HeartParticles();
    this.rings = new TimeRings();

    const moments = collectMoments(this.start, new Date());
    this.memories = new MemoryBeads(moments);
    this.burst = new PulseBurst();

    this.world.add(
      this.heart.group,
      this.particles.group,
      this.rings.group,
      this.memories.group,
      this.burst.group,
    );
  }

  private setupPost(): void {
    this.post = new PostFX(this.renderer, this.scene, this.camera);
  }

  private setupUi(): void {
    this.orbit = new OrbitController(this.reducedMotion);
    this.hud = new Hud(this.start);

    if (window.matchMedia('(pointer: fine)').matches) {
      document.body.classList.add('has-fine-pointer');
    }

    document.getElementById('sound-toggle')?.addEventListener('click', () => {
      void this.toggleSound();
    });
    document.getElementById('ui-toggle')?.addEventListener('click', () => this.toggleUi());
    document.getElementById('moment-close')?.addEventListener('click', () => this.hud.hideMoment());
  }

  private bindEvents(): void {
    if (this.bound) return;
    this.bound = true;

    const canvas = this.renderer.domElement;

    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('pointerleave', () => this.hud.hideTooltip());

    window.addEventListener('resize', this.layout);
    window.addEventListener('orientationchange', this.layout);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.layout();
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.orbit.startDrag(event.clientX, event.clientY);
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    if (this.hoveredBead !== null) {
      this.memories.setHover(null);
      this.hoveredBead = null;
      this.hud.hideTooltip();
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.orbit.move(event.clientX, event.clientY);
    this.moveCursorGlow(event.clientX, event.clientY);

    if (this.orbit.dragging || event.pointerType !== 'mouse') return;

    const bead = this.pickBead(event.clientX, event.clientY);
    if (bead !== this.hoveredBead) {
      this.hoveredBead = bead;
      this.memories.setHover(bead);
      if (bead === null) {
        this.hud.hideTooltip();
      } else {
        const moment = this.memories.moments[bead];
        this.hud.showTooltip(moment, event.clientX, event.clientY);
      }
    } else if (bead !== null) {
      const moment = this.memories.moments[bead];
      this.hud.showTooltip(moment, event.clientX, event.clientY);
    }

    const overHeart = bead === null && this.pickHeart(event.clientX, event.clientY);
    document.body.classList.toggle('is-hovering', bead !== null || overHeart);
  };

  private onPointerUp = (event: PointerEvent): void => {
    const wasDragging = this.orbit.dragging;
    const moved = this.orbit.movedDistance;
    this.orbit.endDrag();

    if (!wasDragging) return;
    if (moved > 8) return;
    if (event.target !== this.renderer.domElement) return;

    this.handleTap(event.clientX, event.clientY);
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.orbit.onWheel(event.deltaY);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

    switch (event.key.toLowerCase()) {
      case 'h':
        event.preventDefault();
        this.toggleUi();
        break;
      case 'escape':
        if (this.hud.isMomentOpen()) this.hud.hideMoment();
        else if (this.hud.isUiHidden()) this.toggleUi();
        break;
      case ' ':
        event.preventDefault();
        this.celebrate();
        break;
      case 'm':
        void this.toggleSound();
        break;
      default:
        break;
    }
  };

  private onVisibility = (): void => {
    if (document.hidden) {
      this.renderer.setAnimationLoop(null);
    } else {
      this.timer.update();
      this.renderer.setAnimationLoop(this.tick);
    }
  };

  private handleTap(x: number, y: number): void {
    const bead = this.pickBead(x, y);
    if (bead !== null) {
      const moment = this.memories.moments[bead];
      const days = Math.floor((parseDate(moment.date).getTime() - this.start.getTime()) / DAY_MS) + 1;
      this.hud.showMoment(moment, days);
      this.memories.setHover(bead);
      return;
    }

    if (this.pickHeart(x, y)) {
      this.celebrate();
    }
  }

  private celebrate(): void {
    this.heart.pulse();
    this.particles.burstOnce();
    this.burst.emit();
    this.kick = 1;
    this.audio.thump(1);

    const notes = config.notes as readonly string[];
    const note = notes[Math.floor(Math.random() * notes.length)].replace('{days}', String(this.latestDays));
    this.hud.showNote(note);
  }

  private async toggleSound(): Promise<void> {
    this.soundOn = !this.soundOn;
    await this.audio.setEnabled(this.soundOn);
    this.hud.setSoundOn(this.soundOn);
  }

  private toggleUi(): void {
    this.hud.setUiHidden(!this.hud.isUiHidden());
  }

  private pickBead(x: number, y: number): number | null {
    this.pointerNdc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const hits = this.raycaster.intersectObjects(this.memories.pickables, false);
    if (hits.length > 0) {
      const index = hits[0].object.userData.momentIndex as number | undefined;
      return typeof index === 'number' ? index : null;
    }

    return null;
  }

  private pickHeart(x: number, y: number): boolean {
    this.pointerNdc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    return this.raycaster.intersectObject(this.heart.mesh, false).length > 0;
  }

  private moveCursorGlow(x: number, y: number): void {
    const cursor = document.getElementById('cursor');
    if (cursor) cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  private layout = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? 1.8 : 2);

    let fov = 42;
    let distance = 9.9;
    let scale = 1;
    let lookY = 0.15;
    let cameraX = 0;

    // 横屏手机：3D 场景靠左，文字靠右，避免大数字压在心形上
    if (height < 520 && aspect > 1.3) {
      fov = 42;
      distance = 9.9;
      scale = 0.66;
      lookY = 0.1;
      const visibleWidth = 2 * Math.tan((fov * Math.PI) / 360) * distance * aspect;
      cameraX = visibleWidth * 0.25;
    } else if (aspect < 0.75) {
      fov = 58;
      distance = 10.5;
      scale = 0.78;
      lookY = 0.3;
    } else if (aspect < 1.0) {
      fov = 52;
      distance = 10.2;
      scale = 0.86;
      lookY = 0.24;
    } else if (aspect < 1.3) {
      fov = 46;
      distance = 10.0;
      scale = 0.93;
      lookY = 0.2;
    }

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height);

    this.camera.aspect = aspect;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();

    this.post.setSize(width, height, dpr);
    this.world.scale.setScalar(scale);
    this.lookY = lookY;
    this.cameraX = cameraX;
    this.orbit.baseDistance = distance;
    this.stars.setPixelRatio(dpr);
    this.particles.setPixelRatio(dpr);
    this.particles.setIntensity(height < 520 && aspect > 1.3 ? 0.5 : 1);
    this.burst.setPixelRatio(dpr);
  };

  private tick = (): void => {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const elapsed = this.timer.getElapsed();

    const now = new Date();
    const parts = getTimeParts(this.start, now);
    const progress = getProgress(this.start, now);
    const stats = getStats(parts);
    const next = nextAnniversary(this.start, now);

    this.latestDays = parts.days;

    const data: HudData = { now, parts, progress, stats, next };
    this.hud.update(data);

    this.orbit.update(dt);
    const beat = this.heart.update(elapsed, dt);
    if (this.soundOn && beat > 1.15 && performance.now() - this.lastBeatSound > 700) {
      this.lastBeatSound = performance.now();
      this.audio.thump(0.16);
    }
    this.particles.update(elapsed, dt);
    this.rings.update(progress, elapsed);
    this.memories.update(elapsed, dt);
    this.burst.update(dt);
    this.stars.update(elapsed, dt);
    this.backdrop.update(elapsed, dt);

    if (this.introStartedAt > 0) {
      const t = Math.min(1, (performance.now() - this.introStartedAt) / 1700);
      this.intro = 3.2 * (1 - (1 - Math.pow(1 - t, 3)));
    }
    this.kick = Math.max(0, this.kick - dt * 3.2);

    const parallax = this.orbit.parallax;
    const targetZ = this.orbit.distance + this.intro * 0.85;
    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      this.cameraX + parallax.x * 0.5,
      2.6,
      dt,
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      this.lookY + parallax.y * 0.34,
      2.6,
      dt,
    );
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetZ, 2.4, dt);

    if (this.kick > 0) {
      this.camera.position.x += Math.sin(elapsed * 42) * 0.018 * this.kick;
      this.camera.position.y += Math.cos(elapsed * 38) * 0.014 * this.kick;
    }

    this.camera.lookAt(this.cameraX, this.lookY * 0.55, 0);

    this.world.rotation.y = this.orbit.yaw;
    this.world.rotation.x = this.orbit.pitch;

    this.post.render(elapsed);
  };
}
