import { create } from 'zustand'

/**
 * Offline sales waiting for sync, shared between the sale screen (which owns
 * the queue) and the app shell (single offline banner).
 */
interface SyncStore {
  pendingCount: number
  setPendingCount: (count: number) => void
}

export const useSyncStore = create<SyncStore>((set) => ({
  pendingCount: 0,
  setPendingCount: (pendingCount) => set({ pendingCount }),
}))
