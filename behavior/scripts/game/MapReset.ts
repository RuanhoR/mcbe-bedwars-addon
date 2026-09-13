import { Dimension, Vector3, world } from "@minecraft/server";
import { BedwarsInstanceData } from "../types";
import { getMapLayout, STRUCTURES } from "./config";
import {
  RegionBounds,
  getStructureBounds,
  ensureRegionLoaded,
  releaseRegion,
  clearRegionBlocksGen,
  sleepTicks,
} from "../utils/worldEditUtils";

/** 地图清理的 Y 范围：整个地图包络体从 y=10 清到 y=150（与旧版 clearInstanceMap 一致） */
const CLEAR_Y_MIN = 10;
const CLEAR_Y_MAX = 150;
/** 每 tick 最多清理的区块切片数 */
const SLICES_PER_TICK = 2;
/** 清理时需要移除的实体类型 */
const ENTITY_TYPES = ["minecraft:item", "minecraft:armor_stand", "minecraft:villager_v2"];

export interface MapRegion extends RegionBounds {
  /** 实例内唯一 key：center / team_red / island_0 ... */
  key: string;
}

/**
 * 地图重置模块：集中处理实例地图的全部世界操作。
 * InstanceManager / GameManager 只做调度，不直接触碰方块与区块，
 * 区块未加载的问题统一在这里通过临时 tickingarea 解决。
 */

/** 根据实例坐标计算所有结构区域（中岛 / 队伍岛 / 小岛） */
export function getInstanceRegions(inst: BedwarsInstanceData): MapRegion[] {
  const layout = getMapLayout(inst.x, inst.z);
  const regions: MapRegion[] = [];
  const centerInfo = STRUCTURES[layout.center.structureKey];
  regions.push({ key: "center", ...getStructureBounds(layout.center.placeOffset[0], layout.center.placeOffset[1], layout.center.placeOffset[2], centerInfo.size) });
  for (const team of layout.teams) {
    const info = STRUCTURES[team.structureKey];
    regions.push({ key: `team_${team.color}`, ...getStructureBounds(team.placeOffset[0], team.placeOffset[1], team.placeOffset[2], info.size) });
  }
  layout.smallIslands.forEach((island, i) => {
    const info = STRUCTURES[island.structureKey];
    regions.push({ key: `island_${i}`, ...getStructureBounds(island.placeOffset[0], island.placeOffset[1], island.placeOffset[2], info.size) });
  });
  return regions;
}

/** 多个区域的包络体 */
export function getOverallBounds(regions: RegionBounds[]): RegionBounds {
  const overall: RegionBounds = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity },
  };
  for (const r of regions) {
    overall.min.x = Math.min(overall.min.x, r.min.x);
    overall.min.y = Math.min(overall.min.y, r.min.y);
    overall.min.z = Math.min(overall.min.z, r.min.z);
    overall.max.x = Math.max(overall.max.x, r.max.x);
    overall.max.y = Math.max(overall.max.y, r.max.y);
    overall.max.z = Math.max(overall.max.z, r.max.z);
  }
  return overall;
}

const loadAreaId = (inst: BedwarsInstanceData, r: MapRegion) => `bw_load_${inst.id}_${r.key}`;
const gameAreaId = (instanceId: string, r: MapRegion) => `bw_game_${instanceId}_${r.key}`;

/**
 * 用临时 tickingarea 把实例地图的所有区域加载完成（不释放，加载完成后
 * 由调用方调用 releaseLoadedMapAreas 释放）。
 */
export async function ensureMapLoaded(dim: Dimension, inst: BedwarsInstanceData): Promise<MapRegion[]> {
  const regions = getInstanceRegions(inst);
  for (const r of regions) {
    await ensureRegionLoaded(dim, loadAreaId(inst, r), r);
  }
  return regions;
}

/** 释放 ensureMapLoaded 创建的临时加载区域 */
export function releaseLoadedMapAreas(inst: BedwarsInstanceData) {
  for (const r of getInstanceRegions(inst)) releaseRegion(loadAreaId(inst, r));
}

/** 创建游戏期间的长效 tickingarea（开始游戏时调用，重置地图时移除） */
export async function addGameAreas(dim: Dimension, instanceId: string, inst: BedwarsInstanceData): Promise<void> {
  for (const r of getInstanceRegions(inst)) {
    await ensureRegionLoaded(dim, gameAreaId(instanceId, r), r);
  }
}

/** 移除游戏期间的长效 tickingarea */
export function removeGameAreas(inst: BedwarsInstanceData) {
  for (const r of getInstanceRegions(inst)) releaseRegion(gameAreaId(inst.id, r));
}

/** 分批把地图包络体清空为空气（按 tick 分批，避免卡服） */
export async function clearMapBlocks(dim: Dimension, regions: MapRegion[]): Promise<void> {
  const overall = getOverallBounds(regions);
  const clearBounds: RegionBounds = {
    min: { x: overall.min.x, y: CLEAR_Y_MIN, z: overall.min.z },
    max: { x: overall.max.x, y: CLEAR_Y_MAX, z: overall.max.z },
  };
  const gen = clearRegionBlocksGen(dim, clearBounds);
  let slices = 0;
  for (const _ of gen) {
    slices++;
    if (slices % SLICES_PER_TICK === 0) await sleepTicks(1);
  }
  console.log(`[BW] MapReset: cleared ${slices} chunk slices`);
}

/** 清理地图包络体内的残留实体（掉落物 / 盔甲架 / 村民），返回清理数量 */
export function clearMapEntities(dim: Dimension, regions: MapRegion[]): number {
  const overall = getOverallBounds(regions);
  let killed = 0;
  for (const type of ENTITY_TYPES) {
    let entities;
    try {
      entities = dim.getEntities({ type });
    } catch {
      continue;
    }
    for (const e of entities) {
      const loc = e.location;
      if (loc.x < overall.min.x || loc.x > overall.max.x) continue;
      if (loc.y < overall.min.y || loc.y > overall.max.y) continue;
      if (loc.z < overall.min.z || loc.z > overall.max.z) continue;
      try {
        e.kill();
        killed++;
      } catch {}
    }
  }
  return killed;
}

/** 安全放置结构：区块未加载或放置失败时只记日志，不抛错 */
export function placeStructure(dim: Dimension, structureId: string, pos: Vector3): boolean {
  try {
    world.structureManager.place(structureId, dim, pos);
    return true;
  } catch (e: any) {
    console.error(`[BW] place structure ${structureId} failed: ${e?.message ?? e}`);
    return false;
  }
}

/**
 * 完整重置实例地图：移除游戏期区块保持区 → 确保区块加载 → 清空方块 →
 * 清理实体 → 释放临时区域。任何一步都不依赖玩家所在位置。
 */
export async function resetInstanceMap(dim: Dimension, inst: BedwarsInstanceData): Promise<void> {
  console.log(`[BW] MapReset: start ${inst.id}`);
  const regions = getInstanceRegions(inst);
  removeGameAreas(inst);
  for (const r of regions) {
    await ensureRegionLoaded(dim, loadAreaId(inst, r), r);
  }
  await clearMapBlocks(dim, regions);
  const killed = clearMapEntities(dim, regions);
  for (const r of regions) releaseRegion(loadAreaId(inst, r));
  console.log(`[BW] MapReset: done ${inst.id}, entities killed: ${killed}`);
}
