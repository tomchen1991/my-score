import { writable } from 'svelte/store';

export const toast = writable<{ message: string; visible: boolean }>({ message: '', visible: false });

export function showToast(message: string, duration = 2000) {
  toast.set({ message, visible: true });
  setTimeout(() => {
    toast.set({ message: '', visible: false });
  }, duration);
} 