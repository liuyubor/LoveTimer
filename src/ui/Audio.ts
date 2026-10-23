/**
 * 用 WebAudio 现场合成的心跳与风铃，不加载任何音频文件。
 * 浏览器要求用户手势后才能播放，所以默认关闭。
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = false;

  private ensure(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
  }

  async setEnabled(on: boolean): Promise<void> {
    this.ensure();
    if (!this.ctx || !this.master) {
      this.enabled = false;
      return;
    }

    if (on) {
      await this.ctx.resume();
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(0.85, this.ctx.currentTime, 0.15);
      this.enabled = true;
      this.chime();
    } else {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      this.enabled = false;
    }
  }

  /** 一次「咚」——低频正弦快速下滑 + 很短的包络 */
  thump(strength = 1): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(76, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.26);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.32 * strength, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;

    osc.connect(gain).connect(filter).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  /** 开启声音时的确认音 */
  chime(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 783.99, 1046.5];

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = this.ctx!.createGain();
      const start = t + i * 0.06;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.05, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);

      osc.connect(gain).connect(this.master!);
      osc.start(start);
      osc.stop(start + 1.5);
    });
  }
}
