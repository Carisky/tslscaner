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
import { useScanSession, type ScanItem, type FolderTarget } from '@/providers/scan-provider';

const FOLDER_TARGET_OPTIONS: { id: FolderTarget; label: string }[] = [
  { id: 'prisma', label: 'Prisma' },
  { id: 'train', label: 'Pociąg' },
];

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
    createWagon,
    clearWagon,
    deleteWagon,
    moveBufferToWagon,
    removeWagonScan,
    } = useScanSession();

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isFolderPickerVisible, setFolderPickerVisible] = useState(false);
  const [isFolderModalVisible, setFolderModalVisible] = useState(false);
  const [folderDraft, setFolderDraft] = useState('');
  const [folderTarget, setFolderTarget] = useState<FolderTarget>('prisma');
  const [pendingScan, setPendingScan] = useState<ScanItem | null>(null);
  const [activeWagonId, setActiveWagonId] = useState<string | null>(null);
  const [isWagonModalVisible, setWagonModalVisible] = useState(false);
  const [wagonDraft, setWagonDraft] = useState('');

  const activeFolder = useMemo(
    () => folders.find((folder) => folder.id === activeFolderId) ?? null,
    [activeFolderId, folders],
  );

  useEffect(() => {
    if (activeFolderId && !folders.some((folder) => folder.id === activeFolderId)) {
      setActiveFolderId(null);
    }
  }, [activeFolderId, folders]);

  useEffect(() => {
    if (!activeFolder || activeFolder.target !== 'train') {
      setActiveWagonId(null);
      return;
    }
    if (activeWagonId && activeFolder.wagons.some((wagon) => wagon.id === activeWagonId)) {
      return;
    }
    setActiveWagonId(activeFolder.wagons[0]?.id ?? null);
  }, [activeFolder, activeWagonId]);

  const activeWagon =
    activeFolder && activeFolder.target === 'train' && activeWagonId
      ? activeFolder.wagons.find((wagon) => wagon.id === activeWagonId) ?? null
      : null;
  const displayItems = activeWagon ? activeWagon.scans : activeFolder ? activeFolder.scans : items;
  const displayCount = displayItems.length;
  const headerTitle = activeWagon
    ? `${activeFolder?.name} • ${activeWagon.name}`
    : activeFolder
      ? activeFolder.name
      : 'Lista';
  const canMoveBuffer =
    Boolean(activeFolder) &&
    itemsCount > 0 &&
    (activeFolder?.target !== 'train' || Boolean(activeWagon));
  const prismaFolders = folders.filter((folder) => folder.target === 'prisma');

  const openFolderPicker = (scan: ScanItem) => {
    setPendingScan(scan);
    setFolderPickerVisible(true);
  };

  const handleItemAction = (item: ScanItem) => {
    const removeAction = () => {
      if (activeWagon && activeFolder) {
        removeWagonScan(activeFolder.id, activeWagon.id, item.id);
      } else if (activeFolder) {
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
    if (activeWagon && activeFolder) {
      Alert.alert(
        'Wyczyść wagon',
        `Usunąć wszystkie skany z wagonu ${activeWagon.name}?`,
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Wyczyść wagon',
            style: 'destructive',
            onPress: () => clearWagon(activeFolder.id, activeWagon.id),
          },
        ],
      );
      return;
    }
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
    if (activeFolder.target === 'train') {
      if (!activeWagon) {
        return;
      }
      Alert.alert(
        'Przenieść bufor',
        `Zapisz ${itemsCount} skanów w wagonie ${activeWagon.name}?`,
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Przenieś',
            onPress: () => moveBufferToWagon(activeFolder.id, activeWagon.id),
          },
        ],
      );
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
    setFolderTarget('prisma');
    setFolderModalVisible(true);
  };

  const handleCreateFolder = () => {
    const trimmed = folderDraft.trim();
    if (!trimmed.length) {
      Alert.alert('Podaj nazwę folderu');
      return;
    }
    const created = createFolder(trimmed, folderTarget);
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

  const handleAddWagonPress = () => {
    setWagonDraft('');
    setWagonModalVisible(true);
  };

  const handleCreateWagon = () => {
    if (!activeFolder) {
      return;
    }
    const trimmed = wagonDraft.trim();
    if (!trimmed.length) {
      Alert.alert('Podaj nazwę wagonu');
      return;
    }
    const created = createWagon(activeFolder.id, trimmed);
    setWagonModalVisible(false);
    setWagonDraft('');
    if (created) {
      setActiveWagonId(created.id);
    }
  };

  const handleWagonLongPress = (wagonId: string, wagonName: string) => {
    if (!activeFolder) {
      return;
    }
    Alert.alert(wagonName, 'Co chcesz zrobić z wagonem?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Wyczyść wagon',
        onPress: () => clearWagon(activeFolder.id, wagonId),
      },
      {
        text: 'Usuń wagon',
        style: 'destructive',
        onPress: () => {
          if (activeWagonId === wagonId) {
            setActiveWagonId(null);
          }
          deleteWagon(activeFolder.id, wagonId);
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
        {folders.map((folder) => {
          const scanCount =
            folder.target === 'train'
              ? folder.wagons.reduce((acc, wagon) => acc + wagon.scans.length, 0)
              : folder.scans.length;
          return (
            <Pressable
              key={folder.id}
              onPress={() => setActiveFolderId(folder.id)}
              onLongPress={() => handleFolderLongPress(folder.id, folder.name)}
              style={[
                styles.folderChip,
                activeFolder?.id === folder.id && styles.folderChipActive,
              ]}>
              <ThemedText style={styles.folderChipLabel}>{folder.name}</ThemedText>
              <ThemedText style={styles.folderChipMeta}>
                {folder.target === 'train' ? 'Pociąg' : 'Prisma'}
              </ThemedText>
              <ThemedText style={styles.folderChipCount}>{scanCount}</ThemedText>
            </Pressable>
          );
        })}
        <Pressable onPress={handleCreateFolderPress} style={[styles.folderChip, styles.folderChipNew]}>
          <ThemedText style={styles.folderChipLabel}>+ Nowy folder</ThemedText>
        </Pressable>
      </ScrollView>

      {activeFolder?.target === 'train' && (
        <View style={styles.wagonSection}>
          <ThemedText type="subtitle">Wagony</ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.wagonRow}
            contentContainerStyle={styles.folderRowContent}>
            {activeFolder.wagons.map((wagon) => (
              <Pressable
                key={wagon.id}
                onPress={() => setActiveWagonId(wagon.id)}
                onLongPress={() => handleWagonLongPress(wagon.id, wagon.name)}
                style={[
                  styles.folderChip,
                  activeWagon?.id === wagon.id && styles.folderChipActive,
                ]}>
                <ThemedText style={styles.folderChipLabel}>{wagon.name}</ThemedText>
                <ThemedText style={styles.folderChipCount}>{wagon.scans.length}</ThemedText>
              </Pressable>
            ))}
            <Pressable onPress={handleAddWagonPress} style={[styles.folderChip, styles.folderChipNew]}>
              <ThemedText style={styles.folderChipLabel}>+ Nowy wagon</ThemedText>
            </Pressable>
          </ScrollView>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={handleClear}
          disabled={!displayCount}
          style={[styles.clearButton, !displayCount && styles.clearButtonDisabled, styles.actionButton]}>
          <ThemedText style={styles.clearButtonText}>Wyczyść</ThemedText>
        </Pressable>
        <Pressable
          onPress={handleMoveBufferToFolder}
          disabled={!canMoveBuffer}
          style={[
            styles.moveButton,
            !canMoveBuffer && styles.moveButtonDisabled,
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
              ? activeFolder.target === 'train'
                ? activeWagon
                  ? `Brak skanów w wagonie ${activeWagon.name}. Dodaj je z zakładki Skaner lub bufora.`
                  : 'Wybierz wagon lub utwórz nowy, aby zgromadzić skany.'
                : 'Brak skanów w folderze. Dodaj je z zakładki Skaner lub bufora.'
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
            {prismaFolders.length ? (
              prismaFolders.map((folder) => (
                <Pressable
                  key={folder.id}
                  onPress={() => handleFolderSelected(folder.id)}
                  style={styles.modalOption}>
                  <ThemedText style={styles.modalOptionLabel}>{folder.name}</ThemedText>
                  <ThemedText style={styles.modalMeta}>
                    {folder.scans.length} skanów
                  </ThemedText>
                </Pressable>
              ))
            ) : (
              <ThemedText style={styles.modalHelper}>
                Brak folderów Prismy. Utwórz nowy.
              </ThemedText>
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
            <View style={styles.folderTargetRow}>
              {FOLDER_TARGET_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => setFolderTarget(option.id)}
                  style={[
                    styles.targetOption,
                    folderTarget === option.id && styles.targetOptionActive,
                  ]}>
                  <ThemedText
                    style={[
                      styles.targetOptionLabel,
                      folderTarget === option.id && styles.targetOptionLabelActive,
                    ]}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <ThemedText style={styles.modalHelper}>
              {folderTarget === 'train'
                ? 'Folder pociągu umożliwia dzielenie skanów na wagony.'
                : 'Folder przypisany do Prismy.'}
            </ThemedText>
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
      <Modal
        visible={isWagonModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setWagonModalVisible(false);
          setWagonDraft('');
        }}>
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              setWagonModalVisible(false);
              setWagonDraft('');
            }}
          />
          <View style={styles.modalCard}>
            <ThemedText type="subtitle">Nowy wagon</ThemedText>
            <TextInput
              value={wagonDraft}
              onChangeText={setWagonDraft}
              placeholder="Nazwa wagonu"
              style={styles.folderInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setWagonModalVisible(false);
                  setWagonDraft('');
                }}
                style={styles.modalButton}>
                <ThemedText style={styles.modalButtonText}>Anuluj</ThemedText>
              </Pressable>
              <Pressable onPress={handleCreateWagon} style={styles.modalButton}>
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
  wagonSection: {
    marginTop: 12,
  },
  wagonRow: {
    marginTop: 8,
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
  folderChipMeta: {
    marginTop: 2,
    fontSize: 10,
    color: '#0a7ea4',
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
  folderTargetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  targetOption: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 8,
    alignItems: 'center',
  },
  targetOptionActive: {
    borderColor: '#0a7ea4',
    backgroundColor: '#e0f2ff',
  },
  targetOptionLabel: {
    fontSize: 12,
    color: '#0a7ea4',
  },
  targetOptionLabelActive: {
    fontWeight: '600',
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
