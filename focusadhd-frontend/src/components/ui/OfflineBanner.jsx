import { useNetworkStore } from "../../store/networkStore";
import { AlertTriangle } from "lucide-react";

export function OfflineBanner() {
  const isOnline = useNetworkStore((state) => state.isOnline);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-md flex items-center justify-center space-x-2 animate-in slide-in-from-top-2">
      <AlertTriangle className="h-5 w-5" />
      <p className="font-medium text-sm md:text-base">
        You're offline. Please check your network connection and reload.
      </p>
    </div>
  );
}
