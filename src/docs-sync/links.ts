import { posix } from "path";

import { PAGE_FILE } from "./navigation";

export interface LinkContext {
  /** Page paths of the folder, without extension */
  pages: Set<string>;
  /** Every file of the folder (relative paths) */
  files: Set<string>;
  /** Site path of the folder, without leading slash: `docs/engine` */
  prefix: string;
}

// `[text](target "title")`, `![alt](<target>)`
// Matches from "](" only: link text may hold inline code (TypeDoc's [`Foo`](Foo.mdx)), which splits the line.
const MARKDOWN_LINK = /(\]\(\s*)(<[^>]*>|[^)\s]+)(?=\s*(?:\s["'][^)]*)?\))/g;
const ATTRIBUTE = /(\b(?:href|src)=)(["'])(.*?)\2/g;
const CODE_SPAN = /(`+)(?:(?!\1)[\s\S])*?\1/g;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Absolute site URL of a relative `target` written in `file`, or the reason it can't be resolved. */
const resolve = (
  target: string,
  file: string,
  context: LinkContext,
): { url: string } | { problem: string } | undefined => {
  // Absolute paths, anchors, schemes (http:, mailto:...) and protocol-relative URLs stay as they are.
  if (!target || /^[/#]/.test(target) || /^[a-z][a-z0-9+.-]*:/i.test(target)) return undefined;
  const cut = target.search(/[?#]/);
  const path = cut === -1 ? target : target.slice(0, cut);
  const suffix = cut === -1 ? "" : target.slice(cut);
  const resolved = posix.normalize(posix.join(posix.dirname(file), path)).replace(/\/$/, "");
  if (resolved === ".." || resolved.startsWith("../"))
    return { problem: `"${target}" leaves the synced folder` };
  const page = resolved.replace(PAGE_FILE, "");
  if (context.pages.has(page)) return { url: `/${context.prefix}/${page}${suffix}` };
  if (!PAGE_FILE.test(resolved) && context.files.has(resolved))
    return { url: `/${context.prefix}/${resolved}${suffix}` };
  return { problem: `"${target}" is not a page or file of the synced folder` };
};

/** Applies `rewrite` to the parts of `line` outside inline code spans. */
const rewriteOutsideCode = (line: string, rewrite: (text: string) => string): string => {
  let out = "";
  let last = 0;
  for (const match of line.matchAll(CODE_SPAN)) {
    out += rewrite(line.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  return out + rewrite(line.slice(last));
};

/**
 * Rewrites the relative links and images of a .md/.mdx `file` (markdown links and href/src attributes) to absolute
 * site paths. Fenced code blocks and inline code are left alone. Returns the new content and the unresolved links.
 */
export const rewriteLinks = (
  content: string,
  file: string,
  context: LinkContext,
): { content: string; problems: string[] } => {
  const problems: string[] = [];
  let fence: string | undefined;

  const lines = content.split("\n").map((line, index) => {
    const marker = FENCE.exec(line)?.[1];
    if (fence) {
      // A fence closes on the same character, at least as long, with nothing after it.
      if (
        marker &&
        marker[0] === fence[0] &&
        marker.length >= fence.length &&
        !line.trim().slice(marker.length).trim()
      )
        fence = undefined;
      return line;
    }
    if (marker) {
      fence = marker;
      return line;
    }
    const replace = (target: string): string => {
      const result = resolve(target, file, context);
      if (!result) return target;
      if ("problem" in result) {
        problems.push(`${file}:${index + 1}: link ${result.problem}`);
        return target;
      }
      return result.url;
    };
    // Inline code is kept as is.
    return rewriteOutsideCode(line, (text) =>
      text
        .replace(MARKDOWN_LINK, (_, open: string, target: string) =>
          target.startsWith("<")
            ? `${open}<${replace(target.slice(1, -1))}>`
            : `${open}${replace(target)}`,
        )
        .replace(
          ATTRIBUTE,
          (_, open: string, quote: string, target: string) =>
            `${open}${quote}${replace(target)}${quote}`,
        ),
    );
  });
  return { content: lines.join("\n"), problems };
};
