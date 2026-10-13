import { describe, expect, it } from "vitest";
import { backCameras, shortLensName } from "../cameraChoice";

const dev = (deviceId: string, label: string, kind = "videoinput") =>
  ({ deviceId, label, kind }) as MediaDeviceInfo;

describe("backCameras", () => {
  it("keeps back lenses, drops front camera, mics and unlabeled ids", () => {
    const list = backCameras([
      dev("a", "Back Camera"),
      dev("b", "Front Camera"),
      dev("c", "Back Ultra Wide Camera"),
      dev("d", "iPhone Microphone", "audioinput"),
      dev("", "Back Camera"),
    ]);
    expect(list.map((c) => c.deviceId)).toEqual(["a", "c"]);
  });
});

describe("shortLensName", () => {
  it("shortens iOS labels", () => {
    expect(shortLensName("Back Ultra Wide Camera")).toBe("Ultra Wide");
    expect(shortLensName("Back Camera")).toBe("Main");
  });
});
