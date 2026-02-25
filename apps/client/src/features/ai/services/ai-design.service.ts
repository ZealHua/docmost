import api from '@/lib/api-client';

export interface ClarifyObjectiveResponse {
  objective: string;
  originalMessage: string;
}

export async function clarifyObjective(
  message: string
): Promise<ClarifyObjectiveResponse> {
  const response = await api.post<ClarifyObjectiveResponse>(
    '/ai/clarify-objective',
    { message }
  );
  return response.data;
}
