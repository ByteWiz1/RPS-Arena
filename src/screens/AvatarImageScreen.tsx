import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Camera, FolderOpen, Check, Lock } from 'lucide-react-native';
import { useAvatarStore } from '../store/avatarStore';
import { EMOJI_CATEGORIES, isCategoryUnlocked } from '../utils/avatarEmojis';
import {
  pickFromCamera,
  pickFromGallery,
  compressImageToBase64,
} from '../services/imageService';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { showAlert } from '../utils/alert';

export default function AvatarImageScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const avatarId = route.params?.avatarId;
  const { avatars, updateAvatarImage } = useAvatarStore() as any;

  const avatar = avatars.find((a: any) => a.id === avatarId);
  const [loading, setLoading] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string>(
    avatar?.image?.type === 'emoji' ? avatar.image.value : ''
  );
  const [customUri, setCustomUri] = useState<string | null>(
    avatar?.image?.type === 'custom' ? avatar.image.value : null
  );
  const [hasChanges, setHasChanges] = useState(false);

  if (!avatar) {
    return (
      <ScreenContainer>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
              <ChevronLeft size={26} color="#e94560" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Avatar Image</Text>
            <View style={styles.headerBtn} />
          </View>
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Avatar not found</Text>
          </View>
        </SafeAreaView>
      </ScreenContainer>
    );
  }

  const handleImageResult = async (sourceUri: string) => {
    const base64 = await compressImageToBase64(sourceUri);
    if (base64) {
      setCustomUri(base64);
      setSelectedEmoji('');
      setHasChanges(true);
    } else {
      showAlert('Error', 'Could not process image');
    }
  };

  const handleCamera = async () => {
    setLoading(true);
    const result = await pickFromCamera();
    if (!result.wasCancelled && result.uri) await handleImageResult(result.uri);
    setLoading(false);
  };

  const handleGallery = async () => {
    setLoading(true);
    const result = await pickFromGallery();
    if (!result.wasCancelled && result.uri) await handleImageResult(result.uri);
    setLoading(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    setCustomUri(null);
    setHasChanges(true);
  };

  const handleSave = () => {
    const image = customUri
      ? { type: 'custom' as const, value: customUri }
      : { type: 'emoji' as const, value: selectedEmoji || '🤖' };
    updateAvatarImage(avatar.id, image);
    navigation.goBack();
  };

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <ChevronLeft size={26} color="#e94560" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Choose Avatar</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.headerBtn, !hasChanges && styles.headerBtnDisabled]}
            disabled={!hasChanges}
          >
            <Check size={22} color={hasChanges ? '#4ade80' : '#3a3a4a'} />
          </TouchableOpacity>
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <View style={styles.previewBox}>
            {customUri ? (
              <Image source={{ uri: customUri }} style={styles.previewImage} />
            ) : (
              <Text style={styles.previewEmoji}>{selectedEmoji || '🤖'}</Text>
            )}
            {loading && (
              <View style={styles.previewLoading}>
                <ActivityIndicator color="#e94560" size="large" />
              </View>
            )}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleCamera} disabled={loading}>
              <Camera size={22} color="#e94560" />
              <Text style={styles.actionBtnText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleGallery} disabled={loading}>
              <FolderOpen size={22} color="#4facfe" />
              <Text style={styles.actionBtnText}>Gallery</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>OR PICK FROM DEFAULTS</Text>

          {EMOJI_CATEGORIES.map((cat) => {
            const unlocked = isCategoryUnlocked(cat.minLevel, avatar.level);
            return (
              <View key={cat.id} style={styles.categoryBox}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  <Text style={styles.categoryLabel}>{cat.label}</Text>
                  {!unlocked && (
                    <View style={styles.lockedBadge}>
                      <Lock size={10} color="#fbbf24" />
                      <Text style={styles.lockedText}>Lv {cat.minLevel}</Text>
                    </View>
                  )}
                </View>

                {unlocked ? (
                  <View style={styles.emojiGrid}>
                    {cat.items.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={[
                          styles.emojiCell,
                          selectedEmoji === emoji && styles.emojiCellActive,
                        ]}
                        onPress={() => handleEmojiSelect(emoji)}
                      >
                        <Text style={styles.emojiChar}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.lockedRow}>
                    {cat.items.slice(0, 6).map((emoji, i) => (
                      <View key={i} style={[styles.emojiCell, styles.emojiCellLocked]}>
                        <Text style={[styles.emojiChar, { opacity: 0.2 }]}>{emoji}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScreenScroll>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerBtn: { padding: 6, width: 36, alignItems: 'center' },
  headerBtnDisabled: { opacity: 0.5 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 60 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#5a5a7a', fontSize: 14 },
  previewBox: {
    alignSelf: 'center',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(233, 69, 96, 0.4)',
    marginBottom: 20,
    overflow: 'hidden',
  },
  previewEmoji: { fontSize: 72 },
  previewImage: { width: '100%', height: '100%' },
  previewLoading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10, 10, 15, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5a5a7a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  categoryBox: { marginBottom: 14 },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryEmoji: { fontSize: 18 },
  categoryLabel: { fontSize: 13, fontWeight: '700', color: '#ffffff', flex: 1 },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
  },
  lockedText: { fontSize: 10, color: '#fbbf24', fontWeight: '700' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lockedRow: { flexDirection: 'row', gap: 8 },
  emojiCell: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiCellActive: { borderColor: '#e94560', backgroundColor: 'rgba(233, 69, 96, 0.15)' },
  emojiCellLocked: { opacity: 0.5 },
  emojiChar: { fontSize: 26 },
});