export type Segment =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  /** A link into the application's own training routes, rendered as a button. */
  | { kind: "session"; text: string; href: string };

const INLINE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;

/**
 * Only a link the application can honour becomes a button. Anything else the
 * model writes — an external URL, a route that does not exist — is left as
 * plain text, so a bad link reads as a mistake rather than acting as one.
 */
function isSessionLink(href: string): boolean {
  return /^\/train\/(reflex|flash|performance|sheet)(\?[^\s]*)?$/.test(href);
}

/** Splits one line into text, bold runs, and session links. */
export function parseInline(line: string): Segment[] {
  const segments: Segment[] = [];
  let index = 0;

  for (const match of line.matchAll(INLINE)) {
    const start = match.index;
    if (start > index) segments.push({ kind: "text", text: line.slice(index, start) });

    const [whole, linkText, href, boldText] = match;
    if (boldText !== undefined) {
      segments.push({ kind: "bold", text: boldText });
    } else if (isSessionLink(href)) {
      segments.push({ kind: "session", text: linkText, href });
    } else {
      segments.push({ kind: "text", text: linkText });
    }
    index = start + whole.length;
  }

  if (index < line.length) segments.push({ kind: "text", text: line.slice(index) });
  return segments;
}

export interface Block {
  /** Bullets are indented and marked; everything else is a paragraph. */
  bullet: boolean;
  segments: Segment[];
}

/** Blank lines separate blocks; a leading dash or asterisk marks a bullet. */
export function parseMessage(text: string): Block[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => {
      const bullet = /^[-*]\s+/.test(line);
      return { bullet, segments: parseInline(bullet ? line.replace(/^[-*]\s+/, "") : line) };
    });
}
