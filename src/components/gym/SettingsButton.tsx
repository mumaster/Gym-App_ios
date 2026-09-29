import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic, useGym } from "../../lib/gym/store";
import { ProfileAvatar } from "./ProfileAvatar";

/** Room a header's title needs to leave on the right for the button. */
export const SETTINGS_BUTTON_GUTTER = "pr-[4.5rem]";

/**
 * The profile button that opens Settings. It's absolutely positioned in the
 * top-right of a header's content box (top of the row under the status-bar
 * inset, 1rem from the edge), so it sits at the exact same spot on every
 * screen whatever the title, subtitle or other action next to it.
 */
export function SettingsButton() {
  const navigate = useNavigate();
  const t = useTranslation();
  const { avatarId } = useGym();
  return (
    <button
      onClick={() => {
        haptic(12);
        navigate({ to: "/settings" });
      }}
      aria-label={t.common.settings}
      className="absolute right-4 top-0 flex items-center justify-center rounded-full active:scale-95"
    >
      <ProfileAvatar avatarId={avatarId} size={42} />
    </button>
  );
}
