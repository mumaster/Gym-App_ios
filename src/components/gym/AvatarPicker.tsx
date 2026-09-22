import { Check } from "lucide-react";
import { AVATARS } from "../../lib/gym/avatars";
import { haptic, useGym } from "../../lib/gym/store";

export function AvatarPicker() {
  const { avatarId, update } = useGym();

  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      {AVATARS.map((a) => {
        const Icon = a.icon;
        const selected = avatarId === a.id;
        return (
          <button
            key={a.id}
            onClick={() => {
              haptic(15);
              update({ avatarId: a.id });
            }}
            aria-label={a.label}
            className={`relative flex size-14 items-center justify-center rounded-full border-2 transition-transform active:scale-95 ${
              selected ? "border-foreground" : "border-transparent"
            }`}
            style={{ backgroundColor: a.bg }}
          >
            <Icon className="size-7" style={{ color: a.ink }} />
            {selected ? (
              <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-foreground">
                <Check className="size-3 text-background" strokeWidth={3} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
