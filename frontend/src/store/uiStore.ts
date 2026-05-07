import { create } from "zustand";

interface UIStore {
  skipModalOpen: boolean;
  shortcutsDisabled: boolean;

  openSkipModal(): void;
  closeSkipModal(): void;
  setShortcutsDisabled(v: boolean): void;
}

export const useUIStore = create<UIStore>((set) => ({
  skipModalOpen: false,
  shortcutsDisabled: false,

  openSkipModal() {
    set({ skipModalOpen: true, shortcutsDisabled: true });
  },

  closeSkipModal() {
    set({ skipModalOpen: false, shortcutsDisabled: false });
  },

  setShortcutsDisabled(v) {
    set({ shortcutsDisabled: v });
  },
}));
