import type { OnboardingTask } from '../domain/types';

export type TaskState = 'done' | 'overdue' | 'upcoming';

export const STATE_LABEL: Record<TaskState, string> = {
  done: 'Выполнено',
  overdue: 'Просрочено',
  upcoming: 'Впереди',
};

const STATE_MARK: Record<TaskState, string> = { done: '●', overdue: '▲', upcoming: '○' };

/** A task is overdue only while it is open and its due day has passed. */
export function taskState(task: OnboardingTask, tenureDay: number): TaskState {
  if (task.status === 'done') return 'done';
  return tenureDay > task.dueDay ? 'overdue' : 'upcoming';
}

interface TimelineProps {
  tasks: OnboardingTask[];
  tenureDay: number;
}

/** 0..90 day axis; state is shown by marker shape and text, not by colour alone. */
export function Timeline({ tasks, tenureDay }: TimelineProps) {
  const pct = (day: number) => `${Math.min(100, Math.max(0, (day / 90) * 100))}%`;
  return (
    <div className="timeline">
      <div className="timeline-axis" aria-hidden="true">
        <span className="timeline-today" style={{ left: pct(tenureDay) }}>
          сегодня
        </span>
      </div>
      <ul className="timeline-track">
        {tasks.map((task) => {
          const state = taskState(task, tenureDay);
          return (
            <li
              key={task.id}
              className={`marker marker-${state}`}
              style={{ left: pct(task.dueDay) }}
            >
              <span aria-hidden="true">{STATE_MARK[state]}</span>
              <span className="sr-only">
                {`${task.title}, день ${task.dueDay}: ${STATE_LABEL[state]}`}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="timeline-scale" aria-hidden="true">
        <span>0</span>
        <span>30</span>
        <span>60</span>
        <span>90 дн.</span>
      </div>
    </div>
  );
}
