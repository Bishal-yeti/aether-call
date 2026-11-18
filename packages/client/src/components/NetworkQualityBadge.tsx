import React from 'react';
import { Wifi, WifiOff, AlertTriangle, Activity } from 'lucide-react';
import { NetworkQualityRating, WebRTCStatsSnapshot } from '@aether/shared';

interface Props {
  stats: WebRTCStatsSnapshot | null;
  onOpenDiagnostics: () => void;
  isDataSaver: boolean;
}

export const NetworkQualityBadge: React.FC<Props> = ({
  stats,
  onOpenDiagnostics,
  isDataSaver,
}) => {
  const rating: NetworkQualityRating = stats?.rating || 'good';
  const rtt = stats?.rttMs || 0;
  const loss = stats?.packetLossPercent || 0;

  const ratingConfig: Record<
    NetworkQualityRating,
    { label: string; bg: string; text: string; border: string; icon: any }
  > = {
    excellent: {
      label: 'Excellent',
      bg: 'bg-emerald-950/70',
      text: 'text-emerald-400',
      border: 'border-emerald-600/40',
      icon: Wifi,
    },
    good: {
      label: 'Good',
      bg: 'bg-blue-950/70',
      text: 'text-blue-400',
      border: 'border-blue-600/40',
      icon: Wifi,
    },
    fair: {
      label: 'Fair',
      bg: 'bg-amber-950/70',
      text: 'text-amber-400',
      border: 'border-amber-600/40',
      icon: AlertTriangle,
    },
    poor: {
      label: 'Poor',
      bg: 'bg-orange-950/70',
      text: 'text-orange-400',
      border: 'border-orange-600/40',
      icon: AlertTriangle,
    },
    critical: {
      label: 'Critical',
      bg: 'bg-rose-950/70',
      text: 'text-rose-400',
      border: 'border-rose-600/40',
      icon: WifiOff,
    },
  };

  const current = ratingConfig[rating];
  const IconComponent = current.icon;

  return (
    <div className="flex items-center gap-2">
      {isDataSaver && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 backdrop-blur-sm">
          <Activity className="w-3 h-3 text-emerald-400" />
          Data Saver Active
        </span>
      )}

      <button
        onClick={onOpenDiagnostics}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-md transition-all hover:brightness-125 cursor-pointer ${current.bg} ${current.text} ${current.border}`}
        title="Click to view real-time WebRTC diagnostics and bandwidth stats"
      >
        <IconComponent className="w-3.5 h-3.5" />
        <span className="font-semibold">{current.label}</span>
        {stats && (
          <span className="opacity-80 text-[11px] ml-0.5">
            ({rtt > 0 ? `${rtt}ms` : '<50ms'} · {loss > 0 ? `${loss}% loss` : '0% loss'})
          </span>
        )}
      </button>
    </div>
  );
};
