export const SOFT_CELLS_SHADER_FS = `
uniform vec2 uViewportOffset;
uniform float uTheme;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 world = vec2(
    fragCoord.x + uViewportOffset.x,
    (iResolution.y - fragCoord.y) + uViewportOffset.y
  ) / 230.0;
  vec2 cell = floor(world);
  vec2 local = fract(world) - 0.5;
  float t = iTime * 0.22;

  float nearest = 10.0;
  float glow = 0.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 id = cell + neighbor;
      float seed = hash21(id);
      vec2 point = neighbor + vec2(
        0.35 * sin(t + seed * 6.2831),
        0.35 * cos(t * 1.1 + seed * 6.2831)
      );
      vec2 delta = point - local;
      float dist = length(delta);
      nearest = min(nearest, dist);
      glow += 0.08 / (0.04 + dist * dist);
    }
  }

  float membrane = smoothstep(0.28, 0.02, nearest);
  float bloom = smoothstep(0.6, 1.8, glow);

  vec3 lightBase = vec3(0.92, 0.96, 0.99);
  vec3 lightAccent = vec3(0.48, 0.72, 0.98);
  vec3 darkBase = vec3(0.07, 0.11, 0.16);
  vec3 darkAccent = vec3(0.23, 0.47, 0.68);

  vec3 lightColor = mix(lightBase, lightAccent, bloom);
  vec3 darkColor = mix(darkBase, darkAccent, bloom);
  vec3 color = mix(lightColor, darkColor, step(0.5, uTheme));

  float alpha = membrane * 0.06 + bloom * 0.07;

  fragColor = vec4(color, clamp(alpha, 0.03, 0.15));
}
`
