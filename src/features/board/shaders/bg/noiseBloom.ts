export const NOISE_BLOOM_SHADER_FS = `
uniform vec2 uViewportOffset;
uniform float uTheme;

float hash21(vec2 p) {
  p = fract(p * vec2(234.56, 456.78));
  p += dot(p, p + 19.19);
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
    value += amplitude * noise(p);
    p = p * 2.02 + vec2(13.1, 7.7);
    amplitude *= 0.5;
  }

  return value;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 world = vec2(
    fragCoord.x + uViewportOffset.x,
    (iResolution.y - fragCoord.y) + uViewportOffset.y
  ) / 640.0;
  float t = iTime * 0.08;

  float cloudA = fbm(world + vec2(t, -t * 0.6));
  float cloudB = fbm(world * 1.7 - vec2(t * 0.8, t * 0.3));
  float cloud = smoothstep(0.34, 0.88, cloudA * 0.7 + cloudB * 0.5);

  vec3 lightBase = vec3(0.97, 0.95, 0.9);
  vec3 lightAccent = vec3(0.83, 0.63, 0.41);
  vec3 darkBase = vec3(0.09, 0.08, 0.1);
  vec3 darkAccent = vec3(0.53, 0.34, 0.23);

  vec3 lightColor = mix(lightBase, lightAccent, cloud);
  vec3 darkColor = mix(darkBase, darkAccent, cloud);
  vec3 color = mix(lightColor, darkColor, step(0.5, uTheme));

  float alpha = mix(0.02, 0.13, cloud);

  fragColor = vec4(color, alpha);
}
`
