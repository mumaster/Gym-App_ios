import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeSize, DECODE_MAX_WIDTH, TILT_ANGLES } from "../barcodeDecode";
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

describe("TILT_ANGLES", () => {
  it("starts upright and covers tilts both ways", () => {
    expect(TILT_ANGLES[0]).toBe(0);
    expect(Math.min(...TILT_ANGLES)).toBeLessThan(0);
    expect(Math.max(...TILT_ANGLES)).toBeGreaterThan(0);
  });
});

describe("searchProducts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps products like a scan and drops ones without a name or kcal", async () => {
    const { searchProducts } = await import("../barcodeLookup");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              products: [
                {
                  code: "1",
                  product_name: " Pindakaas ",
                  brands: "Calvé, Unilever",
                  serving_size: "15 g",
                  nutriments: { "energy-kcal_100g": 600, proteins_100g: 25 },
                },
                { code: "2", product_name: "No data", nutriments: {} },
                { code: "3", nutriments: { "energy-kcal_100g": 10 } },
              ],
            }),
        }),
      ),
    );
    const hits = await searchProducts("pindakaas");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ barcode: "1", name: "Pindakaas", brand: "Calvé" });
    expect(hits[0]?.label).toMatchObject({
      calories: 600,
      protein: 25,
      carbs: null,
      servingSizeGrams: 15,
    });
  });
});

describe("searchProducts language", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("prefers the name in the app language, else the generic one", async () => {
    const { searchProducts } = await import("../barcodeLookup");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              products: [
                {
                  code: "10",
                  product_name: "Beurre de cacahuète",
                  product_name_nl: "Pindakaas",
                  nutriments: { "energy-kcal_100g": 600 },
                },
                { code: "11", product_name: "Confiture", nutriments: { "energy-kcal_100g": 250 } },
              ],
            }),
        }),
      ),
    );
    const hits = await searchProducts("lang-test", "nl");
    expect(hits.map((h) => h.name)).toEqual(["Pindakaas", "Confiture"]);
  });
});
