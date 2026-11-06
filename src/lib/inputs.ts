import process from "node:process";

// Composite actions don't expose inputs to scripts: each action.yml maps them to INPUT_<NAME> env vars.
const readInput = (name: string): string =>
  (process.env[`INPUT_${name.toUpperCase().replaceAll("-", "_")}`] ?? "").trim();

export const getString = (name: string, fallback = ""): string => readInput(name) || fallback;

export const getRequired = (name: string): string => {
  const value = readInput(name);
  if (!value) throw new Error(`Input "${name}" is required`);
  return value;
};

export const getBoolean = (name: string, fallback: boolean): boolean => {
  const value = readInput(name).toLowerCase();
  if (!value) return fallback;
  if (["true", "1", "yes"].includes(value)) return true;
  if (["false", "0", "no"].includes(value)) return false;
  throw new Error(`Input "${name}" must be a boolean, got "${value}"`);
};

export const getList = (name: string): string[] => parseList(readInput(name));

export const parseList = (value: string): string[] =>
  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
