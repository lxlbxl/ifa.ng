import React from "react";
import { TAG_LABEL, TAG_STYLE, type UserTag } from "@/hooks/useAdminUserRecords";
import { cn } from "@/lib/utils";

/* eslint-disable react-refresh/only-export-components */
export const ago = (iso?: string | null) => {
  if (!iso) return "—";
  const d = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (d < 1 / 24) return "just now";
  if (d < 1) return `${Math.round(d * 24)}h ago`;
  if (d < 30) return `${Math.round(d)}d ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${(d / 365).toFixed(1)}y ago`;
};
export const shortDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
export const initials = (name?: string | null) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

export const TagChip = ({ tag }: { tag: UserTag }) => (
  <span className={cn("inline-flex h-6 items-center rounded-pill px-2.5 text-[11px] font-bold", TAG_STYLE[tag])}>{TAG_LABEL[tag]}</span>
);
export const RoleChips = ({ roles, suspended, deleted }: { roles: string[]; suspended?: boolean; deleted?: boolean }) => (
  <>
    {roles.includes("admin") && <span className="inline-flex h-6 items-center rounded-pill bg-ink px-2.5 text-[11px] font-bold text-cloth">Admin</span>}
    {roles.includes("babalawo") && <span className="inline-flex h-6 items-center rounded-pill bg-[#b9c4f2] px-2.5 text-[11px] font-bold text-ink">Babalawo</span>}
    {suspended && <span className="inline-flex h-6 items-center rounded-pill bg-coral px-2.5 text-[11px] font-bold text-white">Suspended</span>}
    {deleted && <span className="inline-flex h-6 items-center rounded-pill bg-cloth px-2.5 text-[11px] font-bold text-muted-foreground">Deleted</span>}
  </>
);

