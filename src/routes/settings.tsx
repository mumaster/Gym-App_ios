import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  ChevronRight,
  Cloud,
  CloudOff,
  Dumbbell,
  Info,
  LogOut,
  Palette,
  RefreshCw,
  UserRound,
  ShieldAlert,
  Wine,
} from "lucide-react";
import { ALLERGIES } from "../lib/gym/allergens";
import { AuthSheet } from "../components/gym/AuthSheet";
import { AvatarPicker } from "../components/gym/AvatarPicker";
import { ColorSchemePicker } from "../components/gym/ColorSchemePicker";
import { KnownLiftsSheet } from "../components/gym/KnownLiftsSheet";
import { MoveDataSheet } from "../components/gym/MoveDataSheet";
import { NameField } from "../components/gym/NameField";
import { LanguagePicker } from "../components/gym/LanguagePicker";
import { ListCard } from "../components/gym/ListCard";
import { Screen } from "../components/gym/Screen";
import { SwitchRow } from "../components/gym/SwitchRow";
import { SourcesSheet } from "../components/gym/SourcesSheet";
import { ThemePicker } from "../components/gym/ThemePicker";
import { useTranslation } from "../lib/gym/i18n";
import { haptic, useGym } from "../lib/gym/store";
import { forceUpdate } from "../pwa";
import { button, text } from "../components/gym/ui";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Forge" },
      {
        name: "description",
        content: "Manage your account, cloud sync, and app appearance.",
      },
    ],
  }),
  component: SettingsScreen,
});

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function SettingsScreen() {
  const {
    session,
    syncStatus,
    signOut,
    update,
    alcoholEnabled,
    alcoholWeekdays,
    firstName,
    allergies,
    language,
  } = useGym();
  const t = useTranslation();
  const [authOpen, setAuthOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [liftsOpen, setLiftsOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [allergiesOpen, setAllergiesOpen] = useState(false);

  const handleForceUpdate = () => {
    haptic(15);
    setUpdating(true);
    // forceUpdate() always ends in location.reload() (even on error, via
    // its own finally), so this component unmounts shortly after — no
    // need to reset `updating` on a resolved/rejected path that never
    // actually happens before the navigation takes over.
    void forceUpdate();
  };

  const accountSub = session ? (session.user.email ?? "") : t.settings.localOnly;

  return (
    <Screen
      title={t.settings.title}
      subtitle={t.settings.subtitle}
      action={
        <button
          onClick={handleForceUpdate}
          disabled={updating}
          aria-label={updating ? t.settings.updating : t.settings.forceUpdate}
          title={t.settings.forceUpdateDesc}
          className="glass flex size-[42px] items-center justify-center self-start rounded-full active:scale-95 disabled:opacity-60"
        >
          <RefreshCw
            className={`size-[18px] text-muted-foreground ${updating ? "animate-spin" : ""}`}
          />
        </button>
      }
    >
      <div className="space-y-3">
        <ListCard
          icon={session ? Cloud : CloudOff}
          title={t.settings.account}
          subtitle={accountSub}
          filled={!!session}
        >
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            {session ? (
              <>
                <p className="min-w-0 text-[13px] text-muted-foreground">
                  {syncStatus === "syncing"
                    ? t.settings.syncing
                    : syncStatus === "error"
                      ? t.settings.syncError
                      : t.settings.synced}
                </p>
                <button
                  onClick={() => {
                    haptic(15);
                    void signOut();
                  }}
                  className={`${button.secondary} shrink-0`}
                >
                  <LogOut className="size-4" /> {t.settings.signOut}
                </button>
              </>
            ) : (
              <>
                <p className="min-w-0 text-[13px] leading-snug text-muted-foreground">
                  {t.settings.localOnlyDesc}
                </p>
                <button
                  onClick={() => {
                    haptic(15);
                    setAuthOpen(true);
                  }}
                  className={`${button.secondary} shrink-0`}
                >
                  {t.settings.signIn}
                </button>
              </>
            )}
          </div>
          <PickerSection label={t.name.title}>
            <NameField />
          </PickerSection>
          <PickerSection label={t.settings.avatar}>
            <AvatarPicker />
          </PickerSection>
        </ListCard>

        <ListCard
          icon={Palette}
          title={t.settings.appearance}
          subtitle={t.settings.appearanceSub}
          filled
        >
          <PickerSection label={t.settings.colorScheme}>
            <ColorSchemePicker />
          </PickerSection>
          <PickerSection label={t.settings.accentColor}>
            <ThemePicker />
          </PickerSection>
          <PickerSection label={t.settings.language}>
            <LanguagePicker />
          </PickerSection>
        </ListCard>

        <ListCard
          icon={Dumbbell}
          title={t.settings.equipment}
          subtitle={t.settings.trainingSub}
          filled
        >
          <LinkRow
            to="/equipment"
            title={t.settings.equipmentProfiles}
            desc={t.settings.equipmentProfilesDesc}
          />
          <LinkRow
            onClick={() => {
              haptic(10);
              setLiftsOpen(true);
            }}
            title={t.knownLifts.row}
            desc={t.knownLifts.rowDesc}
          />
          <LinkRow
            onClick={() => {
              haptic(10);
              setMoveOpen(true);
            }}
            title={t.moveData.row}
            desc={t.moveData.rowDesc}
          />
        </ListCard>

        <ListCard
          icon={Wine}
          title={t.settings.alcohol}
          subtitle={alcoholEnabled ? t.settings.on : t.settings.off}
          filled={alcoholEnabled}
        >
          <div className="divide-y divide-border border-t border-border">
            <SwitchRow
              label={t.settings.alcoholTrack}
              desc={t.settings.alcoholTrackDesc}
              ariaLabel={t.settings.alcoholTrack}
              on={alcoholEnabled}
              onToggle={() => {
                haptic(12);
                update({ alcoholEnabled: !alcoholEnabled });
              }}
            />
            <SwitchRow
              label={t.settings.alcoholWeekdays}
              desc={t.settings.alcoholWeekdaysDesc}
              ariaLabel={t.settings.alcoholWeekdays}
              on={alcoholWeekdays}
              disabled={!alcoholEnabled}
              onToggle={() => {
                haptic(12);
                update({ alcoholWeekdays: !alcoholWeekdays });
              }}
            />
          </div>
        </ListCard>

        <ListCard
          icon={ShieldAlert}
          title={t.allergy.settingsTitle}
          subtitle={
            allergies.length === 0
              ? t.allergy.none
              : allergies.length === 1
                ? cap(t.allergy.names[allergies[0]!])
                : t.allergy.picked(allergies.length)
          }
          filled={allergies.length > 0}
          fold={{ open: allergiesOpen, onToggle: () => setAllergiesOpen((o) => !o) }}
        >
          <div className="divide-y divide-border border-t border-border">
            {[...ALLERGIES]
              .sort((a, b) => t.allergy.names[a].localeCompare(t.allergy.names[b], language))
              .map((id) => (
                <SwitchRow
                  key={id}
                  label={cap(t.allergy.names[id])}
                  desc={t.allergy.descs[id]}
                  ariaLabel={cap(t.allergy.names[id])}
                  on={allergies.includes(id)}
                  onToggle={() => {
                    haptic(12);
                    update({
                      allergies: allergies.includes(id)
                        ? allergies.filter((a) => a !== id)
                        : [...allergies, id],
                    });
                  }}
                />
              ))}
          </div>
        </ListCard>

        <ListCard icon={Info} title={t.settings.about} subtitle={t.settings.aboutSub} filled>
          <LinkRow
            onClick={() => {
              haptic(10);
              update({ setupSeen: false });
            }}
            title={t.setup.row}
            desc={t.setup.rowDesc}
          />
          <LinkRow
            onClick={() => {
              haptic(10);
              update({ welcomeSeen: false });
            }}
            title={t.welcome.replay}
            desc={t.welcome.replayDesc}
          />
          <LinkRow
            onClick={() => {
              haptic(10);
              setSourcesOpen(true);
            }}
            title={t.sources.row}
            desc={t.sources.rowDesc}
          />
        </ListCard>
      </div>

      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
      <SourcesSheet open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
      <KnownLiftsSheet open={liftsOpen} onClose={() => setLiftsOpen(false)} />
      <MoveDataSheet open={moveOpen} onClose={() => setMoveOpen(false)} />
    </Screen>
  );
}

/** A tappable row inside a settings card: title, one or two lines of
 *  description and a chevron (or `trailing`). A link when `to` is given. */
function LinkRow({
  to,
  onClick,
  title,
  desc,
  trailing,
  disabled,
}: {
  to?: "/equipment";
  onClick?: () => void;
  title: string;
  desc: string;
  trailing?: ReactNode;
  disabled?: boolean;
}) {
  const cls =
    "flex min-h-[56px] w-full items-center justify-between gap-3 border-t border-border px-4 py-3 text-left active:bg-foreground/5 disabled:opacity-60";
  const inner = (
    <>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="line-clamp-2 block text-[12.5px] leading-snug text-muted-foreground">
          {desc}
        </span>
      </span>
      {trailing ?? <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

function PickerSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-border">
      <p className={`${text.eyebrow} px-4 pt-3`}>{label}</p>
      {children}
    </div>
  );
}
