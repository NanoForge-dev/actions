import { setFailed, setOutput, warning } from "@actions/core";
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { dirname, relative } from "path";

import { type Coverage, coverageLine, parseLcov, percent } from "../lib/coverage";
import { getString } from "../lib/inputs";
import { writeSummary } from "../lib/summary";

const main = async () => {
  const pattern = getString("files", "**/coverage/lcov.info");
  const files = [...new Glob(pattern).scanSync({ dot: false })]
    .filter((file) => !file.split(/[\\/]/).includes("node_modules"))
    .sort();
  if (!files.length) warning(`No coverage report matches "${pattern}"`);

  const total: Coverage = parseLcov("");
  const lines = files.map((file) => {
    const coverage = parseLcov(readFileSync(file, "utf-8"));
    for (const key of ["lines", "functions", "branches"] as const) {
      total[key].hit += coverage[key].hit;
      total[key].found += coverage[key].found;
    }
    // A report lives in <package>/coverage/: name it after its package.
    return coverageLine(relative(".", dirname(dirname(file))) || ".", coverage);
  });

  setOutput("lines", percent(total.lines));
  await writeSummary(`Coverage: ${percent(total.lines)} of lines`, false, [
    ["Total", files.length ? [coverageLine("all", total)] : []],
    ["Packages", files.length > 1 ? lines : []],
  ]);
};

main().catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));
