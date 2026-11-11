/** Calendar date as 'YYYY-MM-DD', always handled in UTC. */
export type ISODate = string;

export type Department = 'warehouse' | 'store' | 'sales' | 'office';

export type TaskKind =
  | 'docs'
  | 'safety'
  | 'mentor_meeting'
  | 'training'
  | 'checkin'
  | 'feedback';

export interface OnboardingTask {
  id: string;
  kind: TaskKind;
  title: string;
  /** Tenure day on which the task is due (hire date is day 0). */
  dueDay: number;
  status: 'done' | 'open';
  completedOn?: ISODate;
  responsible: 'hr' | 'manager' | 'mentor';
}

export interface Employee {
  id: string;
  fullName: string;
  position: string;
  department: Department;
  location: string;
  hireDate: ISODate;
  managerName: string;
  mentorName?: string;
  status: 'active' | 'left';
  leaveDate?: ISODate;
  leaveReason?: string;
  tasks: OnboardingTask[];
}

export type RiskLevel = 'high' | 'medium' | 'low';

export type RuleCode =
  | 'overdue_tasks'
  | 'no_mentor_meeting'
  | 'no_two_week_checkin'
  | 'stalled';

export interface RiskReason {
  code: RuleCode;
  text: string;
  points: number;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  reasons: RiskReason[];
  nextAction: string;
  tenureDay: number;
}

export interface BoardRow {
  employee: Employee;
  risk: RiskResult;
}
