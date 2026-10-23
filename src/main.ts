import './style.css';
import { App } from './core/App';
import { config } from './config';
import { getTimeParts } from './utils/time';

const host = document.getElementById('stage');

function showFallback(message: string): void {
  const start = new Date(config.startDate);
  const parts = getTimeParts(start, new Date());

  const days = document.getElementById('fallback-days');
  const text = document.getElementById('fallback-text');
  if (days) days.textContent = parts.days.toLocaleString('zh-CN');
  if (text) text.textContent = message;

  document.body.classList.add('is-fallback');
  document.getElementById('loader')?.classList.add('is-hidden');
}

if (!host) {
  showFallback('页面结构加载失败，请刷新重试。');
} else {
  const app = new App(host);
  app.init().catch((error: unknown) => {
    console.error('[LoveTimer] 3D 场景初始化失败：', error);
    showFallback('这台设备暂时无法点亮 3D 宇宙，但时间仍在继续。');
  });

  // 万一着色器编译或显卡驱动卡住，至少让文字层出现
  window.setTimeout(() => {
    if (!document.body.classList.contains('is-ready') && !document.body.classList.contains('is-fallback')) {
      document.body.classList.add('is-ready');
      document.getElementById('loader')?.classList.add('is-hidden');
    }
  }, 9000);
}
