export type Gender = "male" | "female" | "nonbinary";
export type Orientation =
  | "heterosexual"
  | "bisexual"
  | "homosexual"
  | "asexual";
export type Identity = { gender: Gender; orientation: Orientation };
export type IdentityChoice = {
  gender?: Gender | "random";
  orientation?: Orientation | "random";
};
export function genderLabel(g: Gender): string {
  return { male: "男性", female: "女性", nonbinary: "ノンバイナリー" }[g];
}
export function orientationLabel(o: Orientation): string {
  return {
    heterosexual: "異性愛",
    bisexual: "両性愛",
    homosexual: "同性愛",
    asexual: "無性愛",
  }[o];
}
export function randomIdentity(
  random: () => number,
  choice: IdentityChoice = {},
): Identity {
  const gender =
    choice.gender && choice.gender !== "random"
      ? choice.gender
      : random() < 0.495
        ? "male"
        : random() < 0.98
          ? "female"
          : "nonbinary";
  const roll = random();
  const orientation =
    choice.orientation && choice.orientation !== "random"
      ? choice.orientation
      : roll < 0.88
        ? "heterosexual"
        : roll < 0.95
          ? "bisexual"
          : roll < 0.985
            ? "homosexual"
            : "asexual";
  return { gender, orientation };
}
export function compatible(a: Identity, b: Identity): boolean {
  if (a.orientation === "asexual" || b.orientation === "asexual") return false;
  const accepts = (person: Identity, other: Identity) =>
    person.orientation === "bisexual" ||
    (person.orientation === "heterosexual" && person.gender !== other.gender) ||
    (person.orientation === "homosexual" && person.gender === other.gender);
  return accepts(a, b) && accepts(b, a);
}
