import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

type ReleaseAsset = {
  name?: string;
  browser_download_url?: string;
  content_type?: string;
};

type ReleaseResponse = {
  tag_name?: string;
  name?: string;
  body?: string;
  assets?: ReleaseAsset[];
};

type ParsedRelease = {
  version: string;
  tag: string;
  notes: string;
  assetUrl: string;
  assetName: string;
};

const GITHUB_RELEASE_URL = 'https://api.github.com/repos/Carisky/tslscaner/releases/latest';
const CHECK_INTERVAL_MS = 1000 * 60 * 60 * 4;
const INSTALL_FLAGS = 0x10000000 | 0x00000001;
const STORAGE_KEY_DISMISSED_VERSION = '@tslscaner_dismissed_update_version';
const STORAGE_KEY_INSTALLED_VERSION = '@tslscaner_installed_update_version';

const ensureTrailingSlash = (value: string | null | undefined) =>
  value ? (value.endsWith('/') ? value : `${value}/`) : null;

const normalizeVersion = (input: string) => input.replace(/^v/i, '').trim();
const splitVersion = (value: string) =>
  value
    .split(/[^0-9]+/)
    .map((segment) => Number.parseInt(segment, 10))
    .filter((segment) => Number.isFinite(segment));

const isVersionGreater = (lhs: string, rhs: string) => {
  const lhsParts = splitVersion(lhs);
  const rhsParts = splitVersion(rhs);
  const maxLength = Math.max(lhsParts.length, rhsParts.length);

  for (let idx = 0; idx < maxLength; idx += 1) {
    const left = lhsParts[idx] ?? 0;
    const right = rhsParts[idx] ?? 0;
    if (left > right) {
      return true;
    }
    if (left < right) {
      return false;
    }
  }

  return false;
};

const getCurrentVersion = () =>
  normalizeVersion(Constants.expoConfig?.version ?? Constants.manifest?.version ?? '0.0.0');

const findApkAsset = (assets: ReleaseAsset[] | undefined) => {
  if (!assets?.length) {
    return null;
  }
  return (
    assets.find(
      (asset) =>
        asset.name?.toLowerCase().endsWith('.apk') ||
        asset.content_type === 'application/vnd.android.package-archive',
    ) ?? null
  );
};

export const UpdateChecker = () => {
  const isAndroid = Platform.OS === 'android';
  const currentVersion = useMemo(getCurrentVersion, []);
  const insets = useSafeAreaInsets();
  const [release, setRelease] = useState<ParsedRelease | null>(null);
  const [downloadState, setDownloadState] = useState<
    'idle' | 'downloading' | 'ready' | 'installing' | 'error'
  >('idle');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [downloadedApkUri, setDownloadedApkUri] = useState<string | null>(null);
  const downloadStateRef = useRef<'idle' | 'downloading' | 'ready' | 'installing' | 'error'>(downloadState);

  useEffect(() => {
    downloadStateRef.current = downloadState;
  }, [downloadState]);

  // Загружаем информацию о пропущенной версии при монтировании
  useEffect(() => {
    if (!isAndroid) {
      return;
    }
    
    const loadDismissedVersion = async () => {
      try {
        const dismissed = await AsyncStorage.getItem(STORAGE_KEY_DISMISSED_VERSION);
        const installed = await AsyncStorage.getItem(STORAGE_KEY_INSTALLED_VERSION);
        
        // Если есть установленная версия, используем её как пропущенную
        if (installed) {
          setDismissedVersion(installed);
        } else if (dismissed) {
          setDismissedVersion(dismissed);
        }
      } catch (err) {
        console.warn('Failed to load dismissed version', err);
      }
    };

    loadDismissedVersion();
  }, [isAndroid]);

  useEffect(() => {
    if (!isAndroid) {
      return;
    }
    let cancelled = false;

    const checkRelease = async () => {
      if (
        cancelled ||
        downloadStateRef.current === 'downloading' ||
        downloadStateRef.current === 'installing'
      ) {
        return;
      }

      try {
        const response = await fetch(GITHUB_RELEASE_URL);
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as ReleaseResponse;
        const tagSource = payload.tag_name ?? payload.name ?? '';
        const normalizedTag = normalizeVersion(tagSource);
        if (!normalizedTag || !isVersionGreater(normalizedTag, currentVersion)) {
          return;
        }
        const asset = findApkAsset(payload.assets);
        if (!asset?.browser_download_url) {
          return;
        }
        if (cancelled) {
          return;
        }
        const parsedRelease: ParsedRelease = {
          tag: tagSource,
          version: normalizedTag,
          notes: payload.body ?? '',
          assetUrl: asset.browser_download_url,
          assetName: asset.name ?? `tslscaner-${normalizedTag}.apk`,
        };
        
        // Не показываем обновление, если эта версия уже была установлена или пропущена
        if (dismissedVersion && !isVersionGreater(normalizedTag, dismissedVersion)) {
          return;
        }
        
        setRelease(parsedRelease);
        setDownloadState('idle');
        setErrorMessage(null);
      } catch (err) {
        console.warn('Failed to check GitHub release', err);
      }
    };

    checkRelease();
    const interval = setInterval(checkRelease, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentVersion, isAndroid, dismissedVersion]);

  const downloadAndInstall = useCallback(async () => {
    if (!release) {
      return;
    }

    try {
      setDownloadState('downloading');
      setErrorMessage(null);
      setDownloadProgress(0);

      const documentFallback = ensureTrailingSlash(FileSystem.Paths.document.uri);
      const cacheBase =
        LegacyFileSystem.cacheDirectory ??
        LegacyFileSystem.documentDirectory ??
        documentFallback;
      if (!cacheBase) {
        throw new Error('Unable to locate a writable directory for the downloaded update.');
      }
      const normalizedCache = ensureTrailingSlash(cacheBase) ?? cacheBase;
      const destinationUri = `${normalizedCache}${release.assetName}`;

      await LegacyFileSystem.deleteAsync(destinationUri, { idempotent: true });

      const downloadResumable = LegacyFileSystem.createDownloadResumable(
        release.assetUrl,
        destinationUri,
        undefined,
        (progress) => {
          if (progress.totalBytesExpectedToWrite > 0) {
            setDownloadProgress(
              progress.totalBytesWritten / progress.totalBytesExpectedToWrite,
            );
          }
        },
      );

      const downloadResult = await downloadResumable.downloadAsync();
      
      if (!downloadResult?.uri) {
        throw new Error('Download failed - no file URI returned');
      }

      // Получаем content URI для установки
      let installUri = downloadResult.uri;
      try {
        installUri = await LegacyFileSystem.getContentUriAsync(downloadResult.uri);
      } catch (fallbackErr) {
        console.warn(
          'Failed to resolve content URI, using file path directly',
          fallbackErr,
        );
      }

      // Сохраняем URI скачанного APK и меняем состояние на "готово к установке"
      setDownloadedApkUri(installUri);
      setDownloadState('ready');
      setDownloadProgress(null);
      
    } catch (err) {
      console.error('Failed to download update', err);
      setDownloadState('error');
      setDownloadProgress(null);
      setErrorMessage(
        err instanceof Error ? err.message : 'Не удалось скачать обновление',
      );
    }
  }, [release]);

  const installApk = useCallback(async () => {
    if (!release || !downloadedApkUri) {
      return;
    }

    try {
      setDownloadState('installing');
      
      // СНАЧАЛА сохраняем версию в AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY_INSTALLED_VERSION, release.version);
      console.log('Version saved to storage:', release.version);
      
      // Небольшая задержка для гарантии записи
      await new Promise(resolve => setTimeout(resolve, 100));

      // ПОТОМ запускаем установщик
      await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
        data: downloadedApkUri,
        flags: INSTALL_FLAGS,
      });

      // Обновляем локальное состояние (это может не выполниться, если система закроет приложение)
      setDismissedVersion(release.version);
      
    } catch (err) {
      console.error('Failed to install update', err);
      setDownloadState('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Не удалось установить обновление',
      );
    }
  }, [release, downloadedApkUri]);

  const handleDismiss = useCallback(async () => {
    if (!release) {
      return;
    }
    
    try {
      await AsyncStorage.setItem(STORAGE_KEY_DISMISSED_VERSION, release.version);
      setDismissedVersion(release.version);
      setRelease(null);
    } catch (err) {
      console.warn('Failed to save dismissed version', err);
    }
  }, [release]);

  if (!isAndroid || !release) {
    return null;
  }

  const isDownloading = downloadState === 'downloading';
  const isReady = downloadState === 'ready';
  const isInstalling = downloadState === 'installing';
  
  const downloadLabel = downloadProgress != null
    ? `Downloaded ${Math.round(downloadProgress * 100)}%`
    : 'Downloading update…';

  return (
    <View
      style={[styles.container, { bottom: 16 + insets.bottom }]}
      pointerEvents="box-none"
    >
      <View style={styles.banner}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <ThemedText type="subtitle" style={styles.title}>
              New version {release.version} avalaible!
            </ThemedText>
            <Pressable onPress={handleDismiss} style={styles.closeButton}>
              <ThemedText style={styles.closeText}>✕</ThemedText>
            </Pressable>
          </View>
          <ThemedText style={styles.notes}>
            {release.notes.length ? release.notes.split('\n')[0] : 'Скачай APK и установи обновление.'}
          </ThemedText>
        </View>
        <View style={styles.controls}>
          {isDownloading ? (
            <View style={styles.downloadRow}>
              <ActivityIndicator color="#fff" />
              <ThemedText style={styles.statusText}>{downloadLabel}</ThemedText>
            </View>
          ) : isReady ? (
            <Pressable style={styles.button} onPress={installApk}>
              <ThemedText style={styles.buttonText}>Install</ThemedText>
            </Pressable>
          ) : isInstalling ? (
            <View style={styles.downloadRow}>
              <ActivityIndicator color="#fff" />
              <ThemedText style={styles.statusText}>Launching installer...</ThemedText>
            </View>
          ) : (
            <Pressable style={styles.button} onPress={downloadAndInstall}>
              <ThemedText style={styles.buttonText}>Download</ThemedText>
            </Pressable>
          )}
          {downloadState === 'error' && errorMessage ? (
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    zIndex: 40,
  },
  banner: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#0a7ea4',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
  closeText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 20,
    opacity: 0.8,
  },
  notes: {
    color: '#f0fdfa',
    marginTop: 4,
    fontSize: 14,
    opacity: 0.9,
  },
  controls: {
    flexDirection: 'column',
  },
  button: {
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  buttonText: {
    color: '#0a7ea4',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
  },
  errorText: {
    color: '#f87171',
    marginTop: 4,
    fontSize: 12,
  },
});
