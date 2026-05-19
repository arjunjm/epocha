import { useState, useEffect } from 'react';
import { subscribeToToasts, type ToastData } from '../utils/toast';

const DURATION = 3500;

const STYLES: Record<string, string> = {
  xp:      'bg-amber-500/15 border-amber-500/30 text-amber-200',
  levelup: 'bg-violet-500/20 border-violet-400/40 text-violet-200',
  success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200',
  error:   'bg-red-500/15 border-red-500/30 text-red-300',
  info:    'bg-white/8 border-white/15 text-slate-200',
};

const ICONS: Record<string, string> = {
  xp:      '⚡',
  levelup: '🎉',
  success: '✓',
  error:   '✕',
  info:    'ℹ',
};

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    return subscribeToToasts(t => {
      setToasts(prev => [...prev.slice(-4), t]); // keep max 5
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, DURATION);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none print:hidden">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border backdrop-blur-sm shadow-lg fade-up text-sm max-w-xs ${STYLES[t.type] ?? STYLES.info}`}
        >
          <span className="text-base leading-none mt-0.5 flex-shrink-0">{ICONS[t.type]}</span>
          <div className="min-w-0">
            <p className="font-semibold leading-snug">{t.message}</p>
            {t.detail && <p className="text-xs opacity-70 mt-0.5">{t.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
