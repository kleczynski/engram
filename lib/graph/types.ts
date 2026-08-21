export type EdgeType = "hierarchy" | "relation" | "ai_suggested" | "ai_approved";

export type GraphNode = {
  id: string;
  notionId: string;
  title: string;
  depth: number;
  parentId: string | null;
  notionUrl: string | null;
  lucidUrl: string | null;
  hubScore: number;
  edgeCount: number;
  childCount: number;
  lastEditedTime: string | null;
  observability: boolean;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
};

export type GraphPayload = {
  rootId: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  lastSyncedAt: string | null;
};

export type SyncSummary = {
  pagesAdded: number;
  pagesChanged: number;
  pagesUnchanged: number;
  pagesRemoved: number;
  edgesWritten: number;
  notionRequests: number;
  truncated: boolean;
  warnings: string[];
  durationMs: number;
};
