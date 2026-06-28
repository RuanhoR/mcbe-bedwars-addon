import { I18nKeyList, I18nLanguageList } from "../types";
import { getCurrentLanguage } from "../utils/language";
const lang = {
  zh: {
    addOp: "添加OP管理员（仅起床战争）",
    removeOp: "删除OP管理员（仅起床战争）",
    mangeOp: "管理OP管理员（仅起床战争）",
    setGlobalLanguage: "设置全局语言（仅起床战争）",
  },
  en: {
    addOp: "Add OP manger(Only Bedwar Addon)",
    removeOp: "Remove OP manger(only Bedwar Addon)",
    mangeOp: "Mange OP Manger(Only Bedwar Addon)",
    setGlobalLanguage: "Set global language(Only BedWar Addon)",
  },
} satisfies {
  [key in I18nLanguageList]: { [key in I18nKeyList]: string };
};
export function t(key: I18nKeyList): string {
  return lang[getCurrentLanguage()][key];
}
