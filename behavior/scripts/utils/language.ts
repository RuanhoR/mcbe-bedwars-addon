import { world } from "@minecraft/server";
import {
  defaultLanguage,
  I18nLanguageKeyArr,
  I18nLanguageList,
  WorldDynamicPropertyKeys,
} from "../types";

// Lazy init flag for language preference
let isInitd = false;

/**
 * Initialize the global language setting from world dynamic property.
 * Falls back to defaultLanguage if not set or invalid.
 */
function init() {
  let stored = world.getDynamicProperty(
    WorldDynamicPropertyKeys.GolbalLanguage,
  );
  if (
    !stored ||
    !I18nLanguageKeyArr.includes(stored as string as I18nLanguageList)
  ) {
    world.setDynamicProperty(
      WorldDynamicPropertyKeys.GolbalLanguage,
      defaultLanguage,
    );
    stored = defaultLanguage;
  }
  isInitd = true;
  return stored;
}

/**
 * Get the current global language setting.
 * Returns "zh" or "en".
 */
export function getCurrentLanguage() {
  if (!isInitd) init();
  return world.getDynamicProperty(
    WorldDynamicPropertyKeys.GolbalLanguage,
  ) as I18nLanguageList;
}

/**
 * Set the global language for all players.
 * @param language - "zh" or "en"
 */
export function setGlobalLanguage(language: I18nLanguageList) {
  if (!isInitd) init();
  world.setDynamicProperty(WorldDynamicPropertyKeys.GolbalLanguage, language);
}
