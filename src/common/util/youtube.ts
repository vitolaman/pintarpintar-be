// Returns the video id of a YouTube watch, short, embed or youtu.be link;
// null for any other link.
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^(www\.|m\.)/, '');
  const segments = parsed.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = segments[0] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (segments[0] === 'watch') id = parsed.searchParams.get('v');
    else if (['embed', 'shorts', 'live', 'v'].includes(segments[0])) {
      id = segments[1] ?? null;
    }
  }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}
