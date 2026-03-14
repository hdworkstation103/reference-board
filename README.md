# Reference Board

Reference Board is a local-first infinite canvas for collecting and arranging visual reference.

It supports images, video, markdown notes, grouped frames, media stacks, transform controls, shader experiments, dark mode, and JSON canvas snapshots. The app is built with React, TypeScript, and Vite.

## Features

- Drop images and videos directly onto the board.
- Create markdown notes alongside media.
- Pan, drag, resize, multi-select, and align board items.
- Group items into frames and collapse frames into a compact tucked view.
- Work with media stacks, including slide extraction and playback controls.
- Adjust per-item transforms from the inspector.
- Experiment with GLSL fragment shaders in an in-app shader sandbox.
- Save and load canvas snapshots as JSON.
- Use session history to move through recent board changes.

## Development

```bash
npm install
npm run dev
```

The dev server uses Vite. By default it runs locally and supports hot reload.

## Shader Workflow

Shader experiments should go through the in-app sandbox before being attached to board media.

- Open `View -> Open Shader Sandbox`.
- Paste fragment shader code in Shadertoy-style `mainImage(out vec4 fragColor, in vec2 fragCoord)` format.
- The sandbox validates the shader against a real WebGL context before mounting it.
- The preview uses the same local WebGL render path as board media overlays and selection effects.

Relevant files:

- `src/features/board/components/ShaderSurface.tsx`
- `src/features/board/components/ShaderSandbox.tsx`
- `src/features/board/utils/shaders.ts`

Notes for future agents:

- `npm run build` does not validate GLSL. TypeScript can pass while the shader still fails at runtime.
- GLSL is rendered through a small in-repo WebGL canvas component, not a third-party React shader wrapper.
- Preflight validation must compile and link a full WebGL program, not just the fragment shader.
- If shader work is requested, test it in the sandbox first, then reuse `ShaderSurface` for production mounting so sandbox and live rendering stay aligned.

## Build

```bash
npm run build
npm run preview
```

## Snapshot Format

Canvas state can be exported to JSON and loaded back into the app. Current snapshots include:

- media records
- note nodes
- frame definitions
- media transform settings
- dark mode state

## Status

This project is currently oriented around local use and rapid iteration rather than polished packaging or cloud sync.
