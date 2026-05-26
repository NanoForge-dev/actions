export interface IPkg {
  name: string;
  version: string;
  path: string;
  private: boolean;
}

export type FormatTokens = { org: string; package?: string; version: string };
