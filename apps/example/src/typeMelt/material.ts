// Liquid chrome over a blurred white mask: the alpha threshold makes nearby
// blobs fuse, the alpha slope gives the normal, and a thin-film palette plus
// two studio light bands, a highlight and a Fresnel rim do the rest.
export const CHROME_SOURCE = `
uniform shader content;
uniform float uTime;
uniform float uThreshold;
uniform float uFilm;
uniform float2 uLight;

float3 film(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + float3(0.0, 0.33, 0.67)));
}

half4 main(float2 p) {
  float a = content.eval(p).a;
  float m = smoothstep(uThreshold - 0.04, uThreshold + 0.04, a);
  float d = 2.0;
  float gx = content.eval(p + float2(d, 0.0)).a - content.eval(p - float2(d, 0.0)).a;
  float gy = content.eval(p + float2(0.0, d)).a - content.eval(p - float2(0.0, d)).a;
  float h = clamp((a - uThreshold) / (1.0 - uThreshold), 0.0, 1.0);
  float3 n = normalize(float3(-gx * 6.0, -gy * 6.0, sqrt(h) + 0.15));
  float3 v = float3(0.0, 0.0, 1.0);
  float3 l = normalize(float3(uLight, 0.8));
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.0);
  float thick = uFilm * (h * 1.7 + 0.15 * sin(p.x * 0.02 + uTime * 0.7) + 0.15 * sin(p.y * 0.017 - uTime * 0.5));
  float3 irid = film(thick + (1.0 - ndv) * 0.8);
  float3 r = reflect(-v, n);
  float band = smoothstep(0.55, 0.75, r.y * 0.5 + 0.5) + 0.6 * smoothstep(0.85, 0.95, 0.5 - r.x * 0.5);
  float spec = pow(clamp(dot(normalize(l + v), n), 0.0, 1.0), 60.0);
  float3 base = mix(float3(0.05, 0.06, 0.08), irid, 0.35 + 0.65 * fres);
  float3 col = base * (0.35 + band * 0.9) + spec * 1.2 + fres * irid * 0.6;
  col *= mix(0.75, 1.0, fres);
  return half4(half3(col * m), half(m));
}
`;

export const CHROME_UNIFORMS = {
  uThreshold: 0.5,
  uFilm: 1.0,
  uLight: [-0.4, -0.7] as [number, number],
};
