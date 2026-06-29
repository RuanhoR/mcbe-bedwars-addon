import { Player, world } from "@minecraft/server";
import { WorldDynamicPropertyKeys } from "../types";

class PlayerPlayPermission {
  private static _isInitd = false;
  private static _opList: string[];
  /**
   * Initialize the OP list from dynamic property storage.
   * @returns The parsed OP list or empty array if invalid.
   */
  private static _initOpList(): string[] {
    let storedOpList = world.getDynamicProperty(
      WorldDynamicPropertyKeys.OpList,
    );

    // if stored != string
    if (!storedOpList || typeof storedOpList !== "string") {
      world.setDynamicProperty(WorldDynamicPropertyKeys.OpList, "[]");
      storedOpList = "[]";
    }

    if (!storedOpList.startsWith("[") || !storedOpList.endsWith("]")) {
      world.setDynamicProperty(WorldDynamicPropertyKeys.OpList, "[]");
      storedOpList = "[]";
    }

    try {
      const parsed = JSON.parse(storedOpList) as string[];
      if (!parsed.every((v) => typeof v == "string")) {
        world.setDynamicProperty(WorldDynamicPropertyKeys.OpList, "[]");
        this._isInitd = true;
        return [];
      }
      this._isInitd = true;
      return parsed;
    } catch {
      this._isInitd = true;
      world.setDynamicProperty(WorldDynamicPropertyKeys.OpList, "[]");
      return [];
    }
  }

  /**
   * Save the OP list to dynamic property storage.
   * @param value - The OP list to save.
   * @throws {TypeError} If the value is not a valid string array.
   */
  private static _setOpList(value: string[]): void {
    if (!value.every((r) => typeof r == "string"))
      throw new TypeError(`[bedwar internal error]: resolve invalid Oplist`);
    const parsed = JSON.stringify(value);
    this._opList = value;
    world.setDynamicProperty(WorldDynamicPropertyKeys.OpList, parsed);
  }
  public static runInit() {
    if (!this._isInitd) this._opList = this._initOpList();
  }

  /**
   * Add a player to the OP list.
   * @param player - The player to add as OP.
   */
  public static addOp(player: Player): void {
    if (this._opList.includes(player.id)) return;
    this._opList.push(player.id);
    this._setOpList(this._opList);
  }

  /**
   * Remove a player from the OP list.
   * @param player - The player to remove from OP.
   */
  public static removeOp(player: Player): void {
    const index = this._opList.indexOf(player.id);
    if (index === -1) return;
    this._opList.splice(index, 1);
    this._setOpList(this._opList);
  }

  /**
   * Check if a player is an OP.
   * @param player - The player to check.
   * @returns True if the player is in the OP list.
   */
  public static isOp(player: Player): boolean {
    if (this._opList.length == 0) {
      this.addOp(player);
      return true;
    }
    return this._opList.includes(player.id);
  }

  /**
   * Get the current list of OP player IDs.
   * @returns A copy of the OP list.
   */
  public static getOpList(): string[] {
    return [...this._opList];
  }

  /**
   * Get all online OP players.
   * @returns Array of online OP players.
   */
  public static getOnlineOps(): Player[] {
    const allPlayers = world.getPlayers();
    return allPlayers.filter((p) => this._opList.includes(p.id));
  }

  /**
   * Check if the OP list has been initialized.
   * @returns True if initialized.
   */
  public static isInitialized(): boolean {
    return this._isInitd;
  }
}
function initPlayerPermission() {
  if (!PlayerPlayPermission.isInitialized()) {
    PlayerPlayPermission.runInit();
  }
}
export function getOpList() {
  initPlayerPermission();
  return PlayerPlayPermission.getOpList();
}
export function addOp(player: Player) {
  initPlayerPermission();
  PlayerPlayPermission.addOp(player);
}
export function removeOp(player: Player) {
  initPlayerPermission();
  PlayerPlayPermission.removeOp(player);
}
export function getOnlineOps() {
  initPlayerPermission();
  return PlayerPlayPermission.getOnlineOps();
}
export function isOp(player: Player) {
  initPlayerPermission();
  return PlayerPlayPermission.isOp(player);
}
export default PlayerPlayPermission;
