import { Player, world, Dimension, system } from "@minecraft/server";
import { WorldDynamicPropertyKeys, BedwarsInstanceData, BedwarsGlobalData, BedwarsTeamData, TeamColor, TEAM_COLORS } from "../types";
import { MAP_Y, getMapLayout, STRUCTURES } from "./config";
import { fillAir, getStructureBounds, sleepTicks } from "../utils/worldEditUtils";
import { t } from "../i18n/locals";

class InstanceManager {
  private static _isInitd = false;
  private static _data: BedwarsGlobalData = {
    initIslandLoaded: false,
    initIslandX: 0,
    initIslandZ: 0,
    instances: [],
  };

  private static _init() {
    if (this._isInitd) return;
    const stored = world.getDynamicProperty(WorldDynamicPropertyKeys.BedwarsData);
    if (stored && typeof stored === "string") {
      try {
        this._data = JSON.parse(stored);
      } catch {
        this._data = { initIslandLoaded: false, initIslandX: 0, initIslandZ: 0, instances: [] };
      }
    }
    this._isInitd = true;
  }

  private static _save() {
    world.setDynamicProperty(WorldDynamicPropertyKeys.BedwarsData, JSON.stringify(this._data));
  }

  static getData(): BedwarsGlobalData {
    this._init();
    return this._data;
  }

  static getInstances(): BedwarsInstanceData[] {
    return this.getData().instances;
  }

  static getInstance(id: string): BedwarsInstanceData | undefined {
    return this.getInstances().find(i => i.id === id);
  }

  static isInitIslandLoaded(): boolean {
    return this.getData().initIslandLoaded;
  }

  static getInitIslandPos(): { x: number; z: number } {
    return { x: this._data.initIslandX, z: this._data.initIslandZ };
  }

  static setInitIslandPos(x: number, z: number) {
    this._init();
    this._data.initIslandX = x;
    this._data.initIslandZ = z;
    this._data.initIslandLoaded = true;
    this._save();
  }

  static createInstance(id: string, name: string, x: number, z: number, teamCount: number, playersPerTeam: number, totalPlayers: number): BedwarsInstanceData {
    this._init();
    const teams: BedwarsTeamData[] = [];
    const colors = TEAM_COLORS.slice(0, teamCount);
    for (const color of colors) {
      teams.push({
        color,
        players: [],
        bedPosition: null,
        shopPosition: null,
        ironPosition: null,
        goldPosition: null,
        diamondPosition: null,
        bedAlive: false,
      });
    }
    const instance: BedwarsInstanceData = {
      id,
      name,
      x,
      z,
      teamCount,
      playersPerTeam,
      totalPlayers,
      status: "idle",
      teams,
      initIslandX: this._data.initIslandX,
      initIslandZ: this._data.initIslandZ,
    };
    this._data.instances.push(instance);
    this._save();
    return instance;
  }

  static deleteInstance(id: string): boolean {
    this._init();
    const idx = this._data.instances.findIndex(i => i.id === id);
    if (idx === -1) return false;
    this._data.instances.splice(idx, 1);
    this._save();
    return true;
  }

  static updateInstance(id: string, updater: (inst: BedwarsInstanceData) => void) {
    this._init();
    const inst = this._data.instances.find(i => i.id === id);
    if (!inst) return;
    updater(inst);
    this._save();
  }

  static setInstanceStatus(id: string, status: "idle" | "waiting" | "playing") {
    this.updateInstance(id, (inst) => { inst.status = status; });
  }

  static async loadInitIsland(sender: Player, x: number, z: number): Promise<void> {
    const dimension = sender.dimension;
    const info = STRUCTURES.init_play;
    const ox = x - Math.floor(40 / 2);
    const oz = z - Math.floor(30 / 2);
    const bounds = getStructureBounds(ox, MAP_Y, oz, info.size);
    fillAir(dimension, bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, MAP_Y + info.size[1], bounds.max.z);
    await sleepTicks(5);
    world.structureManager.place(info.id, dimension, { x: ox, y: MAP_Y, z: oz });
    this.setInitIslandPos(x, z);
    sender.teleport({ x: x, y: MAP_Y + 5, z: z }, { dimension });
  }

  static clearInstanceMap(dimension: Dimension, id: string) {
    const inst = this.getInstance(id);
    if (!inst) return;
    const layout = getMapLayout(inst.x, inst.z);

    const allBounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }[] = [];

    const centerInfo = STRUCTURES[layout.center.structureKey];
    allBounds.push(getStructureBounds(layout.center.placeOffset[0], layout.center.placeOffset[1], layout.center.placeOffset[2], centerInfo.size));

    for (const team of layout.teams) {
      const info = STRUCTURES[team.structureKey];
      allBounds.push(getStructureBounds(team.placeOffset[0], team.placeOffset[1], team.placeOffset[2], info.size));
    }

    for (const island of layout.smallIslands) {
      const info = STRUCTURES[island.structureKey];
      allBounds.push(getStructureBounds(island.placeOffset[0], island.placeOffset[1], island.placeOffset[2], info.size));
    }

    for (const b of allBounds) {
      try {
        dimension.runCommand(`tickingarea add ${b.min.x} ${b.min.y} ${b.min.z} ${b.max.x} ${b.max.y} ${b.max.z} bw_clear_temp true`);
      } catch { }
      try {
        dimension.runCommand(`fill ${b.min.x} ${b.min.y} ${b.min.z} ${b.max.x} ${b.max.y} ${b.max.z} air 0 destroy`);
      } catch { }
      try {
        const dx = b.max.x - b.min.x;
        const dy = b.max.y - b.min.y;
        const dz = b.max.z - b.min.z;
        dimension.runCommand(`kill @e[type=item,x=${b.min.x},y=${b.min.y},z=${b.min.z},dx=${dx},dy=${dy},dz=${dz}]`);
      } catch { }
      try { dimension.runCommand(`tickingarea remove bw_clear_temp`); } catch { }
    }
  }

  static findArmorStands(dimension: Dimension, ox: number, oy: number, oz: number, size: [number, number, number]): { name: string; position: { x: number; y: number; z: number } }[] {
    const bounds = getStructureBounds(ox, oy, oz, size);
    const results: { name: string; position: { x: number; y: number; z: number } }[] = [];
    const entities = dimension.getEntities({
      location: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
      maxDistance: Math.max(size[0], size[1], size[2]) * 2,
    });
    for (const entity of entities) {
      if (entity.typeId === "minecraft:armor_stand" && entity.nameTag) {
        const loc = entity.location;
        if (loc.x >= bounds.min.x && loc.x <= bounds.max.x &&
            loc.y >= bounds.min.y && loc.y <= bounds.max.y &&
            loc.z >= bounds.min.z && loc.z <= bounds.max.z) {
          results.push({
            name: entity.nameTag,
            position: { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) },
          });
          entity.kill();
        }
      }
    }
    return results;
  }

  static async loadAllMaps(sender: Player, instanceId: string): Promise<boolean> {
    const inst = this.getInstance(instanceId);
    if (!inst) { sender.sendMessage(t("instanceNotFound")); return false; }
    const dim = sender.dimension;
    const layout = getMapLayout(inst.x, inst.z);

    sender.sendMessage(t("loadingIsland", { label: "Center" }));
    const centerInfo = STRUCTURES[layout.center.structureKey];
    world.structureManager.place(centerInfo.id, dim, { x: layout.center.placeOffset[0], y: layout.center.placeOffset[1], z: layout.center.placeOffset[2] });
    sender.teleport({ x: inst.x, y: MAP_Y + 5, z: inst.z }, { dimension: dim });
    await sleepTicks(10);
    const centerEntities = this.findArmorStands(dim, layout.center.placeOffset[0], layout.center.placeOffset[1], layout.center.placeOffset[2], centerInfo.size);
    this._processCenterEntities(inst, centerEntities);

    for (let i = 0; i < layout.teams.length; i++) {
      const team = layout.teams[i];
      const info = STRUCTURES[team.structureKey];
      sender.sendMessage(t("loadingIsland", { label: team.label }));
      world.structureManager.place(info.id, dim, { x: team.placeOffset[0], y: team.placeOffset[1], z: team.placeOffset[2] });
      sender.teleport({ x: team.placeOffset[0] + 9, y: MAP_Y + 5, z: team.placeOffset[2] + 9 }, { dimension: dim });
      await sleepTicks(10);
      const entities = this.findArmorStands(dim, team.placeOffset[0], team.placeOffset[1], team.placeOffset[2], info.size);
      this._processTeamEntities(inst, team.color, entities);
    }

    for (let i = 0; i < layout.smallIslands.length; i++) {
      const island = layout.smallIslands[i];
      const info = STRUCTURES[island.structureKey];
      sender.sendMessage(t("loadingIsland", { label: island.label }));
      world.structureManager.place(info.id, dim, { x: island.placeOffset[0], y: island.placeOffset[1], z: island.placeOffset[2] });
      await sleepTicks(5);
      const entities = this.findArmorStands(dim, island.placeOffset[0], island.placeOffset[1], island.placeOffset[2], info.size);
      this._processIslandEntities(inst, entities);
    }

    this.updateInstance(instanceId, (inst) => {
      for (const team of inst.teams) {
        team.bedAlive = true;
      }
    });

    sender.teleport({ x: inst.x, y: MAP_Y + 5, z: inst.z }, { dimension: dim });
    sender.addEffect("regeneration", 100, { amplifier: 255, showParticles: false });
    sender.sendMessage(t("mapLoadComplete"));
    return true;
  }

  static loadAllMapsDirect(dim: Dimension, instanceId: string) {
    const inst = this.getInstance(instanceId);
    if (!inst) return;
    const layout = getMapLayout(inst.x, inst.z);

    const centerInfo = STRUCTURES[layout.center.structureKey];
    world.structureManager.place(centerInfo.id, dim, { x: layout.center.placeOffset[0], y: layout.center.placeOffset[1], z: layout.center.placeOffset[2] });
    const centerEntities = this.findArmorStands(dim, layout.center.placeOffset[0], layout.center.placeOffset[1], layout.center.placeOffset[2], centerInfo.size);
    this._processCenterEntities(inst, centerEntities);

    for (let i = 0; i < layout.teams.length; i++) {
      const team = layout.teams[i];
      const info = STRUCTURES[team.structureKey];
      world.structureManager.place(info.id, dim, { x: team.placeOffset[0], y: team.placeOffset[1], z: team.placeOffset[2] });
      const entities = this.findArmorStands(dim, team.placeOffset[0], team.placeOffset[1], team.placeOffset[2], info.size);
      this._processTeamEntities(inst, team.color, entities);
    }

    for (let i = 0; i < layout.smallIslands.length; i++) {
      const island = layout.smallIslands[i];
      const info = STRUCTURES[island.structureKey];
      world.structureManager.place(info.id, dim, { x: island.placeOffset[0], y: island.placeOffset[1], z: island.placeOffset[2] });
      const entities = this.findArmorStands(dim, island.placeOffset[0], island.placeOffset[1], island.placeOffset[2], info.size);
      this._processIslandEntities(inst, entities);
    }

    this.updateInstance(instanceId, (inst) => {
      for (const team of inst.teams) team.bedAlive = true;
    });
  }

  private static _processCenterEntities(inst: BedwarsInstanceData, entities: { name: string; position: { x: number; y: number; z: number } }[]) {
    for (const e of entities) {
      switch (e.name) {
        case "brige_lookup":
          for (const team of inst.teams) {
            if (!team.ironPosition) { team.ironPosition = e.position; break; }
          }
          break;
        case "brige_lookup_gold":
          for (const team of inst.teams) {
            if (!team.goldPosition) { team.goldPosition = e.position; break; }
          }
          break;
        case "brige_lookup_diamond":
          for (const team of inst.teams) {
            if (!team.diamondPosition) { team.diamondPosition = e.position; break; }
          }
          break;
      }
    }
  }

  private static _processTeamEntities(inst: BedwarsInstanceData, color: TeamColor, entities: { name: string; position: { x: number; y: number; z: number } }[]) {
    const team = inst.teams.find(t => t.color === color);
    if (!team) return;
    for (const e of entities) {
      switch (e.name) {
        case "brige_lookup":
          team.ironPosition = team.ironPosition || e.position;
          break;
        case "brige_lookup_gold":
          team.goldPosition = team.goldPosition || e.position;
          break;
        case "brige_bed":
          team.bedPosition = e.position;
          break;
        case "brige_pay":
          team.shopPosition = e.position;
          break;
      }
    }
    this._save();
  }

  private static _processIslandEntities(inst: BedwarsInstanceData, entities: { name: string; position: { x: number; y: number; z: number } }[]) {
    for (const e of entities) {
      switch (e.name) {
        case "brige_lookup":
          for (const team of inst.teams) {
            if (!team.ironPosition) { team.ironPosition = e.position; break; }
          }
          break;
        case "brige_lookup_gold":
          for (const team of inst.teams) {
            if (!team.goldPosition) { team.goldPosition = e.position; break; }
          }
          break;
      }
    }
    this._save();
  }

  static getPlayerInstance(playerId: string): BedwarsInstanceData | undefined {
    return this.getInstances().find(i =>
      i.teams.some(t => t.players.includes(playerId))
    );
  }
}

export default InstanceManager;
