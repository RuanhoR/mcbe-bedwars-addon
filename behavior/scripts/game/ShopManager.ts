import {
  Player,
  ItemStack,
  Entity,
  EnchantmentType,
  EquipmentSlot,
} from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { TeamColor, ShopItemDef, ShopCost } from "../types";
import { SHOP_ITEMS, TEAM_WOOL_MAP, getTeamColorName } from "./config";
import { t } from "../i18n/locals";

class ShopManager {
  /**
   * Show the shop UI to a player with all available items
   * 向玩家显示所有可用物品的商店界面
   */
  static showShop(player: Player, teamColor: TeamColor) {
    const form = new ActionFormData()
      .title(t("shopTitle"))
      .body(`§7${t("shopTitle")}\n§7${t("teamAssigned", { color: getTeamColorName(teamColor) })}`);

    for (const item of SHOP_ITEMS) {
      const costStr = this._formatCost(item);
      const name = t(item.nameKey);
      form.button(`${name}\n§7${costStr}`);
    }

    form.button("§c" + t("cancel"));

    form.show(player).then((res) => {
      if (res.canceled) return;
      const selection = res.selection;
      if (selection === undefined || selection >= SHOP_ITEMS.length) return;
      this._processPurchase(player, teamColor, SHOP_ITEMS[selection]);
    });
  }

  /**
   * Format item cost for display (e.g. "4 iron ingot + 2 gold ingot")
   * 格式化物品价格显示
   */
  private static _formatCost(item: ShopItemDef): string {
    return item.cost
      .map((c) => `§e${c.count} ${c.itemId.split(":")[1].replace("_", " ")}`)
      .join(" + ");
  }

  /**
   * Process a purchase: check funds, deduct cost, give item
   * 处理购买：检查资金，扣除费用，给予物品
   */
  private static _processPurchase(
    player: Player,
    teamColor: TeamColor,
    itemDef: ShopItemDef,
  ) {
    // Check if player has enough materials
    for (const cost of itemDef.cost) {
      const has = this._countItem(player, cost.itemId) >= cost.count;
      if (!has) {
        player.sendMessage(
          t("notEnoughItems", {
            count: String(cost.count),
            item: cost.itemId.split(":")[1],
          }),
        );
        return;
      }
    }
    // Deduct materials
    for (const cost of itemDef.cost) {
      this._removeItems(player, cost.itemId, cost.count);
    }

    // Give item (armor sets are handled differently)
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
      if (!item || item.typeId !== itemId) continue;
      if (item.amount <= remaining) {
        remaining -= item.amount;
        inv.setItem(i, undefined);
      } else {
        const leftover = new ItemStack(itemId, item.amount - remaining);
        inv.setItem(i, leftover);
        remaining = 0;
      }
    }
  }

  private static _giveItem(
    player: Player,
    itemDef: ShopItemDef,
    teamColor: TeamColor,
  ) {
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
      const enchComponent = itemStack.getComponent("minecraft:enchantable");
      if (enchComponent) {
        for (const ench of itemDef.enchantments) {
          try {
            enchComponent.addEnchantment({
              type: new EnchantmentType(ench.id),
              level: ench.level,
            });
          } catch (e) {
            console.log(`BW Enchant fail ${ench.id}: ${e}`);
          }
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

    const equipment = player.getComponent("equippable");
    if (!equipment) return;

    for (const piece of armorSet) {
      const stack = new ItemStack(piece.itemId, 1);
      const enchComponent = stack.getComponent("minecraft:enchantable");
      if (enchComponent) {
        if (itemDef.enchantments) {
          for (const ench of itemDef.enchantments) {
            try {
              enchComponent.addEnchantment({
                type: new EnchantmentType(ench.id),
                level: ench.level,
              });
            } catch (e) {
              console.log(`BW Armor enchant fail ${ench.id}: ${e}`);
            }
          }
        }
        try {
          enchComponent.addEnchantment({
            type: new EnchantmentType("binding"),
            level: 1,
          });
        } catch (e) {
          console.log(`BW Binding enchant fail: ${e}`);
        }
      }
      try {
        equipment.setEquipment(piece.slot as EquipmentSlot, stack);
      } catch (e: any) {
        console.error(`[BW] set armor failed: ${e?.message ?? e}`);
      }
    }
  }

  static handleProjectileHit(
    owner: Entity,
    hitBlock: { x: number; y: number; z: number },
  ) {
    if (!owner.getDynamicProperty("__bw_instance")) return;

    const teamColor = owner.getDynamicProperty("__bw_team") as TeamColor;
    if (!teamColor) return;

    const woolId = TEAM_WOOL_MAP[teamColor] || "minecraft:white_wool";
    const dim = owner.dimension;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        try {
          const bp = dim.getBlock({
            x: hitBlock.x + dx,
            y: hitBlock.y,
            z: hitBlock.z + dz,
          });
          if (bp && bp.typeId === "minecraft:air") {
            bp.setType(woolId);
          }
        } catch (e: any) {
          console.error(`[BW] bridge egg place wool failed: ${e?.message ?? e}`);
        }
      }
    }
  }
}

export default ShopManager;
