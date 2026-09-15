import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Plus, LogIn } from 'lucide-react-native';
import { connectToServer, getSocket } from '../services/multiplayer';

export default function OnlineLobbyScreen() {
  const navigation = useNavigation<any>();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      Alert.alert('Error', 'Please enter your name');
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
        Alert.alert('Error', data.message);
      });
      socket.emit('createRoom', { name: playerName.trim() });
    } catch (error) {
      setIsConnecting(false);
      Alert.alert('Error', 'Could not connect to server');
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (roomCode.length !== 4) {
      Alert.alert('Error', 'Room code must be 4 characters');
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
        Alert.alert('Error', data.message);
      });
      socket.emit('joinRoom', {
        code: roomCode.toUpperCase(),
        name: playerName.trim(),
      });
    } catch (error) {
      setIsConnecting(false);
      Alert.alert('Error', 'Could not connect to server');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={28} color="#e94560" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🌐 Online Multiplayer</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          placeholderTextColor="#5a5a7a"
          value={playerName}
          onChangeText={setPlayerName}
          maxLength={15}
        />

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
            style={styles.codeInput}
            placeholder="ABCD"
            placeholderTextColor="#3a3a4a"
            value={roomCode}
            onChangeText={(text) => setRoomCode(text.toUpperCase())}
            maxLength={4}
            autoCapitalize="characters"
          />
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  placeholder: { width: 44 },
  content: { padding: 16 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, color: '#ffffff', fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  createCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#5a5a7a', marginBottom: 16 },
  createButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#e94560', padding: 14, borderRadius: 12 },
  createButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  dividerText: { color: '#5a5a7a', fontSize: 12 },
  joinCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  codeInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 20, color: '#ffffff', fontSize: 32, fontWeight: '700', textAlign: 'center', letterSpacing: 8, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  joinButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4facfe', padding: 14, borderRadius: 12 },
  joinButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});