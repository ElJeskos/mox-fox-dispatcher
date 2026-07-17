export type FoxColor = "рыжая" | "черная" | "серебристая";

export type Observation = {
  id: string;
  fox_id: string;
  location: string;
  color: FoxColor;
  has_prey: boolean;
  suspicion_level: number;
  time: string;
};

export type ScoringParameters = {
  suspicionWeight: number;
  preyWeight: number;
  repeatWeight: number;
  sameLocationWeight: number;
};

export type ScorePart = {
  label: string;
  value: number;
};

export type FoxRanking = {
  foxId: string;
  color: FoxColor;
  score: number;
  averageSuspicion: number;
  maxSuspicion: number;
  preySightings: number;
  observationCount: number;
  topLocation: string;
  latestTime: string;
  reasons: string[];
  scoreParts: ScorePart[];
};

export type FoxReport = {
  leader: FoxRanking | null;
  leaders: FoxRanking[];
  rankings: FoxRanking[];
  locations: Array<{ location: string; count: number }>;
  uniqueFoxCount: number;
  totalObservationCount: number;
  preyObservationCount: number;
  averageSuspicion: number;
};
