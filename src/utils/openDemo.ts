function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function openDemoLink(url: string | undefined): void {
  if (!url || url.trim() === '') return;
  const trimmedUrl = url.trim();

  if (!isMobileDevice()) {
    window.open(trimmedUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // Mobile-only launcher page keeps the app tab clean and offers a close action.
  const launcherUrl = new URL(window.location.href);
  launcherUrl.searchParams.set('demoLauncher', '1');
  launcherUrl.searchParams.set('demoUrl', trimmedUrl);

  window.open(launcherUrl.toString(), '_blank', 'noopener,noreferrer');
}

export function hasDemoLink(url: string | undefined): boolean {
  return Boolean(url && url.trim() !== '');
}
