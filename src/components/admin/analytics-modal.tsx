import { useEffect, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent as RadarDialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatPHP, formatPercentage, getRangeLabel, getMobileRangeLabel } from "@/lib/analytics";
import { Activity, Megaphone, Clock, Timer, Loader2, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface AnalyticsModalProps {
  type: "subscribers" | "revenue" | "expirations" | "streaming";
  range: "1m" | "3m" | "6m" | "1y";
  onRangeChange: (range: string) => void;
  onClose: () => void;
}

interface AnalyticsData {
  range: string;
  summary: Record<string, any>;
  comparison: Record<string, any>;
  metrics: Record<string, any>;
  series: Array<{ date: string; value: number }>;
}

function AnalyticsModal({
  type,
  range,
  onRangeChange,
  onClose,
}: AnalyticsModalProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/admin/analytics/${type}?type=${type}&range=${range}`,
          {
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch analytics");
        }

        const result = await response.json();
        setData(result.data);
      } catch (err) {
        console.error(`Failed to fetch ${type} analytics:`, err);
        setError("Unable to load analytics. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Create interval for refreshing data
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [type, range, onRangeChange]);

  const getTitle = (): string => {
    switch (type) {
      case "subscribers":
        return "Active Subscribers";
      case "revenue":
        return "Monthly Revenue";
      case "expirations":
        return "Expiring Soon";
      case "streaming":
        return "Streaming Now";
      default:
        return "Analytics";
    }
  };

  const getDescription = (): string => {
    switch (type) {
      case "subscribers":
        return "Subscriber activity and growth";
      case "revenue":
        return "Revenue trends and performance";
      case "expirations":
        return("Subscription expiration trends");
      case "streaming":
        return "Concurrent streaming activity";
      default:
        return "";
    }
  };

  if (loading && !data) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="glass-panel max-w-2xl mx-auto my-4 border-white/15 p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">{getTitle()}</DialogTitle>
            <DialogDescription className="text-neutral-400">{getDescription()}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--brand)] mb-4" />
            <p className="text-neutral-400">Loading analytics...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="glass-panel max-w-2xl mx-auto my-4 border-white/15 p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">{getTitle()}</DialogTitle>
            <DialogDescription className="text-neutral-400">{getDescription()}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-neutral-400 text-center">{error}</p>
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!data) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="glass-panel max-w-2xl mx-auto my-4 border-white/15 p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">{getTitle()}</DialogTitle>
            <DialogDescription className="text-neutral-400">{getDescription()}</DialogDescription>
          </DialogHeader>
          <div className="text-neutral-400 text-center py-8">
            No data available for this period.
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="glass-panel max-w-[90%] mx-auto my-4 border-white/15">
        {/* Header with close button and range selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6">
          <div className="space-y-2">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-white">{getTitle()}</DialogTitle>
              <DialogDescription className="text-neutral-400">{getDescription()}</DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {/* Range Selector */}
            <div className="flex items-center gap-2">
              {[["1m", "1 Month"], ["3m", "3 Months"], ["6m", "6 Months"], ["1y", "1 Year"]].map(
                ([value, label]) => (
                  <Button
                    key={value}
                    variant={range === value ? "outline" : "ghost"}
                    size="sm"
                    className={`${range === value ? "bg-white/15 text-white" : "text-neutral-400 hover:text-white"} rounded-xl px-3 py-1.5 text-[12px]`}
                    onClick={() => onRangeChange(value)}
                  >
                    {label}
                  </Button>
                )
              )}
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-9 rounded-xl px-4"
          >
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </div>
        
        {/* Main content: 30/70 layout on desktop, stacked on mobile */}
        <div className="grid gap-6 p-6">
          {/* Information Panel (30%) */}
          <div className="col-span-1 lg:col-span-1">
            <div className="space-y-4">
              {/* Main metric */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  {getTitle()}
                </p>
                <p className="mt-1 text-3xl font-black text-white">
                  {type === "revenue"
                    ? formatPHP(data.summary.grossRevenue ?? data.summary.netRevenue ?? 0)
                    : type === "subscribers"
                    ? data.summary.activeSubscribers
                    : type === "expirations"
                    ? data.summary.expiringSoon
                    : data.summary.currentlyStreaming}
                </p>
                {data.comparison.change !== undefined && (
                  <p className="mt-1 text-[10px]">
                    {data.comparison.change >= 0 ? "↑" : "↓"} {Math.abs(
                      data.comparison.change
                    ).toFixed(1)}% vs previous period
                  </p>
                )}
              </div>
              
              {/* Detailed metrics */}
              <div className="space-y-3">
                {type === "subscribers" && (
                  <>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>New</span>
                      <span>{data.metrics.newSubscribers}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Renewed</span>
                      <span>{data.metrics.renewals}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Expired</span>
                      <span>{data.metrics.expired}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Cancelled</span>
                      <span>{data.metrics.cancelled}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Net Change</span>
                      <span className={`
                        ${data.metrics.netChange >= 0 ? "text-emerald-400" : "text-red-400"}
                        font-medium
                      `}>
                        {data.metrics.netChange}
                      </span>
                    </div>
                  </>
                )}
                
                {type === "revenue" && (
                  <>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Payments</span>
                      <span>{data.metrics.transactionCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Average Sale</span>
                      <span>{formatPHP(
                        Math.round((data.metrics.averageTransactionValue ?? 0) * 100)
                      )}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Refunds</span>
                      <span>{formatPHP(data.metrics.refunds ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Discounts</span>
                      <span>{formatPHP(data.metrics.discounts ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Net Revenue</span>
                      <span className="font-medium">
                        {formatPHP(data.metrics.netRevenue ?? 0)}
                      </span>
                    </div>
                  </>
                )}
                
                {type === "expirations" && (
                  <>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Next 24 Hours</span>
                      <span>{
                        // This would come from a more detailed API call
                        Math.max(0, data.metrics.expiringSoon - 2) // Placeholder
                      }</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Next 3 Days</span>
                      <span>{
                        // This would come from a more detailed API call
                        Math.max(0, data.metrics.expiringSoon - 5) // Placeholder
                      }</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Next 7 Days</span>
                      <span>{data.metrics.expiringSoon}</span>
                    </div>
                  </>
                )}
                
                {type === "streaming" && (
                  <>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Accounts Watching</span>
                      <span>{data.summary.accountsWatching}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Streaming Sessions</span>
                      <span>{data.metrics.streamingSessions}</span>
                    </div>
<div className="flex items-center justify-between text-[10px] text-neutral-400">
  <span>Watch Time</span>
  <span>{(() => {
    const minutes = data.metrics.watchTime ?? 0;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  })()}</span>
</div>
                  </>
                )}
              )}
            </div>
           </div>
           
           {/* Chart Panel (70%) */}
           <div className="col-span-1 lg:col-span-2">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white">
                {type === "subscribers"
                  ? "Subscriber Growth"
                  : type === "revenue"
                  ? "Revenue Over Time"
                  : type === "expirations"
                  ? "Subscription Expirations"
                  : "Concurrent Streams Over Time"}
              </h3>
              
              {data.series.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={data.series.map((item, index) => ({
                      ...item,
                      name: item.date,
                    }))}
                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                    <XAxis dataKey="name" tick={false} axisLine={false} />
                    <YAxis tickFormatter={(val) => 
                      type === "revenue" ? `₱${(val / 100).toLocaleString()}` : val
                    }/>
                    <Tooltip
                      formatter={(val) => 
                        type === "revenue" ? `₱${(val / 100).toLocaleString()}` : val
                      }
                      contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", padding: "8px" }}
                      labelStyle={{ color: "#fff", fontSize: 12 }}
                      separator={":"}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--brand)"
                      strokeWidth={2}
                      point={false}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-neutral-400 text-center py-8">
                  No data available for chart.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AnalyticsModal;