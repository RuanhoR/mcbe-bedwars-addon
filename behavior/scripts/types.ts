export enum WorldDynamicPropertyKeys {
  OpList = "__Oplist",
  GolbalLanguage = "__Global_language",
  BedwarsData = "__BedwarsData",
}

export type I18nKeyList =
  | "mangeOp"
  | "addOp"
  | "removeOp"
  | "setGlobalLanguage"
  | "player"
  | "playerCannotEmpty"
  | "removeOpSuccess"
  | "addOpSuccess"
  | "bedwarsManager"
  | "createInstance"
  | "test"
  | "deleteInstance"
  | "instanceList"
  | "instanceName"
  | "instanceX"
  | "instanceZ"
  | "instancePlayerCount"
  | "gameMode2v2"
  | "gameMode4v2"
  | "gameMode8v4"
  | "gameMode4v4"
  | "confirmDelete"
  | "confirmDeleteBody"
  | "deleteSuccess"
  | "createSuccess"
  | "cancel"
  | "statusIdle"
  | "statusWaiting"
  | "statusPlaying"
  | "startGame"
  | "endGame"
  | "instanceDetail"
  | "initIslandNotLoaded"
  | "initIslandPromptX"
  | "initIslandPromptZ"
  | "loadingMap"
  | "mapLoaded"
  | "teleportingToInit"
  | "waitingForPlayers"
  | "gameStarting"
  | "gameStarted"
  | "gameEnded"
  | "joinGame"
  | "leaveGame"
  | "notEnoughPlayers"
  | "playerJoined"
  | "playerLeft"
  | "teamAssigned"
  | "bedDestroyed"
  | "youAreDead"
  | "spectatorMode"
  | "shopTitle"
  | "shopWool"
  | "shopWoodSword"
  | "shopBridgeEgg"
  | "shopStoneSword"
  | "shopIronSword"
  | "shopDiamondSword"
  | "shopLeatherArmor"
  | "shopChainArmor"
  | "shopIronArmor"
  | "shopDiamondArmor"
  | "shopShears"
  | "shopObsidian"
  | "shopFireCharge"
  | "notEnoughItems"
  | "purchaseSuccess"
  | "cannotBuyNow"
  | "instanceNotFound"
  | "alreadyInGame"
  | "gameAlreadyStarted"
  | "teamFull"
  | "returnHubMsg"
  | "gameEndBroadcast"
  | "gameStartBroadcast"
  | "leaveGameMsg"
  | "notInGame"
  | "loadingIsland"
  | "mapLoadComplete"
  | "loadingInitIsland"
  | "initIslandLoaded"
  | "noInstances"
  | "bedAliveLabel"
  | "bedDestroyedLabel"
  | "gameGo"
  | "respawnCountdown"
  | "bedDestroyedMsg"
  | "notEnoughPlayersStart"
  | "setLanguage"
  | "languageSet"
  | "restartHint"
  | "scoreboardTitle"
  | "scoreboardStatus"
  | "scoreboardTeamLine"
  | "gameWin"
  | "colorRed"
  | "colorBlue"
  | "colorYellow"
  | "colorWhite"
  | "colorGreen"
  | "shopVillagerName"
  | "playerNotFound"
  | "noOpsToRemove"
  | "selectOpToRemove"
  | "failedToJoin"
  | "instanceNotFoundByName"
  | "teleportedToHub"
  | "invalidCoordinates"
  | "invalidInput"
  | "clickForDetails"
  | "offlinePlayer"
  | "teamEliminated"
  | "youAreOut"
  | "detailName"
  | "detailStatus"
  | "detailCoord"
  | "detailTeams"
  | "detailTeamInfo"
  | "detailNone"
  | "detailBed"
  | "detailBack"
  | "langChinese"
  | "langEnglish";

export const I18nLanguageKeyArr = ["zh", "en"] as const;
export type I18nLanguageList = (typeof I18nLanguageKeyArr)[number];
export const defaultLanguage = "zh" satisfies I18nLanguageList;

export type TeamColor = "red" | "blue" | "yellow" | "white" | "green";

export interface BedwarsTeamData {
  color: TeamColor;
  players: string[];
  bedPosition: { x: number; y: number; z: number } | null;
  shopPosition: { x: number; y: number; z: number } | null;
  ironPosition: { x: number; y: number; z: number } | null;
  goldPosition: { x: number; y: number; z: number } | null;
  diamondPosition: { x: number; y: number; z: number } | null;
  bedAlive: boolean;
}

export type InstanceStatus = "idle" | "waiting" | "playing";

export interface BedwarsInstanceData {
  id: string;
  name: string;
  x: number;
  z: number;
  teamCount: number;
  playersPerTeam: number;
  totalPlayers: number;
  status: InstanceStatus;
  teams: BedwarsTeamData[];
  initIslandX: number;
  initIslandZ: number;
}

export interface BedwarsGlobalData {
  initIslandLoaded: boolean;
  initIslandX: number;
  initIslandZ: number;
  instances: BedwarsInstanceData[];
}

export interface ShopCost {
  itemId: string;
  count: number;
}
export interface ShopItemDef {
  id: string;
  nameKey: I18nKeyList;
  cost: ShopCost[];
  result: { itemId: string; count: number; lore?: string };
  enchantments?: { id: string; level: number }[];
  armor?: boolean;
}

export const TEAM_COLORS: TeamColor[] = ["red", "blue", "yellow", "white"];
