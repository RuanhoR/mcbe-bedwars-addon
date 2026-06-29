import App from "./app.mcx";
import "./component/Menu.mcx";
import { createApp, registryCommand } from "@mbler/mcx";
import { world } from "@minecraft/server";
import opCommand from "./command/op";
import hubCommand from "./command/hub";
import joinCommand from "./command/join";
import GameManager from "./game/GameManager";
createApp(
  // @ts-ignore
  App,
).mount(world);
registryCommand(opCommand);
registryCommand(hubCommand);
registryCommand(joinCommand);
GameManager.init();
