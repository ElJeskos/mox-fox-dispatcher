import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_PARAMETERS, INITIAL_OBSERVATIONS } from "./data";
import { FormulaDialog } from "./FormulaDialog";
import { calculateFoxReport } from "./report";
import type { FoxColor, FoxRanking, Observation, ScoringParameters } from "./types";
import { WorklogView } from "./WorklogView";

type View = "overview" | "worklog";

const PARAMETER_META: Array<{
  key: keyof ScoringParameters;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
}> = [
  {
    key: "suspicionWeight",
    label: "Уровень подозрительности",
    hint: "умножает среднюю оценку",
    min: 0,
    max: 2,
    step: 0.1,
  },
  {
    key: "preyWeight",
    label: "Наличие добычи",
    hint: "за каждое наблюдение",
    min: 0,
    max: 8,
    step: 0.5,
  },
  {
    key: "repeatWeight",
    label: "Повторная встреча",
    hint: "за наблюдение после первого",
    min: 0,
    max: 6,
    step: 0.5,
  },
  {
    key: "sameLocationWeight",
    label: "Одна локация",
    hint: "за повтор в главной точке",
    min: 0,
    max: 5,
    step: 0.5,
  },
];

const COLOR_SWATCHES: Record<FoxColor, string> = {
  рыжая: "#e96631",
  черная: "#30352f",
  серебристая: "#9a9f99",
};

function FoxMark({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className={compact ? "fox-mark fox-mark--compact" : "fox-mark"}
      viewBox="0 0 128 128"
      role="img"
      aria-label="Силуэт лисы"
    >
      <path d="M24 18 51 37 64 31l13 6 27-19-7 42c7 14 5 31-7 42-7 7-17 11-26 11s-19-4-26-11c-12-11-14-28-7-42L24 18Z" />
      <path className="fox-mark__light" d="M40 63c8 3 16 4 24 4s16-1 24-4c-3 22-10 35-24 43-14-8-21-21-24-43Z" />
      <circle className="fox-mark__eye" cx="48" cy="65" r="3" />
      <circle className="fox-mark__eye" cx="80" cy="65" r="3" />
      <path className="fox-mark__nose" d="m58 84 6-4 6 4-6 6-6-6Z" />
    </svg>
  );
}

function formatScore(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function foxCountLabel(count: number) {
  if (count % 10 === 1 && count % 100 !== 11) return `${count} лиса`;
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return `${count} лисы`;
  }
  return `${count} лис`;
}

function RankingRow({
  fox,
  index,
  maxScore,
  selected,
  onSelect,
}: {
  fox: FoxRanking;
  index: number;
  maxScore: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const width = fox.score > 0 && maxScore > 0
    ? Math.max(5, (fox.score / maxScore) * 100)
    : 0;
  return (
    <button
      className={`ranking-row ${selected ? "ranking-row--selected" : ""}`}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="ranking-row__position">0{index + 1}</span>
      <span
        className="ranking-row__swatch"
        style={{ background: COLOR_SWATCHES[fox.color] }}
      />
      <span className="ranking-row__identity">
        <strong>{fox.foxId}</strong>
        <small>{fox.color} · {fox.topLocation}</small>
      </span>
      <span className="ranking-row__meter" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </span>
      <strong className="ranking-row__score">{formatScore(fox.score)}</strong>
    </button>
  );
}

function ParameterControl({
  meta,
  value,
  onChange,
}: {
  meta: (typeof PARAMETER_META)[number];
  value: number;
  onChange: (value: number) => void;
}) {
  const position = ((value - meta.min) / (meta.max - meta.min)) * 100;
  return (
    <label className="parameter">
      <span className="parameter__title">
        <span>
          <strong>{meta.label}</strong>
          <small>{meta.hint}</small>
        </span>
        <output>{value.toFixed(meta.step < 1 ? 1 : 0)}</output>
      </span>
      <input
        aria-label={meta.label}
        type="range"
        min={meta.min}
        max={meta.max}
        step={meta.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--range-position": `${position}%` } as React.CSSProperties}
      />
    </label>
  );
}

function ObservationEditor({
  observation,
  onChange,
  onRemove,
}: {
  observation: Observation;
  onChange: (patch: Partial<Observation>) => void;
  onRemove: () => void;
}) {
  const updateSuspicion = (value: number) => {
    onChange({ suspicion_level: Math.max(0, Math.min(10, Math.round(value))) });
  };

  return (
    <div className="observation-row" data-observation-id={observation.id}>
      <label>
        <span className="mobile-label">Лиса</span>
        <input
          aria-label={`Лиса ${observation.id}`}
          value={observation.fox_id}
          onChange={(event) => onChange({ fox_id: event.target.value })}
        />
      </label>
      <label>
        <span className="mobile-label">Локация</span>
        <input
          aria-label={`Локация ${observation.id}`}
          value={observation.location}
          onChange={(event) => onChange({ location: event.target.value })}
        />
      </label>
      <label>
        <span className="mobile-label">Окрас</span>
        <select
          aria-label={`Окрас ${observation.id}`}
          value={observation.color}
          onChange={(event) => onChange({ color: event.target.value as FoxColor })}
        >
          <option>рыжая</option>
          <option>черная</option>
          <option>серебристая</option>
        </select>
      </label>
      <div className="suspicion-field">
        <span className="mobile-label">Подозр.</span>
        <div className="suspicion-stepper">
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Уменьшить подозрительность ${observation.id}`}
            title="Уменьшить на 1"
            disabled={observation.suspicion_level <= 0}
            onClick={() => updateSuspicion(observation.suspicion_level - 1)}
          >
            −
          </button>
          <span className="suspicion-stepper__value">
            <input
              aria-label={`Подозрительность ${observation.id}`}
              type="number"
              min="0"
              max="10"
              step="1"
              value={observation.suspicion_level}
              style={{
                width: `calc(${String(observation.suspicion_level).length}ch + 2px)`,
              }}
              onKeyDown={(event) => {
                if (event.key === "Home") {
                  event.preventDefault();
                  updateSuspicion(0);
                }
                if (event.key === "End") {
                  event.preventDefault();
                  updateSuspicion(10);
                }
              }}
              onChange={(event) => updateSuspicion(Number(event.target.value))}
            />
            <small className="suspicion-stepper__scale" aria-hidden="true">/10</small>
          </span>
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Увеличить подозрительность ${observation.id}`}
            title="Увеличить на 1"
            disabled={observation.suspicion_level >= 10}
            onClick={() => updateSuspicion(observation.suspicion_level + 1)}
          >
            +
          </button>
        </div>
      </div>
      <label className="prey-toggle">
        <input
          aria-label={`Добыча ${observation.id}`}
          type="checkbox"
          checked={observation.has_prey}
          onChange={(event) => onChange({ has_prey: event.target.checked })}
        />
        <span aria-hidden="true" />
        <small>{observation.has_prey ? "есть" : "нет"}</small>
      </label>
      <label>
        <span className="mobile-label">Время</span>
        <input
          aria-label={`Время ${observation.id}`}
          type="time"
          value={observation.time}
          onChange={(event) => onChange({ time: event.target.value })}
        />
      </label>
      <button
        type="button"
        className="icon-button"
        aria-label={`Удалить ${observation.id}`}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}

export function App() {
  const [view, setView] = useState<View>("overview");
  const [observations, setObservations] = useState<Observation[]>(INITIAL_OBSERVATIONS);
  const [parameters, setParameters] = useState<ScoringParameters>(DEFAULT_PARAMETERS);
  const [selectedFoxId, setSelectedFoxId] = useState<string>("fox_001");
  const formulaDialogRef = useRef<HTMLDialogElement>(null);
  const reportHeadingRef = useRef<HTMLHeadingElement>(null);
  const worklogHeadingRef = useRef<HTMLHeadingElement>(null);
  const observationsRef = useRef<HTMLElement>(null);
  const pendingObservationsTopRef = useRef<number | null>(null);
  const previousViewRef = useRef<View>(view);

  const report = useMemo(
    () => calculateFoxReport(observations, parameters),
    [observations, parameters],
  );
  const selectedFox =
    report.rankings.find((fox) => fox.foxId === selectedFoxId) ?? report.rankings[0] ?? null;
  const maxScore = Math.max(...report.rankings.map((fox) => fox.score), 1);
  const maxLocationCount = Math.max(...report.locations.map((location) => location.count), 1);

  const focusViewStart = useCallback((nextView: View) => {
    window.requestAnimationFrame(() => {
      const heading = nextView === "overview"
        ? reportHeadingRef.current
        : worklogHeadingRef.current;
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      heading?.focus({ preventScroll: true });
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    });
  }, []);

  useEffect(() => {
    if (previousViewRef.current === view) return;
    previousViewRef.current = view;
    focusViewStart(view);
  }, [focusViewStart, view]);

  useLayoutEffect(() => {
    const previousTop = pendingObservationsTopRef.current;
    if (previousTop === null) return;

    pendingObservationsTopRef.current = null;
    const nextTop = observationsRef.current?.getBoundingClientRect().top;
    if (nextTop === undefined) return;

    const offset = nextTop - previousTop;
    if (Math.abs(offset) > 0.5) {
      window.scrollBy({ top: offset, left: 0, behavior: "auto" });
    }
  }, [observations]);

  const navigateTo = (nextView: View) => {
    if (nextView === view) {
      focusViewStart(nextView);
      return;
    }
    setView(nextView);
  };

  const updateObservation = (id: string, patch: Partial<Observation>) => {
    setObservations((current) =>
      current.map((observation) =>
        observation.id === id ? { ...observation, ...patch } : observation,
      ),
    );
  };

  const addObservation = () => {
    const sequence = observations.length + 1;
    const usedFoxIds = new Set(observations.map((observation) => observation.fox_id));
    const highestFoxSequence = observations.reduce((highest, observation) => {
      const match = /^fox_(\d+)$/.exec(observation.fox_id);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    let nextFoxSequence = highestFoxSequence + 1;
    let nextFoxId = `fox_${String(nextFoxSequence).padStart(3, "0")}`;
    while (usedFoxIds.has(nextFoxId)) {
      nextFoxSequence += 1;
      nextFoxId = `fox_${String(nextFoxSequence).padStart(3, "0")}`;
    }
    const next: Observation = {
      id: `obs_${String(sequence).padStart(3, "0")}_${Date.now().toString().slice(-3)}`,
      fox_id: nextFoxId,
      location: "Новая точка",
      color: "рыжая",
      has_prey: false,
      suspicion_level: 5,
      time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    };
    setObservations((current) => [...current, next]);
    setSelectedFoxId(next.fox_id);
  };

  const addObservationFromJournal = () => {
    pendingObservationsTopRef.current =
      observationsRef.current?.getBoundingClientRect().top ?? null;
    addObservation();
  };

  const resetAll = () => {
    if (observations !== INITIAL_OBSERVATIONS) {
      pendingObservationsTopRef.current =
        observationsRef.current?.getBoundingClientRect().top ?? null;
    }
    setObservations(INITIAL_OBSERVATIONS);
    setParameters(DEFAULT_PARAMETERS);
    setSelectedFoxId("fox_001");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigateTo("overview")}>
          <FoxMark compact />
          <span>
            <strong>Лисий диспетчер</strong>
            <small>MOX · наблюдательная станция</small>
          </span>
        </button>
        <nav aria-label="Разделы">
          <button
            type="button"
            className={view === "overview" ? "active" : ""}
            onClick={() => navigateTo("overview")}
          >
            Отчёт
          </button>
          <button
            type="button"
            className={view === "worklog" ? "active" : ""}
            onClick={() => navigateTo("worklog")}
          >
            AI Worklog <span>7</span>
          </button>
        </nav>
        <div className="live-status">
          <span />
          Пересчёт в реальном времени
        </div>
      </header>

      {view === "overview" ? (
        <main className="workspace">
          <section className="report-column" aria-labelledby="report-title">
            <div className="section-heading section-heading--intro">
              <div>
                <p className="eyebrow">Сводка наблюдений</p>
                <h1
                  className="view-heading"
                  id="report-title"
                  ref={reportHeadingRef}
                  tabIndex={-1}
                >
                  Радар подозрений
                </h1>
              </div>
              <div className="report-meta">
                <span>{report.totalObservationCount} событий</span>
                <span>{foxCountLabel(report.uniqueFoxCount)}</span>
                <span>сегодня</span>
              </div>
            </div>

            {report.rankings.length > 0 && report.leader ? (
              <div className="leader-plane" key={report.leader.foxId}>
                <div className="leader-plane__graphic" aria-hidden="true">
                  <span className="orbit orbit--one" />
                  <span className="orbit orbit--two" />
                  <FoxMark />
                  <span className="signal-dot signal-dot--one" />
                  <span className="signal-dot signal-dot--two" />
                  <span className="signal-dot signal-dot--three" />
                </div>
                <div className="leader-plane__copy">
                  <p className="eyebrow eyebrow--light">Требует внимания</p>
                  <h2>{report.leader.foxId}</h2>
                  <p className="leader-summary">
                    Самый высокий итоговый балл: <strong>{formatScore(report.leader.score)}</strong>.
                    Лидер определяется по четырём наблюдаемым сигналам.
                  </p>
                  <ul>
                    {report.leader.reasons.slice(0, 3).map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => formulaDialogRef.current?.showModal()}>
                    Как считается балл <span>↗</span>
                  </button>
                </div>
                <div className="leader-plane__score" aria-label={`Итоговый балл ${report.leader.score}`}>
                  <small>балл модели</small>
                  <strong>{formatScore(report.leader.score)}</strong>
                  <span>при текущих весах</span>
                </div>
              </div>
            ) : report.leaders.length > 1 ? (
              <div
                className="leader-plane leader-plane--tie"
                key={`tie-${report.leaders.map((fox) => fox.foxId).join("-")}`}
              >
                <div className="leader-plane__graphic" aria-hidden="true">
                  <span className="orbit orbit--one" />
                  <span className="orbit orbit--two" />
                  <FoxMark />
                  <span className="signal-dot signal-dot--one" />
                  <span className="signal-dot signal-dot--two" />
                  <span className="signal-dot signal-dot--three" />
                </div>
                <div className="leader-plane__copy">
                  <p className="eyebrow eyebrow--light">Равный результат</p>
                  <h2>Ничья в рейтинге</h2>
                  <p className="leader-summary">
                    {foxCountLabel(report.leaders.length)} делят первое место с баллом{
                      " "
                    }<strong>{formatScore(report.leaders[0].score)}</strong>.
                    При текущих весах единственного лидера нет.
                  </p>
                  <ul>
                    {report.leaders.map((fox) => (
                      <li key={fox.foxId}>{fox.foxId}</li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => formulaDialogRef.current?.showModal()}>
                    Как считается балл <span>↗</span>
                  </button>
                </div>
                <div
                  className="leader-plane__score"
                  aria-label={`Общий балл лидеров ${report.leaders[0].score}`}
                >
                  <small>общий балл</small>
                  <strong>{formatScore(report.leaders[0].score)}</strong>
                  <span>ничья</span>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <FoxMark />
                <h2>Радар пока пуст</h2>
                <p>Добавьте первое наблюдение, чтобы построить рейтинг.</p>
                <button type="button" onClick={addObservation}>+ Добавить наблюдение</button>
              </div>
            )}

            <section className="ranking-section" aria-labelledby="ranking-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Все обнаруженные лисы</p>
                  <h2 id="ranking-title">Рейтинг</h2>
                </div>
                <span className="section-note">Нажмите на строку, чтобы разобрать балл</span>
              </div>
              <div className="ranking-list">
                {report.rankings.map((fox, index) => (
                  <RankingRow
                    key={fox.foxId}
                    fox={fox}
                    index={index}
                    maxScore={maxScore}
                    selected={selectedFox?.foxId === fox.foxId}
                    onSelect={() => setSelectedFoxId(fox.foxId)}
                  />
                ))}
              </div>
              {selectedFox && (
                <div className="score-breakdown" key={`${selectedFox.foxId}-${selectedFox.score}`}>
                  <div>
                    <p className="eyebrow">Разбор балла</p>
                    <h3>{selectedFox.foxId}</h3>
                    <span>{selectedFox.observationCount} наблюд. · последний сигнал в {selectedFox.latestTime}</span>
                  </div>
                  <ol>
                    {selectedFox.scoreParts.map((part) => (
                      <li key={part.label}>
                        <span>{part.label}</span>
                        <strong>+{formatScore(part.value)}</strong>
                      </li>
                    ))}
                  </ol>
                  <div className="score-breakdown__total">
                    <span>Итого</span>
                    <strong>{formatScore(selectedFox.score)}</strong>
                  </div>
                </div>
              )}
            </section>

            <section className="locations" aria-labelledby="locations-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Карта активности</p>
                  <h2 id="locations-title">Основные локации</h2>
                </div>
              </div>
              <div className="location-bars">
                {report.locations.map((item) => (
                  <div className="location-bar" key={item.location}>
                    <span>{item.location}</span>
                    <div aria-hidden="true">
                      <i style={{ width: `${(item.count / maxLocationCount) * 100}%` }} />
                    </div>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <aside className="inspector" aria-labelledby="parameters-title">
            <div className="inspector__sticky">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Модель оценки</p>
                  <h2 id="parameters-title">Вес сигналов</h2>
                </div>
                <button className="text-button" type="button" onClick={() => setParameters(DEFAULT_PARAMETERS)}>
                  Сбросить
                </button>
              </div>
              <p className="inspector__hint">Двигайте ползунки и смотрите, как меняется лидер рейтинга.</p>
              <div className="parameters">
                {PARAMETER_META.map((meta) => (
                  <ParameterControl
                    key={meta.key}
                    meta={meta}
                    value={parameters[meta.key]}
                    onChange={(value) =>
                      setParameters((current) => ({ ...current, [meta.key]: value }))
                    }
                  />
                ))}
              </div>
              <div className="signal-summary">
                <span>
                  <small>Средний уровень</small>
                  <strong>{report.averageSuspicion}</strong>
                </span>
                <span>
                  <small>С добычей</small>
                  <strong>{report.preyObservationCount}</strong>
                </span>
              </div>
              <button className="secondary-button" type="button" onClick={() => formulaDialogRef.current?.showModal()}>
                Открыть формулу
              </button>
            </div>
          </aside>

          <section
            className="observations"
            aria-labelledby="observations-title"
            ref={observationsRef}
          >
            <div className="section-heading observations__heading">
              <div>
                <p className="eyebrow">Исходные данные</p>
                <h2 id="observations-title">Журнал наблюдений</h2>
              </div>
              <div className="observation-actions">
                <button type="button" className="text-button" onClick={resetAll}>Вернуть исходные</button>
                <button type="button" className="primary-button" onClick={addObservationFromJournal}>+ Добавить запись</button>
              </div>
            </div>
            <p className="observations__hint">Все поля редактируются. Отчёт выше обновляется без перезагрузки.</p>
            <div className="observation-table">
              <div className="observation-header" aria-hidden="true">
                <span>Лиса</span>
                <span>Локация</span>
                <span>Окрас</span>
                <span>Подозр.</span>
                <span>Добыча</span>
                <span>Время</span>
                <span />
              </div>
              {observations.map((observation) => (
                <ObservationEditor
                  key={observation.id}
                  observation={observation}
                  onChange={(patch) => updateObservation(observation.id, patch)}
                  onRemove={() =>
                    setObservations((current) => current.filter((item) => item.id !== observation.id))
                  }
                />
              ))}
              {observations.length === 0 && (
                <div className="table-empty">В журнале нет наблюдений.</div>
              )}
            </div>
          </section>
        </main>
      ) : (
        <WorklogView headingRef={worklogHeadingRef} />
      )}

      <footer>
        <span>MOX AI-first Developer · тестовое задание</span>
        <button type="button" onClick={() => navigateTo("worklog")}>Открыть AI Worklog ↗</button>
      </footer>

      <FormulaDialog dialogRef={formulaDialogRef} parameters={parameters} />
    </div>
  );
}
