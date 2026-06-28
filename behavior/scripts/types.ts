export enum WorldDynamicPropertyKeys {
  OpList = "__Oplist",
  GolbalLanguage = "__Global_language",
}
export type I18nKeyList =
  | "mangeOp"
  | "addOp"
  | "removeOp"
  | "setGlobalLanguage";
export const I18nLanguageKeyArr = ["zh", "en"] as const;
export type I18nLanguageList = (typeof I18nLanguageKeyArr)[number];
export const defaultLanguage = "zh" satisfies I18nLanguageList;
