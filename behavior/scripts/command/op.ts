import { Command } from "@mbler/mcx";
import {
  CommandPermissionLevel,
  CustomCommandStatus,
  world,
} from "@minecraft/server";
import { addOp, getOnlineOps, removeOp } from "../utils/playerPermission";

const command = new Command("bedwars:op");
command.setDescription("Set bedwars OP Manger");
command.addMandatoryParameter("optional", "string");
command.addOptionalParameter("playerName", "string");
command.setPermissionLevel(CommandPermissionLevel.Admin);
command.action((origin, _optional, playerName) => {
  if (
    typeof _optional !== "string" ||
    !["add", "list", "remove"].includes(_optional)
  ) {
    return {
      message: "error: optional params is not in ['add', 'list', 'remove']",
      status: CustomCommandStatus.Failure,
    };
  }
  if (_optional == "add") {
    const players = world.getPlayers({
      name: typeof playerName == "string" ? playerName : void 0,
    });
    if (typeof playerName !== "string" || players.length < 1) {
      return {
        message:
          "error: playerName cannot be emtry or player not found in online players",
        status: CustomCommandStatus.Failure,
      };
    }
    addOp(players[0]);
    return {
      message: "success: has been as op",
      status: CustomCommandStatus.Success,
    };
  }
  if (_optional == "remove") {
    const players = world.getPlayers({
      name: typeof playerName == "string" ? playerName : void 0,
    });
    if (typeof playerName !== "string" || players.length < 1) {
      return {
        message:
          "error: playerName cannot be emtry or player not found in online players",
        status: CustomCommandStatus.Failure,
      };
    }
    removeOp(players[0]);
    return {
      message: "success: has been remove from op",
      status: CustomCommandStatus.Success,
    };
  }
  if (_optional == "list") {
    return {
      message: `success: op list: ${getOnlineOps()
        .map((player) => player.name)
        .join(", ")}`,
      status: CustomCommandStatus.Success,
    };
  }
});
export default command;
