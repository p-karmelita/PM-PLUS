import { BackboneStore } from './store';
import { AgentMessage, DailyUpdate, SubmitUpdateRequest } from './types';
import {
  assertWorkload,
  newId,
  normalizeBlockers,
  normalizeNeedsHelp,
  nowIso,
} from './utils';

export interface CollectorResult {
  update: DailyUpdate;
  collectedMessage: AgentMessage<{
    updateId: string;
    employeeId: string;
    employeeName: string;
    blockers: string[];
    workload: string;
    needsHelp: boolean;
    signals: {
      hasBlocker: boolean;
      isHeavyWorkload: boolean;
      needsHelp: boolean;
    };
  }>;
}

export class CollectorAgent {
  constructor(private readonly store: BackboneStore) {}

  collect(payload: SubmitUpdateRequest, correlationId: string): CollectorResult {
    if (!payload.projectId || !payload.employeeId || !payload.employeeName) {
      throw new Error('projectId, employeeId and employeeName are required');
    }

    assertWorkload(payload.workload);
    const blockers = normalizeBlockers(payload.blockers);
    const needsHelp = normalizeNeedsHelp(payload.needsHelp);
    const submittedAt = payload.submittedAt || nowIso();
    const updateId = newId('upd');

    const update: DailyUpdate = {
      updateId,
      projectId: payload.projectId,
      correlationId,
      employeeId: payload.employeeId,
      employeeName: payload.employeeName,
      taskId: payload.taskId,
      taskTitle: payload.taskTitle,
      status: payload.status,
      yesterday: payload.yesterday,
      today: payload.today,
      blockers,
      workload: payload.workload,
      needsHelp,
      dueDate: payload.dueDate,
      submittedAt,
      createdAt: nowIso(),
    };

    this.store.saveUpdate(update);
    this.store.updateEmployeeWorkload(update.projectId, update.employeeId, update.workload);

    const collectedMessage: AgentMessage<CollectorResult['collectedMessage']['payload']> = {
      messageId: newId('msg'),
      correlationId,
      type: 'DAILY_UPDATE_COLLECTED',
      sourceAgent: 'collector',
      targetAgents: ['risk_analyzer', 'resource_balancer', 'reporter'],
      projectId: update.projectId,
      payload: {
        updateId: update.updateId,
        employeeId: update.employeeId,
        employeeName: update.employeeName,
        blockers: update.blockers,
        workload: update.workload,
        needsHelp: update.needsHelp,
        signals: {
          hasBlocker: update.blockers.length > 0,
          isHeavyWorkload: update.workload === 'heavy',
          needsHelp: update.needsHelp,
        },
      },
      timestamp: nowIso(),
    };

    return { update, collectedMessage };
  }
}
