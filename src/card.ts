import { urlToWavePalette } from './gradient';
import { escapeHtml, prepareText, sanitizeForCard } from './html';

/** Stable hash from string for deterministic wave variation. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

/** Int in [min, max] from seed. */
function rand(seed: number, min: number, max: number): number {
  const n = ((seed >>> 0) % 0x7fff) & 0x7fff;
  return min + (n % (max - min + 1));
}

/**
 * Build a horizontal wave path symmetric about x = width/2.
 * Wave from (0, baseY) to (width, baseY); left half is mirrored to form the right half.
 * Uses integer half-waves in the left half so the join at center is smooth.
 */
function buildSymmetricWavePath(width: number, height: number, baseY: number, halfWaveCount: number, amplitude: number): string {
  const mid = width / 2;
  const half = mid / halfWaveCount; // half-wavelength so that halfWaveCount half-waves fit in left half
  const minSeg = 6;
  let d = `M 0 ${baseY}`;
  let x = 0;
  let flip = true;
  for (let i = 0; i < halfWaveCount; i++) {
    const xNext = Math.min(x + half, mid);
    const dx = xNext - x;
    if (dx >= minSeg) {
      const q = dx / 4;
      const y = baseY + (flip ? -amplitude : amplitude);
      d += ` C ${x + q} ${y} ${xNext - q} ${y} ${xNext} ${baseY}`;
    } else {
      d += ` L ${xNext} ${baseY}`;
    }
    x = xNext;
    flip = !flip;
  }
  // Mirror right half: same curve sequence with x -> width - x (flip state matches end of left half)
  x = mid;
  flip = halfWaveCount % 2 === 1;
  for (let i = 0; i < halfWaveCount; i++) {
    const xPrev = Math.max(x - half, 0);
    const dx = x - xPrev;
    if (dx >= minSeg) {
      const q = dx / 4;
      const y = baseY + (flip ? -amplitude : amplitude);
      d += ` C ${width - (x - q)} ${y} ${width - (xPrev + q)} ${y} ${width - xPrev} ${baseY}`;
    } else {
      d += ` L ${width - xPrev} ${baseY}`;
    }
    x = xPrev;
    flip = !flip;
  }
  d += ` L ${width} ${height} L 0 ${height} Z`;
  return d;
}

/** Build SVG with base + 3 path layers (same composition for all pattern types). */
function buildPatternSvg(W: number, H: number, base: string, c1: string, c2: string, c3: string, d1: string, d2: string, d3: string, opacity = { o1: 0.32, o2: 0.24, o3: 0.2 }): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
  <rect width="${W}" height="${H}" fill="${base}"/>
  <path fill="${c1}" opacity="${opacity.o1}" d="${d1}"/>
  <path fill="${c2}" opacity="${opacity.o2}" d="${d2}"/>
  <path fill="${c3}" opacity="${opacity.o3}" d="${d3}"/>
</svg>`;
}

/** Three band lines at 1/4, 2/4, and 3/4 of height. */
function thirdLines(H: number): { band1Y: number; band2Y: number; band3Y: number } {
  return { band1Y: H / 4, band2Y: (2 * H) / 4, band3Y: (3 * H) / 4 };
}

/** Symmetric loose waves – gentle, mirrored about center. */
function patternLooseWaves(W: number, H: number, palette: { base: string; wave1: string; wave2: string; wave3: string }, h: number, next: (n: number) => number): string {
  const { band1Y, band2Y, band3Y } = thirdLines(H);
  const halfWaves = 2 + rand(next(h), 0, 1);
  const amplitude = rand(next(h + 1), 5, 14);
  const d1 = buildSymmetricWavePath(W, H, band1Y, halfWaves, amplitude);
  const d2 = buildSymmetricWavePath(W, H, band2Y, halfWaves, amplitude);
  const d3 = buildSymmetricWavePath(W, H, band3Y, halfWaves, amplitude);
  return buildPatternSvg(W, H, palette.base, palette.wave1, palette.wave2, palette.wave3, d1, d2, d3);
}

/** Symmetric S-waves – defined bands, mirrored about center. */
function patternSWaves(W: number, H: number, palette: { base: string; wave1: string; wave2: string; wave3: string }, h: number, next: (n: number) => number): string {
  const { band1Y, band2Y, band3Y } = thirdLines(H);
  const halfWaves = 3 + rand(next(h), 0, 2);
  const amplitude = rand(next(h + 1), 12, 24);
  const d1 = buildSymmetricWavePath(W, H, band1Y, halfWaves, amplitude);
  const d2 = buildSymmetricWavePath(W, H, band2Y, halfWaves, amplitude);
  const d3 = buildSymmetricWavePath(W, H, band3Y, halfWaves, amplitude);
  return buildPatternSvg(W, H, palette.base, palette.wave1, palette.wave2, palette.wave3, d1, d2, d3);
}

/** Symmetric corkscrew – tighter waves, mirrored about center. */
function patternCorkscrew(W: number, H: number, palette: { base: string; wave1: string; wave2: string; wave3: string }, h: number, next: (n: number) => number): string {
  const { band1Y, band2Y, band3Y } = thirdLines(H);
  const halfWaves = 5 + rand(next(h), 0, 3);
  const amplitude = rand(next(h + 1), 12, 22);
  const d1 = buildSymmetricWavePath(W, H, band1Y, halfWaves, amplitude);
  const d2 = buildSymmetricWavePath(W, H, band2Y, halfWaves, amplitude);
  const d3 = buildSymmetricWavePath(W, H, band3Y, halfWaves, amplitude);
  return buildPatternSvg(W, H, palette.base, palette.wave1, palette.wave2, palette.wave3, d1, d2, d3);
}

/** Symmetric ripples – very gentle, few half-waves, small amplitude. */
function patternRipples(W: number, H: number, palette: { base: string; wave1: string; wave2: string; wave3: string }, h: number, next: (n: number) => number): string {
  const { band1Y, band2Y, band3Y } = thirdLines(H);
  const halfWaves = 1 + rand(next(h), 0, 1);
  const amplitude = rand(next(h + 1), 4, 10);
  const d1 = buildSymmetricWavePath(W, H, band1Y, halfWaves, amplitude);
  const d2 = buildSymmetricWavePath(W, H, band2Y, halfWaves, amplitude);
  const d3 = buildSymmetricWavePath(W, H, band3Y, halfWaves, amplitude);
  return buildPatternSvg(W, H, palette.base, palette.wave1, palette.wave2, palette.wave3, d1, d2, d3);
}

/** Symmetric rollers – medium wave count and amplitude, smooth bands. */
function patternRollers(W: number, H: number, palette: { base: string; wave1: string; wave2: string; wave3: string }, h: number, next: (n: number) => number): string {
  const { band1Y, band2Y, band3Y } = thirdLines(H);
  const halfWaves = 4 + rand(next(h), 0, 2);
  const amplitude = rand(next(h + 1), 10, 20);
  const d1 = buildSymmetricWavePath(W, H, band1Y, halfWaves, amplitude);
  const d2 = buildSymmetricWavePath(W, H, band2Y, halfWaves, amplitude);
  const d3 = buildSymmetricWavePath(W, H, band3Y, halfWaves, amplitude);
  return buildPatternSvg(W, H, palette.base, palette.wave1, palette.wave2, palette.wave3, d1, d2, d3);
}

/** Symmetric tight – many small half-waves, fine texture. */
function patternTight(W: number, H: number, palette: { base: string; wave1: string; wave2: string; wave3: string }, h: number, next: (n: number) => number): string {
  const { band1Y, band2Y, band3Y } = thirdLines(H);
  const halfWaves = 6 + rand(next(h), 0, 3);
  const amplitude = rand(next(h + 1), 6, 14);
  const d1 = buildSymmetricWavePath(W, H, band1Y, halfWaves, amplitude);
  const d2 = buildSymmetricWavePath(W, H, band2Y, halfWaves, amplitude);
  const d3 = buildSymmetricWavePath(W, H, band3Y, halfWaves, amplitude);
  return buildPatternSvg(W, H, palette.base, palette.wave1, palette.wave2, palette.wave3, d1, d2, d3);
}

/** Symmetric swells – one broad curve per band, large amplitude. */
function patternSwells(W: number, H: number, palette: { base: string; wave1: string; wave2: string; wave3: string }, h: number, next: (n: number) => number): string {
  const { band1Y, band2Y, band3Y } = thirdLines(H);
  const halfWaves = 1;
  const amplitude = rand(next(h + 1), 18, 32);
  const d1 = buildSymmetricWavePath(W, H, band1Y, halfWaves, amplitude);
  const d2 = buildSymmetricWavePath(W, H, band2Y, halfWaves, amplitude);
  const d3 = buildSymmetricWavePath(W, H, band3Y, halfWaves, amplitude);
  return buildPatternSvg(W, H, palette.base, palette.wave1, palette.wave2, palette.wave3, d1, d2, d3);
}

/** Symmetric coily – zigzag bands with zigzag mirrored about x = W/2. */
function patternCoily(W: number, H: number, palette: { base: string; wave1: string; wave2: string; wave3: string }, h: number, next: (n: number) => number): string {
  const { band1Y, band2Y, band3Y } = thirdLines(H);
  const mid = W / 2;
  const step = 16 + rand(next(h), 0, 12);
  const amp = 5 + rand(next(h + 1), 0, 5);
  const stepsLeft = Math.max(2, Math.floor(mid / step) | 0);
  const stepSize = mid / stepsLeft;
  const zigzagBandSymmetric = (baseY: number) => {
    let d = `M 0 ${H} L 0 ${baseY}`;
    for (let i = 1; i <= stepsLeft; i++) {
      const x = i * stepSize;
      const flip = i % 2 === 1;
      d += ` L ${x - stepSize} ${baseY + (flip ? amp : -amp)} L ${x} ${baseY}`;
    }
    for (let i = stepsLeft - 1; i >= 0; i--) {
      const xPrev = i * stepSize;
      const x = (i + 1) * stepSize;
      const flip = i % 2 === 1;
      d += ` L ${W - x} ${baseY + (flip ? amp : -amp)} L ${W - xPrev} ${baseY}`;
    }
    d += ` L ${W} ${H} Z`;
    return d;
  };
  const d1 = zigzagBandSymmetric(band1Y);
  const d2 = zigzagBandSymmetric(band2Y);
  const d3 = zigzagBandSymmetric(band3Y);
  return buildPatternSvg(W, H, palette.base, palette.wave1, palette.wave2, palette.wave3, d1, d2, d3);
}

const PATTERN_COUNT = 8;

/** Pattern type and wave layers from seed; returns raw SVG string for given dimensions. */
function getWavePatternSvg(hostnameOrSeed: string, W: number, H: number): string {
  const palette = urlToWavePalette(hostnameOrSeed);
  const h = hashString(hostnameOrSeed);
  const next = (n: number) => ((n * 31) ^ (n >>> 16)) | 0;
  const patternIndex = ((next(h + 100) % PATTERN_COUNT) + PATTERN_COUNT) % PATTERN_COUNT;
  switch (patternIndex) {
    case 0:
      return patternLooseWaves(W, H, palette, h, next);
    case 1:
      return patternSWaves(W, H, palette, h, next);
    case 2:
      return patternCorkscrew(W, H, palette, h, next);
    case 3:
      return patternCoily(W, H, palette, h, next);
    case 4:
      return patternRipples(W, H, palette, h, next);
    case 5:
      return patternRollers(W, H, palette, h, next);
    case 6:
      return patternTight(W, H, palette, h, next);
    case 7:
      return patternSwells(W, H, palette, h, next);
    default:
      return patternLooseWaves(W, H, palette, h, next);
  }
}

/** Pattern + colors from hostname seed: random-but-stable pattern type and wave layers and palette. */
function getWaveBackgroundDataUrl(hostnameOrSeed: string): string {
  const W = 400;
  const H = 300;
  const svg = getWavePatternSvg(hostnameOrSeed, W, H);
  const encoded = encodeURIComponent(svg.replace(/\s+/g, ' ').trim());
  return `url("data:image/svg+xml,${encoded}")`;
}

/** Subtle dot pattern as SVG data URL for wave card. */
function getDotPatternDataUrl(): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
  <circle cx="4" cy="4" r="1" fill="rgba(0,0,0,0.06)"/>
  <circle cx="14" cy="8" r="1" fill="rgba(0,0,0,0.06)"/>
  <circle cx="8" cy="16" r="1" fill="rgba(0,0,0,0.06)"/>
  <circle cx="18" cy="14" r="1" fill="rgba(0,0,0,0.06)"/>
</svg>`;
  const encoded = encodeURIComponent(svg.replace(/\s+/g, ' ').trim());
  return `url("data:image/svg+xml,${encoded}")`;
}

/** Background CSS for basic (no-image) card: waves (from URL-derived colors) + dots. */
export function getBasicCardWaveBackgroundCss(hostnameOrSeed: string): string {
  return `${getDotPatternDataUrl()} repeat, ${getWaveBackgroundDataUrl(hostnameOrSeed)} 0 0 / 100% 100%`;
}

/** Escape for SVG/XML text content. */
function escapeSvgText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const TEXT_PAD = 96;
const TITLE_FONT_SIZE_MAX = 56;
const TITLE_FONT_SIZE_MIN = 24;
const SITE_FONT_SIZE = 24;
const GAP_SITE_TITLE = 12;
const SITE_MAX_CHARS = 48;
const LINE_HEIGHT_RATIO = 1.2;
/** Approx width of one character in em for bold title (Inter). Lower = more chars per line. */
const TITLE_CHAR_WIDTH_RATIO = 0.5;
/** Minimum characters per line; shorter lines are merged with previous/next. */
const TITLE_MIN_CHARS_PER_LINE = 10;

/** Fixed rectangle for the title block; font-size is adjusted so text fits inside. */
const TITLE_BOX_WIDTH = 1104;
const TITLE_BOX_HEIGHT = 280;
const TITLE_BOX_PADDING_TOP = 12;

/** Wrap title into lines by word; long words split into chunks. charsPerLine from width/font. */
function wrapTitle(text: string, charsPerLine: number): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return [];
  const n = Math.max(1, charsPerLine);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= n) {
      line = next;
    } else {
      if (line) {
        lines.push(line);
        line = '';
      }
      for (let i = 0; i < w.length; i += n) {
        lines.push(w.slice(i, i + n));
      }
      line = '';
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Balanced wrap: break at word boundaries so each line length is as close as possible to target. */
function wrapTitleBalanced(text: string, maxCharsPerLine: number): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return [];
  const n = Math.max(1, maxCharsPerLine);
  const totalChars = text.trim().length;
  const roughLines = wrapTitle(text, n);
  const numLines = Math.max(1, roughLines.length);
  const targetPerLine = totalChars / numLines;
  const lines: string[] = [];
  let i = 0;
  while (i < words.length) {
    let line = '';
    while (i < words.length) {
      const w = words[i];
      const next = line ? `${line} ${w}` : w;
      if (w.length > n) {
        if (line) {
          lines.push(line);
          line = '';
        }
        for (let j = 0; j < w.length; j += n) {
          lines.push(w.slice(j, j + n));
        }
        i++;
        break;
      }
      if (next.length > n) {
        if (line) lines.push(line);
        line = w;
        i++;
        break;
      }
      const currentLen = line.length;
      const nextLen = next.length;
      const distCurrent = Math.abs(currentLen - targetPerLine);
      const distNext = Math.abs(nextLen - targetPerLine);
      const wouldBreak = line && nextLen > targetPerLine && distNext >= distCurrent;
      const currentTooShort = currentLen > 0 && currentLen < TITLE_MIN_CHARS_PER_LINE;
      if (wouldBreak && !currentTooShort) {
        lines.push(line);
        line = w;
        i++;
        break;
      }
      if (wouldBreak && currentTooShort && next.length <= n) {
        line = next;
        i++;
        continue;
      }
      line = next;
      i++;
    }
    if (line) lines.push(line);
  }
  return mergeShortLines(lines, TITLE_MIN_CHARS_PER_LINE);
}

/** Merge lines that are too short into the previous or next line. */
function mergeShortLines(lines: string[], minChars: number): string[] {
  if (lines.length <= 1) return lines;
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length >= minChars) {
      result.push(line);
      continue;
    }
    if (i > 0) {
      result[result.length - 1] = result[result.length - 1] + ' ' + line;
    } else if (i + 1 < lines.length) {
      result.push(line + ' ' + lines[i + 1]);
      i++;
    } else {
      result.push(line);
    }
  }
  return result;
}

/** Chars that fit in TITLE_BOX_WIDTH at given font size. */
function charsPerLineForFontSize(fontSize: number): number {
  return Math.max(10, Math.floor(TITLE_BOX_WIDTH / (fontSize * TITLE_CHAR_WIDTH_RATIO)));
}

/** Compute title font size and wrapped lines so the text fits in TITLE_BOX_WIDTH x TITLE_BOX_HEIGHT. */
function fitTitleInBox(title: string): { lines: string[]; fontSize: number; lineHeight: number } {
  const heightForLines = TITLE_BOX_HEIGHT - TITLE_BOX_PADDING_TOP;
  let charsPerLine = charsPerLineForFontSize(TITLE_FONT_SIZE_MAX);
  let lines = wrapTitleBalanced(title, charsPerLine);
  let lineCount = Math.max(1, lines.length);
  let fontSize = Math.max(TITLE_FONT_SIZE_MIN, Math.min(TITLE_FONT_SIZE_MAX, Math.floor(heightForLines / ((lineCount - 1) * LINE_HEIGHT_RATIO + 1.1))));
  for (let iter = 0; iter < 3; iter++) {
    charsPerLine = charsPerLineForFontSize(fontSize);
    lines = wrapTitleBalanced(title, charsPerLine);
    lineCount = Math.max(1, lines.length);
    const nextFontSize = Math.max(TITLE_FONT_SIZE_MIN, Math.min(TITLE_FONT_SIZE_MAX, Math.floor(heightForLines / ((lineCount - 1) * LINE_HEIGHT_RATIO + 1.1))));
    if (nextFontSize >= fontSize) break;
    fontSize = nextFontSize;
  }
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  return { lines, fontSize, lineHeight };
}

/** Truncate with ellipsis. */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '\u2026';
}

/**
 * Build OG image as a single SVG (wave background + title/siteName). Use with Resvg to produce PNG.
 * Seed for pattern/color: waveSeed ?? siteName ?? title ?? url hostname.
 */
export function buildCardSvg(opts: {
  title?: string;
  siteName?: string;
  url?: string;
  /** Seed for wave pattern/color. Same value => same pattern and palette. */
  waveSeed?: string;
}): string {
  const { title, siteName, url = '', waveSeed: waveSeedParam } = opts;
  const waveSeed =
    waveSeedParam != null && waveSeedParam !== ''
      ? waveSeedParam
      : siteName != null && siteName !== ''
        ? siteName
        : title != null && title !== ''
          ? title
          : (() => {
              try {
                return new URL(url).hostname;
              } catch {
                return url;
              }
            })();
  const displayTitle = title ? prepareText(sanitizeForCard(title)) : 'Link';
  const displaySite = truncate(siteName ? prepareText(sanitizeForCard(siteName)) : displayTitle, SITE_MAX_CHARS);
  const { lines: titleLines, fontSize: titleFontSize, lineHeight: titleLineHeight } = fitTitleInBox(displayTitle);
  const w = OG_WIDTH;
  const h = OG_HEIGHT;
  const clipW = w - TEXT_PAD;
  const clipH = h - TEXT_PAD;
  const clipX = TEXT_PAD / 2;
  const clipY = TEXT_PAD / 2;
  const textX = w / 2;
  const siteBlockHeight = SITE_FONT_SIZE * LINE_HEIGHT_RATIO;
  const titleBlockHeight = titleLines.length * titleLineHeight;
  // Position block by content: site + gap + title lines (not the title box). Center that on the card.
  const totalContentHeight = siteBlockHeight + GAP_SITE_TITLE + titleBlockHeight;
  const contentTop = clipY + (clipH - totalContentHeight) / 2;
  const siteY = contentTop + siteBlockHeight / 2;
  // First line of title sits just below site name with GAP_SITE_TITLE between them.
  const titleFirstBaseline = contentTop + siteBlockHeight + GAP_SITE_TITLE + titleFontSize * 0.85;
  const titleBoxTop = contentTop + siteBlockHeight + GAP_SITE_TITLE;
  const titleBoxLeft = textX - TITLE_BOX_WIDTH / 2;
  const waveSvg = getWavePatternSvg(waveSeed, w, h);
  const titleFontSizePx = Math.round(titleFontSize);
  const titleLineHeightPx = Math.round(titleLineHeight);
  const titleSpans = titleLines.map((line, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : titleLineHeightPx}" text-anchor="middle">${escapeSvgText(line)}</tspan>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="1" fill="rgba(0,0,0,0.06)"/>
      <circle cx="14" cy="8" r="1" fill="rgba(0,0,0,0.06)"/>
      <circle cx="8" cy="16" r="1" fill="rgba(0,0,0,0.06)"/>
      <circle cx="18" cy="14" r="1" fill="rgba(0,0,0,0.06)"/>
    </pattern>
    <clipPath id="cardTextClip">
      <rect x="${clipX}" y="${clipY}" width="${clipW}" height="${clipH}"/>
    </clipPath>
    <clipPath id="titleBoxClip" clipPathUnits="userSpaceOnUse">
      <rect x="${titleBoxLeft}" y="${titleBoxTop}" width="${TITLE_BOX_WIDTH}" height="${TITLE_BOX_HEIGHT}"/>
    </clipPath>
  </defs>
  <svg x="0" y="0" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${waveSvg.replace(/^\s*<svg[^>]*>\s*/i, '').replace(/\s*<\/svg>\s*$/i, '')}</svg>
  <rect width="${w}" height="${h}" fill="url(#dots)"/>
  <g clip-path="url(#cardTextClip)">
    <g id="card-text-block">
      <text x="${textX}" y="${siteY}" fill="#48484a" font-family="Inter" font-size="${SITE_FONT_SIZE}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${escapeSvgText(displaySite)}</text>
      <g clip-path="url(#titleBoxClip)">
        <text x="${textX}" y="${titleFirstBaseline}" fill="#1c1c1e" font-family="Inter" font-size="${titleFontSizePx}" font-weight="700" text-anchor="middle">${titleSpans}</text>
      </g>
    </g>
  </g>
</svg>`;
}

/** Build responsive HTML card with base64 images and cache headers. */
export function buildCardHtml(opts: {
  title: string | undefined;
  description: string | undefined;
  imageDataUrl: string | null;
  faviconDataUrl: string | null;
  url: string;
  href?: string;
  siteName: string;
  /** Seed for wave pattern/color. If provided, same value always yields same pattern and palette. Prefer siteName or title from query params. */
  waveSeed?: string;
}): string {
  const { title, description, imageDataUrl, faviconDataUrl, url, href, siteName, waveSeed: waveSeedParam } = opts;
  const displayTitle = title ? prepareText(sanitizeForCard(title)) : 'Link';
  const displayDesc = description ? prepareText(sanitizeForCard(description)) : '';
  const displayUrl = prepareText(sanitizeForCard(url));
  const displaySite = prepareText(sanitizeForCard(siteName));
  const showSiteName = !!faviconDataUrl || displayTitle !== displaySite;

  const useWaveBackground = !imageDataUrl;
  // Seed for pattern/color: explicit waveSeed (e.g. from query param) > siteName > URL hostname
  const waveSeed = (() => {
    if (waveSeedParam != null && waveSeedParam !== '') return waveSeedParam;
    if (siteName != null && siteName !== '') return siteName;
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();
  const patternBaseColor = useWaveBackground ? urlToWavePalette(waveSeed).base : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${displayTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; scrollbar-width: none; -ms-overflow-style: none; display: flex; justify-content: center; align-items: center; }
    html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
    .card {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      max-width: 100%;
      background: var(--card-bg);
      color: var(--card-fg);
      overflow: hidden;
      position: relative;
    }
    .card-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: var(--card-image-bg);
      display: block;
    }
    .card-image--gradient {
      background: var(--card-image-bg);
    }
    .card-body {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: clamp(10px, 2.5vw, 18px);
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      max-height: 70%;
      min-width: 0;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.45) 35%, transparent 100%);
      z-index: 1;
    }
    .card-site {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: clamp(0.65rem, 2.2vw, 0.8rem);
      color: var(--card-accent);
    }
    .card-site img { width: 1rem; height: 1rem; border-radius: 4px; flex-shrink: 0; }
    .card-title {
      font-size: clamp(0.75rem, 2.8vw, 1rem);
      font-weight: 600;
      line-height: 1.3;
      color: var(--card-fg);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 0;
      flex-shrink: 0;
			padding-inline: 0.25rem;
			margin-inline: -0.25rem;
    }
    .card-desc {
      font-size: clamp(0.7rem, 2.2vw, 0.85rem);
      line-height: 1.45;
      color: var(--card-fg-muted);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 0;
    }
    .card-url {
      font-size: clamp(0.6rem, 1.8vw, 0.75rem);
      color: var(--card-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-top: auto;
    }
    .card-link {
      display: flex;
      flex-direction: column;
      flex: 1;
			gap: 0.25rem;
      min-height: 0;
      min-width: 0;
      text-decoration: none;
      color: inherit;
      position: relative;
      overflow: hidden;
    }
    /* Neutral overlay: readable on both light and dark images */
    .card-link::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        rgba(0, 0, 0, 0.5) 0%,
        rgba(0, 0, 0, 0.12) 40%,
        transparent 70%
      );
      pointer-events: none;
      z-index: 0.5;
    }
    /* No-image card: wave background, no overlay, centered text, dark text on light */
    .card--no-image .card-link::after { display: none; }
    .card--no-image .card-body {
      position: absolute;
      inset: 0;
      bottom: 0;
      max-height: none;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: none;
      padding: clamp(16px, 4vw, 28px);
    }
    .card--no-image .card-body .card-site,
    .card--no-image .card-body .card-title {
      width: 100%;
      text-align: center;
    }
    .card--no-image .card-body .card-site { justify-content: center; }
    .card--no-image .card-title {
      font-size: clamp(1rem, 4.5vw, 1.5rem);
      -webkit-line-clamp: 3;
    }
    .card--no-image .card-site { justify-content: center; }
    .card-body {
      text-shadow: 0 1px 1px rgba(0, 0, 0, 0.5), 0 0 2px rgba(0, 0, 0, 0.25);
    }
    .card--no-image .card-body { text-shadow: none; }
    .card--no-image .card-body .card-site { color: #48484a; }
    .card--no-image .card-body .card-title { color: #1c1c1e; }
    .card--no-image .card-body .card-desc { color: #48484a; }
    .card--no-image .card-body .card-url { color: #8e8e93; }
    .card-body .card-site { color: rgba(255, 255, 255, 0.85); }
    .card-body .card-title { color: #fff; }
    .card-body .card-desc { color: rgba(255, 255, 255, 0.78); }
    .card-body .card-url { color: rgba(255, 255, 255, 0.65); }
    /* Default: dark theme (gray, similar to base) */
    .card {
      --card-bg: linear-gradient(145deg, #2c2c2c 0%, #242424 100%);
      --card-fg: #e8e8e8;
      --card-fg-muted: #98989d;
      --card-accent: #b0b0b0;
      --card-muted: #636366;
      --card-image-bg: #383838;
    }
    @media (prefers-color-scheme: light) {
      .card {
        --card-bg: linear-gradient(145deg, #f5f5f5 0%, #ebebeb 100%);
        --card-fg: #1c1c1e;
        --card-fg-muted: #48484a;
        --card-accent: #636366;
        --card-muted: #8e8e93;
        --card-image-bg: #e8e8e8;
      }
    }
  </style>
</head>
<body>
  <article class="card${useWaveBackground ? ' card--no-image' : ''}">
    <a class="card-link" href="${escapeHtml(href ?? url)}" target="_blank" rel="noopener noreferrer">
${
  useWaveBackground
    ? `      <div class="card-image card-image--gradient" style="background: ${escapeHtml(getBasicCardWaveBackgroundCss(waveSeed))}; background-color: ${patternBaseColor}"></div>`
    : `      <img class="card-image" src="${imageDataUrl}" alt="">`
}
      <div class="card-body">
${
  showSiteName
    ? `        <div class="card-site">
${faviconDataUrl ? `          <img src="${faviconDataUrl}" alt="">` : ''}
          <span>${displaySite}</span>
        </div>
`
    : ''
}        <h2 class="card-title">${displayTitle}</h2>
      </div>
    </a>
  </article>
</body>
</html>`;
}
