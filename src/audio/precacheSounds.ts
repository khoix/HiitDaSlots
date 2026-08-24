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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
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
    // Precaching is best-effort; storage failures must never block the app.
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

async function fetchBestEffort(
  url: string,
  signal: AbortSignal | undefined,
  cache?: Cache
): Promise<void> {
  assertNotAborted(signal);

  try {
    const res = await fetchAndValidate(url, signal);

    // CacheStorage explicitly disallows partial responses. A persistent 206 is
    // still a usable network response, so simply leave it out of CacheStorage.
    if (cache && res.status !== 206) {
      try {
        await cache.put(url, res.clone());
      } catch {
        // Cache writes are an optimization only.
      }
    }
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      throw error;
    }
    // Network/cache failures are intentionally silent and non-blocking.
  }
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
        await fetchBestEffort(url, signal);
        onProgress?.(url, 'fetched');
      })
    );
    return;
  }

  const manifestSignature = buildManifestSignature(urls);
  const previousSignature = readStoredSignature();

  let cache: Cache;
  try {
    cache = await caches.open(PRECACHE_CACHE_NAME);
  } catch {
    // CacheStorage itself may be unavailable (private mode, quota, policy, etc.).
    // Warm the browser HTTP cache where possible, then continue normally.
    await Promise.all(
      urls.map(async (url) => {
        await fetchBestEffort(url, signal);
        onProgress?.(url, 'fetched');
      })
    );
    return;
  }

  assertNotAborted(signal);

  const hasChangedSinceLastPrecache = previousSignature !== manifestSignature;
  const urlsToFetch = hasChangedSinceLastPrecache
    ? [...urls]
    : (
        await Promise.all(
          urls.map(async (url) => {
            try {
              const cached = await cache.match(url);
              return cached ? null : url;
            } catch {
              return url;
            }
          })
        )
      ).filter((url): url is string => url !== null);

  const fetchSet = new Set(urlsToFetch);
  urls
    .filter((url) => !fetchSet.has(url))
    .forEach((url) => onProgress?.(url, 'cached'));

  await Promise.all(
    urlsToFetch.map(async (url) => {
      await fetchBestEffort(url, signal, cache);
      onProgress?.(url, 'fetched');
    })
  );

  writeStoredSignature(manifestSignature);
}
