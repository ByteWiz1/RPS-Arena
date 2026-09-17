import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Plus, LogIn } from 'lucide-react-native';
import { connectToServer, getSocket } from '../services/multiplayer';
import { startGameMusic, stopMusic } from '../services/audio';

export default function OnlineLobbyScreen() {
  const navigation = useNavigation<any>();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    startGameMusic();
    return () => {
      stopMusic();
    };
  }, []);

  const clearErrors = () => {
    setNameError(false);
    setCodeError(false);
    setServerError('');
  };

  const handleCreateRoom = async () => {
    clearErrors();
    if (!playerName.trim()) {
      setNameError(true);
      return;
    }
    setIsConnecting(true);
    try {
      const socket = await connectToServer();
      socket.once('roomCreated', (data: any) => {
        setIsConnecting(false);
        navigation.navigate('OnlineGame', {
          roomCode: data.code,
          playerId: data.playerId,
          playerName: data.playerName,
          isHost: true,
        });
      });
      socket.once('error', (data: any) => {
        setIsConnecting(false);
        setServerError(data.message);
      });
      socket.emit('createRoom', { name: playerName.trim() });
    } catch (error) {
      setIsConnecting(false);
      setServerError('Could not connect to server');
    }
  };

  const handleJoinRoom = async () => {
    clearErrors();
    if (!playerName.trim()) {
      setNameError(true);
      return;
    }
    if (roomCode.length !== 4) {
      setCodeError(true);
      return;
    }
    setIsConnecting(true);
    try {
      const socket = await connectToServer();
      socket.once('playerJoined', (data: any) => {
        setIsConnecting(false);
        navigation.navigate('OnlineGame', {
          roomCode: roomCode.toUpperCase(),
          playerId: data.playerId,
          playerName: data.playerName,
          isHost: false,
        });
      });
      socket.once('error', (data: any) => {
        setIsConnecting(false);
        setServerError(data.message);
      });
      socket.emit('joinRoom', {
        code: roomCode.toUpperCase(),
        name: playerName.trim(),
      });
    } catch (error) {
      setIsConnecting(false);
      setServerError('Could not connect to server');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={26} color="#e94560" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🌐 Online</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <TextInput
          style={[styles.input, nameError && styles.inputError]}
          placeholder="Enter your name"
          placeholderTextColor="#5a5a7a"
          value={playerName}
          onChangeText={(t) => {
            setPlayerName(t);
            if (nameError) setNameError(false);
          }}
          maxLength={15}
        />
        {nameError && (
          <Text style={styles.errorText}>⚠️ Name is required</Text>
        )}

        <View style={styles.createCard}>
          <Text style={styles.cardTitle}>Create Match</Text>
          <Text style={styles.cardSubtitle}>Start a new room and share the code</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateRoom}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Plus size={20} color="#ffffff" />
                <Text style={styles.createButtonText}>Create Room</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.joinCard}>
          <Text style={styles.cardTitle}>Join Match</Text>
          <Text style={styles.cardSubtitle}>Enter a 4-character room code</Text>
          <TextInput
            style={[styles.codeInput, codeError && styles.inputError]}
            placeholder="ABCD"
            placeholderTextColor="#3a3a4a"
            value={roomCode}
            onChangeText={(text) => {
              setRoomCode(text.toUpperCase());
              if (codeError) setCodeError(false);
            }}
            maxLength={4}
            autoCapitalize="characters"
          />
          {codeError && (
            <Text style={styles.errorText}>⚠️ Enter a 4-character code</Text>
          )}
          <TouchableOpacity
            style={styles.joinButton}
            onPress={handleJoinRoom}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <LogIn size={20} color="#ffffff" />
                <Text style={styles.joinButtonText}>Join Room</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {serverError ? (
          <View style={styles.serverErrorBox}>
            <Text style={styles.serverErrorText}>⚠️ {serverError}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    ...(Platform.OS === 'web' ? { height: '100vh' as any } : {}),
  },
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  placeholder: { width: 36 },
  content: { flex: 1, padding: 16 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    color: '#ffffff',
    fontSize: 15,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputError: {
    borderColor: '#f87171',
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 4,
    fontWeight: '600',
  },
  createCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff', marginBottom: 3 },
  cardSubtitle: { fontSize: 12, color: '#5a5a7a', marginBottom: 12 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e94560',
    padding: 12,
    borderRadius: 12,
  },
  createButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  dividerText: { color: '#5a5a7a', fontSize: 11 },
  joinCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  codeInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4facfe',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  joinButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  serverErrorBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  serverErrorText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});