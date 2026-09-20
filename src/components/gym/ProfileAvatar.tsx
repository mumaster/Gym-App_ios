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
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon
        className="text-primary-foreground"
        style={{ width: size * 0.58, height: size * 0.58 }}
      />
    </span>
  );
}
