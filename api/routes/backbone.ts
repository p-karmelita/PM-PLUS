import { Router, Request, Response } from 'express';
import { workflowService } from '../backbone/workflow.service';
import { backboneStore } from '../backbone/store';
import { schedulerService } from '../backbone/scheduler.service';
import { notificationService, NotificationChannel } from '../backbone/notification.service';
import { AgentMessage, SubmitUpdateRequest } from '../backbone/types';
import { nowIso, resolveCorrelationId, newId } from '../backbone/utils';

const router = Router();

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function weeklyReportCsv(projectId: string): string {
  const report = backboneStore.getWeeklyReport(projectId) || workflowService.generateWeeklyReport(projectId);
  const rows = [
    ['section', 'value'],
    ...report.progress.map((item) => ['progress', item]),
    ...report.blockers.map((item) => ['blocker', item]),
    ...report.risks.map((item) => ['risk', item]),
    ...report.workload.map((item) => ['workload', item]),
    ...report.decisions.map((item) => ['decision', item]),
    ...report.nextSteps.map((item) => ['next_step', item]),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function escapePdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, '-')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function simplePdf(title: string, body: string): Buffer {
  const lines = [title, '', ...body.split('\n')]
    .flatMap((line) => (line.length > 96 ? line.match(/.{1,96}/g) || [line] : [line]))
    .slice(0, 80);
  const textCommands = lines
    .map((line, index) => `BT /F1 10 Tf 40 ${780 - index * 13} Td (${escapePdfText(line)}) Tj ET`)
    .join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(textCommands)} >> stream\n${textCommands}\nendstream endobj`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

router.post('/demo/seed-team', (req: Request, res: Response) => {
  try {
    const projectId = (req.body?.projectId as string) || 'project-alpha';
    const result = workflowService.seedTeam(projectId);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error in /demo/seed-team:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/demo/start-daily-checkin', (req: Request, res: Response) => {
  try {
    const projectId = (req.body?.projectId as string) || 'project-alpha';
    const result = workflowService.startDailyCheckin(projectId);
    res.status(200).json({
      correlationId: result.correlationId,
      projectId: result.projectId,
      status: 'started',
      questions: result.questions,
    });
  } catch (error) {
    console.error('Error in /demo/start-daily-checkin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/demo/run-full-scenario', (req: Request, res: Response) => {
  try {
    const projectId = (req.body?.projectId as string) || 'project-alpha';
    const result = workflowService.runFullScenario(projectId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in /demo/run-full-scenario:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/updates', (req: Request, res: Response) => {
  try {
    const payload = req.body as SubmitUpdateRequest;
    const result = workflowService.submitUpdate(payload);
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    if (message.includes('not found') || message.includes('Unknown employee')) {
      return res.status(404).json({ error: message });
    }
    if (message.includes('required') || message.includes('must be')) {
      return res.status(400).json({ error: message });
    }
    console.error('Error in POST /updates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/updates/:projectId', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const updates = backboneStore.listUpdates(projectId);
    res.status(200).json({ projectId, count: updates.length, updates });
  } catch (error) {
    console.error('Error in GET /updates/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/agent-messages', (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<AgentMessage>;
    if (!body.projectId || !body.type || !body.sourceAgent || !Array.isArray(body.targetAgents)) {
      return res
        .status(400)
        .json({ error: 'projectId, type, sourceAgent and targetAgents are required' });
    }

    const message: AgentMessage = {
      messageId: body.messageId || newId('msg'),
      correlationId: resolveCorrelationId(body.correlationId),
      type: body.type,
      sourceAgent: body.sourceAgent,
      targetAgents: body.targetAgents,
      projectId: body.projectId,
      payload: body.payload || {},
      timestamp: body.timestamp || nowIso(),
      requiresDecision: body.requiresDecision,
      decisionId: body.decisionId,
    };

    workflowService.ingestMessage(message);
    res.status(201).json(message);
  } catch (error) {
    console.error('Error in POST /agent-messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/agent-messages/:projectId', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const messages = backboneStore.listMessages(projectId);
    res.status(200).json({ projectId, count: messages.length, messages });
  } catch (error) {
    console.error('Error in GET /agent-messages/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/decisions/pending/:projectId', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const decisions = backboneStore.listPendingDecisionRequests(projectId);
    res.status(200).json({ projectId, count: decisions.length, decisions });
  } catch (error) {
    console.error('Error in GET /decisions/pending/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/decisions/:projectId', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const decisions = backboneStore.listDecisionRequests(projectId);
    res.status(200).json({ projectId, count: decisions.length, decisions });
  } catch (error) {
    console.error('Error in GET /decisions/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/decisions', (req: Request, res: Response) => {
  try {
    const { projectId, decisionId, decision, decidedBy, comment } = req.body as {
      projectId?: string;
      decisionId?: string;
      decision?: 'approve' | 'reject';
      decidedBy?: string;
      comment?: string;
    };

    if (!projectId || !decisionId || !decision || !decidedBy) {
      return res
        .status(400)
        .json({ error: 'projectId, decisionId, decision and decidedBy are required' });
    }

    const result = workflowService.recordDecision({
      projectId,
      decisionId,
      decision,
      decidedBy,
      comment,
    });

    res.status(200).json({
      projectId,
      decisionId,
      status: result.status,
      eventsCreated: result.messages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    if (message.includes('already')) {
      return res.status(409).json({ error: message });
    }
    console.error('Error in POST /decisions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/decisions/:projectId/:decisionId/apply', (req: Request, res: Response) => {
  try {
    const { projectId, decisionId } = req.params;
    const { appliedBy, note } = req.body as { appliedBy?: string; note?: string };
    if (!appliedBy) {
      return res.status(400).json({ error: 'appliedBy is required' });
    }
    const result = workflowService.applyDecision({ projectId, decisionId, appliedBy, note });
    res.status(200).json({ projectId, decisionId, status: result.status, eventsCreated: result.messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    if (message.includes('not found')) return res.status(404).json({ error: message });
    if (message.includes('must be')) return res.status(409).json({ error: message });
    console.error('Error in POST /decisions/:projectId/:decisionId/apply:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/decisions/:projectId/:decisionId/skip', (req: Request, res: Response) => {
  try {
    const { projectId, decisionId } = req.params;
    const { skippedBy, note } = req.body as { skippedBy?: string; note?: string };
    if (!skippedBy) {
      return res.status(400).json({ error: 'skippedBy is required' });
    }
    const result = workflowService.skipDecision({ projectId, decisionId, skippedBy, note });
    res.status(200).json({ projectId, decisionId, status: result.status, eventsCreated: result.messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    if (message.includes('not found')) return res.status(404).json({ error: message });
    if (message.includes('must be')) return res.status(409).json({ error: message });
    console.error('Error in POST /decisions/:projectId/:decisionId/skip:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/decisions/:projectId/:decisionId/audit', (req: Request, res: Response) => {
  try {
    const { projectId, decisionId } = req.params;
    const { auditedBy, note } = req.body as { auditedBy?: string; note?: string };
    if (!auditedBy) {
      return res.status(400).json({ error: 'auditedBy is required' });
    }
    const result = workflowService.auditDecision({ projectId, decisionId, auditedBy, note });
    res.status(200).json({ projectId, decisionId, status: result.status, eventsCreated: result.messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    if (message.includes('not found')) return res.status(404).json({ error: message });
    if (message.includes('must be')) return res.status(409).json({ error: message });
    console.error('Error in POST /decisions/:projectId/:decisionId/audit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/pm-chat/messages', (req: Request, res: Response) => {
  try {
    const { projectId, threadId, targetAgent, message, intent } = req.body as {
      projectId?: string;
      threadId?: string;
      targetAgent?: any;
      message?: string;
      intent?: any;
    };
    if (!projectId || !message) {
      return res.status(400).json({ error: 'projectId and message are required' });
    }
    const result = workflowService.sendPMChatMessage({
      projectId,
      threadId,
      targetAgent,
      message,
      intent,
    });
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    if (message.includes('required')) return res.status(400).json({ error: message });
    console.error('Error in POST /pm-chat/messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/pm-chat/:projectId', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const threadId = req.query.threadId as string | undefined;
    res.status(200).json({
      projectId,
      threads: backboneStore.listPMChatThreads(projectId),
      messages: backboneStore.listPMChatMessages(projectId, threadId),
    });
  } catch (error) {
    console.error('Error in GET /pm-chat/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/pm-chat/:projectId/:threadId/confirm', (req: Request, res: Response) => {
  try {
    const { projectId, threadId } = req.params;
    const result = workflowService.confirmPMChatDraft(projectId, threadId);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    if (message.includes('not found') || message.includes('No decision')) {
      return res.status(404).json({ error: message });
    }
    if (message.includes('already')) return res.status(409).json({ error: message });
    console.error('Error in POST /pm-chat/:projectId/:threadId/confirm:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/risks/:projectId', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const risks = backboneStore.listRisks(projectId);
    res.status(200).json({ projectId, count: risks.length, risks });
  } catch (error) {
    console.error('Error in GET /risks/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/resource-recommendations/:projectId', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const recommendations = backboneStore.listRecommendations(projectId);
    res.status(200).json({ projectId, count: recommendations.length, recommendations });
  } catch (error) {
    console.error('Error in GET /resource-recommendations/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reports/weekly', (req: Request, res: Response) => {
  try {
    const projectId = (req.body?.projectId as string) || 'project-alpha';
    const report = workflowService.generateWeeklyReport(projectId);
    res.status(201).json(report);
  } catch (error) {
    console.error('Error in POST /reports/weekly:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reports/weekly/:projectId', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const report = backboneStore.getWeeklyReport(projectId);
    if (!report) {
      return res.status(404).json({ error: 'Weekly report not found' });
    }
    res.status(200).json(report);
  } catch (error) {
    console.error('Error in GET /reports/weekly/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/state/:projectId', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const snapshot = workflowService.getState(projectId);
    res.status(200).json(snapshot);
  } catch (error) {
    console.error('Error in GET /state/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/analytics/:projectId', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    res.status(200).json(workflowService.getAnalytics(projectId));
  } catch (error) {
    console.error('Error in GET /analytics/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/exports/weekly/:projectId.csv', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${projectId}-weekly-report.csv"`);
    res.status(200).send(weeklyReportCsv(projectId));
  } catch (error) {
    console.error('Error in GET /exports/weekly/:projectId.csv:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/exports/weekly/:projectId.pdf', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const report = backboneStore.getWeeklyReport(projectId) || workflowService.generateWeeklyReport(projectId);
    const pdf = simplePdf(`PM PLUS Weekly Report - ${projectId}`, report.markdown);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${projectId}-weekly-report.pdf"`);
    res.status(200).send(pdf);
  } catch (error) {
    console.error('Error in GET /exports/weekly/:projectId.pdf:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/integrations/status', (_req: Request, res: Response) => {
  res.status(200).json(notificationService.status());
});

router.post('/integrations/notify', async (req: Request, res: Response) => {
  try {
    const { title, message, projectId, channels } = req.body as {
      title?: string;
      message?: string;
      projectId?: string;
      channels?: Array<NotificationChannel | 'all'>;
    };
    if (!title || !message) {
      return res.status(400).json({ error: 'title and message are required' });
    }
    const results = await notificationService.notify(
      { title, message, projectId },
      Array.isArray(channels) && channels.length ? channels : ['all']
    );
    res.status(200).json({ results });
  } catch (error) {
    console.error('Error in POST /integrations/notify:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/scheduler/status', (_req: Request, res: Response) => {
  res.status(200).json(backboneStore.getSchedulerState());
});

router.post('/scheduler/enabled', (req: Request, res: Response) => {
  const { enabled } = req.body as { enabled?: boolean };
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled boolean is required' });
  }
  schedulerService.setEnabled(enabled);
  res.status(200).json(backboneStore.getSchedulerState());
});

router.post('/scheduler/run-daily', (req: Request, res: Response) => {
  try {
    const projectId = (req.body?.projectId as string) || 'project-alpha';
    res.status(200).json(schedulerService.runDaily(projectId));
  } catch (error) {
    console.error('Error in POST /scheduler/run-daily:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/scheduler/run-weekly', (req: Request, res: Response) => {
  try {
    const projectId = (req.body?.projectId as string) || 'project-alpha';
    res.status(200).json(schedulerService.runWeekly(projectId));
  } catch (error) {
    console.error('Error in POST /scheduler/run-weekly:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
