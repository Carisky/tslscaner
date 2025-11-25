import { createApiClient } from '@/api/client';

export type PrismaSummary = {
  name: string;
  totalCount: number;
  factScanned?: number | null;
};

export const fetchPrismas = async (
  baseUrl: string,
  apiKey?: string,
): Promise<PrismaSummary[]> => {
  const client = createApiClient(baseUrl, apiKey);
  if (!client) {
    throw new Error('Brak skonfigurowanego serwera');
  }
  const response = await client.get<{ prismas?: PrismaSummary[] }>('/prismas');
  return response.data.prismas ?? [];
};

export const updatePrismaFact = async (
  baseUrl: string,
  apiKey: string | undefined,
  prismaName: string,
  factScanned: number,
) => {
  const client = createApiClient(baseUrl, apiKey);
  if (!client) {
    throw new Error('Brak skonfigurowanego serwera');
  }
  const response = await client.patch<{ name: string; factScanned: number }>(
    `/prismas/${encodeURIComponent(prismaName)}/fact`,
    { factScanned },
  );
  return response.data;
};
