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
const REGISTER_FOR_USAGE_COMMAND = 'com.symbol.datawedge.api.REGISTER_FOR_USAGE';
const UNREGISTER_FOR_USAGE_COMMAND = 'com.symbol.datawedge.api.UNREGISTER_FOR_USAGE';
const DEBUG_LOG_LIMIT = 50;

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
type IntentOrigin = 'datawedge_broadcast_intent' | 'barcode_scan';
type SecureAccessState = 'unknown' | 'missing_signature' | 'registering' | 'granted' | 'denied';
type DebugEntryType = 'command' | 'intent' | 'result' | 'error' | 'info';

export type DebugEntry = {
  id: string;
  timestamp: string;
  type: DebugEntryType;
  source: string;
  summary?: string;
  payload?: unknown;
};

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
  debugLog: DebugEntry[];
  clearDebugLog: () => void;
  requestProfileConfig: () => void;
  requestProfilesList: () => void;
  enumerateScanners: () => void;
  rebuildProfile: () => void;
  secureAccess: SecureAccessState;
  registerUsage: () => void;
  unregisterUsage: () => void;
  signatureConfigured: boolean;
  packageName: string;
  datawedgeSignature: string | null;
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
  debugLog: [],
  clearDebugLog: () => undefined,
  requestProfileConfig: () => undefined,
  requestProfilesList: () => undefined,
  enumerateScanners: () => undefined,
  rebuildProfile: () => undefined,
  secureAccess: 'unknown',
  registerUsage: () => undefined,
  unregisterUsage: () => undefined,
  signatureConfigured: false,
  packageName: 'com.example.app',
  datawedgeSignature: null,
};

const ScanContext = createContext<ScanContextValue>(defaultContext);

const pad = (input: number) => input.toString().padStart(2, '0');
const buildFriendlyName = (date: Date) => `scan_${pad(date.getDate())}_${pad(date.getHours())}`;

const readStringExtra = (intent: Record<string, unknown>, key: string) => {
  const value = intent[key];
  return typeof value === 'string' ? value : undefined;
};

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
  const packageName = useMemo(() => guessPackageName(), []);
  const expoExtras = (Constants.expoConfig?.extra ?? {}) as { datawedgeSignature?: string };
  const configSignature =
    typeof expoExtras?.datawedgeSignature === 'string' ? expoExtras.datawedgeSignature : undefined;
  const datawedgeSignature =
    configSignature ?? process.env.EXPO_PUBLIC_DATAWEDGE_SIGNATURE ?? null;
  const signatureConfigured =
    Platform.OS !== 'android' ? true : !!(datawedgeSignature && datawedgeSignature.length > 0);
  const [secureAccess, setSecureAccess] = useState<SecureAccessState>(() => {
    if (Platform.OS !== 'android') {
      return 'granted';
    }
    if (!signatureConfigured) {
      return 'missing_signature';
    }
    return 'unknown';
  });
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);

  const pushDebugEntry = useCallback((entry: Omit<DebugEntry, 'id' | 'timestamp'>) => {
    const timestamp = new Date().toISOString();
    setDebugLog((prev) => [
      {
        ...entry,
        timestamp,
        id: `${timestamp}_${Math.random().toString(36).slice(2, 6)}`,
      },
      ...prev,
    ].slice(0, DEBUG_LOG_LIMIT));
  }, []);

  const clearDebugLog = useCallback(() => setDebugLog([]), []);

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
    (intent: Record<string, unknown> = {}, origin: IntentOrigin) => {
      pushDebugEntry({ type: 'intent', source: origin, payload: intent });

      const command = readStringExtra(intent, 'COMMAND');
      const resultCode = readStringExtra(intent, 'RESULT') ?? readStringExtra(intent, 'RESULT_CODE');
      const resultInfo = intent['RESULT_INFO'] as Record<string, unknown> | undefined;
      if (command || resultCode || resultInfo) {
        const normalizedCommand = command?.toLowerCase();
        const normalizedResult = resultCode?.toUpperCase();
        if (normalizedCommand === REGISTER_FOR_USAGE_COMMAND.toLowerCase()) {
          if (normalizedResult === 'SUCCESS') {
            setSecureAccess('granted');
          } else if (normalizedResult) {
            setSecureAccess('denied');
          }
        }
        if (normalizedCommand === UNREGISTER_FOR_USAGE_COMMAND.toLowerCase()) {
          if (normalizedResult === 'SUCCESS') {
            setSecureAccess(signatureConfigured ? 'unknown' : 'missing_signature');
          }
        }

        pushDebugEntry({
          type: 'result',
          source: origin,
          summary: `${command ?? 'unknown command'} => ${resultCode ?? 'unknown result'}`,
          payload: resultInfo ?? intent,
        });
        return;
      }

      const maybeData =
        readStringExtra(intent, 'com.symbol.datawedge.data_string') ??
        readStringExtra(intent, 'data_string') ??
        readStringExtra(intent, 'DATA_STRING') ??
        readStringExtra(intent, 'data');
      const raw = intent;

      if (!maybeData) {
        pushDebugEntry({
          type: 'info',
          source: origin,
          summary: 'Intent without data_string',
          payload: intent,
        });
        return;
      }

      const labelType =
        readStringExtra(intent, 'com.symbol.datawedge.label_type') ??
        readStringExtra(intent, 'label_type') ??
        readStringExtra(intent, 'labelType');

      pushDebugEntry({
        type: 'info',
        source: origin,
        summary: `Scan payload (${labelType ?? 'unknown'})`,
        payload: { code: maybeData, labelType },
      });

      pushScan({
        code: maybeData.trim(),
        labelType,
        source: 'hardware',
        rawIntent: raw,
      });
    },
    [pushDebugEntry, pushScan, signatureConfigured],
  );

  const sendCommand = useCallback(
    (command: string, value: unknown) => {
      pushDebugEntry({
        type: 'command',
        source: 'app',
        summary: `Sending ${command}`,
        payload: value,
      });

      if (!dataWedgeModule) {
        pushDebugEntry({
          type: 'error',
          source: 'app',
          summary: 'DataWedge module unavailable',
        });
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
        const message = (err as Error)?.message ?? 'Failed to talk to DataWedge';
        pushDebugEntry({
          type: 'error',
          source: 'app',
          summary: message,
        });
        setError((prev) => prev ?? message);
        setStatus('error');
      }
    },
    [pushDebugEntry],
  );

  const configureProfile = useCallback(() => {
    if (!dataWedgeModule) return;

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
  }, [packageName, sendCommand]);

  const registerUsage = useCallback(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    if (!signatureConfigured || !datawedgeSignature) {
      setSecureAccess('missing_signature');
      pushDebugEntry({
        type: 'error',
        source: 'app',
        summary: 'Missing DataWedge signature - set EXPO_PUBLIC_DATAWEDGE_SIGNATURE',
      });
      return;
    }

    setSecureAccess('registering');
    sendCommand(REGISTER_FOR_USAGE_COMMAND, {
      PACKAGE_NAME: packageName,
      APP_SIGNATURE: datawedgeSignature,
    });
  }, [datawedgeSignature, packageName, pushDebugEntry, sendCommand, signatureConfigured]);

  const unregisterUsage = useCallback(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    setSecureAccess('registering');
    const payload: Record<string, string> = {
      PACKAGE_NAME: packageName,
    };
    if (datawedgeSignature) {
      payload.APP_SIGNATURE = datawedgeSignature;
    }
    sendCommand(UNREGISTER_FOR_USAGE_COMMAND, payload);
  }, [datawedgeSignature, packageName, sendCommand]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    if (!dataWedgeModule) {
      setStatus('error');
      setError(
        'DataWedge runtime is not available. Ensure react-native-datawedge-intents is installed on Android.',
      );
      return;
    }

    let subscriptions: EmitterSubscription[] = [];

    try {
      dataWedgeModule.registerBroadcastReceiver({
        filterActions: [SCAN_INTENT_ACTION, DATAWEDGE_RESULT_ACTION],
        filterCategories: ['android.intent.category.DEFAULT'],
      });

      subscriptions = [
        DeviceEventEmitter.addListener('datawedge_broadcast_intent', (intent) =>
          handleIntent(intent, 'datawedge_broadcast_intent'),
        ),
        DeviceEventEmitter.addListener('barcode_scan', (intent) =>
          handleIntent(intent, 'barcode_scan'),
        ),
      ];
    } catch (err) {
      setStatus('error');
      setError((err as Error)?.message ?? 'Failed to register broadcast receiver for DataWedge');
    }

    return () => {
      subscriptions.forEach((sub) => sub.remove());
    };
  }, [handleIntent]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    if (!dataWedgeModule) {
      return;
    }
    if (secureAccess !== 'granted') {
      return;
    }

    configureProfile();
    setStatus((prev) => (prev === 'error' ? prev : 'listening'));
  }, [configureProfile, secureAccess]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    if (!signatureConfigured) {
      return;
    }
    if (secureAccess !== 'unknown') {
      return;
    }

    registerUsage();
  }, [registerUsage, secureAccess, signatureConfigured]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    if (secureAccess === 'missing_signature') {
      const message =
        'DataWedge secure intent signature is not configured. Set EXPO_PUBLIC_DATAWEDGE_SIGNATURE or expo.extra.datawedgeSignature.';
      setStatus('error');
      setError(message);
    } else if (secureAccess === 'denied') {
      const message =
        'DataWedge denied secure intent registration. Approve this package & signature in DataWedge secure intent settings.';
      setStatus('error');
      setError(message);
    } else if (secureAccess === 'granted') {
      setError((prev) => (prev && prev.startsWith('DataWedge ') ? null : prev));
    }
  }, [secureAccess]);

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

  const requestProfileConfig = useCallback(() => {
    sendCommand('com.symbol.datawedge.api.GET_CONFIG', {
      PROFILE_NAME: PROFILE_NAME,
      PROFILE_ENABLED: 'true',
    });
  }, [sendCommand]);

  const requestProfilesList = useCallback(() => {
    sendCommand('com.symbol.datawedge.api.GET_PROFILES_LIST', '');
  }, [sendCommand]);

  const enumerateScanners = useCallback(() => {
    sendCommand('com.symbol.datawedge.api.ENUMERATE_SCANNERS', '');
  }, [sendCommand]);

  const rebuildProfile = useCallback(() => {
    configureProfile();
    pushDebugEntry({
      type: 'info',
      source: 'app',
      summary: 'Profile configuration requested',
    });
  }, [configureProfile, pushDebugEntry]);

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
    }),
    [
      addManualScan,
      clearAll,
      clearDebugLog,
      debugLog,
      enumerateScanners,
      error,
      items,
      packageName,
      rebuildProfile,
      registerUsage,
      removeById,
      requestProfileConfig,
      requestProfilesList,
      secureAccess,
      signatureConfigured,
      softTrigger,
      status,
      unregisterUsage,
      datawedgeSignature,
    ],
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
};

export const useScanSession = () => useContext(ScanContext);
