import { useLocalStorage } from "src/hooks/use-local-storage";

// The Wallpaper theme: your picture behind the whole app, with the sidebar
// and the page on frosted glass tinted from it. Kept on this device, like the
// other appearance settings. useApplyTheme puts the values below on <html> as
// CSS variables (--wp-*) and themes.scss draws the theme from them.
export const WALLPAPER_KEY = "folio-wallpaper";

export type WallpaperSource = "preset" | "cover" | "upload";

/** What the picture gives the theme: glass tint, text mode, accent. */
export interface WallpaperLook {
  /** The glass colour as "r, g, b". */
  tint: string;
  /** A dark picture → light text. */
  dark: boolean;
  accent: string;
  /** Text on the accent (buttons, badges). */
  accentInk: string;
}

export interface Wallpaper extends WallpaperLook {
  source: WallpaperSource;
  /** Preset id, page id, or the uploaded file's URL. */
  ref: string;
  /** A CSS background value: one or more layers, each sized and placed. */
  image: string;
  /** Glass blur in px. */
  blur: number;
  /** How much the picture is darkened, 0–60 (%). */
  dim: number;
  /** How opaque the glass is, 30–90 (%). */
  glass: number;
}

export interface WallpaperPreset {
  id: "dusk" | "ocean" | "dunes" | "forest";
  image: string;
  look: WallpaperLook;
}

// Drawn scenes, so there's something to pick before anyone uploads. Keep the
// dusk one in step with the --wp-image default in themes.scss.
export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: "dusk",
    image:
      "radial-gradient(70px 70px at 72% 58%, #fff1cc 0 30px, rgba(255, 214, 150, 0.45) 32px, transparent 70px), radial-gradient(75% 30% at 18% 100%, #24133f 0 60%, transparent 61%), radial-gradient(60% 26% at 88% 100%, #341c58 0 60%, transparent 61%), radial-gradient(95% 36% at 55% 110%, #170c2a 0 60%, transparent 61%), linear-gradient(180deg, #1d1a4f 0%, #4b2d7a 30%, #a24c86 52%, #f0896b 66%, #ffc58a 76%, #ffd9a6 100%)",
    look: {
      tint: "30, 18, 58",
      dark: true,
      accent: "#ffb27a",
      accentInk: "#2a1630",
    },
  },
  {
    id: "ocean",
    image:
      "radial-gradient(60px 60px at 78% 30%, #ffffff 0 26px, rgba(255, 255, 255, 0.4) 28px, transparent 60px), linear-gradient(180deg, #7cc8ff 0%, #c4e8ff 45%, #e8f6ff 58%, #3aa0e6 58.5%, #1b6fb8 78%, #0d4a86 100%)",
    look: {
      tint: "240, 248, 255",
      dark: false,
      accent: "#0b6fc2",
      accentInk: "#ffffff",
    },
  },
  {
    id: "dunes",
    image:
      "radial-gradient(80px 80px at 25% 30%, #fffbe8 0 34px, rgba(255, 240, 200, 0.5) 36px, transparent 80px), radial-gradient(90% 32% at 20% 100%, #c8692e 0 60%, transparent 61%), radial-gradient(80% 28% at 85% 96%, #e08a45 0 60%, transparent 61%), radial-gradient(110% 40% at 55% 112%, #a8501f 0 60%, transparent 61%), linear-gradient(180deg, #ffd8a8 0%, #ffc28a 50%, #f3a06a 100%)",
    look: {
      tint: "255, 246, 236",
      dark: false,
      accent: "#c4511a",
      accentInk: "#ffffff",
    },
  },
  {
    id: "forest",
    image:
      "radial-gradient(60% 40% at 50% 20%, rgba(230, 245, 230, 0.5), transparent 70%), radial-gradient(40% 70% at 10% 100%, #0f2a1d 0 60%, transparent 61%), radial-gradient(35% 60% at 90% 100%, #163826 0 60%, transparent 61%), radial-gradient(55% 45% at 50% 108%, #0a1f15 0 60%, transparent 61%), linear-gradient(180deg, #a9c9b0 0%, #5f8a6c 45%, #2c5240 100%)",
    look: {
      tint: "12, 30, 22",
      dark: true,
      accent: "#9be38a",
      accentInk: "#0d2416",
    },
  },
];

export const DEFAULT_WALLPAPER: Wallpaper = {
  source: "preset",
  ref: "dusk",
  image: WALLPAPER_PRESETS[0].image,
  blur: 22,
  dim: 10,
  glass: 58,
  ...WALLPAPER_PRESETS[0].look,
};

// JSON in storage; anything missing (an older save) falls back to defaults.
const codec = {
  serialize: (value: Wallpaper) => JSON.stringify(value),
  deserialize: (raw: string): Wallpaper => ({
    ...DEFAULT_WALLPAPER,
    ...(JSON.parse(raw) as Partial<Wallpaper>),
  }),
};

export function useWallpaper() {
  return useLocalStorage<Wallpaper>(WALLPAPER_KEY, DEFAULT_WALLPAPER, codec);
}

/** A picture URL as a full-window background layer. */
export function imageLayer(url: string): string {
  return `url("${url.replace(/"/g, "%22")}") center / cover no-repeat`;
}

// ── Reading a picture's colours ──────────────────────────────────────────────

type Rgb = [number, number, number];

const luminance = ([r, g, b]: Rgb) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const mix = ([r, g, b]: Rgb, [r2, g2, b2]: Rgb, amount: number): Rgb => [
  Math.round(r + (r2 - r) * amount),
  Math.round(g + (g2 - g) * amount),
  Math.round(b + (b2 - b) * amount),
];

const toHex = (rgb: Rgb) =>
  `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;

function saturation([r, g, b]: Rgb): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) return 0;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

/**
 * The look for a set of colour samples: their average decides light or dark
 * and the glass tint; the most colourful mid-tone becomes the accent, pushed
 * lighter on a dark picture and darker on a light one so it stays readable.
 */
export function lookFromSamples(samples: Rgb[]): WallpaperLook {
  if (samples.length === 0) return WALLPAPER_PRESETS[0].look;

  const sum = samples.reduce<Rgb>(
    (acc, [r, g, b]) => [acc[0] + r, acc[1] + g, acc[2] + b],
    [0, 0, 0],
  );
  const average: Rgb = [
    Math.round(sum[0] / samples.length),
    Math.round(sum[1] / samples.length),
    Math.round(sum[2] / samples.length),
  ];
  const dark = luminance(average) < 0.55;
  const tint = dark
    ? mix(average, [0, 0, 0], 0.55)
    : mix(average, [255, 255, 255], 0.8);

  let accent: Rgb = dark ? [255, 255, 255] : [43, 43, 43];
  let best = -1;
  for (const sample of samples) {
    const l = luminance(sample);
    const s = saturation(sample);
    if (l > 0.2 && l < 0.85 && s > best) {
      best = s;
      accent = sample;
    }
  }
  for (let i = 0; i < 8; i++) {
    const l = luminance(accent);
    if (dark && l < 0.62) accent = mix(accent, [255, 255, 255], 0.2);
    else if (!dark && l > 0.42) accent = mix(accent, [0, 0, 0], 0.2);
    else break;
  }

  return {
    tint: tint.join(", "),
    dark,
    accent: toHex(accent),
    accentInk: luminance(accent) > 0.55 ? "#16121f" : "#ffffff",
  };
}

/** The look of a picture at `url`. Throws if it can't be read (CORS). */
export async function readLook(url: string): Promise<WallpaperLook> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();

  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const samples: Rgb[] = [];
  for (let i = 0; i < data.length; i += 4) {
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  return lookFromSamples(samples);
}

/** The look of a CSS gradient (a gradient page cover), from its colours. */
export function lookFromCss(css: string): WallpaperLook {
  const samples: Rgb[] = [];
  for (const match of css.matchAll(
    /#([0-9a-f]{6}|[0-9a-f]{3})\b|rgba?\(([^)]+)\)/gi,
  )) {
    if (match[1]) {
      const hex =
        match[1].length === 3
          ? match[1]
              .split("")
              .map((c) => c + c)
              .join("")
          : match[1];
      samples.push([
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ]);
    } else if (match[2]) {
      const [r, g, b] = match[2].split(",").map((part) => parseFloat(part));
      if ([r, g, b].every((c) => Number.isFinite(c))) samples.push([r, g, b]);
    }
  }
  return lookFromSamples(samples);
}

/** Shrink a picture to at most 2400px on its long side, as a JPEG. */
export function shrinkImage(file: File, maxSide = 2400): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(
                new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                  type: "image/jpeg",
                }),
              )
            : reject(new Error("Canvas toBlob failed")),
        "image/jpeg",
        0.88,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed"));
    };
    img.src = objectUrl;
  });
}
