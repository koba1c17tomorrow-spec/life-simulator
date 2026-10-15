import { describe, it, expect } from "vitest";
import {
  newGame,
  advanceMonth,
  choose,
  takeAction,
  type EventDefinition,
} from "../src/engine";
const event: EventDefinition = {
  id: "test",
  category: "growth",
  presentation: "choice",
  weight: 1,
  text: "選択イベント",
  choices: [{ label: "はい", effects: [{ stat: "happiness", delta: 5 }] }],
};
describe("月次エンジン", () => {
  it("1か月進む", () => expect(advanceMonth(newGame(), []).month).toBe(1));
  it("同じシードなら結果が一致する", () => {
    let a = newGame(42),
      b = newGame(42);
    for (let i = 0; i < 50; i++) {
      a = advanceMonth(a, []);
      b = advanceMonth(b, []);
    }
    expect(a).toEqual(b);
  });
  it("選択待ちは時間停止", () => {
    const s = newGame();
    s.month = 10;
    s.monthStarted = true;
    s.pending = { eventId: "test", text: event.text, choices: event.choices! };
    expect(advanceMonth(s, [event]).month).toBe(10);
  });
  it("選択後は同月の処理を完了する", () => {
    const s = newGame();
    s.month = 10;
    s.monthStarted = true;
    s.pending = { eventId: "test", text: event.text, choices: event.choices! };
    const next = choose(s, 0, [event]);
    expect(next.month).toBe(10);
    expect(next.stats.happiness).toBe(65);
    expect(next.monthStarted).toBe(false);
  });
  it("1か月に複数のイベントを処理できる", () => {
    const s = newGame();
    s.month = 10;
    s.monthStarted = true;
    s.queue = ["a", "b"];
    const events: EventDefinition[] = ["a", "b"].map((id) => ({
      id,
      category: "growth",
      presentation: "log",
      weight: 1,
      text: id,
      effects: [{ stat: "knowledge", delta: 1 }],
    }));
    const next = advanceMonth(s, events);
    expect(next.stats.knowledge).toBe(17);
    expect(next.history[0].text).toBe("b");
  });
});
describe("自主行動", () => {
  it("月1回まで", () => {
    const s = newGame();
    s.month = 192;
    const a = takeAction(s, "work");
    const b = takeAction(a, "work");
    expect(b.stats.money).toBe(1000);
  });
  it("翌月は再度可能", () => {
    const s = newGame();
    s.month = 192;
    const a = takeAction(s, "work");
    const b = advanceMonth(a, []);
    expect(takeAction(b, "work").stats.money).toBe(2000);
  });
});
