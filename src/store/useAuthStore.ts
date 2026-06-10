import { create } from 'zustand';

interface UIState {
  viewMode: 'list' | 'grid';
  setViewMode: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'list',
  setViewMode: () =>
    set((state) => ({
      viewMode: state.viewMode === 'list' ? 'grid' : 'list',
    })),
}));

