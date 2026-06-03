import { getBooleanInput, getInput } from "@actions/core";

export const safeGetBooleanInput = (name: string, fallback: boolean): boolean => {
  try {
    return getBooleanInput(name);
  } catch {
    return fallback;
  }
};

export const safeGetStringInput = (name: string, fallback: string): string => {
  try {
    return getInput(name);
  } catch {
    return fallback;
  }
};
