// Liquid chrome over a height field: each letter arrives as a tube-profile
// height image and each droplet as a sphere, a light blur fillets where they
// meet, and this shader reads the composited alpha as height. The slope gives
// the normal; a desaturated thin-film tint swirls over the glass, and two
// studio softboxes, a highlight and a Fresnel rim read as chrome. Tuned
// offline against the reference with a numpy twin before it went to the device.
export const CHROME_SOURCE = `
uniform shader content;
uniform float uTime;
uniform float uThreshold;
uniform float uFilm;
uniform float uScale;
uniform float uGain;
uniform float2 uLight;

float3 film(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + float3(0.0, 0.33, 0.67)));
}

half4 main(float2 p) {
  float h = content.eval(p).a;
  float m = smoothstep(uThreshold - 0.04, uThreshold + 0.04, h);
  float d = 1.5 * uScale;
  float gx = content.eval(p + float2(d, 0.0)).a - content.eval(p - float2(d, 0.0)).a;
  float gy = content.eval(p + float2(0.0, d)).a - content.eval(p - float2(0.0, d)).a;
  float3 n = normalize(float3(-gx * uGain, -gy * uGain, 1.0));
  float ndv = n.z;
  float fres = (1.0 - ndv) * (1.0 - ndv);
  float2 q = p / uScale;
  float swirl = sin(q.x * 0.045 + q.y * 0.02 + uTime * 0.6) * sin(q.y * 0.05 - q.x * 0.015 - uTime * 0.45)
    + 0.5 * sin((q.x + q.y) * 0.03 + uTime * 0.3);
  float3 irid = film(uFilm * (0.3 * h + 0.35 * swirl) + 1.1 * (1.0 - ndv));
  float g = (irid.r + irid.g + irid.b) / 3.0;
  float3 tint = mix(float3(g, g, g), irid, 0.7);
  float3 r = float3(2.0 * ndv * n.x, 2.0 * ndv * n.y, 2.0 * ndv * n.z - 1.0);
  float key = smoothstep(0.25, 0.75, -r.y * 0.8 - r.x * 0.4);
  float strip = smoothstep(0.55, 0.8, r.x) * (1.0 - smoothstep(0.0, 0.6, abs(r.y)));
  float bounce = smoothstep(0.3, 0.8, r.y) * 0.35;
  float3 l = normalize(float3(uLight, 0.6));
  float spec = pow(clamp(dot(n, normalize(l + float3(0.0, 0.0, 1.0))), 0.0, 1.0), 120.0);
  float env = key * 0.95 + strip * 0.6;
  float3 col = (0.05 + tint * 0.14) * (1.0 - 0.6 * env) + env * (0.75 + 0.35 * tint) + bounce * tint;
  col += fres * (tint * 0.9 + 0.08) + spec * 1.6;
  return half4(half3(col * m), half(m));
}
`;

/** How deep a stroke's round profile reaches before it flattens, in font sizes. */
export const TUBE_EM = 0.15;
/** Blur that rounds the letter shapes before the distance step, in font sizes. */
export const ROUND_EM = 0.025;
/** Blur that fillets letters and droplets together on screen, in font sizes. */
export const SOFT_EM = 0.012;
/** Extra blur at a full melt, so slumping letters soften into goo, in font sizes. */
export const MELT_SOFT_EM = 0.05;

/** The fillet blur's sigma in drawing pixels (what tgfx's `<Blur>` takes), for a melt of 0..1. */
export function softBlurPx(
  fontSize: number,
  scale: number,
  melt: number,
): number {
  'worklet';
  return fontSize * (SOFT_EM + MELT_SOFT_EM * melt) * scale;
}

/**
 * The shader's static uniforms. `scale` is drawing pixels per point: tgfx's
 * `<Blur>` sigma and the shader's coordinates are both in drawing pixels.
 */
export function chromeUniforms(scale: number, fontSize: number) {
  return {
    uThreshold: 0.06,
    uFilm: 1.0,
    uScale: scale,
    // Height runs 0 → 1 over TUBE_EM, sampled ±1.5 pt: this makes the profile a true circle.
    uGain: (fontSize * TUBE_EM) / 3,
    uLight: [-0.5, -0.8] as [number, number],
  };
}
