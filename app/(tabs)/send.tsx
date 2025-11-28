import Constants from 'expo-constants';
import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
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
const CHUNK_SIZE = 300;

const toPayloadScan = (scan: ScanItem) => ({
  id: scan.id,
  code: scan.code,
  labelType: scan.labelType,
  friendlyName: scan.friendlyName,
  timestamp: scan.timestamp,
  source: scan.source,
});

export default function SendScreen() {
  const { items, itemsCount, folders } = useScanSession();
  const { serverBaseUrl, apiKey } = useSettings();
  const [comment, setComment] = useState('');
  const [prisma, setPrisma] = useState('');
  const [state, setState] = useState<SendState>('idle');
  const [lastMessage, setLastMessage] = useState('');
  const [selectedSource, setSelectedSource] = useState<'buffer' | string>('buffer');

  const scansEndpoint = useMemo(() => buildScansUrl(serverBaseUrl), [serverBaseUrl]);
  const hasEndpoint = Boolean(scansEndpoint);

  const selectedFolder = folders.find((folder) => folder.id === selectedSource);
  const activeScans = selectedSource === 'buffer' ? items : selectedFolder?.scans ?? items;
  const activeCount = activeScans.length;
  const sourceLabel =
    selectedSource === 'buffer' ? 'Bufor tymczasowy' : selectedFolder?.name ?? 'Bufor tymczasowy';

  useEffect(() => {
    if (selectedSource !== 'buffer' && !folders.some((folder) => folder.id === selectedSource)) {
      setSelectedSource('buffer');
    }
  }, [folders, selectedSource]);

  const sourceOptions = useMemo(
    () => [
      { id: 'buffer', label: 'Bufor tymczasowy', count: itemsCount },
      ...folders.map((folder) => ({
        id: folder.id,
        label: folder.name,
        count: folder.scans.length,
      })),
    ],
    [folders, itemsCount],
  );

  const payload = useMemo(
    () => ({
      device: {
        id: Constants.deviceName ?? 'Nieznana Zebra',
        app: Constants.expoConfig?.name ?? 'tslscaner',
      },
      comment: comment || undefined,
      prisma: prisma || undefined,
      total: activeCount,
      scans: activeScans.map(toPayloadScan),
    }),
    [activeCount, activeScans, comment, prisma],
  );

  const sendToEndpoint = async () => {
    if (!hasEndpoint) {
      Alert.alert('Brak serwera', 'Najpierw ustaw bazowy adres w zakladce Ustawienia.');
      return;
    }
    if (activeScans.length === 0) {
      Alert.alert('Brak danych', `Dodaj skany do ${sourceLabel}.`);
      return;
    }

    setState('sending');
    setLastMessage('');
    try {
      const batches: ScanItem[][] = [];
      for (let idx = 0; idx < activeScans.length; idx += CHUNK_SIZE) {
        batches.push(activeScans.slice(idx, idx + CHUNK_SIZE));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        console.log(
          `Sending batch ${batchIndex + 1}/${batches.length} from ${sourceLabel} to ${scansEndpoint}`,
        );
        const chunkPayload: ScanChunkPayload = {
          device: payload.device,
          comment: payload.comment,
          prisma: payload.prisma,
          total: activeCount,
          scans: batches[batchIndex].map(toPayloadScan),
        };
        await sendScanChunk(serverBaseUrl, apiKey, chunkPayload);
      }

      setState('success');
      setLastMessage(
        `Wyslano ${activeCount} skanów z ${sourceLabel} w ${batches.length} zadaniach na ${scansEndpoint}`,
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

            <ThemedText style={styles.fieldLabel}>Prisma (opcjonalnie)</ThemedText>
            <TextInput
              value={prisma}
              onChangeText={setPrisma}
              placeholder="Prisma"
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
