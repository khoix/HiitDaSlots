import React, { useCallback, useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import {
  INSERT_COIN_SOUND_URLS,
  PRECACHE_SOUND_URLS,
  SOUNDS,
} from '@/audio/soundManifest';
import {
  playSound,
  playSoundsTogether,
  resumeAudioContext,
} from '@/audio/playSfx';
import { precacheSounds } from '@/audio/precacheSounds';
import { useSessionMedia } from '@/context/SessionMediaContext';

interface Props {
  onStart: () => void;
  onOpenHistory?: () => void;
  onOpenCatalog?: () => void;
  onOpenSavedWorkouts?: () => void;
  onOpenFavoriteExercises?: () => void;
  onOpenWorkoutBuilder?: () => void;
}

type PrecacheState = 'loading' | 'success' | 'error';

export default function LandingScreen({
  onStart,
  onOpenHistory,
  onOpenCatalog,
  onOpenSavedWorkouts,
  onOpenFavoriteExercises,
  onOpenWorkoutBuilder,
}: Props) {
  const { beginSessionAfterCoin } = useSessionMedia();
  const [precacheState, setPrecacheState] = useState<PrecacheState>('loading');
  const [completedCount, setCompletedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const total = PRECACHE_SOUND_URLS.length;
  const progressPct =
    total > 0 ? Math.round((completedCount / total) * 100) : 100;

  useEffect(() => {
    const unlock = () => {
      void resumeAudioContext().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    setPrecacheState('loading');
    setCompletedCount(0);
    setErrorMessage(null);

    (async () => {
      try {
        await precacheSounds({
          urls: PRECACHE_SOUND_URLS,
          signal,
          onProgress: () => {
            setCompletedCount((c) => c + 1);
          },
        });
        setPrecacheState('success');
      } catch (e) {
        if (signal.aborted) return;
        setCompletedCount(0);
        setPrecacheState('error');
        setErrorMessage(
          e instanceof Error ? e.message : 'Could not load game sounds.'
        );
      }
    })();

    return () => ac.abort();
  }, [retryKey]);

  const handleRetry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  const handleInsertCoin = useCallback(() => {
    beginSessionAfterCoin();
    void playSoundsTogether(INSERT_COIN_SOUND_URLS).catch(() => {
      INSERT_COIN_SOUND_URLS.forEach((url) => {
        const audio = new Audio(url);
        void audio.play().catch(() => {});
      });
    });
    onStart();
  }, [beginSessionAfterCoin, onStart]);

  const showProgress =
    precacheState === 'loading' || precacheState === 'error';
  const ctaReady = precacheState === 'success';

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center relative overflow-hidden min-h-0"
      aria-busy={precacheState === 'loading'}
    >
      {/* Ambient glows — static, no layout cost */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="landing-glow-primary" />
        <div className="landing-glow-secondary" />
        <div className="landing-corner-tl" />
        <div className="landing-corner-br" />
      </div>

      <div className="relative mb-6 sm:mb-8 w-full max-w-sm mx-auto">
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative w-full flex justify-center">
            <div className="landing-hds-backdrop-wrap" aria-hidden="true">
              <img
                src={`${import.meta.env.BASE_URL}images/hds.png`}
                alt=""
                className="landing-hds-backdrop"
                decoding="async"
              />
            </div>
            <h1
              className="landing-title relative z-10 font-display uppercase"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              HIIT DA SLOTS
            </h1>
          </div>
          <div className="landing-title-underline relative z-10" />

          {showProgress && (
          <div className="mt-5 space-y-2">
            <div
              className="h-2 w-full overflow-hidden rounded-full border border-primary/30 bg-black/40 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={precacheState === 'error' ? 0 : completedCount}
              aria-label="Loading sounds"
            >
              <div
                className="h-full rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.7)] transition-[width] duration-300 ease-out"
                style={{
                  width:
                    precacheState === 'error'
                      ? '0%'
                      : `${progressPct}%`,
                }}
              />
            </div>
            {precacheState === 'loading' && (
              <p className="font-display text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                Loading assets… {completedCount}/{total}
              </p>
            )}
            {precacheState === 'error' && errorMessage && (
              <div className="space-y-3">
                <p className="text-sm text-destructive font-sans">
                  {errorMessage}
                </p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="arcade-btn-secondary px-6 py-2 rounded-lg text-sm font-display uppercase tracking-widest"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      <p
        className="mb-10 sm:mb-14 text-foreground/70 font-sans max-w-xs mx-auto leading-relaxed"
        style={{ fontSize: 'clamp(0.9rem, 3.5vw, 1.1rem)' }}
      >
        Roll the slots, crush the workout.
      </p>

      <div className="relative group w-full max-w-sm min-h-[3.25rem] flex items-center justify-center">
        {ctaReady ? (
          <>
            <div
              className="absolute -inset-1 rounded-xl opacity-60 group-hover:opacity-90 transition-opacity duration-300 blur-sm"
              style={{
                background:
                  'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))',
              }}
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={handleInsertCoin}
              className="landing-cta-btn relative w-full flex items-center justify-center gap-3"
            >
              <Play
                className="flex-shrink-0 fill-current"
                style={{ width: '1.25rem', height: '1.25rem' }}
              />
              <span className="whitespace-nowrap">INSERT COIN TO PLAY</span>
            </button>
          </>
        ) : null}
      </div>

      {ctaReady &&
      (onOpenHistory ||
        onOpenCatalog ||
        onOpenSavedWorkouts ||
        onOpenFavoriteExercises ||
        onOpenWorkoutBuilder) ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 max-w-sm mx-auto">
          {onOpenCatalog ? (
            <button
              type="button"
              onClick={() => {
                void resumeAudioContext().catch(() => {});
                playSound(SOUNDS.uiSelect);
                onOpenCatalog();
              }}
              className="font-display uppercase tracking-widest text-muted-foreground hover:text-primary text-[0.65rem] transition-colors"
            >
              Catalog
            </button>
          ) : null}
          {onOpenSavedWorkouts ? (
            <button
              type="button"
              onClick={() => {
                void resumeAudioContext().catch(() => {});
                playSound(SOUNDS.uiSelect);
                onOpenSavedWorkouts();
              }}
              className="font-display uppercase tracking-widest text-muted-foreground hover:text-secondary text-[0.65rem] transition-colors"
            >
              Workouts
            </button>
          ) : null}
          {onOpenFavoriteExercises ? (
            <button
              type="button"
              onClick={() => {
                void resumeAudioContext().catch(() => {});
                playSound(SOUNDS.uiSelect);
                onOpenFavoriteExercises();
              }}
              className="font-display uppercase tracking-widest text-muted-foreground hover:text-accent text-[0.65rem] transition-colors"
            >
              Favorites
            </button>
          ) : null}
          {onOpenWorkoutBuilder ? (
            <button
              type="button"
              onClick={() => {
                void resumeAudioContext().catch(() => {});
                playSound(SOUNDS.uiSelect);
                onOpenWorkoutBuilder();
              }}
              className="font-display uppercase tracking-widest text-muted-foreground hover:text-primary text-[0.65rem] transition-colors"
            >
              Builder
            </button>
          ) : null}
          {onOpenHistory ? (
            <button
              type="button"
              onClick={() => {
                void resumeAudioContext().catch(() => {});
                playSound(SOUNDS.uiSelect);
                onOpenHistory();
              }}
              className="font-display uppercase tracking-widest text-muted-foreground hover:text-secondary text-[0.65rem] transition-colors"
            >
              History
            </button>
          ) : null}
        </div>
      ) : null}

      <p
        className="mt-8 font-display uppercase tracking-widest text-muted-foreground/40"
        style={{ fontSize: '0.6rem' }}
      >
        bodyweight · hiit · no equipment
      </p>
    </div>
  );
}
