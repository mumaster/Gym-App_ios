import type { InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "../../lib/gym/i18n";

/**
 * The app's one search field (DESIGN.md §7): Add food, Exercises and Your
 * current lifts each had their own (a muted pill, a glass bar with a larger
 * icon, a smaller rounded box). 48 pt tall, the glass look of an unpicked
 * chip (`glass-chip`), a 16 px magnifier, 16 px text (iOS zooms into
 * anything smaller) and a clear button once something is typed. Extra input
 * props (focus handlers, `useTapFocus`'s tap handling) pass straight through.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  className = "",
  ...input
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "className">) {
  const t = useTranslation();
  return (
    <label
      className={`glass-chip flex h-12 items-center gap-2 rounded-2xl pl-4 pr-1.5 ${className}`}
    >
      <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        {...input}
        className="h-full w-full min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t.addFood.clearSearch}
          className="tap-target flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-90"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </label>
  );
}
