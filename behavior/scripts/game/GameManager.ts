import { Player, world, system, GameMode, Entity, ItemStack } from "@minecraft/server";
import { BedwarsInstanceData, TeamColor } from "../types";
import InstanceManager from "./InstanceManager";
import ShopManager from "./ShopManager";
import { TEAM_WOOL_MAP, TEAM_COLOR_NAMES, MAP_Y } from "./config";

const PLAYER_TEAM_KEY = "__bw_team";
const PLAYER_INSTANCE_KEY = "__bw_instance";
const PLAYER_IS_ALIVE_KEY = "__bw_alive";
const PLAYER_IS_SPECTATOR_KEY = "__bw_spectator";

class GameManager {
  private static _gameLoopId: number | null = null;
  private static _runningGames: Set<string> = new Set();

  static init() {
    if (this._gameLoopId !== null) return;
    system.runInterval(() => {
      this._tick();
    }, 10);
  }

  private static _tick() {
    const instances = InstanceManager.getInstances().filter(i => i.status === "playing");
    for (const inst of instances) {
      this._spawnResources(inst);
      this._checkPlayerFalls(inst);
      this._protectShopBees(inst);
    }
  }

  private static _protectShopBees(inst: BedwarsInstanceData) {
    const dim = world.getDimension("overworld");
    const bees = dim.getEntities({ type: "minecraft:bee" });
    for (const bee of bees) {
      if (bee.getDynamicProperty("__bw_instance") !== inst.id) continue;
      try {
        bee.addEffect("slowness", 1200, { amplifier: 255, showParticles: false });
        bee.addEffect("regeneration", 1200, { amplifier: 255, showParticles: false });
        bee.addEffect("health_boost", 1200, { amplifier: 255, showParticles: false });
        bee.addEffect("resistance", 1200, { amplifier: 255, showParticles: false });
      } catch { }
    }
  }

  private static _spawnResources(inst: BedwarsInstanceData) {
    const dim = world.getDimension("overworld");
    for (const team of inst.teams) {
      if (team.ironPosition) {
        dim.spawnItem(new ItemStack("minecraft:iron_ingot", 1), team.ironPosition);
      }
      if (team.goldPosition) {
        dim.spawnItem(new ItemStack("minecraft:gold_ingot", 1), team.goldPosition);
      }
      if (team.diamondPosition) {
        dim.spawnItem(new ItemStack("minecraft:diamond", 1), team.diamondPosition);
      }
    }
  }

  private static _checkPlayerFalls(inst: BedwarsInstanceData) {
    const initY = MAP_Y;
    for (const team of inst.teams) {
      for (const playerId of team.players) {
        const player = world.getEntity(playerId) as Player;
        if (!player) continue;
        const loc = player.location;
        if (loc.y < initY - 5) {
          const initPos = { x: inst.initIslandX, y: initY + 5, z: inst.initIslandZ };
          player.teleport(initPos, { dimension: world.getDimension("overworld") });
        }
      }
    }
  }

  static canJoin(player: Player, instanceId: string): string | null {
    const inst = InstanceManager.getInstance(instanceId);
    if (!inst) return "instanceNotFound";
    const existing = InstanceManager.getPlayerInstance(player.id);
    if (existing) return "alreadyInGame";
    if (inst.status !== "idle" && inst.status !== "waiting") return "gameStarted";
    return null;
  }

  static joinGame(player: Player, instanceId: string): boolean {
    const err = this.canJoin(player, instanceId);
    if (err) {
      player.sendMessage(`§c${err}`);
      return false;
    }
    const inst = InstanceManager.getInstance(instanceId)!;
    if (inst.status === "idle") {
      InstanceManager.setInstanceStatus(instanceId, "waiting");
    }

    const availableTeams = inst.teams.filter(t => t.players.length < inst.playersPerTeam);
    if (availableTeams.length === 0) {
      player.sendMessage("§c所有队伍已满");
      return false;
    }
    const team = availableTeams[0];

    team.players.push(player.id);
    InstanceManager.updateInstance(instanceId, () => {});

    player.setDynamicProperty(PLAYER_TEAM_KEY, team.color);
    player.setDynamicProperty(PLAYER_INSTANCE_KEY, instanceId);
    player.setDynamicProperty(PLAYER_IS_ALIVE_KEY, true);
    player.setDynamicProperty(PLAYER_IS_SPECTATOR_KEY, false);

    const dim = world.getDimension("overworld");
    const initX = inst.initIslandX;
    const initZ = inst.initIslandZ;
    player.teleport({ x: initX, y: MAP_Y + 5, z: initZ }, { dimension: dim });
    player.setGameMode(GameMode.Adventure);

    const totalPlayers = inst.teams.reduce((s, t) => s + t.players.length, 0);
    world.sendMessage(`§e${player.name} 已加入游戏 (§b${inst.name}§e) (§a${totalPlayers}/${inst.totalPlayers}§e)`);

    if (totalPlayers >= inst.totalPlayers) {
      system.runTimeout(() => {
        this.startGame(instanceId);
      }, 100);
    }

    return true;
  }

  static startGame(instanceId: string) {
    const inst = InstanceManager.getInstance(instanceId);
    if (!inst) return;
    if (this._runningGames.has(instanceId)) return;
    this._runningGames.add(instanceId);

    InstanceManager.setInstanceStatus(instanceId, "playing");
    const dim = world.getDimension("overworld");

    for (const team of inst.teams) {
      for (const playerId of team.players) {
        const player = world.getEntity(playerId) as Player;
        if (!player) continue;
        player.setGameMode(GameMode.Survival);
        player.setDynamicProperty(PLAYER_IS_ALIVE_KEY, true);

        if (team.bedPosition) {
          const bedPos = { x: team.bedPosition.x, y: team.bedPosition.y + 1, z: team.bedPosition.z };
          player.teleport(bedPos, { dimension: dim });
        } else if (player.location) {
          const teamLayout = InstanceManager.getData().instances.find(i => i.id === instanceId)?.teams.find(t => t.color === team.color);
          if (teamLayout?.shopPosition) {
            player.teleport({ x: teamLayout.shopPosition.x, y: teamLayout.shopPosition.y + 2, z: teamLayout.shopPosition.z }, { dimension: dim });
          }
        }

        player.sendMessage("§a游戏开始了！加油！");
        this._spawnShopBee(player, team);
      }
    }

    world.sendMessage(`§6起床战争 §a${inst.name} §e已开始！`);
  }

  private static _spawnShopBee(player: Player, team: { color: TeamColor; shopPosition?: { x: number; y: number; z: number } | null }) {
    if (!team.shopPosition) return;
    const dim = world.getDimension("overworld");
    try {
      const bee = dim.spawnEntity("minecraft:bee", {
        x: team.shopPosition.x + 0.5,
        y: team.shopPosition.y + 1,
        z: team.shopPosition.z + 0.5,
      });
      bee.nameTag = `§6商店 §e(${TEAM_COLOR_NAMES[team.color]}队)`;
      bee.setDynamicProperty("__bw_shop", true);
      bee.setDynamicProperty("__bw_instance", player.getDynamicProperty(PLAYER_INSTANCE_KEY));
      bee.setDynamicProperty("__bw_team_color", team.color);
      bee.setDynamicProperty("__bw_no_move", true);

      system.runInterval(() => {
        try {
          if (!bee.isValid || !bee.hasComponent("health")) return;
          bee.teleport({
            x: team.shopPosition!.x + 0.5,
            y: team.shopPosition!.y + 1,
            z: team.shopPosition!.z + 0.5,
          }, { dimension: dim });
        } catch { }
      }, 10);
    } catch (e) {
      console.warn("Failed to spawn shop bee: " + e);
    }
  }

  static endGame(instanceId: string) {
    const inst = InstanceManager.getInstance(instanceId);
    if (!inst) return;
    this._runningGames.delete(instanceId);
    InstanceManager.setInstanceStatus(instanceId, "idle");

    const dim = world.getDimension("overworld");

    for (const team of inst.teams) {
      for (const playerId of team.players) {
        const player = world.getEntity(playerId) as Player;
        if (!player) continue;
        player.setGameMode(GameMode.Adventure);
        player.sendMessage("§c游戏已结束！");
        player.setDynamicProperty(PLAYER_TEAM_KEY, undefined);
        player.setDynamicProperty(PLAYER_INSTANCE_KEY, undefined);
        player.setDynamicProperty(PLAYER_IS_ALIVE_KEY, undefined);
        player.setDynamicProperty(PLAYER_IS_SPECTATOR_KEY, undefined);
      }
      team.players = [];
    }

    InstanceManager.clearInstanceMap(dim, instanceId);
    world.sendMessage(`§c起床战争 ${inst.name} 已结束`);
  }

  static leaveGame(player: Player) {
    const instanceId = player.getDynamicProperty(PLAYER_INSTANCE_KEY) as string | undefined;
    if (!instanceId) {
      player.sendMessage("§c你不在游戏中");
      return;
    }
    const inst = InstanceManager.getInstance(instanceId);
    if (!inst) return;

    for (const team of inst.teams) {
      const idx = team.players.indexOf(player.id);
      if (idx !== -1) {
        team.players.splice(idx, 1);
        break;
      }
    }
    InstanceManager.updateInstance(instanceId, () => {});

    player.setGameMode(GameMode.Adventure);
    player.sendMessage("§e你已离开游戏");
    player.setDynamicProperty(PLAYER_TEAM_KEY, undefined);
    player.setDynamicProperty(PLAYER_INSTANCE_KEY, undefined);
    player.setDynamicProperty(PLAYER_IS_ALIVE_KEY, undefined);
    player.setDynamicProperty(PLAYER_IS_SPECTATOR_KEY, undefined);

    const totalPlayers = inst.teams.reduce((s, t) => s + t.players.length, 0);
    if (totalPlayers === 0 && inst.status !== "idle") {
      this.endGame(instanceId);
    }
  }

  static handleShopInteract(entity: Entity, player: Player) {
    if (!entity.getDynamicProperty("__bw_shop")) return;
    const teamColor = entity.getDynamicProperty("__bw_team_color") as TeamColor;
    ShopManager.showShop(player, teamColor);
  }

  static isInGame(player: Player): boolean {
    return !!player.getDynamicProperty(PLAYER_INSTANCE_KEY);
  }

  static getPlayerTeamColor(player: Player): TeamColor | null {
    return (player.getDynamicProperty(PLAYER_TEAM_KEY) as TeamColor) || null;
  }

  static getPlayerInstance(player: Player): string | null {
    return (player.getDynamicProperty(PLAYER_INSTANCE_KEY) as string) || null;
  }

  static handleFireChargeUse(player: Player) {
    const dim = player.dimension;
    const loc = player.getHeadLocation();
    const dir = player.getViewDirection();
    const inv = player.getComponent("inventory");
    if (inv && inv.container) {
      const slt = (player as any).selectedSlotIndex;
      if (slt !== undefined) {
        const si = inv.container.getItem(slt);
        if (si && si.typeId === "minecraft:fire_charge") {
          si.amount -= 1;
          if (si.amount <= 0) {
            inv.container.setItem(slt, undefined);
          } else {
            inv.container.setItem(slt, si);
          }
        }
      }
    }
    try {
      dim.spawnEntity("minecraft:fireball", {
        x: loc.x + dir.x * 2,
        y: loc.y + dir.y * 2,
        z: loc.z + dir.z * 2,
      });
    } catch (e) {}
  }

  static sendToHub(player: Player) {
    const instId = player.getDynamicProperty(PLAYER_INSTANCE_KEY) as string;
    if (instId) {
      this.leaveGame(player);
    }
    const spawn = world.getDefaultSpawnLocation();
    player.teleport(spawn, { dimension: world.getDimension("overworld") });
    player.setGameMode(GameMode.Adventure);
    player.sendMessage("§a你已回到大厅");
  }
}

export default GameManager;
