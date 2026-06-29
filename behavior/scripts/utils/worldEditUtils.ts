import { Dimension, system } from "@minecraft/server";

export function fillAir(dimension: Dimension, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let y = minY; y <= maxY; y++) {
        const block = dimension.getBlock({ x, y, z });
        if (block && block.typeId !== "minecraft:air") {
          block.setType("minecraft:air");
        }
      }
    }
  }
}

export function chunkedFillAir(dimension: Dimension, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): Promise<void> {
  return new Promise((resolve) => {
    const batchSize = 200;
    const blocks: { x: number; y: number; z: number }[] = [];
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let y = minY; y <= maxY; y++) {
          blocks.push({ x, y, z });
        }
      }
    }
    let idx = 0;
    function processBatch() {
      const end = Math.min(idx + batchSize, blocks.length);
      for (let i = idx; i < end; i++) {
        const block = dimension.getBlock(blocks[i]);
        if (block && block.typeId !== "minecraft:air") {
          block.setType("minecraft:air");
        }
      }
      idx = end;
      if (idx < blocks.length) {
        system.run(processBatch);
      } else {
        resolve();
      }
    }
    processBatch();
  });
}

export function getStructureBounds(ox: number, oy: number, oz: number, size: [number, number, number]) {
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
