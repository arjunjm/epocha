import type { AppPage } from '../types';
import type { AuthUser } from '../hooks/useAuth';

interface Props {
  page: AppPage;
  onNavigate: (page: AppPage) => void;
  user?: AuthUser | null;
}

const tabs: { id: AppPage; label: string; icon: string; authRequired?: boolean }[] = [
  { id: 'home',       label: 'Home',     icon: '⌂' },
  { id: 'discover',   label: 'Discover', icon: '✦' },
  { id: 'paths',      label: 'Paths',    icon: '◎' },
  { id: 'saved',      label: 'Library',  icon: '◫', authRequired: true },
  { id: 'stats',      label: 'Stats',    icon: '◈', authRequired: true },
];

export default function MobileNav({ page, onNavigate, user }: Props) {
  const visible = tabs.filter(t => !t.authRequired || !!user);
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0a0e1a]/95 backdrop-blur-lg border-t border-white/8 flex items-stretch safe-bottom">
      {visible.map(tab => {
        const active = page === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
              active ? 'text-amber-400' : 'text-slate-600 hover:text-slate-300'
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
            {active && <div className="absolute top-0 w-8 h-0.5 bg-amber-400 rounded-full" />}
          </button>
        );
      })}
    </nav>
  );
}
