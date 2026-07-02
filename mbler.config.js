// @ts-check
import fs from "node:fs/promises"
import { defineConfig } from "mbler";
import path from "node:path";
export default defineConfig({
  description: "起床战争 mcaddon",
  mcVersion: "1.26.31",
  name: "@ruanhor/bed-wars",
  version: "0.0.1",
  displayName: "起床战争.mcaddon",
  minify: "oxc",
  script: { main: "index.ts", ui: true, lang: "mcx", UseBeta: false },
  build: {
    bundle: true, cache: "file",
    async onStart() {
      const pkgJSON = JSON.parse(await fs.readFile(path.resolve("./package.json"), "utf-8"));
      await fs.writeFile(path.resolve("behavior/scripts/version.ts"), `export const version = '${pkgJSON.version}'`)
    }
  },
  outdir: {
    resources:
      "C:\\Users\\zcvb1\\AppData\\Roaming\\Minecraft Bedrock\\users\\shared\\games\\com.mojang\\development_resource_packs\\bedwar",
    behavior:
      "C:\\Users\\zcvb1\\AppData\\Roaming\\Minecraft Bedrock\\users\\shared\\games\\com.mojang\\development_behavior_packs\\bedwars",
    dist: "./dist.mcaddon",
  },
});
