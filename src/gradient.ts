/** Stable hash from string for deterministic palette. */
function hashString(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
	return h >>> 0;
}

/** HSL to hex (h 0–360, s/l 0–100). */
function hsl(h: number, s: number, l: number): string {
	s /= 100;
	l /= 100;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return Math.round(255 * c)
			.toString(16)
			.padStart(2, '0');
	};
	return `#${f(0)}${f(8)}${f(4)}`;
}

/** Triadic hues from seed: [h, h+120, h+240] in [0, 360). */
function triadicHues(seed: number): [number, number, number] {
	const h = (seed % 360 + 360) % 360;
	return [h, (h + 120) % 360, (h + 240) % 360];
}

export type WavePalette = {
	base: string;
	wave1: string;
	wave2: string;
	wave3: string;
};

export function urlToWavePalette(hostnameOrSeed: string): WavePalette {
	const seed = hashString(hostnameOrSeed);
	const [h1] = triadicHues(seed);
	const s1 = (seed >> 8) & 0xff;
	const s2 = (seed >> 16) & 0xff;
	// Base: very light, low saturation (card background)
	const base = hsl(h1, 12 + (seed % 10), 94 + (seed % 4));
	// Three tones of the same hue: lightest, mid, richest (same H, stepped S/L)
	const sat = 40 + (s1 % 35); // 40–75%
	const wave1 = hsl(h1, sat, 82 + (s1 % 10)); // lightest tone
	const wave2 = hsl(h1, sat + (s2 % 15), 68 + (s2 % 12)); // mid tone
	const wave3 = hsl(h1, Math.min(85, sat + 15 + (seed % 10)), 58 + (seed % 14)); // richest tone
	return { base, wave1, wave2, wave3 };
}
