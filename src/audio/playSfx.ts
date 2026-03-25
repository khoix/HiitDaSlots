/**
 * Web Audio API playback — reliable for layered SFX on mobile (vs multiple HTMLAudioElement).
 * Future background music may route through musicBusGain; SFX and the slot spin loop go to destination.
 */

let audioContext: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();
const decodeFailureCache = new Set<string>();

/** BGM only — Menu → Music mutes this node (gain 0). SFX do not use it. */
let musicBusGain: GainNode | null = null;

let spinLoopSource: AudioBufferSourceNode | null = null;
let spinLoopGain: GainNode | null = null;

/** Bumped only by stopSlotsSpinLoop — invalidates in-flight startSlotsSpinLoop. */
let spinLoopEpoch = 0;

const SPIN_LOOP_LEVEL = 0.45;

function ensureMusicBus(c: AudioContext): GainNode {
  if (!musicBusGain || musicBusGain.context !== c) {
    try {
      musicBusGain?.disconnect();
    } catch {
      /* ignore */
    }
    musicBusGain = c.createGain();
    musicBusGain.gain.value = 1;
    musicBusGain.connect(c.destination);
  }
  return musicBusGain;
}

function getContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('Audio requires window');
  }
  if (!audioContext) {
    const AC =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) throw new Error('AudioContext not supported');
    audioContext = new AC();
    ensureMusicBus(audioContext);
  }
  return audioContext;
}

/**
 * Mute/unmute all audio routed through the music bus (slot reel bed, future BGM).
 * Safe to call before any clip plays — ensures AudioContext + bus exist.
 */
export function setMusicBusMuted(muted: boolean): void {
  try {
    const c = getContext();
    const bus = ensureMusicBus(c);
    bus.gain.value = muted ? 0 : 1;
  } catch {
    /* ignore */
  }
}

/** Resume / create context — safe to call from pointerdown / click. */
export async function resumeAudioContext(): Promise<void> {
  const c = getContext();
  ensureMusicBus(c);
  if (c.state === 'suspended') {
    await c.resume();
  }
}

async function decodeUrl(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Sound fetch ${res.status}: ${url}`);
  }
  const raw = await res.arrayBuffer();
  const copy = raw.slice(0);
  const c = getContext();
  const buf = await c.decodeAudioData(copy);
  bufferCache.set(url, buf);
  return buf;
}

/**
 * Play multiple clips with the same start time (layered). Call from a user gesture when possible.
 */
export async function playSoundsTogether(urls: readonly string[]): Promise<void> {
  const c = getContext();
  ensureMusicBus(c);
  await c.resume();
  const startAt = c.currentTime + 0.02;
  await Promise.all(
    urls.map(async (url) => {
      const buf = await decodeUrl(url);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(startAt);
    })
  );
}

export function playSound(url: string): void {
  void (async () => {
    try {
      const c = getContext();
      ensureMusicBus(c);
      await c.resume();

      // Some browsers/codecs (notably certain WebM Opus builds) can fail
      // `decodeAudioData()`. If that happens, fall back to HTMLAudioElement
      // so time-critical SFX like the 5s countdown still play.
      let buf: AudioBuffer | null = null;
      if (!decodeFailureCache.has(url)) {
        try {
          buf = await decodeUrl(url);
        } catch (e) {
          decodeFailureCache.add(url);
          // eslint-disable-next-line no-console
          console.warn('[audio] decodeAudioData failed, falling back', {
            url,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      if (!buf) {
        const audio = new Audio(url);
        // Best-effort: play may still be blocked if this isn't a user gesture.
        // (We already call `AudioContext.resume()` above, but HTMLAudio
        // has its own constraints.)
        void audio.play().catch(() => {});
        return;
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(c.currentTime + 0.02);
    } catch {
      /* ignore */
    }
  })();
}

function disconnectSpinGraph(): void {
  try {
    spinLoopSource?.stop(0);
    spinLoopSource?.disconnect();
  } catch {
    /* already stopped */
  }
  spinLoopSource = null;
  try {
    spinLoopGain?.disconnect();
  } catch {
    /* ignore */
  }
  spinLoopGain = null;
}

export function stopSlotsSpinLoop(): void {
  spinLoopEpoch++;
  disconnectSpinGraph();
}

/**
 * Looping reel bed — direct to destination so it is not muted by the (removed) Music menu / BGM bus.
 */
export async function startSlotsSpinLoop(url: string): Promise<void> {
  const token = spinLoopEpoch;
  try {
    const c = getContext();
    await c.resume();
    if (token !== spinLoopEpoch) return;

    disconnectSpinGraph();
    if (token !== spinLoopEpoch) return;

    const buf = await decodeUrl(url);
    if (token !== spinLoopEpoch) return;

    const gain = c.createGain();
    gain.gain.value = SPIN_LOOP_LEVEL;
    gain.connect(c.destination);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(gain);
    src.start();

    if (token !== spinLoopEpoch) {
      try {
        src.stop(0);
        src.disconnect();
        gain.disconnect();
      } catch {
        /* ignore */
      }
      return;
    }

    spinLoopSource = src;
    spinLoopGain = gain;
  } catch {
    /* autoplay / decode */
  }
}
