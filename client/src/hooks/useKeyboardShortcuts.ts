import { useEffect } from 'react';

interface Shortcuts {
  onQuiz?: () => void;
  onSave?: () => void;
  onReset?: () => void;
  onHelp?: () => void;
  onCompact?: () => void;
  onEscape?: () => void;
}

function isTyping(): boolean {
  const tag = (document.activeElement?.tagName ?? '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function useKeyboardShortcuts(shortcuts: Shortcuts, active: boolean) {
  useEffect(() => {
    if (!active) return;

    const handler = (e: KeyboardEvent) => {
      if (isTyping()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'Escape': shortcuts.onEscape?.(); break;
        case 'q':      shortcuts.onQuiz?.();    break;
        case 'b':      shortcuts.onSave?.();    break;
        case 'Backspace':
        case 'h':      shortcuts.onReset?.();   break;
        case 'c':      shortcuts.onCompact?.(); break;
        case '?':      shortcuts.onHelp?.();    break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, shortcuts.onQuiz, shortcuts.onSave, shortcuts.onReset, shortcuts.onHelp, shortcuts.onCompact, shortcuts.onEscape]);
}

export const SHORTCUT_LIST = [
  { key: 'Q', description: 'Open quiz' },
  { key: 'B', description: 'Bookmark / save' },
  { key: 'C', description: 'Toggle compact view' },
  { key: 'H', description: 'Go back home' },
  { key: '?', description: 'Show this help' },
  { key: 'Esc', description: 'Close modals' },
];
