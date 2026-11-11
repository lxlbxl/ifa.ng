import React from "react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/brand";

/**
 * Building blocks for the inside of the client and Babalawo dashboards, so every page
 * reads like the homepage: paper panels on cloth, Bricolage headings, camwood eyebrows.
 */

/** Paper panel with a hairline border. The default container for a block of content. */
export const Panel = ({
  className,
  tone = "paper",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { tone?: "paper" | "ink" | "cloth" }) => (
  <div
    className={cn(
      "rounded-panel p-5 sm:p-6",
      tone === "paper" && "border border-line bg-paper text-ink",
      tone === "ink" && "bg-ink text-cloth",
      tone === "cloth" && "border border-line bg-cloth text-ink",
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

/** Eyebrow, title and an optional action on the right, at the top of a panel. */
export const PanelHeader = ({
  eyebrow,
  title,
  action,
  className,
  dark,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  dark?: boolean;
}) => (
  <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
    <div className="min-w-0">
      {eyebrow && <Eyebrow className={cn("mb-1.5", dark ? "text-sun" : "text-camwood")}>{eyebrow}</Eyebrow>}
      <h2 className="font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em] sm:text-2xl">{title}</h2>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/** The heading at the top of an inner page: eyebrow, big title, short lede, actions. */
export const PageIntro = ({
  eyebrow,
  title,
  lede,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8", className)}>
    <div className="min-w-0 max-w-[62ch]">
      {eyebrow && <Eyebrow className="mb-2 text-camwood">{eyebrow}</Eyebrow>}
      <h1 className="font-display text-[clamp(32px,4vw,52px)] font-extrabold leading-[0.95] tracking-[-0.04em]">{title}</h1>
      {lede && <p className="mt-3 text-base text-muted-foreground sm:text-lg">{lede}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

/** A friendly empty state: dashed paper block, a line of text and an optional action. */
export const EmptyState = ({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col items-center gap-3 rounded-panel border-2 border-dashed border-line bg-paper/60 px-6 py-10 text-center", className)}>
    {icon && <span className="grid h-12 w-12 place-items-center rounded-full bg-leaf text-ink [&_svg]:h-5 [&_svg]:w-5">{icon}</span>}
    <p className="font-display text-xl font-extrabold tracking-[-0.02em]">{title}</p>
    {children && <p className="m-0 max-w-[44ch] text-sm text-muted-foreground">{children}</p>}
    {action}
  </div>
);

/** A strip of the brand colour blocks, like a band of aṣọ-òkè. Decorative. */
export const ClothStrip = ({ className }: { className?: string }) => (
  <div className={cn("flex h-2 overflow-hidden rounded-pill", className)} aria-hidden="true">
    {["bg-leaf", "bg-sun", "bg-coral", "bg-indigo-700", "bg-camwood", "bg-teal", "bg-green-700"].map((c) => (
      <span key={c} className={cn("flex-1", c)} />
    ))}
  </div>
);

/** Yorùbá greeting for the time of day, with its English sense. */
export const greeting = (d = new Date()) => {
  const h = d.getHours();
  if (h < 12) return { yo: "Ẹ káàárọ̀", en: "Good morning" };
  if (h < 16) return { yo: "Ẹ káàsán", en: "Good afternoon" };
  return { yo: "Ẹ kúùrọ̀lẹ́", en: "Good evening" };
};
