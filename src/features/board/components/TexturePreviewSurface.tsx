import { useEffect, useMemo, useRef } from "react";
import { createShaderProgram } from "../utils";

type TexturePreviewSurfaceProps = {
  className?: string;
  source: HTMLCanvasElement | null;
};

const FULLSCREEN_QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

const TEXTURE_PREVIEW_FS = `
uniform sampler2D uSource;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  uv.y = 1.0 - uv.y;
  fragColor = texture2D(uSource, uv);
}
`;

function TexturePreviewSurface({
  className,
  source,
}: TexturePreviewSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(source);
  const classNames = useMemo(
    () => ["preview-node-surface", className].filter(Boolean).join(" "),
    [className],
  );

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!gl) {
      return;
    }

    const programResult = createShaderProgram(gl, TEXTURE_PREVIEW_FS, {
      devicePixelRatio: window.devicePixelRatio || 1,
    });
    if (programResult.error || !programResult.program) {
      return;
    }

    const { program, vertexShader, fragmentShader } = programResult;
    const positionBuffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (!positionBuffer || !texture) {
      gl.deleteProgram(program);
      if (vertexShader) {
        gl.deleteShader(vertexShader);
      }
      if (fragmentShader) {
        gl.deleteShader(fragmentShader);
      }
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const positionLocation = gl.getAttribLocation(program, "aVertexPosition");
    const resolutionLocation = gl.getUniformLocation(program, "iResolution");
    const sourceLocation = gl.getUniformLocation(program, "uSource");

    let frameId = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
      if (resolutionLocation) {
        gl.useProgram(program);
        gl.uniform2f(resolutionLocation, width, height);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
    });
    resizeObserver.observe(canvas);

    const render = () => {
      resize();

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      const activeSource = sourceRef.current;
      if (activeSource) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          activeSource,
        );
        if (sourceLocation) {
          gl.uniform1i(sourceLocation, 0);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      gl.deleteTexture(texture);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      if (vertexShader) {
        gl.deleteShader(vertexShader);
      }
      if (fragmentShader) {
        gl.deleteShader(fragmentShader);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className={classNames} aria-hidden="true" />;
}

export default TexturePreviewSurface;
