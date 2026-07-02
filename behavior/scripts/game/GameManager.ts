import {
  Player,
  world,
  system,
  GameMode,
  Entity,
  ItemStack,
} from "@minecraft/server";
import type { I18nKeyList } from "../types";
import { t } from "../i18n/locals";
import { BedwarsInstanceData, TeamColor, BedwarsTeamData } from "../types";
import InstanceManager from "./InstanceManager";
import ShopManager from "./ShopManager";
import {
  TEAM_WOOL_MAP,
  TEAM_COLOR_NAMES,
  MAP_Y,
  getMapLayout,
  STRUCTURES,
} from "./config";

const PLAYER_TEAM_KEY = "__bw_team";
const PLAYER_INSTANCE_KEY = "__bw_instance";
const PLAYER_IS_ALIVE_KEY = "__bw_alive";
const PLAYER_IS_SPECTATOR_KEY = "__bw_spectator";
const PLAYER_RESPAWN_KEY = "__bw_respawning";

const IRON_INTERVAL = 8;
const GOLD_INTERVAL = 30;
const DIAMOND_INTERVAL = 80;
const SCOREBOARD_OBJ = "bedwarsscore";

class GameManager {
  private static _gameLoopId: number | null = null;
  private static _runningGames: Set<string> = new Set();
  private static _instanceTick: Record<string, number> = {};

  static init() {
    if (this._gameLoopId !== null) return;
    system.runInterval(() => {
      this._tick();
    }, 10);
  }

  private static _tick() {
    const instances = InstanceManager.getInstances().filter(
      (i) => i.status === "playing",
    );
    for (const inst of instances) {
      const tick = (this._instanceTick[inst.id] || 0) + 1;
      this._instanceTick[inst.id] = tick;
      this._spawnResources(inst, tick);
      this._protectShopBees(inst);
      this._updateScoreboard(inst);
      this._checkWinCondition(inst);
    }
    if (instances.length === 0 && this._scoreboardActive) {
      this._removeScoreboard();
    }
  }

  private static _scoreboardActive = false;

  private static _ensureScoreboard() {
    if (this._scoreboardActive) return;
    try {
      const dim = world.getDimension("overworld");
      dim.runCommand(
        `scoreboard objectives add ${SCOREBOARD_OBJ} dummy Bedwars`,
      );
    } catch {}
    try {
      const dim = world.getDimension("overworld");
      dim.runCommand(
        `scoreboard objectives setdisplay sidebar ${SCOREBOARD_OBJ}`,
      );
    } catch {}
    this._scoreboardActive = true;
  }

  private static _removeScoreboard() {
    try {
      const dim = world.getDimension("overworld");
      dim.runCommand(`scoreboard objectives remove ${SCOREBOARD_OBJ}`);
    } catch {}
    this._scoreboardActive = false;
  }

  private static _clearScorePlayers() {
    try {
      const dim = world.getDimension("overworld");
      dim.runCommand(`scoreboard players reset @a ${SCOREBOARD_OBJ}`);
    } catch {}
  }

  private static _updateScoreboard(inst: BedwarsInstanceData) {
    this._ensureScoreboard();
    const dim = world.getDimension("overworld");
    try {
      try {
        dim.runCommand(`scoreboard objectives remove ${SCOREBOARD_OBJ}`);
      } catch {}
      dim.runCommand(
        `scoreboard objectives add ${SCOREBOARD_OBJ} dummy Bedwars`,
      );
      dim.runCommand(
        `scoreboard objectives setdisplay sidebar ${SCOREBOARD_OBJ}`,
      );
      dim.runCommand(
        `scoreboard players set "${t("scoreboardTitle")}" ${SCOREBOARD_OBJ} 100`,
      );
      dim.runCommand(
        `scoreboard players set "${t("scoreboardStatus", { name: inst.name, status: inst.status })}" ${SCOREBOARD_OBJ} 99`,
      );
      let idx = 98;
      for (const team of inst.teams) {
        const colorName = TEAM_COLOR_NAMES[team.color];
        const alive = team.players.filter((id) => {
          const p = world.getEntity(id);
          return p && !p.getDynamicProperty(PLAYER_IS_SPECTATOR_KEY);
        }).length;
        const bed = team.bedAlive ? "§a√" : "§c×";
        dim.runCommand(
          `scoreboard players set "${t("scoreboardTeamLine", { color: colorName, bed: bed, alive: String(alive) })}" ${SCOREBOARD_OBJ} ${idx}`,
        );
        idx--;
      }
    } catch {}
  }

  private static _checkWinCondition(inst: BedwarsInstanceData) {
    const aliveTeams: BedwarsTeamData[] = [];
    for (const team of inst.teams) {
      if (team.players.length === 0) continue;
      const alivePlayers = team.players.filter((pid) => {
        const p = world.getEntity(pid);
        return p && !p.getDynamicProperty(PLAYER_IS_SPECTATOR_KEY);
      });
      if (alivePlayers.length > 0) {
        aliveTeams.push(team);
      }
    }
    if (aliveTeams.length <= 1 && aliveTeams.length > 0) {
      const winner = aliveTeams[0];
      world.sendMessage(
        t("gameWin", {
          color: TEAM_COLOR_NAMES[winner.color],
          name: inst.name,
        }),
      );
      this.endGame(inst.id);
    }
  }

  private static _protectShopBees(inst: BedwarsInstanceData) {
    const dim = world.getDimension("overworld");
    const bees = dim.getEntities({ type: "minecraft:bee" });
    for (const bee of bees) {
      if (bee.getDynamicProperty("__bw_instance") !== inst.id) continue;
      try {
        bee.addEffect("slowness", 1200, {
          amplifier: 255,
          showParticles: false,
        });
        bee.addEffect("regeneration", 1200, {
          amplifier: 255,
          showParticles: false,
        });
        bee.addEffect("health_boost", 1200, {
          amplifier: 255,
          showParticles: false,
        });
        bee.addEffect("resistance", 1200, {
          amplifier: 255,
          showParticles: false,
        });
      } catch {}
    }
  }

  private static _spawnResources(inst: BedwarsInstanceData, tick: number) {
    const dim = world.getDimension("overworld");
    for (const team of inst.teams) {
      if (team.ironPosition && tick % IRON_INTERVAL === 0) {
        try {
          dim.spawnItem(
            new ItemStack("minecraft:iron_ingot", 1),
            team.ironPosition,
          );
        } catch (e) {
          console.log(`BW iron spawn fail: ${e}`);
        }
      }
      if (team.goldPosition && tick % GOLD_INTERVAL === 0) {
        try {
          dim.spawnItem(
            new ItemStack("minecraft:gold_ingot", 1),
            team.goldPosition,
          );
        } catch (e) {
          console.log(`BW gold spawn fail: ${e}`);
        }
      }
      if (team.diamondPosition && tick % DIAMOND_INTERVAL === 0) {
        try {
          dim.spawnItem(
            new ItemStack("minecraft:diamond", 1),
            team.diamondPosition,
          );
        } catch (e) {
          console.log(`BW diamond spawn fail: ${e}`);
        }
      }
    }
  }

  static canJoin(player: Player, instanceId: string): I18nKeyList | null {
    const inst = InstanceManager.getInstance(instanceId);
    if (!inst) return "instanceNotFound";
    const existing = InstanceManager.getPlayerInstance(player.id);
    if (existing) return "alreadyInGame";
    if (inst.status !== "idle" && inst.status !== "waiting")
      return "gameAlreadyStarted";
    return null;
  }

  static joinGame(player: Player, instanceId: string): boolean {
    const err = this.canJoin(player, instanceId);
    if (err) {
      player.sendMessage(t(err));
      return false;
    }
    const inst = InstanceManager.getInstance(instanceId)!;
    if (inst.status === "idle")
      InstanceManager.setInstanceStatus(instanceId, "waiting");

    const availableTeams = inst.teams.filter(
      (t) => t.players.length < inst.playersPerTeam,
    );
    if (availableTeams.length === 0) {
      player.sendMessage(t("teamFull"));
      return false;
    }
    const team = availableTeams[0];

    team.players.push(player.id);
    InstanceManager.updateInstance(instanceId, () => {});

    player.setDynamicProperty(PLAYER_TEAM_KEY, team.color);
    player.setDynamicProperty(PLAYER_INSTANCE_KEY, instanceId);
    player.setDynamicProperty(PLAYER_IS_ALIVE_KEY, true);
    player.setDynamicProperty(PLAYER_IS_SPECTATOR_KEY, false);

    system.run(() => {
      player.teleport(
        { x: inst.initIslandX, y: MAP_Y + 5, z: inst.initIslandZ },
        { dimension: world.getDimension("overworld") },
      );
      player.setGameMode(GameMode.Adventure);
    });

    const totalPlayers = inst.teams.reduce((s, T) => s + T.players.length, 0);
    world.sendMessage(
      t("playerJoined", {
        name: player.name,
        current: String(totalPlayers),
        total: String(inst.totalPlayers),
      }),
    );

    if (totalPlayers >= inst.totalPlayers) {
      system.runTimeout(() => this.startGame(instanceId), 100);
    }
    return true;
  }

  static startGame(instanceId: string) {
    const inst = InstanceManager.getInstance(instanceId);
    if (!inst) return;
    if (this._runningGames.has(instanceId)) return;

    const totalPlayers = inst.teams.reduce((s, t) => s + t.players.length, 0);
    if (totalPlayers < 2) {
      return;
    }

    this._runningGames.add(instanceId);
    InstanceManager.setInstanceStatus(instanceId, "playing");

    const dim = world.getDimension("overworld");

    system.runJob(
      (function* () {
        const layout = getMapLayout(inst.x, inst.z);

        // Find a player to act as scout (teleport around to force chunk loading)
        let scout: Player | null = null;
        for (const team of inst.teams) {
          for (const pid of team.players) {
            const p = world.getEntity(pid) as Player;
            if (p) {
              scout = p;
              break;
            }
          }
          if (scout) break;
        }

        // Place all structures (teams, small islands, center)
        for (const team of layout.teams) {
          const info = STRUCTURES[team.structureKey];
          world.structureManager.place(info.id, dim, {
            x: team.placeOffset[0],
            y: team.placeOffset[1],
            z: team.placeOffset[2],
          });
          if (scout) {
            scout.teleport(
              {
                x: team.placeOffset[0] + 9,
                y: MAP_Y + 5,
                z: team.placeOffset[2] + 9,
              },
              { dimension: dim },
            );
            yield system.waitTicks(3);
          }
        }
        for (const island of layout.smallIslands) {
          const info = STRUCTURES[island.structureKey];
          world.structureManager.place(info.id, dim, {
            x: island.placeOffset[0],
            y: island.placeOffset[1],
            z: island.placeOffset[2],
          });
          if (scout) {
            scout.teleport(
              {
                x: island.placeOffset[0] + 3,
                y: MAP_Y + 5,
                z: island.placeOffset[2] + 3,
              },
              { dimension: dim },
            );
            yield system.waitTicks(3);
          }
        }
        const centerInfo = STRUCTURES[layout.center.structureKey];
        world.structureManager.place(centerInfo.id, dim, {
          x: layout.center.placeOffset[0],
          y: layout.center.placeOffset[1],
          z: layout.center.placeOffset[2],
        });
        if (scout) {
          scout.teleport(
            {
              x: layout.center.placeOffset[0] + 22,
              y: MAP_Y + 5,
              z: layout.center.placeOffset[2] + 23,
            },
            { dimension: dim },
          );
          yield system.waitTicks(3);
        }

        // Resolve all positions from config (iron, gold, diamond, bed, shop) and kill armor stands
        InstanceManager.resolveAllPositions(dim, instanceId);

        // Add ticking areas to keep all game chunks loaded throughout gameplay
        InstanceManager.addGameTickingAreas(dim, instanceId);

        // Return scout to init island
        if (scout) {
          try {
            scout.teleport(
              { x: inst.initIslandX, y: MAP_Y + 5, z: inst.initIslandZ },
              { dimension: dim },
            );
          } catch {}
        }

        // Teleport all players to init island, clear inventory
        for (const team of inst.teams) {
          for (const playerId of team.players) {
            const p = world.getEntity(playerId) as Player;
            if (!p) continue;
            const inv = p.getComponent("inventory")?.container;
            if (inv)
              for (let i = 0; i < inv.size; i++) inv.setItem(i, undefined);
            p.addEffect("regeneration", 100, {
              amplifier: 255,
              showParticles: false,
            });
            p.teleport(
              { x: inst.initIslandX, y: MAP_Y + 5, z: inst.initIslandZ },
              { dimension: dim },
            );
          }
        }

        // Countdown
        for (let i = 5; i >= 1; i--) {
          for (const team of inst.teams) {
            for (const playerId of team.players) {
              const p = world.getEntity(playerId) as Player;
              if (p) p.onScreenDisplay.setTitle(String(i));
            }
          }
          yield system.waitTicks(20);
        }

        // Teleport to beds, set survival, spawn shop bees
        for (const team of inst.teams) {
          for (const playerId of team.players) {
            const p = world.getEntity(playerId) as Player;
            if (!p) continue;
            p.onScreenDisplay.setTitle(t("gameGo"));
            p.setGameMode(GameMode.Survival);
            if (team.bedPosition) {
              p.teleport(
                {
                  x: team.bedPosition.x,
                  y: team.bedPosition.y + 1,
                  z: team.bedPosition.z,
                },
                { dimension: dim },
              );
            } else {
              p.teleport(
                { x: inst.x, y: MAP_Y + 5, z: inst.z },
                { dimension: dim },
              );
            }
            yield system.waitTicks(1);
            GameManager._spawnShopBee(p, team);
          }
        }
      })() as unknown as Generator<void, void, void>,
    );

    world.sendMessage(t("gameStartBroadcast", { name: inst.name }));
  }

  private static _spawnShopBee(
    player: Player,
    team: {
      color: TeamColor;
      shopPosition?: { x: number; y: number; z: number } | null;
    },
  ) {
    if (!team.shopPosition) return;
    const dim = world.getDimension("overworld");
    const instanceId = player.getDynamicProperty(PLAYER_INSTANCE_KEY) as string;
    const existingBees = dim.getEntities({ type: "minecraft:bee" });
    for (const bee of existingBees) {
      if (
        bee.getDynamicProperty("__bw_instance") === instanceId &&
        bee.getDynamicProperty("__bw_team_color") === team.color
      ) {
        try { bee.kill(); } catch {}
      }
    }
    try {
      const bee = dim.spawnEntity("minecraft:bee", {
        x: team.shopPosition.x + 0.5,
        y: team.shopPosition.y + 1,
        z: team.shopPosition.z + 0.5,
      });
      bee.nameTag = `§6商店 §e(${TEAM_COLOR_NAMES[team.color]}队)`;
      bee.setDynamicProperty("__bw_shop", true);
      bee.setDynamicProperty("__bw_instance", instanceId);
      bee.setDynamicProperty("__bw_team_color", team.color);
      bee.setDynamicProperty("__bw_no_move", true);
      system.runInterval(() => {
        try {
          if (!bee.isValid || !bee.hasComponent("health")) return;
          bee.teleport(
            {
              x: team.shopPosition!.x + 0.5,
              y: team.shopPosition!.y + 1,
              z: team.shopPosition!.z + 0.5,
            },
            { dimension: dim },
          );
        } catch {}
      }, 10);
    } catch (e) {
      console.warn("Failed to spawn shop bee: " + e);
    }
  }

  static handlePlayerRespawn(player: Player) {
    const instanceId = player.getDynamicProperty(PLAYER_INSTANCE_KEY) as string;
    if (!instanceId) return;
    const inst = InstanceManager.getInstance(instanceId);
    if (!inst || inst.status !== "playing") return;
    const teamColor = player.getDynamicProperty(PLAYER_TEAM_KEY) as TeamColor;
    const team = inst.teams.find((t) => t.color === teamColor);
    if (!team) return;

    if (team.bedAlive) {
      player.setDynamicProperty(PLAYER_RESPAWN_KEY, true);
      const dim = world.getDimension("overworld");

      system.runJob(
        (function* () {
          try {
            if (!player.isValid) return;
            player.teleport(
              { x: inst.initIslandX, y: MAP_Y + 5, z: inst.initIslandZ },
              { dimension: dim },
            );
            player.setGameMode(GameMode.Adventure);
          } catch {
            return;
          }

          yield system.waitTicks(10);

          for (let i = 3; i >= 1; i--) {
            try {
              if (!player.isValid) return;
              player.onScreenDisplay.setTitle(
                t("respawnCountdown", { time: String(i) }),
              );
            } catch {
              return;
            }
            yield system.waitTicks(20);
          }

          try {
            if (!player.isValid) return;
            player.setGameMode(GameMode.Survival);
            player.setDynamicProperty(PLAYER_IS_ALIVE_KEY, true);
            player.setDynamicProperty(PLAYER_RESPAWN_KEY, undefined);
            player.addEffect("regeneration", 100, {
              amplifier: 255,
              showParticles: false,
            });

            const inv = player.getComponent("inventory")?.container;
            if (inv) {
              inv.addItem(
                new ItemStack(
                  TEAM_WOOL_MAP[teamColor] || "minecraft:white_wool",
                  8,
                ),
              );
              inv.addItem(new ItemStack("minecraft:wooden_sword", 1));
            }

            if (team.bedPosition) {
              player.teleport(
                {
                  x: team.bedPosition.x,
                  y: team.bedPosition.y + 1,
                  z: team.bedPosition.z,
                },
                { dimension: dim },
              );
            } else {
              player.teleport(
                { x: inst.x, y: MAP_Y + 5, z: inst.z },
                { dimension: dim },
              );
            }
          } catch {}
        })() as unknown as Generator<void, void, void>,
      );
    } else {
      player.setDynamicProperty(PLAYER_IS_SPECTATOR_KEY, true);
      const dim = world.getDimension("overworld");
      system.run(() => {
        if (team.bedPosition) {
          player.teleport(
            {
              x: team.bedPosition.x,
              y: team.bedPosition.y + 1,
              z: team.bedPosition.z,
            },
            { dimension: dim },
          );
        } else {
          player.teleport(
            { x: inst.x, y: MAP_Y + 5, z: inst.z },
            { dimension: dim },
          );
        }
        player.setGameMode(GameMode.Spectator);
      });
      player.sendMessage(t("bedDestroyedMsg"));
    }
  }

  static handlePlayerDeath(player: Player) {
    player.setDynamicProperty(PLAYER_IS_ALIVE_KEY, false);
  }

  static endGame(instanceId: string) {
    const inst = InstanceManager.getInstance(instanceId);
    if (!inst) return;
    this._runningGames.delete(instanceId);
    InstanceManager.setInstanceStatus(instanceId, "idle");
    this._removeScoreboard();

    const playerIds: string[] = [];
    for (const team of inst.teams) {
      for (const playerId of team.players) {
        playerIds.push(playerId);
        const player = world.getEntity(playerId) as Player;
        if (!player) continue;
        const inv3 = player.getComponent("inventory")?.container;
        if (inv3)
          for (let i = 0; i < inv3.size; i++) inv3.setItem(i, undefined);
        player.setDynamicProperty(PLAYER_TEAM_KEY, undefined);
        player.setDynamicProperty(PLAYER_INSTANCE_KEY, undefined);
        player.setDynamicProperty(PLAYER_IS_ALIVE_KEY, undefined);
        player.setDynamicProperty(PLAYER_IS_SPECTATOR_KEY, undefined);
        player.setDynamicProperty(PLAYER_RESPAWN_KEY, undefined);
      }
      team.players = [];
    }

    system.runJob(
      (function* () {
        const dim = world.getDimension("overworld");
        const bees = dim.getEntities({ type: "minecraft:bee" });
        for (const bee of bees) {
          if (bee.getDynamicProperty("__bw_instance") === instanceId) {
            try { bee.kill(); } catch {}
          }
        }
        const fireballs = dim.getEntities({ type: "minecraft:small_fireball" });
        for (const fb of fireballs) {
          if (fb.getDynamicProperty("__bw_instance") === instanceId) {
            try { fb.kill(); } catch {}
          }
        }
        for (const playerId of playerIds) {
          const player = world.getEntity(playerId) as Player;
          if (!player) continue;
          player.addEffect("regeneration", 100, {
            amplifier: 255,
            showParticles: false,
          });
          player.teleport(
            { x: inst.initIslandX, y: MAP_Y + 5, z: inst.initIslandZ },
            { dimension: dim },
          );
          player.setGameMode(GameMode.Adventure);
          player.sendMessage(t("gameEnded"));
        }
        yield;
        InstanceManager.clearInstanceMap(dim, instanceId);
      })(),
    );

    world.sendMessage(t("gameEndBroadcast", { name: inst.name }));
  }

  static leaveGame(player: Player) {
    const instanceId = player.getDynamicProperty(PLAYER_INSTANCE_KEY) as
      | string
      | undefined;
    if (!instanceId) {
      player.sendMessage(t("notInGame"));
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

    system.run(() => {
      player.setGameMode(GameMode.Adventure);
    });
    player.sendMessage(t("leaveGameMsg"));
    player.setDynamicProperty(PLAYER_TEAM_KEY, undefined);
    player.setDynamicProperty(PLAYER_INSTANCE_KEY, undefined);
    player.setDynamicProperty(PLAYER_IS_ALIVE_KEY, undefined);
    player.setDynamicProperty(PLAYER_IS_SPECTATOR_KEY, undefined);

    const totalPlayers = inst.teams.reduce((s, t) => s + t.players.length, 0);
    if (totalPlayers === 0 && inst.status !== "idle") this.endGame(instanceId);
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
    const spawnPos = {
      x: loc.x + dir.x * 2,
      y: loc.y + dir.y,
      z: loc.z + dir.z * 2,
    };
    const velocity = { x: dir.x * 2, y: dir.y * 2, z: dir.z * 2 };
    const instanceId = player.getDynamicProperty(PLAYER_INSTANCE_KEY) as string;
    try {
      const fireball = dim.spawnEntity("minecraft:small_fireball", spawnPos);
      fireball.setDynamicProperty("__bw_instance", instanceId);
      fireball.setOnFire(100);
      const proj = fireball.getComponent("minecraft:projectile");
      if (proj && proj.shoot) {
        proj.shoot(velocity, { owner: player });
      } else {
        fireball.applyImpulse(velocity);
      }
    } catch (e) {
      try {
        const arrow = dim.spawnEntity("minecraft:arrow", spawnPos);
        arrow.setDynamicProperty("__bw_instance", instanceId);
        arrow.setOnFire(100);
        const proj = arrow.getComponent("minecraft:projectile");
        if (proj && proj.shoot) {
          proj.shoot(velocity, { owner: player });
        } else {
          arrow.applyImpulse(velocity);
        }
      } catch (e2) {
        console.warn("BW fire charge spawn failed: " + e2);
      }
    }
  }

  static sendToHub(player: Player) {
    const instId = player.getDynamicProperty(PLAYER_INSTANCE_KEY) as string;
    if (instId) this.leaveGame(player);
    system.run(() => {
      const spawn = world.getDefaultSpawnLocation();
      player.teleport(spawn, { dimension: world.getDimension("overworld") });
      player.setGameMode(GameMode.Adventure);
    });
    player.sendMessage(t("returnHubMsg"));
  }
}

export default GameManager;
