// Wire-format identifiers are independent of the game's release version.
export const SAVE_FORMAT = "life-simulator";
export const SAVE_FORMAT_VERSION = 1;
export const STATE_VERSION = 1;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function hasEnvelopeFields(value: Record<string, unknown>) {
  return ["format", "formatVersion", "state"].some((key) =>
    Object.hasOwn(value, key),
  );
}

// Autosaves contain raw state. Reserved envelope fields must never silently
// turn an unsupported export into a supported raw save.
export function assertRawStateFormat(value: unknown): void {
  if (isObject(value) && hasEnvelopeFields(value))
    throw Error("状態データに保存ファイルの形式情報が混在しています");
}

// Identify first; validation/defaulting of the state belongs to the engine.
// Unknown metadata on a supported envelope remains forward-compatible.
export function unwrapSave(value: unknown): unknown {
  if (!isObject(value) || !hasEnvelopeFields(value)) return value;
  if (
    value.format !== SAVE_FORMAT ||
    value.formatVersion !== SAVE_FORMAT_VERSION ||
    !isObject(value.state) ||
    Object.hasOwn(value, "version")
  )
    throw Error("対応していない保存ファイル形式です");
  return value.state;
}
