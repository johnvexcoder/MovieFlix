import { useEffect, useState } from "react";
import { Activity, Clock, Megaphone, Timer, Users } from "lucide-react";
import { formatPHP } from "@/lib/analytics";

interface OverviewCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeAmount?: number;
  icon: React.ComponentType<{ className?: string }>;
  iconBg?: string;
  iconText?: string;
  secondaryText?: string;
  onClick?: () => void;
}

function OverviewCard({
  title,
  value,
  change,
  changeAmount,
  icon: Icon,
  iconBg = "bg-white/5",
  iconText = "text-neutral-400",
  secondaryText,
  onClick,
}: OverviewCardProps) {
  const ariaLabel = `${title}${
    typeof value === "number" || typeof value === "string" ? `, ${value}` : ""
  }${
    changeAmount !== undefined
      ? `, ${changeAmount >= 0 ? "up" : "down"} ${formatPHP(Math.abs(changeAmount))} vs last month`
      : change !== undefined
      ? `, ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)} percent`
      : ""
  }${secondaryText ? `, ${secondaryText}` : ""}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={ariaLabel}
      className={`
        glass-panel w-full text-left rounded-2xl p-4 border border-white/10 shadow-lg
        transition-all
        ${
          onClick
            ? "cursor-pointer hover:border-white/20 hover:bg-white/5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
            : "cursor-default"
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            {title}
          </p>
          <p className="mt-1 text-2xl font-black text-white">
            {typeof value === "number" && value !== 0
              ? value.toLocaleString()
              : value}
          </p>
          {changeAmount !== undefined ? (
            <p className="mt-1 text-[10px]">
              {changeAmount >= 0 ? "↑" : "↓"} {formatPHP(Math.abs(changeAmount))} vs last month
            </p>
          ) : (
            change !== undefined && (
              <p className="mt-1 text-[10px]">
                {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(1)}% this month
              </p>
            )
          )}
          {secondaryText && (
            <p className="mt-1.5 text-[10px] text-neutral-400">{secondaryText}</p>
          )}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg} ${iconText}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </button>
  );
}

interface OverviewCardsProps {
  onActiveSubscribersClick?: () => void;
  onMonthlyRevenueClick?: () => void;
  onExpiringSoonClick?: () => void;
  onStreamingNowClick?: () => void;
}

export default function OverviewCards({
  onActiveSubscribersClick,
  onMonthlyRevenueClick,
  onExpiringSoonClick,
  onStreamingNowClick,
}: OverviewCardsProps = {}) {
  const [overviewData, setOverviewData] = useState({
    activeSubscribers: { value: 0, change: 0 },
    monthlyRevenue: { value: 0, change: 0, changeAmount: 0 },
    expiringSoon: { value: 0, within48Hours: 0 },
    streamingNow: { value: 0, accounts: 0, peakToday: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchOverview() {
      try {
        const response = await fetch("/api/admin/analytics", {
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch analytics");
        }

        const payload = await response.json();
        const data = payload?.data;
        if (!active || !data) return;

        setOverviewData({
          activeSubscribers: {
            value: data.activeSubscribers?.value ?? 0,
            change: data.activeSubscribers?.change ?? 0,
          },
          monthlyRevenue: {
            value: data.monthlyRevenue?.value ?? 0,
            change: data.monthlyRevenue?.change ?? 0,
            changeAmount: data.monthlyRevenue?.changeAmount ?? 0,
          },
          expiringSoon: {
            value: data.expiringSoon?.value ?? 0,
            within48Hours: data.expiringSoon?.within48Hours ?? 0,
          },
          streamingNow: {
            value: data.streamingNow?.value ?? 0,
            accounts: data.streamingNow?.accounts ?? 0,
            peakToday: data.streamingNow?.peakToday ?? 0,
          },
        });
        setError(false);
      } catch (err) {
        console.error("Failed to fetch overview analytics:", err);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchOverview();

    // Refresh every 30 seconds (not per-second polling).
    const interval = setInterval(fetchOverview, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="mb-8 grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="glass-panel rounded-2xl p-4 border border-white/10 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Loading...
                </p>
                <p className="mt-1 text-2xl font-black text-white">―――</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-neutral-400">
                <Users className="h-5 w-5 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const unavailable = "—";

  return (
    <div className="mb-8 grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
      {/* Active Subscribers Card */}
      <OverviewCard
        title="Active Subscribers"
        value={error ? unavailable : overviewData.activeSubscribers.value}
        change={error ? undefined : overviewData.activeSubscribers.change}
        icon={Activity}
        iconBg="bg-emerald-500/10"
        iconText="text-emerald-400"
        secondaryText={error ? "Unable to load" : undefined}
        onClick={onActiveSubscribersClick}
      />

      {/* Monthly Revenue Card */}
      <OverviewCard
        title="Monthly Revenue"
        value={error ? unavailable : formatPHP(overviewData.monthlyRevenue.value)}
        changeAmount={error ? undefined : overviewData.monthlyRevenue.changeAmount}
        icon={Megaphone}
        iconBg="bg-amber-500/10"
        iconText="text-amber-400"
        onClick={onMonthlyRevenueClick}
      />

      {/* Expiring Soon Card */}
      <OverviewCard
        title="Expiring Soon"
        value={error ? unavailable : overviewData.expiringSoon.value}
        icon={Clock}
        iconBg="bg-amber-500/10"
        iconText="text-amber-400"
        secondaryText={
          error
            ? "Unable to load"
            : `${overviewData.expiringSoon.within48Hours} within 48h`
        }
        onClick={onExpiringSoonClick}
      />

      {/* Streaming Now Card */}
      <OverviewCard
        title="Streaming Now"
        value={error ? unavailable : overviewData.streamingNow.value}
        icon={Timer}
        iconBg="bg-purple-500/10"
        iconText="text-purple-400"
        secondaryText={
          error
            ? "Unable to load"
            : `Peak today: ${overviewData.streamingNow.peakToday}${
                overviewData.streamingNow.accounts > 0
                  ? ` · ${overviewData.streamingNow.accounts} accounts`
                  : ""
              }`
        }
        onClick={onStreamingNowClick}
      />
    </div>
  );
}
