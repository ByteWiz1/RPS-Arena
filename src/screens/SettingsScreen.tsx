import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  Music,
  Volume2,
  Vibrate,
  Info,
  Trash2,
  User,
  Edit3,
  X,
  AlertTriangle,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '../store/settingsStore';
import { useUserStore } from '../store/userStore';
import { startMenuMusic } from '../services/audio';
import {
  changeUsernameOnServer,
  deleteAccountOnServer,
} from '../services/multiplayer';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { showAlert } from '../utils/alert';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const {
    musicVolume,
    sfxVolume,
    vibrationEnabled,
    setMusicVolume,
    setSFXVolume,
    toggleVibration,
  } = useSettingsStore();

  const { identity, updateUser, clearUser } = useUserStore();

  // ─── Change username state ───
  const [usernameModalVisible, setUsernameModalVisible] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);

  // ─── Delete account state ───
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    startMenuMusic();
  }, []);

  // ─────────────────────────────────────────────────────────
  // RESET ALL PROGRESS (existing)
  // ─────────────────────────────────────────────────────────
  const handleReset = () => {
    showAlert(
      'Reset Everything?',
      'This will delete all avatars, stats, and history. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset All',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            showAlert('Done', 'App has been reset. Restart the app.');
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────
  // CHANGE USERNAME
  // ─────────────────────────────────────────────────────────
  const openUsernameModal = () => {
    setNewUsername(identity?.username || '');
    setUsernameError(null);
    setUsernameModalVisible(true);
  };

  const closeUsernameModal = () => {
    if (savingUsername) return;
    setUsernameModalVisible(false);
    setUsernameError(null);
  };

  const validateUsername = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (trimmed.length < 3) return 'Must be at least 3 characters';
    if (trimmed.length > 15) return 'Must be 15 characters or less';
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed))
      return 'Only letters, numbers, and underscores allowed';
    return null;
  };

  const handleSaveUsername = async () => {
    if (!identity) return;

    const trimmed = newUsername.trim();
    const validationError = validateUsername(trimmed);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    if (trimmed === identity.username) {
      setUsernameError('That is already your username');
      return;
    }

    setSavingUsername(true);
    setUsernameError(null);

    try {
      // 1. Tell server first (so it can reject duplicates)
      const result = await changeUsernameOnServer(identity.userId, trimmed);

      if (!result.success) {
        setUsernameError(result.message || 'Could not change username');
        setSavingUsername(false);
        return;
      }

      // 2. Persist locally
      await updateUser({ username: trimmed });

      setSavingUsername(false);
      setUsernameModalVisible(false);
      showAlert('Done', 'Username updated!');
    } catch (e) {
      setSavingUsername(false);
      setUsernameError('Something went wrong. Try again.');
    }
  };

  // ─────────────────────────────────────────────────────────
  // DELETE ACCOUNT
  // ─────────────────────────────────────────────────────────
  const openDeleteModal = () => {
    setDeleteConfirmText('');
    setDeleteModalVisible(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalVisible(false);
    setDeleteConfirmText('');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;

    setDeleting(true);

    try {
      // 1. Tell server (best-effort)
      await deleteAccountOnServer();

      // 2. Wipe local identity
      await clearUser();

      // 3. Wipe everything else local
      await AsyncStorage.clear();

      setDeleting(false);
      setDeleteModalVisible(false);

      // 4. Bounce to root — will land on onboarding since identity is gone
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (e) {
      setDeleting(false);
      showAlert('Error', 'Could not delete account. Try again.');
    }
  };

  const deleteReady = deleteConfirmText.trim().toUpperCase() === 'DELETE';

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ChevronLeft size={26} color="#e94560" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>⚙️ Settings</Text>
          <View style={styles.placeholder} />
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          {/* ─── ACCOUNT SECTION ─── */}
          <Text style={styles.sectionLabel}>Account</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={openUsernameModal}
          >
            <View style={styles.settingLeft}>
              <User size={20} color="#4facfe" />
              <View>
                <Text style={styles.settingLabelSwitch}>Username</Text>
                <Text style={styles.settingSubValue}>
                  {identity?.username || '—'}
                </Text>
              </View>
            </View>
            <Edit3 size={18} color="#5a5a7a" />
          </TouchableOpacity>

          {/* ─── AUDIO SECTION ─── */}
          <Text style={styles.sectionLabel}>Audio</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingHeader}>
              <Music size={20} color="#e94560" />
              <Text style={styles.settingLabel}>Background Music</Text>
              <Text style={styles.settingValue}>
                {Math.round(musicVolume * 100)}%
              </Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={musicVolume}
              onValueChange={setMusicVolume}
              minimumTrackTintColor="#e94560"
              maximumTrackTintColor="rgba(255,255,255,0.1)"
              thumbTintColor="#e94560"
            />
            <Text style={styles.settingHint}>
              Plays in menus and during matches
            </Text>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingHeader}>
              <Volume2 size={20} color="#4facfe" />
              <Text style={styles.settingLabel}>Sound Effects</Text>
              <Text style={styles.settingValue}>
                {Math.round(sfxVolume * 100)}%
              </Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={sfxVolume}
              onValueChange={setSFXVolume}
              minimumTrackTintColor="#4facfe"
              maximumTrackTintColor="rgba(255,255,255,0.1)"
              thumbTintColor="#4facfe"
            />
            <Text style={styles.settingHint}>
              Clicks, win, lose, tie sounds
            </Text>
          </View>

          {/* ─── FEEDBACK SECTION ─── */}
          <Text style={styles.sectionLabel}>Feedback</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Vibrate size={20} color="#5a5a7a" />
              <Text style={styles.settingLabelSwitch}>Vibration</Text>
            </View>
            <Switch
              value={vibrationEnabled}
              onValueChange={toggleVibration}
              trackColor={{ false: '#333', true: '#e94560' }}
              thumbColor={vibrationEnabled ? '#ffffff' : '#f4f3f4'}
            />
          </View>

          {/* ─── DANGER ZONE ─── */}
          <Text style={styles.sectionLabel}>Danger Zone</Text>

          <TouchableOpacity style={styles.dangerButton} onPress={handleReset}>
            <Trash2 size={18} color="#f87171" />
            <Text style={styles.dangerButtonText}>Reset All Progress</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerButton, styles.deleteButton]}
            onPress={openDeleteModal}
          >
            <AlertTriangle size={18} color="#ff3b30" />
            <Text style={[styles.dangerButtonText, styles.deleteButtonText]}>
              Delete Account
            </Text>
          </TouchableOpacity>

          {/* ─── ABOUT ─── */}
          <View style={styles.aboutCard}>
            <Info size={24} color="#5a5a7a" />
            <Text style={styles.aboutTitle}>RPS Arena</Text>
            <Text style={styles.aboutVersion}>Version 1.0.0</Text>
            <Text style={styles.aboutText}>Rock Paper Scissors</Text>
          </View>
        </ScreenScroll>

        {/* ═══════════════════════════════════════════════════ */}
        {/* CHANGE USERNAME MODAL                              */}
        {/* ═══════════════════════════════════════════════════ */}
        <Modal
          visible={usernameModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeUsernameModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Change Username</Text>
                <TouchableOpacity
                  onPress={closeUsernameModal}
                  disabled={savingUsername}
                >
                  <X size={22} color="#5a5a7a" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalHint}>
                3–15 characters. Letters, numbers, underscores only.
              </Text>

              <TextInput
                style={styles.modalInput}
                value={newUsername}
                onChangeText={(t) => {
                  setNewUsername(t);
                  if (usernameError) setUsernameError(null);
                }}
                placeholder="Enter new username"
                placeholderTextColor="#3a3a4a"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={15}
                editable={!savingUsername}
              />

              {usernameError && (
                <Text style={styles.modalError}>{usernameError}</Text>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={closeUsernameModal}
                  disabled={savingUsername}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalSave,
                    savingUsername && styles.modalSaveDisabled,
                  ]}
                  onPress={handleSaveUsername}
                  disabled={savingUsername}
                >
                  {savingUsername ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.modalSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* ═══════════════════════════════════════════════════ */}
        {/* DELETE ACCOUNT MODAL                               */}
        {/* ═══════════════════════════════════════════════════ */}
        <Modal
          visible={deleteModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeDeleteModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <AlertTriangle size={22} color="#ff3b30" />
                <Text style={[styles.modalTitle, { flex: 1, marginLeft: 10 }]}>
                  Delete Account
                </Text>
                <TouchableOpacity
                  onPress={closeDeleteModal}
                  disabled={deleting}
                >
                  <X size={22} color="#5a5a7a" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalWarning}>
                This will permanently delete your identity, stats, and match
                history. This cannot be undone.
              </Text>

              <Text style={styles.modalHint}>
                Type <Text style={styles.modalHintBold}>DELETE</Text> to confirm.
              </Text>

              <TextInput
                style={styles.modalInput}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder="DELETE"
                placeholderTextColor="#3a3a4a"
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!deleting}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={closeDeleteModal}
                  disabled={deleting}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalDelete,
                    (!deleteReady || deleting) && styles.modalSaveDisabled,
                  ]}
                  onPress={handleDeleteAccount}
                  disabled={!deleteReady || deleting}
                >
                  {deleting ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.modalDeleteText}>Delete Forever</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backButton: { padding: 6 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  placeholder: { width: 36 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 12,
    color: '#5a5a7a',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 4,
  },

  settingCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  settingValue: { fontSize: 14, color: '#5a5a7a', fontWeight: '600' },
  settingHint: { fontSize: 11, color: '#3a3a4a', marginTop: 4 },
  slider: { width: '100%', height: 40 },

  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabelSwitch: { fontSize: 16, color: '#ffffff', fontWeight: '500' },
  settingSubValue: { fontSize: 12, color: '#5a5a7a', marginTop: 2 },

  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.25)',
  },
  dangerButtonText: { color: '#f87171', fontSize: 14, fontWeight: '700' },

  deleteButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    borderColor: 'rgba(255, 59, 48, 0.35)',
  },
  deleteButtonText: { color: '#ff3b30' },

  aboutCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 24,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  aboutTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 8,
  },
  aboutVersion: { fontSize: 14, color: '#5a5a7a', marginTop: 4 },
  aboutText: { fontSize: 14, color: '#5a5a7a', marginTop: 4 },

  // ─── Modals ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  modalHint: { fontSize: 12, color: '#5a5a7a', marginBottom: 10 },
  modalHintBold: { color: '#ff3b30', fontWeight: '700' },
  modalWarning: {
    fontSize: 13,
    color: '#f87171',
    marginBottom: 10,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  modalError: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 6,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalCancelText: { color: '#5a5a7a', fontSize: 14, fontWeight: '600' },
  modalSave: {
    backgroundColor: '#4facfe',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  modalSaveDisabled: { opacity: 0.5 },
  modalSaveText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  modalDelete: {
    backgroundColor: '#ff3b30',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  modalDeleteText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});