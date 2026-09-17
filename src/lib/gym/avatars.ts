import { Bot, Cat, Dog, Ghost, Panda, Rabbit, type LucideIcon } from "lucide-react";

export type AvatarId = "bot" | "cat" | "dog" | "ghost" | "rabbit" | "panda";

export interface AvatarOption {
  id: AvatarId;
  label: string;
  icon: LucideIcon;
  /** Circle background — same oklch formula as ThemePicker's accent swatches. */
  bg: string;
}

export const AVATARS: AvatarOption[] = [
  { id: "bot", label: "Bot", icon: Bot, bg: "oklch(0.75 0.14 200)" },
  { id: "cat", label: "Cat", icon: Cat, bg: "oklch(0.78 0.18 55)" },
  { id: "dog", label: "Dog", icon: Dog, bg: "oklch(0.72 0.15 70)" },
  { id: "ghost", label: "Ghost", icon: Ghost, bg: "oklch(0.68 0.2 300)" },
  { id: "rabbit", label: "Rabbit", icon: Rabbit, bg: "oklch(0.72 0.22 350)" },
  { id: "panda", label: "Panda", icon: Panda, bg: "oklch(0.88 0.24 145)" },
];

export const DEFAULT_AVATAR_ID: AvatarId = "bot";

export function avatarById(id: string | null | undefined): AvatarOption {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]!;
}
