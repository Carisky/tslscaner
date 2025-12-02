import { createApiClient } from '@/api/client';
import type { ScanItem } from '@/providers/scan-provider';

export type ScanChunkPayload = {
  device: {
    id: string;
    app: string;
  };
  comment?: string;
  prisma?: string;
  train?: string;
  wagon?: string;
  total: number;
  scans: ScanItem[];
};

export const sendScanChunk = async (
  baseUrl: string,
  apiKey: string | undefined,
  chunk: ScanChunkPayload,
) => {
  const client = createApiClient(baseUrl, apiKey);
  if (!client) {
    throw new Error('Brak skonfigurowanego serwera');
  }
  await client.post('/scans', chunk);
};
