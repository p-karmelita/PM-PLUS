import http from 'http';
import https from 'https';
import { URL } from 'url';
import { AgentMessage } from './types';

export type NotificationChannel = 'slack' | 'teams';

export interface NotificationResult {
  channel: NotificationChannel;
  configured: boolean;
  delivered: boolean;
  statusCode?: number;
  error?: string;
}

export interface NotifyInput {
  title: string;
  message: string;
  projectId?: string;
  severity?: string;
}

function postJson(url: string, body: unknown): Promise<{ statusCode: number }> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const data = JSON.stringify(body);
    const client = target.protocol === 'https:' ? https : http;
    const req = client.request(
      target,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ statusCode: res.statusCode || 0 }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

export class NotificationService {
  status(): Record<NotificationChannel, boolean> {
    return {
      slack: Boolean(process.env.SLACK_WEBHOOK_URL),
      teams: Boolean(process.env.MS_TEAMS_WEBHOOK_URL || process.env.TEAMS_WEBHOOK_URL),
    };
  }

  async notify(input: NotifyInput, channels: Array<NotificationChannel | 'all'> = ['all']): Promise<NotificationResult[]> {
    const selected: NotificationChannel[] = channels.includes('all')
      ? ['slack', 'teams']
      : (channels as NotificationChannel[]);

    const results: NotificationResult[] = [];
    for (const channel of selected) {
      results.push(await this.send(channel, input));
    }
    return results;
  }

  async notifyForAgentMessage(message: AgentMessage): Promise<void> {
    const payload = (message.payload as Record<string, unknown>) || {};
    if (message.type === 'RISK_ALERT_CREATED') {
      const severity = String(payload.severity || '').toLowerCase();
      if (severity !== 'high' && severity !== 'critical') return;
      await this.notify({
        title: `PM PLUS ${severity.toUpperCase()} risk`,
        message: String(payload.riskTitle || payload.reason || 'Risk alert created'),
        projectId: message.projectId,
        severity,
      });
      return;
    }

    if (message.type === 'DECISION_REQUESTED') {
      await this.notify({
        title: 'PM PLUS decision required',
        message: String(payload.question || 'A PM decision is waiting'),
        projectId: message.projectId,
      });
      return;
    }

    if (message.type === 'WEEKLY_REPORT_GENERATED') {
      await this.notify({
        title: 'PM PLUS weekly report generated',
        message: `Weekly report is ready for ${message.projectId}`,
        projectId: message.projectId,
      });
    }
  }

  private async send(channel: NotificationChannel, input: NotifyInput): Promise<NotificationResult> {
    const url =
      channel === 'slack'
        ? process.env.SLACK_WEBHOOK_URL
        : process.env.MS_TEAMS_WEBHOOK_URL || process.env.TEAMS_WEBHOOK_URL;

    if (!url) {
      return { channel, configured: false, delivered: false };
    }

    const body =
      channel === 'slack'
        ? {
            text: `*${input.title}*\n${input.message}${input.projectId ? `\nProject: ${input.projectId}` : ''}`,
          }
        : {
            title: input.title,
            text: `${input.message}${input.projectId ? `\n\nProject: ${input.projectId}` : ''}`,
          };

    try {
      const response = await postJson(url, body);
      return {
        channel,
        configured: true,
        delivered: response.statusCode >= 200 && response.statusCode < 300,
        statusCode: response.statusCode,
      };
    } catch (error) {
      return {
        channel,
        configured: true,
        delivered: false,
        error: error instanceof Error ? error.message : 'Webhook delivery failed',
      };
    }
  }
}

export const notificationService = new NotificationService();
