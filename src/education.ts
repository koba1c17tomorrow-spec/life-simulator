import type { GameState, PendingChoice } from "./engine";
export type School = {
  studyPath: "job" | "vocational" | "university";
  degree: "high" | "vocational" | "university" | null;
  club: "none" | "arts" | "sports" | "science";
  teacherSupport: number;
  childhoodConfidence: number;
  dropout: boolean;
  flags: Record<string, boolean>;
  workExperience: number;
};
export const initialSchool = (): School => ({
  studyPath: "job",
  degree: null,
  club: "none",
  teacherSupport: 0,
  childhoodConfidence: 0,
  dropout: false,
  flags: {},
  workExperience: 0,
});
export function schoolMonth(
  s: GameState,
  random: () => number,
  log: (text: string) => void,
) {
  if (s.month < 216) {
    if (s.month === 72) {
      s.people.push({
        id: "teacher",
        name: "担任の先生",
        kind: "teacher",
        birthMonth: -360,
        alive: true,
        personality: "kind",
        occupation: "employed",
        education: "university",
        values: "career",
      });
      s.relations.push({
        id: "teacher",
        closeness: 40,
        trust: 55,
        lastContactMonth: s.month,
      });
    }
    if (s.month >= 72 && s.month % 12 === 0) {
      const teacher = s.relations.find((r) => r.id === "teacher");
      s.teacherSupport = teacher ? teacher.trust / 100 : 0;
      s.childhoodConfidence = Math.min(
        10,
        s.childhoodConfidence +
          (s.origin.upbringing === "supportive" ? 0.25 : 0.1) +
          (s.traits.includes("resilient") ? 0.1 : 0),
      );
      s.origin.schoolPerformance = Math.min(
        100,
        s.origin.schoolPerformance + s.teacherSupport * 0.4,
      );
      log("学校で一年を振り返った。先生や友人との経験が自信になっていく。");
    }
    if (s.club !== "none" && s.month >= 144) {
      s.stats[
        s.club === "sports"
          ? "health"
          : s.club === "arts"
            ? "happiness"
            : "knowledge"
      ] = Math.min(
        100,
        s.stats[
          s.club === "sports"
            ? "health"
            : s.club === "arts"
              ? "happiness"
              : "knowledge"
        ] + 0.015,
      );
      s.flags["club-" + s.club] = true;
    }
  }
  if (s.month === 216) {
    s.degree = "high";
    if (s.graduatedUniversity) {
      s.studyPath = "university";
      if (s.origin.schoolPerformance >= 65) {
        s.scholarship = true;
        log("成績に基づく給付奨学金が決まり、大学の学費負担が軽くなった。");
      }
    }
    if (s.studyPath === "vocational") {
      log("専門学校に進学し、職業技能を学び始めた。");
    }
  }
  if (s.month === 240 && s.studyPath === "vocational" && !s.dropout) {
    s.degree = "vocational";
    log("専門学校を卒業し、職業資格を得た。");
    s.flags.qualified = true;
  }
  if (s.month === 264 && s.graduatedUniversity && !s.dropout) {
    s.degree = "university";
    s.flags.graduate = true;
    log("大学での学びを修め、学位を得た。");
  }
  if (s.month >= 216 && s.career !== "none" && !s.retired) {
    s.workExperience++;
    s.lifetimeWork++;
    if (s.month % 24 === 0) {
      const topic =
        s.jobId === "care" || s.jobId === "healthcare"
          ? "支えてきた人から感謝された"
          : s.jobId === "design" || s.jobId === "writing" || s.jobId === "media"
            ? "自分の作品が誰かに届いた"
            : s.jobId === "teaching"
              ? "教え子の成長を喜んだ"
              : "仕事の経験が次の役割につながった";
      log("【仕事】" + topic + "。");
      s.stats.happiness = Math.min(100, s.stats.happiness + 1);
    }
  }
  if (s.flags["club-arts"] && s.month >= 216) s.flags.creativeBackground = true;
  if (s.origin.region === "rural" && s.month === 216) {
    log("地元に残る友人、街へ出る友人。それぞれの進路が始まった。");
  }
}
export function schoolMilestone(s: GameState): PendingChoice | null {
  if (s.month === 144)
    return {
      eventId: "club-plan",
      text: "中学校でどんな放課後を過ごそう？",
      choices: [
        { label: "文化・芸術の部活", effects: [], club: "arts" },
        { label: "運動部", effects: [], club: "sports" },
        { label: "科学・学習の部活", effects: [], club: "science" },
        { label: "放課後は自由に過ごす", effects: [], club: "none" },
      ],
    };
  if (s.month === 180)
    return {
      eventId: "university-plan",
      text: "高校に進学した。卒業後の進路を考えよう。",
      choices: [
        {
          label: "大学進学を目指す",
          effects: [],
          university: true,
          studyPath: "university",
        },
        {
          label: "専門学校で技能を学ぶ",
          effects: [],
          university: false,
          studyPath: "vocational",
        },
        {
          label: "就職を目指す",
          effects: [],
          university: false,
          studyPath: "job",
        },
      ],
    };
  if (
    (s.education === "university" || s.education === "vocational") &&
    s.debt > 1500000 &&
    s.month - (s.lastSeen["dropout-plan"] ?? -999) > 24
  )
    return {
      eventId: "dropout-plan",
      text: "学費が家計を圧迫している。学業を続けるか考える。",
      choices: [
        { label: "学業を続ける", effects: [] },
        { label: "中退し、働く道へ進む", effects: [], leaveSchool: true },
      ],
    };
  return null;
}
export function setStudyPath(
  original: GameState,
  path: School["studyPath"],
): GameState {
  if (
    original.month < 180 ||
    original.month >= 216 ||
    original.pending ||
    original.finished ||
    !["job", "vocational", "university"].includes(path)
  )
    return original;
  return {
    ...original,
    studyPath: path,
    graduatedUniversity: path === "university",
  };
}
