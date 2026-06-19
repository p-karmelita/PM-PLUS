import { BackboneStore } from './store';
import { AgentMessage, DecisionRequest, Employee, ResourceRecommendation } from './types';
import { newId, nowIso } from './utils';

export interface ResourceBalancerResult {
  recommendation?: ResourceRecommendation;
  decisionRequest?: DecisionRequest;
  existingRecommendation?: ResourceRecommendation;
  messages: AgentMessage[];
}

function pickEmployees(employees: Employee[]): { overloaded?: Employee; available?: Employee } {
  const overloaded = employees.find((employee) => employee.currentWorkload === 'heavy');
  const available = employees.find(
    (employee) => employee.currentWorkload === 'light' && employee.employeeId !== overloaded?.employeeId
  );
  return { overloaded, available };
}

export class ResourceBalancerAgent {
  constructor(private readonly store: BackboneStore) {}

  evaluateProject(projectId: string, correlationId: string): ResourceBalancerResult {
    const employees = this.store.listEmployees(projectId);
    const { overloaded, available } = pickEmployees(employees);

    if (!overloaded || !available) {
      return { messages: [] };
    }

    const existing = this.store.findPendingRecommendation({
      projectId,
      overloadedEmployeeId: overloaded.employeeId,
      availableEmployeeId: available.employeeId,
    });

    if (existing) {
      return { existingRecommendation: existing, messages: [] };
    }

    const decisionId = newId('decision');
    const recommendation: ResourceRecommendation = {
      recommendationId: newId('rb'),
      projectId,
      correlationId,
      issue: `${overloaded.employeeName} has heavy workload while ${available.employeeName} has available capacity`,
      overloadedEmployeeId: overloaded.employeeId,
      overloadedEmployeeName: overloaded.employeeName,
      availableEmployeeId: available.employeeId,
      availableEmployeeName: available.employeeName,
      suggestedAction: `Move a non-critical support task from ${overloaded.employeeName} to ${available.employeeName}.`,
      impact: `${overloaded.employeeName} can focus on critical path work; ${available.employeeName} absorbs parallel load.`,
      requiresDecision: true,
      decisionId,
      status: 'pending_pm',
      createdAt: nowIso(),
    };
    this.store.saveRecommendation(recommendation);

    const decisionRequest: DecisionRequest = {
      decisionId,
      projectId,
      correlationId,
      category: 'resource_rebalance',
      status: 'pending_pm',
      lifecycleStage: 'pending_pm',
      question: `Should non-critical work be reassigned from ${overloaded.employeeName} to ${available.employeeName}?`,
      options: ['approve', 'reject'],
      requestedBy: 'resource_balancer',
      origin: 'workflow',
      context: {
        recommendationId: recommendation.recommendationId,
        overloadedEmployeeId: overloaded.employeeId,
        overloadedEmployeeName: overloaded.employeeName,
        availableEmployeeId: available.employeeId,
        availableEmployeeName: available.employeeName,
        suggestedAction: recommendation.suggestedAction,
      },
      requestedAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.store.saveDecisionRequest(decisionRequest);

    const messages: AgentMessage[] = [
      {
        messageId: newId('msg'),
        correlationId,
        type: 'RESOURCE_REBALANCE_RECOMMENDED',
        sourceAgent: 'resource_balancer',
        targetAgents: ['reporter'],
        projectId,
        payload: recommendation,
        timestamp: nowIso(),
        requiresDecision: true,
        decisionId,
      },
      {
        messageId: newId('msg'),
        correlationId,
        type: 'DECISION_REQUESTED',
        sourceAgent: 'resource_balancer',
        targetAgents: ['pm', 'reporter'],
        projectId,
        payload: decisionRequest,
        timestamp: nowIso(),
        requiresDecision: true,
        decisionId,
      },
    ];

    return { recommendation, decisionRequest, messages };
  }
}
