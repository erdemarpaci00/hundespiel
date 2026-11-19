// Kleine Toene (WebAudio, keine Dateien) und Vibration. Stumm-Schalter wird im Browser gemerkt.
export type Cue = 'good' | 'bad' | 'win' | 'soft' | 'coin' | 'brush' | 'munch'

const KEY = 'hundespiel-stumm'
let ctx: AudioContext | null = null

export function isMuted(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function setMuted(m: boolean): void {
  try { localStorage.setItem(KEY, m ? '1' : '0') } catch { /* egal */ }
}

// Tonfolgen: [Frequenz in Hz, Dauer in ms]
const TONES: Record<Cue, [number, number][]> = {
  good: [[660, 70], [880, 110]],
  bad: [[300, 140], [220, 180]],
  win: [[523, 90], [659, 90], [784, 90], [1047, 220]],
  soft: [[440, 60]],
  coin: [[988, 60], [1319, 120]],
  brush: [[1500, 40], [1900, 70]],
  munch: [[180, 45], [140, 60]],
}

const BUZZ: Record<Cue, number | number[]> = { good: 25, bad: 60, win: [50, 40, 50, 40, 90], soft: 10, coin: 20, brush: 8, munch: 12 }

export function cue(kind: Cue): void {
  if (isMuted()) return
  try { navigator.vibrate?.(BUZZ[kind]) } catch { /* nicht unterstuetzt */ }
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    let t = ctx.currentTime
    for (const [freq, ms] of TONES[kind]) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = kind === 'munch' || kind === 'brush' ? 'triangle' : 'sine'
      o.frequency.value = freq * (0.96 + Math.random() * 0.08)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + ms / 1000 + 0.02)
      t += ms / 1000
    }
  } catch { /* Ton ist nur Beiwerk */ }
}
