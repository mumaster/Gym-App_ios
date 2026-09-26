import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  BookMarked,
  ChevronRight,
  Cloud,
  CloudOff,
  LayoutGrid,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { AuthSheet } from "../components/gym/AuthSheet";
import { AvatarPicker } from "../components/gym/AvatarPicker";
import { ColorSchemePicker } from "../components/gym/ColorSchemePicker";
import { LanguagePicker } from "../components/gym/LanguagePicker";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import { SourcesSheet } from "../components/gym/SourcesSheet";
import { ThemePicker } from "../components/gym/ThemePicker";
import { useTranslation } from "../lib/gym/i18n";
import { haptic, useGym } from "../lib/gym/store";
import { forceUpdate } from "../pwa";

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
  const { session, syncStatus, signOut } = useGym();
  const t = useTranslation();
  const [authOpen, setAuthOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const handleForceUpdate = () => {
    haptic(15);
    setUpdating(true);
    // forceUpdate() always ends in location.reload() (even on error, via
    // its own finally), so this component unmounts shortly after — no
    // need to reset `updating` on a resolved/rejected path that never
    // actually happens before the navigation takes over.
    void forceUpdate();
  };

  return (
    <Screen title={t.settings.title} subtitle={t.settings.subtitle}>
      <SectionLabel>{t.settings.account}</SectionLabel>
      <Card className="p-4">
        {session ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{session.user.email}</p>
              <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <Cloud className="size-3.5" />
                {syncStatus === "syncing"
                  ? t.settings.syncing
                  : syncStatus === "error"
                    ? t.settings.syncError
                    : t.settings.synced}
              </p>
            </div>
            <button
              onClick={() => {
                haptic(15);
                void signOut();
              }}
              className="glass flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-muted-foreground"
            >
              <LogOut className="size-4" /> {t.settings.signOut}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[15px] font-semibold">
                <CloudOff className="size-4 text-muted-foreground" /> {t.settings.localOnly}
              </p>
              <p className="text-[12.5px] text-muted-foreground">{t.settings.localOnlyDesc}</p>
            </div>
            <button
              onClick={() => {
                haptic(15);
                setAuthOpen(true);
              }}
              className="flex min-h-[44px] shrink-0 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-primary-foreground"
            >
              {t.settings.signIn}
            </button>
          </div>
        )}
      </Card>

      <SectionLabel>{t.settings.equipment}</SectionLabel>
      <Link
        to="/equipment"
        className="glass flex items-center justify-between gap-3 rounded-2xl p-4 transition-transform active:scale-[0.985]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <LayoutGrid className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{t.settings.equipmentProfiles}</p>
            <p className="truncate text-[12.5px] text-muted-foreground">
              {t.settings.equipmentProfilesDesc}
            </p>
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </Link>

      <SectionLabel>{t.settings.avatar}</SectionLabel>
      <Card className="p-0">
        <AvatarPicker />
      </Card>

      <SectionLabel>{t.settings.appearance}</SectionLabel>
      <p className="mb-1.5 px-1 text-[12.5px] font-medium text-muted-foreground">
        {t.settings.colorScheme}
      </p>
      <Card className="p-0">
        <ColorSchemePicker />
      </Card>
      <p className="mb-1.5 mt-3 px-1 text-[12.5px] font-medium text-muted-foreground">
        {t.settings.accentColor}
      </p>
      <Card className="p-0">
        <ThemePicker />
      </Card>
      <p className="mb-1.5 mt-3 px-1 text-[12.5px] font-medium text-muted-foreground">
        {t.settings.language}
      </p>
      <Card className="p-0">
        <LanguagePicker />
      </Card>

      <SectionLabel>{t.settings.about}</SectionLabel>
      <button
        onClick={() => {
          haptic(10);
          setSourcesOpen(true);
        }}
        className="glass mb-3 flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left transition-transform active:scale-[0.985]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <BookMarked className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{t.sources.row}</p>
            <p className="truncate text-[12.5px] text-muted-foreground">{t.sources.rowDesc}</p>
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </button>
      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">{t.settings.forceUpdate}</p>
          <p className="text-[12.5px] text-muted-foreground">{t.settings.forceUpdateDesc}</p>
        </div>
        <button
          onClick={handleForceUpdate}
          disabled={updating}
          className="glass flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-primary disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${updating ? "animate-spin" : ""}`} />
          {updating ? t.settings.updating : t.settings.update}
        </button>
      </Card>

      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
      <SourcesSheet open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </Screen>
  );
}
