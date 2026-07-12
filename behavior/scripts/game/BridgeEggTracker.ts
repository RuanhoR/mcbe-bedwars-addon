import { Player, world, system, Entity } from "@minecraft/server";
import { TEAM_WOOL_MAP } from "./config";
import { TeamColor } from "../types";

/**
 * Get the wool block ID for a team color, defaulting to white.
 * 获取队伍颜色对应的羊毛方块ID，默认白色。
 */
function getWoolId(teamColor: string): string {
  return TEAM_WOOL_MAP[teamColor as TeamColor] || "minecraft:white_wool";
}

/**
 * Start tracking a bridge egg thrown by the player.
 * 开始追踪玩家投掷的搭桥蛋。
 */
export function startTracking(player: Player): void {
  player.setDynamicProperty("__bw_bridge_egg", true);
  system.run(function() { findEgg(player); });
}

/**
 * Find the egg entity and start placing wool blocks beneath it as it moves.
 * 找到鸡蛋实体并在其下方放置羊毛方块。
 */
function findEgg(player: Player): void {
  var dim = player.dimension;
  var eggs = dim.getEntities({ type: "minecraft:egg", location: player.location, maxDistance: 15 });
  var egg: Entity | null = null;
  for (var i = 0; i < eggs.length; i++) {
    if (!eggs[i].getDynamicProperty("__bw_tracked")) { egg = eggs[i]; break; }
  }
  if (!egg) {
    // Retry up to 30 times if egg not found yet
    var ret = (player.getDynamicProperty("__bw_egg_retry") as number) || 0;
    if (ret < 30) {
      player.setDynamicProperty("__bw_egg_retry", ret + 1);
      system.run(function() { findEgg(player); });
    }
    return;
  }
  var woolId = getWoolId(player.getDynamicProperty("__bw_team") as string);
  (egg as Entity).setDynamicProperty("__bw_tracked", true);

  // Place wool 2 blocks below the egg every tick while it moves
  var runId = system.runInterval(function() {
    if (!(egg as Entity).isValid) {
      system.clearRun(runId);
      player.setDynamicProperty("__bw_bridge_egg", undefined);
      player.setDynamicProperty("__bw_egg_retry", undefined);
      return;
    }
    var pos = (egg as Entity).location;
    for (var dx = -1; dx <= 1; dx++) {
      for (var dz = -1; dz <= 1; dz++) {
        try {
          var bp = dim.getBlock({ x: Math.floor(pos.x) + dx, y: Math.floor(pos.y) - 2, z: Math.floor(pos.z) + dz });
          if (bp && bp.typeId === "minecraft:air") bp.setType(woolId);
        } catch (e) {}
      }
    }
  }, 1);
}
