export interface Coverage {
  lines: { hit: number; found: number };
  functions: { hit: number; found: number };
  branches: { hit: number; found: number };
}

const empty = (): Coverage => ({
  lines: { hit: 0, found: 0 },
  functions: { hit: 0, found: 0 },
  branches: { hit: 0, found: 0 },
});

const KEYS: Record<string, [keyof Coverage, "hit" | "found"]> = {
  LH: ["lines", "hit"],
  LF: ["lines", "found"],
  FNH: ["functions", "hit"],
  FNF: ["functions", "found"],
  BRH: ["branches", "hit"],
  BRF: ["branches", "found"],
};

/** Totals of an lcov report (vitest, bun test, c8...): the sum of its per-file LF/LH, FNF/FNH and BRF/BRH. */
export const parseLcov = (content: string): Coverage => {
  const total = empty();
  for (const line of content.split(/\r?\n/)) {
    const match = /^([A-Z]+):(\d+)$/.exec(line.trim());
    const key = match && KEYS[match[1] as string];
    if (key) total[key[0]][key[1]] += Number(match[2]);
  }
  return total;
};

export const percent = ({ hit, found }: { hit: number; found: number }): string =>
  found ? `${((hit / found) * 100).toFixed(2)}%` : "n/a";

export const coverageLine = (name: string, coverage: Coverage): string =>
  `\`${name}\`: lines ${percent(coverage.lines)} (${coverage.lines.hit}/${coverage.lines.found}), functions ${percent(coverage.functions)}, branches ${percent(coverage.branches)}`;
