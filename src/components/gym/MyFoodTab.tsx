import { useMemo, useState } from "react";
import { BookMarked, ChevronRight, Plus, Soup, Star, Trash2, UtensilsCrossed } from "lucide-react";
import { Card } from "./Screen";
import { CardHead } from "./CardHead";
import { SearchField } from "./SearchField";
import { MyFoodEditSheet } from "./MyFoodEditSheet";
import { useInfoTip } from "./InfoTip";
import { ListCard } from "./ListCard";
import { button, text } from "./ui";
import { useTranslation, useLocale } from "../../lib/gym/i18n";
import { haptic, useGym } from "../../lib/gym/store";
import { matchScore, myFoodKey, savedFoods, type SavedFood } from "../../lib/gym/myFoods";

/**
 * Nutrition → My food: everything saved to the account as a food (foods you
 * scanned, typed in or starred), with a count, and the saved meals and
 * recipes under it. Tap a food to edit it, or add a new one; deleting forgets
 * it from the account (the whole state syncs to the cloud, store.tsx).
 */
export function MyFoodTab() {
  const t = useTranslation();
  const locale = useLocale();
  const {
    myFoods,
    favoriteFoods,
    mealTemplates,
    recipes,
    rememberFood,
    editSavedFood,
    deleteSavedFood,
    deleteMealTemplate,
    deleteRecipe,
  } = useGym();
  const [query, setQuery] = useState("");
  /** null = closed, "new" = adding, a food = editing it. */
  const [sheet, setSheet] = useState<SavedFood | "new" | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const info = useInfoTip(t.myFood.infoAria, t.myFood.info);

  const all = useMemo(() => savedFoods(myFoods, favoriteFoods), [myFoods, favoriteFoods]);
  const shown = useMemo(
    () => (query.trim() ? all.filter((f) => matchScore(f.name, query) !== null) : all),
    [all, query],
  );
  const n = (v: number | undefined) =>
    (v ?? 0).toLocaleString(locale, { maximumFractionDigits: 1 });

  const confirmable = (id: string, name: string, onDelete: () => void) => (
    <button
      type="button"
      aria-label={t.myFood.deleteItemAria(name)}
      onClick={() => {
        if (confirmId !== id) {
          haptic(10);
          setConfirmId(id);
          return;
        }
        setConfirmId(null);
        onDelete();
      }}
      className={
        confirmId === id
          ? "tap-target flex h-9 shrink-0 items-center rounded-full bg-destructive/10 px-3 text-[13px] font-semibold text-destructive-text active:scale-95"
          : button.icon
      }
    >
      {confirmId === id ? t.myFood.deleteSure : <Trash2 className="size-4" aria-hidden />}
    </button>
  );

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => {
          haptic(12);
          setSheet("new");
        }}
        className={`${button.primary} w-full`}
      >
        <Plus className="size-5" aria-hidden /> {t.myFood.add}
      </button>

      <Card className="overflow-hidden p-4">
        <CardHead
          icon={BookMarked}
          filled={all.length > 0}
          title={t.myFood.count(all.length)}
          subtitle={`${t.myFood.mealsCount(mealTemplates.length)} · ${t.myFood.recipesCount(recipes.length)}`}
          actions={info.button}
        />
        {info.panel ? <div className="mb-3">{info.panel}</div> : null}
        {all.length > 0 ? (
          <SearchField value={query} onChange={setQuery} placeholder={t.myFood.search} />
        ) : (
          <p className={text.note}>{t.myFood.empty}</p>
        )}
        {all.length > 0 ? (
          <ul className="mt-3 -mx-4 -mb-4">
            {shown.map((f) => (
              <li key={myFoodKey(f)} className="border-t border-border">
                <button
                  type="button"
                  aria-label={t.myFood.editAria(f.name)}
                  onClick={() => {
                    haptic(10);
                    setSheet(f);
                  }}
                  className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left active:bg-foreground/5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={`${text.rowTitle} truncate`}>{f.name}</span>
                      {f.favorite ? (
                        <Star
                          className="size-3.5 shrink-0 fill-primary text-primary"
                          aria-label={t.myFood.starred}
                        />
                      ) : null}
                    </span>
                    <span className={`${text.meta} tabular block truncate`}>
                      {t.myFood.foodMeta(
                        n(Math.round(f.per100.calories)),
                        n(f.per100.protein),
                        n(f.per100.carbs),
                        n(f.per100.fat),
                      )}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
            {shown.length === 0 ? (
              <li className="border-t border-border px-4 py-3">
                <p className={text.note}>{t.myFood.noMatch}</p>
              </li>
            ) : null}
          </ul>
        ) : null}
      </Card>

      {mealTemplates.length > 0 ? (
        <ListCard
          icon={UtensilsCrossed}
          title={t.myFood.mealsTitle}
          subtitle={t.myFood.mealsCount(mealTemplates.length)}
          filled
        >
          {mealTemplates.map((m) => (
            <div key={m.id} className="flex items-center gap-3 border-t border-border px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className={`${text.rowTitle} block truncate`}>{m.name}</span>
                <span className={`${text.meta} block`}>
                  {t.myFood.mealMeta(m.ingredients.length)}
                </span>
              </span>
              {confirmable(m.id, m.name, () => deleteMealTemplate(m.id))}
            </div>
          ))}
        </ListCard>
      ) : null}

      {recipes.length > 0 ? (
        <ListCard
          icon={Soup}
          title={t.myFood.recipesTitle}
          subtitle={t.myFood.recipesCount(recipes.length)}
          filled
        >
          {recipes.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-t border-border px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className={`${text.rowTitle} block truncate`}>{r.name}</span>
                <span className={`${text.meta} block`}>
                  {t.myFood.recipeMeta(r.ingredients.length, r.servings)}
                </span>
              </span>
              {confirmable(r.id, r.name, () => deleteRecipe(r.id))}
            </div>
          ))}
        </ListCard>
      ) : null}

      <MyFoodEditSheet
        open={sheet !== null}
        food={sheet && sheet !== "new" ? sheet : null}
        onClose={() => setSheet(null)}
        onSave={(next) => {
          if (sheet && sheet !== "new") editSavedFood(sheet, next);
          else rememberFood(next);
          setSheet(null);
        }}
        onDelete={
          sheet && sheet !== "new"
            ? () => {
                deleteSavedFood(sheet);
                setSheet(null);
              }
            : undefined
        }
      />
    </div>
  );
}
