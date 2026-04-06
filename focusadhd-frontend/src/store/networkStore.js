import { create } from "zustand";

export const useNetworkStore = create((set) => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  setOnline: (status) => set({ isOnline: status }),
}));
