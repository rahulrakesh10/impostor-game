import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useGame } from '../context/GameContext';

export function GameEndScreen() {
  const { gameState } = useGame();
  const scores = gameState.scores ?? [];
  const sorted = [...scores].sort((a, b) => b.score - a.score);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Game over</Text>
      <Text style={styles.leaderTitle}>Final scores</Text>
      {sorted.map((s, i) => (
        <View key={s.userId} style={[styles.row, i === 0 && styles.rowWinner]}>
          <Text style={styles.rank}>#{i + 1}</Text>
          <Text style={styles.name} numberOfLines={1}>{s.displayName}</Text>
          <Text style={styles.score}>{s.score}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 24, paddingTop: 48, paddingBottom: 48 },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 32,
  },
  leaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
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
  rowWinner: {
    backgroundColor: '#fef9c3',
    borderWidth: 2,
    borderColor: '#facc15',
  },
  rank: { fontSize: 16, fontWeight: '700', color: '#667eea', width: 36 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: '#0f172a' },
  score: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
});
