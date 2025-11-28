import { createApiClient } from '@/api/client';

export type TrainSummary = {
  name: string;
  totalCount: number;
  factLoaded?: number | null;
};

export const fetchTrains = async (
  baseUrl: string,
  apiKey?: string,
): Promise<TrainSummary[]> => {
  const client = createApiClient(baseUrl, apiKey);
  if (!client) {
    throw new Error('Brak skonfigurowanego serwera');
  }
  const response = await client.get<{ trains?: TrainSummary[] }>('/trains');
  return response.data.trains ?? [];
};

export const updateTrainFact = async (
  baseUrl: string,
  apiKey: string | undefined,
  trainName: string,
  factLoaded: number,
) => {
  const client = createApiClient(baseUrl, apiKey);
  if (!client) {
    throw new Error('Brak skonfigurowanego serwera');
  }
  const response = await client.patch<{ name: string; factLoaded: number }>(
    `/trains/${encodeURIComponent(trainName)}/fact`,
    { factLoaded },
  );
  return response.data;
};
