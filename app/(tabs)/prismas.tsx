import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettings } from '@/providers/settings-provider';

type PrismaSummary = {
  name: string;
  totalCount: number;
  factScanned?: number | null;
};

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

export default function PrismasScreen() {
  const { serverBaseUrl } = useSettings();
  const resolvedScanEndpoint = useMemo(() => buildEndpoint(serverBaseUrl), [serverBaseUrl]);
  const resolvedApiBase = useMemo(
    () => (resolvedScanEndpoint ? resolvedScanEndpoint.replace(/\/scans$/i, '') : ''),
    [resolvedScanEndpoint],
  );

  const [prismas, setPrismas] = useState<PrismaSummary[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState('');

  const fetchPrismas = useCallback(async () => {
    if (!resolvedApiBase) {
      return;
    }
    setLoading(true);
    setFetchError('');
    setStatusMessage('');
    try {
      const response = await fetch(`${resolvedApiBase}/prismas`);
      if (!response.ok) {
        throw new Error(`Serwer zwrócił ${response.status}`);
      }
      const payload = (await response.json()) as { prismas?: PrismaSummary[] };
      const list = Array.isArray(payload.prismas) ? payload.prismas : [];
      setPrismas(list);
      setDrafts(
        list.reduce<Record<string, string>>((acc, prisma) => {
          acc[prisma.name] = String(prisma.factScanned ?? prisma.totalCount ?? 0);
          return acc;
        }, {}),
      );
    } catch (err) {
      setFetchError((err as Error)?.message ?? 'Nie udało się pobrać danych');
    } finally {
      setLoading(false);
    }
  }, [resolvedApiBase]);

  useEffect(() => {
    if (!resolvedApiBase) {
      setPrismas([]);
      setDrafts({});
      setFetchError('');
      setStatusMessage('');
      return;
    }
    void fetchPrismas();
  }, [fetchPrismas, resolvedApiBase]);

  const handleDraftChange = (name: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [name]: value }));
    setCardErrors((prev) => {
      if (!prev[name]) {
        return prev;
      }
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleUpdateFact = async (prismaName: string) => {
    if (!resolvedApiBase) {
      return;
    }

    const rawValue = drafts[prismaName] ?? '';
    const trimmed = rawValue.replace(/,/g, '.').trim();
    if (!trimmed.length) {
      setCardErrors((prev) => ({ ...prev, [prismaName]: 'Wprowadź wartość' }));
      return;
    }

    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      setCardErrors((prev) => ({ ...prev, [prismaName]: 'Nieprawidłowa liczba' }));
      return;
    }

    setUpdating((prev) => ({ ...prev, [prismaName]: true }));
    setCardErrors((prev) => {
      if (!prev[prismaName]) {
        return prev;
      }
      const next = { ...prev };
      delete next[prismaName];
      return next;
    });

    try {
      const response = await fetch(
        `${resolvedApiBase}/prismas/${encodeURIComponent(prismaName)}/fact`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ factScanned: numeric }),
        },
      );

      if (!response.ok) {
        const responseText = await response.text();
        const trailing = responseText ? `: ${responseText}` : '';
        throw new Error(`Serwer zwrócił ${response.status}${trailing}`);
      }

      const payload = (await response.json()) as { name: string; factScanned: number };
      setPrismas((prev) =>
        prev.map((entry) =>
          entry.name === payload.name ? { ...entry, factScanned: payload.factScanned } : entry,
        ),
      );
      setDrafts((prev) => ({ ...prev, [payload.name]: String(payload.factScanned) }));
      setStatusMessage(`Zaktualizowano ${payload.name}`);
    } catch (err) {
      setCardErrors((prev) => ({
        ...prev,
        [prismaName]: (err as Error)?.message ?? 'Nie udało się zaktualizować',
      }));
    } finally {
      setUpdating((prev) => {
        const next = { ...prev };
        delete next[prismaName];
        return next;
      });
    }
  };

  const hasApi = Boolean(resolvedApiBase);
  const headerComponent = (
    <View style={styles.headerContent}>
      <View style={styles.headerRow}>
        <ThemedText type="title">Prismy</ThemedText>
        {hasApi && (
          <Pressable
            onPress={() => void fetchPrismas()}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.buttonPressed,
              loading && styles.refreshButtonBusy,
            ]}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#0a7ea4" />
            ) : (
              <ThemedText style={styles.refreshText}>Odśwież</ThemedText>
            )}
          </Pressable>
        )}
      </View>
      <ThemedText style={styles.helper}>
        Lista tabel Prisma z automatycznym totalem i ręcznym nadpisaniem factScanned.
      </ThemedText>
      {fetchError.length > 0 && (
        <ThemedText style={[styles.statusText, styles.errorText]}>{fetchError}</ThemedText>
      )}
      {statusMessage.length > 0 && (
        <ThemedText style={[styles.statusText, styles.successText]}>{statusMessage}</ThemedText>
      )}
      {!hasApi && (
        <ThemedText style={[styles.statusText, styles.helper]}>
          Ustaw bazowy adres serwera w zakładce Ustawienia, aby zobaczyć dane.
        </ThemedText>
      )}
    </View>
  );

  const renderPrisma = ({ item }: { item: PrismaSummary }) => {
    const draftValue = drafts[item.name];
    const errorMessage = cardErrors[item.name];
    const isUpdating = Boolean(updating[item.name]);

    return (
      <Card>
        <View style={styles.cardHeader}>
          <ThemedText type="subtitle">{item.name}</ThemedText>
          <ThemedText style={styles.cardMeta}>Total: {item.totalCount}</ThemedText>
        </View>
        <ThemedText style={styles.label}>Zliczone ręcznie</ThemedText>
        <TextInput
          value={draftValue}
          onChangeText={(value) => handleDraftChange(item.name, value)}
          keyboardType="number-pad"
          style={styles.input}
        />
        <View style={styles.updateRow}>
          <Pressable
            onPress={() => handleUpdateFact(item.name)}
            disabled={isUpdating || !hasApi}
            style={({ pressed }) => [
              styles.updateButton,
              (!hasApi || isUpdating) && styles.updateButtonDisabled,
              pressed && !isUpdating && styles.buttonPressed,
            ]}>
            {isUpdating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.updateButtonText}>Aktualizuj Fakt</ThemedText>
            )}
          </Pressable>
          <ThemedText style={styles.cardMeta}>
            Serwerowe: {item.factScanned ?? item.totalCount}
          </ThemedText>
        </View>
        {errorMessage && <ThemedText style={[styles.statusText, styles.errorText]}>{errorMessage}</ThemedText>}
      </Card>
    );
  };

  return (
    <ThemedView style={styles.screen}>
      <FlatList
        data={prismas}
        keyExtractor={(item) => item.name}
        ListHeaderComponent={headerComponent}
        ListEmptyComponent={
          hasApi ? (
            loading ? (
              <ActivityIndicator color="#0a7ea4" size="large" style={styles.emptyIndicator} />
            ) : (
              <ThemedText style={styles.emptyText}>Brak rekordów do wyświetlenia.</ThemedText>
            )
          ) : null
        }
        renderItem={renderPrisma}
        contentContainerStyle={styles.content}
      />
    </ThemedView>
  );
}

const Card = ({ children }: { children: ReactNode }) => (
  <ThemedView lightColor="#fff" darkColor="#1f2937" style={styles.card}>
    {children}
  </ThemedView>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 48,
  },
  headerContent: {
    gap: 6,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helper: {
    color: '#6b7280',
    fontSize: 12,
  },
  statusText: {
    fontSize: 12,
  },
  successText: {
    color: '#047857',
  },
  errorText: {
    color: '#dc2626',
  },
  refreshButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0a7ea4',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  refreshText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  refreshButtonBusy: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 32,
  },
  emptyIndicator: {
    marginTop: 32,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardMeta: {
    color: '#6b7280',
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  updateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  updateButton: {
    borderRadius: 8,
    backgroundColor: '#0a7ea4',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  updateButtonDisabled: {
    opacity: 0.6,
  },
  updateButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
