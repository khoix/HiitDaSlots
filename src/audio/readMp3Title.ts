/** Decode ID3v2 TIT2 / TT2 text (encoding byte + payload). */
function parseTextFrame(data: Uint8Array): string {
  if (data.length < 2) return '';
  const enc = data[0];
  const bytes = data.subarray(1);
  if (enc === 0 || enc === 3) {
    const dec = enc === 3 ? new TextDecoder('utf-8') : new TextDecoder('iso-8859-1');
    return dec.decode(bytes).replace(/\0/g, '').trim();
  }
  if (enc === 1 || enc === 2) {
    if (bytes.length < 2) return '';
    const bom = (bytes[0] << 8) | bytes[1];
    const be = bom === 0xfeff;
    const dec = new TextDecoder(be ? 'utf-16be' : 'utf-16le');
    return dec.decode(bytes.subarray(2)).replace(/\0/g, '').trim();
  }
  return new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '').trim();
}

function readSyncSafeInt(u8: Uint8Array, offset: number): number {
  return (
    ((u8[offset] & 0x7f) << 21) |
    ((u8[offset + 1] & 0x7f) << 14) |
    ((u8[offset + 2] & 0x7f) << 7) |
    (u8[offset + 3] & 0x7f)
  );
}

/** Parse TIT2 / TT2 from the start of an MP3 file (ID3v2.2 / v2.3 / v2.4). */
export function parseId3TitleFromBytes(u8: Uint8Array): string | null {
  if (u8.byteLength < 10) return null;
  if (String.fromCharCode(u8[0], u8[1], u8[2]) !== 'ID3') return null;
  const major = u8[3];
  const tagSize = readSyncSafeInt(u8, 6);
  let offset = 10;
  const end = Math.min(u8.byteLength, 10 + tagSize);

  while (offset < end) {
    if (major === 2) {
      if (offset + 6 > end) break;
      const fid = String.fromCharCode(u8[offset], u8[offset + 1], u8[offset + 2]);
      if (fid === '\0\0\0' || fid.charCodeAt(0) === 0) break;
      const frameSize = (u8[offset + 3] << 16) | (u8[offset + 4] << 8) | u8[offset + 5];
      const headerSize = 6;
      if (frameSize < 1 || offset + headerSize + frameSize > end) break;
      const dataStart = offset + headerSize;
      if (fid === 'TT2') {
        const t = parseTextFrame(u8.subarray(dataStart, dataStart + frameSize));
        if (t) return t;
      }
      offset = dataStart + frameSize;
      continue;
    }

    if (offset + 10 > end) break;
    const fid = String.fromCharCode(
      u8[offset],
      u8[offset + 1],
      u8[offset + 2],
      u8[offset + 3]
    );
    if (fid === '\0\0\0\0') break;

    let frameSize: number;
    if (major === 4) {
      frameSize = readSyncSafeInt(u8, offset + 4);
    } else {
      frameSize =
        (u8[offset + 4] << 24) |
        (u8[offset + 5] << 16) |
        (u8[offset + 6] << 8) |
        u8[offset + 7];
    }
    const headerSize = 10;
    if (frameSize < 1 || offset + headerSize + frameSize > end) break;
    const dataStart = offset + headerSize;
    if (fid === 'TIT2') {
      const t = parseTextFrame(u8.subarray(dataStart, dataStart + frameSize));
      if (t) return t;
    }
    offset = dataStart + frameSize;
  }
  return null;
}

export function titleFromAudioUrl(url: string): string {
  try {
    const path = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined)
      .pathname;
    const base = path.split('/').pop() || 'Track';
    return decodeURIComponent(base.replace(/\.[^.]+$/i, '')).replace(/[_-]+/g, ' ').trim() || 'Now playing';
  } catch {
    return 'Now playing';
  }
}

async function fetchStartBytes(url: string, maxBytes: number): Promise<Uint8Array> {
  const rangeRes = await fetch(url, {
    headers: { Range: `bytes=0-${maxBytes - 1}` },
  });
  if (rangeRes.ok) {
    const buf = await rangeRes.arrayBuffer();
    return new Uint8Array(buf);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf.slice(0, Math.min(buf.byteLength, maxBytes)));
}

/** Best-effort embedded title; falls back to a humanized filename from the URL. */
export async function readMp3TitleFromUrl(url: string): Promise<string> {
  const fallback = titleFromAudioUrl(url);
  try {
    const u8 = await fetchStartBytes(url, 196_608);
    const fromTag = parseId3TitleFromBytes(u8);
    if (fromTag && fromTag.trim()) return fromTag.trim();
  } catch {
    /* ignore */
  }
  return fallback;
}
