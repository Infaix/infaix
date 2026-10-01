import type { InfaixApp } from "./app-contract";

export const TIME_RANGES = { "1H": 3600000, "6H": 21600000, "24H": 86400000, "7D": 604800000, "30D": 2592000000 } as const;
export type TimeRange = keyof typeof TIME_RANGES;
export interface OperationsSnapshot {
  totalUsers: number;
  recentUsers: number;
  activeSessions: number;
  events: { event: string; count: number }[];
  recentEvents: { event: string; created_at: number }[];
  activity: { bucket: number; count: number }[];
}
export interface OperationsResponse {
  range: TimeRange;
  from: number;
  to: number;
  bucketMs: number;
  role: "OWNER" | "ADMIN";
  environment: string;
  snapshot: OperationsSnapshot;
  applications: (InfaixApp & { health: "unknown"; version: null; latencyMs: null })[];
}
