import { PropsWithChildren } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScanSession } from '@/providers/scan-provider';

export default function ListScreen() {
  const { items, itemsCount, clearAll, removeById } = useScanSession();

  const handleClear = () => {
    if (!itemsCount) return;
    Alert.alert('Wyczyścić listę', 'Usunąć wszystkie tymczasowe skany?', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Wyczyść', style: 'destructive', onPress: clearAll },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Lista</ThemedText>
        <View style={styles.counter}>
          <ThemedText style={styles.counterText}>{itemsCount}</ThemedText>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={handleClear}
          disabled={!itemsCount}
          style={[styles.clearButton, !itemsCount && styles.clearButtonDisabled]}>
          <ThemedText style={styles.clearButtonText}>Wyczyść</ThemedText>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, !itemsCount && styles.emptyList]}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => removeById(item.id)}
            style={({ pressed }) => [styles.rowPressable, pressed && styles.rowPressed]}>
            <RowCard>
              <ThemedText type="defaultSemiBold">{item.friendlyName}</ThemedText>
              <ThemedText style={styles.rowTimestamp}>
                {new Date(item.timestamp).toLocaleString()}
              </ThemedText>
              <ThemedText style={styles.rowCode}>{item.code}</ThemedText>
              <ThemedText style={styles.rowMeta}>
                Format: {item.labelType ?? 'nieznany'}
              </ThemedText>
            </RowCard>
          </Pressable>
        )}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>
            Brak wpisów. Przejdź do zakładki Skaner i zeskanuj kod.
          </ThemedText>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counter: {
    minWidth: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
  },
  counterText: {
    color: '#fff',
    fontWeight: '700',
  },
  actions: {
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
  },
  clearButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#dc2626',
  },
  clearButtonDisabled: {
    opacity: 0.4,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 24,
  },
  rowPressable: {
    borderRadius: 12,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rowTimestamp: {
    fontSize: 12,
    marginTop: 4,
    color: '#6b7280',
  },
  rowCode: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  rowMeta: {
    fontSize: 12,
    marginTop: 4,
    color: '#6b7280',
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
  },
});

const RowCard = ({ children }: PropsWithChildren) => (
  <ThemedView lightColor="#fff" darkColor="#1f2937" style={styles.rowCard}>
    {children}
  </ThemedView>
);
