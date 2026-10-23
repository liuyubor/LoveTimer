import { config, type Moment } from '../config';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export interface TimeParts {
  totalMs: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface Progress {
  /** 当前这一年的进度（从上一个周年到下一个周年） */
  year: number;
  /** 当前自然月的进度 */
  month: number;
  /** 今天的进度 */
  day: number;
}

/** 把两个时间点之间的差值拆成天 / 时 / 分 / 秒 */
export function getTimeParts(start: Date, now: Date): TimeParts {
  const totalMs = Math.max(0, now.getTime() - start.getTime());
  const totalDays = Math.floor(totalMs / DAY_MS);
  const totalHours = Math.floor(totalMs / HOUR_MS);
  const totalMinutes = Math.floor(totalMs / MINUTE_MS);
  const totalSeconds = Math.floor(totalMs / 1000);

  return {
    totalMs,
    totalDays,
    totalHours,
    totalMinutes,
    totalSeconds,
    days: totalDays,
    hours: totalHours % 24,
    minutes: totalMinutes % 60,
    seconds: totalSeconds % 60,
  };
}

/** 该日期所在年份的周年日（同月同日） */
function anniversaryOf(year: number, start: Date): Date {
  const d = new Date(start);
  d.setFullYear(year);
  return d;
}

/** 上一个已经发生的周年，以及下一个即将到来的周年 */
export function anniversaryWindow(start: Date, now: Date): { last: Date; next: Date } {
  let year = now.getFullYear();
  let last = anniversaryOf(year, start);
  if (last.getTime() > now.getTime()) {
    year -= 1;
    last = anniversaryOf(year, start);
  }
  const next = anniversaryOf(year + 1, start);
  return { last, next };
}

/** 当前关系年度的第几个年头：0 表示在一起还没满一年 */
export function relationshipYear(start: Date, now: Date): number {
  return anniversaryWindow(start, now).last.getFullYear() - start.getFullYear();
}

export function getProgress(start: Date, now: Date): Progress {
  const { last, next } = anniversaryWindow(start, now);
  const year = clamp01((now.getTime() - last.getTime()) / (next.getTime() - last.getTime()));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const month = clamp01((now.getTime() - monthStart) / (monthEnd - monthStart));

  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = clamp01((now.getTime() - dayStart) / DAY_MS);

  return { year, month, day };
}

export interface AnniversaryCountdown {
  days: number;
  date: Date;
}

/** 距离下一个周年还有多少天 */
export function nextAnniversary(start: Date, now: Date): AnniversaryCountdown {
  const { next } = anniversaryWindow(start, now);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(next.getFullYear(), next.getMonth(), next.getDate()).getTime();
  return {
    days: Math.max(0, Math.round((startOfTarget - startOfToday) / DAY_MS)),
    date: next,
  };
}

export interface Stats {
  heartbeats: number;
  breaths: number;
  seasons: number;
  fullMoons: number;
}

export function getStats(parts: TimeParts): Stats {
  return {
    heartbeats: parts.totalMinutes * config.biometrics.heartRate,
    breaths: parts.totalMinutes * config.biometrics.breathRate,
    seasons: parts.totalDays / 91.31,
    fullMoons: parts.totalDays / 29.53,
  };
}

/** 自动生成周年节点 + 自定义节点，按时间排序 */
export function collectMoments(start: Date, now: Date): Moment[] {
  const list: Moment[] = [];

  const first = new Date(start);
  list.push({
    date: formatISO(first),
    title: '故事开始',
    note: '我们决定在一起的那一天。',
  });

  const max = Math.min(config.autoAnniversaries, relationshipYear(start, now));
  for (let i = 1; i <= max; i++) {
    const d = anniversaryOf(start.getFullYear() + i, start);
    if (d.getTime() > now.getTime()) break;
    list.push({
      date: formatISO(d),
      title: `${i} 周年`,
      note: `我们一起走过的第 ${i} 个 365 天。`,
    });
  }

  for (const m of config.moments) list.push(m);

  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export function formatISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 2021.08.23 */
export function formatDot(d: Date): string {
  return formatISO(d).replaceAll('-', '.');
}

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}

export const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/** 12345678 → 1234.6 万；123456789 → 1.23 亿 */
export function formatCompact(n: number): string {
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)} 亿`;
  if (n >= 1e6) return `${(n / 1e4).toFixed(0)} 万`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)} 万`;
  return Math.round(n).toLocaleString('zh-CN');
}

export function percent(v: number): string {
  return `${Math.round(clamp01(v) * 100)}%`;
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
