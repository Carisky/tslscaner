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

type SecureAccessState = 'unknown' | 'missing_signature' | 'registering' | 'granted' | 'denied';

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

export type ScanItem = {
  id: string;
  code: string;
  timestamp: string;
  friendlyName: string;
  labelType?: string;
  source: ScanSource;
  rawIntent?: Record<string, unknown>;
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
    configSignature ?? process.env?.EXPO_PUBLIC_DATAWEDGE_SIGNATURE ?? null;
  const signatureConfigured =
    Platform.OS !== 'android' ? true : Boolean(datawedgeSignature && datawedgeSignature.length > 0);

  const [secureAccess, setSecureAccess] = useState<SecureAccessState>(() => {
    if (Platform.OS !== 'android') {
      return 'granted';
    }
    if (!signatureConfigured) {
      return 'missing_signature';
    }
    return 'unknown';
  });

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
      const command = readStringExtra(intent, 'COMMAND');
      const resultCode = readStringExtra(intent, 'RESULT') ?? readStringExtra(intent, 'RESULT_CODE');
      if (command || resultCode || intent['RESULT_INFO']) {
        const normalizedCommand = command?.toLowerCase();
        const normalizedResult = resultCode?.toUpperCase();
        if (normalizedCommand === REGISTER_FOR_USAGE_COMMAND.toLowerCase()) {
          if (normalizedResult === 'SUCCESS') {
            setSecureAccess('granted');
          } else if (normalizedResult) {
            setSecureAccess('denied');
          }
        }
        return;
      }

      const maybeData =
        readStringExtra(intent, 'com.symbol.datawedge.data_string') ??
        readStringExtra(intent, 'data_string') ??
        readStringExtra(intent, 'DATA_STRING') ??
        readStringExtra(intent, 'data');
      if (!maybeData) {
        return;
      }

      const labelType =
        readStringExtra(intent, 'com.symbol.datawedge.label_type') ??
        readStringExtra(intent, 'label_type') ??
        readStringExtra(intent, 'labelType');

      pushScan({
        code: maybeData.trim(),
        labelType,
        source: 'hardware',
        rawIntent: intent,
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
      setError((prev) => prev ?? (err as Error)?.message ?? 'Failed to communicate with DataWedge');
      setStatus('error');
    }
  }, []);

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
      return;
    }

    setSecureAccess('registering');
    sendCommand(REGISTER_FOR_USAGE_COMMAND, {
      PACKAGE_NAME: packageName,
      APP_SIGNATURE: datawedgeSignature,
    });
  }, [datawedgeSignature, packageName, sendCommand, signatureConfigured]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    if (!dataWedgeModule) {
      setStatus('error');
      setError('DataWedge runtime is not available. Ensure react-native-datawedge-intents is installed on Android.');
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
    setStatus('listening');
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
      setStatus('error');
      setError('DataWedge secure intent signature is not configured. Set EXPO_PUBLIC_DATAWEDGE_SIGNATURE or expo.extra.datawedgeSignature.');
    } else if (secureAccess === 'denied') {
      setStatus('error');
      setError('DataWedge denied secure intent registration. Approve this package & signature in DataWedge secure intent settings.');
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
