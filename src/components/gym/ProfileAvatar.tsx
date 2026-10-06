import { avatarById } from "../../lib/gym/avatars";

export function ProfileAvatar({
  avatarId,
  size = 40,
  className = "",
}: {
  avatarId: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const avatar = avatarById(avatarId);
  const Icon = avatar.icon;
  // Follows the accent (asked for: it stayed the same grey whatever colour
  // was picked), as a tint rather than a solid fill: the header's main
  // action (the hero's button on Home) is the one solid-accent element up
  // there, and a solid avatar next to it competed for attention.
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/35 ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon className="text-primary-text" style={{ width: size * 0.58, height: size * 0.58 }} />
    </span>
  );
}
