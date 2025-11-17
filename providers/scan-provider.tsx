import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DeviceEventEmitter, EmitterSubscription, Platform } from 'react-native';
import Constants from 'expo-constants';

const PROFILE_NAME = 'TSLScanProfile';
const SCAN_INTENT_ACTION = 'com.tslscaner.SCAN';
const DATAWEDGE_ACTION = 'com.symbol.datawedge.api.ACTION';
const DATAWEDGE_RESULT_ACTION = 'com.symbol.datawedge.api.RESULT_ACTION';

type DataWedgeModule = {
  registerBroadcastReceiver: (config: {
    filterActions: string[];
    filterCategories?: string[];
  }) => void;
  sendBroadcastWithExtras: (config: { action: string; extras?: Record<string, unknown> }) => void;
};

const dataWedgeModule: DataWedgeModule | null =
  Platform.OS === 'android' ? require('react-native-datawedge-intents') : null;

type ScanSource = 'hardware' | 'manual';

export type ScanItem = {
  id: string;
  code: string;
  timestamp: string;
  friendlyName: string;
  labelType?: string;
  source: ScanSource;
  rawIntent?: Record<string, unknown>;
};

type ScanStatus = 'idle' | 'listening' | 'unsupported' | 'error';

type ScanContextValue = {
  items: ScanItem[];
  status: ScanStatus;
  error: string | null;
  lastScan: ScanItem | null;
  addManualScan: (code: string, labelType?: string) => void;
  removeById: (id: string) => void;
  clearAll: () => void;
  softTrigger: (mode?: 'start' | 'stop' | 'toggle') => void;
  itemsCount: number;
};

const defaultContext: ScanContextValue = {
  items: [],
  status: Platform.OS === 'android' ? 'idle' : 'unsupported',
  error: null,
  lastScan: null,
  addManualScan: () => undefined,
  removeById: () => undefined,
  clearAll: () => undefined,
  softTrigger: () => undefined,
  itemsCount: 0,
};

const ScanContext = createContext<ScanContextValue>(defaultContext);

const pad = (input: number) => input.toString().padStart(2, '0');

const buildFriendlyName = (date: Date) => `scan_${pad(date.getDate())}_${pad(date.getHours())}`;

const guessPackageName = () => {
  const explicitPkg = Constants.expoConfig?.android?.package;
  if (explicitPkg) return explicitPkg;
  if (Constants.expoConfig?.slug) {
    return `com.${Constants.expoConfig.slug}`;
  }
  return 'com.tslscaner.app';
};

export const ScanProvider = ({ children }: PropsWithChildren) => {
  const [items, setItems] = useState<ScanItem[]>([]);
  const [status, setStatus] = useState<ScanStatus>(
    Platform.OS === 'android' ? 'idle' : 'unsupported',
  );
  const [error, setError] = useState<string | null>(null);

  const pushScan = useCallback((payload: Omit<ScanItem, 'id' | 'timestamp' | 'friendlyName'>) => {
    const now = new Date();
    const item: ScanItem = {
      ...payload,
      id: `${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now.toISOString(),
      friendlyName: buildFriendlyName(now),
    };
    setItems((prev) => [item, ...prev]);
  }, []);

  const handleIntent = useCallback(
    (intent: Record<string, unknown> = {}) => {
      const maybeData =
        (intent['com.symbol.datawedge.data_string'] as string | undefined) ??
        (intent['data_string'] as string | undefined) ??
        (intent['DATA_STRING'] as string | undefined);
      const raw = intent;

      if (!maybeData) {
        return;
      }

      const labelType =
        (intent['com.symbol.datawedge.label_type'] as string | undefined) ??
        (intent['label_type'] as string | undefined);

      pushScan({
        code: maybeData.trim(),
        labelType,
        source: 'hardware',
        rawIntent: raw,
      });
    },
    [pushScan],
  );

  const sendCommand = useCallback((command: string, value: unknown) => {
    if (!dataWedgeModule) {
      return;
    }

    try {
      const extras: Record<string, unknown> = {
        [command]: value,
        SEND_RESULT: 'LAST_RESULT',
      };

      dataWedgeModule.sendBroadcastWithExtras({
        action: DATAWEDGE_ACTION,
        extras,
      });
    } catch (err) {
      setError((prev) => prev ?? (err as Error)?.message ?? 'Failed to talk to DataWedge');
      setStatus('error');
    }
  }, []);

  const configureProfile = useCallback(() => {
    if (!dataWedgeModule) return;

    const packageName = guessPackageName();

    sendCommand('com.symbol.datawedge.api.CREATE_PROFILE', PROFILE_NAME);

    sendCommand('com.symbol.datawedge.api.SET_CONFIG', {
      PROFILE_NAME: PROFILE_NAME,
      PROFILE_ENABLED: 'true',
      CONFIG_MODE: 'UPDATE',
      PLUGIN_CONFIG: {
        PLUGIN_NAME: 'BARCODE',
        RESET_CONFIG: 'true',
        PARAM_LIST: {
          scanner_selection: 'auto',
          decoder_qr: 'true',
          decoder_code128: 'true',
          decoder_code39: 'true',
          decoder_ean13: 'true',
          decoder_ean8: 'true',
        },
      },
    });

    sendCommand('com.symbol.datawedge.api.SET_CONFIG', {
      PROFILE_NAME: PROFILE_NAME,
      PROFILE_ENABLED: 'true',
      CONFIG_MODE: 'UPDATE',
      PLUGIN_CONFIG: {
        PLUGIN_NAME: 'INTENT',
        RESET_CONFIG: 'true',
        PARAM_LIST: {
          intent_output_enabled: 'true',
          intent_action: SCAN_INTENT_ACTION,
          intent_delivery: 'BROADCAST',
        },
      },
      APP_LIST: [
        {
          PACKAGE_NAME: packageName,
          ACTIVITY_LIST: ['*'],
        },
      ],
    });

    sendCommand('com.symbol.datawedge.api.SET_ACTIVE_PROFILE', PROFILE_NAME);
  }, [sendCommand]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    if (!dataWedgeModule) {
      setStatus('error');
      setError('Модуль DataWedge недоступен. Проверьте зависимость react-native-datawedge-intents.');
      return;
    }

    let subscriptions: EmitterSubscription[] = [];

    try {
      dataWedgeModule.registerBroadcastReceiver({
        filterActions: [SCAN_INTENT_ACTION, DATAWEDGE_RESULT_ACTION],
        filterCategories: ['android.intent.category.DEFAULT'],
      });

      subscriptions = [
        DeviceEventEmitter.addListener('datawedge_broadcast_intent', handleIntent),
        DeviceEventEmitter.addListener('barcode_scan', handleIntent),
      ];

      configureProfile();
      setStatus('listening');
    } catch (err) {
      setStatus('error');
      setError((err as Error)?.message ?? 'Не удалось инициализировать DataWedge');
    }

    return () => {
      subscriptions.forEach((sub) => sub.remove());
    };
  }, [configureProfile, handleIntent]);

  const addManualScan = useCallback(
    (code: string, labelType?: string) => {
      const trimmed = code.trim();
      if (!trimmed.length) {
        return;
      }
      pushScan({
        code: trimmed,
        labelType,
        source: 'manual',
      });
    },
    [pushScan],
  );

  const removeById = useCallback((id: string) => {
    setItems((prev) => prev.filter((scan) => scan.id !== id));
  }, []);

  const clearAll = useCallback(() => setItems([]), []);

  const softTrigger = useCallback(
    (mode: 'start' | 'stop' | 'toggle' = 'toggle') => {
      if (!dataWedgeModule) return;

      const command =
        mode === 'start'
          ? 'START_SCANNING'
          : mode === 'stop'
            ? 'STOP_SCANNING'
            : 'TOGGLE_SCANNING';
      sendCommand('com.symbol.datawedge.api.SOFT_SCAN_TRIGGER', command);
    },
    [sendCommand],
  );

  const value = useMemo<ScanContextValue>(
    () => ({
      items,
      lastScan: items.length ? items[0] : null,
      status,
      error,
      addManualScan,
      removeById,
      clearAll,
      softTrigger,
      itemsCount: items.length,
    }),
    [addManualScan, clearAll, error, items, removeById, softTrigger, status],
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
};

export const useScanSession = () => useContext(ScanContext);
