import { useEffect, useRef, useState, type CSSProperties } from 'react';
import gsap from 'gsap';
import { ChevronsLeft, Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Flame, Home, Info, Link2, Download, Play, Sun, Volume2, VolumeX, X, type LucideIcon } from 'lucide-react';

const BG_IMAGE_1 = 'https://raw.githubusercontent.com/sureshapps/Skyra/refs/heads/main/public/Img1.webp';
const BG_IMAGE_2 = 'https://raw.githubusercontent.com/sureshapps/Skyra/refs/heads/main/public/Img2.webp';
const NAV_ICON = 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/nv.png';
const SIGNATURE = '/signature.png';
// DevOps badge shown next to the name in the Jom Connect card (put devops.svg in /public)
const DEVOPS_ICON = '/devops.svg';
const CV_SCRIPT = 'https://sureshapps.github.io/JomEdit/cv.js';
// cover photo for the Jom Connect card; swap for your own portrait
const CONNECT_COVER = 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/me.webp';
const PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build';
const CV_URL = 'https://raw.githubusercontent.com/sureshapps/flanme/main/public/cv_devops.pdf';
const NEON_URL = 'https://unpkg.com/threejs-toys@0.0.8/build/threejs-toys.module.cdn.min.js';
// 3D glass photo frame (three.js from esm.sh so the core + addons share one instance)
const THREE_URL = 'https://esm.sh/three@0.170.0';
const THREE_ROUNDED_BOX_URL = 'https://esm.sh/three@0.170.0/examples/jsm/geometries/RoundedBoxGeometry.js';
const THREE_RGBE_URL = 'https://esm.sh/three@0.170.0/examples/jsm/loaders/RGBELoader.js';
const THREE_ROOM_ENV_URL = 'https://esm.sh/three@0.170.0/examples/jsm/environments/RoomEnvironment.js';
const GLASS_ENV_HDR = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/royal_esplanade_2k.hdr';
// photo shown inside the glass frame: swap for any image URL that allows cross-origin loading
// glass look (3D frame): tweak these two
const GLASS_TINT = 0; // smoky body, 0 = fully clear, 0.3 = dark glass
const GLASS_SHINE = 1.7; // reflection / shine strength, 0 = none, 3 = very glossy
const GLASS_PHOTO = 'https://raw.githubusercontent.com/sureshapps/flanme/refs/heads/main/public/designer.webp';
const BEHANCE_USER = 'sureshksmy';
const BEHANCE_KEY = 'yOEjVeOZZg7Wi9bkoW5t37K9GpaAdRnV';
const BEHANCE_PROFILE = `https://www.behance.net/${BEHANCE_USER}`;

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

function BehanceIcon({ size = 22, className = '' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} className={`neon-behance ${className}`} aria-hidden="true" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M1 5a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H5a4 4 0 0 1-4-4V5Zm4-2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M4 7a1 1 0 0 1 1-1h3.5a3.5 3.5 0 1 1 0 7H5a1 1 0 0 1-1-1V7Zm2 1v3h2.5a1.5 1.5 0 0 0 0-3H6Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M4 12a1 1 0 0 1 1-1h3.5a3.5 3.5 0 1 1 0 7H5a1 1 0 0 1-1-1v-5zm2 1v3h2.5a1.5 1.5 0 0 0 0-3H6zm8.768 2H19.5a1 1 0 0 0 1-1 4 4 0 1 0-1.189 2.845l-1.405-1.422A2 2 0 0 1 14.768 15zm1.732-3a2 2 0 0 0-1.732 1h3.464a2 2 0 0 0-1.732-1zM19 9h-5V7h5v2z" />
    </svg>
  );
}

function CvIcon({ size = 22, className = '' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} className={`neon-cv ${className}`} aria-hidden="true" fill="currentColor">
      <path d="M19 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Zm-1 18H6V4h12Zm-9-5h6a1 1 0 0 0 1-1v-1a4 4 0 0 0-1.62-3.2A3 3 0 0 0 15 8a3 3 0 0 0-6 0 3 3 0 0 0 .62 1.8A4 4 0 0 0 8 13v1a1 1 0 0 0 1 1Zm1-2a2 2 0 0 1 4 0Zm1-5a1 1 0 1 1 1 1 1 1 0 0 1-1-1ZM8 18a1 1 0 0 1 1-1h3a1 1 0 0 1 0 2H9a1 1 0 0 1-1-1Zm8 0a1 1 0 1 1-1-1 1 1 0 0 1 1 1Z" />
    </svg>
  );
}

function GithubIcon({ size = 22, className = '' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width={size} height={size} className={`neon-github ${className}`} aria-hidden="true" fill="currentColor">
      <path d="M27.106 0s-2.101 0-4.235 3.2c-1.056-1.057-4.267-1.067-5.331-1.067-1.068 0-4.277.01-5.334 1.067C10.072 0 7.976 0 7.976 0c-1.141 2.864-.248 4.807-.033 5.333C6.877 6.4 5.806 7.467 5.806 12.8s3.878 8.008 8.538 8.533c-.599.521-1.067 2.133-1.067 3.2-1.197.533-4.528 1.045-6.4-2.133 0 0-1.067-2.133-3.2-2.133 0 0-2.133-.201 0 1.067 0 0 1.067 1.067 2.133 3.2 0 0 1.629 4.456 7.467 3.2.012 1.735 0 4.267 0 4.267h8.528v-7.467c0-.844-.466-2.68-1.067-3.2 4.66-.525 8.533-3.2 8.533-8.533 0-5.333-1.067-6.4-2.133-7.467.217-.527 1.108-2.47-.032-5.334z" />
    </svg>
  );
}

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

function GalleryIcon({ size = 22, className = '' }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width={size} height={size} className={`neon-gallery ${className}`} aria-hidden="true" fill="currentColor">
      <path d="M3.3330078,30h20.1806641c0.3935547,0,0.7509766-0.230957,0.9121094-0.5898438l5.0419922-11.2290039c0.3837891-1.1298828,0.1982422-2.3828125-0.4951172-3.3510742c-0.6972656-0.9726562-1.7792969-1.5302734-2.9707031-1.5302734h-7.140625l0.0400391-0.0957031c0.84375-2.0102539,1.3535156-3.2236328,1.3535156-6.0625c0-0.0060425-0.0032959-0.0109863-0.003418-0.0170288c0.0001221-0.0060425,0.003418-0.0111084,0.003418-0.0171509c0-1.75-1.2714844-3.2641602-2.3798828-4.3886719c-0.8759766-0.8852539-2.1953125-0.9570312-3.1425781-0.1674805c-0.8994141,0.7524414-0.9023438,1.8061523-0.9052734,2.652832c-0.0009766,0.2241211-0.0009766,0.4575195-0.0175781,0.6953125l-0.0719604,0.9909058c-0.7571411,1.7475586-1.6392212,2.6170654-2.7503052,3.7014771c-0.5888672,0.574707-1.2558594,1.2260742-1.9541016,2.0698242l-0.5283203,0.6381836h-5.171875c-0.5527344,0-1,0.4477539-1,1V29C2.3330078,29.5522461,2.7802734,30,3.3330078,30z" />
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
  const { media } = item;
  if (media.kind === 'youtube' || media.kind === 'vimeo') {
    return <iframe className="lb-frame" src={media.embed} title={item.title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen />;
  }
  if (media.kind === 'video') {
    return failed ? (
      <div className="lb-fail">
        This browser can't play this video file (AVI is rarely supported).{' '}
        <a href={item.src} target="_blank" rel="noopener noreferrer">Open or download it</a>
      </div>
    ) : (
      <video className="lb-media" src={item.src} controls autoPlay playsInline onError={() => setFailed(true)} />
    );
  }
  return <img className="lb-media" src={item.src} alt={item.title} draggable={false} />;
}

const CONTACTS: { name: string; href: string; Icon: typeof InstagramIcon; glow: string; external: boolean }[] = [
  { name: 'Instagram', href: 'https://www.instagram.com/sureshksmy', Icon: InstagramIcon, glow: 'glow-ig', external: true },
  { name: 'Facebook', href: 'https://www.facebook.com/mesurreshks', Icon: FacebookIcon, glow: 'glow-fb', external: true },
  { name: 'WhatsApp', href: 'https://wa.me/60104368680', Icon: WhatsappIcon, glow: 'glow-wa', external: true },
  { name: 'Email', href: 'mailto:hello@suresh.app', Icon: EmailIcon, glow: 'glow-em', external: false },
];

type Repo = { slug: string; title: string; description: string; tech: string[]; live: string };
const REPOS: Repo[] = [
  { slug: 'shadcn-ui/ui', title: 'shadcn/ui', description: 'Beautifully designed React components that you can copy and customize.', tech: ['React', 'TypeScript', 'Tailwind'], live: 'https://ui.shadcn.com' },
  { slug: 'vercel/next.js', title: 'Next.js', description: 'The React framework for production applications with routing and rendering built in.', tech: ['React', 'TypeScript', 'Node.js'], live: 'https://nextjs.org' },
  { slug: 'vitejs/vite', title: 'Vite', description: 'A fast frontend tooling experience for modern web projects.', tech: ['JavaScript', 'Rollup', 'ESM'], live: 'https://vite.dev' },
  { slug: 'withastro/astro', title: 'Astro', description: 'A content-focused web framework for building fast, flexible websites.', tech: ['JavaScript', 'Islands', 'SSR'], live: 'https://astro.build' },
  { slug: 'mrdoob/three.js', title: 'Three.js', description: 'A JavaScript 3D library that makes it easier to create animated scenes.', tech: ['WebGL', 'JavaScript', '3D'], live: 'https://threejs.org' },
  { slug: 'honojs/hono', title: 'Hono', description: 'A small, simple, and ultrafast web framework for the edge.', tech: ['TypeScript', 'Edge', 'Web APIs'], live: 'https://hono.dev' },
  { slug: 'drizzle-team/drizzle-orm', title: 'Drizzle ORM', description: 'A lightweight TypeScript ORM with a SQL-like developer experience.', tech: ['TypeScript', 'SQL', 'ORM'], live: 'https://orm.drizzle.team' },
  { slug: 'trpc/trpc', title: 'tRPC', description: 'End-to-end typesafe APIs made easy for TypeScript applications.', tech: ['TypeScript', 'RPC', 'React'], live: 'https://trpc.io' },
  { slug: 'colinhacks/zod', title: 'Zod', description: 'TypeScript-first schema validation with static type inference.', tech: ['TypeScript', 'Validation', 'Schemas'], live: 'https://zod.dev' },
  { slug: 'tailwindlabs/tailwindcss', title: 'Tailwind CSS', description: 'A utility-first CSS framework for rapidly building custom interfaces.', tech: ['CSS', 'PostCSS', 'Design'], live: 'https://tailwindcss.com' },
  { slug: 'supabase/supabase', title: 'Supabase', description: 'An open source Firebase alternative built around PostgreSQL.', tech: ['PostgreSQL', 'Auth', 'Realtime'], live: 'https://supabase.com' },
  { slug: 'react-hook-form/react-hook-form', title: 'React Hook Form', description: 'Performant and flexible forms library for React applications.', tech: ['React', 'Forms', 'TypeScript'], live: 'https://react-hook-form.com' },
  { slug: 'TanStack/query', title: 'TanStack Query', description: 'Powerful asynchronous state management for web applications.', tech: ['React', 'Caching', 'State'], live: 'https://tanstack.com/query' },
  { slug: 'lucide-icons/lucide', title: 'Lucide', description: 'Beautiful and consistent open source icons for modern products.', tech: ['SVG', 'Icons', 'React'], live: 'https://lucide.dev' },
  { slug: 'motiondivision/motion', title: 'Motion', description: 'A production-ready animation library for React and the web.', tech: ['React', 'Animation', 'UI'], live: 'https://motion.dev' },
  { slug: 'pmndrs/zustand', title: 'Zustand', description: 'A small, fast, and scalable state management solution for React.', tech: ['React', 'State', 'Hooks'], live: 'https://zustand.docs.pmnd.rs' },
  { slug: 'saadeghi/daisyui', title: 'daisyUI', description: 'Tailwind CSS component classes for building interfaces faster.', tech: ['Tailwind', 'CSS', 'Components'], live: 'https://daisyui.com' },
  { slug: 'microsoft/playwright', title: 'Playwright', description: 'Reliable end-to-end testing for modern web applications.', tech: ['Testing', 'Browser', 'Automation'], live: 'https://playwright.dev' },
  { slug: 'storybookjs/storybook', title: 'Storybook', description: 'Build, test, and document UI components in isolation.', tech: ['React', 'Testing', 'Components'], live: 'https://storybook.js.org' },
  { slug: 'eslint/eslint', title: 'ESLint', description: 'Find and fix problems in JavaScript and TypeScript code.', tech: ['JavaScript', 'Linting', 'Tooling'], live: 'https://eslint.org' },
  { slug: 'prettier/prettier', title: 'Prettier', description: 'An opinionated code formatter that keeps projects consistent.', tech: ['Formatting', 'JavaScript', 'DX'], live: 'https://prettier.io' },
  { slug: 'fastapi/fastapi', title: 'FastAPI', description: 'A modern, fast web framework for building APIs with Python.', tech: ['Python', 'API', 'Async'], live: 'https://fastapi.tiangolo.com' },
  { slug: 'pandas-dev/pandas', title: 'Pandas', description: 'Powerful data structures and analysis tools for Python.', tech: ['Python', 'Data', 'Analytics'], live: 'https://pandas.pydata.org' },
  { slug: 'opencv/opencv', title: 'OpenCV', description: 'Open source computer vision and machine learning software library.', tech: ['C++', 'Python', 'Computer Vision'], live: 'https://opencv.org' },
];

const NAV_ITEMS: { label: string; Icon: LucideIcon | typeof BehanceIcon }[] = [
  { label: 'Module', Icon: Home },
  { label: 'Case Records', Icon: BehanceIcon },
  { label: 'CV', Icon: CvIcon },
  { label: 'GitHub', Icon: GithubIcon },
  { label: 'Gallery', Icon: GalleryIcon },
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
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className="shrink-0 -rotate-90" style={{ filter: `drop-shadow(0 0 4px ${to})` }}>
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
            <stop offset="0%" stopColor="#7dff9b" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#7dff9b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill="url(#speed-fill)" className="chart-area" />
        <path d={line} pathLength={1} fill="none" stroke="#9dffb4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="chart-line" style={{ filter: 'drop-shadow(0 0 3px rgba(125,255,155,0.8))' }} />
        {pts.filter((_, i) => i % 3 === 1 || i === pts.length - 1).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.2" fill="#fff" className="chart-area" />
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
          <span key={i} className="chart-bar flex-1 rounded-[2px]" style={{ height: `${h}%`, background: i % 3 === 1 ? '#ff7a1a' : 'rgba(255,255,255,0.9)', animationDelay: `${1.4 + i * 0.07}s` }} />
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
  const label = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const isAm = now.getHours() < 12;
  return (
    <div className="glass metric-card info-card clock-card info-extra" style={{ '--r': '12px' } as CSSProperties} role="img" aria-label={`Time ${label}`}>
      <span className="fx-layer" aria-hidden="true" />
      <SevenSeg digit={hours.length > 1 ? hours[0] : null} />
      <SevenSeg digit={hours[hours.length - 1]} />
      <span className="clock-colon" aria-hidden="true"><i /><i /></span>
      <SevenSeg digit={minutes[0]} />
      <SevenSeg digit={minutes[1]} />
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

/* Rotating 3D glass photo frame (display only: no controls, no upload) */
/* eslint-disable @typescript-eslint/no-explicit-any */
function GlassFrame({ className = '', style }: { className?: string; style?: CSSProperties }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let raf = 0;
    let teardown: (() => void) | null = null;

    (async () => {
      try {
        const [THREE, { RoundedBoxGeometry }, { RGBELoader }]: any[] = await Promise.all([
          import(/* @vite-ignore */ THREE_URL),
          import(/* @vite-ignore */ THREE_ROUNDED_BOX_URL),
          import(/* @vite-ignore */ THREE_RGBE_URL),
        ]);
        if (disposed) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.02, 200);
        camera.position.set(0, 0, 5.8);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.appendChild(renderer.domElement);
        const draw = () => renderer.render(scene, camera);

        // lights
        scene.add(new THREE.AmbientLight(0xffffff, 0.65));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
        keyLight.position.set(6, 10, 8);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0xffffff, 2.6);
        rimLight.position.set(-6, 3, -10);
        scene.add(rimLight);

        // environment reflections (HDR, with a built-in studio room as fallback)
        new RGBELoader().load(
          GLASS_ENV_HDR,
          (texture: any) => {
            if (disposed) { texture.dispose(); return; }
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.environment = texture;
            if (reduced) draw();
          },
          undefined,
          async () => {
            try {
              const { RoomEnvironment } = await import(/* @vite-ignore */ THREE_ROOM_ENV_URL);
              if (disposed) return;
              const pmrem = new THREE.PMREMGenerator(renderer);
              scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
              pmrem.dispose();
              if (reduced) draw();
            } catch { /* no reflections */ }
          },
        );

        const group = new THREE.Group();
        scene.add(group);

        // liquid glass: a faint smoky body plus an additive layer that only adds clean reflections
        // (no transmission pass, so it stays truly transparent over the hero photo)
        const glassMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color('#070b18'), metalness: 0.0, roughness: 0.05, transparent: true, opacity: GLASS_TINT,
          side: THREE.DoubleSide, depthWrite: false,
        });
        const glassMesh = new THREE.Mesh(new RoundedBoxGeometry(2.1, 2.1, 1.0, 32, 0.26), glassMat);
        glassMesh.renderOrder = 1;
        group.add(glassMesh);

        const shineMat = new THREE.MeshPhysicalMaterial({
          color: 0x000000, metalness: 0.0, roughness: 0.04, ior: 1.5, specularIntensity: 1.0, envMapIntensity: GLASS_SHINE,
          clearcoat: 1.0, clearcoatRoughness: 0.0, iridescence: 0.3, iridescenceIOR: 1.3, iridescenceThicknessRange: [120, 420],
          transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
        });
        const shineMesh = new THREE.Mesh(glassMesh.geometry, shineMat);
        shineMesh.renderOrder = 3;
        group.add(shineMesh);

        // photo: rounded-square silhouette, slightly inset, planar UVs
        const w = 2.1, h = 2.1, r = 0.22, x = -w / 2, y = -h / 2;
        const shape = new THREE.Shape();
        shape.moveTo(x + r, y);
        shape.lineTo(x + w - r, y);
        shape.quadraticCurveTo(x + w, y, x + w, y + r);
        shape.lineTo(x + w, y + h - r);
        shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        shape.lineTo(x + r, y + h);
        shape.quadraticCurveTo(x, y + h, x, y + h - r);
        shape.lineTo(x, y + r);
        shape.quadraticCurveTo(x, y, x + r, y);
        shape.closePath();
        const photoGeo = new THREE.ShapeGeometry(shape, 48);
        photoGeo.center();
        photoGeo.scale(0.97, 0.97, 1);
        photoGeo.computeBoundingBox();
        const bb = photoGeo.boundingBox;
        const pos = photoGeo.attributes.position;
        const uv = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          uv[i * 2] = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1);
          uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1);
        }
        photoGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        photoGeo.computeVertexNormals();
        const photoMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0xffffff, roughness: 0.35, metalness: 0.05, transparent: true, opacity: 1.0 });
        const photoMesh = new THREE.Mesh(photoGeo, photoMat);
        photoMesh.renderOrder = 2;
        photoMesh.visible = false; // until the image has loaded
        group.add(photoMesh);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (disposed) return;
          const size = 1024;
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          const iw = img.naturalWidth || img.width;
          const ih = img.naturalHeight || img.height;
          const scale = Math.max(size / iw, size / ih);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, (size - iw * scale) / 2, (size - ih * scale) / 2, iw * scale, ih * scale);
          const tex = new THREE.CanvasTexture(canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
          photoMat.map = tex;
          photoMat.needsUpdate = true;
          photoMesh.visible = true;
          if (reduced) draw();
        };
        img.src = GLASS_PHOTO;

        const resize = () => {
          const width = host.clientWidth || 1;
          const height = host.clientHeight || 1;
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        const ro = new ResizeObserver(() => { resize(); if (reduced) draw(); });
        ro.observe(host);
        resize();

        const clock = new THREE.Clock();
        let t = 0;
        const tick = () => {
          raf = requestAnimationFrame(tick);
          const dt = Math.min(clock.getDelta(), 0.05);
          if (document.hidden) return;
          t += dt;
          group.rotation.y += dt * 0.45;
          group.rotation.x = Math.cos(t * 0.6) * 0.14;
          group.rotation.z = Math.sin(t * 0.45) * 0.08;
          draw();
        };
        if (reduced) { group.rotation.set(0.1, -0.5, 0); draw(); } else tick();

        teardown = () => {
          ro.disconnect();
          glassMesh.geometry.dispose();
          photoGeo.dispose();
          glassMat.dispose();
          shineMat.dispose();
          photoMat.map?.dispose();
          photoMat.dispose();
          scene.environment?.dispose?.();
          renderer.dispose();
          renderer.domElement.remove();
        };
        if (disposed) teardown();
      } catch {
        /* three.js failed to load: the frame simply doesn't show */
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      teardown?.();
    };
  }, []);

  return <div ref={hostRef} className={`glass-frame ${className}`} style={style} aria-hidden="true" />;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function Metrics({ open }: { open: boolean }) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  return (
    <div className="hero-rise pointer-events-none absolute right-3 top-[148px] z-[55] w-[calc(100vw-1.5rem)] max-w-[300px] sm:hidden lg:right-[5%] lg:top-auto lg:bottom-[7%] lg:block lg:w-[clamp(340px,30vw,500px)] lg:max-w-none" style={{ animationDelay: '1.1s' }}>
      <div id="widgets-panel" className={`metrics-panel ${open ? 'is-open' : ''}`}>
      <span className="fx-layer" aria-hidden="true" />
      <div className="metrics-scale flex flex-col-reverse gap-2 lg:flex-col lg:gap-3">
        {desktop && <GlassFrame className="glass-frame--desktop" />}
        <ClockCard />
        <div className="info-extra grid grid-cols-2 gap-2 lg:gap-3">
          <WeatherCard />
          <CalendarCard />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:gap-3">
          <RingPill id="skills" value={92} label="Skills Level" from="#7dff9b" to="#1fd45a" />
          <RingPill id="creative" value={88} label="Creative Thinking" from="#ff7ad9" to="#b43cff" />
          <SpeedCard />
          <ExperienceCard />
        </div>
      </div>
      </div>
    </div>
  );
}

type Mouth = 'smile' | 'sad' | 'wow' | 'oh';

function RobotCard() {
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
    const dpr = window.devicePixelRatio || 1;
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
    let mouthUntil = 0;
    let frame = 0;

    const clamp = (value: number) => Math.max(-1, Math.min(1, value));
    const updateTarget = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      target.x = clamp((clientX - (rect.left + rect.width / 2)) / (rect.width / 2));
      target.y = clamp((clientY - (rect.top + rect.height / 2)) / (rect.height / 2));
    };
    // the robot floats in place next to the button; only its eyes glance toward the pointer
    const onMove = (event: PointerEvent) => updateTarget(event.clientX, event.clientY);
    const onLeave = () => { target.x = 0; target.y = 0; };

    const draw = () => {
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

      const glow = isAngry ? '#ff2d2d' : '#ff8a1f';
      const glowSoft = isAngry ? 'rgba(255,45,45,' : 'rgba(255,138,31,';
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
      const bodyGrad = ctx.createRadialGradient(bodyX - 18, bodyY - 20, 6, bodyX, bodyY, 60);
      bodyGrad.addColorStop(0, '#ffffff');
      bodyGrad.addColorStop(0.55, '#fbe9de');
      bodyGrad.addColorStop(1, '#e8b79c');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(bodyX, bodyY, 50, 45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `${glowSoft}0.7)`;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 8;
      ctx.shadowColor = glow;
      ctx.stroke();

      // chest core + circuit lines
      const logoX = bodyX + mouse.x * 6;
      const logoY = bodyY - 2 + mouse.y * 3;
      const pulse = 0.75 + 0.25 * Math.sin(time * 3);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(logoX, logoY - 12); ctx.lineTo(logoX, bodyY - 38);
      ctx.moveTo(logoX - 12, logoY); ctx.lineTo(bodyX - 38, logoY + 4);
      ctx.moveTo(logoX + 12, logoY); ctx.lineTo(bodyX + 36, logoY - 6);
      ctx.moveTo(logoX, logoY + 12); ctx.lineTo(logoX + 6, bodyY + 40);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(logoX, logoY, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = glow;
      ctx.shadowBlur = 14 * pulse;
      ctx.beginPath();
      ctx.arc(logoX, logoY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3d6';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(logoX, logoY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // head position
      const headX = cx + mouse.x * 25;
      const headY = cy + floatY - 50 + mouse.y * 15;

      // antennae (behind head)
      const sway = mouse.x * 6;
      ctx.strokeStyle = glow;
      ctx.fillStyle = glow;
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
        ctx.fill();
      }

      // ear pads (behind head)
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(headX - 70, headY - 16, 16, 38, 8);
      ctx.roundRect(headX + 54, headY - 16, 16, 38, 8);
      ctx.fill();
      ctx.shadowBlur = 0;

      // head
      const headGrad = ctx.createRadialGradient(headX - 30, headY - 20, 15, headX, headY, 80);
      headGrad.addColorStop(0, '#ffffff');
      headGrad.addColorStop(0.6, '#fbe9de');
      headGrad.addColorStop(1, '#e8b79c');
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.roundRect(headX - 60, headY - 45, 120, 90, 40);
      ctx.fill();

      // visor
      const faceX = headX + mouse.x * 10;
      const faceY = headY + mouse.y * 8;
      const faceHeight = 60;
      const visorGrad = ctx.createLinearGradient(0, faceY - 30, 0, faceY + 30);
      visorGrad.addColorStop(0, '#3a140c');
      visorGrad.addColorStop(1, '#140605');
      ctx.fillStyle = visorGrad;
      ctx.beginPath();
      ctx.roundRect(faceX - 45, faceY - faceHeight / 2, 90, faceHeight, 22);
      ctx.fill();
      ctx.strokeStyle = `${glowSoft}0.35)`;
      ctx.lineWidth = 1;
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
        later(() => {
          canvas.classList.remove('robot-canvas-collapse');
          canvas.classList.remove('robot-canvas-reappear');
          void canvas.offsetWidth;
          canvas.classList.add('robot-canvas-reappear');
          emitBubbles(14, 'burst');
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
      } else {
        laughUntil = now + 1200;
        mouthMode = Math.random() > 0.6 ? 'wow' : 'smile';
        mouthUntil = now + 1200;
        emitBubbles(4);
        emitPop(pick(funTexts), 1200);
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
      const r = canvas.getBoundingClientRect();
      const dx = event.clientX - (r.left + r.width / 2);
      const dy = event.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < r.width * 0.3) onClick();
    };
    window.addEventListener('click', onWindowClick);
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('click', onWindowClick);
      timers.forEach((id) => window.clearTimeout(id));
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

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const phone = useMediaQuery('(max-width: 639px)');
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
  const revealRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const patternRef = useRef<SVGPatternElement>(null);
  const noticeRef = useRef<HTMLDialogElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);
  const cursorTarget = useRef({ x: -999, y: -999 });
  const appRef = useRef<HTMLDivElement>(null);

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
    if (!widgetsOpen) return;
    const close = () => setWidgetsOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [widgetsOpen]);

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
    if (videoRef.current) videoRef.current.muted = !soundOn;
  }, [soundOn]);

  useEffect(() => {
    if (!infoOpen) return;
    const close = () => setInfoOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [infoOpen]);

  function loadProjects() {
    setProjectsState('loading');
    fetchBehanceProjects()
      .then((list) => { setProjects(list); setProjectsState('ready'); })
      .catch(() => setProjectsState('error'));
  }

  useEffect(() => {
    if (!caseOpen) return;
    if (projectsState === 'idle') loadProjects();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCaseOpen(false);
    };
    // click or touch anywhere outside the box hides it
    const closeOnOutside = (event: PointerEvent) => {
      if (casePopRef.current && !casePopRef.current.contains(event.target as Node)) setCaseOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('pointerdown', closeOnOutside);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('pointerdown', closeOnOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseOpen]);

  useEffect(() => {
    if (!galOpen) { setLightbox(null); return; }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (lightbox !== null) setLightbox(null); else setGalOpen(false);
    };
    const closeOnOutside = (event: PointerEvent) => {
      if (lightbox !== null) return; // the lightbox has its own backdrop + close button
      if (galPopRef.current && !galPopRef.current.contains(event.target as Node)) setGalOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('pointerdown', closeOnOutside);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [galOpen, lightbox]);

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
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCvOpen(false);
    };
    const closeOnOutside = (event: PointerEvent) => {
      if (cvPopRef.current && !cvPopRef.current.contains(event.target as Node)) setCvOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('pointerdown', closeOnOutside);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('pointerdown', closeOnOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cvOpen]);

  useEffect(() => {
    if (!ghOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGhOpen(false);
    };
    const closeOnOutside = (event: PointerEvent) => {
      if (ghPopRef.current && !ghPopRef.current.contains(event.target as Node)) setGhOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('pointerdown', closeOnOutside);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [ghOpen]);

  useEffect(() => {
    const root = signatureRef.current;
    if (!root) return;
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
  }, []);

  useEffect(() => {
    const el = appRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    let cursor: { dispose?: () => void } | undefined;
    const existing = new Set(Array.from(el.querySelectorAll('canvas')));
    // the trail only shows while the pointer is over the page (otherwise the library wanders on its own)
    const show = () => el.classList.add('neon-on');
    const hide = () => el.classList.remove('neon-on');
    el.addEventListener('pointermove', show);
    el.addEventListener('pointerleave', hide);
    (async () => {
      try {
        // loaded from the CDN on demand, so no npm package is needed
        const { neonCursor } = await import(/* @vite-ignore */ NEON_URL);
        if (cancelled) return;
        cursor = neonCursor({
          el,
          shaderPoints: 10,
          curvePoints: 50,
          curveLerp: 0.5,
          radius1: 4,
          radius2: 20,
          velocityTreshold: 10,
          sleepRadiusX: 100,
          sleepRadiusY: 100,
          sleepTimeCoefX: 0.0025,
          sleepTimeCoefY: 0.0025,
        });
      } catch (error) {
        console.error('Failed to load neon cursor:', error);
      }
    })();
    return () => {
      cancelled = true;
      el.removeEventListener('pointermove', show);
      el.removeEventListener('pointerleave', hide);
      hide();
      cursor?.dispose?.();
      el.querySelectorAll('canvas').forEach((canvas) => { if (!existing.has(canvas)) canvas.remove(); });
    };
  }, []);

  function navigate(label: string) {
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

  function openNotice(value: 'reserve' | 'connect') {
    setMenuOpen(false);
    setNotice(value);
  }

  return (
    <div ref={appRef} className="neon-host min-h-screen bg-white tracking-[-0.02em]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
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
          filter: drop-shadow(0 10px 20px rgba(255, 90, 20, 0.35));
        }
        .robot-card .robot-canvas.robot-canvas-angry { filter: drop-shadow(0 10px 20px rgba(255, 30, 30, 0.45)); }
        .robot-fx { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
        .robot-canvas-fun { animation: robot-bounce 0.6s ease; }
        .robot-canvas-collapse { animation: robot-collapse 1.2s ease forwards; }
        .robot-canvas-reappear { animation: robot-reappear 0.6s ease; }
        .robot-bubble {
          position: absolute; width: 10px; height: 10px; border-radius: 999px;
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.8), rgba(255, 138, 31, 0.3));
          opacity: 0; pointer-events: none; animation: robot-bubble 0.9s ease forwards;
        }
        .robot-bubble.robot-bubble-angry { background: radial-gradient(circle at 30% 30%, rgba(255, 210, 210, 0.9), rgba(255, 70, 70, 0.35)); }
        .robot-pop {
          position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
          font-size: 12px; letter-spacing: 0.4px; padding: 4px 8px; border-radius: 999px; white-space: nowrap;
          background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.32); color: #eafff6;
          animation: robot-pop 0.9s ease forwards; pointer-events: none;
        }
        @keyframes robot-bounce { 0% { transform: scale(1); } 35% { transform: scale(1.04); } 70% { transform: scale(0.98); } 100% { transform: scale(1); } }
        @keyframes robot-collapse { 0% { opacity: 1; transform: scale(1); } 40% { opacity: 0.2; transform: scale(0.94); } 100% { opacity: 0; transform: scale(0.9); } }
        @keyframes robot-reappear { 0% { opacity: 0; transform: scale(0.92); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes robot-bubble { 0% { opacity: 0; transform: translateY(0) scale(0.6); } 40% { opacity: 0.8; } 100% { opacity: 0; transform: translateY(-16px) scale(1.1); } }
        @keyframes robot-pop { 0% { opacity: 0; transform: translate(-50%, 6px); } 30% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -12px); } }
        /* Metric glass widgets */
        .metric-card.glass { background: rgba(255, 255, 255, 0.05); color: #fff; }
        .metric-card { display: flex; }
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
        /* rotating 3D glass photo frame */
        .glass-frame { position: relative; pointer-events: none; }
        .glass-frame canvas { display: block; width: 100%; height: 100%; }
        .glass-frame--desktop { align-self: flex-end; width: clamp(450px, 42.5vw, 510px); aspect-ratio: 1; margin-bottom: -12px; }
        .glass-frame--mobile { position: absolute; z-index: 45; right: 9vw; top: 85%; width: 51vw; aspect-ratio: 1; }
        @media (min-width: 1024px) and (max-height: 820px) { .metrics-scale { transform: scale(0.86); } }
        @media (min-width: 1024px) and (max-height: 700px) { .metrics-scale { transform: scale(0.74); } }
        .clock-card { align-self: flex-end; align-items: center; justify-content: center; gap: 0.5em; padding: 0.95em 1.4em; }
        .seg-digit { width: 1.95em; height: 3.3em; flex: none; filter: drop-shadow(0 0 3px rgba(182, 255, 46, 0.6)); }
        .seg-on { fill: #b6ff2e; }
        .seg-off { fill: rgba(30, 60, 0, 0.3); }
        .clock-colon { display: flex; flex-direction: column; gap: 0.8em; }
        .clock-colon i { width: 0.42em; height: 0.42em; border-radius: 50%; background: #b6ff2e; box-shadow: 0 0 5px rgba(182, 255, 46, 0.95); animation: colon-blink 1s steps(1) infinite; }
        @keyframes colon-blink { 50% { opacity: 0.2; } }
        .clock-ampm { display: flex; flex-direction: column; justify-content: center; gap: 0.35em; margin-left: 0.15em; }
        .clock-ampm b { font-size: 1.05em; font-weight: 700; letter-spacing: 0.08em; line-height: 1; color: rgba(30, 60, 0, 0.45); }
        .clock-ampm b.is-on { color: #b6ff2e; text-shadow: 0 0 6px rgba(182, 255, 46, 0.9); }
        .clock-card .fx-layer::after, .cal-card .fx-layer::after, .wx-card .fx-layer::after { padding: 5px; filter: blur(4px); }
        .wx-card, .cal-card { flex-direction: column; padding: 0.95em 1.05em; }
        .wx-card { justify-content: space-between; gap: 0.7em; }
        .wx-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5em; }
        .wx-city { font-size: 1em; opacity: 0.9; }
        .wx-temp { font-size: 2.7em; font-weight: 400; line-height: 1.05; letter-spacing: -0.04em; }
        .wx-now { display: flex; flex-direction: column; align-items: flex-end; text-align: right; gap: 0.2em; font-size: 0.9em; line-height: 1.25; }
        .wx-days { display: flex; flex-direction: column; gap: 0.6em; border-top: 1px solid rgba(255, 255, 255, 0.28); padding-top: 0.65em; }
        .wx-day { display: grid; grid-template-columns: 2.2em 1.4em 1.9em 1fr 1.9em; align-items: center; gap: 0.4em; font-size: 0.95em; }
        .wx-min { text-align: right; opacity: 0.8; }
        .wx-bar { position: relative; height: 0.36em; border-radius: 999px; background: rgba(255, 255, 255, 0.22); }
        .wx-bar i { position: absolute; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg, #ffd98a, #ff8a1f); }
        .cal-title { font-size: 1.15em; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 0.6em; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 0.25em; text-align: center; }
        .cal-head { font-size: 0.85em; font-weight: 700; opacity: 0.85; padding-bottom: 0.2em; }
        .cal-day { height: 1.7em; line-height: 1.7em; }
        .cal-weekend { opacity: 0.55; }
        .cal-today { width: 1.7em; margin: 0 auto; border-radius: 50%; background: #ffe6bd; color: #8a0f08; font-weight: 700; opacity: 1; box-shadow: 0 0 8px rgba(255, 214, 150, 0.7); }
        /* Mobile: every widget lives in one liquid-glass panel that slides in from the << button */
        .metrics-panel > .fx-layer { display: none; }
        @media (max-width: 639px) {
          .metrics-panel {
            --tr: 15%;
            position: relative; isolation: isolate; padding: 12px; border-radius: 28px;
            background: rgba(255, 255, 255, 0.07);
            -webkit-backdrop-filter: blur(16px) saturate(1.4); backdrop-filter: blur(16px) saturate(1.4);
            box-shadow:
              inset 3px 3px 0.5px -3px rgba(255, 255, 255, 0.9),
              inset -3px -3px 0.5px -3px rgba(255, 255, 255, 0.85),
              inset 1px 1px 1px -0.5px rgba(255, 255, 255, 0.6),
              inset -1px -1px 1px -0.5px rgba(255, 255, 255, 0.6),
              inset 0 0 3px -1px rgba(0, 0, 0, 0.8),
              0 18px 44px rgba(0, 0, 0, 0.3);
            transform-origin: top right;
            transform: translateX(calc(100% + 24px)) scale(0.92);
            opacity: 0; visibility: hidden; pointer-events: none;
            transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease, visibility 0s linear 0.6s;
          }
          .metrics-panel.is-open {
            transform: none; opacity: 1; visibility: visible; pointer-events: auto;
            transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease, visibility 0s;
          }
          .metrics-panel > .fx-layer { display: block; }
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
        .info-list li::before { content: ''; position: absolute; left: 0; top: 0.5em; width: 6px; height: 6px; border-radius: 50%; background: #ffd98a; box-shadow: 0 0 6px rgba(255, 190, 90, 0.9); }
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

        /* Neon Behance icon (pink) */
        .neon-behance {
          color: #ff7bd5;
          animation: neon-behance-pulse 2.2s ease-in-out infinite;
        }
        @keyframes neon-behance-pulse {
          0%, 100% { filter: drop-shadow(0 0 1.5px #ff4fc3) drop-shadow(0 0 4px #ff1fa8); }
          50% { filter: drop-shadow(0 0 2px #ffd0f0) drop-shadow(0 0 6px #ff5ccf) drop-shadow(0 0 13px #ff1fa8); }
        }
        /* Neon GitHub icon (#00ff88) */
        .neon-github {
          color: #00ff88;
          animation: neon-github-pulse 2.2s ease-in-out infinite;
        }
        @keyframes neon-github-pulse {
          0%, 100% { filter: drop-shadow(0 0 1.5px #00ff88) drop-shadow(0 0 4px #00cc6a); }
          50% { filter: drop-shadow(0 0 2px #b9ffe0) drop-shadow(0 0 6px #00ff88) drop-shadow(0 0 13px #00ff88); }
        }
        /* Neon CV icon (yellow) */
        .neon-cv {
          color: #ffe14d;
          animation: neon-cv-pulse 2.2s ease-in-out infinite;
        }
        @keyframes neon-cv-pulse {
          0%, 100% { filter: drop-shadow(0 0 1.5px #ffcc00) drop-shadow(0 0 4px #ff9d00); }
          50% { filter: drop-shadow(0 0 2px #fff4b0) drop-shadow(0 0 6px #ffd400) drop-shadow(0 0 13px #ffb000); }
        }
        /* Neon Gallery icon (purple) */
        .neon-gallery {
          color: #c58bff;
          animation: neon-gallery-pulse 2.2s ease-in-out infinite;
        }
        @keyframes neon-gallery-pulse {
          0%, 100% { filter: drop-shadow(0 0 1.5px #a855f7) drop-shadow(0 0 4px #7c3aed); }
          50% { filter: drop-shadow(0 0 2px #ead5ff) drop-shadow(0 0 6px #a855f7) drop-shadow(0 0 13px #7c3aed); }
        }
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
          .neon-cv { animation: none; filter: drop-shadow(0 0 2px #ffd400) drop-shadow(0 0 6px #ffb000); }
          .neon-gallery { animation: none; filter: drop-shadow(0 0 2px #a855f7) drop-shadow(0 0 6px #7c3aed); }
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
        .gal-ph { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(30, 10, 60, 0.7)); }
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
        .gh-title span { color: transparent; background: linear-gradient(100deg, #ffffff, #a58aff 45%, #67dcff); -webkit-background-clip: text; background-clip: text; }
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
        /* neon cursor trail: the library paints an opaque black canvas with a faint purple haze, so
           contrast() crushes the haze to black and screen-blend makes black transparent: only the trail remains */
        .neon-host > canvas {
          position: fixed; inset: 0; width: 100% !important; height: 100% !important; z-index: 90; pointer-events: none;
          mix-blend-mode: screen; filter: contrast(2);
          opacity: 0; transition: opacity 0.35s ease;
        }
        .neon-host.neon-on > canvas { opacity: 1; }
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
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02) 60%), rgba(40, 6, 6, 0.2);
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
        .conn-badge { height: 1.0em; width: auto; flex: none; display: block; user-select: none; filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.9));}
        .conn-list { display: flex; flex-direction: row; align-items: center; justify-content: flex-start; flex-wrap: nowrap; gap: 1.1em; margin: 0; padding: 0.35em 0 0.2em; list-style: none; font-size: 1em; }
        .conn-social { display: grid; place-items: center; width: 2.4em; height: 2.4em; border-radius: 50%; text-decoration: none; transition: transform 0.3s ease; }
        .conn-social:hover { transform: translateY(-3px) scale(1.12); }
        .conn-social .conn-icon { width: 1.7em; height: 1.7em; }
        .glow-ig { color: #ba2020; filter: drop-shadow(0 0 1px #ff4fd8) drop-shadow(0 0 3px #c04bff) drop-shadow(0 0 4px #9b4dff); animation: glow-ig 2.6s ease-in-out infinite; }
        .glow-fb { color: #8fdcff; filter: drop-shadow(0 0 1px #38bdf8) drop-shadow(0 0 3px #22d3ee) drop-shadow(0 0 4px #06b6d4); animation: glow-fb 2.6s ease-in-out infinite 0.3s; }
        .glow-wa { color: #b8f23c; filter: drop-shadow(0 0 1px #a3e635) drop-shadow(0 0 3px #84cc16) drop-shadow(0 0 4px #facc15); animation: glow-wa 2.6s ease-in-out infinite 0.6s; }
        .glow-em { color: #ffa24d; filter: drop-shadow(0 0 1px #fb923c) drop-shadow(0 0 3px #f97316) drop-shadow(0 0 4px #ea580c); animation: glow-em 2.6s ease-in-out infinite 0.9s; }
        @keyframes glow-ig { 50% { filter: drop-shadow(0 0 2px #ff4fd8) drop-shadow(0 0 5px #c04bff) drop-shadow(0 0 8px #9b4dff); } }
        @keyframes glow-fb { 50% { filter: drop-shadow(0 0 2px #38bdf8) drop-shadow(0 0 5px #22d3ee) drop-shadow(0 0 8px #06b6d4); } }
        @keyframes glow-wa { 50% { filter: drop-shadow(0 0 2px #a3e635) drop-shadow(0 0 5px #84cc16) drop-shadow(0 0 8px #facc15); } }
        @keyframes glow-em { 50% { filter: drop-shadow(0 0 2px #fb923c) drop-shadow(0 0 5px #f97316) drop-shadow(0 0 8px #ea580c); } }
        @media (prefers-reduced-motion: reduce) { .glow-ig, .glow-fb, .glow-wa, .glow-em { animation: none; } }
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
          .neon-behance { animation: none; filter: drop-shadow(0 0 2px #ff5ccf) drop-shadow(0 0 6px #ff1fa8); }
          .neon-github { animation: none; filter: drop-shadow(0 0 2px #00ff88) drop-shadow(0 0 6px #00ff88); }
          .gh-card { animation: none; }
          .case-pop, .case-pop.is-open { transition-duration: 0.01s; }
          .case-skel { animation: none; }
        }
      `}</style>
      <nav className="pointer-events-none fixed top-5 left-5 right-5 z-50 flex justify-start sm:top-6 sm:left-8 md:left-12" aria-label="Main navigation">
        <div
          ref={navRef}
          className="glass nav-drop pointer-events-auto relative h-14 overflow-hidden text-white transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ width: menuOpen ? 'min(340px, calc(100vw - 2.5rem))' : '56px' }}
        >
          <span className="fx-layer" aria-hidden="true" />
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-controls="nav-items"
            tabIndex={menuOpen ? -1 : 0}
            onClick={() => setMenuOpen(true)}
            className={`absolute inset-0 z-10 flex items-center justify-center rounded-full transition-opacity duration-300 ${menuOpen ? 'pointer-events-none opacity-0' : 'opacity-100 delay-200'}`}
          >
            <img src={NAV_ICON} alt="" aria-hidden="true" draggable={false} className="h-12 w-12 select-none object-contain" />
          </button>
          <div id="nav-items" className={`relative flex h-full items-center justify-between px-3 ${menuOpen ? '' : 'pointer-events-none'}`}>
            {NAV_ITEMS.map(({ label, Icon }, index) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                aria-current={label === 'Module' ? 'page' : undefined}
                tabIndex={menuOpen ? 0 : -1}
                onClick={() => navigate(label)}
                style={{ transitionDelay: menuOpen ? `${150 + index * 50}ms` : '0ms' }}
                className={`relative flex h-11 w-11 min-w-0 shrink items-center justify-center rounded-full transition-all duration-300 hover:bg-white/15 ${label === 'Module' ? 'ring-btn' : ''} ${menuOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-50 opacity-0'}`}
              >
                <Icon size={22} strokeWidth={1.75} />
              </button>
            ))}
            <button
              type="button"
              title="Connect"
              aria-label="Connect"
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => openNotice('connect')}
              style={{ transitionDelay: menuOpen ? `${150 + NAV_ITEMS.length * 50}ms` : '0ms' }}
              className={`flex h-11 w-11 min-w-0 shrink items-center justify-center rounded-full transition-all duration-300 hover:bg-white/15 ${menuOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-50 opacity-0'}`}
            >
              <Link2 size={22} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </nav>

      <div className="pointer-events-none fixed top-[26px] right-[26px] z-[70] sm:top-[30px] sm:right-[34px] md:right-[50px]">
        <button
          type="button"
          aria-label={infoOpen ? 'Close info' : 'About this module'}
          aria-expanded={infoOpen}
          aria-controls="info-popup"
          onClick={(event) => { event.stopPropagation(); setWidgetsOpen(false); setInfoOpen((open) => !open); }}
          className={`glass ring-btn info-btn pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center text-white ${infoOpen ? 'is-open' : ''}`}
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
          onClick={(event) => { event.stopPropagation(); setInfoOpen(false); setWidgetsOpen((open) => !open); }}
          className={`glass ring-btn info-btn widgets-btn pointer-events-auto flex h-11 w-11 cursor-pointer items-center justify-center text-white ${widgetsOpen ? 'is-open' : ''}`}
          style={{ '--r': '9999px', '--tr': '15%' } as CSSProperties}
        >
          <span className="fx-layer" aria-hidden="true" />
          <ChevronsLeft size={20} strokeWidth={1.75} />
        </button>
      </div>

      <div id="info-popup" role="dialog" aria-label="About this module" aria-hidden={!infoOpen} className={`info-pop ${infoOpen ? 'is-open' : ''}`}>
        <div className="info-mesh" aria-hidden="true" />
        <div className="info-body">
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
                preload="auto"
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
                aria-label={soundOn ? 'Mute video' : 'Unmute video'}
                onClick={(event) => { event.stopPropagation(); setSoundOn((on) => !on); }}
              >
                {soundOn ? <Volume2 size={13} strokeWidth={2} /> : <VolumeX size={13} strokeWidth={2} />}
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
              Couldn't load projects. <button type="button" onClick={loadProjects}>Retry</button> or{' '}
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
            <p className="case-state">Couldn't load the CV. <button type="button" onClick={() => { cvStarted.current = true; loadCv(); }}>Retry</button></p>
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
                <article key={repo.slug} className="gh-card" style={{ animationDelay: `${Math.min(index, 12) * 45}ms`, '--img': `url("https://opengraph.githubassets.com/1/${repo.slug}")` } as CSSProperties}>
                  <div className="gh-img">
                    <span className="gh-num">{String(index + 1).padStart(2, '0')}</span>
                    <img src={`https://opengraph.githubassets.com/1/${repo.slug}`} alt={`${repo.title} repository preview`} loading="lazy" draggable={false} />
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
              <button key={item.src} type="button" className="gal-item" aria-label={`Open ${item.title}`} tabIndex={galOpen ? 0 : -1} onClick={() => setLightbox(index)}>
                <GalleryThumb item={item} />
              </button>
            ))}
          </div>
        </div>
        <p className="case-foot">Photos · GIFs · Videos</p>
      </div>

      {lightbox !== null && GALLERY[lightbox] && (
        <div className="lb" role="dialog" aria-modal="true" aria-label={GALLERY[lightbox].title} onClick={(event) => { if (event.target === event.currentTarget) setLightbox(null); }}>
          <div className="lb-panel">
            <button type="button" className="case-close lb-close" aria-label="Close preview" autoFocus onClick={() => setLightbox(null)}>
              <X size={18} strokeWidth={2} />
            </button>
            <LightboxMedia key={lightbox} item={GALLERY[lightbox]} />
            <p className="lb-cap">{GALLERY[lightbox].title}</p>
          </div>
        </div>
      )}

      <main id="module" className="relative h-[100dvh] touch-none overflow-hidden">
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
        <Metrics open={widgetsOpen} />
        {phone && <GlassFrame className="glass-frame--mobile hero-rise" style={{ animationDelay: '1.1s' }} />}
        <section className="absolute bottom-12 left-5 z-50 max-w-[calc(100vw-2.5rem)] sm:bottom-16 sm:left-8 sm:max-w-xl md:bottom-20 md:left-12 md:max-w-2xl" aria-labelledby="hero-title">
          <h1 id="hero-title" className="hero-rise mb-6 sm:mb-8" style={{ animationDelay: '0.2s' }}>
            <span className="title-code block">Code</span>
            <span className="title-sub -mt-1 block sm:-mt-2">Beyond Limits.</span>
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
            <div className="pointer-events-none absolute left-full top-1/2 -mt-2 w-[100px] -translate-y-1/2 sm:w-[120px]">
              <RobotCard />
            </div>
          </div>
        </section>
      </main>

      <dialog ref={noticeRef} onCancel={() => setNotice(null)} onClick={(event) => { if (event.target === event.currentTarget) setNotice(null); }} className="connect-dialog" aria-labelledby="notice-title">
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
                {CONTACTS.map(({ name, href, Icon, glow, external }) => (
                  <li key={name}>
                    <a
                      className="conn-social"
                      href={href}
                      aria-label={name}
                      title={name}
                      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      <Icon className={`conn-icon ${glow}`} />
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
