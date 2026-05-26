import { getBooleanInput } from "@actions/core";

export const safeGetBooleanInput = (name: string, fallback: boolean): boolean => {
  try {
    return getBooleanInput(name);
  } catch {
    return fallback;
  }
};
