interface Props {
  onClose: () => void;
}

function Step({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3 text-left">
      <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-white text-sm font-semibold mb-0.5">{title}</p>
        <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default function WelcomeModal({ onClose }: Props) {
  const handleClose = () => {
    try { localStorage.setItem('epocha-welcomed', '1'); } catch { /* ignore */ }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm">
      <div className="glass rounded-2xl border border-white/10 p-7 max-w-sm w-full fade-up text-center">
        <div className="text-5xl mb-3">📜</div>
        <h2 className="font-cinzel font-black text-xl text-white mb-1 tracking-wide">Welcome to Epocha</h2>
        <p className="text-slate-500 text-sm mb-6">Any topic. Any era. Instant history.</p>

        <div className="space-y-4 mb-7">
          <Step
            icon="🔍"
            title="Search any topic in history"
            desc="Empires, revolutions, scientific breakthroughs — type anything and get a structured timeline in seconds."
          />
          <Step
            icon="📚"
            title="Browse 100+ curated timelines"
            desc="The sidebar has pre-generated timelines across science, history, philosophy and more. Loads instantly, no sign-in needed."
          />
          <Step
            icon="⭐"
            title="Level up as you explore"
            desc="Earn XP, take quizzes, save your favourites, and track your reading progress across topics."
          />
        </div>

        <button
          onClick={handleClose}
          className="w-full py-3 rounded-xl font-bold text-sm text-black transition-all shadow-lg shadow-amber-500/20"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}
        >
          Start exploring →
        </button>
        <p className="mt-3 text-slate-700 text-xs">
          Sign in to generate custom timelines · free
        </p>
      </div>
    </div>
  );
}
