import { SHORTCUT_LIST } from '../hooks/useKeyboardShortcuts';

interface Props { onClose: () => void }

export default function KeyboardHelp({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl w-full max-w-xs p-5 border border-white/10 fade-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors text-xl leading-none">×</button>
        </div>
        <div className="space-y-2">
          {SHORTCUT_LIST.map(({ key, description }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">{description}</span>
              <kbd className="px-2 py-0.5 rounded-md bg-white/8 border border-white/15 text-slate-300 text-[11px] font-mono font-bold">
                {key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-slate-700 text-center">Shortcuts inactive when typing in a field</p>
      </div>
    </div>
  );
}
