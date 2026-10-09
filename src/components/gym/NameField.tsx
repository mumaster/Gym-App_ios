import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "../../lib/gym/i18n";
import { cleanFirstName, MAX_FIRST_NAME } from "../../lib/gym/name";
import { haptic, useGym } from "../../lib/gym/store";

/** Settings' first-name field. Saves as you type (cleaned), but lets the
 *  draft keep a trailing space so "Anne Marie" can be typed. */
export function NameField() {
  const t = useTranslation();
  const { firstName, update } = useGym();
  const [draft, setDraft] = useState(firstName);
  // A name that arrives from the cloud copy replaces the draft.
  useEffect(() => {
    setDraft((d) => (cleanFirstName(d) === firstName ? d : firstName));
  }, [firstName]);
  return (
    <div className="p-4">
      <label className="glass-chip flex h-12 items-center gap-2 rounded-2xl pl-4 pr-1.5">
        <span className="sr-only">{t.name.label}</span>
        <input
          type="text"
          value={draft}
          maxLength={MAX_FIRST_NAME}
          onChange={(e) => {
            setDraft(e.target.value);
            update({ firstName: cleanFirstName(e.target.value) });
          }}
          onBlur={() => setDraft(firstName)}
          placeholder={t.name.placeholder}
          autoComplete="given-name"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className="h-full w-full min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        {draft ? (
          <button
            type="button"
            onClick={() => {
              haptic(10);
              setDraft("");
              update({ firstName: "" });
            }}
            aria-label={t.name.clear}
            className="tap-target flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-90"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </label>
    </div>
  );
}
