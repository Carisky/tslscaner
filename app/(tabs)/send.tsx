import Constants from 'expo-constants';
import { PropsWithChildren, useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScanSession } from '@/providers/scan-provider';

type SendState = 'idle' | 'sending' | 'success' | 'error';

export default function SendScreen() {
  const { items, itemsCount } = useScanSession();
  const [endpoint, setEndpoint] = useState('');
  const [comment, setComment] = useState('');
  const [state, setState] = useState<SendState>('idle');
  const [lastMessage, setLastMessage] = useState('');

  const payload = useMemo(
    () => ({
      device: {
        id: Constants.deviceName ?? 'Nieznana Zebra',
        app: Constants.expoConfig?.name ?? 'tslscaner',
      },
      comment: comment || undefined,
      total: itemsCount,
      scans: items.map((scan) => ({
        id: scan.id,
        code: scan.code,
        labelType: scan.labelType,
        friendlyName: scan.friendlyName,
        timestamp: scan.timestamp,
        source: scan.source,
      })),
    }),
    [comment, items, itemsCount],
  );

  const sendToEndpoint = async () => {
    if (!endpoint.trim().length) {
      Alert.alert('Wymagany adres URL', 'Podaj endpoint, na który wyślemy JSON.');
      return;
    }

    setState('sending');
    setLastMessage('');
    try {
      const response = await fetch(endpoint.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Serwer zwrócił: ${response.status}`);
      }

      setState('success');
      setLastMessage('Wysłano pomyślnie');
    } catch (err) {
      setState('error');
      setLastMessage((err as Error)?.message ?? 'Błąd');
    }
  };

  const sharePayload = async () => {
    setState('idle');
    setLastMessage('');
    await Share.share({
      message: JSON.stringify(payload, null, 2),
      title: 'Eksport skanów',
    });
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Wysyłka</ThemedText>
      <ThemedText style={styles.helper}>
        Zebrano tymczasowy bufor z {itemsCount} skanów. Możesz wysłać go przez HTTP POST lub
        udostępnić dalej (Telegram, e-mail itd.).
      </ThemedText>

      <Card>
        <ThemedText type="subtitle">Endpoint HTTP</ThemedText>
        <TextInput
          value={endpoint}
          onChangeText={setEndpoint}
          placeholder="https://example.org/api/scans"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
        />
        <ThemedText style={styles.fieldLabel}>Komentarz</ThemedText>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Np.: zmiana A, 2 palety"
          style={styles.input}
        />
        <Pressable
          style={[styles.button, state === 'sending' && styles.buttonDisabled]}
          disabled={state === 'sending'}
          onPress={sendToEndpoint}>
          <ThemedText style={styles.buttonText}>
            {state === 'sending' ? 'Wysyłanie...' : 'Wyślij JSON'}
          </ThemedText>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={sharePayload}>
          <ThemedText style={styles.secondaryButtonText}>Udostępnij</ThemedText>
        </Pressable>
        {lastMessage.length > 0 && (
          <ThemedText
            style={[styles.statusText, state === 'error' ? styles.error : styles.success]}>
            {lastMessage}
          </ThemedText>
        )}
      </Card>

      <Card>
        <ThemedText type="subtitle">Zawartość wysyłki</ThemedText>
        <ThemedText style={styles.sampleText} numberOfLines={8}>
          {JSON.stringify(payload, null, 2)}
        </ThemedText>
      </Card>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
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
