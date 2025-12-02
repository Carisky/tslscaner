import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { buildScansUrl } from '@/api/client';
import { getRequestErrorMessage } from '@/api/errors';
import { sendScanChunk, type ScanChunkPayload } from '@/api/scans';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { ScanItem } from '@/providers/scan-provider';
import { useScanSession } from '@/providers/scan-provider';
import { useSettings } from '@/providers/settings-provider';

type SendState = 'idle' | 'sending' | 'success' | 'error';
const CHUNK_SIZE = 50;
const SEND_SESSION_STORAGE_KEY = 'tslscaner.sendSessions.v1';
const MAX_CHUNK_RETRY = 3;
const RETRY_DELAY_MS = 15000;
type TargetType = 'prisma' | 'train';
const TARGET_OPTIONS: { id: TargetType; label: string }[] = [
  { id: 'prisma', label: 'Prisma' },
  { id: 'train', label: 'Train' },
];

type SourceKind = 'buffer' | 'folder' | 'train' | 'wagon';
type SourceOption = {
  id: string;
  label: string;
  count: number;
  kind: SourceKind;
  folderId?: string;
  wagonId?: string;
};

const toPayloadScan = (scan: ScanItem) => ({
  id: scan.id,
  code: scan.code,
  labelType: scan.labelType,
  friendlyName: scan.friendlyName,
  timestamp: scan.timestamp,
  source: scan.source,
});

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let idx = 0; idx < items.length; idx += size) {
    chunks.push(items.slice(idx, idx + size));
  }
  return chunks;
};

type ChunkPayload = ReturnType<typeof toPayloadScan>;
type StoredChunk = {
  scans: ChunkPayload[];
  sent: boolean;
  createdAt: string;
  wagonName?: string;
};
type StoredSendSession = {
  device: ScanChunkPayload['device'];
  comment?: string;
  prisma?: string;
  train?: string;
  total: number;
  chunkSize: number;
  createdAt: string;
  chunks: StoredChunk[];
};
type PendingSendSessions = Record<string, StoredSendSession>;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const readSendSessions = async (): Promise<PendingSendSessions> => {
  try {
    const raw = await AsyncStorage.getItem(SEND_SESSION_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as PendingSendSessions;
  } catch (err) {
    console.warn('Failed to hydrate send sessions', err);
    return {};
  }
};

const saveSendSessions = async (sessions: PendingSendSessions) => {
  try {
    if (!Object.keys(sessions).length) {
      await AsyncStorage.removeItem(SEND_SESSION_STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(SEND_SESSION_STORAGE_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.warn('Failed to persist send sessions', err);
  }
};

export default function SendScreen() {
  const { items, itemsCount, folders } = useScanSession();
  const { serverBaseUrl, apiKey } = useSettings();
  const [comment, setComment] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('prisma');
  const [targetValue, setTargetValue] = useState('');
  const [isTargetPickerVisible, setTargetPickerVisible] = useState(false);
  const [state, setState] = useState<SendState>('idle');
  const [lastMessage, setLastMessage] = useState('');
  const [selectedSource, setSelectedSource] = useState<'buffer' | string>('buffer');

  const scansEndpoint = useMemo(() => buildScansUrl(serverBaseUrl), [serverBaseUrl]);
  const hasEndpoint = Boolean(scansEndpoint);

  const targetLabel = targetType === 'prisma' ? 'Prisma' : 'Train';

  const sourceOptions = useMemo<SourceOption[]>(() => {
    const initial: SourceOption[] = [
      { id: 'buffer', label: 'Bufor tymczasowy', count: itemsCount, kind: 'buffer' },
    ];
    folders.forEach((folder) => {
      if (folder.target === 'train') {
        const trainCount = folder.wagons.reduce((acc, wagon) => acc + wagon.scans.length, 0);
        initial.push({
          id: `train:${folder.id}`,
          label: folder.name,
          count: trainCount,
          kind: 'train',
          folderId: folder.id,
        });
        folder.wagons.forEach((wagon) => {
          initial.push({
            id: `wagon:${folder.id}:${wagon.id}`,
            label: `${folder.name} / ${wagon.name}`,
            count: wagon.scans.length,
            kind: 'wagon',
            folderId: folder.id,
            wagonId: wagon.id,
          });
        });
        return;
      }
      initial.push({
        id: folder.id,
        label: folder.name,
        count: folder.scans.length,
        kind: 'folder',
        folderId: folder.id,
      });
    });
    return initial;
  }, [folders, itemsCount]);

  useEffect(() => {
    if (!sourceOptions.some((option) => option.id === selectedSource)) {
      setSelectedSource('buffer');
    }
  }, [sourceOptions, selectedSource]);

  const selectedOption =
    sourceOptions.find((option) => option.id === selectedSource) ?? sourceOptions[0];
  const activeScans = useMemo(() => {
    if (!selectedOption) {
      return items;
    }
    if (selectedOption.kind === 'buffer') {
      return items;
    }
    if (selectedOption.kind === 'folder') {
      const folder = folders.find((folder) => folder.id === selectedOption.folderId);
      return folder?.scans ?? [];
    }
    if (selectedOption.kind === 'wagon') {
      const folder = folders.find((folder) => folder.id === selectedOption.folderId);
      const wagon = folder?.wagons.find((wagon) => wagon.id === selectedOption.wagonId);
      return wagon?.scans ?? [];
    }
    if (selectedOption.kind === 'train') {
      const folder = folders.find((folder) => folder.id === selectedOption.folderId);
      return folder ? folder.wagons.flatMap((wagon) => wagon.scans) : [];
    }
    return items;
  }, [selectedOption, folders, items]);
  const activeCount = activeScans.length;
  const sourceLabel = selectedOption?.label ?? 'Bufor tymczasowy';

  useEffect(() => {
    if (!selectedOption || selectedOption.kind === 'buffer') {
      return;
    }
    const folder = folders.find((folder) => folder.id === selectedOption.folderId);
    if (!folder) {
      return;
    }
    const nextTargetType = selectedOption.kind === 'folder' ? 'prisma' : 'train';
    setTargetType(nextTargetType);
    if (!targetValue) {
      setTargetValue(folder.name);
    }
  }, [selectedOption, folders, targetValue]);

  const payload = useMemo(
    () => ({
      device: {
        id: Constants.deviceName ?? 'Nieznana Zebra',
        app: Constants.expoConfig?.name ?? 'tslscaner',
      },
      comment: comment || undefined,
      prisma: targetType === 'prisma' ? targetValue || undefined : undefined,
      train: targetType === 'train' ? targetValue || undefined : undefined,
      total: activeCount,
      scans: activeScans.map(toPayloadScan),
    }),
    [activeCount, activeScans, comment, targetType, targetValue],
  );

  const buildChunksForSource = (sourceOption: SourceOption | undefined) => {
    if (!sourceOption) {
      return [];
    }
    if (sourceOption.kind === 'buffer' || sourceOption.kind === 'folder') {
      return chunkArray(activeScans.map(toPayloadScan), CHUNK_SIZE).map((batch) => ({
        scans: batch,
        sent: false,
        createdAt: new Date().toISOString(),
      }));
    }
    if (sourceOption.kind === 'wagon') {
      const folder = folders.find((folder) => folder.id === sourceOption.folderId);
      const wagon = folder?.wagons.find((wagon) => wagon.id === sourceOption.wagonId);
      if (!wagon) {
        return [];
      }
      return chunkArray(wagon.scans.map(toPayloadScan), CHUNK_SIZE).map((batch) => ({
        scans: batch,
        sent: false,
        createdAt: new Date().toISOString(),
        wagonName: wagon.name,
      }));
    }
    if (sourceOption.kind === 'train') {
      const folder = folders.find((folder) => folder.id === sourceOption.folderId);
      if (!folder) {
        return [];
      }
      const chunks: StoredChunk[] = [];
      folder.wagons.forEach((wagon) => {
        if (!wagon.scans.length) {
          return;
        }
        chunkArray(wagon.scans.map(toPayloadScan), CHUNK_SIZE).forEach((batch) => {
          chunks.push({
            scans: batch,
            sent: false,
            createdAt: new Date().toISOString(),
            wagonName: wagon.name,
          });
        });
      });
      return chunks;
    }
    return [];
  };

  const sendToEndpoint = async () => {
    if (!hasEndpoint) {
      Alert.alert('Brak serwera', 'Najpierw ustaw bazowy adres w zakladce Ustawienia.');
      return;
    }

    setState('sending');
    setLastMessage('');
    try {
      const sourceKey = selectedSource;
      const storedSessions = await readSendSessions();
      let session: StoredSendSession | undefined = storedSessions[sourceKey];

      if (session && session.chunks.every((chunk) => chunk.sent)) {
        delete storedSessions[sourceKey];
        session = undefined;
        await saveSendSessions(storedSessions);
      }

      if (!session) {
        if (activeScans.length === 0) {
          setState('idle');
          Alert.alert('Brak danych', `Dodaj skany do ${sourceLabel}.`);
          return;
        }

        const chunkedScans = buildChunksForSource(selectedOption);
        session = {
          device: payload.device,
          comment: payload.comment,
          prisma: payload.prisma,
          train: payload.train,
          total: payload.total,
          chunkSize: CHUNK_SIZE,
          createdAt: new Date().toISOString(),
          chunks: chunkedScans,
        };
        storedSessions[sourceKey] = session;
        await saveSendSessions(storedSessions);
      }

      const chunkCount = session.chunks.length;

      const sendChunkWithRetry = async (chunkPayload: ScanChunkPayload) => {
        let attempt = 0;
        while (attempt < MAX_CHUNK_RETRY) {
          try {
            await sendScanChunk(serverBaseUrl, apiKey, chunkPayload);
            return;
          } catch (err) {
            attempt += 1;
            if (attempt >= MAX_CHUNK_RETRY) {
              throw err;
            }
            await wait(RETRY_DELAY_MS * attempt);
          }
        }
      };

      for (let chunkIndex = 0; chunkIndex < session.chunks.length; chunkIndex += 1) {
        const chunk = session.chunks[chunkIndex];
        if (chunk.sent) {
          continue;
        }

        const chunkPayload: ScanChunkPayload = {
          device: session.device,
          comment: session.comment,
          prisma: session.prisma,
          train: session.train,
          wagon: chunk.wagonName,
          total: session.total,
          scans: chunk.scans,
        };

        await sendChunkWithRetry(chunkPayload);
        chunk.sent = true;
        storedSessions[sourceKey] = session;
        await saveSendSessions(storedSessions);
      }

      delete storedSessions[sourceKey];
      await saveSendSessions(storedSessions);

      setState('success');
      setLastMessage(
        `Wyslano ${session.total} skanow z ${sourceLabel} w ${chunkCount} zadaniach na ${scansEndpoint}`,
      );
      Alert.alert('Sukces', 'Dane wyslano na serwer.');
    } catch (err) {
      setState('error');
      const message = getRequestErrorMessage(err, 'Blad wysylki');
      setLastMessage(message);
      Alert.alert('Blad wysylki', message);
    }
  };

  const sharePayload = async () => {
    setState('idle');
    setLastMessage('');
    await Share.share({
      message: JSON.stringify(payload, null, 2),
      title: 'Eksport skanow',
    });
  };

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={64}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ThemedText type="title">Wysylka</ThemedText>
          <ThemedText style={styles.helper}>
            Wybrano {sourceLabel} z {activeCount} skanami. Możesz wysłać je na serwer lub udostępnić dalej.
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.sourceRow}
            contentContainerStyle={styles.sourceRowContent}>
            {sourceOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => setSelectedSource(option.id)}
                style={[
                  styles.sourceChip,
                  selectedSource === option.id && styles.sourceChipActive,
                ]}>
                <ThemedText style={styles.sourceChipLabel}>{option.label}</ThemedText>
                <ThemedText style={styles.sourceChipCount}>{option.count}</ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          <Card>
            <ThemedText type="subtitle">Cel wysylki</ThemedText>

            <ThemedText style={styles.fieldLabel}>Typ pola docelowego</ThemedText>
            <Pressable style={styles.targetSelector} onPress={() => setTargetPickerVisible(true)}>
              <ThemedText style={styles.targetSelectorLabel}>{targetLabel}</ThemedText>
              <ThemedText style={styles.targetSelectorArrow}>▾</ThemedText>
            </Pressable>
            <ThemedText style={styles.fieldLabel}>{targetLabel} (opcjonalnie)</ThemedText>
            <TextInput
              value={targetValue}
              onChangeText={setTargetValue}
              placeholder={targetLabel}
              style={styles.input}
            />
            <ThemedText style={styles.fieldLabel}>Komentarz</ThemedText>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Np.: zmiana A, 2 palety"
              style={styles.input}
              multiline
              numberOfLines={3}
            />
            <Pressable
              style={[
                styles.button,
                (state === 'sending' || !hasEndpoint) && styles.buttonDisabled,
              ]}
              disabled={state === 'sending' || !hasEndpoint}
              onPress={sendToEndpoint}>
              <ThemedText style={styles.buttonText}>
                {state === 'sending' ? 'Wysylanie...' : 'Wyslij'}
              </ThemedText>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={sharePayload}>
              <ThemedText style={styles.secondaryButtonText}>Udostepnij</ThemedText>
            </Pressable>
            {lastMessage.length > 0 && (
              <ThemedText
                style={[styles.statusText, state === 'error' ? styles.error : styles.success]}>
                {lastMessage}
              </ThemedText>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={isTargetPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTargetPickerVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalOverlay} onPress={() => setTargetPickerVisible(false)} />
          <ThemedView lightColor="#fff" darkColor="#1f2937" style={styles.modalCard}>
            <ThemedText type="subtitle">Wybierz typ pola</ThemedText>
            {TARGET_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => {
                  setTargetType(option.id);
                  setTargetPickerVisible(false);
                }}
                style={[
                  styles.modalOption,
                  targetType === option.id && styles.modalOptionActive,
                ]}>
                <ThemedText style={styles.modalOptionLabel}>{option.label}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 16,
  },
  helper: {
    marginTop: 8,
    color: '#6b7280',
  },
  sourceRow: {
    marginTop: 12,
  },
  sourceRowContent: {
    flexDirection: 'row',
    gap: 8,
  },
  sourceChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sourceChipActive: {
    borderColor: '#0a7ea4',
    backgroundColor: '#e0f2ff',
  },
  sourceChipLabel: {
    fontSize: 12,
    color: '#0a7ea4',
  },
  sourceChipCount: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  card: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  fieldLabel: {
    marginTop: 16,
    fontSize: 12,
    color: '#6b7280',
  },
  targetSelector: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  targetSelectorLabel: {
    fontSize: 16,
    color: '#0a7ea4',
  },
  targetSelectorArrow: {
    fontSize: 16,
    color: '#6b7280',
  },
  button: {
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: '#0a7ea4',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0a7ea4',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  statusText: {
    marginTop: 12,
  },
  error: {
    color: '#b91c1c',
  },
  success: {
    color: '#047857',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  modalCard: {
    width: '80%',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalOption: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalOptionActive: {
    borderColor: '#0a7ea4',
    backgroundColor: '#e0f2ff',
  },
  modalOptionLabel: {
    fontSize: 16,
    color: '#0a7ea4',
  },
  sampleText: {
    marginTop: 12,
    fontFamily: 'monospace',
    fontSize: 12,
  },
});

const Card = ({ children }: PropsWithChildren) => (
  <ThemedView lightColor="#fff" darkColor="#1f2937" style={styles.card}>
    {children}
  </ThemedView>
);
