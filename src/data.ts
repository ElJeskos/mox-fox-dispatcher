import type { Observation, ScoringParameters } from "./types";

export const INITIAL_OBSERVATIONS: Observation[] = [
  {
    id: "obs_001",
    fox_id: "fox_001",
    location: "Северная поляна",
    color: "рыжая",
    has_prey: true,
    suspicion_level: 8,
    time: "08:20",
  },
  {
    id: "obs_002",
    fox_id: "fox_002",
    location: "Туманная тропа",
    color: "черная",
    has_prey: false,
    suspicion_level: 5,
    time: "09:05",
  },
  {
    id: "obs_003",
    fox_id: "fox_001",
    location: "Северная поляна",
    color: "рыжая",
    has_prey: false,
    suspicion_level: 9,
    time: "10:40",
  },
  {
    id: "obs_004",
    fox_id: "fox_003",
    location: "Моховой овраг",
    color: "серебристая",
    has_prey: true,
    suspicion_level: 7,
    time: "11:15",
  },
  {
    id: "obs_005",
    fox_id: "fox_004",
    location: "Северная поляна",
    color: "рыжая",
    has_prey: false,
    suspicion_level: 3,
    time: "12:10",
  },
];

export const DEFAULT_PARAMETERS: ScoringParameters = {
  suspicionWeight: 1,
  preyWeight: 3,
  repeatWeight: 2,
  sameLocationWeight: 1.5,
};
