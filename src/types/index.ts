export type AppState =
  | "hero"
  | "upload"
  | "file-selected"
  | "processing"
  | "results"
  | "error";

export type User = {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
};

export type AnalysisResult = {
  analysisId: number;
  fileName: string;
  summary: {
    iterations: number;
    issuesFound: number;
    issuesFixed: number;
    remainingIssues: number;
    duration: number;
    nodes: number;
    pipes: number;
  };
  prv?: {
    needed: boolean;
    tokenCost?: number;
    recommendations?: Array<{
      pipeId: string;
      upstreamNode: string;
      downstreamNode: string;
      settingHeadM: number;
      pressureTargetM: number;
      elevationMaxM: number;
      coveredNodes: string[];
      estimatedPressuresM: Record<string, number>;
    }>;
  };
  files: {
    inp: string;
    md: string;
  };
  filesV1?: {
    inp: string;
    md: string;
  };
  filesFinal?: {
    inp: string;
    md: string;
  } | null;
};
