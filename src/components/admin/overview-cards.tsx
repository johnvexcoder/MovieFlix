import { useEffect, useState } from "react";
import { Activity, Clock, Megaphone, Timer, Users } from "lucide-react";
import { formatPHP, formatPercentage } from "@/lib/analytics";

interface OverviewCardProps {
  title: string;
  value: string | number;
  change?: number;
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
  icon: Icon,
  iconBg = "bg-white/5",
  iconText = "text-neutral-400",
  secondaryText,
  onClick,
}: OverviewCardProps) {
  return (
    <div
      className={`
        glass-panel rounded-2xl p-4 border border-white/10 shadow-lg
        hover:border-white/20 hover:bg-white/5 transition-all
        cursor-pointer
        ${onClick ? "" : "pointer-events-none"}
      `}
      onClick={onClick}
      role="button"
      tabIndex={onClick ? 0 : -1}
      aria-label={`${title}, ${typeof value === "number" ? value : ""}${
        change !== undefined ? `, ${change}% change` : ""
      }${secondaryText ? `, ${secondaryText}` : ""}`}
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
          {change !== undefined && (
            <p className="mt-1 text-[10px]">
              {change >= 0 ? "↑" : "↓"} {Math.abs(
                change
              ).toFixed(1)}% this month
            </p>
          )}
          {secondaryText && (
            <p className="mt-1.5 text-[10px] text-neutral-400">
              {secondaryText}
            </p>
          )}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg} ${iconText}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
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
  // Fetch overview data
  const [overviewData, setOverviewData] = useState({
    activeSubscribers: { value: 0, change: 0 },
    monthlyRevenue: { value: 0, change: 0 },
    expiringSoon: { value: 0, within48Hours: 0 },
    streamingNow: { value: 0, accounts: 0, peakToday: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOverview() {
      try {
        setLoading(true);
        const response = await fetch("/api/admin/analytics", {
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch analytics");
        }

        const data = await response.json();
        setOverviewData(data.data);
      } catch (error) {
        console.error("Failed to fetch overview analytics:", error);
        // Keep default values (zeros) on error
      } finally {
        setLoading(false);
      }
    }

    fetchOverview();

    // Refresh every 30 seconds
    const interval = setInterval(fetchOverview, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="mb-8 grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((_) => (
          <div key={_} className="glass-panel rounded-2xl p-4 border border-white/10 shadow-lg">
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

  return (
    <div className="mb-8 grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
      {/* Active Subscribers Card */}
      <OverviewCard
        title="Active Subscribers"
        value={overviewData.activeSubscribers.value}
        change={overviewData.activeSubscribers.change}
        icon={Activity}
        iconBg="bg-emerald-500/10"
        iconText="text-emerald-400"
        onClick={onActiveSubscribersClick}
      />

      {/* Monthly Revenue Card */}
      <OverviewCard
        title="Monthly Revenue"
        value={formatPHP(overviewData.monthlyRevenue.value)}
        change={overviewData.monthlyRevenue.change}
        icon={Megaphone}
        iconBg="bg-amber-500/10"
        iconText="text-amber-400"
        onClick={onMonthlyRevenueClick}
      />

      {/* Expiring Soon Card */}
      <OverviewCard
        title="Expiring Soon"
        value={overviewData.expiringSoon.value}
        icon={Clock}
        iconBg="bg-amber-500/10"
        iconText="text-amber-400"
        secondaryText={`${overviewData.expiringSoon.within48Hours} within 48h`}
        onClick={onExpiringSoonClick}
      />

      {/* Streaming Now Card */}
      <OverviewCard
        title="Streaming Now"
        value={overviewData.streamingNow.value}
        icon={Timer}
        iconBg="bg-purple-500/10"
        iconText="text-purple-400"
        secondaryText={overviewData.streamingNow.accounts > 0 ? `Across ${overviewData.streamingNow.accounts} accounts` : ""}
        onClick={onStreamingNowClick}
      />
    </div>
  );
}