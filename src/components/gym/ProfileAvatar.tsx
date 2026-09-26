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
  // Neutral, not accent-filled: the headers' main action (the hero's
  // button on Home) is the one solid-accent element up there, and a solid
  // avatar next to it competed for attention.
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-secondary ring-1 ring-border ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon className="text-foreground" style={{ width: size * 0.58, height: size * 0.58 }} />
    </span>
  );
}
