import { AgentCheckIn, AgentMessage } from '../types';

export interface BandAiConfig {
  agentId: string;
  apiKey: string;
  baseUrl?: string;
}

export class BandAiService {
  private config: BandAiConfig;
  private baseUrl: string;

  constructor(config: BandAiConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://app.band.ai/api/v1';
  }

  /**
   * Get agent profile information
   */
  async getAgentProfile(): Promise<any> {
    const url = `${this.baseUrl}/agent/me`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': this.config.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Band.ai API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get chat context for rehydration
   */
  async getChatContext(chatId: string, options?: {
    limit?: number;
    page?: number;
    pageSize?: number;
  }): Promise<any> {
    const params = new URLSearchParams({
      limit: String(options?.limit || 50),
      page: String(options?.page || 1),
      page_size: String(options?.pageSize || 50)
    });

    const url = `${this.baseUrl}/agent/chats/${chatId}/context?${params}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': this.config.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Band.ai API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Report agent activity (keep-alive)
   */
  async reportActivity(chatId: string, working: boolean): Promise<any> {
    const url = `${this.baseUrl}/agent/chats/${chatId}/activity`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': this.config.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ working })
    });

    if (!response.ok) {
      throw new Error(`Band.ai API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Send message to chat as human user
   */
  async sendMessage(chatId: string, content: string, mentions?: any[]): Promise<any> {
    const url = `${this.baseUrl}/me/chats/${chatId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': this.config.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          content,
          mentions: mentions || []
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Band.ai API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get messages from chat
   */
  async getMessages(chatId: string, options?: {
    limit?: number;
    page?: number;
  }): Promise<any> {
    const params = new URLSearchParams({
      limit: String(options?.limit || 50),
      page: String(options?.page || 1)
    });

    const url = `${this.baseUrl}/me/chats/${chatId}/messages?${params}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': this.config.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Band.ai API error: ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * Factory function to create Band.ai service instances for different agents
 */
export function createBandAiService(agentType: 'collector' | 'resource_balancer' | 'drafter' | 'reviewer'): BandAiService {
  // Load agent configuration from environment or config file
  const agentConfigs: Record<string, BandAiConfig> = {
    collector: {
      agentId: process.env.COLLECTOR_AGENT_ID || '24437a9a-161b-4719-a1d3-1127969c355d',
      apiKey: process.env.COLLECTOR_API_KEY || 'band_a_1781716221_LBcemt1vSVsaQn0z7fimLIOl-N6v2oCb'
    },
    resource_balancer: {
      agentId: process.env.RESOURCE_BALANCER_AGENT_ID || '0bcdb5ba-79b1-4072-87c4-3df8538e58b3',
      apiKey: process.env.RESOURCE_BALANCER_API_KEY || 'band_a_1781715758_sfJgn-If3YswFk6PML3xd-4rXxH5XS-S'
    },
    drafter: {
      agentId: process.env.DRAFTER_AGENT_ID || '38b68b35-411e-4920-911d-426c4613765b',
      apiKey: process.env.DRAFTER_API_KEY || 'band_a_1781453829_yv5dXz37gUWUF4RekvezT7nayxBCYDxE'
    },
    reviewer: {
      agentId: process.env.REVIEWER_AGENT_ID || '3f93702f-f803-45b9-a36a-694c0328a8c9',
      apiKey: process.env.REVIEWER_API_KEY || 'band_a_1781456574__cXtAW4JfRyl-fXJQP2M9_4vk2J030xt'
    }
  };

  const config = agentConfigs[agentType];
  if (!config) {
    throw new Error(`Unknown agent type: ${agentType}`);
  }

  return new BandAiService(config);
}

// Made with Bob
