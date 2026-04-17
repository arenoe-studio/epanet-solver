function EpanetNetworkSVG() {
  return (
    <svg
      viewBox="0 0 620 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full"
      aria-label="Contoh topologi jaringan distribusi air EPANET"
    >
      {/* Pipes */}
      <line x1="100" y1="80" x2="200" y2="80" stroke="#d1d5db" strokeWidth="3" strokeLinecap="round" />
      <line x1="200" y1="80" x2="320" y2="80" stroke="#d1d5db" strokeWidth="3" strokeLinecap="round" />
      <line x1="320" y1="80" x2="440" y2="80" stroke="#d1d5db" strokeWidth="3" strokeLinecap="round" />
      <line x1="440" y1="80" x2="560" y2="80" stroke="#d1d5db" strokeWidth="3" strokeLinecap="round" />
      <line x1="200" y1="80" x2="200" y2="160" stroke="#d1d5db" strokeWidth="3" strokeLinecap="round" />
      <line x1="320" y1="80" x2="320" y2="160" stroke="#d1d5db" strokeWidth="3" strokeLinecap="round" />
      <line x1="440" y1="80" x2="440" y2="160" stroke="#d1d5db" strokeWidth="3" strokeLinecap="round" />
      <line x1="200" y1="160" x2="320" y2="160" stroke="#d1d5db" strokeWidth="3" strokeLinecap="round" />
      <line x1="320" y1="160" x2="440" y2="160" stroke="#d1d5db" strokeWidth="3" strokeLinecap="round" />

      {/* Reservoir */}
      <rect x="52" y="60" width="48" height="40" rx="4" stroke="#1a1a1a" strokeWidth="1.5" fill="#f3f4f6" />
      <path d="M60 88 Q76 81 92 88" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
      <text x="76" y="115" textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="monospace">R-1</text>

      {/* Top-row nodes */}
      <circle cx="200" cy="80" r="7" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <text x="200" y="66" textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="monospace">J-1</text>

      <circle cx="320" cy="80" r="7" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <text x="320" y="66" textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="monospace">J-2</text>

      <circle cx="440" cy="80" r="7" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <text x="440" y="66" textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="monospace">J-3</text>

      <circle cx="560" cy="80" r="7" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <text x="560" y="66" textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="monospace">J-4</text>

      {/* Bottom-row nodes */}
      <circle cx="200" cy="160" r="7" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <text x="200" y="178" textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="monospace">J-5</text>

      <circle cx="320" cy="160" r="7" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <text x="320" y="178" textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="monospace">J-6</text>

      <circle cx="440" cy="160" r="7" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <text x="440" y="178" textAnchor="middle" fontSize="10" fill="#6b7280" fontFamily="monospace">J-7</text>

      {/* Pipe labels */}
      <text x="150" y="74" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="monospace">P-1</text>
      <text x="260" y="74" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="monospace">P-2</text>
      <text x="380" y="74" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="monospace">P-3</text>
      <text x="500" y="74" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="monospace">P-4</text>
      <text x="193" y="122" textAnchor="end" fontSize="8" fill="#9ca3af" fontFamily="monospace">P-5</text>
      <text x="313" y="122" textAnchor="end" fontSize="8" fill="#9ca3af" fontFamily="monospace">P-6</text>
      <text x="447" y="122" textAnchor="start" fontSize="8" fill="#9ca3af" fontFamily="monospace">P-7</text>
      <text x="260" y="155" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="monospace">P-8</text>
      <text x="380" y="155" textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="monospace">P-9</text>
    </svg>
  );
}

export function NetworkPreviewStrip() {
  return (
    <section className="overflow-hidden border-y border-border-lavender bg-cloud-gray/50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-12">
          <div className="shrink-0 md:w-72">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-gray">
              Contoh jaringan
            </div>
            <p className="mt-2 text-sm leading-relaxed text-near-black">
              Upload file{" "}
              <span className="font-mono">.inp</span> Anda — topologi jaringan langsung
              terbaca oleh sistem.
            </p>
          </div>

          <div className="flex-1 overflow-hidden rounded-2xl border border-border-lavender bg-white p-6 shadow-whisper">
            <EpanetNetworkSVG />
          </div>
        </div>
      </div>
    </section>
  );
}
