import { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScanSession } from '@/providers/scan-provider';

const statusTextMap: Record<string, string> = {
  idle: 'Inicjalizowanie nasłuchiwania DataWedge...',
  listening: 'Skaner gotowy do pracy',
  unsupported: 'Obsługiwane tylko na Android / Zebra',
  error: 'Błąd komunikacji z DataWedge',
};

export default function ScanScreen() {
  const { status, error, lastScan, softTrigger } = useScanSession();

  const friendlyStatus = statusTextMap[status] ?? status;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <ThemedText type="title">Skaner</ThemedText>
          <ThemedText style={styles.status}>{friendlyStatus}</ThemedText>
          {error && <ThemedText style={styles.error}>{error}</ThemedText>}
          <ThemedText style={styles.helper}>
            Upewnij się, że profil DataWedge jest aktywny i przypisany do działania{' '}
            <ThemedText type="defaultSemiBold">com.tslscaner.SCAN</ThemedText>. Wciśnij
            sprzętowy spust albo użyj przycisków poniżej, aby odebrać kod QR/Bar.
          </ThemedText>
        </Card>

        <Card>
          <ThemedText type="subtitle">Ostatni odczyt</ThemedText>
          {lastScan ? (
            <View style={styles.lastScan}>
              <ThemedText style={styles.scanValue}>{lastScan.code}</ThemedText>
              <ThemedText style={styles.scanMeta}>
                {lastScan.friendlyName} · {new Date(lastScan.timestamp).toLocaleTimeString()}
              </ThemedText>
              <ThemedText style={styles.scanMeta}>
                Format: {lastScan.labelType ?? 'brak danych'}
              </ThemedText>
            </View>
          ) : (
            <ThemedText>Brak zarejestrowanych skanów.</ThemedText>
          )}
        </Card>

        <Card>
          <ThemedText type="subtitle">Sterowanie skanerem</ThemedText>
          <View style={styles.buttonRow}>
            <ActionButton label="Start" onPress={() => softTrigger('start')} />
            <ActionButton label="Stop" onPress={() => softTrigger('stop')} />
            <ActionButton label="Przełącz" onPress={() => softTrigger('toggle')} />
          </View>
          <ThemedText style={styles.helper}>
            Polecenia korzystają z DataWedge Soft Scan Trigger. Docelowo używaj fizycznego
            przycisku w Zebra MC9300.
          </ThemedText>
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const ActionButton = ({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    disabled={disabled}
    onPress={onPress}
    style={[
      styles.button,
      disabled && { opacity: 0.5 },
    ]}>
    <ThemedText style={styles.buttonText}>{label}</ThemedText>
  </Pressable>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  status: {
    marginTop: 4,
    fontSize: 14,
  },
  helper: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  error: {
    marginTop: 6,
    color: '#b91c1c',
  },
  lastScan: {
    marginTop: 12,
  },
  scanValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  scanMeta: {
    fontSize: 12,
    marginTop: 4,
    color: '#6b7280',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#0a7ea4',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

const Card = ({ children }: PropsWithChildren) => (
  <ThemedView lightColor="#fff" darkColor="#1f2937" style={styles.card}>
    {children}
  </ThemedView>
);
