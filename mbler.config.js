// @ts-check
import fs from "node:fs/promises";
import { defineConfig } from "mbler";
import path from "node:path";
export default defineConfig({
  description: "Bedwar.mcaddon",
  mcVersion: "1.26.40",
  displayName: "起床战争.mcaddon",
  minify: "none",
  outGameOnDev: true,
  script: { main: "index.ts", ui: true, lang: "mcx", UseBeta: true },
  build: {
    bundle: true,
    cache: "file",
    async onStart() {
      const pkgJSON = JSON.parse(
        await fs.readFile(path.resolve("./package.json"), "utf-8"),
      );
      await fs.writeFile(
        path.resolve("behavior/scripts/version.ts"),
        `export const version = '${pkgJSON.version}'`,
      );
    },
  },
  outdir: {
    resources: "./dist/res",
    behavior: "./dist/dep",
    dist: "./dist.mcaddon",
  },
});
