import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type SettingsState = {
  serverBaseUrl: string;
  apiKey: string;
};

type SettingsContextValue = {
  serverBaseUrl: string;
  apiKey: string;
  setServerBaseUrl: (value: string) => void;
  setApiKey: (value: string) => void;
  hydrated: boolean;
};

const STORAGE_KEY = 'tslscaner.settings.v1';

const SettingsContext = createContext<SettingsContextValue>({
  serverBaseUrl: '',
  apiKey: '',
  setServerBaseUrl: () => undefined,
  setApiKey: () => undefined,
  hydrated: false,
});

export const SettingsProvider = ({ children }: PropsWithChildren) => {
  const [serverBaseUrl, setServerBaseUrlState] = useState('');
  const [apiKey, setApiKeyState] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && mounted) {
          const parsed: Partial<SettingsState> = JSON.parse(raw);
          if (typeof parsed.serverBaseUrl === 'string') {
            setServerBaseUrlState(parsed.serverBaseUrl);
          }
          if (typeof parsed.apiKey === 'string') {
            setApiKeyState(parsed.apiKey);
          }
        }
      } catch (err) {
        console.warn('Failed to hydrate settings', err);
      } finally {
        if (mounted) {
          setHydrated(true);
        }
      }
    };
    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const persist = async () => {
      try {
        const payload: SettingsState = { serverBaseUrl, apiKey };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.warn('Failed to persist settings', err);
      }
    };
    persist();
  }, [hydrated, serverBaseUrl, apiKey]);

  const setServerBaseUrl = useCallback((value: string) => {
    setServerBaseUrlState(value);
  }, []);
  const setApiKey = useCallback((value: string) => {
    setApiKeyState(value);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      serverBaseUrl,
      apiKey,
      setServerBaseUrl,
      setApiKey,
      hydrated,
    }),
    [hydrated, serverBaseUrl, apiKey, setServerBaseUrl, setApiKey],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);
