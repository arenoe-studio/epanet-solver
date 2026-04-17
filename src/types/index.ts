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
  files: {
    inp: string;
    md: string;
  };
};
