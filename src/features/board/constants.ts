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
  float edgeDist = min(
    min(uv.x, 1.0 - uv.x),
    min(uv.y, 1.0 - uv.y)
  );
  float outerGlow = 1.0 - smoothstep(0.0, 0.035, edgeDist);
  float innerCut = 1.0 - smoothstep(0.02, 0.055, edgeDist);
  float border = clamp(outerGlow - innerCut, 0.0, 1.0);
  float pulse = 0.65 + 0.35 * sin(iTime * 4.0);
  float sweep = 0.5 + 0.5 * sin((uv.x + uv.y) * 18.0 - iTime * 6.5);
  vec3 col = mix(vec3(0.08, 0.45, 1.0), vec3(0.35, 1.0, 1.0), sweep);
  float alpha = border * (0.55 + 0.45 * pulse);

  fragColor = vec4(col, alpha);
}
`

export const MEDIA_SHINE_SHADER_FS = `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 centered = fragCoord - 0.5 * iResolution.xy;

  float columnWidth = 100.0;
  float speed = 200.0;
  float blurPx = 24.0;
  float angleDeg = 45.0;

  float angleRad = radians(angleDeg);
  vec2 dir = vec2(cos(angleRad), sin(angleRad));
  float axis = dot(centered, dir);

  float travelExtent =
    0.5 * abs(dir.x) * iResolution.x +
    0.5 * abs(dir.y) * iResolution.y;

  float bandCenter =
    mod(iTime * speed, 2.0 * travelExtent + columnWidth) -
    (travelExtent + columnWidth * 0.5);

  float distToCenter = abs(axis - bandCenter);
  float halfWidth = columnWidth * 0.5;
  float inside = 1.0 - step(halfWidth, distToCenter);
  float edgeDist = max(distToCenter - halfWidth, 0.0);
  float glow = 1.0 - smoothstep(0.0, blurPx, edgeDist);
  float intensity = max(inside, glow);

  fragColor = vec4(vec3(intensity), 1.0);
}
`
