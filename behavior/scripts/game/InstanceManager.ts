import { Player, world, Dimension } from "@minecraft/server";
import { WorldDynamicPropertyKeys, BedwarsInstanceData, BedwarsGlobalData, BedwarsTeamData, TeamColor, TEAM_COLORS } from "../types";
import { MAP_Y, getMapLayout, STRUCTURES } from "./config";
import { getStructureBounds, sleepTicks, ensureRegionLoaded, releaseRegion } from "../utils/worldEditUtils";
import {
  MapRegion,
  getInstanceRegions,
  ensureMapLoaded,
  releaseLoadedMapAreas,
  clearMapBlocks,
  clearMapEntities,
  placeStructure,
  resetInstanceMap,
} from "./MapReset";
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
    const region: MapRegion = { key: "init_island", ...getStructureBounds(ox, MAP_Y, oz, info.size) };
    // 确保区块加载完成后再操作，避免未加载区块报错
    await ensureRegionLoaded(dimension, "bw_load_init_island", region);
    // 先清掉旧岛残留再重建，保证初始岛也是干净的
    await clearMapBlocks(dimension, [region]);
    placeStructure(dimension, info.id, { x: ox, y: MAP_Y, z: oz });
    releaseRegion("bw_load_init_island");
    this.setInitIslandPos(x, z);
    sender.teleport({ x: x, y: MAP_Y + 5, z: z }, { dimension });
  }

  /**
   * 清空并重置实例地图。实际的区块加载、方块清理、实体清理
   * 全部由 MapReset 模块负责（异步、分批、不依赖玩家位置）。
   */
  static async clearInstanceMap(dimension: Dimension, id: string): Promise<void> {
    const inst = this.getInstance(id);
    if (!inst) { console.log(`[BW] clearInstanceMap: instance ${id} not found`); return; }
    console.log(`[BW] clearInstanceMap: resetting ${id}`);
    await resetInstanceMap(dimension, inst);
  }

  /**
   * Find armor stands within a structure area and return their names/positions, then remove them.
   * Used to locate bed, shop, iron, gold, diamond positions during map loading.
   * 查找结构区域内的盔甲架并返回其名称/位置，然后移除它们。
   * 用于在地图加载时定位床、商店、铁、金、钻石的位置。
   */
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

    // 1. 用临时 tickingarea 确保整张地图的区块加载完成（不再依赖传送玩家/侦察员加载区块）
    console.log(`[BW] loadAllMaps: ensuring chunks loaded for ${instanceId}`);
    await ensureMapLoaded(dim, inst);

    // 2. 清空旧地图（方块 + 实体），保证重建干净
    console.log(`[BW] loadAllMaps: clearing old map for ${instanceId}`);
    const regions = getInstanceRegions(inst);
    await clearMapBlocks(dim, regions);
    clearMapEntities(dim, regions);
    await sleepTicks(5);

    // 3. 逐个放置结构并解析盔甲架位置
    const centerInfo = STRUCTURES[layout.center.structureKey];
    sender.sendMessage(t("loadingIsland", { label: "Center" }));
    placeStructure(dim, centerInfo.id, { x: layout.center.placeOffset[0], y: layout.center.placeOffset[1], z: layout.center.placeOffset[2] });
    await sleepTicks(5);
    const centerEntities = this.findArmorStands(dim, layout.center.placeOffset[0], layout.center.placeOffset[1], layout.center.placeOffset[2], centerInfo.size);
    this.processCenterEntities(inst, centerEntities);

    for (let i = 0; i < layout.teams.length; i++) {
      const team = layout.teams[i];
      const info = STRUCTURES[team.structureKey];
      sender.sendMessage(t("loadingIsland", { label: team.label }));
      placeStructure(dim, info.id, { x: team.placeOffset[0], y: team.placeOffset[1], z: team.placeOffset[2] });
      await sleepTicks(5);
      const entities = this.findArmorStands(dim, team.placeOffset[0], team.placeOffset[1], team.placeOffset[2], info.size);
      this.processTeamEntities(inst, team.color, entities);
    }

    for (let i = 0; i < layout.smallIslands.length; i++) {
      const island = layout.smallIslands[i];
      const info = STRUCTURES[island.structureKey];
      sender.sendMessage(t("loadingIsland", { label: island.label }));
      placeStructure(dim, info.id, { x: island.placeOffset[0], y: island.placeOffset[1], z: island.placeOffset[2] });
      await sleepTicks(5);
      const entities = this.findArmorStands(dim, island.placeOffset[0], island.placeOffset[1], island.placeOffset[2], info.size);
      this.processIslandEntities(inst, entities);
    }

    // 4. 释放临时加载区域
    releaseLoadedMapAreas(inst);

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

  /**
   * Resolve all entity positions (iron, gold, diamond, bed, shop) from config data.
   * Called during game start after map structures are placed.
   * 从配置数据解析所有实体位置（铁、金、钻石、床、商店）。
   * 在游戏开始放置地图结构后调用。
   */
  static resolveAllPositions(dim: Dimension, instanceId: string) {
    const inst = this.getInstance(instanceId);
    if (!inst) return;
    const layout = getMapLayout(inst.x, inst.z);

    // Teams first — so they get their own iron/gold/bed/shop positions
    for (const team of layout.teams) {
      const teamPositions = team.entities.map(e => ({
        name: e.customName,
        position: {
          x: Math.floor(team.placeOffset[0] + e.relPos[0]),
          y: Math.floor(team.placeOffset[1] + e.relPos[1]),
          z: Math.floor(team.placeOffset[2] + e.relPos[2]),
        },
      }));
      this.processTeamEntities(inst, team.color, teamPositions);
      this._killAt(dim, teamPositions);
    }

    // Small islands — fills any remaining iron/gold slots
    for (const island of layout.smallIslands) {
      const islandPositions = island.entities.map(e => ({
        name: e.customName,
        position: {
          x: Math.floor(island.placeOffset[0] + e.relPos[0]),
          y: Math.floor(island.placeOffset[1] + e.relPos[1]),
          z: Math.floor(island.placeOffset[2] + e.relPos[2]),
        },
      }));
      this.processIslandEntities(inst, islandPositions);
      this._killAt(dim, islandPositions);
    }

    // Center last — fills anything still missing (diamond, extra iron/gold)
    const centerPositions = layout.center.entities.map(e => ({
      name: e.customName,
      position: {
        x: Math.floor(layout.center.placeOffset[0] + e.relPos[0]),
        y: Math.floor(layout.center.placeOffset[1] + e.relPos[1]),
        z: Math.floor(layout.center.placeOffset[2] + e.relPos[2]),
      },
    }));
    this.processCenterEntities(inst, centerPositions);
    this._killAt(dim, centerPositions);

    this.updateInstance(instanceId, (inst) => {
      for (const team of inst.teams) team.bedAlive = true;
    });
  }

  private static _killAt(dim: Dimension, positions: { position: { x: number; y: number; z: number } }[]) {
    for (const p of positions) {
      try {
        dim.runCommand(`kill @e[type=armor_stand,x=${p.position.x},y=${p.position.y},z=${p.position.z},r=2]`);
      } catch (e: any) {
        console.error(`[BW] _killAt failed: ${e?.message ?? e}`);
      }
    }
  }

  /**
   * Process center island entities: assign iron, gold, diamond positions to teams
   * 处理中岛实体：将铁、金、钻石位置分配给队伍
   */
  static processCenterEntities(inst: BedwarsInstanceData, entities: { name: string; position: { x: number; y: number; z: number } }[]) {
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

  /**
   * Process team island entities: set bed, shop, iron, gold positions for a specific team
   * 处理队伍岛实体：为特定队伍设置床、商店、铁、金位置
   */
  static processTeamEntities(inst: BedwarsInstanceData, color: TeamColor, entities: { name: string; position: { x: number; y: number; z: number } }[]) {
    const team = inst.teams.find(t => t.color === color);
    if (!team) return;
    for (const e of entities) {
      switch (e.name) {
        case "brige_lookup":
          team.ironPosition = e.position;
          break;
        case "brige_lookup_gold":
          team.goldPosition = e.position;
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

  static processIslandEntities(inst: BedwarsInstanceData, entities: { name: string; position: { x: number; y: number; z: number } }[]) {
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
