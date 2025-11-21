import Constants from 'expo-constants';
import { PropsWithChildren, useMemo, useState } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { ScanItem } from '@/providers/scan-provider';
import { useScanSession } from '@/providers/scan-provider';
import { useSettings } from '@/providers/settings-provider';

type SendState = 'idle' | 'sending' | 'success' | 'error';
const CHUNK_SIZE = 20;

const toPayloadScan = (scan: ScanItem) => ({
  id: scan.id,
  code: scan.code,
  labelType: scan.labelType,
  friendlyName: scan.friendlyName,
  timestamp: scan.timestamp,
  source: scan.source,
});

const buildEndpoint = (rawUrl: string) => {
  const trimmed = rawUrl.trim();
  if (!trimmed.length) {
    return '';
  }
  const withoutTrailers = trimmed.replace(/\/+$/, '');
  if (/\/api\/scans$/i.test(withoutTrailers)) {
    return withoutTrailers;
  }
  return `${withoutTrailers}/api/scans`;
};

export default function SendScreen() {
  const { items, itemsCount } = useScanSession();
  const { serverBaseUrl } = useSettings();
  const [comment, setComment] = useState('');
  const [prisma, setPrisma] = useState('');
  const [state, setState] = useState<SendState>('idle');
  const [lastMessage, setLastMessage] = useState('');

  const resolvedEndpoint = useMemo(() => buildEndpoint(serverBaseUrl), [serverBaseUrl]);

  const payload = useMemo(
    () => ({
      device: {
        id: Constants.deviceName ?? 'Nieznana Zebra',
        app: Constants.expoConfig?.name ?? 'tslscaner',
      },
      comment: comment || undefined,
      prisma: prisma || undefined,
      total: itemsCount,
      scans: items.map(toPayloadScan),
    }),
    [comment, items, itemsCount, prisma],
  );

  const sendToEndpoint = async () => {
    if (!resolvedEndpoint.length) {
      Alert.alert('Brak serwera', 'Najpierw ustaw bazowy adres w zakladce Ustawienia.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Brak danych', 'Dodaj przynajmniej jeden skan.');
      return;
    }

    setState('sending');
    setLastMessage('');
    try {
      const batches: ScanItem[][] = [];
      for (let idx = 0; idx < items.length; idx += CHUNK_SIZE) {
        batches.push(items.slice(idx, idx + CHUNK_SIZE));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        console.log(
          `Sending batch ${batchIndex + 1}/${batches.length} to ${resolvedEndpoint}`,
        );
        const chunkPayload = {
          device: payload.device,
          comment: payload.comment,
          prisma: payload.prisma,
          total: itemsCount,
          scans: batches[batchIndex].map(toPayloadScan),
        };
        const response = await fetch(resolvedEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunkPayload),
        });

        if (!response.ok) {
          const responseText = await response.text();
          const details =
            responseText && responseText.length ? ` | tresc: ${responseText}` : '';
          throw new Error(
            `Serwer zwrocil ${response.status} (partia ${batchIndex + 1}/${
              batches.length
            })${details}`,
          );
        }
      }

      setState('success');
      setLastMessage(
        `Wyslano ${itemsCount} skanow w ${batches.length} zadaniach na ${resolvedEndpoint}`,
      );
      Alert.alert('Sukces', 'Dane wyslano na serwer.');
    } catch (err) {
      setState('error');
      const message = (err as Error)?.message ?? 'Blad';
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
            Tymczasowy bufor zawiera {itemsCount} skanow. Mozesz wyslac je na server albo udostepnic
            dalej.
          </ThemedText>

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
                (state === 'sending' || !resolvedEndpoint.length) && styles.buttonDisabled,
              ]}
              disabled={state === 'sending' || !resolvedEndpoint.length}
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
