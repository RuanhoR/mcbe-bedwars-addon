import { Player, ItemStack, Entity, EnchantmentType } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { TeamColor, ShopItemDef, ShopCost } from "../types";
import { SHOP_ITEMS, TEAM_WOOL_MAP, TEAM_COLOR_NAMES } from "./config";
import { t } from "../i18n/locals";

class ShopManager {
  static showShop(player: Player, teamColor: TeamColor) {
    const form = new ActionFormData()
      .title(t("shopTitle"))
      .body(`§7欢迎来到商店！\n§7你的队伍: ${TEAM_COLOR_NAMES[teamColor]}`);

    for (const item of SHOP_ITEMS) {
      const costStr = this._formatCost(item);
      const name = t(item.nameKey);
      form.button(`${name}\n§7${costStr}`);
    }

    form.button("§c退出");

    form.show(player).then((res) => {
      if (res.canceled) return;
      const selection = res.selection;
      if (selection === undefined || selection >= SHOP_ITEMS.length) return;
      this._processPurchase(player, teamColor, SHOP_ITEMS[selection]);
    });
  }

  private static _formatCost(item: ShopItemDef): string {
    return item.cost.map(c => `§e${c.count} ${c.itemId.split(":")[1].replace("_", " ")}`).join(" + ");
  }

  private static _processPurchase(player: Player, teamColor: TeamColor, itemDef: ShopItemDef) {
    for (const cost of itemDef.cost) {
      const has = this._countItem(player, cost.itemId) >= cost.count;
      if (!has) {
        player.sendMessage(t("notEnoughItems", { count: String(cost.count), item: cost.itemId.split(":")[1] }));
        return;
      }
    }
    for (const cost of itemDef.cost) {
      this._removeItems(player, cost.itemId, cost.count);
    }

    if (itemDef.armor) {
      this._giveArmor(player, itemDef);
    } else {
      this._giveItem(player, itemDef, teamColor);
    }

    player.sendMessage(t("purchaseSuccess"));
  }

  private static _countItem(player: Player, itemId: string): number {
    const inv = player.getComponent("inventory")?.container;
    if (!inv) return 0;
    let count = 0;
    for (let i = 0; i < inv.size; i++) {
      const item = inv.getItem(i);
      if (item && item.typeId === itemId) {
        count += item.amount;
      }
    }
    return count;
  }

  private static _removeItems(player: Player, itemId: string, count: number) {
    const inv = player.getComponent("inventory")?.container;
    if (!inv) return;
    let remaining = count;
    for (let i = 0; i < inv.size && remaining > 0; i++) {
      const item = inv.getItem(i);
      if (item && item.typeId === itemId) {
        const toRemove = Math.min(remaining, item.amount);
        item.amount -= toRemove;
        remaining -= toRemove;
        if (item.amount <= 0) {
          inv.setItem(i, undefined);
        } else {
          inv.setItem(i, item);
        }
      }
    }
  }

  private static _giveItem(player: Player, itemDef: ShopItemDef, teamColor: TeamColor) {
    const result = itemDef.result;
    let itemId = result.itemId;

    if (itemId === "minecraft:white_wool") {
      itemId = TEAM_WOOL_MAP[teamColor] || itemId;
    }

    const itemStack = new ItemStack(itemId, result.count);

    if (result.lore) {
      itemStack.setLore([result.lore]);
    }

    if (itemDef.enchantments) {
      const enchComponent = itemStack.getComponent("minecraft:enchantable") as any;
      if (enchComponent) {
        for (const ench of itemDef.enchantments) {
          try {
            enchComponent.addEnchantment({ type: new EnchantmentType(ench.id), level: ench.level });
          } catch (e) { console.log(`BW Enchant fail ${ench.id}: ${e}`); }
        }
      }
    }

    const inv = player.getComponent("inventory")?.container;
    if (inv) {
      inv.addItem(itemStack);
    }
  }

  private static _giveArmor(player: Player, itemDef: ShopItemDef) {
    const result = itemDef.result;
    const id = result.itemId;

    const armorMap: Record<string, { slot: string; itemId: string }[]> = {
      "minecraft:leather_chestplate": [
        { slot: "Feet", itemId: "minecraft:leather_boots" },
        { slot: "Legs", itemId: "minecraft:leather_leggings" },
        { slot: "Chest", itemId: "minecraft:leather_chestplate" },
        { slot: "Head", itemId: "minecraft:leather_helmet" },
      ],
      "minecraft:chainmail_chestplate": [
        { slot: "Feet", itemId: "minecraft:chainmail_boots" },
        { slot: "Legs", itemId: "minecraft:chainmail_leggings" },
        { slot: "Chest", itemId: "minecraft:chainmail_chestplate" },
        { slot: "Head", itemId: "minecraft:chainmail_helmet" },
      ],
      "minecraft:iron_chestplate": [
        { slot: "Feet", itemId: "minecraft:iron_boots" },
        { slot: "Legs", itemId: "minecraft:iron_leggings" },
        { slot: "Chest", itemId: "minecraft:iron_chestplate" },
        { slot: "Head", itemId: "minecraft:iron_helmet" },
      ],
      "minecraft:diamond_chestplate": [
        { slot: "Feet", itemId: "minecraft:diamond_boots" },
        { slot: "Legs", itemId: "minecraft:diamond_leggings" },
        { slot: "Chest", itemId: "minecraft:diamond_chestplate" },
        { slot: "Head", itemId: "minecraft:diamond_helmet" },
      ],
    };

    const armorSet = armorMap[id];
    if (!armorSet) return;

    const equipment = player.getComponent("equippable") as any;
    if (!equipment) return;

    for (const piece of armorSet) {
      const stack = new ItemStack(piece.itemId, 1);
      const enchComponent = stack.getComponent("minecraft:enchantable") as any;
      if (enchComponent) {
        if (itemDef.enchantments) {
          for (const ench of itemDef.enchantments) {
            try { enchComponent.addEnchantment({ type: new EnchantmentType(ench.id), level: ench.level }); } catch (e) { console.log(`BW Armor enchant fail ${ench.id}: ${e}`); }
          }
        }
        try { enchComponent.addEnchantment({ type: new EnchantmentType("binding"), level: 1 }); } catch (e) { console.log(`BW Binding enchant fail: ${e}`); }
      }
      try {
        equipment.setEquipment(piece.slot as any, stack);
      } catch { }
    }
  }

  static handleProjectileHit(owner: Entity, hitBlock: { x: number; y: number; z: number }) {
    if (!owner.getDynamicProperty("__bw_instance")) return;

    const teamColor = owner.getDynamicProperty("__bw_team") as TeamColor;
    if (!teamColor) return;

    const woolId = TEAM_WOOL_MAP[teamColor] || "minecraft:white_wool";
    const dim = owner.dimension;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        try {
          const bp = dim.getBlock({ x: hitBlock.x + dx, y: hitBlock.y, z: hitBlock.z + dz });
          if (bp && bp.typeId === "minecraft:air") {
            bp.setType(woolId);
          }
        } catch { }
      }
    }
  }
}

export default ShopManager;
