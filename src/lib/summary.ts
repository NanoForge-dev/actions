import { summary } from "@actions/core";

/** A heading with its lines; an empty list is shown as "None". */
export type SummarySection = [heading: string, lines: string[]];

export const writeSummary = async (
  title: string,
  dry: boolean,
  sections: SummarySection[],
): Promise<void> => {
  const result = summary.addHeading(title);
  if (dry) result.addRaw("\n\n> [!NOTE]\n> This is a dry run.\n\n");

  for (const [heading, lines] of sections) {
    result.addHeading(heading, 2);
    if (!lines.length) result.addRaw("\n_None_\n\n");
    else result.addRaw(`\n${lines.map((line) => `- ${line}`).join("\n")}\n\n`);
  }

  await result.write();
};
