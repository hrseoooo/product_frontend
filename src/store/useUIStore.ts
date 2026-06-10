import { create } from 'zustand';

interface UIState {
  viewMode: 'list' | 'grid';
  toggleViewMode: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'list',
  toggleViewMode: () =>
    set((state) => ({
      viewMode: state.viewMode === 'list' ? 'grid' : 'list',
    })),
}));

