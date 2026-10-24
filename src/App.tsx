import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Menu, X } from 'lucide-react';

const BG_IMAGE_1 = 'https://raw.githubusercontent.com/sureshapps/Skyra/refs/heads/main/public/Img1.webp';
const BG_IMAGE_2 = 'https://raw.githubusercontent.com/sureshapps/Skyra/refs/heads/main/public/Img2.webp';
const LOGO_PATH = 'M 256 64 L 256 128 L 192.5 128 L 160 95 L 128 64 L 96 95 L 63.5 128 L 64 128 L 128 192 L 128 256 L 64.5 256 L 32 223 L 0 192 L 0 64 L 64 0 L 192 0 Z M 256 192 L 256 256 L 192.5 256 L 160 223 L 128 192 L 128 128 L 192 128 Z';
const NAV_LINKS = ['Module', 'Case Records', 'Biotech', 'Tiers', 'Live Demo'];
const STATS = [
  { radius: 330, start: -92, end: 16, dot: -46, number: '16', suffix: 'years', label: 'DESIGNER' },
  { radius: 395, start: -56, end: 60, dot: 2, number: '120', suffix: 'months', label: 'DEVELOPER' },
  { radius: 460, start: -14, end: 72, dot: 44, number: '2', suffix: 'decades', label: 'TECHNOLOGY' },
];

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d={LOGO_PATH} />
    </svg>
  );
}

function polar(radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return { x: -110 + radius * Math.cos(radians), y: 300 + radius * Math.sin(radians) };
}

function Statistics() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-50 hidden sm:block" aria-hidden="true">
      <svg viewBox="0 0 380 700" preserveAspectRatio="xMaxYMid meet" className="h-full w-auto">
        <defs>
          {STATS.map((stat, index) => {
            const start = polar(stat.radius, stat.start);
            const end = polar(stat.radius, stat.end);
            return (
              <linearGradient key={stat.label} id={`arc-gradient-${index}`} gradientUnits="userSpaceOnUse" x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
                <stop offset="0%" stopColor="white" stopOpacity="0" />
                <stop offset="22%" stopColor="white" stopOpacity="0.5" />
                <stop offset="55%" stopColor="white" stopOpacity="0.5" />
                <stop offset="85%" stopColor="white" stopOpacity="0.1" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>
            );
          })}
        </defs>
        {STATS.map((stat, index) => {
          const start = polar(stat.radius, stat.start);
          const end = polar(stat.radius, stat.end);
          const dot = polar(stat.radius, stat.dot);
          const length = stat.radius * (stat.end - stat.start) * Math.PI / 180;
          const lineDelay = 0.4 + index * 0.22;
          const markDelay = lineDelay + 0.9;
          return (
            <g key={stat.label}>
              <path
                d={`M ${start.x} ${start.y} A ${stat.radius} ${stat.radius} 0 0 1 ${end.x} ${end.y}`}
                fill="none"
                stroke={`url(#arc-gradient-${index})`}
                strokeWidth="1.1"
                className="arc-line"
                style={{ '--len': length, animationDelay: `${lineDelay}s` } as CSSProperties}
              />
              <circle cx={dot.x} cy={dot.y} r="7" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.35" className="arc-ring" style={{ animationDelay: `${markDelay + 0.3}s` }} />
              <circle cx={dot.x} cy={dot.y} r="3.4" fill="white" className="arc-dot" style={{ animationDelay: `${markDelay}s` }} />
              <text x={dot.x + 16} y={dot.y + 4} fill="white" fontSize="32" letterSpacing="-1" className="arc-text" style={{ animationDelay: `${markDelay + 0.15}s` }}>
                {stat.number}<tspan fontSize="19" dy="-10">{stat.suffix}</tspan>
              </text>
              <text x={dot.x + 18} y={dot.y + 22} fill="white" fillOpacity="0.8" fontSize="8.5" fontWeight="600" letterSpacing="2" className="arc-text" style={{ animationDelay: `${markDelay + 0.3}s` }}>
                {stat.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notice, setNotice] = useState<'reserve' | 'connect' | null>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const patternRef = useRef<SVGPatternElement>(null);
  const noticeRef = useRef<HTMLDialogElement>(null);
  const cursorTarget = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const reveal = revealRef.current;
    const pattern = patternRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !reveal || !pattern || !context) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let animationFrame = 0;
    let cursor = { x: -999, y: -999 };
    let parallax = { x: 0, y: 0 };
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    const mouseMove = (event: MouseEvent) => {
      cursorTarget.current = { x: event.clientX, y: event.clientY };
    };
    const mouseLeave = () => {
      cursorTarget.current = { x: -999, y: -999 };
    };
    const motionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };
    resize();

    const animate = () => {
      const target = cursorTarget.current;
      const cursorLerp = reducedMotion ? 1 : 0.1;
      cursor.x += (target.x - cursor.x) * cursorLerp;
      cursor.y += (target.y - cursor.y) * cursorLerp;
      const gridX = target.x < 0 || reducedMotion ? 0 : (target.x / width - 0.5) * 16;
      const gridY = target.y < 0 || reducedMotion ? 0 : (target.y / height - 0.5) * 16;
      parallax.x += (gridX - parallax.x) * 0.06;
      parallax.y += (gridY - parallax.y) * 0.06;
      pattern.setAttribute('x', String(parallax.x));
      pattern.setAttribute('y', String(parallax.y));

      context.clearRect(0, 0, width, height);
      const gradient = context.createRadialGradient(cursor.x, cursor.y, 0, cursor.x, cursor.y, 260);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.4, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.6, 'rgba(255,255,255,0.75)');
      gradient.addColorStop(0.75, 'rgba(255,255,255,0.4)');
      gradient.addColorStop(0.88, 'rgba(255,255,255,0.12)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(cursor.x, cursor.y, 260, 0, Math.PI * 2);
      context.fill();
      const mask = `url("${canvas.toDataURL()}")`;
      reveal.style.maskImage = mask;
      reveal.style.webkitMaskImage = mask;
      animationFrame = window.requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', mouseMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', mouseLeave);
    window.addEventListener('blur', mouseLeave);
    window.addEventListener('resize', resize, { passive: true });
    motionQuery.addEventListener('change', motionChange);
    animationFrame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('mousemove', mouseMove);
      document.documentElement.removeEventListener('mouseleave', mouseLeave);
      window.removeEventListener('blur', mouseLeave);
      window.removeEventListener('resize', resize);
      motionQuery.removeEventListener('change', motionChange);
      cursorTarget.current = { x: -999, y: -999 };
    };
  }, []);

  useEffect(() => {
    const dialog = noticeRef.current;
    if (notice && dialog && !dialog.open) dialog.showModal();
    if (!notice && dialog?.open) dialog.close();
  }, [notice]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  function navigate(label: string) {
    setMobileMenuOpen(false);
    if (label === 'Live Demo') {
      cursorTarget.current = { x: window.innerWidth * 0.62, y: window.innerHeight * 0.42 };
    }
  }

  function openNotice(value: 'reserve' | 'connect') {
    setMobileMenuOpen(false);
    setNotice(value);
  }

  return (
    <div className="min-h-screen bg-white tracking-[-0.02em]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between md:justify-center p-4 sm:p-5" aria-label="Main navigation">
        <div className="nav-drop hidden items-center gap-1 rounded-full bg-black/60 py-2 pl-3 pr-2 backdrop-blur-md md:flex">
          <a href="#module" aria-label="Augmented Self home" className="mr-1 flex h-8 w-8 items-center justify-center rounded-full text-white"><Logo /></a>
          {NAV_LINKS.map((label) => (
            <button key={label} type="button" onClick={() => navigate(label)} aria-current={label === 'Module' ? 'page' : undefined} className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/10 hover:text-white ${label === 'Module' ? 'text-white' : 'text-gray-300'}`}>
              {label}
            </button>
          ))}
          <button type="button" onClick={() => openNotice('connect')} className="ml-1 rounded-full bg-white px-5 py-1.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100">Connect</button>
        </div>
        <a href="#module" onClick={() => setMobileMenuOpen(false)} aria-label="Augmented Self home" className="nav-drop flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md md:hidden"><Logo /></a>
        <button type="button" aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'} aria-controls="mobile-navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)} className="nav-drop flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md md:hidden">
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>
      {mobileMenuOpen && (
        <div id="mobile-navigation" className="fixed top-0 left-0 right-0 z-40 bg-white px-5 pt-16 pb-6 shadow-lg md:hidden">
          {NAV_LINKS.map((label) => (
            <button key={label} type="button" onClick={() => navigate(label)} className="block w-full border-b border-gray-100 py-3 text-left text-sm font-medium text-gray-800">{label}</button>
          ))}
          <button type="button" onClick={() => openNotice('connect')} className="mt-5 rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white">Connect</button>
        </div>
      )}

      <main id="module" className="relative h-[100dvh] overflow-hidden">
        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" style={{ opacity: 0.1 }} aria-hidden="true">
          <defs>
            <pattern ref={patternRef} id="hero-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#64748b" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>
        <div className="ken-burns absolute inset-0 z-10 bg-cover bg-center" style={{ backgroundImage: `url("${BG_IMAGE_1}")` }} aria-hidden="true" />
        <div ref={revealRef} className="pointer-events-none absolute inset-0 z-30 bg-cover bg-center" style={{ backgroundImage: `url("${BG_IMAGE_2}")`, maskImage: 'linear-gradient(transparent, transparent)', WebkitMaskImage: 'linear-gradient(transparent, transparent)', maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }} aria-hidden="true" />
        <canvas ref={canvasRef} hidden aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-r from-black/30 via-transparent to-transparent" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-t from-black/30 via-transparent to-transparent" aria-hidden="true" />
        <Statistics />
        <section className="absolute bottom-12 left-5 z-50 max-w-[300px] sm:bottom-16 sm:left-8 sm:max-w-md md:bottom-24 md:left-12" aria-labelledby="hero-title">
          <p className="hero-rise mb-5 text-[11px] font-semibold tracking-[0.12em] text-white/90 sm:text-xs" style={{ animationDelay: '0.15s' }}>Gateway to your <span className="italic">augmented self</span></p>
          <h1 id="hero-title" className="hero-rise mb-5 text-4xl leading-[1.05] tracking-[-0.08em] text-white sm:text-5xl md:text-6xl" style={{ animationDelay: '0.3s' }}>
            A window<br />of coming<br />enhancements
          </h1>
          <p className="hero-rise mb-7 text-sm leading-relaxed text-white/90 sm:text-base" style={{ animationDelay: '0.5s' }}>
            A future where carbon fiber, titanium, and human instinct align. Not machine. Not human. Something wonderfully poised between.
          </p>
          <div className="hero-rise inline-block" style={{ animationDelay: '0.7s' }}>
            <button type="button" onClick={() => openNotice('reserve')} className="group relative overflow-hidden rounded-full bg-white px-7 py-3 text-sm font-semibold text-gray-900 shadow-lg shadow-black/20 transition-transform duration-300 hover:scale-[1.04] active:scale-95 sm:px-8 sm:py-3.5">
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent transition-transform duration-700 group-hover:translate-x-full" aria-hidden="true" />
              <span className="relative">Reserve Now</span>
            </button>
          </div>
        </section>
      </main>

      <dialog ref={noticeRef} onCancel={() => setNotice(null)} onClick={(event) => { if (event.target === event.currentTarget) setNotice(null); }} className="w-[calc(100%-2.5rem)] max-w-md rounded-2xl bg-[#151012] p-7 text-white shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm" aria-labelledby="notice-title">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <button type="button" onClick={() => setNotice(null)} aria-label="Close dialog" className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"><X size={22} /></button>
        </div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Augmented Self</p>
        <h2 id="notice-title" className="mb-4 text-2xl leading-tight tracking-[-0.06em]">{notice === 'reserve' ? 'Your next evolution.' : 'Human. Beyond.'}</h2>
        <p className="mb-6 text-sm leading-relaxed text-white/70">{notice === 'reserve' ? 'Reservations will open with the next phase. This preview does not yet accept bookings.' : 'A connection to what comes next. Contact details will be available when the next phase launches.'}</p>
        <button type="button" onClick={() => setNotice(null)} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100">Back to the module</button>
      </dialog>
    </div>
  );
}
