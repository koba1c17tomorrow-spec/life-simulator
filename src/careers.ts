import type { Capabilities } from "./capabilities";
import type { Career } from "./progression";
export type JobId =
  | "retail"
  | "hospitality"
  | "warehouse"
  | "care"
  | "sales"
  | "administration"
  | "accounting"
  | "software"
  | "mechanical"
  | "electrical"
  | "research"
  | "design"
  | "writing"
  | "media"
  | "teaching"
  | "logistics"
  | "construction"
  | "publicservice"
  | "food"
  | "healthcare";
export type Job = {
  category: Career;
  strain: number;
  id: JobId;
  name: string;
  salary: number;
  knowledge: number;
  sociability: number;
  educationBonus?: boolean;
};
export const JOBS: Job[] = [
  {
    id: "retail",
    category: "service",
    strain: 0.1,
    name: "販売員",
    salary: 2300000,
    knowledge: 12,
    sociability: 45,
  },
  {
    id: "hospitality",
    category: "office",
    strain: 0.1,
    name: "ホテルスタッフ",
    salary: 2800000,
    knowledge: 25,
    sociability: 60,
  },
  {
    id: "warehouse",
    category: "parttime",
    strain: 0.14,
    name: "倉庫作業員",
    salary: 2600000,
    knowledge: 8,
    sociability: 12,
  },
  {
    id: "care",
    category: "office",
    strain: 0.14,
    name: "介護職",
    salary: 3000000,
    knowledge: 25,
    sociability: 50,
  },
  {
    id: "sales",
    category: "office",
    strain: 0.1,
    name: "営業職",
    salary: 3700000,
    knowledge: 35,
    sociability: 68,
  },
  {
    id: "administration",
    category: "office",
    strain: 0.1,
    name: "一般事務",
    salary: 3000000,
    knowledge: 42,
    sociability: 35,
  },
  {
    id: "accounting",
    category: "office",
    strain: 0.1,
    name: "経理",
    salary: 3800000,
    knowledge: 65,
    sociability: 25,
  },
  {
    id: "software",
    category: "technical",
    strain: 0.1,
    name: "ソフトウェア技術者",
    salary: 4900000,
    knowledge: 75,
    sociability: 20,
    educationBonus: true,
  },
  {
    id: "mechanical",
    category: "technical",
    strain: 0.1,
    name: "機械設計",
    salary: 4500000,
    knowledge: 72,
    sociability: 25,
    educationBonus: true,
  },
  {
    id: "electrical",
    category: "technical",
    strain: 0.1,
    name: "電気技術者",
    salary: 4400000,
    knowledge: 70,
    sociability: 25,
    educationBonus: true,
  },
  {
    id: "research",
    category: "technical",
    strain: 0.1,
    name: "研究職",
    salary: 5100000,
    knowledge: 90,
    sociability: 20,
    educationBonus: true,
  },
  {
    id: "design",
    category: "creative",
    strain: 0.1,
    name: "デザイナー",
    salary: 3600000,
    knowledge: 55,
    sociability: 38,
  },
  {
    id: "writing",
    category: "creative",
    strain: 0.1,
    name: "ライター",
    salary: 2800000,
    knowledge: 58,
    sociability: 35,
  },
  {
    id: "media",
    category: "creative",
    strain: 0.1,
    name: "映像制作",
    salary: 3400000,
    knowledge: 52,
    sociability: 45,
  },
  {
    id: "teaching",
    category: "office",
    strain: 0.1,
    name: "教育関連職",
    salary: 3800000,
    knowledge: 70,
    sociability: 60,
    educationBonus: true,
  },
  {
    id: "logistics",
    category: "office",
    strain: 0.1,
    name: "配送職",
    salary: 3100000,
    knowledge: 18,
    sociability: 20,
  },
  {
    id: "construction",
    category: "office",
    strain: 0.14,
    name: "建設技術職",
    salary: 3700000,
    knowledge: 45,
    sociability: 25,
  },
  {
    id: "publicservice",
    category: "office",
    strain: 0.1,
    name: "公務員",
    salary: 3900000,
    knowledge: 65,
    sociability: 40,
  },
  {
    id: "food",
    category: "service",
    strain: 0.14,
    name: "飲食店スタッフ",
    salary: 2500000,
    knowledge: 12,
    sociability: 48,
  },
  {
    id: "healthcare",
    category: "office",
    strain: 0.14,
    name: "医療関連職",
    salary: 4300000,
    knowledge: 80,
    sociability: 50,
    educationBonus: true,
  },
];
export function jobOffers(
  s: {
    month: number;
    stats: { knowledge: number; sociability: number; health: number };
    graduatedUniversity: boolean;
    seed: number;
  },
  count = 3,
): Job[] {
  const scored = JOBS.map((job) => {
    const suitability =
      100 -
      Math.abs(s.stats.knowledge - job.knowledge) * 0.7 -
      Math.abs(s.stats.sociability - job.sociability) * 0.5 +
      (s.graduatedUniversity && job.educationBonus ? 12 : 0);
    const hash =
      (Math.imul(s.seed ^ job.id.length, 1664525) + job.salary) >>> 0;
    return { job, score: suitability + (hash % 37) - 18 };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((x) => x.job);
}
export type HiringContext = {
  capabilities?: Capabilities;
  stats: { knowledge: number; sociability: number; health: number };
  graduatedUniversity: boolean;
  workExperience?: number;
  degree?: string | null;
  traits?: string[];
  flags?: Record<string, boolean>;
  benefits?: Record<string, number>;
  month?: number;
};
export function hiringFactors(
  s: HiringContext,
  job: Job,
): Record<string, number> {
  return {
    基礎: 45,
    習得技能: Math.min(5, ((s.capabilities?.skills.professional ?? 0) + (s.capabilities?.skills.communication ?? 0)) / 40),
    知識適性: (s.stats.knowledge - job.knowledge) * 0.5,
    対人適性: (s.stats.sociability - job.sociability) * 0.35,
    健康: (s.stats.health - 50) * 0.12,
    学歴:
      job.educationBonus &&
      (s.degree === "university" ||
        (s.graduatedUniversity && (s.month ?? 0) >= 264))
        ? 14
        : s.degree === "vocational"
          ? 5
          : 0,
    経験: Math.min(10, (s.workExperience ?? 0) / 36),
    専門資格: s.flags?.qualified ? 4 : 0,
    創造性:
      s.traits?.includes("creative") &&
      ["design", "writing", "media"].includes(job.id)
        ? 8
        : 0,
    職業訓練:
      s.benefits?.qualification !== undefined &&
      s.benefits.qualification >= (s.month ?? 0)
        ? 7
        : 0,
  };
}
export function offerChance(s: HiringContext, job: Job): number {
  return Math.max(
    8,
    Math.min(
      95,
      Math.round(
        Object.values(hiringFactors(s, job)).reduce((a, b) => a + b, 0),
      ),
    ),
  );
}
export function hiringExplanation(s: HiringContext, job: Job): string {
  return Object.entries(hiringFactors(s, job))
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${k}${v >= 0 ? "+" : ""}${v.toFixed(1)}`)
    .join(" / ");
}
