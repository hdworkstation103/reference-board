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
  const float RAY_Z = 0.57;
  const float WORLD_OFFSET_SCALE = 0.6;
  const float FRACTAL_SCALE = 2.8;
  const float FRACTAL_WEIGHT = 0.32;
  const float CLOUD_HUE = 0.58;
  const float CLOUD_SATURATION_FACTOR = 0.18;
  const float CLOUD_VALUE_FALLOFF = 4.5;
  const vec3 CLOUD_GRADE = vec3(1.12, 1.0, 0.92);
  const int CLOUD_STEPS = 64;
  const int DETAIL_OCTAVES = 8;

  vec2 centered = fragCoord.xy - 0.5 * iResolution.xy;
  vec2 worldOffset = vec2(uViewportOffset.x, -uViewportOffset.y) * WORLD_OFFSET_SCALE;
  vec3 ray = vec3((centered + worldOffset) / iResolution.y, RAY_Z);

  float e = 0.0;
  float g = 0.0;
  float radius = 0.0;
  vec3 q = vec3(0.0, -1.0, -1.0);
  vec3 p;
  vec3 color = vec3(0.0);

  for (int stepIndex = 0; stepIndex < CLOUD_STEPS; stepIndex++) {
    float stepT = float(stepIndex);
    float hue = CLOUD_HUE;
    float saturation = clamp(radius + g * CLOUD_SATURATION_FACTOR, 0.0, 1.0);
    float value = max(0.0, e - e * stepT / CLOUD_VALUE_FALLOFF);

    color -= hsv2rgb(vec3(hue, saturation, value));

    p = q += ray * e * radius * WORLD_OFFSET_SCALE;
    g += p.y / FRACTAL_SCALE;

    radius = max(length(p), 0.0001);
    p = vec3(radius, exp2(mod(-0.25 - p.z, FRACTAL_SCALE) / radius), p.x);

    e = -p.y;
    float octaveScale = FRACTAL_SCALE;
    for (int octaveIndex = 0; octaveIndex < DETAIL_OCTAVES; octaveIndex++) {
      e -= abs(dot(sin(p.xzy * octaveScale + e * p.y), cos(p.zzz * octaveScale - e)) / octaveScale * FRACTAL_WEIGHT);
      octaveScale += octaveScale;
    }
  }

  vec3 cloud = clamp(-color * CLOUD_GRADE, 0.0, 1.0);
  vec3 lightGrade = cloud;
  vec3 darkGrade = mix(vec3(0.05, 0.04, 0.06), cloud * vec3(0.95, 0.9, 0.85), 0.9);
  float themeMix = smoothstep(0.35, 0.65, uTheme);
  vec3 themed = mix(lightGrade, darkGrade, themeMix);

  float glow = smoothstep(0.12, 0.95, max(themed.r, max(themed.g, themed.b)));
  float alpha = mix(0.06, 0.2, glow);

  fragColor = vec4(themed, alpha);
}
`
