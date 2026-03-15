export const LIQUID_METAL_SHADER_FS = `
uniform vec2 uViewportOffset;
uniform float uTheme;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.45));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;

  for (int i = 0; i < 4; i++) {
    value += noise(p) * amplitude;
    p = p * 2.03 + vec2(7.1, 11.7);
    amplitude *= 0.52;
  }

  return value;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 world = vec2(
    fragCoord.x + uViewportOffset.x,
    (iResolution.y - fragCoord.y) + uViewportOffset.y
  ) / 780.0;
  float t = iTime * 0.14;

  vec2 flow = vec2(
    fbm(world * 1.05 + vec2(t * 0.8, -t * 0.35)),
    fbm(world * 1.15 + vec2(-t * 0.55, t * 0.45))
  );

  vec2 warped = world + (flow - 0.5) * 0.18;
  vec2 selfMap = vec2(
    fbm(warped * 2.15 + vec2(t * 0.5, -t * 0.24)),
    fbm(warped * 2.35 + vec2(-t * 0.32, t * 0.36))
  );
  vec2 reflectedWarp = warped + (selfMap - 0.5) * 0.22;

  float fieldA = fbm(reflectedWarp * 2.0 + vec2(t * 0.45, -t * 0.25));
  float fieldB = fbm(reflectedWarp * 3.1 - vec2(t * 0.28, t * 0.22));
  float fieldC = fbm(reflectedWarp * 4.2 + selfMap * 1.4 + vec2(t * 0.14, -t * 0.18));
  float field = fieldA * 0.58 + fieldB * 0.24 + fieldC * 0.18;

  float sheen = smoothstep(0.48, 0.9, field);
  float contour = 1.0 - abs(fract(field * 4.2 + 0.12) - 0.5) * 2.0;
  contour = smoothstep(0.82, 0.99, contour);

  vec3 lightBase = vec3(0.73, 0.74, 0.76);
  vec3 lightShadow = vec3(0.59, 0.60, 0.63);
  vec3 lightHighlight = vec3(0.97, 0.97, 0.98);

  vec3 darkBase = vec3(0.24, 0.25, 0.28);
  vec3 darkShadow = vec3(0.16, 0.17, 0.19);
  vec3 darkHighlight = vec3(0.72, 0.74, 0.78);

  vec3 lightMetal = mix(lightShadow, lightBase, sheen);
  lightMetal = mix(lightMetal, lightHighlight, contour * 0.85);

  vec3 darkMetal = mix(darkShadow, darkBase, sheen);
  darkMetal = mix(darkMetal, darkHighlight, contour * 0.8);

  vec3 color = mix(lightMetal, darkMetal, step(0.5, uTheme));
  float alpha = mix(0.035, 0.11, sheen) + contour * 0.025;

  fragColor = vec4(color, clamp(alpha, 0.03, 0.13));
}
`
