import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

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
  const currentVersion = useMemo(getCurrentVersion, []);
  if (Platform.OS !== 'android') {
    return null;
  }
  const [release, setRelease] = useState<ParsedRelease | null>(null);
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const downloadStateRef = useRef(downloadState);
  const releaseRef = useRef<ParsedRelease | null>(null);

  useEffect(() => {
    downloadStateRef.current = downloadState;
  }, [downloadState]);

  useEffect(() => {
    releaseRef.current = release;
  }, [release]);

  useEffect(() => {
    let cancelled = false;

    const checkRelease = async () => {
      if (cancelled || downloadStateRef.current === 'downloading' || releaseRef.current) {
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
        setRelease(parsedRelease);
        releaseRef.current = parsedRelease;
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
  }, [currentVersion]);

  const downloadAndInstall = useCallback(async () => {
    if (!release) {
      return;
    }

    try {
      setDownloadState('downloading');
      setErrorMessage(null);
      const destinationUri = `${FileSystem.cacheDirectory}${release.assetName}`;
      await FileSystem.deleteAsync(destinationUri, { idempotent: true });
      await FileSystem.downloadAsync(release.assetUrl, destinationUri);

      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: destinationUri,
        type: 'application/vnd.android.package-archive',
        flags: INSTALL_FLAGS,
      });

      BackHandler.exitApp();
    } catch (err) {
      console.warn('Failed to install update', err);
      setDownloadState('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Не удалось скачать или установить обновление',
      );
    }
  }, [release]);

  if (!release) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.banner}>
        <View style={styles.header}>
          <ThemedText type="subtitle" style={styles.title}>
            Новая версия {release.version} уже готова
          </ThemedText>
          <ThemedText style={styles.notes}>
            {release.notes.length ? release.notes.split('\n')[0] : 'Скачай APK и установи обновление.'}
          </ThemedText>
        </View>
        <View style={styles.controls}>
          {downloadState === 'downloading' ? (
            <View style={styles.downloadRow}>
              <ActivityIndicator color="#fff" />
              <ThemedText style={styles.statusText}>Скачиваю обновление…</ThemedText>
            </View>
          ) : (
            <Pressable style={styles.button} onPress={downloadAndInstall}>
              <ThemedText style={styles.buttonText}>обнови</ThemedText>
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
  title: {
    color: '#fff',
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
