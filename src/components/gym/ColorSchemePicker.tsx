import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic, useGym } from "../../lib/gym/store";
import type { ColorScheme } from "../../lib/gym/types";

const ICONS: Record<ColorScheme, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };
const ORDER: ColorScheme[] = ["system", "light", "dark"];

export function ColorSchemePicker() {
  const { colorScheme, update } = useGym();
  const t = useTranslation();
  const OPTIONS = ORDER.map((id) => ({ id, label: t.colorScheme[id], icon: ICONS[id] }));

  return (
    <div className="grid grid-cols-3 gap-2 p-4">
      {OPTIONS.map((opt) => {
        const active = colorScheme === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            onClick={() => {
              haptic(15);
              update({ colorScheme: opt.id });
            }}
            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 transition-transform active:scale-[0.97] ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
            <span className="text-[13px] font-semibold">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
