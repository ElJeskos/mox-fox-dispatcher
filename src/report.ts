import type {
  FoxRanking,
  FoxReport,
  Observation,
  ScoringParameters,
} from "./types";

const round = (value: number) => Math.round(value * 10) / 10;

const pluralizeObservation = (count: number) => {
  if (count % 10 === 1 && count % 100 !== 11) return "наблюдение";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "наблюдения";
  }
  return "наблюдений";
};

function aggregateLocations(observations: Observation[]) {
  const counts = observations.reduce<Record<string, number>>((result, item) => {
    result[item.location] = (result[item.location] ?? 0) + 1;
    return result;
  }, {});
  return Object.entries(counts)
    .map(([location, count]) => ({ location, count }))
    .sort(
      (locationA, locationB) =>
        locationB.count - locationA.count ||
        locationA.location.localeCompare(locationB.location, "ru"),
    );
}

function rankFox(
  foxId: string,
  observations: Observation[],
  parameters: ScoringParameters,
): FoxRanking {
  const averageSuspicion =
    observations.reduce((total, item) => total + item.suspicion_level, 0) /
    observations.length;
  const maxSuspicion = Math.max(...observations.map((item) => item.suspicion_level));
  const preySightings = observations.filter((item) => item.has_prey).length;
  const [{ location: topLocation, count: topLocationCount }] = aggregateLocations(observations);

  const scoreParts = [
    {
      label: "Средняя подозрительность",
      value: averageSuspicion * parameters.suspicionWeight,
    },
    {
      label: "Замечена с добычей",
      value: preySightings * parameters.preyWeight,
    },
    {
      label: "Повторные наблюдения",
      value: Math.max(0, observations.length - 1) * parameters.repeatWeight,
    },
    {
      label: "Повтор в одной локации",
      value: Math.max(0, topLocationCount - 1) * parameters.sameLocationWeight,
    },
  ].map((part) => ({ ...part, value: round(part.value) }));

  const reasons = [
    `средняя подозрительность ${round(averageSuspicion)} из 10`,
    `${observations.length} ${pluralizeObservation(observations.length)} за одной лисой`,
  ];
  if (preySightings > 0) {
    reasons.push(`${preySightings} раз замечена с добычей`);
  }
  if (topLocationCount > 1) {
    reasons.push(`${topLocationCount} появления в локации «${topLocation}»`);
  }

  return {
    foxId,
    color: observations[observations.length - 1].color,
    score: round(scoreParts.reduce((total, part) => total + part.value, 0)),
    averageSuspicion: round(averageSuspicion),
    maxSuspicion,
    preySightings,
    observationCount: observations.length,
    topLocation,
    latestTime: observations
      .map((item) => item.time)
      .sort((timeA, timeB) => timeB.localeCompare(timeA))[0],
    reasons,
    scoreParts,
  };
}

export function calculateFoxReport(
  observations: Observation[],
  parameters: ScoringParameters,
): FoxReport {
  const grouped = observations.reduce<Record<string, Observation[]>>((groups, item) => {
    groups[item.fox_id] = [...(groups[item.fox_id] ?? []), item];
    return groups;
  }, {});
  const rankings = Object.entries(grouped)
    .map(([foxId, items]) => rankFox(foxId, items, parameters))
    .sort((foxA, foxB) => foxB.score - foxA.score || foxA.foxId.localeCompare(foxB.foxId));

  const locations = aggregateLocations(observations);
  const leaders = rankings.length > 0
    ? rankings.filter((fox) => fox.score === rankings[0].score)
    : [];

  return {
    leader: leaders.length === 1 ? leaders[0] : null,
    leaders,
    rankings,
    locations,
    uniqueFoxCount: rankings.length,
    totalObservationCount: observations.length,
    preyObservationCount: observations.filter((item) => item.has_prey).length,
    averageSuspicion:
      observations.length > 0
        ? round(
            observations.reduce((total, item) => total + item.suspicion_level, 0) /
              observations.length,
          )
        : 0,
  };
}
