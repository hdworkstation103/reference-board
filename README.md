# Reference Board

Reference Board is a local-first infinite canvas for collecting and arranging visual reference.

It supports images, video, markdown notes, grouped frames, slideshow-style media stacks, transform controls, dark mode, and JSON canvas snapshots. The app is built with React, TypeScript, and Vite.

## Features

- Drop images and videos directly onto the board.
- Create markdown notes alongside media.
- Pan, drag, resize, multi-select, and align board items.
- Group items into frames and collapse frames into a compact slideshow view.
- Work with media stacks, including slide extraction and playback controls.
- Adjust per-item transforms from the inspector.
- Save and load canvas snapshots as JSON.
- Use session history to move through recent board changes.

## Development

```bash
npm install
npm run dev
```

The dev server uses Vite. By default it runs locally and supports hot reload.

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
