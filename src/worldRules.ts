import fantasy from "./fantasyRules.json";
/** Pure world data; no imports from engine, UI, storage or network. */
export type WorldRules = {
  version: 1;
  id: string;
  name: string;
  engine: "legacy" | "fantasy";
  education: { startMonth: number; adultMonth: number; name: string };
  economy: { currency: string; monthlyCost: number; childAllowance: number };
  species: Record<string, { name: string; lifespanMonths: number }>;
  careers: Record<string, { name: string; income: number; hours: number }>;
  magic: boolean;
  socialProfile: "modern" | "coastal" | "fantasy";
  eventsFile: string;
  scenarios: string[];
};
export const WORLD_RULES: Record<string, WorldRules> = {
  modern: {
    version: 1,
    id: "modern",
    name: "現代の人生",
    engine: "legacy",
    education: { startMonth: 72, adultMonth: 216, name: "学校教育" },
    economy: { currency: "円", monthlyCost: 0, childAllowance: 0 },
    species: { human: { name: "人間", lifespanMonths: 1200 } },
    careers: {},
    magic: false,
    socialProfile: "modern",
    eventsFile: "events.json",
    scenarios: ["town-errand"],
  },
  coastal: {
    version: 1,
    id: "coastal",
    name: "海辺の町の人生",
    engine: "legacy",
    education: { startMonth: 72, adultMonth: 216, name: "学校教育" },
    economy: { currency: "円", monthlyCost: 0, childAllowance: 0 },
    species: { human: { name: "人間", lifespanMonths: 1200 } },
    careers: {},
    magic: false,
    socialProfile: "coastal",
    eventsFile: "events.json",
    scenarios: ["town-errand"],
  },
  fantasy: fantasy as WorldRules,
};
export function worldRules(id: string): WorldRules {
  const rules = Object.hasOwn(WORLD_RULES, id) ? WORLD_RULES[id] : undefined;
  if (!rules) throw Error("未知の世界ルールです");
  return rules;
}
export const currencyLabel = (id: string) => worldRules(id).economy.currency;
