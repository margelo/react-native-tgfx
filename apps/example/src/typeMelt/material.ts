// Liquid chrome over a blurred white mask: the alpha threshold makes nearby
// blobs fuse, the alpha slope gives the normal, a desaturated thin-film tint
// swirls over the faces, and a studio softbox, a highlight and a Fresnel rim
// read as chrome. Tuned offline against the reference with a numpy twin of
// this shader before it went to the device.
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

float dome(float a, float t) {
  return sqrt(clamp((a - t) / (1.0 - t), 0.0, 1.0));
}

half4 main(float2 p) {
  float t = uThreshold;
  float a = content.eval(p).a;
  float m = smoothstep(t - 0.03, t + 0.03, a);
  float d = 1.5 * uScale;
  float gx = dome(content.eval(p + float2(d, 0.0)).a, t) - dome(content.eval(p - float2(d, 0.0)).a, t);
  float gy = dome(content.eval(p + float2(0.0, d)).a, t) - dome(content.eval(p - float2(0.0, d)).a, t);
  float h = dome(a, t);
  float3 n = normalize(float3(-gx * uGain, -gy * uGain, 1.0));
  float ndv = n.z;
  float fres = (1.0 - ndv) * (1.0 - ndv);
  float2 q = p / uScale;
  float swirl = sin(q.x * 0.045 + q.y * 0.02 + uTime * 0.6) * sin(q.y * 0.05 - q.x * 0.015 - uTime * 0.45)
    + 0.5 * sin((q.x + q.y) * 0.03 + uTime * 0.3);
  float3 irid = film(uFilm * (0.35 * h + 0.35 * swirl) + 0.9 * (1.0 - ndv));
  float g = (irid.r + irid.g + irid.b) / 3.0;
  float3 tint = mix(float3(g, g, g), irid, 0.55);
  float3 r = float3(2.0 * ndv * n.x, 2.0 * ndv * n.y, 2.0 * ndv * n.z - 1.0);
  float key = smoothstep(0.15, 0.6, -r.y * 0.85 - r.x * 0.35);
  float bounce = smoothstep(0.2, 0.7, r.y) * 0.25;
  float3 l = normalize(float3(uLight, 0.6));
  float spec = pow(clamp(dot(n, normalize(l + float3(0.0, 0.0, 1.0))), 0.0, 1.0), 90.0);
  float3 face = 0.07 + tint * 0.3;
  float3 col = face * (1.0 - 0.7 * key) + key * (0.8 + 0.2 * tint) * 0.95 + bounce * tint;
  col += fres * (tint * 0.7 + 0.05) + spec * 1.4;
  return half4(half3(col * m), half(m));
}
`;

/** Blur sigma of the height field, in font sizes. */
export const BLUR_EM = 0.045;

/**
 * The shader's static uniforms. `scale` is drawing pixels per point: tgfx's
 * `<Blur>` sigma and the shader's coordinates are both in drawing pixels.
 */
export function chromeUniforms(scale: number, fontSize: number) {
  const blurPt = fontSize * BLUR_EM;
  return {
    uThreshold: 0.42,
    uFilm: 1.0,
    uScale: scale,
    // Steep enough that the dome's shoulders tilt past 45°, whatever the blur.
    uGain: 0.8 * blurPt,
    uLight: [-0.5, -0.8] as [number, number],
  };
}
