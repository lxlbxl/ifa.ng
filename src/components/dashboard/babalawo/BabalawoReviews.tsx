import React from "react";
import { format } from "date-fns";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eyebrow } from "@/components/brand";
import { useBabalawoReviews } from "@/hooks/useBabalawoReviews";
import { EmptyState, Panel } from "@/components/dashboard/shell/Panel";

const Stars = ({ n, size = "h-4 w-4" }: { n: number; size?: string }) => (
  <span className="flex gap-0.5" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`${size} ${i <= Math.round(n) ? "fill-sun text-sun" : "text-line"}`} />)}
  </span>
);

/** The Babalawo's rating, how it splits by stars, and every review. */
const BabalawoReviews: React.FC = () => {
  const { data: reviews = [], isLoading } = useBabalawoReviews();
  if (isLoading) return <div className="h-48 animate-pulse rounded-panel bg-paper" />;
  if (!reviews.length) {
    return <EmptyState icon={<Star />} title="No reviews yet">Clients can rate a consultation once it is completed. Their words will appear here.</EmptyState>;
  }
  const avg = reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
  const count = (k: number) => reviews.filter((r) => r.rating === k).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-8">
      <div className="h-fit rounded-panel bg-sun p-6 text-ink lg:sticky lg:top-28">
        <Eyebrow className="text-ink/60">Your rating</Eyebrow>
        <p className="mt-2 font-display text-[72px] font-extrabold leading-none tracking-[-0.05em]">{avg.toFixed(1)}</p>
        <div className="mt-2"><Stars n={avg} size="h-5 w-5 [&]:fill-ink [&]:text-ink" /></div>
        <p className="mt-2 text-sm font-semibold">From {reviews.length} {reviews.length === 1 ? "review" : "reviews"}</p>
        <ul className="mt-5 space-y-1.5">
          {[5, 4, 3, 2, 1].map((k) => (
            <li key={k} className="flex items-center gap-2 text-sm font-semibold">
              <span className="w-3">{k}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-pill bg-ink/15">
                <span className="block h-full rounded-pill bg-ink" style={{ width: `${(count(k) / reviews.length) * 100}%` }} />
              </span>
              <span className="w-6 text-right">{count(k)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        {reviews.map((r) => (
          <Panel key={r.id} className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-line">
                <AvatarImage src={r.user?.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="bg-cloth text-sm font-bold">{(r.user?.full_name || "C").charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.user?.full_name || "A client"}</p>
                <p className="text-xs text-muted-foreground">{r.created_at ? format(new Date(r.created_at), "d MMMM yyyy") : ""}</p>
              </div>
              <Stars n={r.rating} />
            </div>
            {r.comment && <p className="font-display text-xl font-bold leading-snug tracking-[-0.01em]">“{r.comment}”</p>}
          </Panel>
        ))}
      </div>
    </div>
  );
};

export default BabalawoReviews;
