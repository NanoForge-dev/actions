/** A Mintlify navigation item: a page path or a group. Keys other than `pages` and `root` pass through. */
export type NavItem = string | NavGroup;

export interface NavGroup {
  group: string;
  pages: NavItem[];
  root?: string;
  [key: string]: unknown;
}

export const PAGE_FILE = /\.mdx?$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Why `path` is not a clean relative page path, or undefined when it is. */
export const pathProblem = (path: unknown): string | undefined => {
  if (typeof path !== "string" || !path) return "must be a non-empty string";
  if (path.startsWith("/") || /^[a-z]:/i.test(path) || path.includes("\\"))
    return "must be a relative path with / separators";
  const segments = path.split("/");
  if (segments.includes("..")) return "must not contain ..";
  if (segments.some((segment) => segment === "" || segment === "."))
    return "must be a clean path (no ./, // or trailing /)";
  if (segments.some((segment) => segment.startsWith(".")))
    return "must not point into a dot-folder";
  if (PAGE_FILE.test(path)) return "must not have an extension";
  return undefined;
};

/**
 * Checks a navigation.json against the files of its folder (relative paths): every page listed exists as .mdx
 * or .md, and every .md/.mdx file is listed exactly once. Returns the problems, empty when valid.
 */
export const validateNavigation = (nav: unknown, files: string[]): string[] => {
  const problems: string[] = [];
  const listed = new Map<string, number>();

  const add = (path: unknown, at: string) => {
    const problem = pathProblem(path);
    if (problem) problems.push(`navigation.json ${at}: "${String(path)}" ${problem}`);
    else listed.set(path as string, (listed.get(path as string) ?? 0) + 1);
  };
  const visit = (items: unknown, at: string) => {
    if (!Array.isArray(items)) {
      problems.push(`navigation.json ${at} must be an array`);
      return;
    }
    items.forEach((item, index) => {
      const where = `${at}[${index}]`;
      if (typeof item === "string") return add(item, where);
      if (!isObject(item) || typeof item.group !== "string") {
        problems.push(
          `navigation.json ${where} must be a page path or a { "group", "pages" } object`,
        );
        return;
      }
      if (item.root !== undefined) add(item.root, `${where}.root`);
      visit(item.pages, `${where}.pages`);
    });
  };
  visit(nav, "");

  const pages = new Map<string, string[]>();
  for (const file of files.filter((path) => PAGE_FILE.test(path))) {
    const slug = file.replace(PAGE_FILE, "");
    pages.set(slug, [...(pages.get(slug) ?? []), file]);
    if (/^readme\.mdx?$/i.test(file.split("/").at(-1) ?? ""))
      problems.push(`${file}: no README in a docs folder (it would be a public page)`);
  }
  for (const [slug, sources] of pages)
    if (sources.length > 1)
      problems.push(`${sources.join(" and ")}: two files for the page ${slug}`);
  for (const [path, count] of listed) {
    if (!pages.has(path))
      problems.push(`navigation.json lists "${path}": no ${path}.mdx or ${path}.md`);
    if (count > 1) problems.push(`navigation.json lists "${path}" ${count} times`);
  }
  for (const [slug, sources] of pages)
    if (!listed.has(slug)) problems.push(`${sources[0]}: not listed in navigation.json`);
  return problems;
};

/** The navigation with every page path (and group root) prefixed by `prefix/`. */
export const prefixNavigation = (items: NavItem[], prefix: string): NavItem[] =>
  items.map((item) =>
    typeof item === "string"
      ? `${prefix}/${item}`
      : {
          ...item,
          ...(item.root === undefined ? {} : { root: `${prefix}/${item.root}` }),
          pages: prefixNavigation(item.pages, prefix),
        },
  );
