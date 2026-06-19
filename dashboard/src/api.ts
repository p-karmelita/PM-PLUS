// Thin fetch helpers. All paths are proxied to the Express backend by Vite.

async function postJSON<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && (data.error as string)) || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function createSession(sessionId?: string): Promise<{ sessionId: string }> {
  return postJSON('/demo/session', { sessionId });
}

export async function runSimulation(sessionId: string): Promise<{ sessionId: string }> {
  return postJSON('/demo/simulate', { sessionId });
}

export async function triggerReal(
  sessionId: string
): Promise<{ sessionId: string; posted: Array<{ employee: string; status: number }> }> {
  return postJSON('/demo/trigger-real', { sessionId });
}

export interface ApprovalDecision {
  requestId: string;
  approved: boolean;
  reason?: string;
  flag_id?: string;
  pm_notes?: string;
}

export async function respondApproval(decision: ApprovalDecision): Promise<void> {
  await postJSON('/human/approval-response', decision);
}
