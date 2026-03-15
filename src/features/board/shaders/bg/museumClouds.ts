// Inspired by Yohei Nishitsuji (@YoheiNishitsuji) shader post on X/Twitter.
export const MUSEUM_CLOUDS_SHADER_FS = `
uniform vec2 uViewportOffset;
uniform float uTheme;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 centered = fragCoord.xy - 0.5 * iResolution.xy;
  vec2 worldOffset = vec2(uViewportOffset.x, -uViewportOffset.y) * 0.6;
  vec3 ray = vec3((centered + worldOffset) / iResolution.y, 0.57);

  float e = 0.0;
  float g = 0.0;
  float radius = 0.0;
  float scale = 2.8;
  vec3 q = vec3(0.0, -1.0, -1.0);
  vec3 p;
  vec3 color = vec3(0.0);

  for (float i = 0.0; i < 79.0; i++) {
    color -= hsv2rgb(vec3(0.58, clamp(radius + g * 0.18, 0.0, 1.0), max(0.0, e - e * i / 4.5)));

    p = q += ray * e * radius * 0.6;
    g += p.y / scale;

    radius = max(length(p), 0.0001);
    p = vec3(radius, exp2(mod(-0.25 - p.z, scale) / radius), p.x);

    e = -p.y;
    for (float s = scale; s < 1000.0; s += s) {
      e -= abs(dot(sin(p.xzy * s + e * p.y), cos(p.zzz * s - e)) / s * 0.32);
    }
  }

  vec3 cloud = clamp(-color * vec3(1.12, 1.0, 0.92), 0.0, 1.0);
  vec3 lightGrade = cloud;
  vec3 darkGrade = mix(vec3(0.05, 0.04, 0.06), cloud * vec3(0.95, 0.9, 0.85), 0.9);
  vec3 themed = mix(lightGrade, darkGrade, step(0.5, uTheme));

  float glow = smoothstep(0.12, 0.95, max(themed.r, max(themed.g, themed.b)));
  float alpha = mix(0.06, 0.2, glow);

  fragColor = vec4(themed, alpha);
}
`
