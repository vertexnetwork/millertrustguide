// Split a paragraph into its first sentence (the "lead") and the remainder.
//
// Used to mark a short (typically ≤30-word) speakable lead on FAQ answers so
// voice assistants and AI answer engines lift ONE clean sentence instead of a
// full multi-sentence paragraph. The visible text is unchanged — we render
// lead + rest back to back; only the wrapping <span class="faq-answer__lead">
// changes, which the Speakable JSON-LD selector targets.

// Common abbreviations whose trailing period must NOT end the sentence.
const ABBREV = /(?:^|\s)(e\.g|i\.e|U\.S|Inc|vs|etc|Dr|Mr|Mrs|Ms|St|Ave|No|Sec|Art|Appx)$/i;

export function firstSentence(text: string): { lead: string; rest: string } {
  const re = /([.!?])\s+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const head = text.slice(0, m.index + 1); // include the terminator
    const beforeDot = text.slice(0, m.index); // text up to (not incl.) the "."
    // Skip false breaks: abbreviations ("e.g. ") and decimals ("$1,491.00 ").
    if (ABBREV.test(beforeDot)) continue;
    if (m[1] === '.' && /\d$/.test(beforeDot) && /^\d/.test(text.slice(m.index + 1).trimStart())) continue;
    return { lead: head, rest: text.slice(m.index + 1).trimStart() };
  }
  return { lead: text, rest: '' };
}
