import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { resumeAudioContext, setMusicBusMuted } from '@/audio/playSfx';

const STORAGE_KEY = 'hiitda-music-enabled';

function readStored(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === null) return true;
    return v === 'true';
  } catch {
    return true;
  }
}

type Ctx = {
  /** When true, background music (slot reel bed, future BGM) is audible. */
  bgmEnabled: boolean;
  setBgmEnabled: (next: boolean) => void;
};

const BgmMusicContext = createContext<Ctx | null>(null);

export function BgmMusicProvider({ children }: { children: React.ReactNode }) {
  const [bgmEnabled, setBgmEnabledState] = useState(readStored);

  useLayoutEffect(() => {
    setMusicBusMuted(!bgmEnabled);
  }, [bgmEnabled]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        setBgmEnabledState(readStored());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setBgmEnabled = useCallback((next: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
    setMusicBusMuted(!next);
    void resumeAudioContext();
    setBgmEnabledState(next);
  }, []);

  const value = useMemo(
    () => ({ bgmEnabled, setBgmEnabled }),
    [bgmEnabled, setBgmEnabled]
  );

  return (
    <BgmMusicContext.Provider value={value}>{children}</BgmMusicContext.Provider>
  );
}

export function useBgmMusicPreference(): Ctx {
  const ctx = useContext(BgmMusicContext);
  if (!ctx) {
    throw new Error('useBgmMusicPreference must be used within BgmMusicProvider');
  }
  return ctx;
}
