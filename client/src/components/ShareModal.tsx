import { useState } from 'react';

interface Props {
  topic: string;
  period: string;
  firstDate?: string;
  lastDate?: string;
  eventCount?: number;
  onClose: () => void;
}

export default function ShareModal({ topic, period, firstDate, lastDate, eventCount, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [tweetCopied, setTweetCopied] = useState(false);

  const url = window.location.href;
  const encodedUrl = encodeURIComponent(url);

  const rangeText = firstDate && lastDate ? ` — from ${firstDate} to ${lastDate}` : '';
  const countText = eventCount ? ` · ${eventCount} key events` : '';
  const tweetText = `Just explored "${topic}" (${period}) on Epocha${rangeText}${countText}. Fascinating stuff 🗓\n\nTry it free: ${url}\n\n#history #learning`;
  const encodedTweet = encodeURIComponent(tweetText);
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedTweet}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyTweet = async () => {
    await navigator.clipboard.writeText(tweetText);
    setTweetCopied(true);
    setTimeout(() => setTweetCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass rounded-2xl border border-white/10 p-6 max-w-sm w-full fade-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white">Share this timeline</h2>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors text-lg leading-none">×</button>
        </div>

        {/* Topic summary */}
        <div className="mb-5 px-3 py-2.5 rounded-xl bg-white/4 border border-white/8">
          <p className="text-amber-400 text-[10px] font-semibold tracking-widest uppercase mb-0.5">{period}</p>
          <p className="text-white text-sm font-semibold">{topic}</p>
          {eventCount && <p className="text-slate-600 text-xs mt-0.5">{eventCount} events</p>}
        </div>

        {/* Shareable link */}
        <div className="mb-4">
          <p className="text-slate-500 text-xs mb-1.5">Link</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={url}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs outline-none truncate"
            />
            <button
              onClick={() => void copyLink()}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/8 text-slate-300 border border-white/10 hover:bg-white/12'
              }`}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Pre-written tweet */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-slate-500 text-xs">Ready-to-post tweet</p>
            <button
              onClick={() => void copyTweet()}
              className="text-[10px] text-slate-600 hover:text-amber-400 transition-colors"
            >
              {tweetCopied ? '✓ copied' : 'copy text'}
            </button>
          </div>
          <div className="px-3 py-2.5 rounded-lg bg-white/4 border border-white/8 text-slate-400 text-xs leading-relaxed whitespace-pre-line">
            {tweetText}
          </div>
        </div>

        {/* Share buttons */}
        <div className="flex gap-2">
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-white/8 text-slate-300 border border-white/10 hover:bg-white/12 hover:text-white transition-all"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.849L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Post on X
          </a>
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-white/8 text-slate-300 border border-white/10 hover:bg-white/12 hover:text-white transition-all"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            LinkedIn
          </a>
        </div>

        <p className="mt-4 text-center text-slate-700 text-[10px]">
          Generated on <span className="text-slate-600">Epocha</span> · free to explore at{' '}
          <span className="text-amber-600/70">epochas.app</span>
        </p>
      </div>
    </div>
  );
}
