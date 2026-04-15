import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { MAIN_LOOP_URL, WORKOUT_TRACK_URLS } from '@/audio/soundManifest';
import { readMp3TitleFromUrl, titleFromAudioUrl } from '@/audio/readMp3Title';
import { useBgmMusicPreference } from '@/context/BgmMusicContext';
import { useIsMobile } from '@/hooks/use-mobile';
import type { AppState } from '@/types';
import { cn } from '@/lib/utils';

/** Session player chrome hidden on small viewports for these routes (audio keeps playing). */
const MOBILE_HIDDEN_HUD_STATES: ReadonlySet<AppState> = new Set([
  'landing',
  'exerciseCatalog',
  'savedWorkouts',
  'favoriteExercises',
  'workoutBuilder',
  'history',
]);

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function MarqueeTitle({
  text,
  className,
}: {
  text: string;
  /** Fixed viewport width for the title slot (marquee scrolls inside). */
  className?: string;
}) {
  const dur = `${Math.max(14, Math.min(52, text.length * 0.36))}s`;

  return (
    <div
      className={cn(
        'session-marquee-mask h-7 shrink-0 overflow-hidden',
        className
      )}
      aria-label={text}
    >
      <div
        className="session-marquee-rail flex h-7 w-max max-w-none items-center"
        style={{ animationDuration: dur }}
      >
        <span className="whitespace-nowrap px-2 font-display text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
          {text}
        </span>
        <span className="whitespace-nowrap px-2 font-display text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
          {text}
        </span>
      </div>
    </div>
  );
}

type Ctx = {
  beginSessionAfterCoin: () => void;
  setWorkoutMusicActive: (active: boolean) => void;
  /** 0–100 while the workout runner is mounted; `null` clears the HUD workout bar. */
  setWorkoutHudProgress: (pct: number | null) => void;
};

const SessionMediaContext = createContext<Ctx | null>(null);

const HUD_ROW_MIN = 'min-h-11';

export function SessionMediaProvider({
  children,
  appState,
}: {
  children: React.ReactNode;
  appState: AppState;
}) {
  const { bgmEnabled } = useBgmMusicPreference();
  const isMobile = useIsMobile();
  const mainRef = useRef<HTMLAudioElement>(null);
  const workoutRef = useRef<HTMLAudioElement>(null);
  const pendingMainFadeInRef = useRef(false);
  const mainFadeIntervalRef = useRef<number | null>(null);
  const mainAudioCtxRef = useRef<AudioContext | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);
  const mainMediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [barVisible, setBarVisible] = useState(false);
  const [mainAutoplayKick, setMainAutoplayKick] = useState(0);
  const [workoutActive, setWorkoutActive] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  const [nowPlayingUrl, setNowPlayingUrl] = useState<string | null>(null);
  const [marqueeTitle, setMarqueeTitle] = useState('');
  const [workoutHudProgressPct, setWorkoutHudProgressPct] = useState<number | null>(null);

  const playlistRef = useRef<string[]>([]);
  const trackIndexRef = useRef(0);

  const hasTracks = WORKOUT_TRACK_URLS.length > 0;
  const showWorkoutNav = workoutActive && hasTracks;
  const showProgressBar = workoutActive;

  const showHudChrome =
    barVisible && !(isMobile && MOBILE_HIDDEN_HUD_STATES.has(appState));

  const showMobileTopBar = showHudChrome && isMobile;
  const showDesktopPlayerDock = !isMobile;

  const [hudDockOpen, setHudDockOpen] = useState(false);

  const clearMainFadeInterval = useCallback(() => {
    if (mainFadeIntervalRef.current != null) {
      window.clearInterval(mainFadeIntervalRef.current);
      mainFadeIntervalRef.current = null;
    }
  }, []);

  const ensureMainWebAudio = useCallback(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return false;
    if (mainGainRef.current && mainAudioCtxRef.current) return true;
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    try {
      const ctx = mainAudioCtxRef.current ?? new Ctx();
      const source =
        mainMediaSourceRef.current ?? ctx.createMediaElementSource(mainEl);
      const gain = mainGainRef.current ?? ctx.createGain();
      if (!mainMediaSourceRef.current) {
        source.connect(gain);
      }
      if (!mainGainRef.current) {
        gain.connect(ctx.destination);
      }
      mainAudioCtxRef.current = ctx;
      mainMediaSourceRef.current = source;
      mainGainRef.current = gain;
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!barVisible) setHudDockOpen(false);
  }, [barVisible]);

  const hudShellRef = useRef<HTMLDivElement>(null);
  const [contentTopInset, setContentTopInset] = useState(0);

  const applyVolumes = useCallback(() => {
    clearMainFadeInterval();
    const vol = bgmEnabled ? 1 : 0;
    const main = mainRef.current;
    const w = workoutRef.current;
    const hasMainWebAudio = ensureMainWebAudio();
    if (main && !hasMainWebAudio) {
      main.volume = vol;
      main.muted = vol === 0;
    }
    if (hasMainWebAudio && mainGainRef.current && mainAudioCtxRef.current) {
      mainGainRef.current.gain.cancelScheduledValues(mainAudioCtxRef.current.currentTime);
      mainGainRef.current.gain.setValueAtTime(
        vol,
        mainAudioCtxRef.current.currentTime
      );
      if (main) main.muted = false;
    }
    if (w) {
      w.volume = vol;
      w.muted = vol === 0;
    }
  }, [bgmEnabled, clearMainFadeInterval, ensureMainWebAudio]);

  useEffect(() => {
    applyVolumes();
  }, [applyVolumes]);

  useEffect(() => {
    if (!barVisible) return;
    if (!workoutActive || !hasTracks) {
      setNowPlayingUrl(MAIN_LOOP_URL);
    }
  }, [barVisible, workoutActive, hasTracks]);

  useLayoutEffect(() => {
    if (!barVisible || !showMobileTopBar) {
      setContentTopInset(0);
      document.documentElement.style.scrollPaddingTop = '';
      return;
    }
    const el = hudShellRef.current;
    if (!el) return;

    const applyInset = () => {
      const h = el.getBoundingClientRect().height;
      setContentTopInset(Math.ceil(h));
      document.documentElement.style.scrollPaddingTop = `${Math.ceil(h)}px`;
    };

    applyInset();
    const ro = new ResizeObserver(applyInset);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.scrollPaddingTop = '';
    };
  }, [barVisible, showMobileTopBar, workoutActive]);

  useEffect(() => {
    if (!nowPlayingUrl) return;
    setMarqueeTitle(titleFromAudioUrl(nowPlayingUrl));
    let cancelled = false;
    void readMp3TitleFromUrl(nowPlayingUrl).then((t) => {
      if (!cancelled) setMarqueeTitle(t);
    });
    return () => {
      cancelled = true;
    };
  }, [nowPlayingUrl]);

  const setWorkoutHudProgress = useCallback((pct: number | null) => {
    if (pct == null) {
      setWorkoutHudProgressPct(null);
      return;
    }
    setWorkoutHudProgressPct(Math.min(100, Math.max(0, pct)));
  }, []);

  const playMainLoop = useCallback(async () => {
    const v = mainRef.current;
    if (!v) return;
    v.loop = true;
    const shouldFadeIn = pendingMainFadeInRef.current;
    pendingMainFadeInRef.current = false;
    clearMainFadeInterval();
    const hasMainWebAudio = ensureMainWebAudio();
    if (
      shouldFadeIn &&
      bgmEnabled &&
      hasMainWebAudio &&
      mainGainRef.current &&
      mainAudioCtxRef.current
    ) {
      const now = mainAudioCtxRef.current.currentTime;
      mainGainRef.current.gain.cancelScheduledValues(now);
      mainGainRef.current.gain.setValueAtTime(0, now);
      v.muted = false;
    }
    if (shouldFadeIn && bgmEnabled && !hasMainWebAudio) {
      v.muted = false;
      v.volume = 0;
    }
    try {
      if (hasMainWebAudio && mainAudioCtxRef.current?.state === 'suspended') {
        await mainAudioCtxRef.current.resume();
      }
      await v.play();
      if (shouldFadeIn && bgmEnabled) {
        if (hasMainWebAudio && mainGainRef.current && mainAudioCtxRef.current) {
          const now = mainAudioCtxRef.current.currentTime;
          mainGainRef.current.gain.cancelScheduledValues(now);
          mainGainRef.current.gain.setValueAtTime(
            mainGainRef.current.gain.value,
            now
          );
          mainGainRef.current.gain.linearRampToValueAtTime(1, now + 5);
          v.muted = false;
        } else {
          const fadeStartMs = performance.now();
          mainFadeIntervalRef.current = window.setInterval(() => {
            const main = mainRef.current;
            if (!main) {
              clearMainFadeInterval();
              return;
            }
            const elapsed = performance.now() - fadeStartMs;
            const nextVolume = Math.min(1, elapsed / 5000);
            main.volume = nextVolume;
            main.muted = nextVolume === 0;
            if (nextVolume >= 1) {
              clearMainFadeInterval();
            }
          }, 100);
        }
      }
    } catch {
      /* autoplay / decode */
    }
  }, [bgmEnabled, clearMainFadeInterval, ensureMainWebAudio]);

  useLayoutEffect(() => {
    if (!barVisible || mainAutoplayKick === 0) return;
    void playMainLoop();
  }, [barVisible, mainAutoplayKick, playMainLoop]);

  const pauseMain = useCallback(() => {
    clearMainFadeInterval();
    mainRef.current?.pause();
  }, [clearMainFadeInterval]);

  const playWorkoutIndex = useCallback(async (i: number) => {
    const a = workoutRef.current;
    const list = playlistRef.current;
    if (!a || !list.length || i >= list.length) return;
    const url = list[i];
    setNowPlayingUrl(url);
    a.src = url;
    try {
      await a.play();
    } catch {
      /* autoplay */
    }
  }, []);

  const primeWorkoutPlaylist = useCallback(
    (autoPlay: boolean) => {
      if (!hasTracks) return;
      playlistRef.current = shuffleInPlace([...WORKOUT_TRACK_URLS]);
      trackIndexRef.current = 0;
      const first = playlistRef.current[0];
      if (autoPlay) {
        void playWorkoutIndex(0);
      } else {
        if (first) setNowPlayingUrl(first);
        const a = workoutRef.current;
        if (a && first) {
          a.src = first;
          a.load();
        }
      }
    },
    [hasTracks, playWorkoutIndex]
  );

  const stopWorkoutAudio = useCallback(() => {
    const a = workoutRef.current;
    if (a) {
      a.pause();
      a.removeAttribute('src');
      a.load();
    }
  }, []);

  const beginSessionAfterCoin = useCallback(() => {
    pendingMainFadeInRef.current = true;
    setBarVisible(true);
    setUserPaused(false);
    setWorkoutActive(false);
    stopWorkoutAudio();
    setMainAutoplayKick((k) => k + 1);
  }, [stopWorkoutAudio]);

  const setWorkoutMusicActive = useCallback(
    (active: boolean) => {
      setWorkoutActive(active);
      if (active) {
        clearMainFadeInterval();
        pauseMain();
        if (hasTracks) {
          primeWorkoutPlaylist(!userPaused);
        } else if (!userPaused) {
          void playMainLoop();
        }
      } else {
        stopWorkoutAudio();
        setWorkoutHudProgress(null);
        if (!userPaused) void playMainLoop();
      }
    },
    [
      hasTracks,
      clearMainFadeInterval,
      pauseMain,
      playMainLoop,
      primeWorkoutPlaylist,
      stopWorkoutAudio,
      userPaused,
      setWorkoutHudProgress,
    ]
  );

  useEffect(() => () => clearMainFadeInterval(), [clearMainFadeInterval]);

  const advanceWorkoutTrack = useCallback(() => {
    trackIndexRef.current += 1;
    if (trackIndexRef.current >= playlistRef.current.length) {
      playlistRef.current = shuffleInPlace([...WORKOUT_TRACK_URLS]);
      trackIndexRef.current = 0;
    }
    void playWorkoutIndex(trackIndexRef.current);
  }, [playWorkoutIndex]);

  const retreatWorkoutTrack = useCallback(() => {
    if (!playlistRef.current.length) return;
    trackIndexRef.current -= 1;
    if (trackIndexRef.current < 0) {
      trackIndexRef.current = playlistRef.current.length - 1;
    }
    void playWorkoutIndex(trackIndexRef.current);
  }, [playWorkoutIndex]);

  const onWorkoutEnded = useCallback(() => {
    if (!workoutActive || !hasTracks) return;
    advanceWorkoutTrack();
  }, [workoutActive, hasTracks, advanceWorkoutTrack]);

  const onWorkoutError = useCallback(() => {
    if (!workoutActive || !hasTracks) return;
    advanceWorkoutTrack();
  }, [workoutActive, hasTracks, advanceWorkoutTrack]);

  const skipWorkoutForward = useCallback(() => {
    if (!workoutActive || !hasTracks) return;
    advanceWorkoutTrack();
  }, [workoutActive, hasTracks, advanceWorkoutTrack]);

  const skipWorkoutBack = useCallback(() => {
    if (!workoutActive || !hasTracks) return;
    retreatWorkoutTrack();
  }, [workoutActive, hasTracks, retreatWorkoutTrack]);

  const togglePlayPause = useCallback(() => {
    if (!barVisible) {
      beginSessionAfterCoin();
      return;
    }
    if (userPaused) {
      setUserPaused(false);
      if (workoutActive && hasTracks) {
        void workoutRef.current?.play();
      } else {
        void playMainLoop();
      }
      return;
    }
    setUserPaused(true);
    mainRef.current?.pause();
    workoutRef.current?.pause();
  }, [
    barVisible,
    beginSessionAfterCoin,
    userPaused,
    workoutActive,
    hasTracks,
    playMainLoop,
  ]);

  const workoutProgressFillPct = workoutHudProgressPct ?? 0;

  const value = useMemo(
    () => ({
      beginSessionAfterCoin,
      setWorkoutMusicActive,
      setWorkoutHudProgress,
    }),
    [beginSessionAfterCoin, setWorkoutMusicActive, setWorkoutHudProgress]
  );

  const iconBtn =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/30 text-foreground hover:bg-muted/50';

  const displayTitle =
    marqueeTitle || titleFromAudioUrl(nowPlayingUrl ?? '') || 'Session audio';

  const progressBarEl = showProgressBar ? (
    <div
      className="h-1 w-full bg-muted/40"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(workoutProgressFillPct)}
      aria-label="Workout progress"
    >
      <div
        className="h-full bg-primary/80 transition-[width] duration-300 ease-out"
        style={{ width: `${workoutProgressFillPct}%` }}
      />
    </div>
  ) : null;

  const controlsRowEl = (
    marqueeClassName: string,
    expandMarqueeInRow?: boolean
  ) => (
    <div
      className={cn(
        'flex w-full items-center justify-center gap-2 px-2 py-1.5',
        HUD_ROW_MIN
      )}
    >
      {showWorkoutNav ? (
        <button
          type="button"
          onClick={skipWorkoutBack}
          className={iconBtn}
          aria-label="Previous track"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="inline-block h-7 w-7 shrink-0" aria-hidden />
      )}
      <button
        type="button"
        onClick={togglePlayPause}
        className={iconBtn}
        aria-label={userPaused ? 'Play' : 'Pause'}
      >
        {userPaused ? (
          <Play className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Pause className="h-3.5 w-3.5" />
        )}
      </button>
      {expandMarqueeInRow ? (
        <div className="flex min-w-0 max-w-full flex-1 justify-center">
          <MarqueeTitle
            text={displayTitle}
            className={cn('min-w-0 shrink', marqueeClassName)}
          />
        </div>
      ) : (
        <MarqueeTitle text={displayTitle} className={marqueeClassName} />
      )}
      {showWorkoutNav ? (
        <button
          type="button"
          onClick={skipWorkoutForward}
          className={iconBtn}
          aria-label="Next track"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="inline-block h-7 w-7 shrink-0" aria-hidden />
      )}
    </div>
  );

  return (
    <SessionMediaContext.Provider value={value}>
      {barVisible ? (
        <>
          {showMobileTopBar ? (
            <div
              ref={hudShellRef}
              className={cn(
                'fixed top-0 left-0 right-0 z-[200] flex flex-col border-b border-border/40',
                'bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70'
              )}
              role="region"
              aria-label="Session audio"
            >
              {controlsRowEl(
                'w-52 max-w-[min(52vw,13.5rem)] sm:w-56 sm:max-w-[15rem]'
              )}
              {progressBarEl}
            </div>
          ) : null}

          <audio
            ref={mainRef}
            src={MAIN_LOOP_URL}
            className="pointer-events-none fixed left-[-9999px] top-0 h-px w-px overflow-hidden opacity-0"
            loop
            preload="auto"
            aria-hidden
            onPlay={() => {
              if (workoutActive && hasTracks) mainRef.current?.pause();
            }}
          />
          <audio
            ref={workoutRef}
            className="pointer-events-none fixed left-[-9999px] top-0 h-px w-px overflow-hidden opacity-0"
            preload="none"
            onEnded={onWorkoutEnded}
            onError={onWorkoutError}
          />
        </>
      ) : null}
      {showDesktopPlayerDock ? (
        <div
          className={cn(
            'fixed bottom-4 right-0 z-[200] flex max-w-[calc(100vw-0.5rem)] flex-row overflow-hidden rounded-l-2xl border border-r-0 border-border/50 shadow-md',
            'bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80',
            'transition-[width] duration-300 ease-out motion-reduce:transition-none',
            hudDockOpen
              ? 'w-[min(20rem,calc(100vw-0.5rem))]'
              : 'w-11'
          )}
          role="region"
          aria-label="Session audio"
          aria-expanded={hudDockOpen}
        >
          {hudDockOpen ? (
            <>
              <div className="flex min-w-0 flex-1 flex-col">
                {controlsRowEl('w-full max-w-full', true)}
                {progressBarEl}
              </div>
              <button
                type="button"
                onClick={() => setHudDockOpen(false)}
                className="flex w-9 shrink-0 flex-col items-center justify-center border-l border-border/40 bg-muted/25 hover:bg-muted/40"
                aria-label="Collapse session audio to tab"
              >
                <ChevronRight
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setHudDockOpen(true)}
              className={cn(
                'flex min-h-11 w-full flex-col items-center justify-center gap-1 px-0 py-1.5',
                'text-muted-foreground hover:bg-muted/25 hover:text-foreground',
                showProgressBar ? 'pb-1.5' : undefined
              )}
              aria-label="Open session audio player"
            >
              <Music2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {showProgressBar ? (
                <div
                  className="mx-1.5 h-0.5 w-[calc(100%-0.75rem)] overflow-hidden rounded-full bg-muted/40"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(workoutProgressFillPct)}
                  aria-label="Workout progress"
                >
                  <div
                    className="h-full rounded-full bg-primary/80 transition-[width] duration-300 ease-out"
                    style={{ width: `${workoutProgressFillPct}%` }}
                  />
                </div>
              ) : null}
            </button>
          )}
        </div>
      ) : null}
      <div
        className="flex min-h-screen w-full flex-col"
        style={
          contentTopInset > 0
            ? { paddingTop: contentTopInset }
            : undefined
        }
      >
        {children}
      </div>
    </SessionMediaContext.Provider>
  );
}

export function useSessionMedia(): Ctx {
  const ctx = useContext(SessionMediaContext);
  if (!ctx) {
    throw new Error('useSessionMedia must be used within SessionMediaProvider');
  }
  return ctx;
}

export function SessionMediaWorkoutBridge({
  workoutRunning,
}: {
  workoutRunning: boolean;
}) {
  const { setWorkoutMusicActive } = useSessionMedia();
  useEffect(() => {
    setWorkoutMusicActive(workoutRunning);
  }, [workoutRunning, setWorkoutMusicActive]);
  return null;
}
