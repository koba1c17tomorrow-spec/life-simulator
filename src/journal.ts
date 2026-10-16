import type { GameState } from "./engine";
/** Monotonic IDs remain unique after the rolling history reaches its limit. */
export function record(s: GameState, text: string, worldEventId?: string) {
  s.logSequence = (s.logSequence ?? s.history.length) + 1;
  s.history.unshift({
    id: `log-${s.logSequence}`,
    month: s.month,
    text,
    ...(worldEventId ? { worldEventId } : {}),
  });
  if (/【|卒業|進学|誕生|結婚|交際|就職|昇進|幼い/.test(text))
    s.timeline.push({ month: s.month, text });
  if (s.history.length > 1500) s.history.length = 1500;
}
