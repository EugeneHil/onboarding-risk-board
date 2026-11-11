import { daysBetween } from './dates';
import type { Employee, ISODate, RiskLevel, RiskReason, RiskResult, RuleCode } from './types';

export const RISK_WINDOW_DAYS = 90;

/** Every number the risk rules use lives here. They are hypotheses, not fitted to real data. */
export const RULES = {
  overdue: { perTask: 10, cap: 30 },
  noMentorMeeting: { afterDay: 7, points: 25 },
  noTwoWeekCheckin: { afterDay: 16, points: 20 },
  stalled: { idleDays: 14, points: 15 },
  thresholds: { high: 50, medium: 25 },
};

export const ACTIONS: Record<RuleCode, string> = {
  overdue_tasks: 'Разобрать просроченные задачи адаптации и назначить новые сроки',
  no_mentor_meeting: 'Организовать встречу новичка с наставником на этой неделе',
  no_two_week_checkin: 'Провести разговор руководителя с новичком: как проходит адаптация',
  stalled: 'Позвонить новичку: по задачам адаптации давно нет движения',
};

/** The rule behind a reason in plain words, built from the same numbers the scoring uses. */
export function explainRule(code: RuleCode, rules = RULES): string {
  switch (code) {
    case 'overdue_tasks':
      return `Открытая задача адаптации, у которой срок уже прошёл: ${rules.overdue.perTask} баллов за каждую, не больше ${rules.overdue.cap}.`;
    case 'no_mentor_meeting':
      return `После ${rules.noMentorMeeting.afterDay}-го дня работы встреча с наставником не отмечена выполненной: ${rules.noMentorMeeting.points} баллов.`;
    case 'no_two_week_checkin':
      return `После ${rules.noTwoWeekCheckin.afterDay}-го дня не выполнен разговор руководителя со сроком до 14-го дня: ${rules.noTwoWeekCheckin.points} баллов.`;
    case 'stalled':
      return `Есть просроченные задачи, а за последние ${rules.stalled.idleDays} дн. не выполнено ни одной: ${rules.stalled.points} баллов.`;
  }
}

const NO_ACTION = 'Действий не требуется: адаптация идёт по плану';

export function levelFor(score: number): RiskLevel {
  if (score >= RULES.thresholds.high) return 'high';
  if (score >= RULES.thresholds.medium) return 'medium';
  return 'low';
}

export function evaluateRisk(employee: Employee, asOf: ISODate, rules = RULES): RiskResult {
  const tenureDay = daysBetween(employee.hireDate, asOf);
  const tasks = employee.tasks;
  const reasons: RiskReason[] = [];

  const overdue = tasks.filter((t) => t.status === 'open' && tenureDay > t.dueDay);
  if (overdue.length > 0) {
    reasons.push({
      code: 'overdue_tasks',
      text: `Просрочено задач: ${overdue.length}`,
      points: Math.min(overdue.length * rules.overdue.perTask, rules.overdue.cap),
    });
  }

  const mentorDone = tasks.some((t) => t.kind === 'mentor_meeting' && t.status === 'done');
  if (tenureDay > rules.noMentorMeeting.afterDay && !mentorDone) {
    reasons.push({
      code: 'no_mentor_meeting',
      text: `Нет встречи с наставником (день ${tenureDay})`,
      points: rules.noMentorMeeting.points,
    });
  }

  const checkinDone = tasks.some(
    (t) => t.kind === 'checkin' && t.dueDay <= 14 && t.status === 'done',
  );
  if (tenureDay > rules.noTwoWeekCheckin.afterDay && !checkinDone) {
    reasons.push({
      code: 'no_two_week_checkin',
      text: 'Нет разговора с руководителем на второй неделе',
      points: rules.noTwoWeekCheckin.points,
    });
  }

  if (overdue.length > 0) {
    const completions = tasks
      .filter((t) => t.status === 'done' && t.completedOn)
      .map((t) => t.completedOn as ISODate)
      .sort();
    const last = completions[completions.length - 1];
    const idle = daysBetween(last ?? employee.hireDate, asOf);
    if (idle > rules.stalled.idleDays) {
      reasons.push({
        code: 'stalled',
        text:
          last === undefined
            ? 'Ни одной выполненной задачи адаптации'
            : `Нет выполненных задач уже ${idle} дн.`,
        points: rules.stalled.points,
      });
    }
  }

  reasons.sort((a, b) => b.points - a.points);
  const score = reasons.reduce((sum, r) => sum + r.points, 0);
  const top = reasons[0];
  return {
    score,
    level: levelFor(score),
    reasons,
    nextAction: top ? ACTIONS[top.code] : NO_ACTION,
    tenureDay,
  };
}
