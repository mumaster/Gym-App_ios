import { useState } from "react";
import { Cloud, Lock, Mail } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic, useGym } from "../../lib/gym/store";

type Mode = "signin" | "signup";

export function AuthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signIn, signUp } = useGym();
  const t = useTranslation();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const reset = () => {
    setMode("signin");
    setEmail("");
    setPassword("");
    setError(null);
    setBusy(false);
    setConfirmSent(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      setError(
        password.length > 0 && password.length < 6
          ? t.auth.passwordTooShort
          : t.auth.enterEmailPassword,
      );
      return;
    }
    setBusy(true);
    setError(null);
    haptic(15);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
        close();
      } else {
        await signUp(email.trim(), password);
        // If the project requires email confirmation there's no session yet
        // — tell the user rather than silently closing on nothing happening.
        setConfirmSent(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.auth.genericError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={close} title={t.auth.title}>
      <div className="space-y-4">
        {confirmSent ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[14px] font-semibold text-primary">
              <Mail className="size-4" /> {t.auth.checkYourEmail}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {t.auth.confirmSent(email.trim())}
            </p>
            <button
              onClick={() => {
                setConfirmSent(false);
                setMode("signin");
                setPassword("");
              }}
              className="mt-3 rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-primary-foreground"
            >
              {t.auth.backToSignIn}
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-primary">
                <Cloud className="size-3.5" /> {t.auth.cloudTitle}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">{t.auth.cloudDesc}</p>
            </div>

            <div className="flex gap-2 rounded-2xl bg-muted p-1">
              {(
                [
                  ["signin", t.auth.signIn],
                  ["signup", t.auth.createAccount],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => {
                    setMode(id);
                    setError(null);
                  }}
                  className={`min-h-[40px] flex-1 rounded-xl text-[14px] font-semibold ${
                    mode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t.auth.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-6 w-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
              <Lock className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder={t.auth.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void submit()}
                className="h-6 w-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground"
              />
            </label>

            {error ? <p className="text-[13px] font-medium text-destructive">{error}</p> : null}

            <button
              onClick={() => void submit()}
              disabled={busy}
              className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95 disabled:opacity-60"
            >
              {busy ? t.auth.pleaseWait : mode === "signin" ? t.auth.signIn : t.auth.createAccount}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
