const PRECACHE_CACHE_NAME = 'hds-sounds-v1';
const PRECACHE_SIGNATURE_KEY = 'hds:soundsPrecacheSignature:v1';

type PrecacheProgressMode = 'cached' | 'fetched';

interface PrecacheSoundsOptions {
  urls: readonly string[];
  signal?: AbortSignal;
  onProgress?: (url: string, mode: PrecacheProgressMode) => void;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}

function buildManifestSignature(urls: readonly string[]): string {
  return [...urls].sort().join('|');
}

function readStoredSignature(): string | null {
  try {
    return localStorage.getItem(PRECACHE_SIGNATURE_KEY);
  } catch {
    return null;
  }
}

function writeStoredSignature(signature: string): void {
  try {
    localStorage.setItem(PRECACHE_SIGNATURE_KEY, signature);
  } catch {
    // Ignore storage write failures (private mode, quota, etc).
  }
}

async function fetchAndValidate(url: string, signal?: AbortSignal): Promise<Response> {
  let res = await fetch(url, { signal });

  // Media requests can leave a partial (206) response in the browser HTTP cache.
  // CacheStorage rejects 206 responses, so retry once while bypassing that cache.
  if (res.status === 206) {
    res = await fetch(url, { signal, cache: 'reload' });
  }

  if (!res.ok) {
    throw new Error(`Failed to load ${url} (${res.status})`);
  }
  return res;
}

export async function precacheSounds({
  urls,
  signal,
  onProgress,
}: PrecacheSoundsOptions): Promise<void> {
  assertNotAborted(signal);

  if (urls.length === 0) return;

  if (typeof window === 'undefined' || !('caches' in window)) {
    await Promise.all(
      urls.map(async (url) => {
        assertNotAborted(signal);
        await fetchAndValidate(url, signal);
        onProgress?.(url, 'fetched');
      })
    );
    return;
  }

  const manifestSignature = buildManifestSignature(urls);
  const previousSignature = readStoredSignature();
  const cache = await caches.open(PRECACHE_CACHE_NAME);

  assertNotAborted(signal);

  const hasChangedSinceLastPrecache = previousSignature !== manifestSignature;
  const urlsToFetch = hasChangedSinceLastPrecache
    ? [...urls]
    : (
        await Promise.all(
          urls.map(async (url) => {
            const cached = await cache.match(url);
            return cached ? null : url;
          })
        )
      ).filter((url): url is string => url !== null);

  const fetchSet = new Set(urlsToFetch);
  urls
    .filter((url) => !fetchSet.has(url))
    .forEach((url) => onProgress?.(url, 'cached'));

  await Promise.all(
    urlsToFetch.map(async (url) => {
      assertNotAborted(signal);
      const res = await fetchAndValidate(url, signal);

      // CacheStorage explicitly disallows partial responses. If the origin still
      // returns 206 after the reload, treat the fetch as successful but leave it
      // out of CacheStorage; the next visit will retry because cache.match misses.
      if (res.status !== 206) {
        await cache.put(url, res.clone());
      }

      onProgress?.(url, 'fetched');
    })
  );

  writeStoredSignature(manifestSignature);
}
