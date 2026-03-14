# Shader Render Pipeline

This project uses a small in-repo WebGL renderer for shader effects instead of a third-party React shader wrapper.

The current goals are:

- keep shader mounting behavior predictable
- make sandbox and production rendering use the same path
- get real WebGL compile/link validation before mounting a shader
- keep the system small enough to debug locally

## Main Pieces

### `src/features/board/constants.ts`

Stores fragment shader source strings used by the app, including:

- `SELECTION_SHADER_FS`
- `MEDIA_SHINE_SHADER_FS`

These shaders are written in Shadertoy-style `mainImage(out vec4 fragColor, in vec2 fragCoord)` format.

### `src/features/board/utils/shaders.ts`

Contains the low-level shader preparation and validation helpers.

Main responsibilities:

- inject GLSL precision headers
- inject built-in uniforms such as `iTime` and `iResolution`
- append the wrapper `main()` function that calls `mainImage(...)`
- compile shaders against a real WebGL context
- link a full WebGL program for validation

Important functions:

- `buildReactShaderFragmentSource(...)`
- `createCompiledShader(...)`
- `createShaderProgram(...)`
- `validateReactShaderSource(...)`

Despite the older function name, this is no longer tied to `react-shaders`.

## Runtime Renderer

### `src/features/board/components/ShaderSurface.tsx`

`ShaderSurface` is the shared runtime renderer.

It:

- renders a `<canvas>`
- creates a WebGL context
- builds a shader program from the provided fragment source
- uploads a fullscreen quad
- updates `iTime` and `iResolution`
- redraws every animation frame
- enables alpha blending so overlays composite correctly over media

This component is the core of the shader system. If a shader should appear in the UI, it should usually be mounted through `ShaderSurface`.

## Where It Is Used

### Shader Sandbox

`src/features/board/components/ShaderSandbox.tsx`

The sandbox is the first place to test shader work.

It allows you to:

- paste fragment shader code
- validate compile + link behavior
- preview the shader live over a sample image

The sandbox uses the same `ShaderSurface` component as production overlays.

### Media Shine Overlay

`src/features/board/components/MediaShineFx.tsx`

Wraps `ShaderSurface` for the shining overlay effect applied in:

- `src/features/board/components/MediaBody.tsx`

### Selection Effect

`src/features/board/components/NodeSelectionFx.tsx`

Also uses `ShaderSurface` so selection rendering stays on the same pipeline.

## Why This Exists

Earlier shader work used a third-party wrapper that:

- could fail at runtime even when TypeScript passed
- sometimes reported poor diagnostics such as `null` logs
- made sandbox behavior diverge from production behavior

The local pipeline avoids that by making validation and rendering explicit.

## Workflow For Future Shader Work

1. Add or edit shader source in `constants.ts` or paste into the sandbox first.
2. Test it in the in-app Shader Sandbox.
3. Only after it behaves correctly there, mount it through `ShaderSurface`.
4. If production usage needs a thin wrapper, create one like `MediaShineFx.tsx`.

## Important Notes

- `npm run build` does not validate GLSL.
- A shader can pass TypeScript and still fail in the browser.
- Validation must include both compile and program link, not just fragment compilation.
- If sandbox and production behavior diverge, that is a bug in the render path and should be fixed before continuing shader work.
