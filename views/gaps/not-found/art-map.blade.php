{{-- O mapa dobrado com a trilha pontilhada que termina num "×" fora do caminho. --}}
<svg viewBox="0 0 280 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="140" cy="198" rx="118" ry="8" fill="var(--accent-low)"/>
  <g stroke="var(--accent-high)" stroke-width="2" stroke-linejoin="round">
    <path d="M30 40l70-22v150l-70 22z" fill="var(--accent-low)"/>
    <path d="M100 18l80 22v150l-80-22z" fill="var(--accent-medium)"/>
    <path d="M180 40l70-22v150l-70 22z" fill="var(--accent-low)"/>
  </g>
  {{-- os "quarteirões" do mapa --}}
  <g fill="var(--bg)" opacity=".7">
    <rect x="44" y="52" width="22" height="14" rx="3"/>
    <rect x="114" y="120" width="26" height="16" rx="3"/>
    <rect x="196" y="120" width="30" height="14" rx="3"/>
  </g>
  {{-- a trilha --}}
  <path d="M58 158c22-36 52-6 72-42s52-42 78-26" fill="none" stroke="var(--accent-high)" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 7"/>
  <circle cx="58" cy="158" r="6" fill="var(--accent-high)"/>
  {{-- o alfinete triste no fim --}}
  <path d="M222 62c0-10 8-18 18-18s18 8 18 18c0 13-18 30-18 30s-18-17-18-30z" fill="var(--accent-high)"/>
  <circle cx="234" cy="60" r="2.2" fill="var(--bg)"/>
  <circle cx="246" cy="60" r="2.2" fill="var(--bg)"/>
  <path d="M234 70c4-3.5 8-3.5 12 0" fill="none" stroke="var(--bg)" stroke-width="2" stroke-linecap="round"/>
  {{-- o "?" --}}
  <path d="M199 22.5c.6-2.7 3-4.5 5.8-4.2 3 .3 5.1 3 4.6 5.9-.4 2.2-2 3.2-3.6 4.1-1.2.7-1.8 1.3-1.9 2.6" fill="none" stroke="var(--accent-high)" stroke-width="2" stroke-linecap="round"/>
  <circle cx="203.7" cy="34.6" r="1.4" fill="var(--accent-high)"/>
</svg>
