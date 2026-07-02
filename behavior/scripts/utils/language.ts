import { world } from "@minecraft/server";
import {
  defaultLanguage,
  I18nLanguageKeyArr,
  I18nLanguageList,
  WorldDynamicPropertyKeys,
} from "../types";
let isInitd = false;
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
export function getCurrentLanguage() {
  if (!isInitd) init();
  return world.getDynamicProperty(
    WorldDynamicPropertyKeys.GolbalLanguage,
  ) as I18nLanguageList;
}
export function setGlobalLanguage(language: I18nLanguageList) {
  if (!isInitd) init();
  world.setDynamicProperty(WorldDynamicPropertyKeys.GolbalLanguage, language);
}
