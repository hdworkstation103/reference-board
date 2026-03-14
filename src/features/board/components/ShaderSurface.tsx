import { useEffect, useRef, useState } from "react";
import { createShaderProgram, validateReactShaderSource } from "../utils";

type ShaderSurfaceStatus = {
  ready: boolean;
  validationError: string | null;
  runtimeError: string | null;
  runtimeWarning: string | null;
};

type ShaderSurfaceProps = {
  fs: string;
  className?: string;
  onStatusChange?: (status: ShaderSurfaceStatus) => void;
};

const FULLSCREEN_QUAD = new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  1, 1,
]);

function ShaderSurface({ fs, className, onStatusChange }: ShaderSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<ShaderSurfaceStatus>({
    ready: false,
    validationError: null,
    runtimeError: null,
    runtimeWarning: null,
  });

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const validationError = validateReactShaderSource(fs);
    if (validationError) {
      setStatus({
        ready: true,
        validationError,
        runtimeError: null,
        runtimeWarning: null,
      });
      return;
    }

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!gl) {
      setStatus({
        ready: true,
        validationError: null,
        runtimeError: "WebGL is unavailable in this browser context.",
        runtimeWarning: null,
      });
      return;
    }

    const programResult = createShaderProgram(gl, fs, {
      devicePixelRatio: window.devicePixelRatio || 1,
    });
    if (programResult.error || !programResult.program) {
      setStatus({
        ready: true,
        validationError: null,
        runtimeError: programResult.error ?? "Unable to initialize shader program.",
        runtimeWarning: null,
      });
      return;
    }

    const { program, vertexShader, fragmentShader } = programResult;
    const positionBuffer = gl.createBuffer();
    if (!positionBuffer) {
      gl.deleteProgram(program);
      if (vertexShader) {
        gl.deleteShader(vertexShader);
      }
      if (fragmentShader) {
        gl.deleteShader(fragmentShader);
      }
      setStatus({
        ready: true,
        validationError: null,
        runtimeError: "Unable to allocate shader vertex buffer.",
        runtimeWarning: null,
      });
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "aVertexPosition");
    const timeLocation = gl.getUniformLocation(program, "iTime");
    const resolutionLocation = gl.getUniformLocation(program, "iResolution");

    let frameId = 0;
    let startTime = 0;

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
    resize();

    const render = (timestamp: number) => {
      if (startTime === 0) {
        startTime = timestamp;
      }

      resize();

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      if (timeLocation) {
        gl.uniform1f(timeLocation, (timestamp - startTime) / 1000);
      }
      if (resolutionLocation) {
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      frameId = window.requestAnimationFrame(render);
    };

    setStatus({
      ready: true,
      validationError: null,
      runtimeError: null,
      runtimeWarning: null,
    });
    frameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      if (vertexShader) {
        gl.deleteShader(vertexShader);
      }
      if (fragmentShader) {
        gl.deleteShader(fragmentShader);
      }
    };
  }, [fs]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

export type { ShaderSurfaceStatus };
export default ShaderSurface;
