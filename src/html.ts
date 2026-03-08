export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Remove emoji and characters that may not display correctly (keep letters, numbers, spaces, safe punctuation). */
export function sanitizeForCard(s: string): string {
	return s
		.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F650}-\u{1F67F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}]/gu, '')
		.replace(/[^\p{L}\p{N}\s.,!?'\-":;()\u2013\u2014]/gu, '');
}

/** Single line, trimmed, collapse internal whitespace. */
export function prepareText(s: string): string {
	return s.trim().replace(/\s+/g, ' ');
}
