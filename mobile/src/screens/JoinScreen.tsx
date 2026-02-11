import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useGame } from '../context/GameContext';

export function JoinScreen() {
  const { joinRoom, socketConnected, error, clearError } = useGame();
  const [pin, setPin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = () => {
    const p = pin.replace(/\D/g, '').slice(0, 6);
    const name = displayName.trim();
    if (p.length < 4 || !name) return;
    setJoining(true);
    clearError();
    joinRoom(p, name);
    setTimeout(() => setJoining(false), 2000);
  };

  const pinNum = pin.replace(/\D/g, '').slice(0, 6);
  const canJoin = pinNum.length >= 4 && displayName.trim().length >= 1 && socketConnected && !joining;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <Text style={styles.title}>🎭 Fake Out</Text>
      <Text style={styles.subtitle}>Join a game</Text>

      {!socketConnected && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Connecting…</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Room PIN (e.g. 123456)"
        placeholderTextColor="#94a3b8"
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        maxLength={6}
        editable={socketConnected}
      />
      <TextInput
        style={styles.input}
        placeholder="Your name"
        placeholderTextColor="#94a3b8"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        editable={socketConnected}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, !canJoin && styles.buttonDisabled]}
        onPress={handleJoin}
        disabled={!canJoin}
      >
        {joining ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Join game</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
  },
  badge: {
    alignSelf: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 14,
    color: '#92400e',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    marginBottom: 16,
    color: '#0f172a',
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#667eea',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
