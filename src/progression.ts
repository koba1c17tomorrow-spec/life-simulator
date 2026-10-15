import type { GameState } from "./engine";
import { JOBS, type JobId } from "./careers";
import { tuitionMonthly, type Origin } from "./origins";
export type Education =
  | "preschool"
  | "elementary"
  | "middle"
  | "high"
  | "university"
  | "vocational"
  | "working";
export type Career =
  | "none"
  | "parttime"
  | "office"
  | "technical"
  | "creative"
  | "service";
export type Progression = {
  education: Education;
  career: Career;
  careerLevel: number;
  experience: number;
  graduatedUniversity: boolean;
  partnerId: string | null;
  spouseId: string | null;
  children: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  debt: number;
  lastCareerPromptMonth: number;
  lastChoiceMonth: number;
  lastJobApplicationMonth: number;
};
export function initialProgression(): Progression {
  return {
    education: "preschool",
    career: "none",
    careerLevel: 0,
    experience: 0,
    graduatedUniversity: false,
    partnerId: null,
    spouseId: null,
    children: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    debt: 0,
    lastCareerPromptMonth: -999,
    lastChoiceMonth: -999,
    lastJobApplicationMonth: -999,
  };
}
export function normalizeProgression<T extends object>(s: T): T & Progression {
  return { ...initialProgression(), ...s } as T & Progression;
}
export function educationAt(
  month: number,
  university: boolean,
  path?: string,
): Education {
  if (month < 72) return "preschool";
  if (month < 144) return "elementary";
  if (month < 180) return "middle";
  if (month < 216) return "high";
  if (month >= 216 && month < 240 && path === "vocational") return "vocational";
  if (month < 264 && university) return "university";
  return "working";
}
export const salaryTable: Record<Career, number> = {
  none: 0,
  parttime: 90000,
  office: 220000,
  technical: 260000,
  creative: 200000,
  service: 190000,
};
export function annualSalary(c: Career, level = 0) {
  return Math.round(salaryTable[c] * (1 + level * 0.1) * 12);
}
export function jobChance(
  s: {
    month: number;
    stats: { knowledge: number; sociability: number; health: number };
    graduatedUniversity: boolean;
  },
  c: Career,
) {
  const base: Record<Career, number> = {
    none: 100,
    parttime: 90,
    office: 43,
    technical: 20,
    creative: 34,
    service: 62,
  };
  return c === "none"
    ? 100
    : Math.max(
        5,
        Math.min(
          95,
          Math.round(
            base[c] +
              s.stats.knowledge * (c === "technical" ? 0.65 : 0.18) +
              s.stats.sociability * (c === "service" ? 0.28 : 0.13) +
              s.stats.health * 0.08 +
              (s.graduatedUniversity && s.month >= 264 ? 14 : 0),
          ),
        ),
      );
}
export function progressionMonth(
  s: GameState,
  log: (message: string) => void,
): void {
  const old = s.education;
  s.education = educationAt(s.month, s.graduatedUniversity, s.studyPath);
  if (s.education !== old) {
    const names: Record<Education, string> = {
      preschool: "幼少期",
      elementary: "小学校",
      middle: "中学校",
      high: "高校",
      university: "大学",
      vocational: "専門学校",
      working: "社会人",
    };
    log(names[s.education] + "の時期を迎えた。");
  }
  if (s.month === 216 && s.graduatedUniversity) log("大学に進学した。");
  if (s.month === 264 && s.graduatedUniversity) log("大学を卒業した。");
  if (s.month >= 216 && s.career !== "none") {
    s.experience++;
    if (s.experience >= 60 && s.careerLevel < 5) {
      s.careerLevel++;
      s.experience = 0;
      log("仕事で昇進した。");
    }
  }
  const currentJob = JOBS.find(
    (j) => j.id === (s as Progression & { jobId?: JobId | null }).jobId,
  );
  s.monthlyIncome =
    s.month >= 216
      ? Math.round(
          (currentJob ? currentJob.salary / 12 : salaryTable[s.career]) *
            (1 + s.careerLevel * 0.1),
        )
      : 0;
  const university = s.month >= 216 && s.month < 264 && s.graduatedUniversity;
  const familySupport =
    university && s.origin
      ? s.origin.wealth === "comfortable"
        ? 140000
        : s.origin.wealth === "modest"
          ? 90000
          : 35000
      : 0;
  s.monthlyIncome += familySupport;
}
export function careerOptions(
  s: Progression & { month: number; stats: { knowledge: number } },
): Career[] {
  if (s.month < 192 || s.month >= 780) return [];
  const options: Career[] = ["parttime", "service", "creative", "office"];
  if (s.stats.knowledge >= 45) options.push("technical");
  return options;
}
export function careerName(c: Career): string {
  return {
    none: "無職",
    parttime: "アルバイト",
    office: "事務職",
    technical: "技術職",
    creative: "クリエイティブ職",
    service: "サービス職",
  }[c];
}
