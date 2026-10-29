import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { X } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

/* ---------------------------------------------------------------------------------------------
   Laptop Screen Scroll
   - real 3D MacBook (GLB) whose lid hinges open as you scroll
   - Lenis smooth scroll driven by the shared GSAP ticker (native touch scrolling stays native)
   - the website on the screen is live HTML, pinned to the LCD with a CSS matrix3d that is solved
     from the same 3D camera every frame (4 projected corners -> homography)
   - the camera ends face-on, the screen grows to the full viewport at native size and the page
     keeps scrolling into the website
   - WebGL renders only when something changed, pixel ratio is capped, everything is torn down on close
   Put MacBook_Neo.glb in /public (all of its textures are embedded in the file).
--------------------------------------------------------------------------------------------- */

const MODEL_URL = '/MacBook_Neo.glb';
const PIN_SCREENS = 7; // length of the laptop scene, in viewport heights of scrolling
const TIMELINE_END = 9.4; // timeline units (see the tweens below)
const MAX_DPR = 2;

// LCD rectangle in the lid's own space (read from the GLB): x ±0.13939, z 0.01961 → 0.19378, plane y 0.00485
const LCD = { hw: 0.13939, y: 0.00485, z0: 0.01961, z1: 0.19378 };
const LCD_W = LCD.hw * 2;
const LCD_H = LCD.z1 - LCD.z0;
const LCD_ASPECT = LCD_W / LCD_H; // 1.6 (16:10)
// hinge: the lid is authored standing up; this is its closed pose and the axis it folds around
const LID_CLOSED = new THREE.Vector3(0, 0.0102, -0.0999366);
const HINGE = new THREE.Vector2(0.00441, -0.09411); // (y, z) of the hinge axis
const OPEN_MAX = THREE.MathUtils.degToRad(100);
const GROUND_Y = -0.0083; // underside of the rubber feet

type Look = 'citrus' | 'midnight';
const LOOK_LABEL: Record<Look, string> = { citrus: 'Citrus', midnight: 'Midnight' };

type Finish = { color: string; metalness?: number; roughness?: number };
const MIDNIGHT_FINISH: Record<string, Finish> = {
  'Anodized aluminum': { color: '#111111', metalness: 0.96, roughness: 0.38 },
  'Touchpad glass': { color: '#202020' },
  'Touchpad tint': { color: '#090909' },
  'Rubber feet': { color: '#0c0f17' },
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ---------- homography: 4 points -> 4 points, as a CSS matrix3d ---------- */
function homography(src: number[][], dst: number[][]): number[] | null {
  const m: number[][] = [];
  for (let i = 0; i < 4; i += 1) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    m.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    m.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c += 1) {
    let p = c;
    for (let r = c + 1; r < 8; r += 1) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-12) return null;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < 8; r += 1) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k < 9; k += 1) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, i) => row[8] / row[i]);
}

/* ---------- procedural textures ---------- */
function blobShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(0.45, 'rgba(0,0,0,0.22)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function midnightWallpaper() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#060912';
    g.fillRect(0, 0, 1024, 1024);
    const a = g.createRadialGradient(300, 700, 20, 300, 700, 560);
    a.addColorStop(0, 'rgba(32,214,190,0.55)');
    a.addColorStop(1, 'rgba(32,214,190,0)');
    g.fillStyle = a;
    g.fillRect(0, 0, 1024, 1024);
    const b = g.createRadialGradient(780, 330, 20, 780, 330, 520);
    b.addColorStop(0, 'rgba(124,92,255,0.6)');
    b.addColorStop(1, 'rgba(124,92,255,0)');
    g.fillStyle = b;
    g.fillRect(0, 0, 1024, 1024);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; // the LCD UVs run right-to-left: flip so any artwork reads correctly
  t.repeat.x = -1;
  t.offset.x = 1;
  return t;
}

/* keycap artwork for the midnight finish: light key faces become near-black, dark legends become soft grey */
function midnightKeys(src: THREE.Texture, maxSize: number): THREE.CanvasTexture | null {
  const img = src.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!img || !img.width) return null;
  const scale = Math.min(1, Math.min(3072, maxSize) / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(img, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const l = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
    const k = smooth(0.3, 0.62, l); // 0 = legend / outline, 1 = key face
    const shade = 0.55 + 0.45 * l;
    px[i] = 150 + (22 * shade - 150) * k;
    px[i + 1] = 158 + (27 * shade - 158) * k;
    px[i + 2] = 176 + (40 * shade - 176) * k;
  }
  g.putImageData(data, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.flipY = src.flipY;
  t.channel = src.channel;
  t.wrapS = src.wrapS;
  t.wrapT = src.wrapT;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = src.anisotropy;
  return t;
}

/* ---------- the live websites shown on the screen ---------- */
const WORK = [
  { n: '01', name: 'Skyra', tag: 'Weather · Next.js', text: 'A weather app with a live hero clock, deployed on Vercel.', href: 'https://skyra.snet.my' },
  { n: '02', name: 'Fluency', tag: 'Vocabulary', text: 'One rare word a day with five examples, favourites, streaks and reminders.', href: '' },
  { n: '03', name: 'JomKumpul', tag: 'Rewards · DuitNow QR', text: 'A save-and-collect rewards app built around a QR payment flow.', href: '' },
];
const STACK = ['React', 'TypeScript', 'GSAP', 'Three.js', 'Tailwind CSS', 'Next.js', 'DevOps'];
const GITHUB = 'https://github.com/sureshapps';
const BEHANCE = 'https://www.behance.net/sureshksmy';

type IdFn = (name: string) => string | undefined;

function CitrusSite({ id }: { id: IdFn }) {
  return (
    <div className="ls-c">
      <header>
        <a className="logo" href="#ls-top">SK.</a>
        <nav aria-label="Citrus site">
          <a href="#ls-work">Work</a>
          <a href="#ls-stack">Stack</a>
          <a href="#ls-contact">Contact</a>
        </nav>
      </header>
      <section className="hero" id={id('top')}>
        <div className="caps" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
        <p className="eyebrow">DevOps · Frontend · Malaysia</p>
        <h1>Code<br />Beyond Limits.</h1>
        <p className="lede">Suresh Kaleyannan builds interactive websites with modern frontend technologies, smooth animations and creative experiences.</p>
        <div className="cta">
          <a className="btn solid" href="#ls-work">See the work</a>
          <a className="btn" href="#ls-contact">Say hello</a>
        </div>
      </section>
      <section className="block" id={id('work')}>
        <h2>Selected work</h2>
        <div className="cards">
          {WORK.map((w) => (
            <article key={w.name} className="card">
              <span className="num">{w.n}</span>
              <h3>{w.name}</h3>
              <p className="tag">{w.tag}</p>
              <p>{w.text}</p>
              {w.href && <a className="more" href={w.href} target="_blank" rel="noopener noreferrer">Open live ↗</a>}
            </article>
          ))}
        </div>
      </section>
      <section className="block" id={id('stack')}>
        <h2>Stack</h2>
        <ul className="chips">{STACK.map((s) => <li key={s}>{s}</li>)}</ul>
      </section>
      <section className="block contact" id={id('contact')}>
        <h2>Jom connect.</h2>
        <p>Projects, collaborations or a quick hello.</p>
        <div className="cta">
          <a className="btn solid" href={GITHUB} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          <a className="btn" href={BEHANCE} target="_blank" rel="noopener noreferrer">Behance ↗</a>
        </div>
      </section>
      <footer>© Suresh Kaleyannan</footer>
    </div>
  );
}

function MidnightSite({ id }: { id: IdFn }) {
  return (
    <div className="ls-m">
      <header>
        <a className="logo" href="#ls-top">~/suresh</a>
        <nav aria-label="Midnight site">
          <a href="#ls-work">01 work</a>
          <a href="#ls-stack">02 stack</a>
          <a href="#ls-contact">03 contact</a>
        </nav>
      </header>
      <section className="hero" id={id('top')}>
        <p className="eyebrow"><span className="dot" />available · devops · frontend · my</p>
        <h1>Code Beyond<br /><em>Limits.</em></h1>
        <p className="lede">Interactive websites, smooth motion and the pipelines that ship them.</p>
        <div className="cta">
          <a className="btn solid" href="#ls-work">view work →</a>
          <a className="btn" href="#ls-contact">get in touch</a>
        </div>
      </section>
      <section className="block" id={id('work')}>
        <h2><span>01</span> Selected work</h2>
        <ul className="rows">
          {WORK.map((w) => (
            <li key={w.name}>
              <span className="num">{w.n}</span>
              <div><h3>{w.name}</h3><p>{w.text}</p></div>
              <span className="tag">{w.tag}</span>
              {w.href ? <a className="go" href={w.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${w.name}`}>↗</a> : <span className="go off">·</span>}
            </li>
          ))}
        </ul>
      </section>
      <section className="block" id={id('stack')}>
        <h2><span>02</span> Toolbox</h2>
        <ul className="grid">{STACK.map((s) => <li key={s}>{s}</li>)}</ul>
      </section>
      <section className="block contact" id={id('contact')}>
        <h2><span>03</span> Contact</h2>
        <a className="big" href={GITHUB} target="_blank" rel="noopener noreferrer">github.com/sureshapps ↗</a>
        <a className="big alt" href={BEHANCE} target="_blank" rel="noopener noreferrer">behance.net/sureshksmy ↗</a>
      </section>
      <footer>© Suresh Kaleyannan · built to scroll</footer>
    </div>
  );
}

function Site({ look, ids }: { look: Look; ids: boolean }) {
  const id: IdFn = (name) => (ids ? `ls-${name}` : undefined);
  return <div className="ls-site">{look === 'citrus' ? <CitrusSite id={id} /> : <MidnightSite id={id} />}</div>;
}

/* ---------- styles ---------- */
const STYLES = `
.ls-root { position: fixed; inset: 0; z-index: 120; overflow: hidden; letter-spacing: normal; color: #111; font-family: 'Poppins', system-ui, sans-serif; outline: none; background: #f2f0c4; transition: background-color .6s ease; }
.ls-root.look-midnight { background: #070a12; color: #e8ecf6; }
.ls-root.ls-landing { background: #050505; color: #f5f5f5; }
.ls-landing .ls-bg.midnight { background: radial-gradient(ellipse at 50% 35%, #242424, #0b0b0b 60%, #050505); }
.ls-landing .ls-inner, .ls-landing .ls-inner > .app-root { height: var(--ls-vh, 100dvh); }
.ls-landing .ls-inner { width: 100%; }
.ls-landing .ls-static { overflow: hidden; }
.ls-wrapper { position: absolute; inset: 0; scroll-behavior: auto; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scrollbar-width: none; outline: none; }
.ls-wrapper::-webkit-scrollbar { display: none; }
.ls-track { position: relative; width: 100%; }
.ls-stage { position: sticky; top: 0; width: 100%; overflow: hidden; }
.ls-bg { position: absolute; inset: 0; transition: opacity .6s ease; }
.ls-bg.citrus { background: radial-gradient(120% 90% at 50% 18%, #fffbd6 0%, #eef08f 45%, #c9e23c 100%); }
.ls-bg.midnight { background: radial-gradient(120% 90% at 50% 20%, #17203a 0%, #0a0f1d 55%, #04060b 100%); }
.ls-root.look-midnight .ls-bg.citrus, .ls-root:not(.look-midnight) .ls-bg.midnight { opacity: 0; }
.ls-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
.ls-screen { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: hidden; transform-origin: 0 0; pointer-events: none; visibility: hidden; backface-visibility: hidden; contain: layout paint; }
.ls-inner { will-change: transform; }
.ls-intro { position: absolute; left: 0; right: 0; top: clamp(72px, 14vh, 150px); text-align: center; padding: 0 24px; pointer-events: none; }
.ls-intro h2 { margin: 0; font-size: clamp(2rem, 6vw, 4.6rem); line-height: 1; font-weight: 600; letter-spacing: -0.03em; }
.ls-intro p { margin: 14px auto 0; max-width: 34ch; font-size: clamp(.9rem, 1.6vw, 1.1rem); opacity: .7; }
.ls-hint { position: absolute; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; opacity: .7; pointer-events: none; }
.ls-hint i { width: 22px; height: 34px; border: 1.5px solid currentColor; border-radius: 12px; position: relative; }
.ls-hint i::after { content: ''; position: absolute; left: 50%; top: 6px; width: 3px; height: 7px; margin-left: -1.5px; border-radius: 2px; background: currentColor; animation: ls-wheel 1.6s ease-in-out infinite; }
@keyframes ls-wheel { 0% { opacity: 0; transform: translateY(0); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(12px); } }
.ls-ui { position: absolute; z-index: 5; }
.ls-close { top: 18px; right: 18px; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; border: 1px solid rgba(255,255,255,.55); background: rgba(20,20,20,.35); color: #fff; cursor: pointer; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.ls-looks { left: 50%; bottom: 22px; transform: translateX(-50%); display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: rgba(20,20,20,.38); border: 1px solid rgba(255,255,255,.35); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.ls-looks button { border: 0; cursor: pointer; padding: 9px 18px; border-radius: 999px; font: 500 13px 'Poppins', system-ui, sans-serif; color: #fff; background: transparent; transition: background-color .3s ease, color .3s ease; }
.ls-looks button[aria-pressed='true'] { background: #fff; color: #111; }
.ls-loader { position: absolute; left: 50%; top: 50%; width: min(240px, 60vw); transform: translate(-50%, 90px); text-align: center; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; opacity: .75; pointer-events: none; transition: opacity .4s ease; }
.ls-loader.done { opacity: 0; }
.ls-loader b { display: block; height: 3px; margin-top: 10px; border-radius: 2px; background: currentColor; transform-origin: 0 50%; transform: scaleX(0.02); opacity: .85; }
.ls-loader.indeterminate b { animation: ls-ind 1.2s ease-in-out infinite alternate; }
@keyframes ls-ind { to { transform: scaleX(.9); } }

/* static fallback */
.ls-static { position: absolute; inset: 0; overflow-y: auto; overscroll-behavior: contain; --ls-vh: 100dvh; }
.ls-static-hero { padding: clamp(72px, 12vh, 120px) 20px 48px; text-align: center; }
.ls-static-hero h2 { margin: 0 0 28px; font-size: clamp(1.8rem, 5vw, 3.2rem); font-weight: 600; letter-spacing: -0.03em; }
.ls-lap { width: min(86vw, 760px); margin: 0 auto; }
.ls-lap-lid { aspect-ratio: 16 / 10; border-radius: 16px 16px 6px 6px; padding: 10px; background: #14161c; box-shadow: 0 24px 60px rgba(0,0,0,.28); }
.ls-lap-screen { position: relative; width: 100%; height: 100%; overflow: hidden; border-radius: 6px; background: #000; }
.ls-lap-base { height: 14px; margin: 0 -4%; border-radius: 0 0 18px 18px; background: linear-gradient(#d6d8de, #9ea2ad); }

/* ------------ website: Citrus ------------ */
.ls-site { text-align: left; -webkit-font-smoothing: antialiased; }
.ls-site * { box-sizing: border-box; }
.ls-site a { color: inherit; }
.ls-c { --ink: #1b2410; --lime: #cde43c; --green: #6db92f; --sky: #8fe2e6; --sun: #f6e94a; background: #f8f6d6; color: var(--ink); font-family: 'Poppins', system-ui, sans-serif; overflow: hidden; }
.ls-c header { position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; padding: 24px clamp(20px, 5vw, 72px); }
.ls-c .logo { font-weight: 700; font-size: 20px; text-decoration: none; }
.ls-c nav { display: flex; gap: 4px; padding: 5px; border-radius: 999px; background: rgba(255,255,255,.7); }
.ls-c nav a { padding: 8px 16px; border-radius: 999px; font-size: 14px; font-weight: 500; text-decoration: none; transition: background-color .25s; }
.ls-c nav a:hover { background: var(--lime); }
.ls-c .hero { position: relative; display: flex; flex-direction: column; justify-content: center; min-height: calc(var(--ls-vh, 800px) - 88px); padding: 0 clamp(20px, 5vw, 72px) 40px; }
.ls-c .caps { position: absolute; right: 0; top: 0; bottom: 0; width: min(46%, 640px); display: flex; gap: 12px; align-items: center; justify-content: flex-end; padding-right: clamp(10px, 3vw, 40px); }
.ls-c .caps i { flex: 1; max-width: 70px; border-radius: 999px; background: linear-gradient(180deg, var(--sky), var(--green) 45%, var(--sun)); box-shadow: inset 0 2px 8px rgba(255,255,255,.7); }
.ls-c .caps i:nth-child(1) { height: 62%; } .ls-c .caps i:nth-child(2) { height: 40%; opacity: .85; } .ls-c .caps i:nth-child(3) { height: 74%; }
.ls-c .caps i:nth-child(4) { height: 30%; opacity: .8; } .ls-c .caps i:nth-child(5) { height: 66%; } .ls-c .caps i:nth-child(6) { height: 46%; opacity: .85; } .ls-c .caps i:nth-child(7) { height: 58%; }
.ls-c .eyebrow { position: relative; margin: 0 0 14px; font-size: 13px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; opacity: .65; }
.ls-c h1 { position: relative; margin: 0; font-size: clamp(3rem, 8.2vw, 8rem); line-height: .94; font-weight: 700; letter-spacing: -0.045em; }
.ls-c .lede { position: relative; max-width: 36ch; margin: 22px 0 0; font-size: clamp(1rem, 1.5vw, 1.25rem); line-height: 1.5; opacity: .8; }
.ls-c .cta { position: relative; display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
.ls-c .btn { padding: 13px 24px; border-radius: 999px; border: 1.5px solid var(--ink); font-size: 14px; font-weight: 600; text-decoration: none; transition: transform .25s; }
.ls-c .btn:hover { transform: translateY(-2px); }
.ls-c .btn.solid { background: var(--ink); color: #f8f6d6; }
.ls-c .block { padding: clamp(56px, 10vw, 120px) clamp(20px, 5vw, 72px); }
.ls-c h2 { margin: 0 0 32px; font-size: clamp(2rem, 4.6vw, 4rem); font-weight: 700; letter-spacing: -0.035em; }
.ls-c .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; }
.ls-c .card { position: relative; padding: 26px; border-radius: 28px; background: linear-gradient(160deg, #fff 0%, #eef6b8 100%); box-shadow: 0 1px 0 rgba(255,255,255,.9) inset, 0 18px 40px rgba(110,130,20,.14); min-height: 280px; display: flex; flex-direction: column; }
.ls-c .card:nth-child(2) { background: linear-gradient(160deg, #fff 0%, #cdf0f0 100%); } .ls-c .card:nth-child(3) { background: linear-gradient(160deg, #fff 0%, #fbf0a0 100%); }
.ls-c .card .num { font-size: 13px; font-weight: 600; opacity: .5; }
.ls-c .card h3 { margin: 28px 0 4px; font-size: 28px; letter-spacing: -0.03em; }
.ls-c .card .tag { margin: 0 0 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .1em; opacity: .55; }
.ls-c .card p { margin: 0; font-size: 15px; line-height: 1.55; opacity: .85; }
.ls-c .card .more { margin-top: auto; padding-top: 18px; font-weight: 600; font-size: 14px; text-decoration: none; }
.ls-c .chips { display: flex; flex-wrap: wrap; gap: 10px; list-style: none; padding: 0; margin: 0; }
.ls-c .chips li { padding: 12px 22px; border-radius: 999px; background: #fff; font-weight: 600; font-size: 15px; box-shadow: 0 8px 20px rgba(110,130,20,.12); }
.ls-c .contact { margin: 0 clamp(12px, 3vw, 40px); border-radius: 36px; background: linear-gradient(135deg, var(--lime), var(--green) 60%, var(--sky)); }
.ls-c .contact h2 { font-size: clamp(2.4rem, 7vw, 6rem); } .ls-c .contact p { margin: -12px 0 0; font-size: 18px; }
.ls-c footer { padding: 36px clamp(20px, 5vw, 72px) 44px; font-size: 13px; opacity: .6; }

/* ------------ website: Midnight ------------ */
.ls-m { --acc: #2fe3c2; --vio: #8a6bff; background: #070a12; color: #e8ecf6; font-family: 'JetBrains Mono', ui-monospace, monospace; overflow: hidden;
  background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 48px 48px; }
.ls-m header { display: flex; justify-content: space-between; align-items: center; padding: 22px clamp(20px, 5vw, 72px); border-bottom: 1px solid rgba(255,255,255,.08); }
.ls-m .logo { color: var(--acc); text-decoration: none; font-weight: 600; }
.ls-m nav { display: flex; gap: 22px; font-size: 13px; } .ls-m nav a { text-decoration: none; opacity: .7; transition: opacity .2s, color .2s; } .ls-m nav a:hover { opacity: 1; color: var(--acc); }
.ls-m .hero { position: relative; display: flex; flex-direction: column; justify-content: center; min-height: calc(var(--ls-vh, 800px) - 70px); padding: 0 clamp(20px, 5vw, 72px) 40px; }
.ls-m .hero::before { content: ''; position: absolute; right: -8%; top: 8%; width: 46vw; height: 46vw; max-width: 640px; max-height: 640px; border-radius: 50%; background: radial-gradient(circle, rgba(138,107,255,.38), transparent 65%); filter: blur(10px); }
.ls-m .eyebrow { position: relative; margin: 0 0 22px; font-size: 13px; opacity: .75; display: flex; align-items: center; gap: 10px; }
.ls-m .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--acc); box-shadow: 0 0 12px var(--acc); }
.ls-m h1 { position: relative; margin: 0; font-size: clamp(2.8rem, 8vw, 7.6rem); line-height: .98; font-weight: 600; letter-spacing: -0.05em; }
.ls-m h1 em { font-style: normal; background: linear-gradient(90deg, var(--acc), var(--vio)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.ls-m .lede { position: relative; max-width: 42ch; margin: 24px 0 0; font-size: clamp(.9rem, 1.3vw, 1.05rem); line-height: 1.7; opacity: .7; }
.ls-m .cta { position: relative; display: flex; flex-wrap: wrap; gap: 10px; margin-top: 30px; }
.ls-m .btn { padding: 12px 22px; border-radius: 10px; border: 1px solid rgba(255,255,255,.25); text-decoration: none; font-size: 13px; transition: border-color .2s, transform .2s; }
.ls-m .btn:hover { border-color: var(--acc); transform: translateY(-2px); }
.ls-m .btn.solid { background: var(--acc); border-color: var(--acc); color: #04100d; font-weight: 600; }
.ls-m .block { padding: clamp(56px, 10vw, 120px) clamp(20px, 5vw, 72px); border-top: 1px solid rgba(255,255,255,.08); }
.ls-m h2 { margin: 0 0 36px; font-size: clamp(1.4rem, 3vw, 2.2rem); font-weight: 500; letter-spacing: -0.02em; } .ls-m h2 span { color: var(--acc); margin-right: 14px; font-size: .6em; vertical-align: middle; }
.ls-m .rows { list-style: none; margin: 0; padding: 0; }
.ls-m .rows li { display: grid; grid-template-columns: 56px 1fr auto 40px; gap: 18px; align-items: center; padding: 26px 0; border-bottom: 1px solid rgba(255,255,255,.1); }
.ls-m .rows .num { color: var(--acc); font-size: 13px; } .ls-m .rows h3 { margin: 0 0 6px; font-size: clamp(1.3rem, 2.6vw, 2rem); font-weight: 500; letter-spacing: -0.03em; }
.ls-m .rows p { margin: 0; font-size: 13px; line-height: 1.6; opacity: .6; max-width: 56ch; } .ls-m .rows .tag { font-size: 12px; opacity: .55; text-align: right; }
.ls-m .rows .go { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; border: 1px solid rgba(255,255,255,.25); text-decoration: none; transition: background-color .2s, color .2s; } .ls-m .rows a.go:hover { background: var(--acc); color: #04100d; } .ls-m .rows .go.off { opacity: .3; }
.ls-m .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.ls-m .grid li { padding: 22px; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; background: rgba(255,255,255,.03); font-size: 14px; }
.ls-m .contact .big { display: block; width: fit-content; max-width: 100%; margin-bottom: 14px; font-size: clamp(1.2rem, 3.6vw, 2.8rem); letter-spacing: -0.04em; text-decoration: none; word-break: break-all; transition: color .2s; } .ls-m .contact .big:hover { color: var(--acc); } .ls-m .contact .alt { opacity: .6; }
.ls-m footer { padding: 32px clamp(20px, 5vw, 72px) 44px; font-size: 12px; opacity: .45; border-top: 1px solid rgba(255,255,255,.08); }

@media (max-width: 700px) {
  .ls-c nav a { padding: 7px 11px; font-size: 13px; } .ls-c .caps { opacity: .35; width: 80%; }
  .ls-m nav { gap: 12px; } .ls-m .rows li { grid-template-columns: 34px 1fr 36px; } .ls-m .rows .tag { display: none; }
}
@media (prefers-reduced-motion: reduce) { .ls-hint i::after, .ls-loader.indeterminate b { animation: none; } .ls-root, .ls-bg { transition: none; } }
`;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    const ok = !!gl;
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

function MiniScreen({ look }: { look: Look }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const siteRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = boxRef.current;
    const site = siteRef.current;
    if (!box || !site) return;
    const fit = () => { site.style.transform = `scale(${box.clientWidth / 1440})`; };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={boxRef} className="ls-lap-screen" aria-hidden="true" {...({ inert: '' } as object)}>
      <div ref={siteRef} style={{ position: 'absolute', left: 0, top: 0, width: 1440, transformOrigin: '0 0', ['--ls-vh' as string]: '900px' } as CSSProperties}>
        <Site look={look} ids={false} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------
   Component
--------------------------------------------------------------------------------------------- */
export default function LaptopScroll({ onClose, landing = false, children }: { onClose?: () => void; landing?: boolean; children?: ReactNode }) {
  const [mode, setMode] = useState<'scene' | 'static'>(() =>
    typeof window !== 'undefined' && (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !webglAvailable()) ? 'static' : 'scene');
  const [look, setLook] = useState<Look>(landing ? 'midnight' : 'citrus');
  const lookRef = useRef<Look>(landing ? 'midnight' : 'citrus');
  const applyLookRef = useRef<((next: Look, animate: boolean) => void) | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const rootRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    lookRef.current = look;
    applyLookRef.current?.(look, true);
  }, [look]);

  // Escape closes; the page behind stays untouched
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (mode !== 'scene') return;
    const root = rootRef.current;
    const wrapper = wrapperRef.current;
    const track = trackRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const screen = screenRef.current;
    const inner = innerRef.current;
    if (!root || !wrapper || !track || !stage || !canvas || !screen || !inner) return;
    if (landing) inner.inert = true;

    /* ----- renderer ----- */
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setMode('static');
      return;
    }
    let disposed = false;
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 20);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.9;
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(0.6, 1.1, 1.0);
    const rim = new THREE.DirectionalLight(0xffffff, 0.9);
    rim.position.set(-0.9, 0.5, -0.8);
    scene.add(key, rim);

    const shadowTex = blobShadowTexture();
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.78, 0.6),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, GROUND_Y - 0.0002, 0);
    scene.add(shadow);

    /* ----- state driven by the scroll timeline ----- */
    const S = { open: 0, cam: 0, fill: 0 };
    let dirty = true;
    const invalidate = () => { dirty = true; };

    /* ----- model ----- */
    const pivot = new THREE.Group(); // hinge axis
    pivot.position.set(0, HINGE.x, HINGE.y);
    scene.add(pivot);
    let lid: THREE.Object3D | null = null;
    let loaded = false;
    const mats = new Map<string, THREE.MeshStandardMaterial>();
    const originals = new Map<string, { color: THREE.Color; metalness: number; roughness: number }>();
    let keyMat: THREE.MeshStandardMaterial | null = null;
    let keyOriginal: THREE.Texture | null = null;
    let keyMidnight: THREE.CanvasTexture | null = null;
    let lcdMat: THREE.MeshStandardMaterial | null = null;
    let lcdOriginal: THREE.Texture | null = null;
    const lcdMidnight = midnightWallpaper();
    let finishTween: gsap.core.Tween | null = null;
    const owned: THREE.Texture[] = [shadowTex, lcdMidnight, envTexture];

    const applyLook = (next: Look, animate: boolean) => {
      if (!loaded) return;
      const midnight = next === 'midnight';
      if (midnight && keyMat && !keyMidnight && keyOriginal) {
        keyMidnight = midnightKeys(keyOriginal, renderer.capabilities.maxTextureSize);
        if (keyMidnight) owned.push(keyMidnight);
      }
      if (keyMat) keyMat.map = midnight && keyMidnight ? keyMidnight : keyOriginal;
      if (keyMat) keyMat.needsUpdate = true;
      if (lcdMat) {
        lcdMat.map = midnight ? lcdMidnight : lcdOriginal;
        lcdMat.emissiveMap = lcdMat.map;
        lcdMat.needsUpdate = true;
      }
      const from = new Map<string, { c: THREE.Color; m: number; r: number }>();
      const to = new Map<string, { c: THREE.Color; m: number; r: number }>();
      mats.forEach((mat, name) => {
        const base = originals.get(name);
        if (!base) return;
        const f = midnight ? MIDNIGHT_FINISH[name] : undefined;
        from.set(name, { c: mat.color.clone(), m: mat.metalness, r: mat.roughness });
        to.set(name, f
          ? { c: new THREE.Color(f.color), m: f.metalness ?? base.metalness, r: f.roughness ?? base.roughness }
          : { c: base.color.clone(), m: base.metalness, r: base.roughness });
      });
      finishTween?.kill();
      const prog = { t: animate ? 0 : 1 };
      const step = () => {
        mats.forEach((mat, name) => {
          const a = from.get(name);
          const b = to.get(name);
          if (!a || !b) return;
          mat.color.lerpColors(a.c, b.c, prog.t);
          mat.metalness = a.m + (b.m - a.m) * prog.t;
          mat.roughness = a.r + (b.r - a.r) * prog.t;
        });
        invalidate();
      };
      if (animate) finishTween = gsap.to(prog, { t: 1, duration: 0.7, ease: 'power2.inOut', onUpdate: step });
      else step();
    };
    applyLookRef.current = applyLook;

    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        lid = model.getObjectByName('Lid') ?? null;
        if (!lid) { setMode('static'); return; }
        // fold the lid around the real hinge axis: closed pose = flipped over (screen down), scrub rotates it open
        pivot.add(lid);
        lid.position.set(LID_CLOSED.x, LID_CLOSED.y - HINGE.x, LID_CLOSED.z - HINGE.y);
        lid.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
        scene.add(model);
        const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          list.forEach((m) => {
            const mat = m as THREE.MeshStandardMaterial;
            [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap].forEach((tex) => { if (tex) tex.anisotropy = aniso; });
            if (mat.name === 'Keycap') { keyMat = mat; keyOriginal = mat.map; }
            if (mat.name === 'LCD') {
              lcdMat = mat;
              lcdOriginal = mat.map;
              mat.emissive = new THREE.Color(0xffffff);
              mat.emissiveMap = mat.map;
              mat.emissiveIntensity = 0.5;
            }
            if (mat.name && !mats.has(mat.name) && (mat.name in MIDNIGHT_FINISH)) {
              mats.set(mat.name, mat);
              originals.set(mat.name, { color: mat.color.clone(), metalness: mat.metalness, roughness: mat.roughness });
            }
          });
        });
        loaded = true;
        loaderRef.current?.classList.add('done');
        applyLook(lookRef.current, false);
        buildPath();
        invalidate();
        // build the midnight keycaps while the page is idle so the finish switch is instant
        window.setTimeout(() => {
          if (disposed || keyMidnight || !keyOriginal) return;
          keyMidnight = midnightKeys(keyOriginal, renderer.capabilities.maxTextureSize);
          if (keyMidnight) owned.push(keyMidnight);
        }, 600);
      },
      (event) => {
        const bar = barRef.current;
        if (!bar) return;
        if (event.lengthComputable && event.total > 0) bar.style.transform = `scaleX(${Math.max(0.02, event.loaded / event.total)})`;
        else loaderRef.current?.classList.add('indeterminate');
      },
      () => { if (!disposed) setMode('static'); },
    );

    /* ----- camera path (rebuilt on resize) ----- */
    const C = new THREE.Vector3();
    const N = new THREE.Vector3();
    const E = new THREE.Vector3();
    const lidFrame = (open: number) => {
      pivot.rotation.x = -OPEN_MAX * open;
      pivot.updateMatrixWorld(true);
      if (!lid) return;
      C.set(0, LCD.y, (LCD.z0 + LCD.z1) / 2).applyMatrix4(lid.matrixWorld);
      N.set(0, 1, 0).transformDirection(lid.matrixWorld);
      E.set(0, 0, 1).transformDirection(lid.matrixWorld);
    };
    let posCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.4, 0.4, 0.8), new THREE.Vector3(0, 0.2, 0.6)]);
    let tgtCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 0.07, 0)]);
    const upEnd = new THREE.Vector3(0, 1, 0);
    let vw = 1;
    let vh = 1;
    let pinLen = 1;

    function buildPath() {
      if (!lid) return;
      const aspect = vw / vh;
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      lidFrame(1);
      // contain-fit: the whole LCD touches the viewport on its limiting side
      const dFinal = Math.max(LCD_H / (2 * tanH), LCD_W / (2 * tanH * aspect));
      const pEnd = C.clone().addScaledVector(N, dFinal);
      const tEnd = C.clone();
      upEnd.copy(E);
      const fitW = 0.34 / (2 * tanH * aspect); // keeps the whole laptop in frame on narrow screens
      const p0 = new THREE.Vector3(0.62, 0.5, 1).normalize().multiplyScalar(Math.max(0.8, fitW * 1.1));
      const p1 = new THREE.Vector3(0.12, 0.26, 1).normalize().multiplyScalar(Math.max(0.62, fitW));
      posCurve = new THREE.CatmullRomCurve3([p0, p1, pEnd], false, 'centripetal');
      tgtCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.0, 0), new THREE.Vector3(0, 0.07, -0.02), tEnd], false, 'centripetal');
    }

    const tmpT = new THREE.Vector3();
    const tmpUp = new THREE.Vector3();
    const applyCamera = () => {
      posCurve.getPoint(S.cam, camera.position);
      tgtCurve.getPoint(S.cam, tmpT);
      tmpUp.set(0, 1, 0).lerp(upEnd, smooth(0.5, 1, S.cam)).normalize();
      camera.up.copy(tmpUp);
      camera.lookAt(tmpT);
    };

    /* ----- HTML screen pinned to the LCD ----- */
    const corners = [
      new THREE.Vector3(LCD.hw, LCD.y, LCD.z1), // top-left as the viewer sees it (lid x is mirrored)
      new THREE.Vector3(-LCD.hw, LCD.y, LCD.z1),
      new THREE.Vector3(-LCD.hw, LCD.y, LCD.z0),
      new THREE.Vector3(LCD.hw, LCD.y, LCD.z0),
    ];
    const tmpV = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    let live = false;

    const setLive = (next: boolean) => {
      if (next === live) return;
      live = next;
      canvas.style.visibility = next ? 'hidden' : 'visible';
      screen.style.pointerEvents = next ? 'auto' : 'none';
      stage.classList.toggle('is-live', next);
      if (landing) {
        inner.inert = !next;
        inner.setAttribute('aria-hidden', String(!next));
      }
    };

    const updateScreen = () => {
      if (!lid) return;
      if (S.fill >= 0.999) {
        setLive(true);
        screen.style.visibility = 'visible';
        screen.style.opacity = '1';
        screen.style.transform = 'none';
        screen.style.clipPath = 'none';
        return;
      }
      setLive(false);
      lid.updateWorldMatrix(true, false);
      toCam.copy(camera.position).sub(C);
      const facing = N.dot(toCam.normalize());
      const on = smooth(0.82, 1, S.open) * smooth(0.02, 0.22, facing);
      if (on < 0.003) { screen.style.visibility = 'hidden'; return; }
      const quad = corners.map((corner) => {
        tmpV.copy(corner).applyMatrix4(lid!.matrixWorld).project(camera);
        return [(tmpV.x * 0.5 + 0.5) * vw, (-tmpV.y * 0.5 + 0.5) * vh];
      });
      // the part of the page that sits on the 16:10 screen: the biggest centred 16:10 rectangle of the viewport
      const rw = vw / vh >= LCD_ASPECT ? vh * LCD_ASPECT : vw;
      const rh = rw / LCD_ASPECT;
      const rx = (vw - rw) / 2;
      const ry = (vh - rh) / 2;
      const h = homography([[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]], quad);
      if (!h) { screen.style.visibility = 'hidden'; return; }
      screen.style.transform = `matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,1)`;
      // as the camera lands the visible window widens from the 16:10 screen to the whole page
      const t = S.fill;
      const top = ry * (1 - t);
      const left = rx * (1 - t);
      screen.style.clipPath = `inset(${top}px ${left}px ${top}px ${left}px)`;
      screen.style.opacity = String(on);
      screen.style.visibility = 'visible';
    };

    const frame = () => {
      if (!loaded) return;
      pivot.rotation.x = -OPEN_MAX * S.open;
      applyCamera();
      if (S.fill < 0.999) renderer.render(scene, camera);
      lidFrame(S.open); // refresh C / N / E for this frame (also updates matrices)
      updateScreen();
    };

    /* ----- sizing ----- */
    let siteH = 0;
    const measure = () => {
      vw = wrapper.clientWidth || window.innerWidth;
      vh = wrapper.clientHeight || window.innerHeight;
      pinLen = PIN_SCREENS * vh;
      stage.style.height = `${vh}px`;
      root.style.setProperty('--ls-vh', `${vh}px`);
      siteH = inner.offsetHeight;
      track.style.height = `${pinLen + Math.max(siteH, vh)}px`;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
      renderer.setSize(vw, vh, false);
      camera.aspect = vw / vh;
      camera.updateProjectionMatrix();
      buildPath();
      invalidate();
    };
    measure();

    /* ----- Lenis + shared GSAP clock ----- */
    const lenis = new Lenis({ wrapper, content: track, autoRaf: false, smoothWheel: true, syncTouch: false, lerp: 0.1 });
    const onScroll = () => {
      const y = landing ? 0 : Math.max(0, lenis.scroll - pinLen);
      inner.style.transform = y > 0 ? `translate3d(0,${-y}px,0)` : '';
      ScrollTrigger.update();
    };
    lenis.on('scroll', onScroll);
    const tick = (time: number) => {
      lenis.raf(time * 1000);
      if (dirty) { dirty = false; frame(); }
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    /* ----- scroll timeline ----- */
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        onUpdate: invalidate,
        scrollTrigger: { trigger: track, scroller: wrapper, start: 'top top', end: () => `+=${pinLen}`, scrub: true, invalidateOnRefresh: true },
      });
      tl.to(S, { open: 1, duration: 4.2, ease: 'power2.inOut' }, 0)
        .to(S, { cam: 1, duration: 7.0, ease: 'power1.inOut' }, 0.4)
        .to(S, { fill: 1, duration: 1.6, ease: 'power2.inOut' }, 7.6)
        .to('.ls-intro', { opacity: 0, y: -28, duration: 1.4 }, 0.1)
        .to('.ls-hint', { opacity: 0, duration: 0.6 }, 0)
        .to({}, { duration: 0.4 }, TIMELINE_END - 0.4);
    }, root);

    /* ----- in-page links inside the site ----- */
    const onSiteClick = (event: MouseEvent) => {
      if (landing) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      event.preventDefault();
      const hash = link.getAttribute('href') ?? '';
      const target = hash.length > 1 ? inner.querySelector<HTMLElement>(`#${CSS.escape(hash.slice(1))}`) : null;
      const offset = target ? target.getBoundingClientRect().top - inner.getBoundingClientRect().top : 0;
      lenis.scrollTo(pinLen + offset, { duration: 1.3, easing: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2) });
    };
    screen.addEventListener('click', onSiteClick);

    /* ----- resize ----- */
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (disposed) return;
        measure();
        ScrollTrigger.refresh();
        lenis.resize();
      });
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(wrapper);
    ro.observe(inner);

    const onLost = (event: Event) => { event.preventDefault(); setMode('static'); };
    canvas.addEventListener('webglcontextlost', onLost);

    wrapper.focus({ preventScroll: true });
    ScrollTrigger.refresh();

    /* ----- teardown: GSAP, Lenis, listeners, GPU ----- */
    return () => {
      disposed = true;
      applyLookRef.current = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
      screen.removeEventListener('click', onSiteClick);
      canvas.removeEventListener('webglcontextlost', onLost);
      finishTween?.kill();
      ctx.revert();
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.off('scroll', onScroll);
      lenis.destroy();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => {
          Object.values(m).forEach((value) => { if (value instanceof THREE.Texture) value.dispose(); });
          m.dispose();
        });
      });
      owned.forEach((tex) => tex.dispose());
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [mode, landing]);

  const rootClass = `ls-root look-${look}${landing ? ' ls-landing' : ''}`;

  return (
    <div ref={rootRef} className={rootClass} role={landing ? undefined : 'dialog'} aria-modal={landing ? undefined : true} aria-label={landing ? undefined : 'Laptop screen scroll'} data-sfx={landing ? undefined : 'none'}>
      <style>{STYLES}</style>

      {mode === 'scene' ? (
        <div ref={wrapperRef} className="ls-wrapper" tabIndex={0}>
          <div ref={trackRef} className="ls-track">
            <div ref={stageRef} className="ls-stage">
              <div className="ls-bg citrus" aria-hidden="true" />
              <div className="ls-bg midnight" aria-hidden="true" />
              <canvas ref={canvasRef} className="ls-canvas" aria-hidden="true" />
              <div className="ls-intro">
                <h2>Open it.<br />Scroll in.</h2>
                <p>{landing ? 'Code Beyond Limits. Scroll to enter Suresh’s world.' : 'A real 3D laptop, a live website on its screen, one continuous scroll.'}</p>
              </div>
              <div className="ls-hint" aria-hidden="true"><i />Scroll</div>
              <div ref={loaderRef} className="ls-loader" aria-hidden="true">Loading<b ref={barRef} /></div>
              <div ref={screenRef} className="ls-screen">
                <div ref={innerRef} className="ls-inner">{landing ? children : <Site look={look} ids />}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="ls-static">
          {landing ? children : <>
          <div className="ls-static-hero">
            <h2>Code Beyond Limits.</h2>
            <div className="ls-lap">
              <div className="ls-lap-lid"><MiniScreen look={look} /></div>
              <div className="ls-lap-base" />
            </div>
          </div>
          <Site look={look} ids />
          </>}
        </div>
      )}

      {!landing && <button type="button" className="ls-ui ls-close" aria-label="Close laptop showcase" onClick={onClose}><X size={20} strokeWidth={2} /></button>}
      {!landing && <div className="ls-ui ls-looks" role="group" aria-label="Look">
        {(['citrus', 'midnight'] as Look[]).map((value) => (
          <button key={value} type="button" aria-pressed={look === value} onClick={() => setLook(value)}>{LOOK_LABEL[value]}</button>
        ))}
      </div>}
    </div>
  );
}
