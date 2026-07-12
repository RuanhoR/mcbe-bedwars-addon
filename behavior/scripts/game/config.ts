import { TeamColor, ShopItemDef, I18nKeyList } from "../types";
import { t } from "../i18n/locals";

export const MAP_Y = 100;
export const INIT_ISLAND_Y = 210;

export interface StructureInfo {
  id: string;
  name: string;
  size: [number, number, number];
}

export const STRUCTURES: Record<string, StructureInfo> = {
  init_play: { id: "brige_init_play", name: "初始等待岛屿", size: [40, 20, 30] },
  center: { id: "brige_center", name: "中岛", size: [45, 20, 46] },
  yellow: { id: "yellow_bed_brige", name: "黄队家", size: [18, 22, 18] },
  blue: { id: "blue_bed_brige", name: "蓝队家", size: [18, 22, 18] },
  red: { id: "red_bed_brige", name: "红队家", size: [18, 24, 18] },
  white: { id: "white_bed_brige", name: "白队家", size: [18, 22, 18] },
  small_yellow: { id: "brige_small_yellow", name: "小岛（黄）", size: [7, 8, 7] },
  small_grass: { id: "brige_small_grass", name: "小岛（草）", size: [10, 8, 6] },
  small_green: { id: "brige_small_green", name: "小岛（绿）", size: [7, 6, 7] },
};

export function getStructure(id: string): StructureInfo {
  const s = STRUCTURES[id];
  if (!s) throw new Error(`Structure ${id} not found`);
  return s;
}

export interface EntityRefPos {
  customName: string;
  relPos: [number, number, number];
}

export interface TeamLayout {
  color: TeamColor;
  structureKey: string;
  label: string;
  placeOffset: [number, number, number];
  entities: EntityRefPos[];
}

export interface MapLayout {
  center: { structureKey: string; placeOffset: [number, number, number]; entities: EntityRefPos[] };
  teams: TeamLayout[];
  smallIslands: {
    structureKey: string;
    placeOffset: [number, number, number];
    entities: EntityRefPos[];
    label: string;
  }[];
}

const TEAM_ENTITY_POS: Record<string, EntityRefPos[]> = {
  yellow: [
    { customName: "brige_lookup", relPos: [6.5, 9.5, 3.5] },
    { customName: "brige_bed", relPos: [10.5, 10.5625, 12.5] },
    { customName: "brige_pay", relPos: [11.5, 9.5, 6.5] },
  ],
  blue: [
    { customName: "brige_lookup", relPos: [6.5, 12.0, 2.5] },
    { customName: "brige_pay", relPos: [11.5, 11.5, 6.5] },
    { customName: "brige_bed", relPos: [10.5, 12.5625, 12.5] },
  ],
  red: [
    { customName: "brige_lookup", relPos: [6.5, 10.5, 3.5] },
    { customName: "brige_bed", relPos: [10.5, 11.5625, 12.5] },
    { customName: "brige_pay", relPos: [11.5, 10.5, 6.5] },
  ],
  white: [
    { customName: "brige_lookup", relPos: [6.5, 10.5, 3.5] },
    { customName: "brige_pay", relPos: [11.5, 10.5, 6.5] },
    { customName: "brige_bed", relPos: [10.5, 11.5625, 12.5] },
  ],
};

const CENTER_ENTITIES: EntityRefPos[] = [
  { customName: "brige_lookup_gold", relPos: [12.5, 6.0, 24.5] },
  { customName: "brige_lookup", relPos: [16.5, 6.0, 18.5] },
  { customName: "brige_lookup", relPos: [16.5, 6.0, 30.5] },
  { customName: "brige_lookup_gold", relPos: [22.5, 6.0, 13.5] },
  { customName: "brige_lookup", relPos: [28.5, 6.0, 18.5] },
  { customName: "brige_lookup_diamond", relPos: [22.5, 8.5, 24.5] },
  { customName: "brige_lookup_gold", relPos: [22.5, 6.0, 34.5] },
  { customName: "brige_lookup", relPos: [28.5, 6.0, 30.5] },
  { customName: "brige_lookup_gold", relPos: [33.5, 6.0, 24.5] },
];

const SMALL_ENTITY_POS: Record<string, EntityRefPos[]> = {
  yellow: [{ customName: "brige_lookup_gold", relPos: [3.5, 2.0, 3.5] }],
  grass: [{ customName: "brige_lookup", relPos: [5.5, 2.5, 3.5] }],
  green: [{ customName: "brige_lookup_gold", relPos: [3.5, 4.0, 3.5] }],
};

export const GAP = 30;

export function getMapLayout(originX: number, originZ: number): MapLayout {
  const cx = originX;
  const cz = originZ;
  const halfCenter = Math.floor(45 / 2);
  const halfTeam = Math.floor(18 / 2);
  const teamDist = halfCenter + GAP + halfTeam;

  return {
    center: {
      structureKey: "center",
      placeOffset: [cx - halfCenter, MAP_Y, cz - Math.floor(46 / 2)],
      entities: CENTER_ENTITIES,
    },
    teams: [
      {
        color: "yellow",
        structureKey: "yellow",
        label: "黄队",
        placeOffset: [cx - teamDist - halfTeam, MAP_Y, cz - Math.floor(18 / 2)],
        entities: TEAM_ENTITY_POS.yellow,
      },
      {
        color: "red",
        structureKey: "red",
        label: "红队",
        placeOffset: [cx + halfCenter + GAP, MAP_Y, cz - Math.floor(18 / 2)],
        entities: TEAM_ENTITY_POS.red,
      },
      {
        color: "white",
        structureKey: "white",
        label: "白队",
        placeOffset: [cx - Math.floor(18 / 2), MAP_Y, cz - teamDist - halfTeam],
        entities: TEAM_ENTITY_POS.white,
      },
      {
        color: "blue",
        structureKey: "blue",
        label: "蓝队",
        placeOffset: [cx - Math.floor(18 / 2), MAP_Y, cz + halfCenter + GAP],
        entities: TEAM_ENTITY_POS.blue,
      },
    ],
    smallIslands: [
      {
        structureKey: "small_yellow",
        label: "小岛（黄）",
        placeOffset: [cx - halfCenter - GAP, MAP_Y, cz - halfCenter - GAP],
        entities: SMALL_ENTITY_POS.yellow,
      },
      {
        structureKey: "small_green",
        label: "小岛（绿）",
        placeOffset: [cx + halfCenter + GAP - 7, MAP_Y, cz - halfCenter - GAP],
        entities: SMALL_ENTITY_POS.green,
      },
      {
        structureKey: "small_green",
        label: "小岛（绿）",
        placeOffset: [cx - halfCenter - GAP, MAP_Y, cz + halfCenter + GAP - 7],
        entities: SMALL_ENTITY_POS.green,
      },
      {
        structureKey: "small_grass",
        label: "小岛（草）",
        placeOffset: [cx + halfCenter + GAP - 10, MAP_Y, cz + halfCenter + GAP - 6],
        entities: SMALL_ENTITY_POS.grass,
      },
    ],
  };
}

export const SHOP_ITEMS: ShopItemDef[] = [
  {
    id: "wool",
    nameKey: "shopWool",
    cost: [{ itemId: "minecraft:iron_ingot", count: 4 }],
    result: { itemId: "minecraft:white_wool", count: 16 },
  },
  {
    id: "wood_sword",
    nameKey: "shopWoodSword",
    cost: [{ itemId: "minecraft:iron_ingot", count: 4 }],
    result: { itemId: "minecraft:wooden_sword", count: 1 },
    enchantments: [{ id: "sharpness", level: 1 }],
  },
  {
    id: "bridge_egg",
    nameKey: "shopBridgeEgg",
    cost: [{ itemId: "minecraft:iron_ingot", count: 16 }],
    result: { itemId: "minecraft:egg", count: 1, lore: "0xbridge" },
  },
  {
    id: "stone_sword",
    nameKey: "shopStoneSword",
    cost: [{ itemId: "minecraft:gold_ingot", count: 8 }],
    result: { itemId: "minecraft:stone_sword", count: 1 },
    enchantments: [{ id: "sharpness", level: 2 }],
  },
  {
    id: "iron_sword",
    nameKey: "shopIronSword",
    cost: [{ itemId: "minecraft:gold_ingot", count: 16 }],
    result: { itemId: "minecraft:iron_sword", count: 1 },
    enchantments: [{ id: "sharpness", level: 3 }],
  },
  {
    id: "diamond_sword",
    nameKey: "shopDiamondSword",
    cost: [{ itemId: "minecraft:diamond", count: 6 }],
    result: { itemId: "minecraft:diamond_sword", count: 1 },
    enchantments: [{ id: "sharpness", level: 5 }],
  },
  {
    id: "leather_armor",
    nameKey: "shopLeatherArmor",
    cost: [{ itemId: "minecraft:iron_ingot", count: 16 }],
    result: { itemId: "minecraft:leather_chestplate", count: 1 },
    armor: true,
  },
  {
    id: "chain_armor",
    nameKey: "shopChainArmor",
    cost: [{ itemId: "minecraft:gold_ingot", count: 16 }],
    result: { itemId: "minecraft:chainmail_chestplate", count: 1 },
    enchantments: [{ id: "protection", level: 1 }],
    armor: true,
  },
  {
    id: "iron_armor",
    nameKey: "shopIronArmor",
    cost: [{ itemId: "minecraft:diamond", count: 2 }, { itemId: "minecraft:gold_ingot", count: 16 }],
    result: { itemId: "minecraft:iron_chestplate", count: 1 },
    enchantments: [{ id: "protection", level: 2 }],
    armor: true,
  },
  {
    id: "diamond_armor",
    nameKey: "shopDiamondArmor",
    cost: [{ itemId: "minecraft:diamond", count: 166 }],
    result: { itemId: "minecraft:diamond_chestplate", count: 1 },
    enchantments: [{ id: "protection", level: 3 }],
    armor: true,
  },
  {
    id: "shears",
    nameKey: "shopShears",
    cost: [{ itemId: "minecraft:iron_ingot", count: 16 }],
    result: { itemId: "minecraft:shears", count: 1 },
  },
  {
    id: "obsidian",
    nameKey: "shopObsidian",
    cost: [{ itemId: "minecraft:gold_ingot", count: 6 }],
    result: { itemId: "minecraft:obsidian", count: 1 },
  },
  {
    id: "fire_charge",
    nameKey: "shopFireCharge",
    cost: [{ itemId: "minecraft:gold_ingot", count: 12 }],
    result: { itemId: "minecraft:fire_charge", count: 1, lore: "0x8971" },
  },
];

export const TEAM_WOOL_MAP: Record<TeamColor, string> = {
  red: "minecraft:red_wool",
  blue: "minecraft:blue_wool",
  yellow: "minecraft:yellow_wool",
  white: "minecraft:white_wool",
  green: "minecraft:green_wool",
};

/**
 * Get the display name of a team color with color code, translated to current language.
 */
export function getTeamColorName(color: TeamColor): string {
  const colorCode: Record<TeamColor, string> = {
    red: "§c",
    blue: "§9",
    yellow: "§e",
    white: "§f",
    green: "§a",
  };
  return colorCode[color] + t(("color" + color.charAt(0).toUpperCase() + color.slice(1)) as I18nKeyList);
}
