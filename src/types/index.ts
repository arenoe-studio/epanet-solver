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

export type NodeResult = {
  id: string;
  elevation: number;
  pressureBefore: number;
  pressureAfter: number;
  code: "P-OK" | "P-LOW" | "P-HIGH" | "P-NEG";
};

export type PipeResult = {
  id: string;
  length: number;
  diameterBefore: number;
  diameterAfter: number;
  velocityBefore: number;
  velocityAfter: number;
  headlossBefore: number;
  headlossAfter: number;
  code: "OK" | "V-LOW" | "V-HIGH" | "HL-HIGH" | "HL-SMALL";
};

export type MaterialResult = {
  pipeId: string;
  diameterMm: number;
  material: string;
  C: number;
  pressureWorkingM: number;
  notes: string[];
};

export type NetworkInfo = {
  totalDemandLps: number;
  headReservoirM: number;
};

export type AnalysisResult = {
  analysisId: number;
  fileName: string;
  sourceFileName?: string;
  sourceFileBase64?: string;
  sourceFileUrl?: string;
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
    inp?: string;
    md?: string;
    inpUrl?: string;
    mdUrl?: string;
  };
  filesV1?: {
    inp?: string;
    md?: string;
    inpUrl?: string;
    mdUrl?: string;
  };
  filesFinal?: {
    inp?: string;
    md?: string;
    inpUrl?: string;
    mdUrl?: string;
  } | null;
  nodes?: NodeResult[];
  pipes?: PipeResult[];
  materials?: MaterialResult[];
  networkInfo?: NetworkInfo;
};
