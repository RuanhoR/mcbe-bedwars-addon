import { Command } from "@mbler/mcx";
import { CustomCommandStatus } from "@minecraft/server";
import GameManager from "../game/GameManager";
import InstanceManager from "../game/InstanceManager";

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
  const inst = InstanceManager.getInstances().find(i => i.name === instanceName);
  if (!inst) {
    return {
      message: "§cInstance not found: " + instanceName,
      status: CustomCommandStatus.Failure,
    };
  }

  const ok = GameManager.joinGame(player, inst.id);
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
