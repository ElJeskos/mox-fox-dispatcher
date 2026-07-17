import type { RefObject } from "react";
import type { ScoringParameters } from "./types";

export function FormulaDialog({
  dialogRef,
  parameters,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  parameters: ScoringParameters;
}) {
  return (
    <dialog className="formula-dialog" ref={dialogRef}>
      <button
        className="dialog-close"
        type="button"
        aria-label="Закрыть формулу"
        onClick={() => dialogRef.current?.close()}
      >
        ×
      </button>
      <p className="eyebrow">Прозрачная логика</p>
      <h2>Как считается балл подозрения</h2>
      <p>Для каждой лисы данные группируются по идентификатору. Итог складывается из четырёх частей.</p>
      <div className="formula-line">
        <span>Средняя подозрительность</span>
        <i>×</i>
        <strong>{parameters.suspicionWeight}</strong>
      </div>
      <div className="formula-line">
        <span>Наблюдения с добычей</span>
        <i>×</i>
        <strong>{parameters.preyWeight}</strong>
      </div>
      <div className="formula-line">
        <span>Повторные наблюдения</span>
        <i>×</i>
        <strong>{parameters.repeatWeight}</strong>
      </div>
      <div className="formula-line">
        <span>Повторы в главной локации</span>
        <i>×</i>
        <strong>{parameters.sameLocationWeight}</strong>
      </div>
      <p className="formula-dialog__note">Первое наблюдение и первое появление в локации не получают бонус за повтор.</p>
    </dialog>
  );
}
