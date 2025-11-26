import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettings } from '@/providers/settings-provider';

export default function SettingsScreen() {
  const { serverBaseUrl, apiKey, setServerBaseUrl, setApiKey, hydrated } = useSettings();
  const [draftUrl, setDraftUrl] = useState(serverBaseUrl);
  const [draftApiKey, setDraftApiKey] = useState(apiKey);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    setDraftUrl(serverBaseUrl);
    setDraftApiKey(apiKey);
  }, [hydrated, serverBaseUrl, apiKey]);

  const normalizedDraft = useMemo(() => draftUrl.trim(), [draftUrl]);
  const normalizedApiKey = useMemo(() => draftApiKey.trim(), [draftApiKey]);

  const saveSettings = () => {
    setServerBaseUrl(normalizedDraft);
    setApiKey(normalizedApiKey);
    setLastSaved(new Date());
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
          <ThemedText type="title">Ustawienia</ThemedText>
          <ThemedText style={styles.helper}>
            Skonfiguruj bazowy adres serwera.
            <ThemedText type="defaultSemiBold"> https://example.org/api/scans</ThemedText>
          </ThemedText>

          <Card>
            <ThemedText type="subtitle">Bazowy adres serwera</ThemedText>
            <TextInput
              value={draftUrl}
              onChangeText={setDraftUrl}
              placeholder="https://example.org"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.input}
            />
            <ThemedText style={styles.helper}>
              Przyklad: wklej{' '}
              <ThemedText type="defaultSemiBold">https://www-site-domen</ThemedText>
            </ThemedText>
            <ThemedText style={styles.fieldLabel}>X-API-ACCESS</ThemedText>
            <TextInput
              value={draftApiKey}
              onChangeText={setDraftApiKey}
              placeholder="Klucz API"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <Pressable
              onPress={saveSettings}
              style={[styles.button, !normalizedDraft.length && styles.buttonDisabled]}
              disabled={!normalizedDraft.length}>
              <ThemedText style={styles.buttonText}>Zapisz</ThemedText>
            </Pressable>
            {lastSaved && (
              <ThemedText style={styles.statusText}>
                Zaktualizowano {lastSaved.toLocaleTimeString()}
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
    gap: 12,
    paddingBottom: 48,
  },
  helper: {
    marginTop: 4,
    color: '#6b7280',
    fontSize: 12,
  },
  fieldLabel: {
    marginTop: 16,
    fontSize: 12,
    color: '#6b7280',
  },
  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  button: {
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: '#0a7ea4',
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  statusText: {
    marginTop: 8,
    fontSize: 12,
    color: '#10b981',
  },
});

const Card = ({ children }: PropsWithChildren) => (
  <ThemedView lightColor="#fff" darkColor="#1f2937" style={styles.card}>
    {children}
  </ThemedView>
);
