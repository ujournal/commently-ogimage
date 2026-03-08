import { Resvg, initWasm } from '@resvg/resvg-wasm';
import wasm from '@resvg/resvg-wasm/index_bg.wasm?module';
import { buildCardSvg } from './card';

// jsDelivr CDN (allows Worker fetches; Google Fonts often blocks non-browser requests)
const FONT_BASE = 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.0/files';
// Load 700 (bold) first so both siteName and title get bold for Latin and Cyrillic
const FONT_URLS = [
  `${FONT_BASE}/inter-latin-700-normal.woff2`,
  `${FONT_BASE}/inter-cyrillic-700-normal.woff2`,
  `${FONT_BASE}/inter-latin-400-normal.woff2`,
  `${FONT_BASE}/inter-cyrillic-400-normal.woff2`,
] as const;

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
    })
  );
  return fontBuffers;
}

export default {
  async fetch(request: Request) {
    try {
      if (!initialized) {
        await initWasm(wasm);
        initialized = true;
      }

      const url = new URL(request.url);
      const title = url.searchParams.get('title') ?? undefined;
      const siteName = url.searchParams.get('siteName') ?? url.searchParams.get('site_name') ?? undefined;
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
        languages: ['en', 'ru'],
      });

      const png = resvg.render().asPng();

      return new Response(png, {
        headers: { 'content-type': 'image/png' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      return new Response(
        JSON.stringify({ error: message, stack }, null, 2),
        { status: 500, headers: { 'content-type': 'application/json' } },
      );
    }
  },
};
