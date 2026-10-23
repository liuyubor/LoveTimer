import type { Moment } from '../config';
import { config } from '../config';
import {
  formatCompact,
  formatDot,
  parseDate,
  pad2,
  percent,
  WEEKDAYS,
  type AnniversaryCountdown,
  type Progress,
  type Stats,
  type TimeParts,
} from '../utils/time';
import { easeOutExpo } from '../utils/three';

export interface HudData {
  now: Date;
  parts: TimeParts;
  progress: Progress;
  stats: Stats;
  next: AnniversaryCountdown;
}

type SliceKey = keyof Progress;

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少 DOM 节点 #${id}`);
  return node as T;
}

/**
 * HUD 只做两件事：把时间写得好看，把交互状态收好。
 * 所有数字更新都限制在「秒变化」时发生，避免每帧写 DOM。
 */
export class Hud {
  private readonly daysEl = el('days');
  private readonly hoursEl = el('hours');
  private readonly minutesEl = el('minutes');
  private readonly secondsEl = el('seconds');
  private readonly dayIndexEl = el('day-index');
  private readonly weekdayEl = el('weekday');
  private readonly liveDateEl = el('live-date');
  private readonly liveClockEl = el('live-clock');
  private readonly nextDaysEl = el('next-days');
  private readonly nextDateEl = el('next-date');

  private readonly slices: Record<SliceKey, { slice: HTMLElement; value: HTMLElement }> = {
    year: { slice: el('slice-year'), value: el('slice-year-value') },
    month: { slice: el('slice-month'), value: el('slice-month-value') },
    day: { slice: el('slice-day'), value: el('slice-day-value') },
  };

  private readonly factBeats = el('fact-beats');
  private readonly factBreaths = el('fact-breaths');
  private readonly factSeasons = el('fact-seasons');

  private readonly noteEl = el('note-toast');
  private readonly tooltipEl = el('tooltip');
  private readonly tooltipDate = el('tooltip-date');
  private readonly tooltipTitle = el('tooltip-title');

  private readonly momentEl = el('moment-card');
  private readonly momentDate = el('moment-date');
  private readonly momentTitle = el('moment-title');
  private readonly momentNote = el('moment-note');
  private readonly momentDays = el('moment-days');

  private readonly soundButton = el<HTMLButtonElement>('sound-toggle');
  private readonly loader = el('loader');

  private lastSecond = -1;
  private noteTimer = 0;
  private countStart = 0;
  private lastDays = -1;

  constructor(private readonly start: Date) {
    el('since-label').textContent = config.kicker;
    el('fallback-days').textContent = '--';
  }

  update(data: HudData): void {
    const { now, parts, progress, stats, next } = data;

    this.updateCountUp(parts.days);

    if (now.getSeconds() === this.lastSecond) return;
    this.lastSecond = now.getSeconds();

    this.hoursEl.textContent = pad2(parts.hours);
    this.minutesEl.textContent = pad2(parts.minutes);
    this.secondsEl.textContent = pad2(parts.seconds);
    this.dayIndexEl.textContent = String(parts.days + 1);
    this.weekdayEl.textContent = WEEKDAYS[now.getDay()];

    this.liveDateEl.textContent = formatDot(now);
    this.liveClockEl.textContent = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;

    this.nextDaysEl.textContent = String(next.days);
    this.nextDateEl.textContent = formatDot(next.date);

    (Object.keys(progress) as SliceKey[]).forEach((key) => {
      const value = progress[key];
      const item = this.slices[key];
      item.slice.style.setProperty('--p', `${(value * 100).toFixed(2)}%`);
      item.value.textContent = percent(value);
    });

    this.factBeats.textContent = formatCompact(stats.heartbeats);
    this.factBreaths.textContent = formatCompact(stats.breaths);
    this.factSeasons.textContent = formatCompact(stats.seasons);
  }

  /** 首次进入时让天数从 0 滚上去，像计数器刚被点亮 */
  private updateCountUp(target: number): void {
    if (this.countStart === 0) {
      this.countStart = performance.now();
    }

    const t = Math.min(1, (performance.now() - this.countStart) / 1600);
    const value = t >= 1 ? target : Math.round(easeOutExpo(t) * target);
    if (value === this.lastDays) return;

    this.lastDays = value;
    this.daysEl.textContent = value.toLocaleString('zh-CN');
  }

  setReady(): void {
    document.body.classList.add('is-ready');
    window.setTimeout(() => this.loader.classList.add('is-hidden'), 420);
  }

  setSoundOn(on: boolean): void {
    document.body.classList.toggle('is-sound-on', on);
    this.soundButton.setAttribute('aria-pressed', String(on));
    this.soundButton.setAttribute('aria-label', on ? '关闭声音' : '开启声音');
    this.soundButton.setAttribute('title', on ? '关闭声音' : '开启声音');
  }

  showNote(text: string): void {
    this.noteEl.textContent = text;
    this.noteEl.classList.add('is-visible');
    window.clearTimeout(this.noteTimer);
    this.noteTimer = window.setTimeout(() => {
      this.noteEl.classList.remove('is-visible');
    }, 3600);
  }

  showTooltip(moment: Moment, x: number, y: number): void {
    this.tooltipDate.textContent = formatDot(parseDate(moment.date));
    this.tooltipTitle.textContent = moment.title;

    const clampedX = Math.min(window.innerWidth - 96, Math.max(96, x));
    const clampedY = Math.min(window.innerHeight - 50, Math.max(70, y));

    this.tooltipEl.style.left = `${clampedX}px`;
    this.tooltipEl.style.top = `${clampedY}px`;
    this.tooltipEl.classList.add('is-visible');
  }

  hideTooltip(): void {
    this.tooltipEl.classList.remove('is-visible');
  }

  showMoment(moment: Moment, daysTogether: number): void {
    this.momentDate.textContent = formatDot(parseDate(moment.date));
    this.momentTitle.textContent = moment.title;
    this.momentNote.textContent = moment.note ?? '这一天，值得被记住。';
    this.momentDays.textContent = `在一起的第 ${Math.max(1, daysTogether)} 天`;
    this.momentEl.classList.add('is-open');
    this.momentEl.setAttribute('aria-hidden', 'false');
    this.hideTooltip();
  }

  hideMoment(): void {
    this.momentEl.classList.remove('is-open');
    this.momentEl.setAttribute('aria-hidden', 'true');
  }

  isMomentOpen(): boolean {
    return this.momentEl.classList.contains('is-open');
  }

  setUiHidden(hidden: boolean): void {
    document.body.classList.toggle('is-ui-hidden', hidden);
  }

  isUiHidden(): boolean {
    return document.body.classList.contains('is-ui-hidden');
  }

  /** WebGL 不可用时的静态版本 */
  showFallback(days: number): void {
    el('fallback-days').textContent = days.toLocaleString('zh-CN');
    document.body.classList.add('is-fallback');
    this.loader.classList.add('is-hidden');
  }
}
