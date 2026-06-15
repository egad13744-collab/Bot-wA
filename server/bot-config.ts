import fs from "fs";
import path from "path";

export interface AutoReply {
  id: string;
  keyword: string;
  reply: string;
  matchType: "exact" | "contains";
  groupId?: string; // Optional group ID. If present, only applies to this group.
}

export interface BotSettings {
  botName: string;
  adminPhone: string; // The phone number of the master/owner admin (international format without + or spaces, e.g. 628123456789)
  prefix: string; // Command prefix, defaults to "/"
}

export interface BotStats {
  messagesReceived: number;
  messagesSent: number;
}

export interface CommandConfig {
  name: string;
  enabled: boolean;
}

export interface GroupConfig {
  id: string;
  name: string;
  enabled: boolean;
  autoReplyEnabled: boolean;
  welcomeEnabled: boolean;
  welcomeMessage: string;
  goodbyeEnabled: boolean;
  goodbyeMessage: string;
  antilinkEnabled: boolean;
  rankEnabled: boolean;
  antibadwordEnabled: boolean;
  badwordList: string[];
  xpPerChat: number;
  cooldown: number; // in seconds
}

export interface UserXpStats {
  groupId: string;
  userId: string;
  name: string;
  xp: number;
  level: number;
  totalChat: number;
  joinedAt: number;
  lastMessageTime: number;
}

export interface FeatureSettings {
  levelingEnabled: boolean;
  rankEnabled: boolean;
  antiBadwordEnabled: boolean;
  randomEnabled: boolean;
}

export interface BotState {
  settings: BotSettings;
  stats: BotStats;
  autoReplies: AutoReply[];
  commands: CommandConfig[];
  groups: GroupConfig[];
  xpData: UserXpStats[];
  features: FeatureSettings;
}

const CONFIG_PATH = path.join(process.cwd(), "sessions", "bot-config.json");

const defaultCommands: CommandConfig[] = [
  { name: "menu", enabled: true },
  { name: "ping", enabled: true },
  { name: "status", enabled: true },
  { name: "runtime", enabled: true },
  { name: "owner", enabled: true },
  { name: "bprofile", enabled: true },
  { name: "bvo", enabled: true },
  { name: "tts", enabled: true },
  { name: "its", enabled: true },
  { name: "antilink", enabled: true },
  { name: "profile", enabled: true },
  { name: "level", enabled: true },
  { name: "rank", enabled: true },
  { name: "leaderboard", enabled: true },
  { name: "getpp", enabled: true },
  { name: "quotes", enabled: true },
  { name: "fakta", enabled: true },
  { name: "joke", enabled: true },
  { name: "antibadword", enabled: true },
  { name: "feature", enabled: true },
  { name: "tebakkata", enabled: true }
];

const defaultState: BotState = {
  settings: {
    botName: "WhatsApp Bot Official",
    adminPhone: "",
    prefix: "/",
  },
  stats: {
    messagesReceived: 0,
    messagesSent: 0,
  },
  autoReplies: [
    {
      id: "reply_1",
      keyword: "halo",
      reply: "Halo juga! Senang bisa melayani Anda. Ada yang bisa kami bantu? 😊",
      matchType: "exact",
    },
    {
      id: "reply_2",
      keyword: "info",
      reply: "WhatsApp Bot ini dibuat menggunakan Node.js, Baileys Library, dan React Dashboard! Server aktif 24/7.",
      matchType: "contains",
    },
    {
      id: "reply_3",
      keyword: "harga",
      reply: "Untuk informasi harga layanan atau paket bot, silakan hubungi admin kami secara langsung.",
      matchType: "contains",
    }
  ],
  commands: defaultCommands,
  groups: [],
  xpData: [],
  features: {
    levelingEnabled: true,
    rankEnabled: true,
    antiBadwordEnabled: true,
    randomEnabled: true
  }
};

let currentState: BotState = { ...defaultState };

// Ensure directories exist
function ensureDirs() {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadBotState(): BotState {
  ensureDirs();
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = fs.readFileSync(CONFIG_PATH, "utf8");
      const parsed = JSON.parse(data);
      
      // Clean merge commands to avoid missing default commands in old config
      const loadedCommands = parsed.commands || [];
      const mergedCommands = defaultCommands.map(defaultCmd => {
        const found = loadedCommands.find((c: any) => c.name === defaultCmd.name);
        return found ? { ...defaultCmd, ...found } : defaultCmd;
      });

      // Ensure groups have all required keys
      const loadedGroups = (parsed.groups || []).map((g: any) => ({
        enabled: true,
        autoReplyEnabled: false,
        welcomeEnabled: false,
        welcomeMessage: "Selamat datang @user di grup ini!",
        goodbyeEnabled: false,
        goodbyeMessage: "@user telah keluar.",
        antilinkEnabled: false,
        rankEnabled: true,
        antibadwordEnabled: false,
        badwordList: [],
        xpPerChat: 10,
        cooldown: 30,
        ...g
      }));

      // Fill missing properties cleanly to avoid breakage on updates
      currentState = {
        settings: { ...defaultState.settings, ...parsed.settings },
        stats: { ...defaultState.stats, ...parsed.stats },
        autoReplies: parsed.autoReplies || defaultState.autoReplies,
        commands: mergedCommands,
        groups: loadedGroups,
        xpData: parsed.xpData || [],
        features: parsed.features ? { ...defaultState.features, ...parsed.features } : { ...defaultState.features }
      };
      return currentState;
    } catch (err) {
      console.error("Failed to load bot config:", err);
      currentState = { ...defaultState };
      return currentState;
    }
  } else {
    saveBotState(defaultState);
    return defaultState;
  }
}

export function saveBotState(state: BotState) {
  ensureDirs();
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(state, null, 2), "utf8");
    currentState = state;
  } catch (err) {
    console.error("Failed to save bot state to disk:", err);
  }
}

export function getBotState(): BotState {
  return currentState;
}

export function incrementReceived() {
  currentState.stats.messagesReceived += 1;
  saveBotState(currentState);
}

export function incrementSent() {
  currentState.stats.messagesSent += 1;
  saveBotState(currentState);
}

export function updateSettings(newSettings: Partial<BotSettings>) {
  currentState.settings = { ...currentState.settings, ...newSettings };
  saveBotState(currentState);
}

export function addAutoReply(keyword: string, reply: string, matchType: "exact" | "contains", groupId?: string): AutoReply {
  const newReply: AutoReply = {
    id: "reply_" + Math.random().toString(36).substr(2, 9),
    keyword: keyword.trim().toLowerCase(),
    reply: reply.trim(),
    matchType,
    groupId
  };
  currentState.autoReplies.push(newReply);
  saveBotState(currentState);
  return newReply;
}

export function deleteAutoReply(id: string): boolean {
  const initialLength = currentState.autoReplies.length;
  currentState.autoReplies = currentState.autoReplies.filter((item) => item.id !== id);
  saveBotState(currentState);
  return currentState.autoReplies.length < initialLength;
}

// Commands controller
export function toggleCommand(name: string, enabled: boolean): boolean {
  const cmd = currentState.commands.find(c => c.name === name);
  if (cmd) {
    cmd.enabled = enabled;
    saveBotState(currentState);
    return true;
  }
  return false;
}

// Group settings controller
export function upsertGroupConfig(id: string, name: string, updates?: Partial<GroupConfig>): GroupConfig {
  let group = currentState.groups.find(g => g.id === id);
  if (!group) {
    group = {
      id,
      name: name || "Grup WhatsApp",
      enabled: true, // Groups enabled by default when joining, or can choose false
      autoReplyEnabled: false, // Default auto reply: OFF as requested
      welcomeEnabled: false,
      welcomeMessage: "Selamat datang @user di grup ini!",
      goodbyeEnabled: false,
      goodbyeMessage: "@user telah keluar.",
      antilinkEnabled: false,
      rankEnabled: true,
      antibadwordEnabled: false,
      badwordList: [],
      xpPerChat: 10,
      cooldown: 30,
      ...updates
    };
    currentState.groups.push(group);
  } else {
    if (name) group.name = name;
    if (updates) {
      Object.assign(group, updates);
    }
  }
  saveBotState(currentState);
  return group;
}

export function updateGroupConfig(id: string, updates: Partial<GroupConfig>): boolean {
  const group = currentState.groups.find(g => g.id === id);
  if (group) {
    Object.assign(group, updates);
    saveBotState(currentState);
    return true;
  }
  return false;
}

// Feature toggles
export function toggleFeature(name: keyof FeatureSettings, enabled: boolean): boolean {
  if (name in currentState.features) {
    currentState.features[name] = enabled;
    saveBotState(currentState);
    return true;
  }
  return false;
}

// Leveling mechanics
export function getXpNeededForLevel(level: number): number {
  if (level <= 1) return 0;
  return 100 * (level - 1) + 25 * (level - 1) * (level - 2);
}

export function getLevelFromXp(xp: number): number {
  let L = 1;
  while (true) {
    const cumulativeNeeded = getXpNeededForLevel(L + 1);
    if (xp < cumulativeNeeded) {
      break;
    }
    L++;
  }
  return L;
}

export function getLevelProgress(xp: number): {
  level: number;
  xpInThisLevel: number;
  xpTargetForThisLevel: number;
  percent: number;
  progressBar: string;
} {
  const level = getLevelFromXp(xp);
  const currentLevelBase = getXpNeededForLevel(level);
  const nextLevelBase = getXpNeededForLevel(level + 1);
  
  const xpTargetForThisLevel = nextLevelBase - currentLevelBase;
  const xpInThisLevel = Math.max(0, xp - currentLevelBase);
  const percent = xpTargetForThisLevel > 0 ? Math.min(100, Math.floor((xpInThisLevel / xpTargetForThisLevel) * 100)) : 100;
  
  const filledBlocks = Math.min(10, Math.floor(percent / 10));
  const emptyBlocks = 10 - filledBlocks;
  const progressBar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);
  
  return {
    level,
    xpInThisLevel,
    xpTargetForThisLevel,
    percent,
    progressBar
  };
}

export function addXpAward(
  groupId: string,
  userId: string,
  name: string,
  xpAward: number
): { leveledUp: boolean; oldLevel: number; newLevel: number } | null {
  if (!currentState.features.levelingEnabled) return null;

  const now = Date.now();
  let userStats = currentState.xpData.find(u => u.groupId === groupId && u.userId === userId);
  
  if (!userStats) {
    userStats = {
      groupId,
      userId,
      name: name || "User",
      xp: 0,
      level: 1,
      totalChat: 0,
      joinedAt: now,
      lastMessageTime: 0
    };
    currentState.xpData.push(userStats);
  }

  if (name && name !== "User" && name !== userStats.name) {
    userStats.name = name;
  }

  const oldLevel = userStats.level;
  userStats.xp += xpAward;
  
  const newLevel = getLevelFromXp(userStats.xp);
  let leveledUp = false;
  if (newLevel > oldLevel) {
    userStats.level = newLevel;
    leveledUp = true;
  }

  saveBotState(currentState);
  return { leveledUp, oldLevel, newLevel };
}

export function addXpForUser(
  groupId: string,
  userId: string,
  name: string
): { xpAdded: number; leveledUp: boolean; oldLevel: number; newLevel: number } | null {
  if (!currentState.features.levelingEnabled) return null;

  const group = currentState.groups.find(g => g.id === groupId);
  
  // Custom rank toggled per-group?
  const isGroupRankActive = group ? (group.rankEnabled !== false) : true;
  if (groupId !== "global" && !isGroupRankActive) {
    // If ranking feature is disabled inside this group, we don't proceed with XP accumulation
    return null;
  }

  const xpPerChat = (group && group.xpPerChat !== undefined) ? group.xpPerChat : 10;
  const cooldownSec = (group && group.cooldown !== undefined) ? group.cooldown : 30;

  const now = Date.now();
  let userStats = currentState.xpData.find(u => u.groupId === groupId && u.userId === userId);
  
  if (!userStats) {
    userStats = {
      groupId,
      userId,
      name: name || "User",
      xp: 0,
      level: 1,
      totalChat: 0,
      joinedAt: now,
      lastMessageTime: 0
    };
    currentState.xpData.push(userStats);
  }

  if (name && name !== "User" && name !== userStats.name) {
    userStats.name = name;
  }

  userStats.totalChat += 1;

  const timePassed = now - userStats.lastMessageTime;
  const isOnCooldown = timePassed < (cooldownSec * 1000);

  if (isOnCooldown) {
    saveBotState(currentState);
    return { xpAdded: 0, leveledUp: false, oldLevel: userStats.level, newLevel: userStats.level };
  }

  const oldLevel = userStats.level;
  userStats.xp += xpPerChat;
  userStats.lastMessageTime = now;

  const newLevel = getLevelFromXp(userStats.xp);
  let leveledUp = false;
  if (newLevel > oldLevel) {
    userStats.level = newLevel;
    leveledUp = true;
  }

  saveBotState(currentState);
  return { xpAdded: xpPerChat, leveledUp, oldLevel, newLevel };
}

export function getUserGroupRank(groupId: string, userId: string): { rankPosition: number; totalMembers: number; stats: UserXpStats | null } {
  const groupMembers = currentState.xpData
    .filter(u => u.groupId === groupId)
    .sort((a, b) => b.xp - a.xp || b.totalChat - a.totalChat);

  const totalMembers = groupMembers.length;
  const index = groupMembers.findIndex(u => u.userId === userId);
  const rankPosition = index !== -1 ? index + 1 : totalMembers + 1;
  const stats = index !== -1 ? groupMembers[index] : null;

  return { rankPosition, totalMembers, stats };
}

export function getGroupLeaderboard(groupId: string, limit: number = 10): UserXpStats[] {
  return currentState.xpData
    .filter(u => u.groupId === groupId)
    .sort((a, b) => b.xp - a.xp || b.totalChat - a.totalChat)
    .slice(0, limit);
}

export function resetGroupXp(groupId: string) {
  currentState.xpData = currentState.xpData.filter(u => u.groupId !== groupId);
  saveBotState(currentState);
}

// Group badword managers
export function addGroupBadword(groupId: string, word: string): boolean {
  const group = currentState.groups.find(g => g.id === groupId);
  if (group) {
    if (!group.badwordList) group.badwordList = [];
    const cleanWord = word.trim().toLowerCase();
    if (cleanWord && !group.badwordList.includes(cleanWord)) {
      group.badwordList.push(cleanWord);
      saveBotState(currentState);
      return true;
    }
  }
  return false;
}

export function removeGroupBadword(groupId: string, word: string): boolean {
  const group = currentState.groups.find(g => g.id === groupId);
  if (group && group.badwordList) {
    const cleanWord = word.trim().toLowerCase();
    const initialLength = group.badwordList.length;
    group.badwordList = group.badwordList.filter(w => w !== cleanWord);
    if (group.badwordList.length < initialLength) {
      saveBotState(currentState);
      return true;
    }
  }
  return false;
}

// Initial state load
loadBotState();
