import { Command } from "@mbler/mcx";
import { CustomCommandStatus } from "@minecraft/server";
import { t } from "../i18n/locals";
import GameManager from "../game/GameManager";

const command = new Command("bedwars:hub");
command.setDescription("Return to the hub/lobby");
command.action((origin) => {
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
  GameManager.sendToHub(player);
  return {
    message: t("teleportedToHub"),
    status: CustomCommandStatus.Success,
  };
});
export default command;
