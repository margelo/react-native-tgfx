// Smoky iridescent glass over a height field: each letter arrives as a
// tube-profile height image and each droplet as a sphere, a light blur fillets
// where they meet, and this shader reads the composited alpha as height. Tuned
// offline against the reference image with a numpy twin before it went to the
// device.
export const CHROME_SOURCE = `
uniform shader content;
uniform float uTime;
uniform float uThreshold;
uniform float uScale;
uniform float uGain;
uniform float2 uLight;
uniform float3 uBase;
uniform float3 uMetal;
uniform float3 uBounce;
uniform float uIrid;
uniform float uMelt;

float3 film(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + float3(0.0, 0.33, 0.67)));
}

half4 main(float2 p) {
  float h = content.eval(p).a;
  float m = smoothstep(uThreshold - 0.04, uThreshold + 0.04, h);
  float d = 1.5 * uScale;
  float gx = content.eval(p + float2(d, 0.0)).a - content.eval(p - float2(d, 0.0)).a;
  float gy = content.eval(p + float2(0.0, d)).a - content.eval(p - float2(0.0, d)).a;
  // Melting letters flatten into goo: the slope reads gentler as the melt
  // goes on (a growing blur did this at a cost of 9 fps).
  float gain = uGain * (1.0 - 0.45 * uMelt);
  float3 n = normalize(float3(-gx * gain, -gy * gain, 1.0));
  float ndv = n.z;
  float2 q = p / uScale;
  float swirl = sin(q.x * 0.045 + q.y * 0.02 + uTime * 0.6) * sin(q.y * 0.05 - q.x * 0.015 - uTime * 0.45)
    + 0.5 * sin((q.x + q.y) * 0.03 + uTime * 0.3);
  float3 irid = film(0.25 * h + 0.3 * swirl + (1.0 - ndv) + 0.45);
  float g = (irid.r + irid.g + irid.b) / 3.0;
  // The finish: a metal's own colour, or the soap film's, or a blend (diamond fire).
  float3 tint = mix(uMetal, mix(float3(g, g, g), irid, 0.7), uIrid);
  float3 r = float3(2.0 * ndv * n.x, 2.0 * ndv * n.y, 2.0 * ndv * n.z - 1.0);
  // Smoky glass: dark at heart, the film's colour on the faces turned to the
  // light, teal floor bounce underneath, two softboxes, a rim and a highlight.
  float up = smoothstep(0.3, 0.85, -n.y * 0.8 - n.x * 0.4);
  float down = smoothstep(0.2, 0.85, n.y);
  float key = smoothstep(0.45, 0.85, -r.y * 0.85 - r.x * 0.3);
  float strip = smoothstep(0.6, 0.85, r.x) * (1.0 - smoothstep(0.0, 0.5, abs(r.y)));
  float3 l = normalize(float3(uLight, 0.5));
  float spec = pow(clamp(dot(n, normalize(l + float3(0.0, 0.0, 1.0))), 0.0, 1.0), 140.0);
  // Metal tints its reflections; glass reflects the room nearly white.
  float3 env = mix(tint * 1.05 + 0.1, 0.7 + 0.3 * tint, uIrid);
  float3 col = uBase + tint * 0.13;
  col += up * tint * 0.6;
  col += down * uBounce * 0.35;
  col += (key * 0.85 + strip * 0.45) * env;
  float rim = smoothstep(0.55, 0.92, 1.0 - ndv);
  col += rim * (0.15 + 0.8 * tint) + spec * 1.6;
  // A faint glow in the finish's bounce colour, just outside the silhouette.
  float glow = smoothstep(0.0, uThreshold, h) * (1.0 - m);
  float3 halo = uBounce * 0.5 * glow;
  return half4(half3(col * m + halo), half(max(m, glow * 0.5)));
}
`;

/** How deep a stroke's round profile reaches before it flattens, in font sizes. */
export const TUBE_EM = 0.16;
/** Blur that rounds the letter shapes before the distance step, in font sizes. */
export const ROUND_EM = 0.014;
/** Blur that fillets letters and droplets together on screen, in font sizes. */
export const SOFT_EM = 0.012;
/** The fillet blur's sigma in drawing pixels (what tgfx's `<Blur>` takes). */
export function softBlurPx(fontSize: number, scale: number): number {
  return fontSize * SOFT_EM * scale;
}

export type FinishName =
  | 'iridescent'
  | 'gold'
  | 'silver'
  | 'bronze'
  | 'diamond';

type Rgb = [number, number, number];
interface Finish {
  /** Body colour at the glass's heart. */
  base: Rgb;
  /** What the surface tints its sheen, rim and reflections with. */
  metal: Rgb;
  /** Light bounced up onto the undersides, and the halo. */
  bounce: Rgb;
  /** 0 = pure metal, 1 = soap-film iridescence. */
  irid: number;
}

/** Tuned offline against the reference with the numpy twin of the shader. */
export const FINISHES: Record<FinishName, Finish> = {
  iridescent: {
    base: [0.05, 0.045, 0.07],
    metal: [1, 1, 1],
    bounce: [0.08, 0.42, 0.4],
    irid: 1,
  },
  gold: {
    base: [0.07, 0.04, 0.01],
    metal: [1, 0.74, 0.3],
    bounce: [0.55, 0.32, 0.08],
    irid: 0.08,
  },
  silver: {
    base: [0.05, 0.055, 0.065],
    metal: [0.86, 0.88, 0.92],
    bounce: [0.35, 0.42, 0.5],
    irid: 0.06,
  },
  bronze: {
    base: [0.06, 0.03, 0.015],
    metal: [0.85, 0.48, 0.25],
    bounce: [0.45, 0.2, 0.1],
    irid: 0.08,
  },
  diamond: {
    base: [0.14, 0.16, 0.2],
    metal: [0.9, 0.95, 1],
    bounce: [0.55, 0.75, 1],
    irid: 0.5,
  },
};

/**
 * The shader's static uniforms. `scale` is drawing pixels per point: tgfx's
 * `<Blur>` sigma and the shader's coordinates are both in drawing pixels.
 */
export function chromeUniforms(
  scale: number,
  fontSize: number,
  finish: FinishName = 'iridescent',
) {
  const f = FINISHES[finish];
  return {
    uThreshold: 0.06,
    uScale: scale,
    uBase: f.base,
    uMetal: f.metal,
    uBounce: f.bounce,
    uIrid: f.irid,
    // Height runs 0 → 1 over TUBE_EM, sampled ±1.5 pt: this makes the profile a true circle.
    uGain: (fontSize * TUBE_EM) / 3,
    uLight: [-0.4, -0.85] as [number, number],
  };
}
