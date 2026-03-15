export const CONTOUR_FLOW_SHADER_FS = `
uniform vec2 uViewportOffset;
uniform float uTheme;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 world = vec2(
    fragCoord.x + uViewportOffset.x,
    (iResolution.y - fragCoord.y) + uViewportOffset.y
  ) / 760.0;
  float t = iTime * 0.12;

  float field =
    sin(world.x * 1.6 + t) +
    cos(world.y * 1.9 - t * 1.4) +
    0.55 * sin((world.x + world.y) * 2.1 + t * 0.8);

  float contour = 1.0 - abs(fract(field * 1.4) - 0.5) * 2.0;
  contour = smoothstep(0.55, 0.98, contour);

  float haze = 0.5 + 0.5 * sin(world.x * 0.7 - world.y * 0.9 + t * 1.7);

  vec3 lightBase = vec3(0.76, 0.88, 0.97);
  vec3 lightLine = vec3(0.28, 0.48, 0.82);
  vec3 darkBase = vec3(0.08, 0.13, 0.18);
  vec3 darkLine = vec3(0.27, 0.61, 0.73);

  vec3 lightColor = mix(lightBase, lightLine, contour * 0.75 + haze * 0.25);
  vec3 darkColor = mix(darkBase, darkLine, contour * 0.8 + haze * 0.2);
  vec3 color = mix(lightColor, darkColor, step(0.5, uTheme));

  float alpha = mix(0.035, 0.14, contour);

  fragColor = vec4(color, alpha);
}
`
