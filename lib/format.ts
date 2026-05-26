import type { FormatTokens } from "./types";

export const formatString = (format: string, tokens: FormatTokens): string => {
  let result = format.replaceAll("{org}", tokens.org).replaceAll("{version}", tokens.version);
  if (tokens.package !== undefined) {
    result = result.replaceAll("{package}", tokens.package);
  }
  return result;
};

export const extractTokens = (packageNames: string[], version: string): FormatTokens => {
  const [org, pkg] = packageNames[0]?.split("/") ?? [];
  return {
    org: org ?? "",
    package: packageNames.length === 1 ? (pkg ?? org ?? "") : undefined,
    version,
  };
};
