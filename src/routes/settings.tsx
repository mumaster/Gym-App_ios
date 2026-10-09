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
  Wine,
} from "lucide-react";
import { AuthSheet } from "../components/gym/AuthSheet";
import { AvatarPicker } from "../components/gym/AvatarPicker";
import { ColorSchemePicker } from "../components/gym/ColorSchemePicker";
import { KnownLiftsSheet } from "../components/gym/KnownLiftsSheet";
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

function SettingsScreen() {
  const { session, syncStatus, signOut, update, alcoholEnabled, alcoholWeekdays, firstName } =
    useGym();
  const t = useTranslation();
  const [authOpen, setAuthOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [liftsOpen, setLiftsOpen] = useState(false);

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
    <Screen title={t.settings.title} subtitle={t.settings.subtitle}>
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
          icon={UserRound}
          title={t.name.title}
          subtitle={t.name.sub}
          filled={Boolean(firstName)}
        >
          <div className="border-t border-border">
            <NameField />
          </div>
        </ListCard>

        <ListCard icon={UserRound} title={t.settings.avatar} subtitle={t.settings.avatarSub} filled>
          <div className="border-t border-border">
            <AvatarPicker />
          </div>
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

        <ListCard icon={Info} title={t.settings.about} subtitle={t.settings.aboutSub} filled>
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
          <LinkRow
            onClick={handleForceUpdate}
            disabled={updating}
            title={updating ? t.settings.updating : t.settings.forceUpdate}
            desc={t.settings.forceUpdateDesc}
            trailing={
              <RefreshCw
                className={`size-5 shrink-0 text-muted-foreground ${updating ? "animate-spin" : ""}`}
              />
            }
          />
        </ListCard>
      </div>

      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
      <SourcesSheet open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
      <KnownLiftsSheet open={liftsOpen} onClose={() => setLiftsOpen(false)} />
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
