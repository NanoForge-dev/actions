import { expect, test } from "bun:test";

import { coverageLine, parseLcov, percent } from "./coverage";

const LCOV = `TN:
SF:src/a.ts
FNF:2
FNH:1
DA:1,1
LF:10
LH:8
BRF:4
BRH:2
end_of_record
SF:src/b.ts
FNF:2
FNH:2
LF:10
LH:10
end_of_record
`;

test("parseLcov sums every file of the report", () => {
  expect(parseLcov(LCOV)).toEqual({
    lines: { hit: 18, found: 20 },
    functions: { hit: 3, found: 4 },
    branches: { hit: 2, found: 4 },
  });
});

test("coverageLine shows n/a for a metric the report doesn't have", () => {
  expect(percent({ hit: 0, found: 0 })).toBe("n/a");
  expect(coverageLine("packages/core", parseLcov("SF:a\nLF:4\nLH:3\nend_of_record\n"))).toBe(
    "`packages/core`: lines 75.00% (3/4), functions n/a, branches n/a",
  );
});
