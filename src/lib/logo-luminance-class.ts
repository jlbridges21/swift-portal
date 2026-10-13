export type LogoLuminanceClass = "light" | "dark" | "unknown";

/** Mean channel luminance (0–255) at or above this reads as a light logo. */
export const LIGHT_LOGO_LUMINANCE = 180;

export function logoLuminanceClass(value: number | null | undefined): LogoLuminanceClass {
  if (value == null || !Number.isFinite(value)) return "unknown";
  return value >= LIGHT_LOGO_LUMINANCE ? "light" : "dark";
}
