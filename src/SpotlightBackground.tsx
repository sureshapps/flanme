import { useEffect, useRef, useState } from 'react';
import './SpotlightBackground.css';

const VERTEX = `attribute vec2 position; varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;

// Analytic light volumes in a rolling density field. Both fixtures, their bloom,
// haze and floor pools are accumulated in linear light before tone mapping.
const FRAGMENT = `precision highp float;
varying vec2 uv;
uniform vec2 resolution, keyAim, gelAim;
uniform vec3 keyColour, gelColour, groundColour;
uniform float time, spread, haze, intensity, lamps, strike;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fog(vec2 p){return .42+.36*noise(p*4.+vec2(time*.07,-time*.10))+.22*noise(p*11.-vec2(time*.035,time*.06));}
vec3 beam(vec2 p,vec2 origin,vec2 aim,vec3 colour){
 vec2 ray=aim-origin; float len=length(ray); vec2 d=ray/len;
 vec2 floorPoint=origin+ray*(.94-origin.y)/max(.1,ray.y);
 len=length(floorPoint-origin);
 vec2 q=p-origin; float along=dot(q,d); float side=abs(q.x*d.y-q.y*d.x);
 float width=max(.004,along*spread);
 float cone=exp(-pow(side/width,2.)*2.4)*smoothstep(0.,.12,along)*(1.-smoothstep(len*.92,len*1.25,along));
 float smoke=fog(p+vec2(side*2.,along));
 float shaft=cone*(.13+smoke*haze)*(.65+.35*exp(-along));
 vec2 pool=(p-floorPoint)/vec2(.19+spread,.032+spread*.12);
 float ground=exp(-dot(pool,pool)*1.5)*.65;
 float lampDistance=length(p-origin);
 float bloom=.0035/(lampDistance*lampDistance+.00045);
 float core=exp(-lampDistance*lampDistance/.000055)*3.;
 return colour*(shaft+ground+bloom*.055+core);
}
void main(){
 vec2 p=vec2(uv.x,1.-uv.y);float aspect=resolution.x/resolution.y;
 vec2 world=vec2(p.x*aspect,p.y);
 vec3 c=groundColour*(.65+.35*p.y);
 c+=beam(world,vec2(aspect*.10,.065),vec2(keyAim.x*aspect,keyAim.y),keyColour);
 if(lamps>1.5)c+=beam(world,vec2(aspect*.90,.065),vec2(gelAim.x*aspect,gelAim.y),gelColour);
 c=groundColour+(c-groundColour)*intensity*strike;
 c=vec3(1.)-exp(-c);
 c=pow(max(c,vec3(0.)),vec3(.82));
 gl_FragColor=vec4(c,1.);
}`;

type Point = { x: number; y: number; vx: number; vy: number };
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const interactive = (target: EventTarget | null) => target instanceof Element && !!target.closest('button,a,input,select,textarea,summary,[role="dialog"],[contenteditable="true"]');

export default function SpotlightBackground({ active }: { active: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = useRef({ beams: 2, intensity: 0.85, motion: true });
  const redrawRef = useRef<() => void>(() => {});
  const [beams, setBeams] = useState(2);
  const [intensity, setIntensity] = useState(0.85);
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    settings.current = { beams, intensity, motion };
    redrawRef.current();
  }, [beams, intensity, motion]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const root = host?.closest<HTMLElement>('.app-root');
    if (!host || !canvas || !root) return;
    const headline = root.querySelector<HTMLElement>('#hero-title');
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = query.matches;
    let intersecting = true;
    let raf = 0;
    let disposed = false;
    let elapsed = 0;
    let previous = 0;
    let lastInput = -10;
    let held = false;
    let pulseUntil = 0;
    let pulseTimer = 0;
    let pointerDown: { x: number; y: number; t: number } | null = null;
    let velocity = 0;
    let lastPointerTime = 0;
    let focus = 0;
    let down = false;
    const target = { x: .27, y: .72 };
    const home = { ...target };
    const key: Point = { ...target, vx: 0, vy: 0 };
    const gel: Point = { x: .38, y: .72, vx: 0, vy: 0 };
    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    const shaders: WebGLShader[] = [];
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    let keyColour = [1, .76, .44];
    let gelColour = [.38, .54, 1];
    let groundColour = [.012, .015, .025];
    let haze = .65;
    const parseColour = (value: string, fallback: number[]) => {
      const hex = value.trim().replace('#', '');
      if (/^[a-f\d]{6}$/i.test(hex)) return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
      const rgb = value.match(/[\d.]+/g)?.map(Number);
      return rgb && rgb.length >= 3 ? rgb.slice(0, 3).map(v => v / 255) : fallback;
    };

    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
      if (gl) {
        program = gl.createProgram();
        if (!program) throw Error('No spotlight program');
        for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
          const shader = gl.createShader(type);
          if (!shader) throw Error('No spotlight shader');
          shaders.push(shader);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error('Spotlight shader unavailable');
          gl.attachShader(program, shader);
        }
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Spotlight renderer unavailable');
        gl.useProgram(program);
        buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        const location = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
        for (const name of ['resolution','keyAim','gelAim','keyColour','gelColour','groundColour','time','spread','haze','intensity','lamps','strike']) uniforms[name] = gl.getUniformLocation(program, name);
        host.classList.add('spotlight-webgl');
      }
    } catch {
      host.classList.remove('spotlight-webgl');
      // The CSS lamps remain lit if a driver cannot compile the shader.
    }

    const measure = () => {
      const width = host.clientWidth || innerWidth;
      const height = host.clientHeight || innerHeight;
      const pixelRatio = Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      gl?.viewport(0, 0, canvas.width, canvas.height);
      const rect = headline?.getBoundingClientRect();
      const bounds = root.getBoundingClientRect();
      if (rect && bounds.width && bounds.height) {
        home.x = clamp((rect.left + rect.width * .5 - bounds.left) / bounds.width, .14, .8);
        home.y = clamp((rect.top + rect.height * .55 - bounds.top) / bounds.height, .3, .84);
      }
      const css = getComputedStyle(host);
      keyColour = parseColour(css.getPropertyValue('--spotlight-key'), keyColour);
      gelColour = parseColour(css.getPropertyValue('--spotlight-gel'), gelColour);
      groundColour = parseColour(css.getPropertyValue('--spotlight-ground'), groundColour);
      const cssHaze = Number(css.getPropertyValue('--spotlight-haze'));
      haze = Number.isFinite(cssHaze) ? Math.max(0, cssHaze) : .65;
    };

    const spring = (point: Point, x: number, y: number, dt: number, stiffness: number) => {
      // Slightly underdamped operator heads: momentum survives a stopped pointer.
      point.vx += ((x - point.x) * stiffness - point.vx * 10) * dt;
      point.vy += ((y - point.y) * stiffness - point.vy * 10) * dt;
      point.x += point.vx * dt;
      point.y += point.vy * dt;
    };

    const paint = (now: number) => {
      raf = 0;
      if (disposed || !active || !intersecting || document.hidden) { previous = 0; return; }
      const dt = previous ? Math.min((now - previous) / 1000, .034) : 1 / 60;
      previous = now;
      const auto = settings.current.motion && !reduced;
      if (auto) elapsed += dt;
      const idle = elapsed - lastInput > 3.2;
      let tx = target.x, ty = target.y;
      if (idle) {
        tx = home.x + (auto ? Math.sin(elapsed * .36) * .065 : 0);
        ty = home.y + (auto ? Math.sin(elapsed * .29) * .025 : 0);
      }
      // Lamps strike and enter from opposite wings, cross once, then settle.
      if (auto && elapsed < 1.5) {
        const t = clamp(elapsed / 1.5);
        const ease = t * t * (3 - 2 * t);
        const cross = Math.sin(t * Math.PI) * .22;
        key.x = -.25 + (home.x + .25) * ease + cross;
        gel.x = 1.25 + (home.x + .1 - 1.25) * ease - cross;
        key.y = gel.y = home.y;
      } else if (reduced) {
        key.x = tx; key.y = ty; gel.x = tx + .1; gel.y = ty + .02;
      } else {
        spring(key, tx, ty, dt, 48);
        spring(gel, key.x + .10, key.y + .025, dt, 32);
      }
      const focusTarget = held || now < pulseUntil ? 1 : 0;
      focus = reduced ? focusTarget : focus + (focusTarget - focus) * Math.min(1, dt * 12);
      velocity *= Math.exp(-dt * 5);
      const spread = (.13 + Math.min(.07, velocity * .06)) * (1 - focus * .78);
      host.style.setProperty('--spotlight-intensity', String(settings.current.intensity));
      host.dataset.beams = String(settings.current.beams);
      host.style.setProperty('--spotlight-aim-x', `${key.x * 100}%`);
      host.style.setProperty('--spotlight-aim-y', `${key.y * 100}%`);
      const hit = clamp(1 - Math.hypot(key.x - home.x, key.y - home.y) / .28);
      root.style.setProperty('--spotlight-hit', String(hit * settings.current.intensity));
      const headlineWidth = headline ? headline.offsetWidth / Math.max(1, root.clientWidth) : .4;
      const letterPosition = (x: number) => `${((x - home.x) / Math.max(.1, headlineWidth) + .5) * 100}%`;
      root.style.setProperty('--spotlight-key-x', letterPosition(key.x));
      root.style.setProperty('--spotlight-gel-x', settings.current.beams === 2 ? letterPosition(gel.x) : '-100%');
      if (gl && program && host.classList.contains('spotlight-webgl')) {
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.keyAim, key.x, key.y);
        gl.uniform2f(uniforms.gelAim, gel.x, gel.y);
        gl.uniform3fv(uniforms.keyColour, keyColour);
        gl.uniform3fv(uniforms.gelColour, gelColour);
        gl.uniform3fv(uniforms.groundColour, groundColour);
        gl.uniform1f(uniforms.time, auto ? elapsed : 2);
        gl.uniform1f(uniforms.spread, spread);
        gl.uniform1f(uniforms.haze, haze + Math.min(.5, velocity * .2));
        gl.uniform1f(uniforms.intensity, settings.current.intensity);
        gl.uniform1f(uniforms.lamps, settings.current.beams);
        gl.uniform1f(uniforms.strike, auto ? clamp(elapsed / .18) : 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      const moving = !reduced && (auto || held || now < pulseUntil || Math.hypot(key.vx, key.vy, gel.vx, gel.vy) > .001 || Math.abs(key.x - tx) + Math.abs(key.y - ty) > .001 || focus > .001);
      if (moving) raf = requestAnimationFrame(paint);
    };
    const requestPaint = () => {
      if (!raf && active && intersecting && !document.hidden) raf = requestAnimationFrame(paint);
    };
    redrawRef.current = requestPaint;
    const move = (event: PointerEvent) => {
      if (!active || interactive(event.target) || (event.pointerType === 'touch' && !down)) return;
      const rect = root.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width, .03, .97);
      const y = clamp((event.clientY - rect.top) / rect.height, .22, .96);
      const seconds = lastPointerTime ? clamp((event.timeStamp - lastPointerTime) / 1000, .008, .1) : .05;
      velocity = Math.min(3, Math.hypot(x - target.x, y - target.y) / seconds);
      lastPointerTime = event.timeStamp;
      target.x = x; target.y = y; lastInput = elapsed;
      requestPaint();
    };
    const press = (event: PointerEvent) => {
      if (!active || interactive(event.target)) return;
      down = true; held = event.pointerType !== 'touch';
      pointerDown = { x: event.clientX, y: event.clientY, t: performance.now() };
      move(event); requestPaint();
    };
    const release = (event: PointerEvent) => {
      if (down && event.type !== 'pointercancel' && event.pointerType === 'touch' && pointerDown && performance.now() - pointerDown.t < 350 && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < 16) {
        pulseUntil = performance.now() + 450;
        clearTimeout(pulseTimer);
        pulseTimer = window.setTimeout(requestPaint, 460);
      }
      down = false; held = false; pointerDown = null; requestPaint();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (!active || interactive(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-.045, 0], ArrowRight: [.045, 0], ArrowUp: [0, -.045], ArrowDown: [0, .045] };
      if (arrows[event.key]) {
        event.preventDefault(); const [x, y] = arrows[event.key];
        target.x = clamp(target.x + x, .03, .97); target.y = clamp(target.y + y, .22, .96);
        lastInput = elapsed; requestPaint();
      } else if (event.code === 'Space' || event.key === 'Enter') {
        event.preventDefault(); held = true; lastInput = elapsed; requestPaint();
      }
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.key === 'Enter') { held = false; requestPaint(); }
    };
    const visible = () => { previous = 0; if (document.hidden) { cancelAnimationFrame(raf); raf = 0; held = false; down = false; } else requestPaint(); };
    const blur = () => { held = false; down = false; requestPaint(); };
    const motionChange = () => { reduced = query.matches; previous = 0; requestPaint(); };
    const lost = (event: Event) => { event.preventDefault(); host.classList.remove('spotlight-webgl'); };
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      if (!intersecting) { cancelAnimationFrame(raf); raf = 0; previous = 0; } else requestPaint();
    });
    const resize = new ResizeObserver(() => { measure(); requestPaint(); });
    observer.observe(host); resize.observe(host);
    root.classList.add('spotlight-lit');
    root.addEventListener('pointermove', move, { passive: true });
    root.addEventListener('pointerdown', press, { passive: true });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('keydown', keyboard);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visible);
    query.addEventListener('change', motionChange);
    canvas.addEventListener('webglcontextlost', lost);
    measure(); requestPaint();
    return () => {
      disposed = true; cancelAnimationFrame(raf); clearTimeout(pulseTimer); resize.disconnect(); observer.disconnect();
      root.classList.remove('spotlight-lit'); root.style.removeProperty('--spotlight-hit');
      root.style.removeProperty('--spotlight-key-x'); root.style.removeProperty('--spotlight-gel-x');
      root.removeEventListener('pointermove', move); root.removeEventListener('pointerdown', press);
      window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release);
      window.removeEventListener('keydown', keyboard); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visible); query.removeEventListener('change', motionChange);
      canvas.removeEventListener('webglcontextlost', lost);
      if (gl) { if (buffer) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program); shaders.forEach(s => gl!.deleteShader(s)); gl.getExtension('WEBGL_lose_context')?.loseContext(); }
      host.classList.remove('spotlight-webgl'); redrawRef.current = () => {};
    };
  }, [active]);

  return <>
    <div ref={hostRef} className="spotlight-background" aria-hidden="true" data-beams={beams}>
      <div className="spotlight-css"><i className="spotlight-cone key" /><i className="spotlight-cone gel" /><i className="spotlight-pool key" /><i className="spotlight-pool gel" /><i className="spotlight-lamp key" /><i className="spotlight-lamp gel" /></div>
      <canvas ref={canvasRef} />
    </div>
    <details className="spotlight-controls" data-sfx="none">
      <summary aria-label="Spotlight settings" title="Lighting: drag to aim; hold to focus; arrows and Space also work">Lighting</summary>
      <div className="spotlight-settings">
        <label>Beams<select aria-label="Spotlight beam count" value={beams} onChange={e => setBeams(Number(e.target.value))}><option value={1}>One</option><option value={2}>Two</option></select></label>
        <label>Intensity<input aria-label="Spotlight intensity" type="range" min="0" max="1.5" step="0.05" value={intensity} onChange={e => setIntensity(Number(e.target.value))} /></label>
        <label>Auto motion<input aria-label="Automatic spotlight motion" type="checkbox" checked={motion} onChange={e => setMotion(e.target.checked)} /></label>
        <p>Move or drag to aim. Hold to focus.<br />Arrow keys aim · Space / Enter focus.</p>
      </div>
    </details>
  </>;
}
