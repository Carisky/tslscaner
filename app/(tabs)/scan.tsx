import { PropsWithChildren, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScanSession } from '@/providers/scan-provider';

const statusTextMap: Record<string, string> = {
  idle: 'Инициализация слушателя DataWedge…',
  listening: 'Сканер готов принимать данные',
  unsupported: 'Поддерживается только на Android / Zebra',
  error: 'Ошибка связи с DataWedge',
};

export default function ScanScreen() {
  const {
    status,
    error,
    lastScan,
    addManualScan,
    softTrigger,
    debugLog,
    clearDebugLog,
    requestProfileConfig,
    requestProfilesList,
    enumerateScanners,
    rebuildProfile,
    secureAccess,
    registerUsage,
    unregisterUsage,
    signatureConfigured,
    packageName,
    datawedgeSignature,
  } = useScanSession();
  const [manualValue, setManualValue] = useState('');

  const disableManualAdd = !manualValue.trim().length;

  const handleManualAdd = () => {
    if (disableManualAdd) return;
    addManualScan(manualValue);
    setManualValue('');
  };

  const friendlyStatus = statusTextMap[status] ?? status;
  const debugEntries = useMemo(() => debugLog.slice(0, 15), [debugLog]);
  const secureStatusTextMap: Record<string, string> = {
    missing_signature: 'Нет подписи для Secure Intent API',
    unknown: 'Ждём регистрации в Secure Intent API',
    registering: 'Отправили запрос на доступ...',
    granted: 'Доступ к Secure Intent API получен',
    denied: 'Доступ к Secure Intent API отклонён',
  };
  const secureStatusText = secureStatusTextMap[secureAccess] ?? secureAccess;
  const signaturePreview = datawedgeSignature
    ? datawedgeSignature.length > 16
      ? `${datawedgeSignature.slice(0, 8)}…${datawedgeSignature.slice(-8)}`
      : datawedgeSignature
    : 'не задана';
  const renderPayload = (payload: unknown) => {
    if (payload === null) return 'null';
    if (payload === undefined) return 'undefined';
    if (typeof payload === 'string') return payload;
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <ThemedText type="title">Scan</ThemedText>
          <ThemedText style={styles.status}>{friendlyStatus}</ThemedText>
          {error && <ThemedText style={styles.error}>{error}</ThemedText>}
          <ThemedText style={styles.helper}>
            Убедись, что профиль DataWedge активен и привязан к действию{' '}
            <ThemedText type="defaultSemiBold">com.tslscaner.SCAN</ThemedText>. Нажмите
            аппаратный триггер или кнопки ниже, чтобы получить чтение QR/Bar.
          </ThemedText>
        </Card>

        <Card>
          <ThemedText type="subtitle">Последнее чтение</ThemedText>
          {lastScan ? (
            <View style={styles.lastScan}>
              <ThemedText style={styles.scanValue}>{lastScan.code}</ThemedText>
              <ThemedText style={styles.scanMeta}>
                {lastScan.friendlyName} · {new Date(lastScan.timestamp).toLocaleTimeString()}
              </ThemedText>
              <ThemedText style={styles.scanMeta}>
                Формат: {lastScan.labelType ?? 'неизвестно'}
              </ThemedText>
            </View>
          ) : (
            <ThemedText>Список сканов пока пуст.</ThemedText>
          )}
        </Card>

        <Card>
          <ThemedText type="subtitle">Управление триггером</ThemedText>
          <View style={styles.buttonRow}>
            <ActionButton label="Старт" onPress={() => softTrigger('start')} />
            <ActionButton label="Стоп" onPress={() => softTrigger('stop')} />
            <ActionButton label="Toggle" onPress={() => softTrigger('toggle')} />
          </View>
          <ThemedText style={styles.helper}>
            Эти команды используют DataWedge Soft Scan Trigger. Основной способ работы — физическая
            кнопка на Zebra MC9300.
          </ThemedText>
        </Card>

        <Card>
          <ThemedText type="subtitle">Ручной ввод (для теста)</ThemedText>
          <TextInput
            value={manualValue}
            onChangeText={setManualValue}
            placeholder="Вставьте код, чтобы эмулировать скан"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            editable={status !== 'unsupported'}
          />
          <ActionButton label="Добавить" disabled={disableManualAdd} onPress={handleManualAdd} />
          {Platform.OS !== 'android' && (
            <ThemedText style={styles.helper}>
              На эмуляторах и iOS данные можно заносить только вручную.
            </ThemedText>
          )}
        </Card>

        <Card>
          <ThemedText type="subtitle">Debug / DataWedge</ThemedText>
          <ThemedText style={styles.helper}>
            Secure Intent: {secureStatusText}. Package:{' '}
            <ThemedText type="defaultSemiBold">{packageName}</ThemedText>. Подпись:{' '}
            {signatureConfigured ? signaturePreview : 'отсутствует (EXPO_PUBLIC_DATAWEDGE_SIGNATURE)'}.
          </ThemedText>
          <View style={styles.buttonRow}>
            <ActionButton label="Register" onPress={registerUsage} disabled={!signatureConfigured} />
            <ActionButton label="Unregister" onPress={unregisterUsage} />
          </View>
          <View style={styles.buttonRow}>
            <ActionButton label="Dump Config" onPress={requestProfileConfig} />
            <ActionButton label="List Profiles" onPress={requestProfilesList} />
            <ActionButton label="Enumerate" onPress={enumerateScanners} />
          </View>
          <View style={styles.buttonRow}>
            <ActionButton label="Rebuild" onPress={rebuildProfile} />
            <ActionButton label="Clear Debug" onPress={clearDebugLog} />
          </View>
          <ThemedText style={styles.debugTitle}>Last intents</ThemedText>
          {debugEntries.length === 0 ? (
            <ThemedText style={styles.helper}>Ещё нет событий от DataWedge.</ThemedText>
          ) : (
            debugEntries.map((entry) => (
              <View key={entry.id} style={styles.debugEntry}>
                <ThemedText style={styles.debugEntryTitle}>
                  {new Date(entry.timestamp).toLocaleTimeString()} · {entry.type.toUpperCase()} ·{' '}
                  {entry.source}
                </ThemedText>
                {entry.summary && <ThemedText style={styles.debugSummary}>{entry.summary}</ThemedText>}
                <ScrollView horizontal style={styles.debugPayloadContainer}>
                  <ThemedText style={styles.debugPayload}>{renderPayload(entry.payload)}</ThemedText>
                </ScrollView>
              </View>
            ))
          )}
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
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  debugTitle: {
    marginTop: 16,
    fontWeight: '600',
  },
  debugEntry: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  debugEntryTitle: {
    fontSize: 12,
    color: '#4b5563',
  },
  debugSummary: {
    fontSize: 12,
    color: '#111827',
  },
  debugPayloadContainer: {
    maxHeight: 160,
  },
  debugPayload: {
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Courier' }),
  },
});

const Card = ({ children }: PropsWithChildren) => (
  <ThemedView lightColor="#fff" darkColor="#1f2937" style={styles.card}>
    {children}
  </ThemedView>
);
