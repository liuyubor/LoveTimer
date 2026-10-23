/**
 * 一个人就能改完的配置文件。
 * 只需要改这里的日期和文案，整个 3D 场景与 HUD 都会跟着变。
 */

export interface Moment {
  /** ISO 日期，例如 2024-02-14 */
  date: string;
  title: string;
  note?: string;
}

export const config = {
  /** 在一起的起点。原版是 2021-08-23 00:00:00（东八区）。 */
  startDate: '2021-08-23T00:00:00+08:00',

  /** 顶部标题 */
  title: '我们在一起',
  kicker: 'SINCE 2021 · 08 · 23',

  /**
   * 自动把每个周年纪念日变成场景里的「记忆星座」。
   * 设为 0 可以关闭。
   */
  autoAnniversaries: 5,

  /**
   * 自己补记的节点，会追加到星座里。
   * 示例：
   * { date: '2021-10-01', title: '第一次一起去旅行', note: '在苏州的雨里走了很久。' },
   */
  moments: [] as Moment[],

  /** 点击爱心时随机浮出的一句话 */
  notes: [
    '今天也喜欢你。',
    '时间很快，你很好。',
    '想和你把普通的日子，过成纪念日。',
    '宇宙很大，幸好遇见你。',
    '你是我所有计划里，唯一不需要理由的那一项。',
    '把今天，也存进我们的星星里。',
    '第 {days} 天，还是想牵你的手。',
    '和你在一起之后，时间才有了刻度。',
  ],

  /** 关于「你和我」的心跳、呼吸估算 */
  biometrics: {
    heartRate: 72, // 次 / 分钟，估算值
    breathRate: 16, // 次 / 分钟，估算值
  },
} as const;

/** 调色板：场景与 HUD 共用 */
export const palette = {
  bg: '#07050f',
  rose: '#ff5f7e',
  roseDeep: '#8d1f3f',
  gold: '#ffcf9a',
  cyan: '#8fe6ff',
  violet: '#a98bff',
  ivory: '#f7eef0',
} as const;
