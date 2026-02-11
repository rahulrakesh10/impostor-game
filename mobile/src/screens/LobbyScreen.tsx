import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useGame } from '../context/GameContext';

export function LobbyScreen() {
  const { gameState } = useGame();
  const { room, user } = gameState;
  const players = room?.players ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Room PIN: {room?.pin}</Text>
      <Text style={styles.subtitle}>Waiting for host to start…</Text>
      <Text style={styles.you}>You: {user?.displayName}</Text>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <Text style={styles.heading}>Players ({players.length})</Text>
        {players.map((p) => (
          <View key={p.id} style={styles.row}>
            <Text style={styles.dot}>{p.status === 'connected' ? '🟢' : '🟡'}</Text>
            <Text style={styles.name}>{p.displayName}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  you: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 24,
  },
  list: { flex: 1 };
  listContent: { paddingBottom: 24 },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  dot: { marginRight: 10 },
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
});
