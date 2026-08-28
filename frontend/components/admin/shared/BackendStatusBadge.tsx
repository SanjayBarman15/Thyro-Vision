import React from 'react';
import { Wifi, WifiOff, Activity } from 'lucide-react';
import { BackendStatus } from '@/hooks/useBackendStatus';

interface Props {
  status: BackendStatus;
  lastOnline: Date | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  showLastSeen?: boolean;
}

export function BackendStatusBadge({ 
  status, 
  lastOnline, 
  isRefreshing, 
  onRefresh, 
  showLastSeen = false 
}: Props) {
  
  const formattedTime = lastOnline?.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  }) || "--:--";

  return (
    <div className="flex items-center gap-4">
      {/* Clickable Status Button */}
      <button
        onClick={() => onRefresh()}
        disabled={status === 'checking' || isRefreshing}
        title="Click to check backend status"
        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-all
          ${status === 'online' 
            ? 'bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20' 
            : status === 'offline'
            ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
            : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500 cursor-wait'}`}
      >
        {status === 'online' ? (
          <Wifi className="w-3.5 h-3.5" />
        ) : status === 'offline' ? (
          <WifiOff className="w-3.5 h-3.5" />
        ) : (
          <Activity className="w-3.5 h-3.5 animate-pulse" />
        )}
        <span className="capitalize">
          {status === 'online' ? '200 OK' : status === 'offline' ? 'Offline' : 'Checking...'}
        </span>
      </button>

      {/* Live Indicator / Last Seen */}
      {showLastSeen && (
        <div
          className={`flex items-center gap-2 px-4 py-2 text-sm
                      rounded-lg border transition-colors
                      ${status === 'online' 
                        ? 'bg-green-500/10 border-green-500/20 text-green-500' 
                        : status === 'offline'
                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                        : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'}`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'online'
                ? (isRefreshing ? "bg-yellow-500 animate-pulse" : "bg-green-500 animate-pulse")
                : status === 'offline'
                ? "bg-red-500"
                : "bg-yellow-500 animate-pulse"
            }`}
          />
          <span>
            {status === 'online' 
              ? (isRefreshing ? "Refreshing..." : `Live · ${formattedTime}`)
              : status === 'offline'
              ? `Disconnected · Last seen ${formattedTime}`
              : "Checking Status..."}
          </span>
        </div>
      )}
    </div>
  );
}
