"use client";

export default function Header() {
  return (
    <header className="border-b border-[#1e1e1e] px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#00c277] flex items-center justify-center">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0a0a0a"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Query Selection Engine
          </h1>
          <p className="text-xs text-[#888]">
            Maximal dispersion query selection
          </p>
        </div>
      </div>
    </header>
  );
}
