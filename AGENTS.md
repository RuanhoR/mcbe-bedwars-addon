# Bedwars Addon — Agent Guide

## Build Commands

```bash
pnpm build          # Production build (cross-env BUILD_MODULE=release mbler build)
pnpm dev-build      # Dev build (mbler build)
pnpm dev            # Watch mode (mbler watch)
pnpm type-check     # TypeScript type check (mcx-tsc)
```

Output: `dist/dep/` (behavior pack), `dist/res/` (resource pack), `dist.mcaddon`

## Project Structure

```
behavior/scripts/
├── index.ts                 # Entry point: createApp, registryCommand, GameManager.init()
├── app.mcx                  # App mount + event subscription
├── event.mcx                # Event handlers (bed break, item use, death, spawn)
├── types.ts                 # Type definitions + i18n key list
├── version.ts               # Auto-generated version
├── i18n/locals.ts           # Translation dictionary (zh/en) + t() helper
├── utils/
│   ├── language.ts          # getCurrentLanguage(), setGlobalLanguage()
│   └── playerPermission.ts  # OP management via dynamic properties
├── game/
│   ├── GameManager.ts       # Core game loop, win logic, respawn, endGame
│   ├── InstanceManager.ts   # Instance CRUD, map loading, position resolution
│   ├── ShopManager.ts       # Shop UI and purchase logic
│   ├── BridgeEggTracker.ts  # Bridge egg block placement
│   └── config.ts            # Map layouts, shop items, constants, TEAM_WOOL_MAP
├── command/
│   ├── op.ts                # /bedwars:bwop
│   ├── join.ts              # /bedwars:join
│   └── hub.ts               # /bedwars:hub
├── form/
│   ├── manager.mcx          # Main OP menu
│   ├── opmanger.mcx         # OP add/remove
│   └── bedwarsManager.mcx   # Instance management UI
└── component/
    └── Menu.mcx             # bedwars:menu item
```

## Code Conventions

- **TypeScript** with `@mbler/mcx` SFC framework (`.mcx` files)
- Use `pnpm` (not npm/yarn)
- **All user-facing strings** must use `t("key", { ... })` from i18n/locals.ts
- Color codes use section sign `§` prefix
- Dynamic properties (world-scoped) for persistence: `__Oplist`, `__Global_language`, `__BedwarsData`
- Player-scoped dynamic properties: `__bw_team`, `__bw_instance`, `__bw_alive`, `__bw_spectator`, `__bw_respawning`

## i18n System

### Adding a new translation key:
1. Add key to `I18nKeyList` union type in `types.ts`
2. Add `zh` and `en` entries in `i18n/locals.ts`

```typescript
// types.ts
| "yourNewKey"

// locals.ts — zh section
yourNewKey: "§a中文文本",
// locals.ts — en section
yourNewKey: "§aEnglish text",
```

### Usage:
```typescript
import { t } from "../i18n/locals";
player.sendMessage(t("yourNewKey", { placeholder: "value" }));
```

- `.mcx` template variables use `{{ key }}` syntax, passed from `app.ui.show(player, { key: t("...") })`

## Team Colors

Use `getTeamColorName(color)` instead of old `TEAM_COLOR_NAMES[color]`. It returns the color-coded translated name (e.g. `§c红` or `§cRed`).

Available colors: `red`, `blue`, `yellow`, `white`, `green`

## Game Flow

1. OP creates instance → loads map structures → resolves positions from armor stands
2. Players `/bedwars:join <name>` → assigned to teams → teleported to spawn island
3. Game starts → countdown → teleport to beds → set survival → spawn shop villagers
4. Tick loop (every 10 ticks): spawn resources, protect villagers, update scoreboard, check win
5. Bed destroyed → alive team members → spectators + explosion effect
6. Player dies → if bed alive: respawn after countdown; if bed dead: spectator mode
7. Win: only 1 team has alive (non-spectator) players → broadcast winner → endGame()
8. endGame: clear inventories, kill villagers/fireballs, teleport to spawn island, clear map

## Common Patterns

```typescript
// Get instance data
const inst = InstanceManager.getInstance(instanceId);

// Update instance
InstanceManager.updateInstance(instanceId, (inst) => { inst.x = val; });

// Send translated message
world.sendMessage(t("key", { param: value }));

// Teleport player
player.teleport({ x, y, z }, { dimension: world.getDimension("overworld") });

// Dynamic properties
player.setDynamicProperty("__bw_key", value);
player.getDynamicProperty("__bw_key");
```
