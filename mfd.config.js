// @ts-check
import { defineConfig } from "@mbler/mfd";

export default defineConfig({
  // display strings: plain string or { zh, en }
  title: { zh: "起床战争", en: "Bed Wars" },
  mcVersion: { min: "1.26.30", max: "1.26.50" },
  description: {
    zh: `# 起床战争 (Bed Wars)

Minecraft 基岩版**起床战争**玩法模组。

## 特性

- 完整的起床战争玩法流程
- 基于 \`@minecraft/server\` 的 SAPI 脚本（mcx DSL 构建）
- 由 [mbler](https://github.com/RuanhoR/mbler) 构建打包

## 仓库

GitHub: [mcbe-bedwars-addon](https://github.com/RuanhoR/mcbe-bedwars-addon)

## 安装

选择与你的 Minecraft 版本匹配的 \`dist.mcaddon\` 下载后导入游戏即可。
`,
    en: `# Bed Wars

A Bed Wars gameplay addon for Minecraft Bedrock Edition.

## Features

- Complete bed wars gameplay
- SAPI scripts built with the mcx DSL
- Built with [mbler](https://github.com/RuanhoR/mbler)

## Repository

GitHub: [mcbe-bedwars-addon](https://github.com/RuanhoR/mcbe-bedwars-addon)

## Install

Download the \`dist.mcaddon\` matching your Minecraft version and import it into the game.
`,
  },
  entryAddonManifest: "/assets/manifest.addon.json",
  entryDistAddon: "/assets/dist.mcaddon",
  // 页面部署的 url 基础路径：产物落在 dist-page/bed-wars/ 下：
  base: "/bed-wars/",
  // mfd page 的输出目录 / 构建产物，mfd serve 的端口：
  distEntry: "./dist-page",
  addon: "./dist.mcaddon",
  isBeta: true,
  port: 9527,
  // override built-in ui strings:
  i18n: {
    download: { zh: "下载起床战争", en: "Download Bed Wars" },
    tagline: { zh: "起床战争下载站", en: "Bed Wars downloads" },
  },
});
