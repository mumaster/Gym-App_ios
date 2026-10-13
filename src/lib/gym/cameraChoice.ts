/** Back-camera choice for the scanner. iPhones with several lenses list them
 *  as separate video inputs once camera permission is granted ("Back Camera",
 *  "Back Ultra Wide Camera", …); the front camera is left out on purpose. */

const STORAGE_KEY = "forge.scanner.camera.v1";
const FRONT = /front|user|selfie|facetime/i;

export interface BackCamera {
  deviceId: string;
  label: string;
}

/** Video inputs that look like a back camera, in the order the browser gives. */
export function backCameras(devices: Pick<MediaDeviceInfo, "kind" | "deviceId" | "label">[]) {
  return devices
    .filter((d) => d.kind === "videoinput" && d.deviceId && !FRONT.test(d.label))
    .map((d) => ({ deviceId: d.deviceId, label: d.label }));
}

/** "Back Ultra Wide Camera" → "Ultra Wide"; plain "Back Camera" → "Main". */
export function shortLensName(label: string): string {
  const name = label
    .replace(/\bback\b/i, "")
    .replace(/\bcamera\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return name || "Main";
}

export function loadCameraId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveCameraId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
}
