import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendAgentQuery } from "../hooks/useStadiumData.js";

describe("sendAgentQuery (multilingual plumbing)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("posts the message and selected language to the agent endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: "hola", toolsUsed: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendAgentQuery("status?", "es");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/agent/query");
    expect(JSON.parse(options.body)).toEqual({ message: "status?", language: "es" });
    expect(result.response).toBe("hola");
  });

  it("defaults the language to English when none is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await sendAgentQuery("hi");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).language).toBe("en");
  });

  it("falls back to the server-provided fallback text on a non-OK response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ fallback: "offline summary" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendAgentQuery("hi", "fr");
    expect(result.response).toBe("offline summary");
  });
});
