import { Command } from "@mbler/mcx";
import { CustomCommandStatus } from "@minecraft/server";
import GameManager from "../game/GameManager";
import InstanceManager from "../game/InstanceManager";

const command = new Command("bedwars:join");
command.setDescription("Join a bedwars game instance");
command.addMandatoryParameter("instanceId", "string");
command.action((origin, instanceId) => {
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
  if (typeof instanceId !== "string") {
    return {
      message: "err: instanceId must be a string",
      status: CustomCommandStatus.Failure,
    };
  }

  GameManager.init();
  const inst = InstanceManager.getInstance(instanceId);
  if (!inst) {
    return {
      message: "§cInstance not found: " + instanceId,
      status: CustomCommandStatus.Failure,
    };
  }

  const ok = GameManager.joinGame(player, instanceId);
  if (!ok) {
    return {
      message: "§cFailed to join game",
      status: CustomCommandStatus.Failure,
    };
  }

  return {
    message: "§aJoined bedwars instance: " + inst.name,
    status: CustomCommandStatus.Success,
  };
});
export default command;
