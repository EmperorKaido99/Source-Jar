import { describe, expect, it, vi } from "vitest";
import { createApi } from "./api";

describe("createApi", () => {
  it("uses the configured base URL and encodes tool query parameters", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [], page: 1, limit: 12, total: 0,
    })));

    await createApi("http://api.test", fetcher).getTools({ q: "open source" });

    expect(fetcher).toHaveBeenCalledWith(
      "http://api.test/api/tools?q=open+source",
      expect.any(Object),
    );
  });

  it("maps suggestion validation fields to ApiError", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "Validation failed",
      fields: { name: "Name must be 1–60 characters" },
    }), { status: 400 }));

    await expect(createApi("http://api.test", fetcher).submitSuggestion({
      name: "",
      url: "https://example.test",
      jarId: "pb",
      description: "A valid enough description.",
    })).rejects.toMatchObject({
      message: "Validation failed",
      status: 400,
      fields: { name: "Name must be 1–60 characters" },
    });
  });
});
