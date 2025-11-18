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
};

type SettingsContextValue = {
  serverBaseUrl: string;
  setServerBaseUrl: (value: string) => void;
  hydrated: boolean;
};

const STORAGE_KEY = 'tslscaner.settings.v1';

const SettingsContext = createContext<SettingsContextValue>({
  serverBaseUrl: '',
  setServerBaseUrl: () => undefined,
  hydrated: false,
});

export const SettingsProvider = ({ children }: PropsWithChildren) => {
  const [serverBaseUrl, setServerBaseUrlState] = useState('');
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
        const payload: SettingsState = { serverBaseUrl };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.warn('Failed to persist settings', err);
      }
    };
    persist();
  }, [hydrated, serverBaseUrl]);

  const setServerBaseUrl = useCallback((value: string) => {
    setServerBaseUrlState(value);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      serverBaseUrl,
      setServerBaseUrl,
      hydrated,
    }),
    [hydrated, serverBaseUrl, setServerBaseUrl],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);

