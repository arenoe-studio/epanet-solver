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
  elevation: number | null;
  baseDemandLps?: number | null;
  headAwalM?: number | null;
  headDiameterM?: number | null;
  headTekananM?: number | null;
  pressureAwalM?: number | null;
  pressureDiameterM?: number | null;
  pressureTekananM?: number | null;
  pressureBefore: number | null;
  pressureAfter: number | null;
  code: "P-OK" | "P-LOW" | "P-HIGH" | "P-NEG";
};

export type PipeResult = {
  id: string;
  fromNode?: string | null;
  toNode?: string | null;
  length: number | null;
  roughnessC?: number | null;
  diameterAwalMm?: number | null;
  diameterDiameterMm?: number | null;
  diameterTekananMm?: number | null;
  flowAwalLps?: number | null;
  flowDiameterLps?: number | null;
  flowTekananLps?: number | null;
  flowAwalLpsAbs?: number | null;
  flowDiameterLpsAbs?: number | null;
  flowTekananLpsAbs?: number | null;
  flowAwalDir?: string | null;
  flowDiameterDir?: string | null;
  flowTekananDir?: string | null;
  velocityAwalMps?: number | null;
  velocityDiameterMps?: number | null;
  velocityTekananMps?: number | null;
  unitHeadlossAwalMkm?: number | null;
  unitHeadlossDiameterMkm?: number | null;
  unitHeadlossTekananMkm?: number | null;
  diameterBefore: number | null;
  diameterAfter: number | null;
  velocityBefore: number | null;
  velocityAfter: number | null;
  headlossBefore: number | null;
  headlossAfter: number | null;
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
    remainingIssues?: number;
    duration?: number;
    nodes: number;
    pipes: number;
    pressureOptimizationAvailable?: boolean;
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
    postFix?: {
      status: "resolved" | "partially_resolved" | "unresolved";
      remainingHighNodes: Array<{ id: string; pressure: number; elevation: number }>;
      remainingLowNodes: Array<{ id: string; pressure: number; elevation: number }>;
      remainingNegativeNodes: Array<{ id: string; pressure: number; elevation: number }>;
      recommendations: string[];
      recommendedActions: Array<{
        type: string;
        message: string;
        nodes?: string[];
        recommendations?: Array<Record<string, unknown>>;
        unresolvedNodes?: string[];
      }>;
    };
  };
  prvDebug?: Array<{
    stage: number;
    status?: string;
    before: {
      highCount: number;
      lowCount: number;
      negativeCount: number;
      highNodes: Array<{ id: string; pressure: number }>;
      lowNodes: Array<{ id: string; pressure: number }>;
      negativeNodes: Array<{ id: string; pressure: number }>;
    };
    recommendations: Array<{
      pipeId: string;
      settingHeadM: number;
      coveredNodes: string[];
    }>;
    applied?: Array<{
      prvValve: string;
      originalPipe: string;
      settingHeadM: number;
    }>;
    tuningEnd?: {
      status: string;
      reason: string;
      minP: number;
      maxP: number;
    };
    after?: {
      highCount: number;
      lowCount: number;
      negativeCount: number;
      highNodes: Array<{ id: string; pressure: number }>;
      lowNodes: Array<{ id: string; pressure: number }>;
      negativeNodes: Array<{ id: string; pressure: number }>;
    };
    followupStatus?: string;
  }>;
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
  warnings?: string[];
  diagnostics?: {
    baseline?: Record<string, unknown>;
    afterDiameter?: Record<string, unknown>;
    final?: Record<string, unknown>;
  };
};
