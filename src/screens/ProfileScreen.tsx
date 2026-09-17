import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import { useAvatarStore } from '../store/avatarStore';
import { getRatingTier } from '../engine/AvatarEngine';
import { startMenuMusic } from '../services/audio';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const {
    avatars,
    selectedAvatarId,
    createNewAvatar,
    selectAvatar,
    deleteAvatar,
  } = useAvatarStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    startMenuMusic();
  }, []);

  const handleCreateAvatar = () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    createNewAvatar(newName.trim());
    setNewName('');
    setShowCreate(false);
  };

  const handleDeleteAvatar = (id: string) => {
    Alert.alert('Delete Avatar', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAvatar(id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={28} color="#e94560" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Avatars</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addButton}>
          <Plus size={24} color="#e94560" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {avatars.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🤖</Text>
            <Text style={styles.emptyTitle}>No Avatars Yet</Text>
            <Text style={styles.emptyText}>Create your first AI champion</Text>
            <TouchableOpacity style={styles.createButton} onPress={() => setShowCreate(true)}>
              <Text style={styles.createButtonText}>Create Avatar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          avatars.map((avatar) => {
            const tier = getRatingTier(avatar.rating);
            return (
              <TouchableOpacity
                key={avatar.id}
                style={[
                  styles.avatarCard,
                  selectedAvatarId === avatar.id && styles.avatarCardSelected,
                ]}
                onPress={() => selectAvatar(avatar.id)}
              >
                <View style={styles.avatarInfo}>
                  <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
                  <View style={styles.avatarDetails}>
                    <Text style={styles.avatarName}>{avatar.name}</Text>
                    <Text style={styles.avatarStats}>
  Level {avatar.level} • {avatar.wins}W {avatar.losses}L {avatar.ties}T
</Text>
<Text style={[styles.avatarRating, { color: tier.color }]}>
  {tier.emoji} {tier.name} • {avatar.rating}
</Text>
{avatar.bestStreak >= 3 && (
  <Text style={styles.avatarStreak}>
    🔥 Best: {avatar.bestStreak}W streak
  </Text>
)}
                  </View>
                </View>
                {selectedAvatarId === avatar.id && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedText}>Selected</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteAvatar(avatar.id)}
                >
                  <Trash2 size={20} color="#f87171" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {showCreate && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Avatar</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter avatar name"
              placeholderTextColor="#5a5a7a"
              value={newName}
              onChangeText={setNewName}
              autoFocus
              maxLength={15}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCreate(false);
                  setNewName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleCreateAvatar}
              >
                <Text style={styles.confirmButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  addButton: { padding: 8 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#5a5a7a', marginBottom: 24 },
  createButton: { backgroundColor: '#e94560', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  createButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarCardSelected: { borderColor: '#e94560', backgroundColor: 'rgba(233, 69, 96, 0.05)' },
  avatarInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  avatarEmoji: { fontSize: 40 },
  avatarDetails: { flex: 1 },
  avatarName: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  avatarStats: { fontSize: 12, color: '#5a5a7a', marginTop: 2 },
  avatarRating: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  selectedBadge: { backgroundColor: '#e94560', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginRight: 8 },
  avatarStreak: {
  fontSize: 11,
  color: '#fbbf24',
  fontWeight: '700',
  marginTop: 2,
},
  selectedText: { color: '#ffffff', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  deleteButton: { padding: 8 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#14141e', borderRadius: 24, padding: 24, width: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginBottom: 16, textAlign: 'center' },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, color: '#ffffff', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: 'rgba(255,255,255,0.05)' },
  confirmButton: { backgroundColor: '#e94560' },
  cancelButtonText: { color: '#5a5a7a', fontSize: 16, fontWeight: '600' },
  confirmButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});