import type { ReactNode } from "react";

export function Screen({
  title,
  subtitle,
  action,
  children,
  padBottom = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  padBottom?: boolean;
}) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="safe-top sticky top-0 z-30 pb-2">
        {/* Separate layer for the blur: WebKit can bleed backdrop-filter
            onto an element's own text when applied directly to the element
            that contains it, instead of confining it to what's behind. */}
        <div className="glass-strong absolute inset-0 border-x-0 border-t-0" />
        <div className="relative mx-auto grid w-full max-w-xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4">
          <div className="min-w-0">
            <h1 className="truncate text-[26px] font-bold leading-tight tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {action}
        </div>
      </header>
      <main
        className={`mx-auto w-full max-w-xl px-4 pt-3 ${padBottom ? "pb-[calc(5.625rem+var(--tab-bar-clearance))]" : "pb-8"}`}
      >
        {children}
      </main>
    </div>
  );
}

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`glass w-full rounded-2xl text-left ${onClick ? "active:scale-[0.985] transition-transform" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 mt-4 px-1 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}
