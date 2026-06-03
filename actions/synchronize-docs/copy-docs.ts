import * as fs from "node:fs";
import { join } from "path";

const copyPart = (src: string, dist: string) => {
  try {
    fs.readdirSync(src).forEach((file) => {
      fs.cpSync(join(src, file), join(dist, file), { recursive: true });
    });
  } catch {
    console.error(`Failed to copy ${src} to ${dist}`);
  }
};

export const copyDocs = (src: string, dist: string, cat: string) => {
  copyPart(join(src, "docs"), join(dist, "docs", cat));
  copyPart(join(src, "guides"), join(dist, "guides", cat));
};
