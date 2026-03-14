const FS_MAIN_SHADER = `
void main(void){
    vec4 color = vec4(0.0,0.0,0.0,1.0);
    mainImage(color, gl_FragCoord.xy);
    gl_FragColor = color;
}`;

export const BASIC_VS = `attribute vec3 aVertexPosition;
void main(void) {
    gl_Position = vec4(aVertexPosition, 1.0);
}`;

const BUILTIN_UNIFORMS: Array<{ name: string; declaration: string }> = [
  { name: "iTime", declaration: "uniform float iTime;" },
  { name: "iResolution", declaration: "uniform vec2 iResolution;" },
  { name: "iMouse", declaration: "uniform vec4 iMouse;" },
  { name: "iFrame", declaration: "uniform int iFrame;" },
  { name: "iTimeDelta", declaration: "uniform float iTimeDelta;" },
  { name: "iDate", declaration: "uniform vec4 iDate;" },
  { name: "iDeviceOrientation", declaration: "uniform vec4 iDeviceOrientation;" },
];

export const buildReactShaderFragmentSource = (
  source: string,
  precision: "lowp" | "mediump" | "highp" = "highp",
  devicePixelRatio = 1,
) => {
  const precisionHeader = `precision ${precision} float;\n`;
  const dprHeader = `#define DPR ${devicePixelRatio.toFixed(1)}\n`;
  let fragmentSource = `${precisionHeader}${dprHeader}${source}`.replace(
    /texture\(/g,
    "texture2D(",
  );

  const insertionPoint = precisionHeader.length;
  const uniformBlock = BUILTIN_UNIFORMS.filter(({ name }) => source.includes(name))
    .map(({ declaration }) => `${declaration}\n`)
    .join("");

  if (uniformBlock) {
    fragmentSource =
      fragmentSource.slice(0, insertionPoint) +
      uniformBlock +
      fragmentSource.slice(insertionPoint);
  }

  if (source.includes("mainImage")) {
    fragmentSource += FS_MAIN_SHADER;
  }

  return fragmentSource;
};

export const createCompiledShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) => {
  const shader = gl.createShader(type);
  if (!shader) {
    return { shader: null, error: "Unable to allocate shader object." };
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return { shader, error: null };
  }

  const infoLog = gl.getShaderInfoLog(shader) ?? "Unknown shader compile error.";
  gl.deleteShader(shader);
  return { shader: null, error: infoLog };
};

export const createShaderProgram = (
  gl: WebGLRenderingContext,
  fragmentSource: string,
  options?: {
    precision?: "lowp" | "mediump" | "highp";
    devicePixelRatio?: number;
  },
) => {
  const preparedFragmentSource = buildReactShaderFragmentSource(
    fragmentSource,
    options?.precision,
    options?.devicePixelRatio,
  );

  const vertexResult = createCompiledShader(gl, gl.VERTEX_SHADER, BASIC_VS);
  if (vertexResult.error || !vertexResult.shader) {
    return {
      program: null,
      vertexShader: null,
      fragmentShader: null,
      preparedFragmentSource,
      error: `Vertex shader compile failed: ${vertexResult.error ?? "Unknown vertex shader error."}`,
    };
  }

  const fragmentResult = createCompiledShader(
    gl,
    gl.FRAGMENT_SHADER,
    preparedFragmentSource,
  );
  if (fragmentResult.error || !fragmentResult.shader) {
    gl.deleteShader(vertexResult.shader);
    return {
      program: null,
      vertexShader: null,
      fragmentShader: null,
      preparedFragmentSource,
      error: `Fragment shader compile failed: ${fragmentResult.error ?? "Unknown fragment shader error."}`,
    };
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexResult.shader);
    gl.deleteShader(fragmentResult.shader);
    return {
      program: null,
      vertexShader: null,
      fragmentShader: null,
      preparedFragmentSource,
      error: "Unable to allocate shader program.",
    };
  }

  gl.attachShader(program, vertexResult.shader);
  gl.attachShader(program, fragmentResult.shader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const programInfoLog =
      gl.getProgramInfoLog(program) ?? "Unknown program link error.";
    gl.deleteProgram(program);
    gl.deleteShader(vertexResult.shader);
    gl.deleteShader(fragmentResult.shader);
    return {
      program: null,
      vertexShader: null,
      fragmentShader: null,
      preparedFragmentSource,
      error: `Shader program link failed: ${programInfoLog}`,
    };
  }

  return {
    program,
    vertexShader: vertexResult.shader,
    fragmentShader: fragmentResult.shader,
    preparedFragmentSource,
    error: null,
  };
};

export const validateReactShaderSource = (
  fragmentSource: string,
  options?: {
    precision?: "lowp" | "mediump" | "highp";
    devicePixelRatio?: number;
  },
) => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl");

  if (!gl) {
    return "WebGL is unavailable in this browser context.";
  }

  const result = createShaderProgram(gl, fragmentSource, options);
  if (result.program) {
    gl.deleteProgram(result.program);
  }
  if (result.vertexShader) {
    gl.deleteShader(result.vertexShader);
  }
  if (result.fragmentShader) {
    gl.deleteShader(result.fragmentShader);
  }

  return result.error;
};
