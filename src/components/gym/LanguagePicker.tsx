import { Check } from "lucide-react";
import { LANGUAGES } from "../../lib/gym/i18n";
import { haptic, useGym } from "../../lib/gym/store";

export function LanguagePicker() {
  const { language, update } = useGym();

  return (
    <div className="grid grid-cols-2 gap-2 p-4">
      {LANGUAGES.map((opt) => {
        const active = language === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => {
              haptic(15);
              update({ language: opt.id });
            }}
            className={`flex items-center justify-between gap-2 rounded-xl border-2 px-4 py-3 transition-transform active:scale-[0.97] ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            <span className="text-[14px] font-semibold">{opt.label}</span>
            {active ? <Check className="size-4 shrink-0" strokeWidth={2.5} /> : null}
          </button>
        );
      })}
    </div>
  );
}
