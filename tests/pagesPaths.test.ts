import { afterEach, expect, it, vi } from "vitest";
import { loadWorld } from "../src/content";
import modern from "../public/worlds/modern/events.json";
import coastal from "../public/worlds/coastal/events.json";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it.each([
  ["modern", modern],
  ["coastal", coastal],
])(
  "loads %s manifest and events under the Pages subpath",
  async (id, events) => {
    vi.stubEnv("BASE_URL", "/life-simulator/");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id, name: id, events: "events.json" })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(events)));
    vi.stubGlobal("fetch", fetch);
    expect(await loadWorld(id)).toEqual(events);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `/life-simulator/worlds/${id}/manifest.json`,
      `/life-simulator/worlds/${id}/events.json`,
    ]);
  },
);
