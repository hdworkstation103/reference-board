import type { BoardDocument } from "./board";

export type HistoryVisibilityPriority = 0 | 1 | 2;

export type HistoryEntry = {
  id: string;
  label: string;
  timestamp: number;
  visibilityPriority: HistoryVisibilityPriority;
  before: BoardDocument;
  after: BoardDocument;
};
