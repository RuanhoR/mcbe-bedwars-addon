import { Command } from "@mbler/mcx";
import { CustomCommandStatus } from "@minecraft/server";
import type { I18nKeyList } from "../types";
import GameManager from "../game/GameManager";
import InstanceManager from "../game/InstanceManager";
import { t } from "../i18n/locals";

const command = new Command("bedwars:join");
command.setDescription("Join a bedwars game instance by name");
command.addMandatoryParameter("instanceName", "string");
command.action((origin, instanceName) => {
  if (
    origin.sourceType !== "Entity" ||
    !(origin.sourceEntity?.typeId || "").includes("player")
  ) {
    return {
      message: "err: execute target must be a player",
      status: CustomCommandStatus.Failure,
    };
  }
  const player = origin.sourceEntity! as any;
  if (typeof instanceName !== "string") {
    return {
      message: "err: instanceName must be a string",
      status: CustomCommandStatus.Failure,
    };
  }

  GameManager.init();
  const all = InstanceManager.getInstances();
  const inst = all.find(i => i.name === instanceName);
  if (!inst) {
    return {
      message: t("instanceNotFoundByName", { name: instanceName, available: all.map(i => i.name).join(", ") }),
      status: CustomCommandStatus.Failure,
    };
  }

  const err = GameManager.canJoin(player, inst.id);
  if (err) {
    return {
      message: "§c" + t(err),
      status: CustomCommandStatus.Failure,
    };
  }

  const ok = GameManager.joinGame(player, inst.id);
  if (!ok) {
    return {
      message: t("failedToJoin"),
      status: CustomCommandStatus.Failure,
    };
  }

  return {
    message: "§a" + t("playerJoined", { name: player.name, current: "?", total: String(inst.totalPlayers) }),
    status: CustomCommandStatus.Success,
  };
});
export default command;
