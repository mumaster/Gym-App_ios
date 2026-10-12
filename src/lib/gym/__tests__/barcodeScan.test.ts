import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeSize, DECODE_MAX_WIDTH } from "../barcodeDecode";
import { lookupBarcode } from "../barcodeLookup";

describe("decodeSize", () => {
  it("shrinks a 1080p frame, keeping the aspect ratio", () => {
    expect(decodeSize(1920, 1080)).toEqual({ w: DECODE_MAX_WIDTH, h: 576 });
  });
  it("never upscales and handles an empty video", () => {
    expect(decodeSize(640, 480)).toEqual({ w: 640, h: 480 });
    expect(decodeSize(0, 0)).toEqual({ w: 0, h: 0 });
  });
});

describe("lookupBarcode cache", () => {
  afterEach(() => vi.unstubAllGlobals());

  const ok = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: 1, product: { product_name: "Bar" } }),
    });

  it("asks Open Food Facts once for a repeated code", async () => {
    const fetchMock = vi.fn(ok);
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([lookupBarcode("111"), lookupBarcode("111")]);
    await lookupBarcode("111");
    expect(a?.name).toBe("Bar");
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockImplementation(ok);
    vi.stubGlobal("fetch", fetchMock);
    await expect(lookupBarcode("222")).rejects.toThrow();
    await Promise.resolve();
    expect((await lookupBarcode("222"))?.name).toBe("Bar");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
