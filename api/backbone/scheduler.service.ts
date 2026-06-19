import { workflowService, WorkflowService } from './workflow.service';
import { backboneStore, BackboneStore } from './store';
import { AgentMessage } from './types';
import { newId, nowIso } from './utils';

export class SchedulerService {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly workflow: WorkflowService = workflowService,
    private readonly store: BackboneStore = backboneStore
  ) {}

  start(): void {
    const state = this.store.getSchedulerState();
    if (!state.enabled || this.timer) return;

    this.timer = setInterval(() => {
      const now = new Date();
      const time = now.toTimeString().slice(0, 5);
      const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const currentState = this.store.getSchedulerState();

      if (time === currentState.dailyCheckinTime) {
        this.runDaily('project-alpha');
      }
      if (time === currentState.weeklyReportTime && day === currentState.weeklyReportDay.toLowerCase()) {
        this.runWeekly('project-alpha');
      }
    }, 60_000);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  setEnabled(enabled: boolean): void {
    this.store.updateSchedulerState({ enabled });
    if (enabled) this.start();
    else this.stop();
  }

  runDaily(projectId: string): { projectId: string; correlationId: string; status: string } {
    const result = this.workflow.startDailyCheckin(projectId);
    this.store.updateSchedulerState({
      lastDailyRunAt: nowIso(),
      lastRunSummary: `Daily check-in started for ${projectId}`,
    });
    this.workflow.ingestMessage(this.schedulerMessage(projectId, result.correlationId, 'Daily check-in scheduled'));
    return { projectId, correlationId: result.correlationId, status: 'daily_checkin_started' };
  }

  runWeekly(projectId: string): { projectId: string; reportId: string; status: string } {
    const report = this.workflow.generateWeeklyReport(projectId);
    this.store.updateSchedulerState({
      lastWeeklyRunAt: nowIso(),
      lastRunSummary: `Weekly report generated for ${projectId}`,
    });
    this.workflow.ingestMessage(this.schedulerMessage(projectId, `corr-${report.reportId}`, 'Weekly report scheduled'));
    return { projectId, reportId: report.reportId, status: 'weekly_report_generated' };
  }

  private schedulerMessage(projectId: string, correlationId: string, summary: string): AgentMessage {
    return {
      messageId: newId('msg'),
      correlationId,
      type: 'SCHEDULER_RUN_COMPLETED',
      sourceAgent: 'orchestrator',
      targetAgents: ['reporter'],
      projectId,
      payload: { summary },
      timestamp: nowIso(),
    };
  }
}

export const schedulerService = new SchedulerService();
