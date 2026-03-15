# Node Graph Roadmap

This document tracks the staged direction for the board's node-graph system.

## Current Milestone

The current worktree milestone is:

- a minimal node-definition registry
- typed ports with one value kind: `texture`
- graph connections for media output to preview input
- node output surfaces rendered from source media into canvases
- a shader-backed preview consumer that samples those surfaces

At this stage, the graph layer is intentionally small and mostly lives in app state. It is enough to prove the architecture without forcing a full rewrite of the existing board/content model.

## Phase 1: Graph Foundation

Goal:

- define node types independently from board visuals
- define inputs, outputs, and connection validation
- derive graph node instances for current media nodes
- support preview nodes as graph consumers

Deliverables:

- `NodeDefinition` registry
- `Connection[]`
- one supported resource kind: `texture`
- media -> preview flow resolved through the graph rather than special-case state

## Phase 2: Resource Runtime

Goal:

- treat node outputs as first-class resources
- make those resources reusable by downstream nodes

Deliverables:

- output surface cache
- resource resolution by `(nodeId, portId)`
- lifecycle rules for invalidation and re-rendering
- clearer separation between board state and graph/runtime state

## Phase 3: Real Processing Nodes

Goal:

- prove that data can flow through transformations, not just source -> preview

Suggested first nodes:

- brightness/contrast
- blur
- chroma shift
- posterize

Deliverables:

- one or more shader/effect nodes
- chainable graph evaluation
- preview node consuming the final resource at the end of a chain

## Phase 4: Persisted Graph State

Goal:

- make graph structure survive reload/save/load

Deliverables:

- graph connections added to snapshot format
- graph nodes that are not plain media items added to snapshot format
- history/undo integration for graph edits

## Phase 5: Modular Node Registration

Goal:

- allow node functionality to be registered without hardcoding every node into the app

Likely approach in this codebase:

- a registry composed from built-in modules plus discovered local modules
- build-time discovery with `import.meta.glob`
- validation with warnings for invalid node modules

This is plugin-style extensibility, even if the first version is not arbitrary runtime filesystem scanning.

## Phase 6: Expanded Data Types

After `texture`, the likely next resource kinds are:

- scalar values
- vectors
- masks
- metadata
- timeline/control signals

This is the step that moves the board closer to a simplified TouchDesigner-style playground rather than a media-only graph.

## Phase 7: Authoring and UX

Once the runtime is stable:

- expose typed sockets on more node kinds
- improve connection editing
- add node search / creation affordances
- make chains easier to inspect and debug
- provide per-node status and graph warnings
