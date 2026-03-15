export const AURORA_DRIFT_SHADER_FS = `
uniform vec2 uViewportOffset;
uniform float uTheme;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 world = vec2(
    fragCoord.x + uViewportOffset.x,
    (iResolution.y - fragCoord.y) + uViewportOffset.y
  ) / 900.0;
  float t = iTime * 0.18;

  float ribbonA = sin(world.x * 1.1 + t);
  float ribbonB = cos(world.y * 1.5 - t * 1.3);
  float ribbonC = sin((world.x + world.y) * 0.7 + t * 0.9);
  float energy = 0.5 + 0.5 * (0.45 * ribbonA + 0.35 * ribbonB + 0.2 * ribbonC);

  vec3 lightBase = vec3(0.29, 0.57, 0.95);
  vec3 lightAccent = vec3(0.96, 0.98, 1.0);
  vec3 darkBase = vec3(0.13, 0.22, 0.30);
  vec3 darkAccent = vec3(0.25, 0.43, 0.56);

  vec3 lightColor = mix(lightBase, lightAccent, energy);
  vec3 darkColor = mix(darkBase, darkAccent, energy);
  vec3 color = mix(lightColor, darkColor, step(0.5, uTheme));

  float band = smoothstep(0.18, 0.92, energy);
  float alpha = mix(0.05, 0.16, band);

  fragColor = vec4(color, alpha);
}
`
