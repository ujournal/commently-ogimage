import { Resvg, initWasm } from '@resvg/resvg-wasm';
import wasm from '@resvg/resvg-wasm/index_bg.wasm?module';
import { buildCardSvg } from './card';

// jsDelivr CDN (allows Worker fetches; Google Fonts often blocks non-browser requests)
const FONT_BASE = 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.0/files';
// Load 700 (bold) first so both siteName and title get bold for Latin and Cyrillic
const FONT_URLS = [`${FONT_BASE}/inter-latin-700-normal.woff2`, `${FONT_BASE}/inter-cyrillic-700-normal.woff2`, `${FONT_BASE}/inter-latin-400-normal.woff2`, `${FONT_BASE}/inter-cyrillic-400-normal.woff2`] as const;

/** Max time (seconds) the response can be cached. 24 hours. */
const CACHE_MAX_AGE = 86400;
const CACHE_CONTROL = `public, max-age=${CACHE_MAX_AGE}`;

let initialized = false;
let fontBuffers: Uint8Array[] | null = null;

async function getFontBuffers(): Promise<Uint8Array[]> {
  if (fontBuffers) return fontBuffers;
  const headers = { 'User-Agent': 'Commently-OGImage/1.0 (Cloudflare Worker)' };
  fontBuffers = await Promise.all(
    FONT_URLS.map(async (url) => {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch font: ${res.status} ${res.statusText}`);
      }
      const ab = await res.arrayBuffer();
      return new Uint8Array(ab);
    }),
  );
  return fontBuffers;
}

export default {
  async fetch(request: Request) {
    try {
      // Return cached response for GET if present
      if (request.method === 'GET') {
        const cached = await caches.default.match(request);
        if (cached) return cached;
      }

      if (!initialized) {
        await initWasm(wasm);
        initialized = true;
      }

      const url = new URL(request.url);

      // Optional: path as base64-encoded URLSearchParams (e.g. btoa(new URLSearchParams({ s: "Site Name", t: "Title" })))
      let pathSiteName: string | undefined;
      let pathTitle: string | undefined;
      const pathSegments = url.pathname.slice(1).split('/').filter(Boolean);
      const pathSegment = pathSegments.length ? pathSegments[pathSegments.length - 1] : '';
      if (pathSegment) {
        try {
          const decoded = atob(pathSegment.replace(/-/g, '+').replace(/_/g, '/'));
          const params = new URLSearchParams(decoded);
          pathSiteName = params.get('s') ?? undefined;
          pathTitle = params.get('t') ?? undefined;
        } catch {
          // Not valid base64 or not URLSearchParams; ignore path
        }
      }

      const title = url.searchParams.get('title') ?? pathTitle ?? undefined;
      const siteName = url.searchParams.get('siteName') ?? url.searchParams.get('site_name') ?? pathSiteName ?? undefined;
      const linkUrl = url.searchParams.get('url') ?? url.searchParams.get('link') ?? '';

      const svg = buildCardSvg({
        title,
        siteName,
        url: linkUrl,
        waveSeed: siteName ?? title ?? undefined,
      });

      const fonts = await getFontBuffers();
      const resvg = new Resvg(svg, {
        font: {
          fontBuffers: fonts,
          defaultFontFamily: 'Inter',
          sansSerifFamily: 'Inter',
        },
        languages: ['en', 'uk'],
      });

      const png = resvg.render().asPng();

      const response = new Response(png, {
        headers: {
          'content-type': 'image/png',
          'Cache-Control': CACHE_CONTROL,
        },
      });

      if (request.method === 'GET') {
        await caches.default.put(request, response.clone());
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      return new Response(JSON.stringify({ error: message, stack }, null, 2), { status: 500, headers: { 'content-type': 'application/json' } });
    }
  },
};
