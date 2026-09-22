import { Bot, Cat, Dog, Ghost, Panda, Rabbit, type LucideIcon } from "lucide-react";

export type AvatarId = "bot" | "cat" | "dog" | "ghost" | "rabbit" | "panda";

export interface AvatarOption {
  id: AvatarId;
  label: string;
  icon: LucideIcon;
  /** Circle background — same oklch formula as ThemePicker's accent swatches. */
  bg: string;
  /** Icon color, chosen for contrast against this avatar's own fixed `bg` —
   *  same reasoning as each accent's own --primary-foreground pairing in
   *  styles.css (a bright/light bg needs a dark icon, a darker/more
   *  saturated one needs a light icon), but picked per-avatar here since
   *  these swatches are fixed brand colors rather than the live accent, so
   *  they can't just inherit --primary-foreground the way an accent-scoped
   *  element can. Deliberately NOT `text-background`, which is what this
   *  used before light mode existed — that only ever worked because
   *  --background was always black; once it could also be near-white (see
   *  the "Light/dark/system color scheme" section), an icon painted in it
   *  went from "always-dark, always legible against these bright swatches"
   *  to "sometimes near-white on a bright swatch," which is invisible on
   *  panda's and cat's own light backgrounds specifically. */
  ink: string;
}

export const AVATARS: AvatarOption[] = [
  { id: "bot", label: "Bot", icon: Bot, bg: "oklch(0.75 0.14 200)", ink: "oklch(0.98 0 0)" },
  { id: "cat", label: "Cat", icon: Cat, bg: "oklch(0.78 0.18 55)", ink: "oklch(0.18 0.05 50)" },
  { id: "dog", label: "Dog", icon: Dog, bg: "oklch(0.72 0.15 70)", ink: "oklch(0.98 0 0)" },
  { id: "ghost", label: "Ghost", icon: Ghost, bg: "oklch(0.68 0.2 300)", ink: "oklch(0.98 0 0)" },
  {
    id: "rabbit",
    label: "Rabbit",
    icon: Rabbit,
    bg: "oklch(0.72 0.22 350)",
    ink: "oklch(0.98 0 0)",
  },
  {
    id: "panda",
    label: "Panda",
    icon: Panda,
    bg: "oklch(0.88 0.24 145)",
    ink: "oklch(0.16 0.05 150)",
  },
];

export const DEFAULT_AVATAR_ID: AvatarId = "bot";

export function avatarById(id: string | null | undefined): AvatarOption {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]!;
}
