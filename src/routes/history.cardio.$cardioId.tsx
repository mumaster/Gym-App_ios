import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import { CardioRouteMap } from "../components/gym/RouteMapView";
import { SessionRpePicker } from "../components/gym/SessionRpePicker";
import { ActivityPicker, EffortPicker } from "../components/gym/CardioControls";
import { cardioName } from "../components/gym/cardioDisplay";
import type { CardioActivity, CardioEffort } from "../lib/gym/types";
import { WatchDataCard } from "../components/gym/WatchDataCard";
import { WatchImportSheet } from "../components/gym/WatchImportSheet";
import { useLocale, useTranslation } from "../lib/gym/i18n";
import { useGym } from "../lib/gym/store";
import { cardioMinutes } from "../lib/gym/watch";

export const Route = createFileRoute("/history/cardio/$cardioId")({
  head: () => ({
    meta: [
      { title: "Cardio Session — Forge" },
      {
        name: "description",
        content: "Distance, pace, heart rate and splits from a watch-recorded cardio session.",
      },
    ],
  }),
  component: CardioDetailScreen,
});

/** A watch-only cardio session: everything its screenshots printed, plus a
 *  session-effort rating that counts toward training load. */
function CardioDetailScreen() {
  const { cardioId } = useParams({ from: "/history/cardio/$cardioId" });
  const { cardioSessions, hydrated, rateCardio, deleteCardioSession, setCardioKind } = useGym();
  const [pickedActivity, setPickedActivity] = useState<CardioActivity | null>(null);
  const [pickedEffort, setPickedEffort] = useState<CardioEffort | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const navigate = useNavigate();
  const t = useTranslation();
  const locale = useLocale();
  const session = cardioSessions.find((c) => c.id === cardioId);

  const back = (
    <Link
      to="/history"
      aria-label={t.historyDetail.backToHistory}
      className="glass flex size-11 items-center justify-center rounded-full"
    >
      <ChevronLeft className="size-5" />
    </Link>
  );

  if (!hydrated) return <Screen title={t.watch.cardio}>{null}</Screen>;
  if (!session) {
    return (
      <Screen title={t.watch.cardio} action={back}>
        <Card className="p-6 text-center">
          <p className="text-[17px] font-semibold">{t.watch.notFound}</p>
          <Link
            to="/history"
            className="mt-3 inline-block text-[15px] font-semibold text-primary-text"
          >
            {t.historyDetail.backToHistory}
          </Link>
        </Card>
      </Screen>
    );
  }

  const date = new Date(session.date);
  const minutes = cardioMinutes(session);
  // Both are needed before it counts (cardio.ts's cardioInfo), so a first
  // pick on an older import waits here for the other one.
  const activity = pickedActivity ?? session.activity ?? null;
  const effort = pickedEffort ?? session.effort ?? null;
  const pick = (a: CardioActivity | null, e: CardioEffort | null) => {
    if (a && e) setCardioKind(session.id, a, e);
  };

  return (
    <Screen
      title={cardioName(session, t)}
      subtitle={date.toLocaleString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })}
      action={back}
    >
      <Card className="space-y-4 p-4">
        {session.hasRouteMap ? <CardioRouteMap id={session.id} /> : null}
        <WatchDataCard data={session.watch} />
      </Card>

      <SectionLabel>{t.cardio.activity}</SectionLabel>
      <Card className="space-y-4 p-4">
        <ActivityPicker
          value={activity}
          onChange={(a) => {
            setPickedActivity(a);
            pick(a, effort);
          }}
        />
        <EffortPicker
          value={effort}
          onChange={(e) => {
            setPickedEffort(e);
            pick(activity, e);
          }}
        />
        {!session.activity || !session.effort ? (
          <p className="text-[12.5px] text-muted-foreground">{t.cardio.setKind}</p>
        ) : null}
      </Card>

      <SectionLabel>{t.trainingLoad.sessionEffort}</SectionLabel>
      <Card className="space-y-2 p-4">
        <p className="text-[14px] font-semibold">{t.trainingLoad.question}</p>
        <SessionRpePicker value={session.session_rpe} onChange={(n) => rateCardio(session.id, n)} />
        {session.session_rpe != null && minutes != null ? (
          <p className="text-[12px] text-muted-foreground">
            {t.trainingLoad.sessionLoadLine(
              session.session_rpe,
              minutes,
              session.session_rpe * minutes,
            )}
          </p>
        ) : null}
      </Card>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setImportOpen(true)}
          className="glass min-h-[44px] flex-1 rounded-2xl text-[14px] font-semibold"
        >
          {t.watch.replace}
        </button>
        <button
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            deleteCardioSession(session.id);
            void navigate({ to: "/history" });
          }}
          className="min-h-[44px] flex-1 rounded-2xl bg-destructive/10 text-[14px] font-semibold text-destructive-text"
        >
          {confirming ? t.watch.confirmDelete : t.watch.deleteSession}
        </button>
      </div>
      <WatchImportSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        cardioId={session.id}
      />
    </Screen>
  );
}
