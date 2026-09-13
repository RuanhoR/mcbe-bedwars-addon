import { Block, BlockVolume, Dimension, system, Vector3, world } from "@minecraft/server";

/** 区域边界（min/max 均为闭区间） */
export interface RegionBounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

/**
 * 安全读取方块：区块未加载时返回 undefined 而不是抛错。
 * 参考 YouNiDim 的 getBlockSafe。
 */
export function getBlockSafe(dimension: Dimension, pos: Vector3): Block | undefined {
  try {
    return dimension.getBlock(pos);
  } catch {
    return undefined;
  }
}

/**
 * 安全写入方块类型：区块未加载或写入失败时返回 false。
 * 参考 YouNiDim 的 setBlockSafe。
 */
export function setBlockSafe(dimension: Dimension, pos: Vector3, typeId: string): boolean {
  try {
    const block = dimension.getBlock(pos);
    if (!block) return false;
    block.setType(typeId);
    return true;
  } catch {
    return false;
  }
}

/** 探测某个区块是否已加载（参考 YouNiDim 的 isChunkLoaded） */
export function isChunkLoaded(dimension: Dimension, cx: number, cz: number): boolean {
  return getBlockSafe(dimension, { x: (cx << 4) + 8, y: 64, z: (cz << 4) + 8 }) !== undefined;
}

/** 区域覆盖的所有区块是否都已加载 */
export function isRegionLoaded(dimension: Dimension, region: RegionBounds): boolean {
  const cxMin = Math.floor(region.min.x) >> 4;
  const cxMax = Math.floor(region.max.x) >> 4;
  const czMin = Math.floor(region.min.z) >> 4;
  const czMax = Math.floor(region.max.z) >> 4;
  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cz = czMin; cz <= czMax; cz++) {
      if (!isChunkLoaded(dimension, cx, cz)) return false;
    }
  }
  return true;
}

const LOAD_POLL_TIMEOUT_TICKS = 200; // 最多等 10 秒

/**
 * 用临时 tickingarea 确保区域区块加载完成（参考 YouNiDim 的 ensureChunkLoaded）。
 * createTickingArea 的 Promise 在区块加载完成后才 resolve，之后再用探测轮询兜底。
 * 返回 true 表示已全部加载；false 表示超时/容量不足。
 * 成功创建的临时区域由调用方通过 releaseRegion 释放。
 */
export async function ensureRegionLoaded(dimension: Dimension, id: string, region: RegionBounds): Promise<boolean> {
  if (isRegionLoaded(dimension, region)) return true;
  const mgr = world.tickingAreaManager;
  const from = { x: region.min.x, y: Math.max(-64, region.min.y), z: region.min.z };
  const to = { x: region.max.x, y: Math.min(319, region.max.y), z: region.max.z };
  if (!mgr.hasTickingArea(id)) {
    if (!mgr.hasCapacity({ dimension, from, to })) {
      console.warn(`[BW] tickingarea capacity insufficient for ${id}, falling back to polling`);
    } else {
      try {
        await mgr.createTickingArea(id, { dimension, from, to });
      } catch (e: any) {
        console.error(`[BW] createTickingArea ${id} failed: ${e?.message ?? e}`);
      }
    }
  }
  for (let t = 0; t < LOAD_POLL_TIMEOUT_TICKS; t++) {
    if (isRegionLoaded(dimension, region)) return true;
    await sleepTicks(1);
  }
  console.error(`[BW] ensureRegionLoaded timeout: ${id}`);
  return false;
}

/** 释放按 id 创建的临时/长效 tickingarea（不存在时静默忽略） */
export function releaseRegion(id: string) {
  try {
    world.tickingAreaManager.removeTickingArea(id);
  } catch {}
}

/**
 * 清空一个区块对齐的切片为空气：优先整块 fillBlocks（不跨区块），
 * 失败时退回逐列填充（跨区块 fillBlocks 会静默失败，逐列最稳，同 YouNiDim）。
 */
function clearChunkSlice(dimension: Dimension, slice: RegionBounds): boolean {
  try {
    dimension.fillBlocks(
      new BlockVolume(slice.min, slice.max),
      "minecraft:air",
      { ignoreChunkBoundErrors: true },
    );
    return true;
  } catch {
    for (let x = slice.min.x; x <= slice.max.x; x++) {
      for (let z = slice.min.z; z <= slice.max.z; z++) {
        try {
          dimension.fillBlocks(
            new BlockVolume({ x, y: slice.min.y, z }, { x, y: slice.max.y, z }),
            "minecraft:air",
            { ignoreChunkBoundErrors: true },
          );
        } catch {}
      }
    }
    return false;
  }
}

/**
 * 分批清空区域为空气：按 16x16 区块切片处理，每处理一个切片 yield 一次，
 * 由调用方控制每 tick 的处理量，避免单 tick 大量写方块造成卡顿。
 */
export function* clearRegionBlocksGen(dimension: Dimension, region: RegionBounds): Generator<void, void, void> {
  const cxMin = Math.floor(region.min.x) >> 4;
  const cxMax = Math.floor(region.max.x) >> 4;
  const czMin = Math.floor(region.min.z) >> 4;
  const czMax = Math.floor(region.max.z) >> 4;
  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cz = czMin; cz <= czMax; cz++) {
      const slice: RegionBounds = {
        min: {
          x: Math.max(region.min.x, cx << 4),
          y: region.min.y,
          z: Math.max(region.min.z, cz << 4),
        },
        max: {
          x: Math.min(region.max.x, (cx << 4) + 15),
          y: region.max.y,
          z: Math.min(region.max.z, (cz << 4) + 15),
        },
      };
      clearChunkSlice(dimension, slice);
      yield;
    }
  }
}

export function getStructureBounds(ox: number, oy: number, oz: number, size: [number, number, number]): RegionBounds {
  return {
    min: { x: ox, y: oy, z: oz },
    max: { x: ox + size[0] - 1, y: oy + size[1] - 1, z: oz + size[2] - 1 },
  };
}

export function sleepTicks(ticks: number): Promise<void> {
  return new Promise((resolve) => {
    system.runTimeout(() => resolve(), ticks);
  });
}
