import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import gsap from 'gsap';
import { ChevronsLeft, Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Code2, FileText, Flame, Images, Info, Briefcase, Download, Music, Pause, Play, Repeat, Send, Shuffle, SkipBack, SkipForward, Sun, Volume2, VolumeX, X, type LucideIcon } from 'lucide-react';

import SpotlightBackground from './SpotlightBackground';
import NAV_ICON from './assets/nav-logo.webp';
const SIGNATURE = '/signature.png';
// DevOps badge shown next to the name in the Jom Connect card (put devops.svg in /public)
const DEVOPS_ICON = '/devops.svg';
const CV_SCRIPT = 'https://sureshapps.github.io/JomEdit/cv.js';
// cover photo for the Jom Connect card; swap for your own portrait
const CONNECT_COVER = '/me.webp';
const PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build';
const CV_URL = 'https://raw.githubusercontent.com/sureshapps/flanme/main/public/cv_devops.pdf';
const BEHANCE_USER = 'sureshksmy';
const BEHANCE_KEY = 'yOEjVeOZZg7Wi9bkoW5t37K9GpaAdRnV';
const BEHANCE_PROFILE = `https://www.behance.net/${BEHANCE_USER}`;
/* Robot webhook: when a URL is set, touching the robot POSTs a small JSON event to it and the robot shows (and speaks) the reply.
   The endpoint must allow CORS from this site. Never put secret keys in the URL: everything in this file is public.
   Accepted replies: JSON { "reply" | "text" | "message" | "output": "...", "audio_url"?: "...", "lang"?: "en-US" } (a one-item array works too),
   plain text, or an audio file (Content-Type: audio/*). Leave empty to keep the built-in random phrases. */
const ROBOT_WEBHOOK_URL = '';
const ROBOT_SPEAK = true; // read text replies aloud with the browser's built-in voice (when the reply has no audio)

/* ---------- Sound design ----------
   Every sound is synthesised live with the Web Audio API: no audio files to host, download or license.
   Palette
   - glass: inharmonic sine partials (wine-glass / bell ratios) plus a hairline noise tick
   - tech : band-passed noise sweeps, pitch-dropped sines, soft triangle blips
   - space: one short, bright, high-passed reverb so everything feels like it lives inside glass
   All pitches come from one pentatonic scale, so overlapping sounds (and your music) never clash.
   Browsers keep audio locked until the first tap / key press; the engine unlocks itself on that first gesture. */
const SFX_STORAGE_KEY = 'sfx-enabled';
const SFX_VOLUME = 0.48; // master level: 0 = silent, 1 = full

type SfxVoice = { t?: number; g?: number; send?: number; pan?: number };
type ToneOpts = SfxVoice & { f: number; to?: number; type?: OscillatorType; a?: number; d?: number; lp?: number; vib?: [number, number] };
type NoiseOpts = SfxVoice & { f: number; to?: number; type?: BiquadFilterType; q?: number; a?: number; d?: number; panTo?: number };
type GlassOpts = SfxVoice & { f: number; d?: number };
type SfxPanel = 'menu' | 'info' | 'widgets' | 'drop' | 'notice' | 'lightbox';

const PENT = [0, 2, 4, 7, 9];
// pentatonic pitch: i is a scale step (it may run past 4 into higher octaves), base is the MIDI note of step 0
const hz = (i: number, base = 76) => 440 * 2 ** ((base + 12 * Math.floor(i / 5) + (PENT[((i % 5) + 5) % 5] ?? 0) - 69) / 12);
// [frequency ratio, gain, decay multiplier] of the glass partials
const GLASS_PARTIALS: [number, number, number][] = [[1, 1, 1], [2.76, 0.5, 0.6], [5.4, 0.28, 0.4], [8.93, 0.14, 0.25]];

const sfx = (() => {
  type Graph = { c: AudioContext; bus: GainNode; send: GainNode; noise: AudioBuffer };
  let graph: Graph | null = null;
  let enabled = true;
  let T0 = 0; // start time shared by every voice of the sound being played, so layers stay in sync
  let lastHover = 0;
  let lastScrub = 0;
  let quietMenuUntil = 0;
  const listeners = new Set<() => void>(); // components that must follow the master sound switch (music, video, voice)
  try {
    if (typeof window !== 'undefined') enabled = window.localStorage.getItem(SFX_STORAGE_KEY) !== 'off';
  } catch { /* storage blocked: sound stays on */ }

  const impulse = (c: AudioContext, seconds: number, decay: number) => {
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i += 1) {
        const k = i / len;
        lp += ((Math.random() * 2 - 1) - lp) * (0.9 - 0.7 * k); // the tail darkens as it fades, like a real room
        data[i] = lp * (1 - k) ** decay;
      }
    }
    return buf;
  };

  const build = (): Graph | null => {
    if (typeof window === 'undefined') return null;
    const Ctor: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const c = new Ctor({ latencyHint: 'interactive' });
      const master = c.createGain();
      master.gain.value = SFX_VOLUME;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 20;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      master.connect(comp);
      const warmth = c.createBiquadFilter();
      warmth.type = 'lowpass';
      warmth.frequency.value = Math.min(14000, c.sampleRate * 0.42);
      warmth.Q.value = 0.5;
      comp.connect(warmth);
      warmth.connect(c.destination);
      const bus = c.createGain();
      bus.connect(master);
      const send = c.createGain();
      const verb = c.createConvolver();
      verb.buffer = impulse(c, 0.85, 4);
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 320; // airy tail, never muddy
      const ret = c.createGain();
      ret.gain.value = 0.28;
      send.connect(verb);
      verb.connect(hp);
      hp.connect(ret);
      ret.connect(master);
      const noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      return { c, bus, send, noise };
    } catch {
      return null;
    }
  };

  const unlock = () => {
    if (!enabled || (graph && graph.c.state === 'running')) return;
    if (!graph) graph = build();
    if (graph && graph.c.state !== 'running') graph.c.resume().catch(() => {});
  };
  const bindUnlock = () => {
    const events = ['pointerdown', 'pointerup', 'click', 'keydown', 'touchend'] as const;
    events.forEach((name) => window.addEventListener(name, unlock, { capture: true, passive: true }));
    return () => events.forEach((name) => window.removeEventListener(name, unlock, { capture: true }));
  };

  const get = (): Graph | null => {
    if (!enabled || !graph || document.hidden || graph.c.state !== 'running') return null;
    return graph;
  };
  const begin = () => {
    const G = get();
    if (!G) return false;
    T0 = G.c.currentTime + 0.006;
    return true;
  };

  const env = (p: AudioParam, t: number, peak: number, a: number, d: number) => {
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    p.exponentialRampToValueAtTime(0.0001, t + a + d);
  };

  const route = (G: Graph, node: AudioNode, v: SfxVoice & { panTo?: number }, dur: number, t: number) => {
    let out: AudioNode = node;
    if (v.pan !== undefined) {
      const p = G.c.createStereoPanner();
      p.pan.setValueAtTime(v.pan, t);
      if (v.panTo !== undefined) p.pan.linearRampToValueAtTime(v.panTo, t + dur);
      out.connect(p);
      out = p;
    }
    out.connect(G.bus);
    const s = v.send ?? 0.25;
    if (s > 0) {
      const sg = G.c.createGain();
      sg.gain.value = s;
      out.connect(sg);
      sg.connect(G.send);
    }
  };

  const tone = (o: ToneOpts) => {
    const G = get();
    if (!G) return;
    const { c } = G;
    const a = o.a ?? 0.004;
    const d = o.d ?? 0.12;
    const t = T0 + (o.t ?? 0);
    const osc = c.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + a + d);
    const g = c.createGain();
    env(g.gain, t, o.g ?? 0.1, a, d);
    if (o.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      f.Q.value = 0.7;
      osc.connect(f);
      f.connect(g);
    } else {
      osc.connect(g);
    }
    if (o.vib) {
      const lfo = c.createOscillator();
      lfo.frequency.value = o.vib[0];
      const depth = c.createGain();
      depth.gain.value = o.vib[1];
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + a + d + 0.05);
    }
    route(G, g, o, a + d, t);
    osc.start(t);
    osc.stop(t + a + d + 0.05);
  };

  const noise = (o: NoiseOpts) => {
    const G = get();
    if (!G) return;
    const { c } = G;
    const a = o.a ?? 0.003;
    const d = o.d ?? 0.1;
    const t = T0 + (o.t ?? 0);
    const src = c.createBufferSource();
    src.buffer = G.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.Q.value = o.q ?? 0.8;
    f.frequency.setValueAtTime(o.f, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + a + d);
    const g = c.createGain();
    env(g.gain, t, o.g ?? 0.1, a, d);
    src.connect(f);
    f.connect(g);
    route(G, g, o, a + d, t);
    src.start(t, Math.random() * 1.5);
    src.stop(t + a + d + 0.05);
  };

  // the signature glass voice: a struck pane
  const glass = (o: GlassOpts) => {
    const d = o.d ?? 0.5;
    const g = o.g ?? 0.1;
    GLASS_PARTIALS.forEach(([ratio, gain, decay]) => {
      const f = o.f * ratio;
      if (f > Math.min(10000, (get()?.c.sampleRate ?? 44100) * 0.42)) return;
      tone({ f, g: g * gain, a: 0.002, d: d * decay, t: o.t, send: o.send ?? 0.4, pan: o.pan });
    });
    noise({ type: 'highpass', f: 6000, d: 0.012, g: g * 0.45, t: o.t, send: 0, pan: o.pan });
  };

  const S: Record<string, (i: number) => void> = {
    /* ---- hover ---- */
    hover: (i) => glass({ f: hz(i, 83), g: 0.03, d: 0.09, send: 0.2 }),
    hoverCard: (i) => {
      glass({ f: hz(i, 71), g: 0.04, d: 0.18, send: 0.35 });
      noise({ type: 'bandpass', f: 3200, to: 6500, q: 1.2, a: 0.04, d: 0.1, g: 0.012, send: 0.2 });
    },
    hoverTech: () => {
      tone({ f: 520, to: 880, type: 'triangle', d: 0.08, g: 0.045, lp: 3200, send: 0.2 });
      glass({ f: hz(7, 79), t: 0.04, g: 0.035, d: 0.14 });
    },
    hoverWidget: (i) => {
      tone({ f: hz(i, 76), d: 0.09, g: 0.035, send: 0.25 });
      tone({ f: hz(i, 76) * 1.5, t: 0.035, d: 0.08, g: 0.022, send: 0.25 });
      glass({ f: hz(i + 5, 83), t: 0.02, g: 0.02, d: 0.12 });
    },

    /* ---- click / press ---- */
    click: (i) => {
      noise({ type: 'highpass', f: 4200, d: 0.014, g: 0.07, send: 0 });
      tone({ f: 1500, to: 960, d: 0.06, g: 0.075, send: 0.2 });
      tone({ f: 230, to: 110, d: 0.09, g: 0.07, send: 0.05 });
      glass({ f: hz(i + 3, 83), t: 0.01, g: 0.04, d: 0.22, send: 0.35 });
    },
    widgetTap: (i) => {
      tone({ f: hz(i, 76), type: 'triangle', d: 0.1, g: 0.07, lp: 3500 });
      tone({ f: hz(i + 2, 76), type: 'triangle', t: 0.06, d: 0.12, g: 0.06, lp: 3500 });
      glass({ f: hz(i + 5, 76), t: 0.06, g: 0.05, d: 0.4 });
    },
    nav: (i) => {
      const k = [0, 2, 3, 5][((i % 4) + 4) % 4] ?? 0; // each menu item has its own note
      S.click?.(k);
      glass({ f: hz(k, 76), t: 0.02, g: 0.1, d: 0.7, send: 0.5 });
      glass({ f: hz(k + 2, 76), t: 0.08, g: 0.07, d: 0.6, send: 0.5, pan: 0.2 });
    },
    linkOut: () => {
      S.click?.(1);
      noise({ type: 'bandpass', f: 1500, to: 6500, q: 1.2, a: 0.05, d: 0.16, g: 0.06, pan: -0.2, panTo: 0.5, send: 0.3 });
      glass({ f: hz(5, 79), t: 0.05, g: 0.07, d: 0.5 });
      glass({ f: hz(8, 79), t: 0.12, g: 0.07, d: 0.7 });
    },
    mail: () => {
      S.click?.(2);
      tone({ f: 700, to: 1700, type: 'triangle', t: 0.03, d: 0.12, g: 0.06, lp: 4500 });
      noise({ type: 'bandpass', f: 2000, to: 7000, q: 1, a: 0.04, d: 0.14, g: 0.04, t: 0.04, pan: -0.3, panTo: 0.6 });
      glass({ f: hz(7, 79), t: 0.12, g: 0.06, d: 0.5 });
    },
    download: () => {
      S.click?.(0);
      tone({ f: 1300, to: 520, t: 0.03, d: 0.16, g: 0.06 });
      tone({ f: 300, to: 130, t: 0.2, d: 0.12, g: 0.1, send: 0.1 });
      glass({ f: hz(4, 76), t: 0.2, g: 0.07, d: 0.6 });
      glass({ f: hz(7, 76), t: 0.28, g: 0.06, d: 0.7 });
    },
    retry: () => {
      S.click?.(0);
      tone({ f: 420, to: 1250, type: 'triangle', t: 0.02, d: 0.12, g: 0.06, lp: 4000 });
      glass({ f: hz(7, 79), t: 0.12, g: 0.05, d: 0.4 });
    },
    toggleOn: () => {
      tone({ f: 660, type: 'triangle', d: 0.07, g: 0.08, lp: 4200 });
      tone({ f: 990, type: 'triangle', t: 0.06, d: 0.11, g: 0.08, lp: 4200 });
      glass({ f: hz(5, 83), t: 0.06, g: 0.04, d: 0.3 });
    },
    toggleOff: () => {
      tone({ f: 880, type: 'triangle', d: 0.07, g: 0.07, lp: 3600 });
      tone({ f: 520, type: 'triangle', t: 0.06, d: 0.1, g: 0.065, lp: 3600 });
    },

    /* ---- music player ---- */
    play: () => {
      [0, 2, 4].forEach((n, k) => tone({ f: hz(n, 67), type: 'triangle', t: k * 0.07, d: k === 2 ? 0.2 : 0.1, g: 0.09, lp: 3800, send: 0.3 }));
      noise({ type: 'bandpass', f: 900, to: 5000, q: 1.1, a: 0.1, d: 0.2, g: 0.04 });
      glass({ f: hz(7, 79), t: 0.14, g: 0.05, d: 0.5 });
    },
    pause: () => {
      [4, 2, 0].forEach((n, k) => tone({ f: hz(n, 67), type: 'triangle', t: k * 0.07, d: k === 2 ? 0.2 : 0.1, g: 0.08, lp: 3200, send: 0.3 }));
      noise({ type: 'bandpass', f: 4500, to: 900, q: 1.1, a: 0.04, d: 0.22, g: 0.035 });
    },
    prev: () => {
      noise({ type: 'bandpass', f: 4000, to: 1200, q: 1.4, d: 0.14, g: 0.07, pan: 0.4, panTo: -0.5 });
      tone({ f: 900, to: 600, d: 0.07, g: 0.06, pan: 0.2 });
      tone({ f: 700, to: 460, t: 0.06, d: 0.08, g: 0.05, pan: -0.3 });
    },
    next: () => {
      noise({ type: 'bandpass', f: 1200, to: 4000, q: 1.4, d: 0.14, g: 0.07, pan: -0.4, panTo: 0.5 });
      tone({ f: 600, to: 900, d: 0.07, g: 0.06, pan: -0.2 });
      tone({ f: 760, to: 1100, t: 0.06, d: 0.08, g: 0.05, pan: 0.3 });
    },
    scrub: (p) => tone({ f: 420 + p * 1500, d: 0.035, g: 0.035, send: 0.12 }), // pitch follows the playhead

    /* ---- menu (capsule slides open left to right) ---- */
    menuOpen: () => {
      tone({ f: 300, to: 760, d: 0.09, g: 0.07, send: 0.15 });
      noise({ type: 'bandpass', f: 500, to: 5200, q: 1.1, a: 0.18, d: 0.32, g: 0.11, pan: -0.7, panTo: 0.7, send: 0.3 });
      // the four icons pop in at 150 ms + 50 ms each (same stagger as the CSS), panned left to right
      [5, 7, 8, 10].forEach((n, k) => glass({ f: hz(n, 76), t: 0.15 + k * 0.05, g: 0.05, d: 0.3, pan: -0.55 + k * 0.37, send: 0.4 }));
    },
    menuClose: () => {
      noise({ type: 'bandpass', f: 4200, to: 450, q: 1.1, a: 0.06, d: 0.24, g: 0.09, pan: 0.65, panTo: -0.65, send: 0.25 });
      tone({ f: 620, to: 250, d: 0.11, g: 0.06 });
      glass({ f: hz(5, 76), t: 0.2, g: 0.045, d: 0.25, pan: -0.4 });
      noise({ type: 'highpass', f: 5000, t: 0.28, d: 0.02, g: 0.05, send: 0 });
    },

    /* ---- info (and mobile widgets): panel unfolds from the top-right corner ---- */
    panelOpen: (v) => {
      const b = v ? 69 : 72;
      noise({ type: 'bandpass', f: 700, to: 6500, q: 1.4, a: 0.22, d: 0.38, g: 0.1, pan: 0.6, panTo: 0, send: 0.35 });
      [0, 2, 4, 7].slice(0, v ? 3 : 4).forEach((n, k) => glass({ f: hz(n, b), t: 0.04 + k * 0.09, g: 0.06, d: 0.5, pan: 0.5 - k * 0.15, send: 0.5 }));
      tone({ f: hz(0, b - 12), a: 0.18, d: 0.4, g: 0.03, send: 0.4 });
    },
    panelClose: (v) => {
      const b = v ? 69 : 72;
      noise({ type: 'bandpass', f: 5200, to: 500, q: 1.3, a: 0.05, d: 0.3, g: 0.09, pan: 0, panTo: 0.6, send: 0.3 });
      glass({ f: hz(4, b), g: 0.05, d: 0.35, pan: 0.2 });
      glass({ f: hz(0, b), t: 0.09, g: 0.045, d: 0.4, pan: 0.4 });
    },

    /* ---- popups that fall from the top (Behance, CV, GitHub, Gallery) ----
       the CSS curve passes the resting spot at about 0.34 s, overshoots near 0.5 s and settles at 0.85 s */
    dropOpen: (v) => {
      const k = [0, 2, 3, 4][((v % 4) + 4) % 4] ?? 0; // every popup has its own colour, so it gets its own root note
      noise({ type: 'bandpass', f: 6000, to: 380, q: 0.9, a: 0.05, d: 0.29, g: 0.15, send: 0.25 });
      tone({ f: 900, to: 160, d: 0.32, g: 0.045, send: 0.2 });
      tone({ f: 170, to: 48, t: 0.34, d: 0.22, g: 0.28, send: 0.1 });
      noise({ type: 'lowpass', f: 900, to: 200, q: 0.7, t: 0.34, d: 0.12, g: 0.2, send: 0.1 });
      noise({ type: 'highpass', f: 3500, t: 0.34, d: 0.09, g: 0.1, send: 0.3 });
      glass({ f: hz(k, 60), t: 0.35, g: 0.12, d: 1.1, send: 0.6 });
      glass({ f: hz(k + 5, 60), t: 0.41, g: 0.06, d: 0.8, send: 0.6 });
      tone({ f: 120, to: 60, t: 0.56, d: 0.12, g: 0.07, send: 0.1 });
      glass({ f: hz(k + 2, 72), t: 0.6, g: 0.035, d: 0.5 });
      glass({ f: hz(k + 4, 72), t: 0.84, g: 0.02, d: 0.4 });
    },
    dropClose: (v) => {
      const k = [0, 2, 3, 4][((v % 4) + 4) % 4] ?? 0;
      tone({ f: 200, to: 140, d: 0.07, g: 0.05 });
      noise({ type: 'bandpass', f: 350, to: 6000, q: 0.9, a: 0.3, d: 0.25, g: 0.13, t: 0.04, send: 0.2 });
      tone({ f: 200, to: 1100, a: 0.2, d: 0.35, g: 0.04, t: 0.05, send: 0.2 });
      glass({ f: hz(k + 5, 72), t: 0.5, g: 0.035, d: 0.3 });
    },

    /* ---- Jom Connect card ---- */
    noticeOpen: () => {
      noise({ type: 'highpass', f: 5000, d: 0.015, g: 0.05, send: 0 });
      tone({ f: 70, to: 140, a: 0.15, d: 0.4, g: 0.12, send: 0.1 });
      noise({ type: 'bandpass', f: 400, to: 7000, q: 1, a: 0.25, d: 0.4, g: 0.12, send: 0.5 });
      [0, 2, 4, 7].forEach((n, k) => glass({ f: hz(n, 72), t: 0.22 + k * 0.045, g: 0.07, d: 1.2, send: 0.6, pan: -0.3 + k * 0.2 }));
    },
    noticeClose: () => {
      tone({ f: 440, to: 180, d: 0.18, g: 0.06 });
      noise({ type: 'bandpass', f: 4500, to: 400, q: 1, a: 0.05, d: 0.28, g: 0.09, send: 0.3 });
      glass({ f: hz(7, 72), g: 0.05, d: 0.4 });
      glass({ f: hz(2, 72), t: 0.1, g: 0.045, d: 0.5 });
    },

    /* ---- lightbox ---- */
    lightboxOpen: () => {
      noise({ type: 'bandpass', f: 900, to: 7000, q: 1.2, a: 0.08, d: 0.16, g: 0.09, send: 0.35 });
      tone({ f: 180, to: 420, a: 0.05, d: 0.14, g: 0.07 });
      glass({ f: hz(7, 72), t: 0.1, g: 0.08, d: 0.8, send: 0.5 });
      glass({ f: hz(9, 72), t: 0.17, g: 0.05, d: 0.7, send: 0.5 });
    },
    lightboxClose: () => {
      noise({ type: 'bandpass', f: 6000, to: 700, q: 1.2, a: 0.03, d: 0.16, g: 0.08, send: 0.3 });
      tone({ f: 400, to: 170, d: 0.12, g: 0.06 });
      glass({ f: hz(4, 72), t: 0.08, g: 0.05, d: 0.4 });
    },

    /* ---- status ---- */
    ready: () => {
      glass({ f: hz(7, 79), g: 0.05, d: 0.5 });
      glass({ f: hz(9, 79), t: 0.09, g: 0.05, d: 0.7 });
    },
    error: () => {
      tone({ f: 220, type: 'square', d: 0.09, g: 0.05, lp: 900 });
      tone({ f: 175, type: 'square', t: 0.11, d: 0.14, g: 0.05, lp: 800 });
    },

    /* ---- curtain preloader ---- */
    // soft tick while the speedometer counts: the pitch climbs with the number, like an engine revving
    curtainTick: (p) => {
      tone({ f: 640 + p * 9, type: 'triangle', d: 0.035, g: 0.04, lp: 4200, send: 0.12 });
      noise({ type: 'highpass', f: 5000, d: 0.01, g: 0.015, send: 0 });
    },
    // ENTER pressed: a power-up sweep as the gauge wakes
    curtainStart: () => {
      noise({ type: 'highpass', f: 4200, d: 0.014, g: 0.07, send: 0 });
      tone({ f: 200, to: 90, d: 0.12, g: 0.1, send: 0.1 });
      tone({ f: 180, to: 900, type: 'sawtooth', a: 0.05, d: 0.45, g: 0.04, lp: 2200, send: 0.3 });
      noise({ type: 'bandpass', f: 500, to: 6000, q: 1.1, a: 0.12, d: 0.4, g: 0.09, pan: -0.5, panTo: 0.5, send: 0.35 });
      [0, 2, 4].forEach((n, k) => glass({ f: hz(n, 76), t: 0.12 + k * 0.09, g: 0.06, d: 0.7, send: 0.5 }));
    },
    // the gauge hits 100
    curtainReady: () => {
      glass({ f: hz(7, 79), g: 0.06, d: 0.6 });
      glass({ f: hz(9, 79), t: 0.09, g: 0.06, d: 0.8 });
      glass({ f: hz(10, 79), t: 0.18, g: 0.05, d: 1.0, send: 0.5 });
    },
    // the two glass panels slide apart (CSS: 1.2 s), one air sweep per side, then a glass chord as the site is revealed
    curtainOpen: () => {
      tone({ f: 140, to: 60, d: 0.12, g: 0.14, send: 0.1 });
      noise({ type: 'highpass', f: 4000, d: 0.02, g: 0.06, send: 0.2 });
      noise({ type: 'bandpass', f: 300, to: 5200, q: 0.9, a: 0.35, d: 0.85, g: 0.13, pan: -0.2, panTo: -0.9, send: 0.35 });
      noise({ type: 'bandpass', f: 260, to: 4600, q: 0.9, a: 0.35, d: 0.85, g: 0.13, pan: 0.2, panTo: 0.9, send: 0.35 });
      tone({ f: 70, to: 190, a: 0.3, d: 0.9, g: 0.1, send: 0.2 });
      [0, 2, 4, 7, 9].forEach((n, k) => glass({ f: hz(n, 72), t: 0.35 + k * 0.08, g: 0.06, d: 1.1, pan: -0.6 + k * 0.3, send: 0.6 }));
      noise({ type: 'highpass', f: 5000, t: 1.15, d: 0.03, g: 0.05, send: 0.2 });
    },

    /* ---- chat ---- */
    chatSend: () => {
      tone({ f: 520, to: 980, type: 'triangle', d: 0.08, g: 0.06, lp: 4200, send: 0.2 });
      glass({ f: hz(7, 83), t: 0.05, g: 0.03, d: 0.18 });
    },
    chatReceive: () => {
      glass({ f: hz(5, 79), g: 0.05, d: 0.3 });
      glass({ f: hz(9, 79), t: 0.08, g: 0.045, d: 0.45 });
    },

    /* ---- the robot ---- */
    robotHappy: () => {
      const k = Math.floor(Math.random() * 5);
      [k, k + 2, k + (Math.random() > 0.5 ? 4 : 1)].forEach((n, j) => tone({ f: hz(n, 79), type: 'triangle', t: j * 0.075, d: 0.09, g: 0.08, lp: 4500, vib: [24, 18], send: 0.3 }));
    },
    robotWow: () => {
      tone({ f: 500, to: 1500, d: 0.2, g: 0.08, vib: [18, 25], send: 0.3 });
      glass({ f: hz(8, 79), t: 0.18, g: 0.04, d: 0.4 });
    },
    robotAngry: () => {
      [0, 0.16].forEach((t, k) => {
        tone({ f: 220 - k * 35, to: 150 - k * 25, type: 'sawtooth', t, d: 0.13, g: 0.07, lp: 800, vib: [30, 12], send: 0.1 });
        noise({ type: 'bandpass', f: 300, q: 2, t, d: 0.1, g: 0.05, send: 0.1 });
      });
    },
    robotCollapse: () => {
      tone({ f: 700, to: 45, type: 'sawtooth', a: 0.02, d: 1.0, g: 0.09, lp: 1500, vib: [14, 30], send: 0.2 });
      noise({ type: 'bandpass', f: 4000, to: 200, q: 1, d: 1.0, g: 0.06, send: 0.2 });
      for (let j = 0; j < 9; j += 1) {
        noise({ type: 'highpass', f: 2500 + Math.random() * 3000, t: 0.1 + j * 0.09 + Math.random() * 0.04, d: 0.02, g: 0.05 + Math.random() * 0.05, send: 0.1, pan: Math.random() * 1.2 - 0.6 });
      }
      tone({ f: 90, to: 40, t: 1.02, d: 0.2, g: 0.14, send: 0.1 });
    },
    robotReappear: () => {
      noise({ type: 'bandpass', f: 600, to: 5000, q: 1.5, a: 0.05, d: 0.25, g: 0.07, send: 0.3 });
      [0, 2, 4, 7].forEach((n, k) => tone({ f: hz(n, 72), type: 'triangle', t: k * 0.06, d: 0.12, g: 0.07, lp: 4500, send: 0.4 }));
      glass({ f: hz(9, 79), t: 0.24, g: 0.05, d: 0.5 });
      for (let j = 0; j < 5; j += 1) noise({ type: 'bandpass', f: 900 + Math.random() * 1800, q: 6, t: 0.05 + j * 0.03, d: 0.04, g: 0.05, send: 0.2, pan: Math.random() * 1.2 - 0.6 });
    },
  };

  const play = (name: string, i = 0) => {
    const now = performance.now();
    if (name.startsWith('hover')) { // fast mouse sweeps must not machine-gun
      if (now - lastHover < 32) return;
      lastHover = now;
    } else if (name === 'scrub') {
      if (now - lastScrub < 48) return;
      lastScrub = now;
    }
    if (!begin()) return;
    S[name]?.(i);
  };

  const PANELS: Record<SfxPanel, [string, number]> = {
    menu: ['menu', 0], info: ['panel', 0], widgets: ['panel', 1], drop: ['drop', -1], notice: ['notice', 0], lightbox: ['lightbox', 0],
  };

  return {
    play,
    bindUnlock,
    open: (kind: SfxPanel, variant = 0) => { const [name, v] = PANELS[kind]; play(`${name}Open`, v < 0 ? variant : v); },
    close: (kind: SfxPanel, variant = 0) => {
      if (kind === 'menu' && performance.now() < quietMenuUntil) return;
      const [name, v] = PANELS[kind];
      play(`${name}Close`, v < 0 ? variant : v);
    },
    // called when a menu item (or the Jom Connect button) closes the menu itself, so its own sound isn't doubled
    quietMenuClose: () => { quietMenuUntil = performance.now() + 250; },
    isEnabled: () => enabled,
    // Sound switch: off silences the interface sounds, the intro video, the robot's voice and gallery media (the music player has its own Music switch)
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    setEnabled: (value: boolean) => {
      enabled = value;
      try { window.localStorage.setItem(SFX_STORAGE_KEY, value ? 'on' : 'off'); } catch { /* storage blocked */ }
      if (value) {
        unlock();
      } else {
        if (graph) graph.c.suspend().catch(() => {}); // cut any sound that is still ringing out
        try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch { /* no speech engine */ }
      }
      listeners.forEach((fn) => fn());
    },
  };
})();

/* ---------- Sound wiring ----------
   One delegated listener gives every button, link, card and widget its hover / click / focus sound, so nothing can be missed
   (even things added later). Opening and closing of menus and popups is driven by their state, so Esc, outside click,
   the close button and switching between popups all sound right without any extra code.
   Per-element overrides: data-sfx="none" (silent, a state effect owns it) or data-sfx="play|pause|prev|next|toggleOn|toggleOff|retry|nav".
   For toggles the value describes what the click does, e.g. shuffle off -> data-sfx="toggleOn". */
const HOVER_SEL = 'button, a[href], input[type="range"], .metric-card, .gh-card';
const CLICK_SEL = 'button, a[href], input[type="range"], .metric-card';

function useUiSounds(rootRef: { readonly current: HTMLElement | null }) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const unbind = sfx.bindUnlock();
    const isDisabled = (el: Element) => (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';
    const nth = (selector: string, el: Element) => Array.prototype.indexOf.call(root.querySelectorAll(selector), el) as number;
    let lastEl: Element | null = null;

    const hoverFor = (el: Element) => {
      if (isDisabled(el) || el.classList.contains('player-card')) return; // the player's own buttons make the sound, not its frame
      if (el.matches('#nav-items button')) { sfx.play('hover', nth('#nav-items button', el) * 2); return; }
      if (el.classList.contains('start-btn')) { sfx.play('hoverTech'); return; }
      const card = ['gal-item', 'gh-card', 'case-card'].find((name) => el.classList.contains(name));
      if (card) { sfx.play('hoverCard', nth(`.${card}`, el) % 10); return; } // moving across a grid plays a little melody
      if (el.classList.contains('conn-social')) { sfx.play('hover', nth('.conn-social', el) * 2 + 1); return; }
      if (el.classList.contains('metric-card')) { sfx.play('hoverWidget', nth('.metric-card', el)); return; } // each widget has its own note
      sfx.play('hover', 3);
    };

    const onOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const el = (event.target as Element | null)?.closest?.(HOVER_SEL) ?? null;
      if (el === lastEl) return;
      lastEl = el;
      if (el) hoverFor(el);
    };
    const onLeave = () => { lastEl = null; };

    const onFocus = (event: FocusEvent) => { // keyboard users get the same hover tick when they Tab onto something
      const el = (event.target as Element | null)?.closest?.(HOVER_SEL);
      if (!el) return;
      let visible = false;
      try { visible = el.matches(':focus-visible'); } catch { visible = false; }
      if (visible) { lastEl = el; hoverFor(el); }
    };

    const onClick = (event: MouseEvent) => {
      const el = (event.target as Element | null)?.closest?.(CLICK_SEL) as HTMLElement | null;
      if (!el || isDisabled(el) || el.classList.contains('player-card')) return;
      const tag = el.dataset.sfx;
      if (tag === 'none') return;
      if (el.matches('.case-close, .conn-close') && !el.hasAttribute('download')) return; // the popup's close sound covers these
      if (tag) { sfx.play(tag, tag === 'nav' ? nth('#nav-items button', el) : 0); return; }
      if (el.matches('input[type="range"]')) return; // the seek bar scrubs instead
      if (el.classList.contains('metric-card')) { sfx.play('widgetTap', nth('.metric-card', el)); return; }
      if (el.matches('a[href]')) {
        const href = el.getAttribute('href') ?? '';
        if (el.hasAttribute('download')) sfx.play('download');
        else if (href.startsWith('mailto:')) sfx.play('mail');
        else if (el.getAttribute('target') === '_blank') sfx.play('linkOut');
        else sfx.play('click');
        return;
      }
      sfx.play('click');
    };

    root.addEventListener('pointerover', onOver, { passive: true });
    root.addEventListener('pointerleave', onLeave, { passive: true });
    root.addEventListener('focusin', onFocus);
    root.addEventListener('click', onClick, true);
    return () => {
      unbind();
      root.removeEventListener('pointerover', onOver);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('focusin', onFocus);
      root.removeEventListener('click', onClick, true);
    };
  }, [rootRef]);
}

// true while sound is on; re-renders the component whenever the master Sound switch flips
function useSoundEnabled() {
  return useSyncExternalStore(sfx.subscribe, sfx.isEnabled, () => true);
}

// Music switch: mutes the music player only. (The Sound switch above only controls the interface click / hover sounds.)
const MUSIC_STORAGE_KEY = 'music-enabled';
const music = (() => {
  let enabled = true;
  const listeners = new Set<() => void>();
  try {
    if (typeof window !== 'undefined') enabled = window.localStorage.getItem(MUSIC_STORAGE_KEY) !== 'off';
  } catch { /* storage blocked: music stays on */ }
  return {
    isEnabled: () => enabled,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    setEnabled: (value: boolean) => {
      enabled = value;
      try { window.localStorage.setItem(MUSIC_STORAGE_KEY, value ? 'on' : 'off'); } catch { /* storage blocked */ }
      listeners.forEach((fn) => fn());
    },
  };
})();

function useMusicEnabled() {
  return useSyncExternalStore(music.subscribe, music.isEnabled, () => true);
}

// plays the open / close sound whenever a menu, panel or popup changes state (never on first render)
function useOpenSfx(open: boolean, kind: SfxPanel, variant = 0) {
  const prev = useRef(open);
  useEffect(() => {
    if (prev.current === open) return;
    prev.current = open;
    if (open) sfx.open(kind, variant); else sfx.close(kind, variant);
  }, [open, kind, variant]);
}

// a soft chime when content finishes loading, a low double buzz when it fails
function useStatusSfx(state: 'idle' | 'loading' | 'ready' | 'error') {
  const prev = useRef(state);
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (state === 'ready' && before === 'loading') sfx.play('ready');
    if (state === 'error' && before !== 'error') sfx.play('error');
  }, [state]);
}

type BehanceProject = {
  id: number;
  name: string;
  url: string;
  covers: Record<string, string>;
  stats: { views: number; appreciations: number };
};

// Behance v2 only answers JSONP (same as the old $.getJSON(...&callback=?) call)
function fetchBehanceProjects(): Promise<BehanceProject[]> {
  return new Promise((resolve, reject) => {
    const cb = `__behance_cb_${Date.now()}`;
    const bag = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    const cleanup = () => {
      window.clearTimeout(timer);
      delete bag[cb];
      script.remove();
    };
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 15000);
    bag[cb] = (data: { projects?: BehanceProject[] }) => { cleanup(); resolve(data.projects ?? []); };
    script.onerror = () => { cleanup(); reject(new Error('network')); };
    script.src = `https://www.behance.net/v2/users/${BEHANCE_USER}/projects?api_key=${BEHANCE_KEY}&callback=${cb}`;
    document.body.appendChild(script);
  });
}

type IconProps = { size?: number | string; strokeWidth?: number | string; className?: string };

function InstagramIcon({ size = 22, className = '' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true" fill="currentColor">
      <path d="M11 0H5a5 5 0 0 0-5 5v6a5 5 0 0 0 5 5h6a5 5 0 0 0 5-5V5a5 5 0 0 0-5-5zm3.5 11c0 1.93-1.57 3.5-3.5 3.5H5c-1.93 0-3.5-1.57-3.5-3.5V5c0-1.93 1.57-3.5 3.5-3.5h6c1.93 0 3.5 1.57 3.5 3.5v6z" />
      <path d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 6.5A2.503 2.503 0 0 1 5.5 8c0-1.379 1.122-2.5 2.5-2.5s2.5 1.121 2.5 2.5c0 1.378-1.122 2.5-2.5 2.5z" />
      <circle cx="12.3" cy="3.7" r=".533" />
    </svg>
  );
}

function FacebookIcon({ size = 22, className = '' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144.083 144" width={size} height={size} className={className} aria-hidden="true" fill="currentColor">
      <path d="M72.041 11.166c-33.543 0-60.833 27.29-60.833 60.834 0 33.545 27.29 60.834 60.833 60.834 33.544 0 60.835-27.289 60.835-60.834-.001-33.544-27.292-60.834-60.835-60.834zm0 115.668c-30.235 0-54.833-24.598-54.833-54.834 0-30.235 24.598-54.834 54.833-54.834S126.876 41.765 126.876 72c-.001 30.236-24.6 54.834-54.835 54.834z" />
      <path d="M90.792 36.304H77.596a.877.877 0 0 0-.09.004c-13.323.042-15.063 9.345-15.07 17.476a1.014 1.014 0 0 0-.028.235v5.708H53.29a1 1 0 0 0-1 1v14.077a1 1 0 0 0 1 1h9.118v30.891a1 1 0 0 0 1 1h13.307a1 1 0 0 0 1-1v-30.89h13.076a1 1 0 0 0 1-1V60.728a1 1 0 0 0-1-1H76.715v-7.567h14.076a1 1 0 0 0 1-1V37.304a.999.999 0 0 0-.999-1z" />
    </svg>
  );
}

function WhatsappIcon({ size = 22, className = '' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width={size} height={size} className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeMiterlimit="10">
      <path d="M8.002.5h-.004C3.863.5.5 3.864.5 8c0 1.64.529 3.161 1.428 4.396l-.935 2.787 2.883-.921A7.448 7.448 0 0 0 8.002 15.5c4.135 0 7.498-3.364 7.498-7.5S12.137.5 8.002.5z" />
      <path d="M12.175 10.931c-.172.484-.858.884-1.405 1.001-.374.079-.862.142-2.507-.534-2.103-.863-3.457-2.982-3.562-3.119-.1-.138-.849-1.122-.849-2.139 0-1.017.522-1.514.732-1.726.172-.175.458-.254.732-.254.088 0 .168.004.24.008.21.008.315.021.454.35.172.413.593 1.43.643 1.534.05.104.101.246.029.384-.067.142-.126.204-.231.325-.105.121-.206.213-.311.342-.097.113-.206.234-.084.442.122.204.542.884 1.161 1.43.799.705 1.447.93 1.678 1.026.172.071.378.054.505-.079.16-.171.358-.454.559-.734.143-.2.324-.225.513-.154.193.067 1.215.567 1.426.671.21.104.349.154.4.242.049.087.049.5-.123.984z" />
    </svg>
  );
}

function EmailIcon({ size = 22, className = '' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M2.25 7C2.25 4.37665 4.37665 2.25 7 2.25H17C19.6234 2.25 21.75 4.37665 21.75 7V17C21.75 19.6234 19.6234 21.75 17 21.75H7C4.37665 21.75 2.25 19.6234 2.25 17V7ZM7 3.75C5.20507 3.75 3.75 5.20507 3.75 7V17C3.75 18.7949 5.20507 20.25 7 20.25H17C18.7949 20.25 20.25 18.7949 20.25 17V7C20.25 5.20507 18.7949 3.75 17 3.75H7Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M6.25 12C6.25 8.82412 8.82412 6.25 12 6.25C15.1759 6.25 17.75 8.82412 17.75 12V12.8333C17.75 14.0148 16.7925 14.9722 15.6111 14.9722C14.9573 14.9722 14.3721 14.679 13.9798 14.2169C13.4541 14.6866 12.7604 14.9722 12 14.9722C10.3586 14.9722 9.02778 13.6414 9.02778 12C9.02778 10.3586 10.3586 9.02778 12 9.02778C13.6414 9.02778 14.9722 10.3586 14.9722 12V12.8333C14.9722 13.1863 15.2581 13.4722 15.6111 13.4722C15.9641 13.4722 16.25 13.1863 16.25 12.8333V12C16.25 9.65255 14.3475 7.75 12 7.75C9.65255 7.75 7.75 9.65255 7.75 12C7.75 14.3475 9.65255 16.25 12 16.25C12.543 16.25 13.094 16.1471 13.6262 15.9266C13.9099 15.809 14.1751 15.6603 14.4234 15.4876C14.7634 15.2511 15.2308 15.335 15.4674 15.6751C15.7039 16.0151 15.62 16.4825 15.2799 16.719C14.9516 16.9474 14.5924 17.1499 14.2005 17.3123C13.4805 17.6106 12.7337 17.75 12 17.75C8.82412 17.75 6.25 15.1759 6.25 12ZM13.4722 12C13.4722 11.187 12.813 10.5278 12 10.5278C11.187 10.5278 10.5278 11.187 10.5278 12C10.5278 12.813 11.187 13.4722 12 13.4722C12.813 13.4722 13.4722 12.813 13.4722 12Z" />
    </svg>
  );
}

/* ---------- Gallery (photos + videos) ----------
   Add an entry with any of these links:
   photos: .gif .jpg .jpeg .png .webp
   videos: YouTube, Vimeo, .mp4 (also .webm/.mov; .avi is accepted but most browsers can't play it) */
type MediaKind = 'image' | 'youtube' | 'vimeo' | 'video';
type MediaInfo = { kind: MediaKind; thumb?: string; embed?: string };

function parseMedia(src: string): MediaInfo {
  const url = src.trim();
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (yt) return { kind: 'youtube', thumb: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`, embed: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0` };
  const vm = url.match(/vimeo\.com\/(?:video\/|channels\/[\w-]+\/|groups\/[\w-]+\/videos\/)?(\d+)/i);
  if (vm) return { kind: 'vimeo', thumb: `https://vumbnail.com/${vm[1]}.jpg`, embed: `https://player.vimeo.com/video/${vm[1]}?autoplay=1` };
  if (/\.(mp4|avi|webm|mov|m4v|ogv)(\?|#|$)/i.test(url)) return { kind: 'video' };
  return { kind: 'image' };
}

const GALLERY_SOURCES: { src: string; title: string }[] = [
  { src: 'https://picsum.photos/id/1015/900/700.jpg', title: 'River valley' },
  { src: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', title: 'Big Buck Bunny (YouTube)' },
  { src: 'https://picsum.photos/id/1018/900/700.webp', title: 'Mountain mist' },
  { src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', title: 'Flower (MP4)' },
  { src: 'https://picsum.photos/id/1025/900/700.jpg', title: 'Pug portrait' },
  { src: 'https://vimeo.com/76979871', title: 'Vimeo player demo' },
  { src: 'https://picsum.photos/id/1035/900/700.jpg', title: 'Waterfall' },
  { src: 'https://picsum.photos/id/1020/900/700.webp', title: 'Brown bear' },
  { src: 'https://picsum.photos/id/1043/900/700.jpg', title: 'Forest road' },
  { src: 'https://youtu.be/YE7VzlLtp-4', title: 'Big Buck Bunny (short link)' },
];
const GALLERY = GALLERY_SOURCES.map((item) => ({ ...item, media: parseMedia(item.src) }));
type GalleryEntry = (typeof GALLERY)[number];

function GalleryThumb({ item }: { item: GalleryEntry }) {
  const [failed, setFailed] = useState(false);
  const { media } = item;
  return (
    <>
      {media.kind === 'video' ? (
        failed ? <span className="gal-ph" aria-hidden="true" /> : <video src={`${item.src}#t=0.5`} muted playsInline preload="metadata" onError={() => setFailed(true)} />
      ) : (
        <img src={media.thumb ?? item.src} alt="" loading="lazy" draggable={false} />
      )}
      <span className="gal-badge">{media.kind === 'image' ? 'Photo' : 'Video'}</span>
      {media.kind !== 'image' && <span className="gal-play" aria-hidden="true"><Play size={16} fill="currentColor" strokeWidth={0} /></span>}
      <span className="gal-cap">{item.title}</span>
    </>
  );
}

function LightboxMedia({ item }: { item: GalleryEntry }) {
  const [failed, setFailed] = useState(false);
  const soundOn = useSoundEnabled();
  const videoEl = useRef<HTMLVideoElement>(null);
  const [mutedAtOpen] = useState(() => !sfx.isEnabled()); // embeds can't be muted from outside, so they start muted when Sound is off
  useEffect(() => {
    if (videoEl.current) videoEl.current.muted = !soundOn;
  }, [soundOn, failed]);
  const { media } = item;
  if (media.kind === 'youtube' || media.kind === 'vimeo') {
    const embed = mutedAtOpen ? `${media.embed}&${media.kind === 'youtube' ? 'mute=1' : 'muted=1'}` : media.embed;
    return <iframe className="lb-frame" src={embed} title={item.title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen />;
  }
  if (media.kind === 'video') {
    return failed ? (
      <div className="lb-fail">
        This browser can't play this video file (AVI is rarely supported).{' '}
        <a href={item.src} target="_blank" rel="noopener noreferrer">Open or download it</a>
      </div>
    ) : (
      <video ref={videoEl} className="lb-media" src={item.src} controls autoPlay playsInline muted={!soundOn} onError={() => setFailed(true)} />
    );
  }
  return <img className="lb-media" src={item.src} alt={item.title} draggable={false} />;
}

const CONTACTS: { name: string; href: string; Icon: typeof InstagramIcon; external: boolean }[] = [
  { name: 'Instagram', href: 'https://www.instagram.com/sureshksmy', Icon: InstagramIcon, external: true },
  { name: 'Facebook', href: 'https://www.facebook.com/mesurreshks', Icon: FacebookIcon, external: true },
  { name: 'WhatsApp', href: 'https://wa.me/60104368680', Icon: WhatsappIcon, external: true },
  { name: 'Email', href: 'mailto:hello@suresh.app', Icon: EmailIcon, external: false },
];

/* Each repo has its own `image` line below. Right now they all use the same placeholder (GITHUB.png).
   When you have the 24 pictures, replace the URL on each repo's `image:` with its own, e.g.
   image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/github/shadcn.png'
   If a custom image fails to load, the card shows the placeholder, then GitHub's preview. */
const GITHUB_IMAGE = 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png';
type Repo = { slug: string; title: string; description: string; tech: string[]; live: string; image: string };
const GITHUB_PREVIEW = (slug: string) => `https://opengraph.githubassets.com/1/${slug}`;
const REPOS: Repo[] = [
  { slug: 'sureshapps/The-Sun-Malaysia', title: 'The Sun Malaysia', description: 'A redesign of The Sun Malaysia news portal: a responsive single-page app with headlines, categories, search and infinite-scroll Latest, powered by WordPress.', tech: ['React', 'Vite', 'WordPress'], live: 'https://thesunmy.vercel.app', image: 'https://singleks.vercel.app/1.png' },
  { slug: 'sureshapps/fastermy', title: 'FasterNET', description: 'A small, dependency-free internet speed test that measures latency, download and upload speed using Cloudflare speed test endpoints.', tech: ['HTML', 'CSS', 'JavaScript'], live: 'https://fastermy.vercel.app', image: 'https://singleks.vercel.app/2.png' },
  { slug: 'sureshapps/Skyra', title: 'Skyra', description: 'A live weather app for Malaysia and worldwide with hourly and 7-day outlooks, rain, wind, UV, air quality, city search and GPS.', tech: ['Next.js', 'TypeScript', 'Open-Meteo'], live: 'https://skyra-rouge.vercel.app', image: 'https://singleks.vercel.app/3.png' },
  { slug: 'sureshapps/LiveGPS', title: 'LiveGPS', description: 'A lightweight installable web app for checking your current GPS location.', tech: ['PWA', 'GPS', 'HTML'], live: 'https://github.com/sureshapps/LiveGPS', image: 'https://singleks.vercel.app/4.png' },
  { slug: 'mrdoob/three.js', title: 'Three.js', description: 'A JavaScript 3D library that makes it easier to create animated scenes.', tech: ['WebGL', 'JavaScript', '3D'], live: 'https://threejs.org', image: 'https://singleks.vercel.app/5.png' },
  { slug: 'honojs/hono', title: 'Hono', description: 'A small, simple, and ultrafast web framework for the edge.', tech: ['TypeScript', 'Edge', 'Web APIs'], live: 'https://hono.dev', image: 'https://singleks.vercel.app/6.png' },
  { slug: 'drizzle-team/drizzle-orm', title: 'Drizzle ORM', description: 'A lightweight TypeScript ORM with a SQL-like developer experience.', tech: ['TypeScript', 'SQL', 'ORM'], live: 'https://orm.drizzle.team', image: 'https://singleks.vercel.app/7.png' },
  { slug: 'trpc/trpc', title: 'tRPC', description: 'End-to-end typesafe APIs made easy for TypeScript applications.', tech: ['TypeScript', 'RPC', 'React'], live: 'https://trpc.io', image: 'https://singleks.vercel.app/8.png' },
  { slug: 'colinhacks/zod', title: 'Zod', description: 'TypeScript-first schema validation with static type inference.', tech: ['TypeScript', 'Validation', 'Schemas'], live: 'https://zod.dev', image: 'https://singleks.vercel.app/9.png' },
  { slug: 'tailwindlabs/tailwindcss', title: 'Tailwind CSS', description: 'A utility-first CSS framework for rapidly building custom interfaces.', tech: ['CSS', 'PostCSS', 'Design'], live: 'https://tailwindcss.com', image: 'https://singleks.vercel.app/10.png' },
  { slug: 'supabase/supabase', title: 'Supabase', description: 'An open source Firebase alternative built around PostgreSQL.', tech: ['PostgreSQL', 'Auth', 'Realtime'], live: 'https://supabase.com', image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png' },
  { slug: 'react-hook-form/react-hook-form', title: 'React Hook Form', description: 'Performant and flexible forms library for React applications.', tech: ['React', 'Forms', 'TypeScript'], live: 'https://react-hook-form.com', image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png' },
  { slug: 'TanStack/query', title: 'TanStack Query', description: 'Powerful asynchronous state management for web applications.', tech: ['React', 'Caching', 'State'], live: 'https://tanstack.com/query', image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png' },
  { slug: 'lucide-icons/lucide', title: 'Lucide', description: 'Beautiful and consistent open source icons for modern products.', tech: ['SVG', 'Icons', 'React'], live: 'https://lucide.dev', image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png' },
  { slug: 'motiondivision/motion', title: 'Motion', description: 'A production-ready animation library for React and the web.', tech: ['React', 'Animation', 'UI'], live: 'https://motion.dev', image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png' },
  { slug: 'pmndrs/zustand', title: 'Zustand', description: 'A small, fast, and scalable state management solution for React.', tech: ['React', 'State', 'Hooks'], live: 'https://zustand.docs.pmnd.rs', image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png' },
  { slug: 'saadeghi/daisyui', title: 'daisyUI', description: 'Tailwind CSS component classes for building interfaces faster.', tech: ['Tailwind', 'CSS', 'Components'], live: 'https://daisyui.com', image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png' },
  { slug: 'microsoft/playwright', title: 'Playwright', description: 'Reliable end-to-end testing for modern web applications.', tech: ['Testing', 'Browser', 'Automation'], live: 'https://playwright.dev', image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png' },
  { slug: 'storybookjs/storybook', title: 'Storybook', description: 'Build, test, and document UI components in isolation.', tech: ['React', 'Testing', 'Components'], live: 'https://storybook.js.org', image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png' },
  { slug: 'eslint/eslint', title: 'ESLint', description: 'Find and fix problems in JavaScript and TypeScript code.', tech: ['JavaScript', 'Linting', 'Tooling'], live: 'https://eslint.org', image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png' },
  { slug: 'prettier/prettier', title: 'Prettier', description: 'An opinionated code formatter that keeps projects consistent.', tech: ['Formatting', 'JavaScript', 'DX'], live: 'https://prettier.io', image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png' },
  { slug: 'fastapi/fastapi', title: 'FastAPI', description: 'A modern, fast web framework for building APIs with Python.', tech: ['Python', 'API', 'Async'], live: 'https://fastapi.tiangolo.com', image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png' },
  { slug: 'pandas-dev/pandas', title: 'Pandas', description: 'Powerful data structures and analysis tools for Python.', tech: ['Python', 'Data', 'Analytics'], live: 'https://pandas.pydata.org', image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png' },
  { slug: 'opencv/opencv', title: 'OpenCV', description: 'Open source computer vision and machine learning software library.', tech: ['C++', 'Python', 'Computer Vision'], live: 'https://opencv.org', image: 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/GITHUB.png' },
];

const NAV_ITEMS: { label: string; Icon: LucideIcon }[] = [
  { label: 'Case Records', Icon: Briefcase },
  { label: 'CV', Icon: FileText },
  { label: 'GitHub', Icon: Code2 },
  { label: 'Gallery', Icon: Images },
];
const STATS = [
  { radius: 330, start: -92, end: 16, dot: -49 },
  { radius: 395, start: -56, end: 60, dot: 2 },
  { radius: 460, start: -14, end: 72, dot: 44 },
];

const STAR = 'M 0 -6 Q 0.8 -0.8 6 0 Q 0.8 0.8 0 6 Q -0.8 0.8 -6 0 Q -0.8 -0.8 0 -6 Z';

function polar(radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return { x: -110 + radius * Math.cos(radians), y: 300 + radius * Math.sin(radians) };
}

function Statistics() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-50 hidden sm:block" aria-hidden="true">
      <svg viewBox="0 0 380 700" preserveAspectRatio="xMaxYMid meet" className="h-full w-auto">
        <style>{`
          .star { transform-box: fill-box; transform-origin: center; opacity: 0; animation: star-twinkle 2.6s ease-in-out infinite backwards; filter: drop-shadow(0 0 3px rgba(255,255,255,0.9)); }
          .star-small { animation-duration: 3.2s; }
          @keyframes star-twinkle {
            0%, 100% { opacity: 0.25; transform: scale(0.55) rotate(0deg); }
            50% { opacity: 1; transform: scale(1.15) rotate(45deg); }
          }
          @media (prefers-reduced-motion: reduce) { .star { animation: none; opacity: 0.9; } }
        `}</style>
        <defs>
          {STATS.map((stat, index) => {
            const start = polar(stat.radius, stat.start);
            const end = polar(stat.radius, stat.end);
            return (
              <linearGradient key={index} id={`arc-gradient-${index}`} gradientUnits="userSpaceOnUse" x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
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
            <g key={index}>
              <path
                d={`M ${start.x} ${start.y} A ${stat.radius} ${stat.radius} 0 0 1 ${end.x} ${end.y}`}
                fill="none"
                stroke={`url(#arc-gradient-${index})`}
                strokeWidth="1.1"
                className="arc-line"
                style={{ '--len': length, animationDelay: `${lineDelay}s` } as CSSProperties}
              />
              <g transform={`translate(${dot.x} ${dot.y})`}>
                <path d={STAR} fill="white" className="star star-main" style={{ animationDelay: `${markDelay}s` }} />
                <g transform="translate(9 -8) scale(0.5)"><path d={STAR} fill="white" className="star star-small" style={{ animationDelay: `${markDelay + 0.5}s` }} /></g>
                <g transform="translate(-8 8) scale(0.38)"><path d={STAR} fill="white" className="star star-small" style={{ animationDelay: `${markDelay + 1.1}s` }} /></g>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const SPEED_POINTS = [30, 42, 36, 55, 48, 66, 58, 76, 70, 90];
const EXPERIENCE_BARS = [28, 36, 32, 44, 40, 54, 50, 66, 74, 90];

function smoothPath(points: [number, number][]) {
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const mx = (x0 + x1) / 2;
    d += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
  }
  return d;
}

function RingPill({ id, value, label, from, to }: { id: string; value: number; label: string; from: string; to: string }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <div className="glass metric-card metric-pill" style={{ '--r': '9999px' } as CSSProperties} role="img" aria-label={`${label} ${value} percent`}>
      <span className="fx-layer" aria-hidden="true" />
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className="shrink-0 -rotate-90" style={{ filter: `drop-shadow(0 0 3px ${to}) drop-shadow(0 0 9px ${to})` }}>
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="5" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={`url(#ring-${id})`} strokeWidth="5" strokeLinecap="round" className="ring-fill" style={{ '--c': c, '--off': c * (1 - value / 100), strokeDasharray: c } as CSSProperties} />
      </svg>
      <div>
        <p className="metric-value">{value}%</p>
        <p className="metric-label mt-1">{label}</p>
      </div>
    </div>
  );
}

function SpeedCard() {
  const W = 130;
  const H = 42;
  const pts = SPEED_POINTS.map((v, i) => [i * (W / (SPEED_POINTS.length - 1)), H - 4 - (v / 100) * (H - 10)] as [number, number]);
  const line = smoothPath(pts);
  return (
    <div className="glass metric-card metric-box" style={{ '--r': '18px' } as CSSProperties} role="img" aria-label="Working speed graph">
      <span className="fx-layer" aria-hidden="true" />
      <p className="metric-label">Working Speed Graph</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="speed-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b6ff2e" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#b6ff2e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill="url(#speed-fill)" className="chart-area" />
        <path d={line} pathLength={1} fill="none" stroke="#b6ff2e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="chart-line" style={{ filter: 'drop-shadow(0 0 2px #b6ff2e) drop-shadow(0 0 6px rgba(182,255,46,0.95))' }} />
        {pts.filter((_, i) => i % 3 === 1 || i === pts.length - 1).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.4" fill="#fff" className="chart-area" style={{ filter: 'drop-shadow(0 0 3px #b6ff2e)' }} />
        ))}
      </svg>
    </div>
  );
}

function ExperienceCard() {
  return (
    <div className="glass metric-card metric-box" style={{ '--r': '18px' } as CSSProperties} role="img" aria-label="16 plus years of experience">
      <span className="fx-layer" aria-hidden="true" />
      <p className="metric-label">Years of experience</p>
      <p className="metric-value metric-value-lg mt-1">16+</p>
      <div className="mt-1.5 flex h-5 items-end gap-[3px] lg:mt-2 lg:h-8" aria-hidden="true">
        {EXPERIENCE_BARS.map((h, i) => (
          <span key={i} className="chart-bar flex-1 rounded-[2px]" style={{ height: `${h}%`, background: i % 3 === 1 ? '#ff8a1f' : '#fff', boxShadow: i % 3 === 1 ? '0 0 4px #ff8a1f, 0 0 10px rgba(255,122,26,0.9)' : '0 0 5px rgba(255,255,255,0.55)', animationDelay: `${1.4 + i * 0.07}s` }} />
        ))}
      </div>
    </div>
  );
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

const hBar = (y: number) => `M 4.5 ${y} L 6 ${y - 1.5} L 14 ${y - 1.5} L 15.5 ${y} L 14 ${y + 1.5} L 6 ${y + 1.5} Z`;
const vBar = (x: number, y0: number, y1: number) => `M ${x} ${y0} L ${x + 1.5} ${y0 + 1.5} L ${x + 1.5} ${y1 - 1.5} L ${x} ${y1} L ${x - 1.5} ${y1 - 1.5} L ${x - 1.5} ${y0 + 1.5} Z`;
const SEGMENTS: Record<string, string> = {
  a: hBar(2), b: vBar(17, 3.5, 15.5), c: vBar(17, 18.5, 30.5), d: hBar(32), e: vBar(3, 18.5, 30.5), f: vBar(3, 3.5, 15.5), g: hBar(17),
};
const DIGIT_SEGMENTS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
};

function SevenSeg({ digit }: { digit: string | null }) {
  const lit = digit ? DIGIT_SEGMENTS[digit] : '';
  return (
    <svg viewBox="0 0 20 34" className="seg-digit" aria-hidden="true">
      {Object.keys(SEGMENTS).map((key) => (
        <path key={key} d={SEGMENTS[key]} className={lit.includes(key) ? 'seg-on' : 'seg-off'} />
      ))}
    </svg>
  );
}

function ClockCard() {
  const now = useNow(1000);
  const hours = String(now.getHours() % 12 || 12);
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const label = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const isAm = now.getHours() < 12;
  return (
    <div className="glass metric-card info-card clock-card info-extra" style={{ '--r': '14px' } as CSSProperties} role="img" aria-label={`Time ${label}`}>
      <span className="fx-layer" aria-hidden="true" />
      <SevenSeg digit={hours.length > 1 ? hours[0] : null} />
      <SevenSeg digit={hours[hours.length - 1]} />
      <span className="clock-colon" aria-hidden="true"><i /><i /></span>
      <SevenSeg digit={minutes[0]} />
      <SevenSeg digit={minutes[1]} />
      <span className="clock-colon" aria-hidden="true"><i /><i /></span>
      <SevenSeg digit={seconds[0]} />
      <SevenSeg digit={seconds[1]} />
      <span className="clock-ampm" aria-hidden="true">
        <b className={isAm ? 'is-on' : ''}>AM</b>
        <b className={isAm ? '' : 'is-on'}>PM</b>
      </span>
    </div>
  );
}

function CalendarCard() {
  const now = useNow(60000);
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  const cells = [...Array<number>(lead).fill(0), ...Array.from({ length: total }, (_, i) => i + 1)];
  return (
    <div className="glass metric-card info-card cal-card" style={{ '--r': '14px' } as CSSProperties} role="img" aria-label={`Calendar, ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}>
      <span className="fx-layer" aria-hidden="true" />
      <p className="cal-title">{now.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()}</p>
      <div className="cal-grid" aria-hidden="true">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => <span key={i} className="cal-head">{day}</span>)}
        {cells.map((day, i) => day === 0
          ? <span key={`blank-${i}`} />
          : <span key={day} className={`cal-day${i % 7 > 4 ? ' cal-weekend' : ''}${day === today ? ' cal-today' : ''}`}>{day}</span>)}
      </div>
    </div>
  );
}

type DayForecast = { name: string; min: number; max: number; code: number };
type Weather = { temp: number; code: number; high: number; low: number; days: DayForecast[] };

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=3.139&longitude=101.6869&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FKuala_Lumpur&forecast_days=3';

function weekday(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

// shown until the live forecast arrives (or if it can't be fetched)
const WEATHER_FALLBACK: Weather = {
  temp: 27, code: 2, high: 32, low: 24,
  days: [{ name: weekday(1), min: 25, max: 33, code: 0 }, { name: weekday(2), min: 24, max: 32, code: 0 }],
};

function weatherInfo(code: number): { label: string; Icon: LucideIcon } {
  if (code === 0) return { label: 'Clear', Icon: Sun };
  if (code === 1) return { label: 'Mostly Clear', Icon: CloudSun };
  if (code === 2) return { label: 'Partly Cloudy', Icon: CloudSun };
  if (code === 3) return { label: 'Overcast', Icon: Cloud };
  if (code === 45 || code === 48) return { label: 'Foggy', Icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', Icon: CloudRain };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: 'Rain', Icon: CloudRain };
  if (code >= 95) return { label: 'Thunderstorm', Icon: CloudLightning };
  return { label: 'Cloudy', Icon: Cloud };
}

const barPct = (temp: number) => Math.min(100, Math.max(0, ((temp - 20) / 16) * 100));

function WeatherCard() {
  const [wx, setWx] = useState<Weather>(WEATHER_FALLBACK);

  useEffect(() => {
    const controller = new AbortController();
    fetch(WEATHER_URL, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        const daily = data.daily;
        setWx({
          temp: Math.round(data.current.temperature_2m),
          code: data.current.weather_code,
          high: Math.round(daily.temperature_2m_max[0]),
          low: Math.round(daily.temperature_2m_min[0]),
          days: [1, 2].map((i) => ({
            name: new Date(`${daily.time[i]}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
            min: Math.round(daily.temperature_2m_min[i]),
            max: Math.round(daily.temperature_2m_max[i]),
            code: daily.weather_code[i],
          })),
        });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const { label, Icon } = weatherInfo(wx.code);
  return (
    <div className="glass metric-card info-card wx-card" style={{ '--r': '14px' } as CSSProperties} role="img" aria-label={`Kuala Lumpur, ${wx.temp} degrees, ${label}`}>
      <span className="fx-layer" aria-hidden="true" />
      <div className="wx-top">
        <div>
          <p className="wx-city">Kuala Lumpur</p>
          <p className="wx-temp">{wx.temp}°</p>
        </div>
        <div className="wx-now">
          <Icon size="1.8em" strokeWidth={1.5} />
          <p>{label}</p>
          <p>H:{wx.high}° L:{wx.low}°</p>
        </div>
      </div>
      <div className="wx-days">
        {wx.days.map((day) => {
          const DayIcon = weatherInfo(day.code).Icon;
          const left = Math.min(barPct(day.min), 85);
          return (
            <div key={day.name} className="wx-day">
              <span>{day.name}</span>
              <DayIcon size="1.3em" strokeWidth={1.6} />
              <span className="wx-min">{day.min}°</span>
              <span className="wx-bar"><i style={{ left: `${left}%`, width: `${Math.max(barPct(day.max) - left, 15)}%` }} /></span>
              <span>{day.max}°</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}


type Song = { title: string; artist?: string; cover?: string; src: string };

// songs are managed in /public/songs.js (window.MUSIC_PLAYLIST), so you can edit the playlist without rebuilding
function usePlaylist() {
  const [songs, setSongs] = useState<Song[]>([]);
  useEffect(() => {
    const read = () => {
      const list = (window as unknown as { MUSIC_PLAYLIST?: Song[] }).MUSIC_PLAYLIST;
      if (Array.isArray(list)) setSongs(list.filter((song) => song && song.src));
    };
    read();
    if ((window as unknown as { MUSIC_PLAYLIST?: Song[] }).MUSIC_PLAYLIST) return;
    let script = document.querySelector<HTMLScriptElement>('script[data-songs]');
    if (!script) {
      script = document.createElement('script');
      script.src = '/songs.js';
      script.async = true;
      script.dataset.songs = 'true';
      document.body.appendChild(script);
    }
    script.addEventListener('load', read);
    return () => script?.removeEventListener('load', read);
  }, []);
  return songs;
}

function fmtTime(t: number) {
  if (!Number.isFinite(t) || t < 0) return '0:00';
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
}

function MusicPlayer() {
  const songs = usePlaylist();
  const audioRef = useRef<HTMLAudioElement>(null);
  const wantPlay = useRef(true); // autoplay unless the person pauses it
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const song = songs[index];
  const soundOn = useMusicEnabled();

  // Music switch: off = the player is silent (it keeps its place, so turning music on again continues the song); the Sound switch does not affect it
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = !soundOn;
  }, [soundOn, song]);

  // autoplay whenever the track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !song || !wantPlay.current) return;
    audio.play().catch(() => { /* blocked by the browser: the first tap below starts it */ });
  }, [song]);

  // browsers block sound until the page gets a tap / key press, so start on the first one
  useEffect(() => {
    if (!song) return;
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    const start = (event: Event) => {
      if ((event.target as Element | null)?.closest?.('.player-card')) return;
      const audio = audioRef.current;
      if (audio && wantPlay.current && audio.paused) audio.play().catch(() => {});
    };
    events.forEach((name) => window.addEventListener(name, start, { once: true }));
    return () => events.forEach((name) => window.removeEventListener(name, start));
  }, [song]);

  const go = (dir: 1 | -1) => {
    if (!songs.length) return;
    wantPlay.current = true;
    setIndex((i) => {
      if (shuffle && songs.length > 1) {
        let n = i;
        while (n === i) n = Math.floor(Math.random() * songs.length);
        return n;
      }
      return (i + dir + songs.length) % songs.length;
    });
    setTime(0);
  };
  const prev = () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; return; }
    go(-1);
  };
  const play = () => { wantPlay.current = true; audioRef.current?.play().catch(() => {}); };
  const pause = () => { wantPlay.current = false; audioRef.current?.pause(); };
  const seek = (value: number) => {
    const audio = audioRef.current;
    if (audio) { audio.currentTime = value; setTime(value); }
    sfx.play('scrub', duration > 0 ? Math.min(1, value / duration) : 0);
  };
  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <div className="glass metric-card info-card player-card" style={{ '--r': '14px' } as CSSProperties} role="group" aria-label="Music player">
      <span className="fx-layer" aria-hidden="true" />
      {song && (
        <audio
          ref={audioRef}
          src={song.src}
          preload="none"
          muted={!soundOn}
          loop={repeat}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onEnded={() => go(1)}
        />
      )}
      <div className="pl-top">
        {song?.cover ? <img className="pl-cover" src={song.cover} alt="" draggable={false} /> : <span className="pl-cover pl-cover-empty" aria-hidden="true" />}
        <div className="pl-meta">
          <p className="pl-title">{song ? song.title : 'No songs yet'}</p>
          <p className="pl-artist">{song ? (song.artist ?? '') : 'Add tracks in /public/songs.js'}</p>
        </div>
        <button type="button" className={`pl-btn pl-round pl-play ${playing ? '' : 'is-active'}`} aria-label="Play" data-sfx="play" onClick={play} disabled={!song}><Play size={15} strokeWidth={2.2} fill="currentColor" /></button>
        <button type="button" className={`pl-btn pl-round pl-pause ${playing ? 'is-active' : ''}`} aria-label="Pause" data-sfx="pause" onClick={pause} disabled={!song}><Pause size={15} strokeWidth={2.2} fill="currentColor" /></button>
      </div>
      <div className="pl-seek">
        <span className="pl-time">{fmtTime(time)}</span>
        <input type="range" className="pl-range" min={0} max={duration || 0} step={0.1} value={Math.min(time, duration || 0)} onChange={(event) => seek(Number(event.target.value))} aria-label="Seek" style={{ '--p': `${pct}%` } as CSSProperties} disabled={!song} />
        <span className="pl-time">{fmtTime(duration)}</span>
      </div>
      <div className="pl-ctrl">
        <button type="button" className={`pl-btn pl-mini ${shuffle ? 'is-on' : ''}`} aria-label="Shuffle" aria-pressed={shuffle} data-sfx={shuffle ? 'toggleOff' : 'toggleOn'} onClick={() => setShuffle((v) => !v)}><Shuffle size={14} strokeWidth={2} /></button>
        <button type="button" className="pl-btn pl-mini" aria-label="Previous song" data-sfx="prev" onClick={prev} disabled={!song}><SkipBack size={14} strokeWidth={2} fill="currentColor" /></button>
        <button type="button" className="pl-btn pl-mini" aria-label="Next song" data-sfx="next" onClick={() => go(1)} disabled={!song}><SkipForward size={14} strokeWidth={2} fill="currentColor" /></button>
        <button type="button" className={`pl-btn pl-mini ${repeat ? 'is-on' : ''}`} aria-label="Repeat this song" aria-pressed={repeat} data-sfx={repeat ? 'toggleOff' : 'toggleOn'} onClick={() => setRepeat((v) => !v)}><Repeat size={14} strokeWidth={2} /></button>
      </div>
    </div>
  );
}

function Metrics({ open, onClose }: { open: boolean; onClose: () => void }) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  return (
    <div className={`${desktop ? 'hero-rise ' : ''}pointer-events-none absolute right-3 top-[148px] z-[55] w-[calc(100vw-1.5rem)] max-w-[300px] sm:hidden lg:right-[5%] lg:top-auto lg:bottom-[7%] lg:block lg:w-[clamp(340px,30vw,500px)] lg:max-w-none`} style={{ animationDelay: '1.1s' }}>
      <div id="widgets-panel" className={`metrics-panel ${open ? 'is-open' : ''}`}>
      <div className="panel-close-row">
        <button type="button" className="case-close" aria-label="Close widgets" tabIndex={open ? 0 : -1} onClick={onClose}>
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      <span className="fx-layer" aria-hidden="true" />
      <div className="metrics-scale flex flex-col-reverse gap-2 lg:flex-col lg:gap-3">
        <MusicPlayer />
        <ClockCard />
        <div className="info-extra grid grid-cols-2 gap-2 lg:gap-3">
          <WeatherCard />
          <CalendarCard />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:gap-3">
          <RingPill id="skills" value={92} label="Skills Level" from="#86f7ff" to="#00cfff" />
          <RingPill id="creative" value={88} label="Creative Thinking" from="#ffc078" to="#ff7a18" />
          <SpeedCard />
          <ExperienceCard />
        </div>
      </div>
      </div>
    </div>
  );
}

type Mouth = 'smile' | 'sad' | 'wow' | 'oh' | 'talk';

function RobotCard({ onTouch }: { onTouch: () => void }) {
  const touchRef = useRef(onTouch);
  touchRef.current = onTouch;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const fx = fxRef.current;
    const card = cardRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !fx || !card || !ctx) return;

    const W = 280;
    const H = 320;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, ms)); };

    const mouse = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let blink = 0;
    let time = 0;
    let clickCount = 0;
    let lastClick = 0;
    let angryUntil = 0;
    let collapseUntil = 0;
    let laughUntil = 0;
    let mouthMode: Mouth = 'smile';
    let speaking = false; // the robot is talking: its mouth moves
    let asking = false; // a webhook request is in flight
    let voice: HTMLAudioElement | null = null;
    let webhookAbort: AbortController | null = null;
    let mouthUntil = 0;
    let frame = 0;
    let lastRobotPaint = 0;
    let robotVisible = true;

    const clamp = (value: number) => Math.max(-1, Math.min(1, value));
    const updateTarget = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      target.x = clamp((clientX - (rect.left + rect.width / 2)) / (rect.width / 2));
      target.y = clamp((clientY - (rect.top + rect.height / 2)) / (rect.height / 2));
    };
    // the robot floats in place next to the button; only its eyes glance toward the pointer
    const onMove = (event: PointerEvent) => updateTarget(event.clientX, event.clientY);
    const onLeave = () => { target.x = 0; target.y = 0; };

    const draw = (timestamp = performance.now()) => {
      frame = 0;
      if (document.hidden || !robotVisible) return;
      if (lastRobotPaint && timestamp - lastRobotPaint < 1000 / 30 - 1) {
        frame = requestAnimationFrame(draw);
        return;
      }
      lastRobotPaint = timestamp;
      if (!reduced) time += 0.05;
      mouse.x += (target.x - mouse.x) * 0.1;
      mouse.y += (target.y - mouse.y) * 0.1;

      const cx = W / 2;
      const cy = H / 2 + 20;

      ctx.clearRect(0, 0, W, H);
      const now = Date.now();
      if (now < collapseUntil) {
        canvas.style.opacity = '0';
        frame = requestAnimationFrame(draw);
        return;
      }
      canvas.style.opacity = '1';
      const isAngry = now < angryUntil;
      const isLaughing = now < laughUntil;
      canvas.classList.toggle('robot-canvas-angry', isAngry);

      const glow = isAngry ? '#387cff' : '#00cfff';
      const glowSoft = isAngry ? 'rgba(56,124,255,' : 'rgba(0,207,255,';
      // Satin white edge highlights preserve the shell's sculpted depth.
      const chrome = (x0: number, y0: number, x1: number, y1: number) => {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.22, '#e9edf3'); g.addColorStop(0.45, '#ffffff'); g.addColorStop(0.72, '#9ba6b8'); g.addColorStop(1, '#e6ebf3');
        return g;
      };
      // faint pearl iridescence laid over the white shell
      const pearlSheen = (x: number, y: number, r: number) => {
        const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
        g.addColorStop(0, 'rgba(255,208,232,0.24)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(184,214,255,0.28)');
        return g;
      };
      const floatY = Math.sin(time) * 8;
      ctx.lineCap = 'round';

      // ground glow
      ctx.fillStyle = `${glowSoft}0.55)`;
      ctx.shadowBlur = 25;
      ctx.shadowColor = glow;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 92, 38 + Math.sin(time) * 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // body
      const bodyX = cx + mouse.x * 5;
      const bodyY = cy + floatY + 30;
      // Recessed sidewall and a soft contact shadow give the white shell volume.
      ctx.fillStyle = '#6b768b';
      ctx.shadowColor = 'rgba(0,0,0,.45)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(bodyX + 5, bodyY + 7, 49, 43, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      const bodyGrad = ctx.createRadialGradient(bodyX - 18, bodyY - 20, 6, bodyX, bodyY, 60);
      bodyGrad.addColorStop(0, '#ffffff');
      bodyGrad.addColorStop(0.38, '#ffffff');
      bodyGrad.addColorStop(0.75, '#e2e8f1');
      bodyGrad.addColorStop(1, '#8995aa');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(bodyX, bodyY, 50, 45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pearlSheen(bodyX, bodyY, 50);
      ctx.fill();
      ctx.strokeStyle = chrome(bodyX - 50, bodyY - 45, bodyX + 50, bodyY + 45);
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 0;
      ctx.stroke();

      // chest core + circuit lines
      const logoX = bodyX + mouse.x * 6;
      const logoY = bodyY - 2 + mouse.y * 3;
      const pulse = 0.75 + 0.25 * Math.sin(time * 3);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = glow;
      ctx.beginPath();
      ctx.moveTo(logoX, logoY - 12); ctx.lineTo(logoX, bodyY - 38);
      ctx.moveTo(logoX - 12, logoY); ctx.lineTo(bodyX - 38, logoY + 4);
      ctx.moveTo(logoX + 12, logoY); ctx.lineTo(bodyX + 36, logoY - 6);
      ctx.moveTo(logoX, logoY + 12); ctx.lineTo(logoX + 6, bodyY + 40);
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = glow;
      ctx.beginPath();
      ctx.arc(logoX, logoY, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = glow;
      ctx.shadowBlur = 14 * pulse;
      ctx.beginPath();
      ctx.arc(logoX, logoY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2f4f7';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(logoX, logoY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // head position
      const headX = cx + mouse.x * 25;
      const headY = cy + floatY - 50 + mouse.y * 15;
      // White neck joint with a recessed neon-blue status collar.
      ctx.fillStyle = '#aeb9c9';
      ctx.beginPath(); ctx.roundRect(cx - 13, headY + 36, 26, 25, 8); ctx.fill();
      ctx.strokeStyle = glow; ctx.shadowColor = glow; ctx.shadowBlur = 7;
      ctx.beginPath(); ctx.moveTo(cx - 10, headY + 54); ctx.lineTo(cx + 10, headY + 54); ctx.stroke();
      ctx.shadowBlur = 0;

      // antennae (behind head)
      const sway = mouse.x * 6;
      ctx.strokeStyle = chrome(headX - 55, headY - 70, headX + 55, headY - 38);
      ctx.fillStyle = chrome(headX - 55, headY - 75, headX + 55, headY - 65);
      ctx.lineWidth = 3;
      ctx.shadowBlur = 8;
      ctx.shadowColor = glow;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(headX + s * 40, headY - 40);
        ctx.lineTo(headX + s * 55 + sway, headY - 68);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(headX + s * 55 + sway, headY - 70, 5, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      // ear pads (behind head)
      ctx.fillStyle = chrome(headX - 70, headY - 16, headX + 70, headY + 22);
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(headX - 70, headY - 16, 16, 38, 8);
      ctx.roundRect(headX + 54, headY - 16, 16, 38, 8);
      ctx.fill();
      ctx.shadowBlur = 0;

      // head
      ctx.fillStyle = '#8b97ab';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0,0,0,.45)';
      ctx.beginPath();
      ctx.roundRect(headX - 56, headY - 40, 120, 90, 40);
      ctx.fill();
      ctx.shadowBlur = 0;
      const headGrad = ctx.createRadialGradient(headX - 30, headY - 20, 15, headX, headY, 80);
      headGrad.addColorStop(0, '#ffffff');
      headGrad.addColorStop(0.4, '#ffffff');
      headGrad.addColorStop(0.76, '#e6ecf4');
      headGrad.addColorStop(1, '#a4b0c3');
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.roundRect(headX - 60, headY - 45, 120, 90, 40);
      ctx.fill();
      ctx.fillStyle = pearlSheen(headX, headY, 60);
      ctx.fill();
      ctx.strokeStyle = chrome(headX - 60, headY - 45, headX + 60, headY + 45);
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // visor
      const faceX = headX + mouse.x * 10;
      const faceY = headY + mouse.y * 8;
      const faceHeight = 60;
      const visorGrad = ctx.createLinearGradient(0, faceY - 30, 0, faceY + 30);
      visorGrad.addColorStop(0, '#10243a');
      visorGrad.addColorStop(0.45, '#08131f');
      visorGrad.addColorStop(1, '#07090f');
      ctx.fillStyle = visorGrad;
      ctx.beginPath();
      ctx.roundRect(faceX - 45, faceY - faceHeight / 2, 90, faceHeight, 22);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,207,255,.8)';
      ctx.shadowColor = glow;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // eyes
      if (Math.random() > 0.98) blink = 1;
      if (blink > 0) blink -= 0.2;

      const eyeY = faceY + mouse.y * 5 - 2;
      const eyeColor = glow;
      ctx.strokeStyle = eyeColor;
      ctx.fillStyle = eyeColor;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 10;
      ctx.shadowColor = eyeColor;

      if (blink <= 0.2) {
        const ex = [faceX - 22 + mouse.x * 5, faceX + 22 + mouse.x * 5];
        if (isAngry || mouthMode === 'wow' || mouthMode === 'oh') {
          ex.forEach((x) => {
            ctx.beginPath();
            ctx.ellipse(x, eyeY, 7, 10, 0, 0, Math.PI * 2);
            ctx.fill();
          });
        } else {
          // happy ^ ^ eyes
          ex.forEach((x) => {
            ctx.beginPath();
            ctx.arc(x, eyeY + 6, 9, Math.PI * 1.1, Math.PI * 1.9);
            ctx.stroke();
          });
        }
      }

      // mouth
      if (Date.now() > mouthUntil) mouthMode = 'smile';
      if (speaking) { mouthMode = 'talk'; mouthUntil = Date.now() + 150; }
      const baseY = faceY + 14 + mouse.y * 6;
      if (mouthMode === 'sad') {
        ctx.beginPath();
        ctx.moveTo(faceX - 18, baseY + 8);
        ctx.quadraticCurveTo(faceX, baseY - 2, faceX + 18, baseY + 8);
        ctx.stroke();
      } else if (mouthMode === 'wow') {
        ctx.beginPath();
        ctx.arc(faceX, baseY + 4, 6, 0, Math.PI * 2);
        ctx.stroke();
      } else if (mouthMode === 'talk') {
        ctx.beginPath();
        ctx.ellipse(faceX, baseY + 4, 7, 3 + Math.abs(Math.sin(time * 10)) * 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (mouthMode === 'oh') {
        ctx.beginPath();
        ctx.arc(faceX, baseY + 4, 4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const smileDepth = (isLaughing ? 12 : 8) + Math.abs(mouse.y * 4);
        ctx.beginPath();
        ctx.moveTo(faceX - 10, baseY);
        ctx.quadraticCurveTo(faceX, baseY + smileDepth * 0.7, faceX + 10, baseY);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      frame = requestAnimationFrame(draw);
    };

    const emitPop = (text: string, duration: number) => {
      const pop = document.createElement('span');
      pop.className = 'robot-pop';
      pop.textContent = text;
      fx.appendChild(pop);
      later(() => pop.remove(), duration);
    };

    const emitBubbles = (count: number, tone?: 'burst' | 'angry') => {
      const rect = fx.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const radius = Math.min(rect.width, rect.height) * 0.48;
      for (let i = 0; i < count; i += 1) {
        const bubble = document.createElement('span');
        bubble.className = tone === 'angry' ? 'robot-bubble robot-bubble-angry' : 'robot-bubble';
        if (tone === 'burst') {
          const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
          bubble.style.left = `${centerX + Math.cos(angle) * radius}px`;
          bubble.style.top = `${centerY + Math.sin(angle) * radius}px`;
        } else {
          bubble.style.left = `${40 + Math.random() * 40}%`;
          bubble.style.top = `${30 + Math.random() * 40}%`;
        }
        const size = `${8 + Math.random() * 8}px`;
        bubble.style.width = size;
        bubble.style.height = size;
        fx.appendChild(bubble);
        later(() => bubble.remove(), 900);
      }
    };

    // speech bubble for webhook replies: wraps, stays as long as the text needs
    const emitSpeech = (text: string, duration: number) => {
      const bubble = document.createElement('span');
      bubble.className = 'robot-say';
      bubble.textContent = text;
      bubble.style.animationDuration = `${duration}ms`;
      fx.appendChild(bubble);
      later(() => bubble.remove(), duration + 100);
    };

    const speak = (reply: { text?: string; audio?: string; lang?: string }) => {
      const text = reply.text?.slice(0, 280);
      if (text) emitSpeech(text, Math.min(14000, Math.max(3000, text.length * 70)));
      if (!sfx.isEnabled()) return; // sound is off: the reply is shown as text only
      if (reply.audio) {
        const audio = new Audio(reply.audio);
        voice = audio;
        speaking = true;
        const done = () => {
          speaking = false;
          voice = null;
          if (reply.audio?.startsWith('blob:')) URL.revokeObjectURL(reply.audio);
        };
        audio.onended = done;
        audio.onerror = done;
        audio.play().catch(done);
        return;
      }
      if (text && ROBOT_SPEAK && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = reply.lang ?? navigator.language;
        utterance.rate = 1.05;
        utterance.pitch = 1.25;
        const done = () => { speaking = false; };
        utterance.onend = done;
        utterance.onerror = done;
        speaking = true;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
    };

    // touch -> webhook -> reply. Any failure quietly falls back to a built-in phrase.
    const askWebhook = async (touches: number) => {
      asking = true;
      emitPop('...', 900);
      const controller = new AbortController();
      webhookAbort = controller;
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(ROBOT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'robot_touch', touches, page: window.location.href, language: navigator.language, time: new Date().toISOString() }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`webhook ${res.status}`);
        const type = res.headers.get('content-type') ?? '';
        let reply: { text?: string; audio?: string; lang?: string };
        if (type.startsWith('audio/')) {
          reply = { audio: URL.createObjectURL(await res.blob()) };
        } else if (type.includes('json')) {
          const data = await res.json();
          const first = Array.isArray(data) ? data[0] : data;
          const text = first?.reply ?? first?.text ?? first?.message ?? first?.output ?? first?.response;
          const audio = first?.audio_url ?? first?.audioUrl;
          reply = { text: typeof text === 'string' ? text.trim() : undefined, audio: typeof audio === 'string' ? audio : undefined, lang: typeof first?.lang === 'string' ? first.lang : undefined };
        } else {
          reply = { text: (await res.text()).trim() || undefined };
        }
        if (!reply.text && !reply.audio) throw new Error('empty reply');
        speak(reply);
      } catch {
        if (!controller.signal.aborted || webhookAbort === controller) emitPop(pick(funTexts), 1200);
      } finally {
        window.clearTimeout(timeout);
        if (webhookAbort === controller) webhookAbort = null;
        asking = false;
      }
    };

    const funTexts = ["Hallo! I'm Suresh Assit.", 'Are you OK?', "You Need Suresh's Help?", 'Okay', 'Wow', 'Ah'];
    const angryTexts = ['Enough!', "I'm angry", 'Stop', 'Sad'];
    const collapseTexts = ['Ouch!', "I'm done"];
    const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

    const onClick = () => {
      const now = Date.now();
      if (now - lastClick > 1500) clickCount = 0;
      clickCount += 1;
      lastClick = now;

      if (clickCount >= 8) {
        angryUntil = now + 1200;
        collapseUntil = now + 1200;
        clickCount = 0;
        canvas.classList.add('robot-canvas-collapse');
        sfx.play('robotCollapse');
        later(() => {
          canvas.classList.remove('robot-canvas-collapse');
          canvas.classList.remove('robot-canvas-reappear');
          void canvas.offsetWidth;
          canvas.classList.add('robot-canvas-reappear');
          emitBubbles(14, 'burst');
          sfx.play('robotReappear');
          later(() => canvas.classList.remove('robot-canvas-reappear'), 600);
        }, 1200);
        emitBubbles(18, 'burst');
        mouthMode = 'oh';
        mouthUntil = now + 1400;
        emitPop(pick(collapseTexts), 1400);
        return;
      }

      if (clickCount >= 5) {
        angryUntil = now + 1500;
        mouthMode = 'sad';
        mouthUntil = now + 1500;
        emitBubbles(8, 'angry');
        emitPop(pick(angryTexts), 1500);
        sfx.play('robotAngry');
      } else {
        laughUntil = now + 1200;
        mouthMode = Math.random() > 0.6 ? 'wow' : 'smile';
        mouthUntil = now + 1200;
        emitBubbles(4);
        if (!ROBOT_WEBHOOK_URL) emitPop(pick(funTexts), 1200);
        else if (!asking && !speaking) void askWebhook(clickCount);
        touchRef.current(); // touching the robot opens the chat
        sfx.play(mouthMode === 'wow' ? 'robotWow' : 'robotHappy');
      }

      canvas.classList.remove('robot-canvas-fun');
      void canvas.offsetWidth;
      canvas.classList.add('robot-canvas-fun');
      later(() => canvas.classList.remove('robot-canvas-fun'), 600);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    window.addEventListener('blur', onLeave);
    // canvas ignores the mouse so the trailing robot never blocks the page; clicks near it still trigger reactions
    const onWindowClick = (event: MouseEvent) => {
      if (document.querySelector('.curtain')) return; // the robot ignores touches while the curtain is still there
      // Small-screen controls can sit inside the robot's generous hit area.
      // Their clicks must not also trigger a robot reaction or open the chat.
      if (event.target instanceof Element && event.target.closest('button,a,input,select,textarea,summary,details,[role="dialog"]')) return;
      const r = canvas.getBoundingClientRect();
      const dx = event.clientX - (r.left + r.width / 2);
      const dy = event.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < r.width * 0.3) onClick();
    };
    window.addEventListener('click', onWindowClick);
    // turning sound off while the robot is talking cuts the voice at once
    const unsubSound = sfx.subscribe(() => {
      if (sfx.isEnabled()) return;
      voice?.pause();
      voice = null;
      speaking = false;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    });
    const resumeRobot = () => {
      lastRobotPaint = 0;
      if (document.hidden || !robotVisible) { cancelAnimationFrame(frame); frame = 0; }
      else if (!frame) frame = requestAnimationFrame(draw);
    };
    const robotObserver = new IntersectionObserver(([entry]) => {
      robotVisible = entry.isIntersecting;
      resumeRobot();
    });
    robotObserver.observe(canvas);
    document.addEventListener('visibilitychange', resumeRobot);
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      robotObserver.disconnect();
      document.removeEventListener('visibilitychange', resumeRobot);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('click', onWindowClick);
      timers.forEach((id) => window.clearTimeout(id));
      unsubSound();
      webhookAbort?.abort();
      voice?.pause();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      fx.replaceChildren();
    };
  }, []);

  return (
    <div ref={cardRef} className="robot-card relative aspect-square w-full">
      <canvas ref={canvasRef} className="robot-canvas" role="img" aria-label="Interactive robot. Click it for a reaction." />
      <div ref={fxRef} className="robot-fx" aria-hidden="true" />
    </div>
  );
}

/* ---------- Chat with the robot ----------
   Touching the robot opens a small chat next to it. Answers come from an AI proxy (CHAT_API_URL, see chat-worker.js) that knows
   everything on this page. With no URL set, or if the proxy can't be reached, the built-in answers below are used instead.
   The proxy keeps the API key on the server: never put an API key in this file. */
const CHAT_API_URL = ''; // e.g. 'https://suresh-chat.your-name.workers.dev'
type ChatAction = 'Case Records' | 'CV' | 'GitHub' | 'Gallery' | 'Connect';
type ChatMsg = { id: number; role: 'user' | 'bot'; text: string; actions?: ChatAction[] };
type ChatAnswer = { text: string; actions: ChatAction[] };
const CHAT_GREETING = "Hi, I'm Suresh Assit! Ask me anything about this page: Suresh's work, CV, GitHub, gallery or how to reach him.";
const CHAT_SUGGESTIONS = ['Who is Suresh?', 'Show me his work', 'How can I contact him?', 'What can I do on this page?'];
const CHAT_ACTION_RE = /\[\[open:(Case Records|CV|GitHub|Gallery|Connect)\]\]/g;
const CHAT_ACTION_LABEL: Record<ChatAction, string> = { 'Case Records': 'Open Case Records', CV: 'Open CV', GitHub: 'Open GitHub', Gallery: 'Open Gallery', Connect: 'Jom Connect' };

const CHAT_KB: { keys: RegExp; text: string; actions?: ChatAction[] }[] = [
  { keys: /^\s*(hi|hello|hey|hai|salam|hola)\b/i, text: "Hello! I'm Suresh Assit. What would you like to know about this page?" },
  { keys: /contact|reach|e-?mail|whatsapp|phone|call|instagram|facebook|hire|connect|jom/i, text: 'You can reach Suresh on WhatsApp (+60 10-436 8680), by email at hello@suresh.app, or on Instagram (@sureshksmy) and Facebook. The Jom Connect button on the home screen has all the links.', actions: ['Connect'] },
  { keys: /\bcv\b|resume|curriculum|experience|years|career/i, text: 'Suresh has 16+ years of experience as a DevOps engineer and web developer in Malaysia. Open the CV to read it or download it as a PDF.', actions: ['CV'] },
  { keys: /work|portfolio|behance|case|project|design/i, text: "Case Records shows Suresh's Behance portfolio: his latest design projects with their views and likes.", actions: ['Case Records'] },
  { keys: /github|repo|source|open.?source|stack|tech|framework/i, text: `The GitHub popup showcases ${REPOS.length} featured repositories and tools, such as React, Next.js, Vite, Three.js and FastAPI, each with a "See live" link.`, actions: ['GitHub'] },
  { keys: /gallery|photo|video|picture|image|gif/i, text: 'The Gallery has photos, GIFs and videos. Tap any thumbnail to preview it full size.', actions: ['Gallery'] },
  { keys: /skill|good at|strength|speed|creativ|devops|level/i, text: 'Suresh rates his skills at 92% and creative thinking at 88%, with 16+ years of experience across DevOps and web development.' },
  { keys: /music|song|player|weather|clock|calendar|widget|time\b/i, text: 'The widget panel has a music player (play, pause, shuffle, repeat), a clock, the Kuala Lumpur weather and a calendar. On a phone, open it with the << button at the top right.' },
  { keys: /menu|navigat|how|where|what can|page|use|feature/i, text: "Tap the round logo at the top left to open the menu: Case Records, CV, GitHub and Gallery. The (i) button at the top right opens Suresh's intro, and Jom Connect has his contact links." },
  { keys: /sound|audio|mute|noise|volume/i, text: 'All sounds on this page are generated live in your browser, and the music starts after your first tap or key press.' },
  { keys: /robot|bot|assist|your name|yourself|you\b/i, text: "I'm Suresh Assit, the little robot on the home screen. I follow your cursor with my eyes, and if you poke me too many times I get grumpy!" },
  { keys: /who|about|suresh|intro|bio/i, text: "Suresh Kaleyannan is a DevOps engineer and web developer from Malaysia with 16+ years of experience. He builds interactive websites with modern frontend technologies, smooth animations and creative experiences. His site: www.suresh.app." },
];
const CHAT_FALLBACK: ChatAnswer = { text: 'I can help with questions about this page: Suresh\'s work, CV, GitHub, gallery, widgets or contact details. Try one of the suggestions!', actions: [] };

function localChatAnswer(question: string): ChatAnswer {
  const hit = CHAT_KB.find((entry) => entry.keys.test(question));
  return hit ? { text: hit.text, actions: hit.actions ?? [] } : CHAT_FALLBACK;
}

async function askChat(history: ChatMsg[], signal: AbortSignal): Promise<ChatAnswer> {
  const question = history[history.length - 1]?.text ?? '';
  if (CHAT_API_URL) {
    const controller = new AbortController();
    const stop = () => controller.abort();
    signal.addEventListener('abort', stop);
    const timeout = window.setTimeout(stop, 20000);
    try {
      const messages = history.filter((m) => m.id !== 0).slice(-12).map((m) => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text }));
      const res = await fetch(CHAT_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }), signal: controller.signal });
      if (!res.ok) throw new Error(`chat ${res.status}`);
      const data = await res.json();
      const raw: unknown = data?.reply ?? data?.text ?? data?.content?.[0]?.text;
      if (typeof raw !== 'string' || !raw.trim()) throw new Error('empty reply');
      const actions = Array.from(new Set(Array.from(raw.matchAll(CHAT_ACTION_RE), (m) => m[1] as ChatAction)));
      return { text: raw.replace(CHAT_ACTION_RE, '').trim(), actions };
    } catch {
      if (signal.aborted) return CHAT_FALLBACK;
      /* the proxy is down or slow: fall through to the built-in answers */
    } finally {
      window.clearTimeout(timeout);
      signal.removeEventListener('abort', stop);
    }
  }
  await new Promise((resolve) => window.setTimeout(resolve, 450 + Math.random() * 450)); // a short "typing" pause
  return localChatAnswer(question);
}

function ChatPopup({ open, onClose, onAction }: { open: boolean; onClose: () => void; onAction: (action: ChatAction) => void }) {
  const phone = useMediaQuery('(max-width: 639px)');
  const [messages, setMessages] = useState<ChatMsg[]>([{ id: 0, role: 'bot', text: CHAT_GREETING }]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<CSSProperties>({});
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const lifeRef = useRef<AbortController | null>(null);

  // on desktop the chat sits right next to the robot; on a phone it is a sheet at the bottom
  useEffect(() => {
    if (!open || phone) { setPos({}); return; }
    const place = () => {
      const r = document.querySelector('.robot-card')?.getBoundingClientRect();
      if (!r) return;
      const left = Math.min(Math.max(12, r.right + 8), window.innerWidth - 340 - 12);
      const bottom = Math.max(16, window.innerHeight - r.bottom - 8);
      setPos({ left, bottom, '--cb': `${bottom}px` } as CSSProperties);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, phone]);

  useEffect(() => {
    if (!open || phone) return;
    const id = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 400);
    return () => window.clearTimeout(id);
  }, [open, phone]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, busy, open]);

  useEffect(() => {
    const life = new AbortController();
    lifeRef.current = life;
    return () => life.abort();
  }, []);

  async function send(raw: string) {
    const text = raw.trim().slice(0, 300);
    const life = lifeRef.current;
    if (!text || busy || !life) return;
    const history: ChatMsg[] = [...messages, { id: nextId.current++, role: 'user', text }];
    setMessages(history);
    setDraft('');
    setBusy(true);
    sfx.play('chatSend');
    const answer = await askChat(history, life.signal);
    if (life.signal.aborted) return;
    setMessages((list) => [...list, { id: nextId.current++, role: 'bot', text: answer.text, actions: answer.actions }]);
    setBusy(false);
    sfx.play('chatReceive');
  }

  return (
    <div id="chat-popup" role="dialog" aria-label="Chat with Suresh Assit" aria-hidden={!open} className={`chat-pop${open ? ' is-open' : ''}`} style={pos}>
      <div className="chat-head">
        <span className="chat-dot" aria-hidden="true" />
        <div className="chat-title">
          <p className="chat-name">Suresh Assit</p>
          <p className="chat-sub">Ask me about this page</p>
        </div>
        <button type="button" className="case-close" aria-label="Close chat" tabIndex={open ? 0 : -1} onClick={onClose}>
          <X size={18} strokeWidth={2} />
        </button>
      </div>
      <div ref={listRef} className="chat-list" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg chat-msg--${m.role}`}>
            <p>{m.text}</p>
            {m.actions && m.actions.length > 0 && (
              <div className="chat-actions">
                {m.actions.map((action) => (
                  <button key={action} type="button" className="chat-chip" tabIndex={open ? 0 : -1} onClick={() => onAction(action)}>{CHAT_ACTION_LABEL[action]}</button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="chat-msg chat-msg--bot chat-typing" role="status" aria-label="Typing"><i /><i /><i /></div>}
        {messages.length === 1 && !busy && (
          <div className="chat-actions chat-suggest">
            {CHAT_SUGGESTIONS.map((q) => (
              <button key={q} type="button" className="chat-chip" data-sfx="none" tabIndex={open ? 0 : -1} onClick={() => void send(q)}>{q}</button>
            ))}
          </div>
        )}
      </div>
      <form className="chat-form" onSubmit={(event) => { event.preventDefault(); void send(draft); }}>
        <input ref={inputRef} className="chat-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type your question..." maxLength={300} autoComplete="off" enterKeyHint="send" aria-label="Your message" tabIndex={open ? 0 : -1} />
        <button type="submit" className="chat-send" data-sfx="none" aria-label="Send" disabled={!draft.trim() || busy} tabIndex={open ? 0 : -1}><Send size={16} strokeWidth={2} /></button>
      </form>
    </div>
  );
}

export default function App() {
  return <MainSite spotlightActive />;
}

function MainSite({ spotlightActive }: { spotlightActive: boolean }) {
  const [lightingTarget, setLightingTarget] = useState<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const effectsOn = useSoundEnabled(); // Sound switch (interface click / hover sounds, video, robot voice); the music player has its own Music switch
  const musicOn = useMusicEnabled();
  const siteReady = true;
  const [chatOpen, setChatOpen] = useState(false); // chat popup next to the robot
  const phone = useMediaQuery('(max-width: 639px)');
  // A quiet headline entrance lets the stage lights provide the motion.
  useLayoutEffect(() => {
    const root = appRef.current;
    if (!root || !siteReady || !spotlightActive) return;
    const code = root.querySelector<HTMLElement>('.title-code');
    const sub = root.querySelector<HTMLElement>('.title-sub');
    if (!code || !sub) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo([code, sub], { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .8, stagger: .12, ease: 'power3.out', clearProps: 'transform,opacity' });
      return () => { gsap.set([code, sub], { clearProps: 'opacity,transform,filter' }); };
    }, root);
    return () => media.revert();
  }, [siteReady, spotlightActive]);

  useEffect(() => {
    const root = appRef.current;
    if (!root || !siteReady) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('.experience-dock > *', { y: 22, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.09, duration: 0.75, ease: 'power3.out', clearProps: 'transform,opacity' });
    }, root);
    return () => media.revert();
  }, [siteReady]);

  // track the real visible height (mobile browser bars change it, which left a white strip under the page)
  // and block pinch / gesture zoom (double-tap zoom is off through touch-action: manipulation)
  useEffect(() => {
    const setHeight = () => document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
    setHeight();
    const stop = (event: Event) => event.preventDefault();
    const multiTouch = (event: TouchEvent) => { if (event.touches.length > 1) event.preventDefault(); };
    const ctrlWheel = (event: WheelEvent) => { if (event.ctrlKey) event.preventDefault(); };
    window.addEventListener('resize', setHeight);
    window.addEventListener('orientationchange', setHeight);
    window.visualViewport?.addEventListener('resize', setHeight);
    document.addEventListener('gesturestart', stop);
    document.addEventListener('gesturechange', stop);
    document.addEventListener('gestureend', stop);
    document.addEventListener('touchmove', multiTouch, { passive: false });
    document.addEventListener('wheel', ctrlWheel, { passive: false });
    return () => {
      window.removeEventListener('resize', setHeight);
      window.removeEventListener('orientationchange', setHeight);
      window.visualViewport?.removeEventListener('resize', setHeight);
      document.removeEventListener('gesturestart', stop);
      document.removeEventListener('gesturechange', stop);
      document.removeEventListener('gestureend', stop);
      document.removeEventListener('touchmove', multiTouch);
      document.removeEventListener('wheel', ctrlWheel);
    };
  }, []);
  const [notice, setNotice] = useState<'reserve' | 'connect' | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [widgetsOpen, setWidgetsOpen] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);
  const [projects, setProjects] = useState<BehanceProject[]>([]);
  const [projectsState, setProjectsState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const casePopRef = useRef<HTMLDivElement>(null);
  const [cvOpen, setCvOpen] = useState(false);
  const [cvState, setCvState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [cvUrl, setCvUrl] = useState('');
  const cvPopRef = useRef<HTMLDivElement>(null);
  const cvPagesRef = useRef<HTMLDivElement>(null);
  const cvStarted = useRef(false);
  const [ghOpen, setGhOpen] = useState(false);
  const ghPopRef = useRef<HTMLDivElement>(null);
  const [galOpen, setGalOpen] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const galPopRef = useRef<HTMLDivElement>(null);
  const [videoState, setVideoState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [soundOn, setSoundOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const infoOpenRef = useRef(false);
  const noticeRef = useRef<HTMLDialogElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);

  // sound: hover / click / focus for everything, plus open / close for each menu, panel and popup
  useUiSounds(appRef);
  useOpenSfx(menuOpen, 'menu');
  useOpenSfx(infoOpen, 'info');
  useOpenSfx(widgetsOpen, 'widgets');
  useOpenSfx(caseOpen, 'drop', 0);
  useOpenSfx(cvOpen, 'drop', 1);
  useOpenSfx(ghOpen, 'drop', 2);
  useOpenSfx(galOpen, 'drop', 3);
  useOpenSfx(notice !== null, 'notice');
  useOpenSfx(lightbox !== null, 'lightbox');
  useOpenSfx(chatOpen, 'lightbox');
  useStatusSfx(projectsState);
  useStatusSfx(cvState);

  useEffect(() => {
    const dialog = noticeRef.current;
    if (notice && dialog && !dialog.open) dialog.showModal();
    if (!notice && dialog?.open) dialog.close();
  }, [notice]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const closeOnOutside = (event: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('pointerdown', closeOnOutside);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [menuOpen]);

  useEffect(() => {
    infoOpenRef.current = infoOpen;
    const video = videoRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (infoOpen) {
      if (video?.src) {
        setVideoState('ready');
        if (!reduced) video.play().catch(() => {});
      } else if (!document.querySelector('script[data-cv]')) {
        // cv.js embeds the video (~11 MB), so it is only fetched the first time the popup opens
        const script = document.createElement('script');
        script.src = CV_SCRIPT;
        script.async = true;
        script.dataset.cv = 'true';
        script.onerror = () => setVideoState('error');
        document.body.appendChild(script);
        setVideoState('loading');
      }
      return;
    }
    setSoundOn(false);
    const id = window.setTimeout(() => video?.pause(), 650);
    return () => window.clearTimeout(id);
  }, [infoOpen]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !(soundOn && effectsOn); // the master switch overrides the video's own button
  }, [soundOn, effectsOn]);

  function loadProjects() {
    setProjectsState('loading');
    fetchBehanceProjects()
      .then((list) => { setProjects(list); setProjectsState('ready'); })
      .catch(() => setProjectsState('error'));
  }

  useEffect(() => {
    if (!caseOpen) return;
    if (projectsState === 'idle') loadProjects();
    // the popup stays open until its close button is pressed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseOpen]);

  useEffect(() => {
    if (!galOpen) setLightbox(null); // the gallery and its preview stay open until their close buttons are pressed
  }, [galOpen]);

  async function loadCv() {
    setCvState('loading');
    try {
      // the PDF and pdf.js are only fetched the first time the CV opens
      // pdf.js comes from the CDN (pinned), so no npm package is needed; the worker is wrapped in a same-origin blob
      const pdfjs = await import(/* @vite-ignore */ `${PDFJS_BASE}/pdf.min.mjs`);
      const [res, workerRes] = await Promise.all([fetch(CV_URL), fetch(`${PDFJS_BASE}/pdf.worker.min.mjs`)]);
      if (!res.ok || !workerRes.ok) throw new Error('cv fetch failed');
      pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([await workerRes.text()], { type: 'text/javascript' }));
      const bytes = new Uint8Array(await res.arrayBuffer());
      setCvUrl(URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })));
      const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
      const host = cvPagesRef.current;
      if (!host) throw new Error('no host');
      host.innerHTML = '';
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = Math.max(host.clientWidth, 320);
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
        const canvas = document.createElement('canvas');
        canvas.className = 'cv-page';
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `CV page ${n} of ${doc.numPages}`);
        host.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        if (n === 1) setCvState('ready');
      }
      setCvState('ready');
    } catch {
      cvStarted.current = false;
      setCvState('error');
    }
  }

  useEffect(() => {
    if (!cvOpen) return;
    if (!cvStarted.current) { cvStarted.current = true; loadCv(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cvOpen]);

  useEffect(() => {
    const root = signatureRef.current;
    if (!root || !siteReady) return; // the signature is written once the curtain starts to open
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set('.sig-img', { '--p': '140%' });
        gsap.set('.sig-line', { opacity: 1, y: 0 });
        return;
      }
      gsap.set('.sig-img', { '--p': '0%' });
      const tl = gsap.timeline({ delay: 1 });
      tl.to('.sig-img', { '--p': '140%', duration: 2.6, ease: 'power2.inOut' })
        .to('.sig-img', { filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.95))', duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '-=0.3')
        .fromTo('.sig-line', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.18, ease: 'power3.out' }, '-=1.1');
      gsap.to('.sig-img', { filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.55))', duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 5 });
    }, root);
    return () => ctx.revert();
  }, [siteReady]);

  function navigate(label: string) {
    sfx.quietMenuClose();
    setMenuOpen(false);
    if (label === 'Case Records') {
      setInfoOpen(false);
      setWidgetsOpen(false);
      setCvOpen(false);
      setGhOpen(false);
      setGalOpen(false);
      setCaseOpen(true);
      return;
    }
    if (label === 'CV') {
      setInfoOpen(false);
      setWidgetsOpen(false);
      setCaseOpen(false);
      setGhOpen(false);
      setGalOpen(false);
      setCvOpen(true);
      return;
    }
    if (label === 'GitHub') {
      setInfoOpen(false);
      setWidgetsOpen(false);
      setCaseOpen(false);
      setCvOpen(false);
      setGalOpen(false);
      setGhOpen(true);
      return;
    }
    if (label === 'Gallery') {
      setInfoOpen(false);
      setWidgetsOpen(false);
      setCaseOpen(false);
      setCvOpen(false);
      setGhOpen(false);
      setGalOpen(true);
    }
  }

  // buttons inside the chat open the same popups as the menu (on a phone the chat steps aside first)
  function chatAction(action: ChatAction) {
    if (phone) setChatOpen(false);
    if (action === 'Connect') openNotice('connect'); else navigate(action);
  }

  function openNotice(value: 'reserve' | 'connect') {
    sfx.quietMenuClose();
    setMenuOpen(false);
    setNotice(value);
  }

  useEffect(() => {
    const root = appRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = gsap.context(() => {
      const cards = root.querySelectorAll('.case-pop.is-open .case-card, .case-pop.is-open .gh-card, .case-pop.is-open .gal-item, .info-pop.is-open .info-body > *');
      gsap.fromTo(cards, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: { each: 0.055, amount: 0.4 }, ease: 'power3.out', clearProps: 'transform,opacity', delay: 0.18 });
    }, root);
    return () => context.revert();
  }, [caseOpen, ghOpen, galOpen, infoOpen, projectsState]);

  return (
    <div ref={appRef} className="app-root tracking-[-0.02em]" data-site={siteReady ? 'ready' : 'loading'} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.cdnfonts.com/css/talaga-lakes');
        @import url('https://fonts.cdnfonts.com/css/change-your-name');
        @import url('https://fonts.cdnfonts.com/css/galiver-sans-obliques');
        @import url('https://fonts.cdnfonts.com/css/ngopie');
        @import url('https://fonts.cdnfonts.com/css/anek-odia');
        @import url('https://fonts.cdnfonts.com/css/double-pivot');
        @import url('https://fonts.cdnfonts.com/css/super-guardian');
        @import url('https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Playwrite+IS:wght@100..400&display=swap');
        @font-face { font-family: 'SuperGuardianBackup'; font-style: normal; font-weight: 400; font-display: swap; src: url('https://fonts.cdnfonts.com/s/106144/SuperGuardian-MV1Ap.woff') format('woff'); }
        .title-code {
          font-family: 'Talaga Lakes', 'Arial Black', Impact, sans-serif;
          font-weight: 400;
          font-size: clamp(5rem, 10vw, 10rem);
          line-height: 1;
          letter-spacing: 0;
          color: #fff;
        }
        .title-sub {
          font-family: 'Change Your Name', 'Brush Script MT', cursive;
          font-weight: 400;
          font-size: clamp(1.75rem, 3.6vw, 3.5rem);
          line-height: 1.1;
          letter-spacing: 0;
          color: #fff;
        }
        @media (max-width: 639px) {
          .title-code { font-size: 22vw; }
          .title-sub { font-size: 9vw; }
        }
        /* page never scrolls or zooms; only the widget panel scrolls */
        html, body, #root { margin: 0; width: 100%; height: 100%; overflow: hidden; overscroll-behavior: none; background: #080c15; }
        html { touch-action: manipulation; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
        body { position: fixed; inset: 0; -webkit-tap-highlight-color: transparent; }
        .app-root { position: fixed; inset: 0; width: 100%; height: var(--app-h, 100dvh); overflow: hidden; background: #820d16; }
        /* Liquid-glass surface (shared by the button and the nav) */
        .glass {
          --r: 9999px; --tr: 15%;
          position: relative;
          isolation: isolate;
          border-radius: var(--r);
          background: rgba(0, 0, 0, 0.02);
          -webkit-backdrop-filter: blur(2px);
          backdrop-filter: blur(2px);
          box-shadow:
            inset 3px 3px 0.5px -3px rgba(255, 255, 255, 0.9),
            inset -3px -3px 0.5px -3px rgba(255, 255, 255, 0.85),
            inset 1px 1px 1px -0.5px rgba(255, 255, 255, 0.6),
            inset -1px -1px 1px -0.5px rgba(255, 255, 255, 0.6),
            inset 0 0 3px -1px rgba(0, 0, 0, 0.8),
            0 12px 30px rgba(0, 0, 0, 0.2);
        }
        /* optical punch: glare shapes live here so contrast() sharpens them */
        .fx-layer {
          position: absolute; inset: 0; z-index: -1;
          border-radius: inherit; overflow: hidden; pointer-events: none;
          filter: contrast(3);
        }
        /* internal dark caustic shadow */
        .fx-layer::before {
          content: ''; position: absolute; inset: 6px; border-radius: inherit;
          background: radial-gradient(120% 140% at 80% 130%, rgba(0, 0, 0, 0.35) 0%, transparent 60%);
          filter: blur(8px);
        }
        /* perimeter diagonal sheen (transparent band = --tr) */
        .fx-layer::after {
          content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 8px;
          background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, transparent var(--tr), transparent calc(100% - var(--tr)), rgba(255,255,255,0.85) 100%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          filter: blur(7px);
        }
        /* capsule button */
        .box {
          --w: 100px; --h: 100px;
          --icon: min(40px, calc(var(--h) * 0.8));
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: max-content;
          min-width: var(--w);
          height: var(--h);
          padding: 0 calc((var(--h) - var(--icon)) / 2) 0 calc(var(--h) * 0.42);
          border: 0;
          cursor: pointer;
          color: #fff;
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .box:hover { transform: scale(1.04); }
        .box:active { transform: scale(0.97); }
        .box:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 4px; }
        .start-btn .btn-label { font-family: 'Galiver Sans Obliques', 'JetBrains Mono', sans-serif; font-size: 13px; font-weight: 400; letter-spacing: 0.02em; white-space: nowrap; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35); }
        .start-btn .btn-icon {
          flex: none; display: flex; align-items: center; justify-content: center;
          width: var(--icon); height: var(--icon);
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .start-btn:hover .btn-icon { transform: translateX(2px); }
        /* neon fire outline, fading in and out */
        .neon-fire {
          width: calc(var(--icon) * 0.6); height: calc(var(--icon) * 0.6);
          color: #ffc46b;
          animation: neon-pulse 2.2s ease-in-out infinite;
        }
        @keyframes neon-pulse {
          0%, 100% { opacity: 0.4; filter: drop-shadow(0 0 1px #ffb23e) drop-shadow(0 0 3px #ff7a18); }
          50% { opacity: 1; filter: drop-shadow(0 0 2px #ffe0a0) drop-shadow(0 0 6px #ff8a1f) drop-shadow(0 0 12px #ff4d00); }
        }
        @media (prefers-reduced-motion: reduce) {
          .neon-fire { animation: none; filter: drop-shadow(0 0 2px #ffb23e) drop-shadow(0 0 6px #ff7a18); }
        }
        /* Interactive canvas robot */
        .robot-card { pointer-events: none; }
        .robot-card .robot-canvas {
          position: absolute; inset: -15%; display: block; width: 130%; height: 130%; object-fit: contain; pointer-events: none;
          filter: drop-shadow(0 9px 12px rgba(0, 0, 0, 0.4)) drop-shadow(0 0 5px rgba(0, 207, 255, 0.16));
        }
        .robot-card .robot-canvas.robot-canvas-angry { filter: drop-shadow(0 10px 20px rgba(56, 124, 255, 0.45)); }
        .robot-fx { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
        .robot-canvas-fun { animation: robot-bounce 0.6s ease; }
        .robot-canvas-collapse { animation: robot-collapse 1.2s ease forwards; }
        .robot-canvas-reappear { animation: robot-reappear 0.6s ease; }
        .robot-bubble {
          position: absolute; width: 10px; height: 10px; border-radius: 999px;
          background: radial-gradient(circle at 30% 30%, rgba(220, 246, 255, 0.9), rgba(0, 207, 255, 0.4));
          opacity: 0; pointer-events: none; animation: robot-bubble 0.9s ease forwards;
        }
        .robot-bubble.robot-bubble-angry { background: radial-gradient(circle at 30% 30%, rgba(210, 230, 255, 0.9), rgba(56, 124, 255, 0.35)); }
        .robot-pop {
          position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
          font-size: 12px; letter-spacing: 0.4px; padding: 4px 8px; border-radius: 999px; white-space: nowrap;
          background: rgba(8, 24, 40, 0.88); border: 1px solid rgba(0, 207, 255, 0.5); color: #d9f5ff;
          animation: robot-pop 0.9s ease forwards; pointer-events: none;
        }
        @keyframes robot-bounce { 0% { transform: scale(1); } 35% { transform: scale(1.04); } 70% { transform: scale(0.98); } 100% { transform: scale(1); } }
        @keyframes robot-collapse { 0% { opacity: 1; transform: scale(1); } 40% { opacity: 0.2; transform: scale(0.94); } 100% { opacity: 0; transform: scale(0.9); } }
        @keyframes robot-reappear { 0% { opacity: 0; transform: scale(0.92); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes robot-bubble { 0% { opacity: 0; transform: translateY(0) scale(0.6); } 40% { opacity: 0.8; } 100% { opacity: 0; transform: translateY(-16px) scale(1.1); } }
        .robot-say {
          position: absolute; left: 50%; bottom: calc(100% + 4px); width: max-content; max-width: min(230px, 62vw); padding: 8px 12px; border-radius: 14px;
          font-size: 12px; line-height: 1.4; letter-spacing: 0; text-align: left; color: #fff; pointer-events: none;
          background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.4);
          -webkit-backdrop-filter: blur(14px) saturate(1.4); backdrop-filter: blur(14px) saturate(1.4);
          box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.4), 0 8px 24px rgba(0, 0, 0, 0.28); text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
          transform: translateX(-30%); opacity: 0; animation: robot-say 4s ease forwards;
        }
        @keyframes robot-say { 0% { opacity: 0; transform: translate(-30%, 8px) scale(0.96); } 6%, 92% { opacity: 1; transform: translate(-30%, 0) scale(1); } 100% { opacity: 0; transform: translate(-30%, -6px) scale(0.98); } }
        @keyframes robot-pop { 0% { opacity: 0; transform: translate(-50%, 6px); } 30% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -12px); } }
        /* Metric glass widgets */
        /* widgets use the same background + blur as the chat box / popups */
        .metric-card.glass { color: #fff; background: var(--pop-bg); -webkit-backdrop-filter: var(--pop-blur); backdrop-filter: var(--pop-blur); }
        .metric-card { display: flex; }
        /* the desktop widget column sits inside a pointer-events:none wrapper, which made the player and widgets unclickable; give the cards their pointer back */
        @media (min-width: 1024px) { .metric-card { pointer-events: auto; } }
        .metric-pill { align-items: center; gap: 10px; padding: 8px 14px 8px 10px; }
        .metric-box { flex-direction: column; justify-content: space-between; padding: 11px 14px 10px; min-height: 100px; }
        .metric-label { font-family: 'Josefin Sans', 'JetBrains Mono', sans-serif; font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; line-height: 1.25; color: rgba(255, 255, 255, 0.82); }
        .metric-value { font-size: 17px; font-weight: 600; letter-spacing: -0.02em; line-height: 1; color: #fff; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35); }
        .metric-value-lg { font-size: 22px; }
        @media (max-width: 1023px) {
          .metric-pill { gap: 6px; padding: 5px 10px 5px 6px; }
          .metric-pill svg { width: 28px; height: 28px; }
          .metric-box { min-height: 68px; padding: 7px 9px; }
          .metric-label { font-size: 7.5px; letter-spacing: 0.08em; }
          .metric-value { font-size: 12.5px; }
          .metric-value-lg { font-size: 15px; }
          .info-card { font-size: 7.2px; }
        }
        /* Info row: clock, weather, calendar */
        .info-card { font-size: 9.5px; font-family: 'Josefin Sans', 'JetBrains Mono', sans-serif; }
        .info-card p { margin: 0; }
        .metrics-scale { transform-origin: bottom right; }
        @media (min-width: 1024px) and (max-height: 820px) { .metrics-scale { transform: scale(0.86); } }
        @media (min-width: 1024px) and (max-height: 700px) { .metrics-scale { transform: scale(0.74); } }
        .clock-card { align-self: stretch; align-items: center; justify-content: space-between; gap: 0.4em; padding: 0.95em 1.2em; }
        .seg-digit { width: 2.3em; height: 3.9em; flex: none; overflow: visible; filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 7px rgba(255, 255, 255, 0.55)); }
        /* stroke fattens each segment so the digits read bold */
        .seg-on { fill: #fff; stroke: #fff; stroke-width: 1.5; stroke-linejoin: round; }
        .seg-off { fill: rgba(255, 255, 255, 0.1); }
        .clock-colon { display: flex; flex-direction: column; gap: 0.8em; }
        .clock-colon i { width: 0.5em; height: 0.5em; border-radius: 50%; background: #fff; box-shadow: 0 0 3px #fff, 0 0 9px rgba(255, 255, 255, 0.85); animation: colon-blink 1s steps(1) infinite; }
        @keyframes colon-blink { 50% { opacity: 0.2; } }
        .clock-ampm { display: flex; flex-direction: column; justify-content: center; gap: 0.35em; margin-left: 0.15em; }
        .clock-ampm b { font-size: 1.05em; font-weight: 800; letter-spacing: 0.08em; line-height: 1; color: rgba(255, 255, 255, 0.28); }
        .clock-ampm b.is-on { color: #fff; text-shadow: 0 0 3px #fff, 0 0 9px rgba(255, 255, 255, 0.8); }
        /* Music player (full-width row, same width / radius / padding as the clock) */
        .player-card.glass {
          flex-direction: column; gap: 0.85em; padding: 0.95em 1.2em; color: #fff;
        }
        .player-card .fx-layer::after { padding: 5px; filter: blur(4px); }
        .pl-top { display: flex; align-items: center; gap: 0.9em; min-width: 0; }
        .pl-cover { width: 4.6em; height: 4.6em; flex: none; object-fit: cover; border-radius: 0.8em; display: block; box-shadow: 0 0 10px rgba(255, 138, 31, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.35); }
        .pl-cover-empty { background: linear-gradient(135deg, #ff8a1f, #3ad8ff); }
        .pl-meta { flex: 1; min-width: 0; }
        .pl-title { font-size: 1.5em; font-weight: 800; letter-spacing: 0.04em; line-height: 1.15; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 0 8px rgba(255, 255, 255, 0.45); }
        .pl-artist { font-size: 1.05em; margin-top: 0.25em; color: #6ff3ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 0 6px rgba(60, 220, 255, 0.85); }
        .pl-btn { display: grid; place-items: center; padding: 0; border: 0; background: transparent; color: #fff; cursor: pointer; transition: transform 0.2s ease, opacity 0.2s ease, background-color 0.2s ease; }
        .pl-btn:hover:not(:disabled) { transform: scale(1.08); }
        .pl-btn:disabled { opacity: 0.4; cursor: default; }
        .pl-btn:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 2px; }
        .pl-round { flex: none; width: max(3.6em, 28px); height: max(3.6em, 28px); border-radius: 50%; border: 1.5px solid; background: rgba(255, 255, 255, 0.06); }
        .pl-play { border-color: #ff8a1f; color: #ffe0bd; }
        .pl-pause { border-color: #4de6ff; color: #c9f8ff; }
        .pl-play.is-active { background: rgba(255, 138, 31, 0.28); box-shadow: 0 0 5px #ff8a1f, 0 0 14px rgba(255, 138, 31, 0.8); }
        .pl-pause.is-active { background: rgba(60, 220, 255, 0.25); box-shadow: 0 0 5px #3ad8ff, 0 0 14px rgba(60, 220, 255, 0.8); }
        .pl-seek { display: flex; align-items: center; gap: 0.8em; }
        .pl-time { flex: none; min-width: 2.6em; font-size: 1em; font-variant-numeric: tabular-nums; color: rgba(255, 255, 255, 0.9); }
        .pl-time:last-child { text-align: right; }
        .pl-range { -webkit-appearance: none; appearance: none; flex: 1; min-width: 0; height: 4px; margin: 0; border-radius: 999px; outline: none; cursor: pointer;
          background: linear-gradient(90deg, #ff8a1f 0%, #00cfff var(--p, 0%), rgba(255, 255, 255, 0.22) var(--p, 0%)); box-shadow: 0 0 8px rgba(255, 138, 31, 0.45); }
        .pl-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 11px; height: 11px; border-radius: 50%; background: #fff; border: 0; box-shadow: 0 0 4px #fff, 0 0 10px #3ad8ff; }
        .pl-range::-moz-range-thumb { width: 11px; height: 11px; border-radius: 50%; background: #fff; border: 0; box-shadow: 0 0 4px #fff, 0 0 10px #3ad8ff; }
        .pl-range:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 4px; }
        .pl-ctrl { display: flex; align-items: center; justify-content: space-between; padding: 0 1.2em; }
        .pl-mini { width: 28px; height: 24px; color: rgba(255, 255, 255, 0.9); }
        .pl-mini.is-on { color: #6ff3ff; filter: drop-shadow(0 0 4px #3ad8ff) drop-shadow(0 0 8px rgba(60, 220, 255, 0.8)); }
        .clock-card .fx-layer::after, .cal-card .fx-layer::after, .wx-card .fx-layer::after { padding: 5px; filter: blur(4px); }
        .wx-card, .cal-card { flex-direction: column; padding: 0.95em 1.05em; }
        .wx-card { justify-content: space-between; gap: 0.7em; }
        .wx-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5em; }
        .wx-city { font-size: 1em; opacity: 0.9; }
        .wx-temp { font-size: 2.7em; font-weight: 500; text-shadow: 0 0 10px rgba(255, 255, 255, 0.45); line-height: 1.05; letter-spacing: -0.04em; }
        .wx-now { display: flex; flex-direction: column; align-items: flex-end; text-align: right; gap: 0.2em; font-size: 0.9em; line-height: 1.25; }
        .wx-days { display: flex; flex-direction: column; gap: 0.6em; border-top: 1px solid rgba(255, 255, 255, 0.28); padding-top: 0.65em; }
        .wx-day { display: grid; grid-template-columns: 2.2em 1.4em 1.9em 1fr 1.9em; align-items: center; gap: 0.4em; font-size: 0.95em; }
        .wx-min { text-align: right; opacity: 0.8; }
        .wx-bar { position: relative; height: 0.36em; border-radius: 999px; background: rgba(255, 255, 255, 0.22); }
        .wx-bar i { position: absolute; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg, #ffe14d, #ff7a00); box-shadow: 0 0 4px #ff9d1f, 0 0 10px rgba(255, 138, 31, 0.85); }
        .cal-title { font-size: 1.15em; font-weight: 800; letter-spacing: 0.08em; text-shadow: 0 0 8px rgba(255, 255, 255, 0.5); margin-bottom: 0.6em; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 0.25em; text-align: center; }
        .cal-head { font-size: 0.85em; font-weight: 700; opacity: 0.85; padding-bottom: 0.2em; }
        .cal-day { height: 1.7em; line-height: 1.7em; }
        .cal-weekend { opacity: 0.55; }
        .cal-today { width: 1.7em; margin: 0 auto; border-radius: 50%; background: #ffd400; color: #5a2a00; font-weight: 800; opacity: 1; box-shadow: 0 0 4px #ffd400, 0 0 12px rgba(255, 196, 0, 0.9); }
        /* Mobile: every widget lives in one liquid-glass panel that slides in from the << button */
        .metrics-panel > .fx-layer { display: none; }
        @media (max-width: 639px) {
          .metrics-panel {
            --tr: 15%;
            position: relative; isolation: isolate; padding: 12px;
            border-radius: 24px; overflow-x: hidden; overflow-y: auto; color: #fff;
            /* only this panel scrolls: it stops at the bottom of the screen and keeps its own scroll */
            max-height: calc(var(--app-h, 100dvh) - 148px - 16px);
            overscroll-behavior: contain; touch-action: pan-y; -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            /* same glass recipe as .info-pop */
            background: rgba(40, 6, 6, 0.18);
            -webkit-backdrop-filter: blur(24px) saturate(1.5); backdrop-filter: blur(24px) saturate(1.5);
            border: 1px solid rgba(255, 255, 255, 0.35);
            box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.5), inset -1px -1px 1px rgba(255, 255, 255, 0.2), 0 24px 60px rgba(0, 0, 0, 0.35);
            transform-origin: top right;
            clip-path: inset(0 0 100% 100% round 28px);
            transform: translate(8px, -12px) scale(0.55);
            opacity: 0; visibility: hidden; pointer-events: none;
            transition: clip-path 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease, visibility 0s linear 0.6s;
          }
          .metrics-panel.is-open {
            clip-path: inset(0 0 0 0 round 24px);
            transform: none; opacity: 1; visibility: visible; pointer-events: auto;
            transition: clip-path 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease, visibility 0s;
          }
          .metrics-panel > .fx-layer { display: none; }
          .metrics-panel::-webkit-scrollbar { display: none; }
        }
        .widgets-btn svg { transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
        .widgets-btn.is-open svg { transform: rotate(180deg); }
        /* Info button + mesh popup (pulls out of the button) */
        /* iridescent ring border (active nav item, info button, mobile << button) */
        .ring-btn {
          position: relative; isolation: isolate;
          background: radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.12), rgba(10, 10, 12, 0.45) 75%) !important;
          box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.12), 0 0 12px rgba(255, 170, 60, 0.12);
        }
        .ring-btn::before, .ring-btn::after {
          content: ''; position: absolute; inset: 0; border-radius: 50%; pointer-events: none; z-index: 0;
          background: conic-gradient(from 300deg, #fff3b0 0deg, #ffc23d 22deg, #ff6a1f 48deg, #ff2b3a 74deg, #3b1d78 100deg, #1b4dff 135deg, #0b1b55 175deg, #1fc8ff 215deg, #3b7bff 245deg, #ff8a1f 280deg, #ff3a2a 305deg, #2a52ff 335deg, #fff3b0 360deg);
        }
        .ring-btn::before {
          padding: 2px;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude;
        }
        .ring-btn::after {
          z-index: -1; inset: -2px; padding: 3px; filter: blur(5px); opacity: 0.75;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude;
        }
        .ring-btn > svg { position: relative; z-index: 1; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)); }
        /* info + << buttons: same liquid-glass look as the logo menu button, with a periodic shine sweep */
        .shine-btn { overflow: hidden; }
        .shine-btn::after {
          content: ''; position: absolute; top: -25%; bottom: -25%; left: -60%; width: 45%; z-index: 2; pointer-events: none;
          background: linear-gradient(105deg, transparent 0%, rgba(255, 255, 255, 0) 25%, rgba(255, 255, 255, 0.8) 50%, rgba(255, 255, 255, 0) 75%, transparent 100%);
          transform: translateX(0) skewX(-18deg); opacity: 0;
          animation: btn-shine 3.4s ease-in-out infinite;
        }
        .widgets-btn.shine-btn::after { animation-delay: 1.4s; }
        @keyframes btn-shine {
          0%, 52% { transform: translateX(0) skewX(-18deg); opacity: 0; }
          58% { opacity: 1; }
          88% { opacity: 1; }
          100% { transform: translateX(430%) skewX(-18deg); opacity: 0; }
        }
        .info-btn { transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.3s ease; }
        .info-btn:hover { transform: scale(1.06); }
        .info-btn:active { transform: scale(0.95); }
        .info-btn:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 4px; }
        .info-btn.is-open { background: rgba(255, 255, 255, 0.18); }
        .info-pop {
          position: fixed; top: 148px; right: 20px; z-index: 65;
          width: min(340px, calc(100vw - 2.5rem));
          border-radius: 24px; overflow: hidden; isolation: isolate; color: #fff;
          background: rgba(40, 6, 6, 0.18);
          -webkit-backdrop-filter: blur(24px) saturate(1.5); backdrop-filter: blur(24px) saturate(1.5);
          border: 1px solid rgba(255, 255, 255, 0.35);
          box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.5), inset -1px -1px 1px rgba(255, 255, 255, 0.2), 0 24px 60px rgba(0, 0, 0, 0.35);
          transform-origin: top right;
          clip-path: inset(0 0 100% 100% round 28px);
          transform: translate(8px, -12px) scale(0.55);
          opacity: 0; visibility: hidden; pointer-events: none;
          transition: clip-path 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease, visibility 0s linear 0.6s;
        }
        .info-pop.is-open {
          clip-path: inset(0 0 0 0 round 24px);
          transform: none; opacity: 1; visibility: visible; pointer-events: auto;
          transition: clip-path 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease, visibility 0s;
        }
        @media (min-width: 640px) { .info-pop { top: 92px; right: 32px; } }
        @media (min-width: 768px) { .info-pop { right: 48px; } }
        .info-mesh {
          position: absolute; inset: -25%; z-index: -1; filter: blur(14px);
          background:
            radial-gradient(45% 45% at 18% 15%, rgba(255, 170, 70, 0.75), transparent 70%),
            radial-gradient(45% 45% at 85% 22%, rgba(255, 60, 100, 0.65), transparent 70%),
            radial-gradient(50% 50% at 80% 88%, rgba(170, 70, 255, 0.55), transparent 70%),
            radial-gradient(45% 45% at 15% 85%, rgba(255, 215, 130, 0.5), transparent 70%);
          animation: mesh-drift 12s ease-in-out infinite alternate;
        }
        @keyframes mesh-drift { 0% { transform: translate(-4%, -3%) rotate(0deg) scale(1); } 100% { transform: translate(4%, 3%) rotate(14deg) scale(1.12); } }
        .info-body { position: relative; padding: 20px 22px 18px; }
        .info-head { display: flex; align-items: flex-start; gap: 14px; }
        .info-head-text { flex: 1 1 0; min-width: 0; }
        .info-video {
          position: relative; flex: none; width: 132px; height: 100px; overflow: hidden; border-radius: 16px;
          background: rgba(255, 255, 255, 0.12);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4), 0 8px 22px rgba(0, 0, 0, 0.3);
        }
        .info-video video { display: block; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.6s ease; }
        .info-video.is-ready video { opacity: 1; }
        .info-video.is-loading::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(110deg, transparent 20%, rgba(255, 255, 255, 0.35) 50%, transparent 80%);
          background-size: 200% 100%; animation: video-shimmer 1.4s linear infinite;
        }
        .info-video.is-error { display: none; }
        @keyframes video-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        .info-sound {
          position: absolute; right: 6px; bottom: 6px; z-index: 1; display: none; align-items: center; justify-content: center;
          width: 24px; height: 24px; border: 0; border-radius: 50%; cursor: pointer; color: #fff;
          background: rgba(0, 0, 0, 0.35); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
        }
        .info-video.is-ready .info-sound { display: flex; }
        .info-sound:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 2px; }
        .info-kicker { font-family: 'Josefin Sans', 'JetBrains Mono', sans-serif; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255, 255, 255, 0.8); }
        .info-title { margin-top: 8px; font-size: 20px; font-weight: 600; letter-spacing: -0.04em; line-height: 1.15; text-shadow: 0 1px 6px rgba(0, 0, 0, 0.3); }
        .info-role { margin-top: 2px; font-family: 'Josefin Sans', 'JetBrains Mono', sans-serif; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255, 255, 255, 0.85); }
        .info-text { margin-top: 12px; font-size: 12.5px; line-height: 1.6; color: rgba(255, 255, 255, 0.9); }
        .info-list { margin: 14px 0 0; padding: 12px 0 0; list-style: none; border-top: 1px solid rgba(255, 255, 255, 0.3); display: flex; flex-direction: column; gap: 8px; }
        .info-list li { position: relative; padding-left: 16px; font-size: 11.5px; line-height: 1.45; color: rgba(255, 255, 255, 0.88); }
        .info-list li::before { content: ''; position: absolute; left: 0; top: 0.5em; width: 6px; height: 6px; border-radius: 50%; background: #e6e8eb; box-shadow: 0 0 6px rgba(174, 179, 187, 0.9); }
        .info-foot { margin-top: 14px; font-family: 'Josefin Sans', 'JetBrains Mono', sans-serif; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255, 255, 255, 0.6); }
        @media (prefers-reduced-motion: reduce) {
          .info-mesh, .clock-colon i, .info-video.is-loading::after { animation: none; }
          .info-pop, .info-pop.is-open, .metrics-panel, .metrics-panel.is-open { transition-duration: 0.01s; }
        }
        .ring-fill { stroke-dashoffset: var(--off); animation: ring-fill 1.6s cubic-bezier(0.22, 1, 0.36, 1) 1.3s backwards; }
        @keyframes ring-fill { from { stroke-dashoffset: var(--c); } }
        .chart-line { stroke-dasharray: 1; stroke-dashoffset: 0; animation: chart-draw 1.8s ease-out 1.4s backwards; }
        @keyframes chart-draw { from { stroke-dashoffset: 1; } }
        .chart-area { animation: chart-fade 1.2s ease-out 2s backwards; }
        @keyframes chart-fade { from { opacity: 0; } }
        .chart-bar { transform-origin: bottom; animation: bar-grow 0.7s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
        @keyframes bar-grow { from { transform: scaleY(0); } }
        @media (prefers-reduced-motion: reduce) { .ring-fill, .chart-line, .chart-area, .chart-bar { animation: none; } }
        /* "the digital signature of Suresh" tagline */
        @property --mask-progress { syntax: '<percentage>'; inherits: false; initial-value: 12%; }
        .title {
          overflow: hidden; padding: 0.5em 0.2em; color: #fff;
          font-family: 'Poppins', sans-serif; font-weight: 300; letter-spacing: 0.02em;
          font-size: clamp(0.6rem, 0.45vw + 0.42rem, 0.8rem);
        }
        .title span { position: relative; color: #fff700; font-family: 'Ngopie', cursive; font-size: 1.8em; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45); }
        .title span:before {
          content: ''; position: absolute; top: 20%; left: 23%; translate: -40% 0;
          width: 350%; aspect-ratio: 1 / 1; z-index: -1;
          border: 0.9em solid #eb0027; border-radius: 50%; opacity: 1;
          transition: --mask-progress 0.5s; transition-delay: 0.3s;
          -webkit-mask-image: conic-gradient(from -27deg, #000 var(--mask-progress), #0000 0);
          mask-image: conic-gradient(from -27deg, #000 var(--mask-progress), #0000 0);
        }
        @starting-style { .title span:before { --mask-progress: 0%; } }
        @media (max-width: 768px) { .title span:before { border-width: 0.6em; } }
        .sig-img {
          --p: 0%;
          -webkit-mask-image: linear-gradient(90deg, #000 calc(var(--p) - 18%), transparent var(--p));
          mask-image: linear-gradient(90deg, #000 calc(var(--p) - 18%), transparent var(--p));
          filter: drop-shadow(0 0 6px rgba(255,255,255,0.55));
        }
        .sig-line { opacity: 0; font-family: 'Josefin Sans', 'JetBrains Mono', sans-serif; text-transform: uppercase; }

        .cv-pop { width: min(900px, calc(100vw - 2.5rem)); height: min(88dvh, 880px); }
        .cv-head-actions { display: flex; align-items: center; gap: 8px; }
        .cv-pages { display: flex; flex-direction: column; gap: 14px; }
        .cv-page { display: block; width: 100%; height: auto; border-radius: 10px; background: #fff; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); }
        @media (max-width: 639px) {
          .cv-pop { width: calc(100vw - 1.5rem); height: 86dvh; }
          .cv-pages { gap: 10px; }
          .cv-page { border-radius: 6px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .shine-btn::after { animation: none; opacity: 0; }
          .lb, .lb-panel { animation: none; }
        }
        /* GitHub showcase popup (glassmorphic, same look as the showcase page) */
        .case-pop.gh-pop { width: min(1240px, calc(100vw - 2.5rem)); height: min(88dvh, 860px); }
        /* minimal tint per popup, matching its nav icon glow */
        .case-pop.pop-pink {
          background: linear-gradient(145deg, rgba(255, 92, 207, 0.1), rgba(255, 31, 168, 0.03) 60%), rgba(40, 6, 20, 0.2);
          border-color: rgba(255, 123, 213, 0.38);
          box-shadow: inset 1px 1px 1px rgba(255, 210, 240, 0.45), inset -1px -1px 1px rgba(255, 123, 213, 0.2), 0 24px 70px rgba(0, 0, 0, 0.4), 0 0 38px rgba(255, 31, 168, 0.12);
        }
        .case-pop.pop-yellow {
          background: linear-gradient(145deg, rgba(255, 214, 0, 0.09), rgba(255, 176, 0, 0.03) 60%), rgba(40, 24, 4, 0.2);
          border-color: rgba(255, 225, 77, 0.38);
          box-shadow: inset 1px 1px 1px rgba(255, 244, 176, 0.45), inset -1px -1px 1px rgba(255, 225, 77, 0.2), 0 24px 70px rgba(0, 0, 0, 0.4), 0 0 38px rgba(255, 176, 0, 0.12);
        }
        .case-pop.pop-green {
          background: linear-gradient(145deg, rgba(0, 255, 136, 0.09), rgba(0, 204, 106, 0.03) 60%), rgba(4, 22, 14, 0.3);
          border-color: rgba(0, 255, 136, 0.34);
          box-shadow: inset 1px 1px 1px rgba(185, 255, 224, 0.45), inset -1px -1px 1px rgba(0, 255, 136, 0.2), 0 24px 70px rgba(0, 0, 0, 0.4), 0 0 38px rgba(0, 255, 136, 0.12);
        }

        .case-pop.pop-purple {
          background: linear-gradient(145deg, rgba(168, 85, 247, 0.1), rgba(124, 58, 237, 0.03) 60%), rgba(22, 8, 40, 0.25);
          border-color: rgba(197, 139, 255, 0.38);
          box-shadow: inset 1px 1px 1px rgba(234, 213, 255, 0.45), inset -1px -1px 1px rgba(168, 85, 247, 0.2), 0 24px 70px rgba(0, 0, 0, 0.4), 0 0 38px rgba(168, 85, 247, 0.14);
        }
        /* Gallery popup: 5 columns on desktop, 3 on tablet, 2 on mobile */
        .case-pop.gal-pop { width: min(1240px, calc(100vw - 2.5rem)); height: min(88dvh, 860px); }
        .gal-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
        .gal-item {
          position: relative; display: block; width: 100%; padding: 0; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 16px; cursor: pointer; color: #fff;
          background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.28);
          box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.35), 0 8px 22px rgba(0, 0, 0, 0.22);
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease;
        }
        .gal-item:hover, .gal-item:focus-visible { transform: translateY(-4px); outline: none; box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.45), 0 12px 28px rgba(0, 0, 0, 0.3), 0 0 22px rgba(168, 85, 247, 0.4); }
        .gal-item img, .gal-item video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.45s ease; }
        .gal-item:hover img, .gal-item:hover video { transform: scale(1.07); }
        .gal-item::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(9, 5, 22, 0.75), transparent 55%); pointer-events: none; }
        .gal-ph { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255, 255, 255, 0.16), rgba(20, 20, 24, 0.6)); }
        .gal-badge {
          position: absolute; top: 8px; left: 8px; z-index: 2; padding: 3px 8px; border-radius: 999px; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase;
          background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.3); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
        }
        .gal-play {
          position: absolute; top: 50%; left: 50%; z-index: 2; width: 42px; height: 42px; margin: -21px 0 0 -21px; display: grid; place-items: center; border-radius: 50%; padding-left: 2px;
          background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.5); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); box-shadow: 0 0 18px rgba(168, 85, 247, 0.55);
        }
        .gal-cap { position: absolute; left: 10px; right: 10px; bottom: 8px; z-index: 2; text-align: left; font-size: 11.5px; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6); }
        /* lightbox (glassmorphic) */
        .lb {
          position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 1rem; font-family: 'Anek Odia', sans-serif; color: #fff;
          background: rgba(8, 3, 20, 0.55); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); animation: lb-fade 0.3s ease both;
        }
        .lb-panel {
          position: relative; max-width: 100%; padding: 10px; border-radius: 26px;
          background: linear-gradient(145deg, rgba(168, 85, 247, 0.16), rgba(255, 255, 255, 0.04) 60%), rgba(22, 8, 40, 0.38);
          -webkit-backdrop-filter: blur(24px) saturate(1.5); backdrop-filter: blur(24px) saturate(1.5);
          border: 1px solid rgba(216, 180, 254, 0.4);
          box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.45), inset -1px -1px 1px rgba(192, 132, 252, 0.2), 0 24px 80px rgba(0, 0, 0, 0.55), 0 0 40px rgba(168, 85, 247, 0.18);
          animation: lb-pop 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .lb-media { display: block; max-width: min(92vw, 1100px); max-height: calc(100dvh - 9rem); border-radius: 18px; object-fit: contain; background: rgba(0, 0, 0, 0.35); }
        .lb-frame { display: block; width: min(92vw, 1000px, calc((100dvh - 9rem) * 16 / 9)); aspect-ratio: 16 / 9; border: 0; border-radius: 18px; background: #000; }
        .lb-fail { max-width: min(86vw, 420px); padding: 36px 24px; text-align: center; font-size: 14px; line-height: 1.5; }
        .lb-fail a { color: #fff; text-decoration: underline; }
        .lb-cap { padding: 10px 8px 2px; text-align: center; font-size: 13px; letter-spacing: -0.01em; color: rgba(255, 255, 255, 0.9); }
        .lb-close { position: absolute; top: -12px; right: -12px; z-index: 2; width: 38px; height: 38px; border: 1px solid rgba(255, 255, 255, 0.35); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); background: rgba(40, 14, 70, 0.55); box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.4), 0 6px 18px rgba(0, 0, 0, 0.4); }
        .lb-close:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 3px; }
        @keyframes lb-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lb-pop { from { opacity: 0; transform: translateY(18px) scale(0.95); } to { opacity: 1; transform: none; } }
        @media (min-width: 640px) and (max-width: 1023px) {
          .gal-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 639px) {
          .case-pop.gal-pop { width: calc(100vw - 1.5rem); height: 86dvh; }
          .gal-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .gal-item { border-radius: 13px; }
          .gal-cap { font-size: 10.5px; left: 8px; right: 8px; }
          .lb-media { max-width: 92vw; }
        }
        .gh-title { font-size: clamp(20px, 3.2vw, 34px); font-weight: 800; letter-spacing: -0.06em; line-height: 1; }
        .gh-title span { color: transparent; background: linear-gradient(100deg, #ffffff, #c9ced6 55%, #8d939c); -webkit-background-clip: text; background-clip: text; }
        .gh-toolbar { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 8px 20px 4px; }
        .gh-section { font-size: 14px; letter-spacing: -0.02em; white-space: nowrap; }
        .gh-section span { color: #747c9d; font-weight: 400; }
        .gh-search {
          width: min(280px, 100%); padding: 10px 14px; border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 14px; outline: none;
          background: rgba(255, 255, 255, 0.08); color: #f7f8ff; font: inherit; font-size: 13px; transition: 0.25s ease;
        }
        .gh-search::placeholder { color: #747c9d; }
        .gh-search:focus { border-color: rgba(154, 124, 255, 0.8); box-shadow: 0 0 0 4px rgba(154, 124, 255, 0.12); }
        .gh-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
        .gh-card {
          position: relative; display: flex; flex-direction: column; min-width: 0; overflow: hidden;
          border-radius: 16px; color: #fff;
          background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.28);
          box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.35), 0 8px 22px rgba(0, 0, 0, 0.22);
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.3s ease;
          animation: gh-card-in 0.55s both;
        }
        .gh-card:hover { transform: translateY(-4px); background: rgba(255, 255, 255, 0.16); }
        @keyframes gh-card-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .gh-img { position: relative; height: 150px; overflow: hidden; background: #191d39; }
        .gh-img::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(9, 11, 22, 0.72), transparent 60%); pointer-events: none; }
        .gh-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.45s ease; }
        .gh-card:hover .gh-img img { transform: scale(1.07); }
        .gh-num {
          position: absolute; z-index: 2; top: 11px; left: 11px; display: grid; width: 28px; height: 28px; place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 9px; background: rgba(8, 10, 21, 0.55);
          -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); color: #fff; font-size: 10px; font-weight: 800;
        }
        .gh-body { position: relative; display: flex; flex: 1; flex-direction: column; padding: 16px; }
        .gh-name { color: #fff; margin-bottom: 8px; font-size: 16px; line-height: 1.25; letter-spacing: -0.04em; font-weight: 700; }
        .gh-desc { min-height: 60px; color: rgba(255, 255, 255, 0.78); font-size: 12.5px; line-height: 1.6; }
        .gh-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0 16px; }
        .gh-tag { padding: 5px 9px; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 999px; background: rgba(255, 255, 255, 0.1); color: #fff; font-size: 10px; font-weight: 700; }
        .gh-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; }
        .gh-src { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(255, 255, 255, 0.55); font-size: 10.5px; }
        .gh-live {
          flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 8px 11px; border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 10px;
          background: rgba(255, 255, 255, 0.14); color: #fff; font-size: 11px; font-weight: 700; text-decoration: none; transition: 0.25s ease;
        }
        .gh-live:hover { background: rgba(255, 255, 255, 0.26); color: #fff; transform: translateX(2px); }
        @media (min-width: 640px) and (max-width: 1179px) {
          .gh-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (min-width: 640px) and (max-width: 819px) {
          .gh-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 639px) {
          .case-pop.gh-pop { width: calc(100vw - 1.5rem); height: 88dvh; }
          .gh-toolbar { flex-direction: column; align-items: stretch; gap: 8px; padding: 6px 14px 2px; }
          .gh-search { width: 100%; }
          .gh-grid { grid-template-columns: 1fr; gap: 14px; }
          .gh-img { height: 190px; }
        }
        /* Behance popup: falls from the top, goes back up */
        .case-pop {
          position: fixed; left: 50%; top: 50%; z-index: 80;
          width: min(1180px, calc(100vw - 2.5rem)); height: min(78dvh, 720px);
          display: flex; flex-direction: column;
          border-radius: 26px; overflow: hidden; isolation: isolate; color: #fff;
          background: rgba(40, 6, 6, 0.2);
          -webkit-backdrop-filter: blur(24px) saturate(1.5); backdrop-filter: blur(24px) saturate(1.5);
          border: 1px solid rgba(255, 255, 255, 0.35);
          box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.5), inset -1px -1px 1px rgba(255, 255, 255, 0.2), 0 24px 70px rgba(0, 0, 0, 0.4);
          transform: translate(-50%, calc(-50% - 115dvh));
          opacity: 0; visibility: hidden; pointer-events: none;
          transition: transform 0.55s cubic-bezier(0.55, -0.25, 0.85, 0.45), opacity 0.4s ease 0.15s, visibility 0s linear 0.6s;
        }
        .case-pop.is-open {
          transform: translate(-50%, -50%);
          opacity: 1; visibility: visible; pointer-events: auto;
          transition: transform 0.85s cubic-bezier(0.34, 1.5, 0.64, 1), opacity 0.25s ease, visibility 0s;
        }
        .case-head { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px 6px; }
        .case-title { font-family: 'Josefin Sans', 'JetBrains Mono', sans-serif; font-size: 13px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255, 255, 255, 0.92); }
        .case-close {
          display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 0; border-radius: 50%; cursor: pointer;
          color: #fff; background: rgba(255, 255, 255, 0.14); transition: background-color 0.25s ease;
        }
        .case-close:hover { background: rgba(255, 255, 255, 0.28); }
        .case-scroll {
          flex: 1 1 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; -webkit-overflow-scrolling: touch;
          padding: 10px 20px 14px; scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.4) transparent;
        }
        .case-scroll::-webkit-scrollbar { width: 6px; }
        .case-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.35); border-radius: 6px; }
        .case-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
        .case-card {
          display: flex; flex-direction: column; overflow: hidden; border-radius: 16px; color: #fff; text-decoration: none;
          background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.28);
          box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.35), 0 8px 22px rgba(0, 0, 0, 0.22);
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.3s ease;
        }
        .case-card:hover, .case-card:focus-visible { transform: translateY(-4px); background: rgba(255, 255, 255, 0.16); outline: none; }
        .case-card img { display: block; width: 100%; aspect-ratio: 404 / 316; object-fit: cover; background: rgba(255, 255, 255, 0.1); }
        .case-card-title { padding: 10px 12px 4px; font-size: 12.5px; font-weight: 500; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .case-card-stats { padding: 0 12px 11px; font-size: 10.5px; color: rgba(255, 255, 255, 0.72); }
        .case-skel { aspect-ratio: 404 / 330; border-radius: 16px; background: linear-gradient(110deg, rgba(255,255,255,0.06) 20%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.06) 80%); background-size: 200% 100%; animation: video-shimmer 1.4s linear infinite; }
        .case-state { padding: 40px 12px; text-align: center; font-size: 13px; color: rgba(255, 255, 255, 0.85); }
        .case-state a, .case-state button { color: #fff; text-decoration: underline; background: none; border: 0; cursor: pointer; font: inherit; }
        .case-foot { flex: none; padding: 9px 16px 13px; text-align: center; font-family: 'Josefin Sans', 'JetBrains Mono', sans-serif; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255, 255, 255, 0.6); border-top: 1px solid rgba(255, 255, 255, 0.18); }
        /* Chat popup next to the robot */
        .chat-pop {
          position: fixed; left: 360px; bottom: 24px; z-index: 85; width: 340px; height: min(72dvh, 500px);
          max-height: calc(var(--app-h, 100dvh) - var(--cb, 24px) - 16px);
          display: flex; flex-direction: column; overflow: hidden; isolation: isolate; color: #fff;
          font-family: 'Poppins', sans-serif; letter-spacing: normal; border-radius: 24px;
          background: linear-gradient(145deg, rgba(255, 138, 31, 0.16), rgba(255, 255, 255, 0.04) 60%), rgba(36, 8, 6, 0.4);
          -webkit-backdrop-filter: blur(24px) saturate(1.5); backdrop-filter: blur(24px) saturate(1.5);
          border: 1px solid rgba(255, 196, 130, 0.42);
          box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.5), inset -1px -1px 1px rgba(255, 190, 120, 0.2), 0 24px 70px rgba(0, 0, 0, 0.4), 0 0 38px rgba(255, 138, 31, 0.14);
          transform-origin: bottom left; transform: translateY(18px) scale(0.92);
          opacity: 0; visibility: hidden; pointer-events: none;
          transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease, visibility 0s linear 0.5s;
        }
        .chat-pop.is-open { transform: none; opacity: 1; visibility: visible; pointer-events: auto; transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease, visibility 0s; }
        .chat-head { flex: none; display: flex; align-items: center; gap: 10px; padding: 12px 14px 10px 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.18); }
        .chat-dot { flex: none; width: 9px; height: 9px; border-radius: 50%; background: #e6e8eb; box-shadow: 0 0 6px #aeb3bb, 0 0 14px rgba(174, 179, 187, 0.7); }
        .chat-title { flex: 1; min-width: 0; }
        .chat-name { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.2; }
        .chat-sub { margin: 2px 0 0; font-family: 'Josefin Sans', sans-serif; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255, 255, 255, 0.72); }
        .chat-list {
          flex: 1 1 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; -webkit-overflow-scrolling: touch;
          display: flex; flex-direction: column; gap: 10px; padding: 14px 14px 8px; scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.4) transparent;
        }
        .chat-list::-webkit-scrollbar { width: 5px; }
        .chat-list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.35); border-radius: 5px; }
        .chat-msg { max-width: 88%; padding: 9px 12px; border-radius: 16px; font-size: 13px; line-height: 1.5; animation: chat-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .chat-msg p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
        .chat-msg--bot { align-self: flex-start; border-bottom-left-radius: 5px; background: rgba(255, 255, 255, 0.16); border: 1px solid rgba(255, 255, 255, 0.28); }
        .chat-msg--user { align-self: flex-end; border-bottom-right-radius: 5px; background: linear-gradient(135deg, rgba(235, 238, 242, 0.34), rgba(110, 116, 126, 0.5)); border: 1px solid rgba(255, 255, 255, 0.4); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
        .chat-typing { display: flex; gap: 5px; padding: 12px 14px; }
        .chat-typing i { width: 6px; height: 6px; border-radius: 50%; background: #fff; opacity: 0.4; animation: chat-dot 1.1s ease-in-out infinite; }
        .chat-typing i:nth-child(2) { animation-delay: 0.15s; }
        .chat-typing i:nth-child(3) { animation-delay: 0.3s; }
        .chat-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .chat-suggest { margin-top: 2px; }
        .chat-chip {
          padding: 6px 11px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 11.5px; color: #fff;
          background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.4); box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.3);
          transition: background-color 0.25s ease, transform 0.25s ease;
        }
        .chat-chip:hover { background: rgba(255, 255, 255, 0.26); transform: translateY(-1px); }
        .chat-chip:focus-visible, .chat-send:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 2px; }
        .chat-form { flex: none; display: flex; align-items: center; gap: 8px; padding: 10px 12px 12px; border-top: 1px solid rgba(255, 255, 255, 0.18); }
        .chat-input {
          flex: 1; min-width: 0; padding: 10px 14px; border-radius: 999px; outline: none; font: inherit; font-size: 13px; color: #fff;
          background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.35); transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .chat-input::placeholder { color: rgba(255, 255, 255, 0.6); }
        .chat-input:focus { border-color: rgba(255, 255, 255, 0.85); box-shadow: 0 0 0 3px rgba(174, 179, 187, 0.25); }
        .chat-send {
          flex: none; display: grid; place-items: center; width: 38px; height: 38px; padding: 0; border: 0; border-radius: 50%; cursor: pointer; color: #fff;
          background: linear-gradient(135deg, #9aa0a8, #43484f); box-shadow: 0 0 10px rgba(174, 179, 187, 0.55); transition: transform 0.25s ease, opacity 0.25s ease;
        }
        .chat-send:hover:not(:disabled) { transform: scale(1.08); }
        .chat-send:disabled { opacity: 0.4; cursor: default; box-shadow: none; }
        @keyframes chat-in { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: none; } }
        @keyframes chat-dot { 0%, 100% { opacity: 0.3; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }
        @media (max-width: 639px) {
          .chat-pop { left: 12px; right: 12px; bottom: 12px; width: auto; height: min(64dvh, 520px); max-height: calc(var(--app-h, 100dvh) - 24px); border-radius: 22px; transform-origin: bottom center; }
          .chat-input { font-size: 16px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .chat-pop, .chat-pop.is-open { transition-duration: 0.01s; }
          .chat-msg, .chat-typing i { animation: none; }
        }
        /* close buttons for the info panel and the mobile widgets panel */
        .info-close-row { display: flex; justify-content: flex-end; margin: -10px -12px 2px 0; }
        .panel-close-row { display: none; }
        @media (max-width: 639px) {
          .panel-close-row { display: flex; justify-content: flex-end; position: sticky; top: 0; z-index: 6; margin: -2px 0 8px; }
          .panel-close-row .case-close { background: rgba(255, 255, 255, 0.22); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
        }
        /* Curtain preloader: frosted-glass panels + speedometer */
        .curtain {
          --g: min(clamp(230px, 24vw, 340px), 70dvh);
          position: fixed; inset: 0; z-index: 200; overflow: hidden; color: #fff;
          font-family: 'Poppins', sans-serif; letter-spacing: normal;
        }
        .curtain.is-open { pointer-events: none; }
        .curtain__panel {
          display: flex; align-items: center; position: absolute; top: 0; width: 50%; height: 100%; z-index: 2;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.06) 45%, rgba(255, 255, 255, 0.12));
          -webkit-backdrop-filter: blur(24px) saturate(160%); backdrop-filter: blur(24px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.28);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), inset 0 -1px 0 rgba(255, 255, 255, 0.08), 0 8px 32px rgba(0, 0, 0, 0.12);
          color: #fff;
          transition: transform 1.2s cubic-bezier(0.77, 0, 0.175, 1), backdrop-filter 1.2s ease, -webkit-backdrop-filter 1.2s ease;
          will-change: transform;
        }
        .curtain__panel--left { left: 0; justify-content: flex-end; padding-right: calc(var(--g) / 2 + 1.75rem); border-right: 1px solid rgba(255, 255, 255, 0.4); }
        .curtain__panel--right { right: 0; justify-content: flex-start; padding-left: calc(var(--g) / 2 + 1.75rem); border-left: 1px solid rgba(255, 255, 255, 0.4); }
        .curtain__panel::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(115deg, rgba(255, 255, 255, 0.14), transparent 35%, transparent 70%, rgba(255, 255, 255, 0.08));
        }
        .curtain.is-open .curtain__panel { -webkit-backdrop-filter: blur(6px) saturate(140%); backdrop-filter: blur(6px) saturate(140%); }
        .curtain.is-open .curtain__panel--left { transform: translateX(-100%); }
        .curtain.is-open .curtain__panel--right { transform: translateX(100%); }
        .curtain__word {
          position: relative; z-index: 1; margin: 0; white-space: nowrap;
          font-size: clamp(1.2rem, 2.5vw, 2.5rem); font-weight: 500; letter-spacing: 1px; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
        }
        .curtain__center {
          position: absolute; left: 50%; top: 50%; z-index: 3; width: var(--g); aspect-ratio: 1; transform: translate(-50%, -50%);
          transition: opacity 0.5s ease, transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .curtain.is-open .curtain__center { opacity: 0; transform: translate(-50%, -50%) scale(1.2); }
        .gauge-disc {
          position: absolute; inset: 0; border-radius: 50%;
          background: radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.12), rgba(24, 4, 8, 0.4) 72%);
          -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.32);
          box-shadow: inset 2px 2px 1px -1px rgba(255, 255, 255, 0.55), inset -2px -2px 1px -1px rgba(255, 255, 255, 0.2), inset 0 0 22px rgba(0, 0, 0, 0.35), 0 18px 50px rgba(0, 0, 0, 0.35), 0 0 44px rgba(255, 138, 31, 0.2);
        }
        .gauge-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
        .gauge-track { fill: none; stroke: rgba(255, 255, 255, 0.16); stroke-width: 5; stroke-linecap: round; }
        .gauge-arc { fill: none; stroke: url(#gauge-grad); stroke-width: 5; stroke-linecap: round; opacity: 0; filter: drop-shadow(0 0 3px rgba(255, 138, 31, 0.95)) drop-shadow(0 0 8px rgba(255, 90, 20, 0.7)); }
        .gauge-tick { stroke: rgba(255, 255, 255, 0.4); stroke-width: 0.9; stroke-linecap: round; }
        .gauge-tick--major { stroke: rgba(255, 255, 255, 0.95); stroke-width: 1.7; }
        .gauge-label { fill: rgba(255, 255, 255, 0.85); font-family: 'Josefin Sans', sans-serif; font-size: 7.5px; text-anchor: middle; dominant-baseline: central; }
        .gauge-needle { fill: #ff8a1f; filter: drop-shadow(0 0 2px #ff8a1f) drop-shadow(0 0 7px rgba(255, 90, 20, 0.95)); }
        .gauge-hub { fill: #2a0a0c; stroke: #ffb347; stroke-width: 1.6; filter: drop-shadow(0 0 4px rgba(255, 138, 31, 0.9)); }
        .gauge-hub-dot { fill: #fff3d6; }
        .gauge-readout { position: absolute; left: 50%; top: 71%; transform: translate(-50%, -50%); display: flex; align-items: baseline; gap: 0.12em; line-height: 1; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .gauge-num { font-size: calc(var(--g) * 0.15); font-weight: 600; letter-spacing: -0.02em; text-shadow: 0 0 12px rgba(255, 255, 255, 0.5); }
        .gauge-lead { opacity: 0.22; }
        .gauge-unit { font-size: calc(var(--g) * 0.06); opacity: 0.8; }
        .gauge-caption { position: absolute; left: 50%; top: 87%; margin: 0; transform: translateX(-50%); font-family: 'Josefin Sans', sans-serif; font-size: calc(var(--g) * 0.036); letter-spacing: 0.3em; text-transform: uppercase; color: rgba(255, 255, 255, 0.78); }
        /* Power button: a round blurred glass disc that masks the speedometer, with a pulsing red neon power icon.
           Pressing it fades the disc away and the gauge starts loading */
        .curtain__enter {
          position: absolute; left: 50%; top: 50%; z-index: 4; margin: 0; padding: 0; width: var(--g); aspect-ratio: 1;
          display: grid; place-items: center; transform: translate(-50%, -50%); isolation: isolate; cursor: pointer; border-radius: 50%;
          background: radial-gradient(circle at 50% 42%, rgba(70, 6, 14, 0.55), rgba(14, 1, 5, 0.82) 78%);
          -webkit-backdrop-filter: blur(22px) saturate(1.3); backdrop-filter: blur(22px) saturate(1.3);
          border: 1px solid rgba(255, 110, 120, 0.3);
          box-shadow: inset 2px 2px 1px -1px rgba(255, 255, 255, 0.5), inset -2px -2px 1px -1px rgba(255, 255, 255, 0.18), inset 0 0 30px rgba(255, 0, 20, 0.18), 0 0 36px rgba(255, 0, 20, 0.22);
          animation: enter-pulse 2s ease-in-out infinite;
          transition: opacity 0.8s ease, transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .curtain__enter:hover { transform: translate(-50%, -50%) scale(1.03); }
        .curtain__enter:active { transform: translate(-50%, -50%) scale(0.98); }
        .curtain__enter:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 5px; }
        /* ring that ping-pongs outward from the disc */
        .curtain__enter::before {
          content: ''; position: absolute; inset: 0; z-index: -1; border-radius: 50%; pointer-events: none;
          border: 2px solid rgba(255, 40, 55, 0.9); opacity: 0; animation: enter-ring 2s ease-out infinite;
        }
        .power-icon {
          width: 46%; height: 46%; overflow: visible; fill: none; stroke-linecap: round; stroke-linejoin: round;
          animation: power-pulse 2s ease-in-out infinite;
        }
        .power-edge { stroke: #6a0010; stroke-width: 9; }
        .power-tube { stroke: #ff2a3a; stroke-width: 5.6; }
        .power-core { stroke: #ffd6d6; stroke-width: 1.7; opacity: 0.95; }
        /* pressed: the disc and icon fade out, uncovering the gauge */
        .curtain__enter.is-started, .curtain.is-open .curtain__enter { opacity: 0; transform: translate(-50%, -50%) scale(1.08); pointer-events: none; animation: none; }
        .curtain__enter.is-started::before, .curtain__enter.is-started .power-icon { animation: none; }
        @keyframes power-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 3px #ff1a2a) drop-shadow(0 0 10px rgba(255, 0, 20, 0.8)) drop-shadow(0 0 22px rgba(255, 0, 20, 0.5)); }
          50% { transform: scale(1.06); filter: drop-shadow(0 0 5px #ff3a48) drop-shadow(0 0 18px rgba(255, 0, 20, 1)) drop-shadow(0 0 46px rgba(255, 0, 20, 0.85)); }
        }
        @keyframes enter-pulse {
          0%, 100% { box-shadow: inset 2px 2px 1px -1px rgba(255, 255, 255, 0.5), inset -2px -2px 1px -1px rgba(255, 255, 255, 0.18), inset 0 0 24px rgba(255, 0, 20, 0.12), 0 0 26px rgba(255, 0, 20, 0.18); }
          50% { box-shadow: inset 2px 2px 1px -1px rgba(255, 255, 255, 0.5), inset -2px -2px 1px -1px rgba(255, 255, 255, 0.18), inset 0 0 44px rgba(255, 0, 20, 0.34), 0 0 60px rgba(255, 0, 20, 0.42); }
        }
        @keyframes enter-ring { 0% { opacity: 0.85; transform: scale(1); } 100% { opacity: 0; transform: scale(1.35); } }
        /* phones: the side words move above and below the gauge / power button, which gets smaller */
        .curtain__stack { display: none; }
        @media (max-width: 639px) {
          .curtain { --g: min(52vw, 40dvh, 220px); }
          .curtain__word { display: none; }
          .curtain__stack {
            display: block; position: absolute; left: 50%; z-index: 3; margin: 0; width: max-content; max-width: calc(100vw - 2rem); text-align: center;
            font-size: clamp(1.35rem, 7.2vw, 2rem); font-weight: 500; letter-spacing: 1px; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
            transition: opacity 0.5s ease, transform 0.9s cubic-bezier(0.22, 1, 0.36, 1);
          }
          .curtain__stack--top { top: calc(50% - var(--g) * 0.68 - 0.5rem); transform: translate(-50%, -100%); }
          .curtain__stack--bottom { top: calc(50% + var(--g) * 0.68 + 0.5rem); transform: translate(-50%, 0); }
          .curtain.is-open .curtain__stack { opacity: 0; }
          .curtain.is-open .curtain__stack--top { transform: translate(-50%, -140%); }
          .curtain.is-open .curtain__stack--bottom { transform: translate(-50%, 40%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .curtain__panel, .curtain__center { transition-duration: 0.01s; }
          .curtain__enter, .curtain__enter::before, .power-icon { animation: none; }
        }
        /* the site waits behind the glass: every animation is held until the curtain starts to open */
        .app-root[data-site="loading"] > :not(.curtain),
        .app-root[data-site="loading"] > :not(.curtain)::before,
        .app-root[data-site="loading"] > :not(.curtain)::after,
        .app-root[data-site="loading"] > :not(.curtain) *,
        .app-root[data-site="loading"] > :not(.curtain) *::before,
        .app-root[data-site="loading"] > :not(.curtain) *::after { animation-play-state: paused !important; }
        .app-root[data-site="loading"] .title span:before { --mask-progress: 0%; transition: none; }
        /* Jom Connect card popup */
        .connect-dialog {
          width: min(30rem, calc(100vw - 2.5rem)); max-width: none; max-height: calc(100dvh - 2rem);
          padding: 0; border: 0; background: transparent; color: #e5e5e5; overflow: visible;
        }
        .connect-dialog::backdrop { background: rgba(0, 0, 0, 0.6); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
        .connect-dialog[open] .conn-card { animation: conn-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes conn-in { from { opacity: 0; transform: translateY(24px) scale(0.96); } to { opacity: 1; transform: none; } }
        .conn-card {
          --cr: clamp(1.75rem, 8vw, 4rem); --ci: clamp(1.25rem, 6vw, 3rem); --pad: clamp(0.6rem, 2.4vw, 1rem);
          position: relative; overflow: clip; padding: var(--pad); border-radius: var(--cr);
          font-family: 'Anek Odia', sans-serif;
          font-size: clamp(0.8rem, min(4.2vw, 2.9dvh), 1.5rem); font-weight: 300; color: #fff;
          /* same liquid-glass recipe as the info / Behance / GitHub popups */
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03) 60%), rgba(255, 255, 255, 0.06);
          -webkit-backdrop-filter: blur(24px) saturate(1.5); backdrop-filter: blur(24px) saturate(1.5);
          border: 1px solid rgba(255, 255, 255, 0.35);
          box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.5), inset -1px -1px 1px rgba(255, 255, 255, 0.2), 0 24px 70px rgba(0, 0, 0, 0.4);
        }
        .conn-inner {
          position: relative; display: grid; grid-template-areas: "stack"; grid-template-rows: minmax(0, 1fr); overflow: clip; border-radius: var(--ci);
          /* portrait (2:3) when there is room, otherwise capped so the whole card always fits the screen */
          height: min(calc((min(30rem, 100vw - 2.5rem) - 2 * var(--pad)) * 1.5), calc(100dvh - 2rem - 2 * var(--pad) - 2px));
          box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.4), inset -1px -1px 1px rgba(255, 255, 255, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.12);
        }
        .conn-inner::after {
          content: ''; position: absolute; inset: 0; border-radius: var(--ci); pointer-events: none;
          -webkit-backdrop-filter: blur(100px); backdrop-filter: blur(100px);
          -webkit-mask: linear-gradient(-14deg, black 30%, transparent 66%); mask: linear-gradient(-14deg, black 30%, transparent 66%);
        }
        .conn-cover { grid-area: stack; display: block; width: 100%; max-width: 100%; height: 100%; min-height: 0; object-fit: cover; object-position: 50% 28%; }
        .conn-body { grid-area: stack; z-index: 1; align-self: end; min-height: 0; padding: 1rem clamp(1rem, 5vw, 2rem); }
        .conn-header, .conn-header .conn-chips { font-family: 'Super Guardian', 'SuperGuardianBackup', sans-serif !important; }
        .conn-header { margin: 0; font-size: 1.6em; font-weight: 400; line-height: 1.15; letter-spacing: 1; }
        .conn-body p { margin-block: 0.7em 0.9em; font-size: 0.72em; line-height: 1.5; color: rgba(255, 255, 255, 0.92); }
        .conn-chips { display: flex; align-items: center; gap: 0.5em; font-weight: 400; color: inherit; text-decoration: none; }
        a.conn-chips:hover { text-decoration: underline; }
        .conn-icon { width: 1em; height: 1em; flex: none; }
        .conn-badge { height: 1.0em; width: auto; flex: none; display: block; user-select: none; opacity: 0.95; }
        .conn-list { display: flex; flex-direction: row; align-items: center; justify-content: flex-start; flex-wrap: nowrap; gap: 1.1em; margin: 0; padding: 0.35em 0 0.2em; list-style: none; font-size: 1em; }
        .conn-social {
          display: grid; place-items: center; width: 2.6em; height: 2.6em; border-radius: 50%; text-decoration: none; color: #fff;
          background: rgba(255, 255, 255, 0.12);
          -webkit-backdrop-filter: blur(14px) saturate(1.4); backdrop-filter: blur(14px) saturate(1.4);
          border: 1px solid rgba(255, 255, 255, 0.32);
          box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.4), inset -1px -1px 1px rgba(255, 255, 255, 0.12), 0 6px 16px rgba(0, 0, 0, 0.18);
          transition: transform 0.3s ease, background-color 0.3s ease;
        }
        .conn-social:hover { transform: translateY(-2px); background: rgba(255, 255, 255, 0.22); }
        .conn-social:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 3px; }
        .conn-social .conn-icon { width: 1.25em; height: 1.25em; color: #fff; }
        .conn-chips:focus-visible, .conn-close:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 3px; }
        .conn-close {
          position: absolute; top: clamp(0.7rem, 3vw, 1.1rem); right: clamp(0.7rem, 3vw, 1.1rem); z-index: 2; display: grid; place-items: center;
          width: clamp(2rem, 7vw, 2.4rem); height: clamp(2rem, 7vw, 2.4rem); border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 50%; cursor: pointer; color: #fff;
          background: rgba(255, 255, 255, 0.14); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
          box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.4);
          transition: background-color 0.3s ease;
        }
        .conn-close:hover { background: rgba(255, 255, 255, 0.26); }
        @media (prefers-reduced-motion: reduce) { .connect-dialog[open] .conn-card { animation: none; } }
        /* Behance + GitHub popups use Anek Odia (CV popup keeps its own fonts) */
        .case-pop.pop-pink, .case-pop.pop-pink *, .case-pop.pop-green, .case-pop.pop-green *, .case-pop.pop-purple, .case-pop.pop-purple * { font-family: 'Anek Odia', sans-serif; }
        @media (min-width: 640px) and (max-width: 1023px) {
          .case-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 639px) {
          .case-pop { width: calc(100vw - 1.5rem); height: 82dvh; border-radius: 22px; }
          .case-head { padding: 14px 14px 4px; }
          .case-scroll { padding: 8px 12px 12px; }
          .case-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .case-card { border-radius: 13px; }
          .case-card-title { font-size: 11px; padding: 8px 9px 3px; }
          .case-card-stats { font-size: 9.5px; padding: 0 9px 9px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .gh-card { animation: none; }
          .case-pop, .case-pop.is-open { transition-duration: 0.01s; }
          .case-skel { animation: none; }
        }

        /* Optical depth: a crisp rim, tinted body, diffuse reflection and grounded shadow. */
        :root {
          --glass-bg: linear-gradient(135deg, rgba(255,255,255,.19), rgba(255,255,255,.035) 48%, rgba(18,12,24,.16));
          --glass-bg-hover: linear-gradient(135deg, rgba(255,255,255,.3), rgba(255,255,255,.08) 48%, rgba(18,12,24,.16));
          --glass-blur: blur(18px) saturate(145%);
          --glass-shadow: inset 0 1px 0 rgba(255,255,255,.65), inset 1px 0 0 rgba(255,255,255,.22), inset 0 -1px 0 rgba(255,255,255,.14), 0 12px 32px rgba(12,4,12,.23);
        }
        .glass {
          background: var(--glass-bg);
          -webkit-backdrop-filter: var(--glass-blur);
          backdrop-filter: var(--glass-blur);
          box-shadow: var(--glass-shadow);
        }
        /* every small button wears the same glass as the info button */
        .case-close, .panel-close-row .case-close, .conn-close, .conn-social, .lb-close, .info-sound, .loader-skip, .gal-play {
          background: var(--glass-bg) !important;
          -webkit-backdrop-filter: var(--glass-blur) !important; backdrop-filter: var(--glass-blur) !important;
          box-shadow: var(--glass-shadow) !important;
          border: 0 !important;
        }
        .case-close:hover, .panel-close-row .case-close:hover, .conn-close:hover, .conn-social:hover, .lb-close:hover, .loader-skip:hover, .gal-play:hover { background: var(--glass-bg-hover) !important; }
        .fx-layer { filter: contrast(1.35); }
        .case-pop, .info-pop, .lb-panel {
          background: linear-gradient(145deg, rgba(43,29,41,.86), rgba(17,15,25,.91));
          -webkit-backdrop-filter: blur(28px) saturate(135%); backdrop-filter: blur(28px) saturate(135%);
          border: 1px solid rgba(255,255,255,.22);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.25), 0 30px 90px rgba(0,0,0,.38);
        }
        .case-head { border-bottom: 1px solid rgba(255,255,255,.12); }
        .case-card, .gh-card { border: 1px solid rgba(255,255,255,.13); border-radius: 18px; overflow: hidden; }
        .case-card:focus-visible, .dock-link:focus-visible, .dock-contact:focus-visible, .loader-skip:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 4px; }
        .experience-dock { position: absolute; z-index: 61; left: 48px; top: 112px; width: 260px; padding: 20px; border: 1px solid rgba(255,255,255,.25); border-radius: 24px; color: white; background: linear-gradient(135deg,rgba(255,255,255,.12),rgba(25,10,23,.28)); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px); box-shadow: inset 0 1px 0 #ffffff40, 0 18px 48px #16071030; }
        .dock-caption { display: block; font-size: 9px; letter-spacing: .16em; color: #ffffffa6; margin-bottom: 14px; }
        .dock-link { width: 100%; display: flex; align-items: center; gap: 12px; padding: 13px 0; background: transparent; color: inherit; border: 0; border-bottom: 1px solid #ffffff20; cursor: pointer; text-align: left; }
        .dock-link span:first-child { font-size: 10px; opacity: .55; }
        .dock-link strong { flex: 1; font-size: 13px; font-weight: 400; }
        .dock-link span:last-child { transition: transform .25s; }
        .dock-link:hover span:last-child { transform: translate(3px,-3px); }
        .dock-contact { border: 0; background: transparent; color: #ffdebd; font: inherit; font-size: 10px; padding: 18px 0 0; cursor: pointer; }
        .sound-preference { position: relative; z-index: 71; display: flex; gap: 8px; align-items: center; border: 0; border-radius: 9999px; padding: 5px 11px; color: yellow; font: inherit; font-size: 6px; cursor: pointer; }
        .sound-preference .fx-layer::before { inset: 2px; filter: blur(3px); }
        .sound-preference .fx-layer::after { padding: 3px; filter: blur(3px); }
        .sound-preference:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 3px; }
        .music-preference { color: #00cfff; text-shadow: 0 0 6px #00cfffaa; }
        .music-preference svg { filter: drop-shadow(0 0 3px #00cfffaa); }
        .loader-heading { position: absolute; z-index: 5; top: max(42px,env(safe-area-inset-top)); left: 0; width: 100%; text-align: center; color: white; pointer-events: none; }
        .loader-heading span { font-size: 9px; letter-spacing: .24em; opacity: .55; }
        .loader-heading p { font-size: clamp(11px,2vw,14px); font-weight: 300; margin-top: 12px; }
        .loader-skip { position: absolute; z-index: 8; bottom: 32px; right: 32px; padding: 12px 18px; border: 1px solid #ffffff35; border-radius: 30px; color: white; background: #ffffff0d; font: inherit; font-size: 11px; cursor: pointer; }
        /* ===== every popup: colourless glass with extra blur (chat, info, Behance, CV, GitHub, gallery, lightbox, notice) ===== */
        :root {
          --pop-bg: linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03) 60%), rgba(12, 12, 14, 0.34);
          --pop-blur: blur(10px) saturate(180%);
          --pop-border: 1px solid rgba(255, 255, 255, 0.28);
          --pop-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.45), inset -1px -1px 1px rgba(255, 255, 255, 0.16), 0 24px 70px rgba(0, 0, 0, 0.4);
        }
        .case-pop, .case-pop.pop-pink, .case-pop.pop-yellow, .case-pop.pop-green, .case-pop.pop-purple, .info-pop, .lb-panel, .chat-pop, .conn-card {
          background: var(--pop-bg);
          -webkit-backdrop-filter: var(--pop-blur); backdrop-filter: var(--pop-blur);
          border: var(--pop-border);
          box-shadow: var(--pop-shadow);
        }
        @media (max-width: 639px) {
          .metrics-panel { background: var(--pop-bg); -webkit-backdrop-filter: var(--pop-blur); backdrop-filter: var(--pop-blur); border: var(--pop-border); box-shadow: var(--pop-shadow); }
        }
        /* the info popup shows the page background through the glass, no colour mesh */
        .info-mesh { display: none; }
        .lb { background: rgba(0, 0, 0, 0.5); }
        @supports not (backdrop-filter: blur(1px)) { .glass, .experience-dock { background-color: rgba(35,20,32,.85); } }
        @media (max-width: 1100px), (max-height: 700px) { .experience-dock { display: none; } }
        @media (prefers-reduced-motion: reduce) { .dock-link span:last-child { transition: none; } .ken-burns { animation: none !important; } }
      `}</style>
      <nav className="pointer-events-none fixed top-5 left-5 right-5 z-50 flex justify-start sm:top-6 sm:left-8 md:left-12" aria-label="Main navigation">
        <div
          ref={navRef}
          className="glass nav-drop pointer-events-auto relative h-14 overflow-hidden text-white transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ width: menuOpen ? 'min(312px, calc(100vw - 2.5rem))' : '56px' }}
        >
          <span className="fx-layer" aria-hidden="true" />
          <button
            type="button"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="nav-items"
            data-sfx="none"
            onClick={() => setMenuOpen((open) => !open)}
            className="absolute inset-y-0 left-0 z-10 flex w-14 items-center justify-center rounded-full"
          >
            <img src={NAV_ICON} alt="" aria-hidden="true" draggable={false} className="h-12 w-12 select-none object-contain" />
          </button>
          <div id="nav-items" className={`relative flex h-full items-center justify-between pl-[56px] pr-3 ${menuOpen ? '' : 'pointer-events-none'}`}>
            {NAV_ITEMS.map(({ label, Icon }, index) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                aria-current={label === 'Module' ? 'page' : undefined}
                tabIndex={menuOpen ? 0 : -1}
                data-sfx="nav"
                onClick={() => navigate(label)}
                style={{ transitionDelay: menuOpen ? `${150 + index * 50}ms` : '0ms' }}
                className={`relative flex h-11 w-11 min-w-0 shrink items-center justify-center rounded-full transition-all duration-300 hover:bg-white/15 ${label === 'Module' ? 'ring-btn' : ''} ${menuOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-50 opacity-0'}`}
              >
                <Icon size={22} strokeWidth={1.75} />
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="pointer-events-none fixed top-[26px] right-[26px] z-[70] sm:top-[30px] sm:right-[34px] md:right-[50px]">
        <button
          type="button"
          aria-label={infoOpen ? 'Close info' : 'About this module'}
          aria-expanded={infoOpen}
          aria-controls="info-popup"
          data-sfx="none"
          onClick={(event) => { event.stopPropagation(); setWidgetsOpen(false); setInfoOpen((open) => !open); }}
          className={`glass shine-btn info-btn pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center text-white ${infoOpen ? 'is-open' : ''}`}
          style={{ '--r': '9999px', '--tr': '15%' } as CSSProperties}
        >
          <span className="fx-layer" aria-hidden="true" />
          <Info size={22} strokeWidth={1.75} />
        </button>
      </div>

      <div className="pointer-events-none fixed top-[82px] right-[26px] z-[70] sm:hidden">
        <button
          type="button"
          aria-label={widgetsOpen ? 'Hide widgets' : 'Show widgets'}
          aria-expanded={widgetsOpen}
          aria-controls="widgets-panel"
          data-sfx="none"
          onClick={(event) => { event.stopPropagation(); setInfoOpen(false); setWidgetsOpen((open) => !open); }}
          className={`glass shine-btn info-btn widgets-btn pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center text-white ${widgetsOpen ? 'is-open' : ''}`}
          style={{ '--r': '9999px', '--tr': '15%' } as CSSProperties}
        >
          <span className="fx-layer" aria-hidden="true" />
          <ChevronsLeft size={20} strokeWidth={1.75} />
        </button>
      </div>

      <div id="info-popup" role="dialog" aria-label="About this module" aria-hidden={!infoOpen} className={`info-pop ${infoOpen ? 'is-open' : ''}`}>
        <div className="info-mesh" aria-hidden="true" />
        <div className="info-body">
          <div className="info-close-row">
            <button type="button" className="case-close" aria-label="Close info" tabIndex={infoOpen ? 0 : -1} onClick={() => setInfoOpen(false)}>
              <X size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="info-head">
            <div className="info-head-text">
              <p className="info-kicker">About</p>
              <h2 className="info-title">Suresh Kaleyannan</h2>
              <p className="info-role">DevOps · Web Developer · MY</p>
            </div>
            <div className={`info-video is-${videoState}`}>
              <video
                id="myVideo"
                ref={videoRef}
                muted
                loop
                playsInline
                preload="none"
                aria-label="Introduction video"
                onLoadedData={() => {
                  setVideoState('ready');
                  if (infoOpenRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) videoRef.current?.play().catch(() => {});
                }}
                onError={() => setVideoState('error')}
              />
              <button
                type="button"
                className="info-sound"
                aria-label={soundOn && effectsOn ? 'Mute video' : 'Unmute video'}
                data-sfx={soundOn ? 'toggleOff' : 'toggleOn'}
                disabled={!effectsOn}
                title={effectsOn ? undefined : 'Turn Sound on first'}
                style={effectsOn ? undefined : { opacity: 0.45 }}
                onClick={(event) => { event.stopPropagation(); setSoundOn((on) => !on); }}
              >
                {soundOn && effectsOn ? <Volume2 size={13} strokeWidth={2} /> : <VolumeX size={13} strokeWidth={2} />}
              </button>
            </div>
          </div>
          <p className="info-text">I bridge today's technology with tomorrow's possibilities, transforming code, design and imagination into digital experiences that push beyond the boundaries of what's possible.</p>
      
           <p className="info-role"> The Digital Dimension of Suresh</p>
       
          <ul className="info-list">
            <li>Where today's technology meets tomorrow's imagination, code becomes possibility, creativity evolves into intelligence, and the digital world becomes a canvas for realities yet to exist.</li>
          </ul>
          <p className="info-foot">www.suresh.app</p>
        </div>
      </div>

      <div ref={casePopRef} id="case-popup" role="dialog" aria-label="Behance portfolio" aria-hidden={!caseOpen} className={`case-pop pop-pink ${caseOpen ? 'is-open' : ''}`}>
        <div className="case-head">
          <h2 className="case-title">Behance Portfolio</h2>
          <button type="button" className="case-close" aria-label="Close portfolio" tabIndex={caseOpen ? 0 : -1} onClick={() => setCaseOpen(false)}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="case-scroll">
          {projectsState === 'error' ? (
            <p className="case-state">
              Couldn't load projects. <button type="button" data-sfx="retry" onClick={loadProjects}>Retry</button> or{' '}
              <a href={BEHANCE_PROFILE} target="_blank" rel="noopener noreferrer">open Behance</a>.
            </p>
          ) : projectsState === 'ready' && projects.length === 0 ? (
            <p className="case-state">No projects yet.</p>
          ) : (
            <div className="case-grid">
              {projectsState === 'ready'
                ? projects.map((project) => (
                    <a key={project.id} className="case-card" href={project.url.trim()} target="_blank" rel="noopener noreferrer" tabIndex={caseOpen ? 0 : -1}>
                      <img src={project.covers['404'] ?? project.covers['230'] ?? project.covers.original} alt="" loading="lazy" draggable={false} />
                      <span className="case-card-title">{project.name}</span>
                      <span className="case-card-stats">{project.stats.views} views and {project.stats.appreciations} likes</span>
                    </a>
                  ))
                : Array.from({ length: 10 }, (_, i) => <div key={i} className="case-skel" aria-hidden="true" />)}
            </div>
          )}
        </div>
        <p className="case-foot">Made with the Behance API</p>
      </div>

      <div ref={cvPopRef} id="cv-popup" role="dialog" aria-label="Curriculum vitae" aria-hidden={!cvOpen} className={`case-pop cv-pop pop-yellow ${cvOpen ? 'is-open' : ''}`}>
        <div className="case-head">
          <h2 className="case-title">Curriculum Vitae</h2>
          <div className="cv-head-actions">
            {cvUrl && (
              <a className="case-close" href={cvUrl} download="Suresh_Kaleyannan_CV.pdf" aria-label="Download CV" title="Download CV" tabIndex={cvOpen ? 0 : -1}>
                <Download size={17} strokeWidth={2} />
              </a>
            )}
            <button type="button" className="case-close" aria-label="Close CV" tabIndex={cvOpen ? 0 : -1} onClick={() => setCvOpen(false)}>
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="case-scroll">
          {cvState === 'error' && (
            <p className="case-state">Couldn't load the CV. <button type="button" data-sfx="retry" onClick={() => { cvStarted.current = true; loadCv(); }}>Retry</button></p>
          )}
          {cvState === 'loading' && <div className="case-skel" style={{ aspectRatio: '595 / 842' }} aria-hidden="true" />}
          <div ref={cvPagesRef} className="cv-pages" style={{ display: cvState === 'error' ? 'none' : undefined }} />
        </div>
        <p className="case-foot">Suresh Kaleyannan · DevOps</p>
      </div>

      <div ref={ghPopRef} id="github-popup" role="dialog" aria-label="GitHub showcase" aria-hidden={!ghOpen} className={`case-pop gh-pop pop-green ${ghOpen ? 'is-open' : ''}`}>
       <div className="case-head">
          <h2 className="case-title">Github Repositories</h2>
          <button type="button" className="case-close" aria-label="Close GitHub showcase" tabIndex={ghOpen ? 0 : -1} onClick={() => setGhOpen(false)}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
       
        <div className="case-scroll">
          <div className="gh-grid">
              {REPOS.map((repo, index) => (
                <article key={repo.slug} className="gh-card" style={{ animationDelay: `${Math.min(index, 12) * 45}ms`, '--img': `url("${repo.image}")` } as CSSProperties}>
                  <div className="gh-img">
                    <span className="gh-num">{String(index + 1).padStart(2, '0')}</span>
                    <img
                      src={repo.image}
                      alt={`${repo.title} repository preview`}
                      loading="lazy"
                      draggable={false}
                      onError={(event) => {
                        const img = event.currentTarget;
                        const step = Number(img.dataset.fallback ?? 0);
                        img.dataset.fallback = String(step + 1);
                        if (step === 0 && repo.image !== GITHUB_IMAGE) img.src = GITHUB_IMAGE;
                        else if (step <= 1) img.src = GITHUB_PREVIEW(repo.slug);
                        else img.style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="gh-body">
                    <h4 className="gh-name">{repo.title}</h4>
                    <p className="gh-desc">{repo.description}</p>
                    <div className="gh-tags">
                      {repo.tech.map((tech) => <span key={tech} className="gh-tag">{tech}</span>)}
                    </div>
                    <div className="gh-foot">
                      <span className="gh-src">github.com/{repo.slug}</span>
                      <a className="gh-live" href={repo.live} target="_blank" rel="noopener noreferrer" tabIndex={ghOpen ? 0 : -1}>See live <span aria-hidden="true">↗</span></a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
        </div>
      </div>

      <div ref={galPopRef} id="gallery-popup" role="dialog" aria-label="Photo and video gallery" aria-hidden={!galOpen} className={`case-pop gal-pop pop-purple ${galOpen ? 'is-open' : ''}`}>
        <div className="case-head">
          <h2 className="case-title">Gallery</h2>
          <button type="button" className="case-close" aria-label="Close gallery" tabIndex={galOpen ? 0 : -1} onClick={() => setGalOpen(false)}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="case-scroll">
          <div className="gal-grid">
            {GALLERY.map((item, index) => (
              <button key={item.src} type="button" className="gal-item" data-sfx="none" aria-label={`Open ${item.title}`} tabIndex={galOpen ? 0 : -1} onClick={() => setLightbox(index)}>
                {galOpen && <GalleryThumb item={item} />}
              </button>
            ))}
          </div>
        </div>
        <p className="case-foot">Photos · GIFs · Videos</p>
      </div>

      {lightbox !== null && GALLERY[lightbox] && (
        <div className="lb" role="dialog" aria-modal="true" aria-label={GALLERY[lightbox].title}>
          <div className="lb-panel">
            <button type="button" className="case-close lb-close" aria-label="Close preview" autoFocus onClick={() => setLightbox(null)}>
              <X size={18} strokeWidth={2} />
            </button>
            <LightboxMedia key={lightbox} item={GALLERY[lightbox]} />
            <p className="lb-cap">{GALLERY[lightbox].title}</p>
          </div>
        </div>
      )}

      <main id="module" className="relative h-full touch-none overflow-hidden">
        <SpotlightBackground active={spotlightActive} controlsTarget={lightingTarget} />
        <Statistics />
        <Metrics open={widgetsOpen} onClose={() => setWidgetsOpen(false)} />
        <section className="absolute bottom-12 left-5 z-50 max-w-[calc(100vw-2.5rem)] sm:bottom-16 sm:left-8 sm:max-w-xl md:bottom-20 md:left-12 md:max-w-2xl" aria-labelledby="hero-title">
          <h1 id="hero-title" className="mb-6 sm:mb-8" style={{ visibility: siteReady ? 'visible' : 'hidden' }}>
            <span className="title-code block" data-spotlight-text="Code">Code</span>
            <span className="title-sub -mt-1 block sm:-mt-2" data-spotlight-text="Beyond Limits." aria-label="Beyond Limits.">Beyond Limits.</span>
          </h1>
          <div className="title hero-rise -mt-7 sm:-mt-10" style={{ animationDelay: '0.5s' }}>the digital signature of 	&nbsp; <span>Suresh</span></div>
          <div ref={signatureRef} className="mb-6 sm:mb-8">
            <img src={SIGNATURE} alt="Suresh signature" draggable={false} className="sig-img w-[100px] select-none sm:w-[150px] md:w-[180px]" />
            <p className="sig-line mt-3 text-[10px] font-normal tracking-[0.1em] text-white sm:text-lg">Suresh Kaleyannan</p>
            <p className="sig-line mt-1 text-[8px] font-normal tracking-[0.16em] text-white/90 sm:text-xs">DevOps - MY</p>
          </div>
          <div className="hero-rise relative inline-block" style={{ animationDelay: '0.7s' }}>
            <button
              type="button"
              data-sfx="none"
              onClick={() => openNotice('connect')}
              className="glass box start-btn"
              style={{ '--w': '0px', '--h': '40px', '--r': '9999px', '--tr': '15%' } as CSSProperties}
            >
              <span className="fx-layer" aria-hidden="true" />
              <span className="btn-label">Jom Connect !</span>
              <span className="btn-icon" aria-hidden="true">
                <Flame className="neon-fire" strokeWidth={1.8} />
              </span>
            </button>
              <div className="mt-5 flex justify-start gap-2 sm:mt-6">
                <button type="button" className="sound-preference glass" aria-label={effectsOn ? 'Mute interface sounds' : 'Enable interface sounds'} aria-pressed={effectsOn} data-sfx="none" onClick={() => sfx.setEnabled(!effectsOn)}>
                  <span className="fx-layer" aria-hidden="true" />{effectsOn ? <Volume2 size={10} /> : <VolumeX size={10} />}<span>Sound</span>
                </button>
                <button type="button" className="sound-preference music-preference glass" aria-label={musicOn ? 'Mute music player' : 'Unmute music player'} aria-pressed={musicOn} data-sfx={musicOn ? 'toggleOff' : 'toggleOn'} onClick={() => music.setEnabled(!musicOn)}>
                  <span className="fx-layer" aria-hidden="true" />{musicOn ? <Music size={10} /> : <VolumeX size={10} />}<span>Music</span>
                </button>
              </div>
            <div ref={setLightingTarget} className="lighting-control-slot" />
            <div className="pointer-events-none absolute left-full top-1/2 -mt-2 w-[100px] -translate-y-1/2 sm:w-[120px]">
              <RobotCard onTouch={() => setChatOpen(true)} />
            </div>
          </div>
        </section>
      </main>


      <ChatPopup open={chatOpen} onClose={() => setChatOpen(false)} onAction={chatAction} />


      <dialog ref={noticeRef} onCancel={(event) => event.preventDefault()} onClose={(event) => { if (notice) event.currentTarget.showModal(); }} className="connect-dialog" aria-labelledby="notice-title">
        <div className="conn-card">
          <div className="conn-inner">
            <img className="conn-cover" src={CONNECT_COVER} alt="" draggable={false} />
            <button type="button" className="conn-close" onClick={() => setNotice(null)} aria-label="Close dialog"><X size={18} strokeWidth={2} /></button>
            <div className="conn-body">
              <h2 id="notice-title" className="conn-header">
                <span className="conn-chips">Suresh Kaleyannan <img className="conn-badge" src={DEVOPS_ICON} alt="DevOps" draggable={false} /></span>
              </h2>
              <p>Building interactive websites with modern frontend technologies, smooth animations, and creative experiences.</p>
              <ul className="conn-list">
                {CONTACTS.map(({ name, href, Icon, external }) => (
                  <li key={name}>
                    <a
                      className="conn-social"
                      href={href}
                      aria-label={name}
                      title={name}
                      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      <Icon className="conn-icon" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
