import { describe, expect, it } from "vitest";
import { dilate, erode, maskBounds, partBoxToCrop, routeMask } from "../routeMap";

/** A w×h RGBA image filled with `bg`, with `paint(x, y)` returning a colour to override. */
function image(
  w: number,
  h: number,
  bg: [number, number, number],
  paint: (x: number, y: number) => [number, number, number] | null,
) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = paint(x, y) ?? bg;
      data.set([...c, 255], (y * w + x) * 4);
    }
  }
  return data;
}

describe("route mask", () => {
  const w = 60;
  const h = 40;
  const orange: [number, number, number] = [255, 122, 0];
  const green: [number, number, number] = [110, 212, 40];
  const motorway: [number, number, number] = [249, 213, 110]; // Apple Maps, light
  const icon: [number, number, number] = [255, 60, 60];

  it("keeps the brightly coloured route and drops muted map colours and small icons", () => {
    const px = image(w, h, [40, 44, 48], (x, y) => {
      if (y >= 10 && y <= 12 && x >= 5 && x < 30) return orange; // route, part 1
      if (y >= 10 && y <= 12 && x >= 30 && x < 55) return green; // route, part 2
      if (y >= 25 && y <= 27) return motorway; // a road, not the route
      if (x >= 50 && x <= 51 && y >= 32 && y <= 33) return icon; // a 4 px map icon
      return null;
    });
    const mask = routeMask(px, w, h);
    expect(mask[11 * w + 10]).toBe(1);
    expect(mask[11 * w + 40]).toBe(1);
    expect(mask[26 * w + 20]).toBe(0);
    expect(mask[32 * w + 50]).toBe(0);
    expect(maskBounds(mask, w)).toEqual({ x: 5, y: 10, w: 50, h: 3 });
  });

  it("returns an empty mask when there's too little route to be one", () => {
    const px = image(w, h, [40, 44, 48], (x, y) => (x < 5 && y < 5 ? orange : null));
    expect(maskBounds(routeMask(px, w, h), w)).toBeNull();
  });

  it("grows a mask by the given radius", () => {
    const m = new Uint8Array(25);
    m[12] = 1; // centre of 5×5
    expect([...dilate(m, 5, 5, 1)].filter(Boolean).length).toBe(9);
  });

  it("closing (grow, then shrink) joins a small gap in a line", () => {
    const w = 20;
    const line = new Uint8Array(w * 9);
    for (let x = 2; x < 18; x++) if (x < 9 || x > 11) line[4 * w + x] = 1; // gap at 9–11
    const closed = erode(dilate(line, w, 9, 2), w, 9, 2);
    expect(closed[4 * w + 10]).toBe(1);
  });
});

describe("mapping the reader's box back to the screenshot", () => {
  it("undoes the part's offset and scale", () => {
    // A 2160 px wide screenshot scaled by 0.5; the second part starts at 1640.
    const part = { top: 1640, width: 1080, height: 1800, scale: 0.5 };
    expect(partBoxToCrop([100, 0, 500, 1000], part)).toEqual({
      x: 0,
      y: 3640,
      w: 2160,
      h: 1440,
    });
  });

  it("rejects a malformed or tiny box", () => {
    const part = { top: 0, width: 1080, height: 1800, scale: 1 };
    expect(partBoxToCrop([0, 0, 10], part)).toBeNull();
    expect(partBoxToCrop([0, 0, 20, 20], part)).toBeNull();
  });
});
