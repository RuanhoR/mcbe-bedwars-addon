import App from "./app.mcx";
import "./component/Menu.mcx";
import { createApp, registryCommand } from "@mbler/mcx";
import { world, system, PlayerBreakBlockAfterEvent } from "@minecraft/server";
import opCommand from "./command/op";
import hubCommand from "./command/hub";
import joinCommand from "./command/join";
import GameManager from "./game/GameManager";
import InstanceManager from "./game/InstanceManager";
import { t } from "./i18n/locals";
import { TEAM_COLOR_NAMES } from "./game/config";
createApp(
  // @ts-ignore
  App,
).mount(world);
registryCommand(opCommand);
registryCommand(hubCommand);
registryCommand(joinCommand);
GameManager.init();

world.afterEvents.playerBreakBlock.subscribe((event: PlayerBreakBlockAfterEvent) => {
  const block = event.block;
  const typeId = event.brokenBlockPermutation.type.id;
  if (!typeId.endsWith("_bed") && typeId !== "minecraft:bed") return;
  const pos = { x: block.x, y: block.y, z: block.z };

  system.run(() => {
    for (const inst of InstanceManager.getInstances()) {
      if (inst.status !== "playing") continue;
      for (const team of inst.teams) {
        if (!team.bedAlive || !team.bedPosition) continue;
        const bp = team.bedPosition;
        if (Math.abs(bp.x - pos.x) <= 2 && Math.abs(bp.z - pos.z) <= 2 && Math.abs(bp.y - pos.y) <= 1) {
          team.bedAlive = false;
          InstanceManager.updateInstance(inst.id, () => {});
          world.sendMessage(t("bedDestroyed", { color: TEAM_COLOR_NAMES[team.color] }));
          try {
            const dim = world.getDimension("overworld");
            dim.runCommand(`particle minecraft:large_explosion ${bp.x} ${bp.y} ${bp.z}`);
            dim.runCommand(`playsound random.explode @a ${bp.x} ${bp.y} ${bp.z} 1.0 1.0`);
          } catch { }
          for (const playerId of team.players) {
            const p = world.getEntity(playerId) as any;
            if (!p) continue;
            if (p.getDynamicProperty("__bw_alive") === false) continue;
            p.setDynamicProperty("__bw_spectator", true);
            p.setDynamicProperty("__bw_alive", false);
            try { p.setGameMode(0 as any); } catch { }
            p.sendMessage(t("bedDestroyedMsg"));
          }
          return;
        }
      }
    }
  });
});
