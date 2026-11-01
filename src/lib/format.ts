export interface FormatTokens {
  /** Release group name from the config */
  name: string;
  /** Full package name, only when one package is released */
  package?: string;
  /** Shared version, only when every released package has the same version */
  version?: string;
  /** `pkg@version` list of every released package */
  packages: string;
  /** GitHub run id, to make a branch unique */
  run: string;
}

const TOKENS = ["name", "package", "version", "packages", "run"] as const;

export const formatString = (format: string, tokens: FormatTokens): string =>
  TOKENS.reduce((result, token) => {
    if (!result.includes(`{${token}}`)) return result;
    const value = tokens[token];
    if (value === undefined)
      throw new Error(
        `Token {${token}} in "${format}" has no value here (it needs a single package or a shared version)`,
      );
    return result.replaceAll(`{${token}}`, value);
  }, format);
