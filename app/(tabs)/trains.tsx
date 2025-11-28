import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { fetchTrains, TrainSummary, updateTrainFact } from '@/api/trains';
import { getApiRoot } from '@/api/client';
import { getRequestErrorMessage } from '@/api/errors';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSettings } from '@/providers/settings-provider';

export default function TrainsScreen() {
  const { serverBaseUrl, apiKey } = useSettings();
  const apiRoot = useMemo(() => getApiRoot(serverBaseUrl), [serverBaseUrl]);
  const hasApi = Boolean(apiRoot);

  const [trains, setTrains] = useState<TrainSummary[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState('');

  const loadTrains = useCallback(async () => {
    if (!hasApi) {
      return;
    }
    setLoading(true);
    setFetchError('');
    setStatusMessage('');
    try {
      const list = await fetchTrains(serverBaseUrl, apiKey);
      setTrains(list);
      setDrafts(
        list.reduce<Record<string, string>>((acc, train) => {
          acc[train.name] = String(train.factLoaded ?? train.totalCount ?? 0);
          return acc;
        }, {}),
      );
    } catch (err) {
      setFetchError(getRequestErrorMessage(err, 'Nie udało się pobrać danych'));
    } finally {
      setLoading(false);
    }
  }, [apiKey, hasApi, serverBaseUrl]);

  useEffect(() => {
    if (!hasApi) {
      setTrains([]);
      setDrafts({});
      setFetchError('');
      setStatusMessage('');
      return;
    }
    void loadTrains();
  }, [hasApi, loadTrains]);

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

  const handleUpdateFact = async (trainName: string) => {
    if (!hasApi) {
      return;
    }

    const rawValue = drafts[trainName] ?? '';
    const trimmed = rawValue.replace(/,/g, '.').trim();
    if (!trimmed.length) {
      setCardErrors((prev) => ({ ...prev, [trainName]: 'Wprowadź wartość' }));
      return;
    }

    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      setCardErrors((prev) => ({ ...prev, [trainName]: 'Nieprawidłowa liczba' }));
      return;
    }

    setUpdating((prev) => ({ ...prev, [trainName]: true }));
    setCardErrors((prev) => {
      if (!prev[trainName]) {
        return prev;
      }
      const next = { ...prev };
      delete next[trainName];
      return next;
    });

    try {
      const payload = await updateTrainFact(
        serverBaseUrl,
        apiKey,
        trainName,
        numeric,
      );
      setTrains((prev) =>
        prev.map((entry) =>
          entry.name === payload.name ? { ...entry, factLoaded: payload.factLoaded } : entry,
        ),
      );
      setDrafts((prev) => ({ ...prev, [payload.name]: String(payload.factLoaded) }));
      setStatusMessage(`Zaktualizowano ${payload.name}`);
    } catch (err) {
      setCardErrors((prev) => ({
        ...prev,
        [trainName]: getRequestErrorMessage(err, 'Nie udało się zaktualizować'),
      }));
    } finally {
      setUpdating((prev) => {
        const next = { ...prev };
        delete next[trainName];
        return next;
      });
    }
  };

  const headerComponent = (
    <View style={styles.headerContent}>
      <View style={styles.headerRow}>
        <ThemedText type="title">Trains</ThemedText>
        {hasApi && (
          <Pressable
            onPress={() => void loadTrains()}
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
        Lista tabel Train z automatycznym totalem i ręcznym nadpisaniem factLoaded.
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

  const renderTrain = ({ item }: { item: TrainSummary }) => {
    const draftValue = drafts[item.name];
    const errorMessage = cardErrors[item.name];
    const isUpdating = Boolean(updating[item.name]);

    return (
      <Card>
        <View style={styles.cardHeader}>
          <ThemedText type="subtitle">{item.name}</ThemedText>
          <ThemedText style={styles.cardMeta}>Total: {item.totalCount}</ThemedText>
        </View>
        <ThemedText style={styles.label}>Załadowane ręcznie</ThemedText>
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
              <ThemedText style={styles.updateButtonText}>Aktualizuj fakt</ThemedText>
            )}
          </Pressable>
          <ThemedText style={styles.cardMeta}>
            Serwerowe: {item.factLoaded ?? item.totalCount}
          </ThemedText>
        </View>
        {errorMessage && <ThemedText style={[styles.statusText, styles.errorText]}>{errorMessage}</ThemedText>}
      </Card>
    );
  };

  return (
    <ThemedView style={styles.screen}>
      <FlatList
        data={trains}
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
        renderItem={renderTrain}
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
