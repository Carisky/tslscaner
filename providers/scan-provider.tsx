import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
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

const PROFILE_NAME = 'TSLScanProfile';
const SCAN_INTENT_ACTION = 'com.tslscaner.SCAN';
const DATAWEDGE_ACTION = 'com.symbol.datawedge.api.ACTION';
const DATAWEDGE_RESULT_ACTION = 'com.symbol.datawedge.api.RESULT_ACTION';
const REGISTER_FOR_USAGE_COMMAND = 'com.symbol.datawedge.api.REGISTER_FOR_USAGE';
const STORAGE_KEY = 'tslscaner.scanItems.v1';

type DataWedgeModule = {
  registerBroadcastReceiver: (config: {
    filterActions: string[];
    filterCategories?: string[];
  }) => void;
  sendBroadcastWithExtras: (config: { action: string; extras?: Record<string, unknown> }) => void;
};

const dataWedgeModule: DataWedgeModule | null =
  Platform.OS === 'android' ? require('react-native-datawedge-intents') : null;

type ScanSource = 'hardware';

type SecureAccessState = 'unknown' | 'missing_signature' | 'registering' | 'granted' | 'denied';

type ScanStatus = 'idle' | 'listening' | 'unsupported' | 'error';

type ScanContextValue = {
  items: ScanItem[];
  status: ScanStatus;
  error: string | null;
  lastScan: ScanItem | null;
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

const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;
const WINDOWS_1250_TABLE: number[] = [
  0x20ac, 0x0081, 0x201a, 0x0083, 0x201e, 0x2026, 0x2020, 0x2021, 0x0088, 0x2030, 0x0160, 0x2039,
  0x015a, 0x0164, 0x017d, 0x0179, 0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x0098, 0x2122, 0x0161, 0x203a, 0x015b, 0x0165, 0x017e, 0x017a, 0x00a0, 0x02c7, 0x02d8, 0x0141,
  0x00a4, 0x0104, 0x00a6, 0x00a7, 0x00a8, 0x00a9, 0x015e, 0x00ab, 0x00ac, 0x00ad, 0x00ae, 0x017b,
  0x00b0, 0x00b1, 0x02db, 0x0142, 0x00b4, 0x00b5, 0x00b6, 0x00b7, 0x00b8, 0x0105, 0x015f, 0x00bb,
  0x013d, 0x02dd, 0x013e, 0x017c, 0x0154, 0x00c1, 0x00c2, 0x0102, 0x00c4, 0x0139, 0x0106, 0x00c7,
  0x010c, 0x00c9, 0x0118, 0x00cb, 0x011a, 0x00cd, 0x00ce, 0x010e, 0x0110, 0x0143, 0x0147, 0x00d3,
  0x00d4, 0x0150, 0x00d6, 0x00d7, 0x0158, 0x016e, 0x00da, 0x0170, 0x00dc, 0x00dd, 0x0162, 0x00df,
  0x0155, 0x00e1, 0x00e2, 0x0103, 0x00e4, 0x013a, 0x0107, 0x00e7, 0x010d, 0x00e9, 0x0119, 0x00eb,
  0x011b, 0x00ed, 0x00ee, 0x010f, 0x0111, 0x0144, 0x0148, 0x00f3, 0x00f4, 0x0151, 0x00f6, 0x00f7,
  0x0159, 0x016f, 0x00fa, 0x0171, 0x00fc, 0x00fd, 0x0163, 0x02d9,
];

const collectNumericBytes = (input: unknown): number[] => {
  if (input == null) {
    return [];
  }
  const stack: unknown[] = [input];
  const bytes: number[] = [];
  while (stack.length) {
    const current = stack.pop();
    if (current == null) {
      continue;
    }
    if (Array.isArray(current)) {
      for (let idx = current.length - 1; idx >= 0; idx -= 1) {
        stack.push(current[idx]);
      }
    } else if (typeof current === 'number' && Number.isFinite(current)) {
      const normalized = ((Math.trunc(current) % 256) + 256) % 256;
      bytes.push(normalized);
    }
  }
  return bytes;
};

const decodeUtf8Bytes = (bytes: number[]) => {
  let result = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const byte1 = bytes[i];
    if (byte1 < 0x80) {
      result += String.fromCharCode(byte1);
      continue;
    }
    if (byte1 >= 0xc2 && byte1 <= 0xdf) {
      const byte2 = bytes[i + 1];
      if (byte2 === undefined) {
        result += '�';
        break;
      }
      i += 1;
      const codePoint = ((byte1 & 0x1f) << 6) | (byte2 & 0x3f);
      result += String.fromCharCode(codePoint);
      continue;
    }
    if (byte1 >= 0xe0 && byte1 <= 0xef) {
      const byte2 = bytes[i + 1];
      const byte3 = bytes[i + 2];
      if (byte2 === undefined || byte3 === undefined) {
        result += '�';
        break;
      }
      i += 2;
      const codePoint =
        ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f);
      result += String.fromCharCode(codePoint);
      continue;
    }
    if (byte1 >= 0xf0 && byte1 <= 0xf4) {
      const byte2 = bytes[i + 1];
      const byte3 = bytes[i + 2];
      const byte4 = bytes[i + 3];
      if (byte2 === undefined || byte3 === undefined || byte4 === undefined) {
        result += '�';
        break;
      }
      i += 3;
      const codePoint =
        ((byte1 & 0x07) << 18) |
        ((byte2 & 0x3f) << 12) |
        ((byte3 & 0x3f) << 6) |
        (byte4 & 0x3f);
      if (codePoint <= 0xffff) {
        result += String.fromCharCode(codePoint);
      } else {
        result += String.fromCodePoint(codePoint);
      }
      continue;
    }
    result += '�';
  }
  return result;
};

const decodeWindows1250Bytes = (bytes: number[]) => {
  let result = '';
  for (const byte of bytes) {
    if (byte < 0x80) {
      result += String.fromCharCode(byte);
    } else {
      const mapped = WINDOWS_1250_TABLE[byte - 0x80];
      result += String.fromCharCode(mapped ?? byte);
    }
  }
  return result;
};

const sanitizePrintable = (value: string) => value.replace(CONTROL_CHARS_REGEX, '').trim();

const REPLACEMENT_CHAR_REGEX = /\uFFFD/g;

const evaluateCandidate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  const sanitized = sanitizePrintable(value);
  if (!sanitized.length) {
    return null;
  }
  const replacementCount = (sanitized.match(REPLACEMENT_CHAR_REGEX) ?? []).length;
  const score = sanitized.length - replacementCount * 5;
  return { value: sanitized, score };
};

const stripCorruptedSegments = (value: string) => {
  const parts = value.split(';');
  const sanitized: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.length) {
      sanitized.push(trimmed);
      continue;
    }

    const idx = trimmed.indexOf(':');
    if (idx === -1) {
      sanitized.push(trimmed);
      continue;
    }

    const left = trimmed.slice(0, idx);
    const right = trimmed.slice(idx + 1);
    const leftHasReplacement = left.includes('\uFFFD');
    const rightHasReplacement = right.includes('\uFFFD');

    if (leftHasReplacement && !rightHasReplacement) {
      sanitized.push(right.trim());
    } else if (!leftHasReplacement && rightHasReplacement) {
      sanitized.push(left.trim());
    } else {
      sanitized.push(trimmed.replace(REPLACEMENT_CHAR_REGEX, ''));
    }
  }

  return sanitized.filter((item) => item.length).join('; ');
};

const normalizeScannedValue = (intent: Record<string, unknown>, fallback: string) => {
  const possibleKeys = [
    'com.symbol.datawedge.decode_data',
    'decode_data',
    'com.symbol.datawedge.raw_data',
    'raw_data',
  ] as const;
  const fallbackTrimmed = fallback.trim();
  const fallbackCandidate =
    evaluateCandidate(fallbackTrimmed) ??
    (fallbackTrimmed.length ? { value: fallbackTrimmed, score: fallbackTrimmed.length } : null);
  let bestCandidate = fallbackCandidate;
  for (const key of possibleKeys) {
    const bytes = collectNumericBytes(intent[key]);
    if (!bytes.length) {
      continue;
    }
    const utfCandidate = evaluateCandidate(decodeUtf8Bytes(bytes));
    if (utfCandidate && (!bestCandidate || utfCandidate.score > bestCandidate.score)) {
      bestCandidate = utfCandidate;
    }
    const altCandidate = evaluateCandidate(decodeWindows1250Bytes(bytes));
    if (altCandidate && (!bestCandidate || altCandidate.score > bestCandidate.score)) {
      bestCandidate = altCandidate;
    }
  }
  const resolved = bestCandidate?.value ?? fallbackTrimmed;
  return stripCorruptedSegments(resolved);
};

export const ScanProvider = ({ children }: PropsWithChildren) => {
  const [items, setItems] = useState<ScanItem[]>([]);
  const [status, setStatus] = useState<ScanStatus>(
    Platform.OS === 'android' ? 'idle' : 'unsupported',
  );
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

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

      const normalizedCode = normalizeScannedValue(intent, maybeData);

      pushScan({
        code: normalizedCode,
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
      setError((prev) => prev ?? (err as Error)?.message ?? 'Nie udało się nawiązać komunikacji z DataWedge');
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
    let cancelled = false;
    const hydrate = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && !cancelled) {
          const parsed = JSON.parse(stored) as ScanItem[];
          if (Array.isArray(parsed)) {
            setItems(parsed);
          }
        }
      } catch (err) {
        console.warn('Failed to hydrate scans', err);
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const persist = async () => {
      try {
        const payload = JSON.stringify(
          items.map(({ rawIntent, ...rest }) => rest),
        );
        await AsyncStorage.setItem(STORAGE_KEY, payload);
      } catch (err) {
        console.warn('Failed to persist scans', err);
      }
    };
    persist();
  }, [hydrated, items]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    if (!dataWedgeModule) {
      setStatus('error');
      setError('Środowisko DataWedge jest niedostępne. Upewnij się, że react-native-datawedge-intents jest zainstalowany na Androidzie.');
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
      ];
    } catch (err) {
      setStatus('error');
      setError((err as Error)?.message ?? 'Nie udało się zarejestrować odbiornika DataWedge');
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
      setError('Brakuje podpisu DataWedge');
    } else if (secureAccess === 'denied') {
      setStatus('error');
      setError('Odmowa dostępu dla aplikacji');
    }
  }, [secureAccess]);

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
      removeById,
      clearAll,
      softTrigger,
      itemsCount: items.length,
    }),
    [clearAll, error, items, removeById, softTrigger, status],
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
};

export const useScanSession = () => useContext(ScanContext);
