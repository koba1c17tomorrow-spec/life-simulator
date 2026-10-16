import { normalizeGameState, type GameState } from "./engine";
import { SAVE_FORMAT, SAVE_FORMAT_VERSION, unwrapSave } from "./saveFormat";
export const SAVE = "life-sim-modern-v1";
const slotKey = (slot: number) => {
  if (!Number.isInteger(slot) || slot < 1 || slot > 3)
    throw Error("スロットは1〜3です");
  return SAVE + "-slot-" + slot;
};
export function exportSave(s: GameState) {
  return JSON.stringify(
    { format: SAVE_FORMAT, formatVersion: SAVE_FORMAT_VERSION, state: s },
    null,
    2,
  );
}
export function importSave(text: string): GameState {
  if (text.length > 5000000) throw Error("セーブファイルが大きすぎます");
  const v = JSON.parse(text);
  return normalizeGameState(unwrapSave(v));
}
export function saveSlot(
  storage: Pick<Storage, "setItem">,
  slot: number,
  s: GameState,
) {
  storage.setItem(slotKey(slot), exportSave(s));
}
export function loadSlot(storage: Pick<Storage, "getItem">, slot: number) {
  const raw = storage.getItem(slotKey(slot));
  if (!raw) throw Error("このスロットは空です");
  return importSave(raw);
}
export function describeSlot(storage: Pick<Storage, "getItem">, slot: number) {
  try {
    const s = loadSlot(storage, slot);
    return `${Math.floor(s.month / 12)}歳${s.month % 12}か月 · ${s.worldId === "coastal" ? "海辺" : "現代"}${s.finished ? " · 人生終了" : ""}`;
  } catch {
    return storage.getItem(slotKey(slot))
      ? "読込できないデータ（上書き注意）"
      : "空";
  }
}
