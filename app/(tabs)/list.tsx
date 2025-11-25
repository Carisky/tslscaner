import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { AlertButton } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScanSession, type ScanItem } from '@/providers/scan-provider';

export default function ListScreen() {
    const {
      items,
      itemsCount,
      clearAll,
      removeById,
      folders,
      createFolder,
      moveScanToFolder,
      removeFolderScan,
      clearFolder,
      deleteFolder,
      moveBufferToFolder,
    } = useScanSession();

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isFolderPickerVisible, setFolderPickerVisible] = useState(false);
  const [isFolderModalVisible, setFolderModalVisible] = useState(false);
  const [folderDraft, setFolderDraft] = useState('');
  const [pendingScan, setPendingScan] = useState<ScanItem | null>(null);

  const activeFolder = useMemo(
    () => folders.find((folder) => folder.id === activeFolderId) ?? null,
    [activeFolderId, folders],
  );

  useEffect(() => {
    if (activeFolderId && !folders.some((folder) => folder.id === activeFolderId)) {
      setActiveFolderId(null);
    }
  }, [activeFolderId, folders]);

  const displayItems = activeFolder ? activeFolder.scans : items;
  const displayCount = displayItems.length;
  const headerTitle = activeFolder ? activeFolder.name : 'Lista';

  const openFolderPicker = (scan: ScanItem) => {
    setPendingScan(scan);
    setFolderPickerVisible(true);
  };

  const handleItemAction = (item: ScanItem) => {
    const removeAction = () => {
      if (activeFolder) {
        removeFolderScan(activeFolder.id, item.id);
      } else {
        removeById(item.id);
      }
    };

    const actions: AlertButton[] = [
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: removeAction,
      },
      { text: 'Anuluj', style: 'cancel' },
    ];

    if (!activeFolder) {
      actions.unshift({
        text: 'Zapisz w folderze',
        style: 'default',
        onPress: () => openFolderPicker(item),
      });
    }

    Alert.alert('Skan', 'Wybierz akcję', actions);
  };

  const handleClear = () => {
    if (!displayCount) return;
    Alert.alert(
      activeFolder ? 'Wyczyść folder' : 'Wyczyść listę',
      activeFolder
        ? `Usunąć wszystkie skany z folderu ${activeFolder.name}?`
        : 'Usunąć wszystkie tymczasowe skany?',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: activeFolder ? 'Wyczyść folder' : 'Wyczyść',
          style: 'destructive',
          onPress: () => {
            if (activeFolder) {
              clearFolder(activeFolder.id);
            } else {
              clearAll();
            }
          },
        },
      ],
    );
  };

  const handleMoveBufferToFolder = () => {
    if (!activeFolder || !itemsCount) {
      return;
    }
    Alert.alert(
      'Przenieść bufor',
      `Zapisz ${itemsCount} skanów w folderze ${activeFolder.name}?`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Przenieś',
          onPress: () => moveBufferToFolder(activeFolder.id),
        },
      ],
    );
  };

  const handleFolderSelected = (folderId: string) => {
    if (pendingScan) {
      moveScanToFolder(folderId, pendingScan);
      setPendingScan(null);
    }
    setFolderPickerVisible(false);
  };

  const handleFolderPickerCancel = () => {
    setFolderPickerVisible(false);
    setPendingScan(null);
  };

  const handleCreateFolderPress = () => {
    setPendingScan(null);
    setFolderDraft('');
    setFolderModalVisible(true);
  };

  const handleCreateFolder = () => {
    const trimmed = folderDraft.trim();
    if (!trimmed.length) {
      Alert.alert('Podaj nazwę folderu');
      return;
    }
    const created = createFolder(trimmed);
    setFolderModalVisible(false);
    setFolderDraft('');
    if (created) {
      setActiveFolderId(created.id);
      if (pendingScan) {
        moveScanToFolder(created.id, pendingScan);
        setPendingScan(null);
      }
    }
  };

  const handleFolderLongPress = (folderId: string, folderName: string) => {
    Alert.alert(folderName, 'Co chcesz zrobić z folderem?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Wyczyść zawartość',
        onPress: () => clearFolder(folderId),
      },
      {
        text: 'Usuń folder',
        style: 'destructive',
        onPress: () => {
          if (activeFolderId === folderId) {
            setActiveFolderId(null);
          }
          deleteFolder(folderId);
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">{headerTitle}</ThemedText>
        <View style={styles.counter}>
          <ThemedText style={styles.counterText}>{displayCount}</ThemedText>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.folderRowContent}
        style={styles.folderRow}>
        <Pressable
          onPress={() => setActiveFolderId(null)}
          style={[styles.folderChip, !activeFolder && styles.folderChipActive]}>
          <ThemedText style={styles.folderChipLabel}>Bufor</ThemedText>
          <ThemedText style={styles.folderChipCount}>{itemsCount}</ThemedText>
        </Pressable>
        {folders.map((folder) => (
          <Pressable
            key={folder.id}
            onPress={() => setActiveFolderId(folder.id)}
            onLongPress={() => handleFolderLongPress(folder.id, folder.name)}
            style={[
              styles.folderChip,
              activeFolder?.id === folder.id && styles.folderChipActive,
            ]}>
            <ThemedText style={styles.folderChipLabel}>{folder.name}</ThemedText>
            <ThemedText style={styles.folderChipCount}>{folder.scans.length}</ThemedText>
          </Pressable>
        ))}
        <Pressable onPress={handleCreateFolderPress} style={[styles.folderChip, styles.folderChipNew]}>
          <ThemedText style={styles.folderChipLabel}>+ Nowy folder</ThemedText>
        </Pressable>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          onPress={handleClear}
          disabled={!displayCount}
          style={[styles.clearButton, !displayCount && styles.clearButtonDisabled, styles.actionButton]}>
          <ThemedText style={styles.clearButtonText}>Wyczyść</ThemedText>
        </Pressable>
        <Pressable
          onPress={handleMoveBufferToFolder}
          disabled={!activeFolder || !itemsCount}
          style={[
            styles.moveButton,
            (!activeFolder || !itemsCount) && styles.moveButtonDisabled,
            styles.actionButton,
          ]}>
          <ThemedText style={styles.moveButtonText}>Przenieś bufor</ThemedText>
        </Pressable>
      </View>

      <FlatList
        data={displayItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, !displayCount && styles.emptyList]}
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => handleItemAction(item)}
            style={({ pressed }) => [styles.rowPressable, pressed && styles.rowPressed]}>
            <RowCard>
              <ThemedText type="defaultSemiBold">{item.friendlyName}</ThemedText>
              <ThemedText style={styles.rowTimestamp}>
                {new Date(item.timestamp).toLocaleString()}
              </ThemedText>
              <ThemedText style={styles.rowCode}>{item.code}</ThemedText>
              <ThemedText style={styles.rowMeta}>
                Format: {item.labelType ?? 'nieznany'}
              </ThemedText>
            </RowCard>
          </Pressable>
        )}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>
            {activeFolder
              ? 'Brak skanów w folderze. Dodaj je z zakładki Skaner lub bufora.'
              : 'Brak wpisów. Przejdź do zakładki Skaner i zeskanuj kod.'}
          </ThemedText>
        }
      />

      <Modal
        visible={isFolderPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={handleFolderPickerCancel}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalOverlay} onPress={handleFolderPickerCancel} />
          <View style={styles.modalCard}>
            <ThemedText type="subtitle">Zapisz skan</ThemedText>
            <ThemedText style={styles.modalHelper}>Wybierz folder docelowy</ThemedText>
            <ScrollView style={styles.modalList}>
              {folders.length ? (
                folders.map((folder) => (
                  <Pressable
                    key={folder.id}
                    onPress={() => handleFolderSelected(folder.id)}
                    style={styles.modalOption}>
                    <ThemedText style={styles.modalOptionLabel}>{folder.name}</ThemedText>
                    <ThemedText style={styles.modalMeta}>{folder.scans.length} skanów</ThemedText>
                  </Pressable>
                ))
              ) : (
                <ThemedText style={styles.modalHelper}>Brak folderów. Utwórz nowy.</ThemedText>
              )}
            </ScrollView>
            <Pressable
              onPress={() => {
                setFolderPickerVisible(false);
                setFolderModalVisible(true);
              }}
              style={styles.modalPrimaryButton}>
              <ThemedText style={styles.modalPrimaryText}>Utwórz nowy folder</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isFolderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setFolderModalVisible(false);
          setFolderDraft('');
          setPendingScan(null);
        }}>
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              setFolderModalVisible(false);
              setFolderDraft('');
              setPendingScan(null);
            }}
          />
          <View style={styles.modalCard}>
            <ThemedText type="subtitle">Nowy folder</ThemedText>
            <TextInput
              value={folderDraft}
              onChangeText={setFolderDraft}
              placeholder="Nazwa folderu"
              style={styles.folderInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setFolderModalVisible(false);
                  setFolderDraft('');
                  setPendingScan(null);
                }}
                style={styles.modalButton}>
                <ThemedText style={styles.modalButtonText}>Anuluj</ThemedText>
              </Pressable>
              <Pressable onPress={handleCreateFolder} style={styles.modalButton}>
                <ThemedText style={styles.modalButtonText}>Zapisz</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counter: {
    minWidth: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
  },
  counterText: {
    color: '#fff',
    fontWeight: '700',
  },
  folderRow: {
    marginTop: 12,
  },
  folderRowContent: {
    flexDirection: 'row',
    gap: 8,
  },
  folderChip: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  folderChipActive: {
    borderColor: '#0a7ea4',
    backgroundColor: '#e0f2ff',
  },
  folderChipNew: {
    borderStyle: 'dashed',
  },
  folderChipLabel: {
    fontSize: 12,
    color: '#0a7ea4',
  },
  folderChipCount: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  actions: {
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
  },
  clearButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#dc2626',
  },
  actionButton: {
    marginRight: 12,
  },
  clearButtonDisabled: {
    opacity: 0.4,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  moveButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0a7ea4',
  },
  moveButtonDisabled: {
    opacity: 0.4,
  },
  moveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 24,
  },
  rowPressable: {
    borderRadius: 12,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rowTimestamp: {
    fontSize: 12,
    marginTop: 4,
    color: '#6b7280',
  },
  rowCode: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  rowMeta: {
    fontSize: 12,
    marginTop: 4,
    color: '#6b7280',
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  modalCard: {
    marginHorizontal: 32,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 5,
  },
  modalHelper: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  modalList: {
    maxHeight: 220,
    marginTop: 12,
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalOptionLabel: {
    fontWeight: '600',
  },
  modalMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  modalPrimaryButton: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: '#0a7ea4',
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalPrimaryText: {
    color: '#fff',
    fontWeight: '600',
  },
  folderInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  modalActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0a7ea4',
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
});

const RowCard = ({ children }: PropsWithChildren) => (
  <ThemedView lightColor="#fff" darkColor="#1f2937" style={styles.rowCard}>
    {children}
  </ThemedView>
);
