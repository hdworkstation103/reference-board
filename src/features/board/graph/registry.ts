export type GraphValueKind = "texture";

export type NodePortDefinition = {
  id: string;
  label: string;
  kind: GraphValueKind;
};

export type NodeDefinition = {
  id: string;
  label: string;
  inputs: NodePortDefinition[];
  outputs: NodePortDefinition[];
};

export type GraphConnection = {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
  kind: GraphValueKind;
};

export const MEDIA_NODE_DEFINITION_ID = "media";
export const BRIGHTNESS_NODE_DEFINITION_ID = "brightness";
export const PREVIEW_NODE_DEFINITION_ID = "preview";
export const MEDIA_OUTPUT_PORT_ID = "out";
export const BRIGHTNESS_INPUT_PORT_ID = "in";
export const BRIGHTNESS_OUTPUT_PORT_ID = "out";
export const PREVIEW_INPUT_PORT_ID = "in";

export const NODE_DEFINITIONS: Record<string, NodeDefinition> = {
  [MEDIA_NODE_DEFINITION_ID]: {
    id: MEDIA_NODE_DEFINITION_ID,
    label: "Media",
    inputs: [],
    outputs: [{ id: MEDIA_OUTPUT_PORT_ID, label: "Texture", kind: "texture" }],
  },
  [BRIGHTNESS_NODE_DEFINITION_ID]: {
    id: BRIGHTNESS_NODE_DEFINITION_ID,
    label: "Brightness",
    inputs: [{ id: BRIGHTNESS_INPUT_PORT_ID, label: "Texture", kind: "texture" }],
    outputs: [{ id: BRIGHTNESS_OUTPUT_PORT_ID, label: "Texture", kind: "texture" }],
  },
  [PREVIEW_NODE_DEFINITION_ID]: {
    id: PREVIEW_NODE_DEFINITION_ID,
    label: "Preview",
    inputs: [{ id: PREVIEW_INPUT_PORT_ID, label: "Texture", kind: "texture" }],
    outputs: [],
  },
};

export const getNodeDefinition = (definitionId: string) =>
  NODE_DEFINITIONS[definitionId] ?? null;

export const getMediaGraphNodeId = (imageId: number) => `media:${imageId}`;

export const parseMediaGraphNodeId = (nodeId: string) => {
  if (!nodeId.startsWith("media:")) {
    return null;
  }

  const imageId = Number(nodeId.slice("media:".length));
  return Number.isFinite(imageId) ? imageId : null;
};

export const resolveInputConnection = (
  connections: GraphConnection[],
  nodeId: string,
  portId: string,
) =>
  connections.find(
    (connection) =>
      connection.toNodeId === nodeId && connection.toPortId === portId,
  ) ?? null;
