export const START_X = 100
export const START_Y = 100
export const IMAGE_WIDTH = 280
export const MIN_IMAGE_WIDTH = 80
export const NOTE_DEFAULT_ASPECT = 0.7
export const WORLD_SIZE = 120000
export const WORLD_ORIGIN = WORLD_SIZE / 2
export const CAPTION_HEIGHT = 22
export const CARD_BORDER_HEIGHT = 2
export const SELECTION_SHADER_FS = `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= iResolution.x / iResolution.y;

  float r = length(p);
  float edge = 1.0 - r;
  float ring = smoothstep(0.22, 0.02, edge) * (1.0 - smoothstep(0.06, 0.0, edge));
  float pulse = 0.65 + 0.35 * sin(iTime * 4.0);
  float sweep = 0.5 + 0.5 * sin((uv.x + uv.y) * 18.0 - iTime * 6.5);
  vec3 col = mix(vec3(0.08, 0.45, 1.0), vec3(0.35, 1.0, 1.0), sweep);
  float alpha = ring * (0.55 + 0.45 * pulse);

  fragColor = vec4(col, alpha);
}
`
