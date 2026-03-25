import { useEffect, useMemo, useState } from 'react';
import { playSound } from '../audio/playSfx';
import { SOUNDS } from '../audio/soundManifest';

interface Props {
  demoUrl: string | null;
}

function isSafeExternalUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export default function DemoLaunchPage({ demoUrl }: Props) {
  const [hasOpenedDemo, setHasOpenedDemo] = useState(false);
  const [closeHintVisible, setCloseHintVisible] = useState(false);

  const safeDemoUrl = useMemo(() => {
    if (!demoUrl) return null;
    return isSafeExternalUrl(demoUrl) ? demoUrl : null;
  }, [demoUrl]);

  useEffect(() => {
    if (!safeDemoUrl || hasOpenedDemo) return;
    const openedDemoWindow = window.open(safeDemoUrl, '_blank', 'noopener,noreferrer');
    if (!openedDemoWindow) {
      // Mobile browsers can block secondary popups; use same-tab navigation fallback.
      window.location.assign(safeDemoUrl);
      return;
    }
    setHasOpenedDemo(true);
  }, [safeDemoUrl, hasOpenedDemo]);

  const handleReturnToApp = () => {
    playSound(SOUNDS.uiConfirm);
    window.opener?.focus();
    window.setTimeout(() => {
      window.close();
      setCloseHintVisible(true);
    }, 90);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div className="landing-glow-primary" aria-hidden />
      <div className="landing-glow-secondary" aria-hidden />
      <div className="landing-corner-tl" aria-hidden />
      <div className="landing-corner-br" aria-hidden />

      <section className="arcade-card relative z-10 w-full max-w-md rounded-2xl border border-border px-6 py-10 text-center sm:px-8">
        <h1 className="landing-title text-4xl sm:text-5xl">Demo Opened</h1>
        <div className="landing-title-underline" />
        <p className="mt-5 text-sm uppercase tracking-widest text-muted-foreground">
          {safeDemoUrl ? 'Demo launched in a new tab.' : 'No valid demo URL was found.'}
        </p>

        <button
          type="button"
          onClick={handleReturnToApp}
          className="landing-cta-btn mt-8 w-full"
        >
          Return To Slots
        </button>

        {closeHintVisible && (
          <p className="mt-4 text-xs text-muted-foreground">
            If this window did not close, you can close it manually.
          </p>
        )}
      </section>
    </div>
  );
}
