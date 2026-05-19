export type ToastType = 'info' | 'success' | 'xp' | 'levelup' | 'error';

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  detail?: string;
}

type Listener = (t: ToastData) => void;
let listeners: Listener[] = [];

function emit(type: ToastType, message: string, detail?: string) {
  const t: ToastData = { id: crypto.randomUUID(), type, message, detail };
  listeners.forEach(fn => fn(t));
}

export const toast = {
  xp:      (amount: string, action?: string) => emit('xp', amount, action),
  levelup: (level: number, title: string)    => emit('levelup', `Level ${level}!`, title),
  success: (message: string, detail?: string) => emit('success', message, detail),
  error:   (message: string)                 => emit('error', message),
};

export function subscribeToToasts(fn: Listener): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}
