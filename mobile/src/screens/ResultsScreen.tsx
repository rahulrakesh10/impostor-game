import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useGame } from '../context/GameContext';

export function ResultsScreen() {
  const { gameState, countdown } = useGame();
  const { lastResult, scores, room } = gameState;
  const players = room?.players ?? [];
  const fake = lastResult ? players.find((p) => p.id === lastResult.fakeId) : null;
  const sorted = [...(scores ?? [])].sort((a, b) => b.score - a.score);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.reveal}>
        <Text style={styles.revealTitle}>The fake was</Text>
        <Text style={styles.fakeName}>{fake?.displayName ?? '—'}</Text>
        <Text style={[styles.outcome, lastResult?.fakeCaught ? styles.caught : styles.escaped]}>
          {lastResult?.fakeCaught ? '✅ Fake caught!' : '❌ Fake escaped!'}
        </Text>
      </View>
      {lastResult?.fakeQuestion ? (
        <View style={styles.fakeQ}>
          <Text style={styles.fakeQLabel}>Impostor’s question</Text>
          <Text style={styles.fakeQText}>{lastResult.fakeQuestion}</Text>
        </View>
      ) : null}
      <Text style={styles.leaderTitle}>Leaderboard</Text>
      {sorted.map((s, i) => (
        <View key={s.userId} style={[styles.row, i === 0 && styles.rowWinner]}>
          <Text style={styles.rank}>#{i + 1}</Text>
          <Text style={styles.name} numberOfLines={1}>{s.displayName}</Text>
          <Text style={styles.score}>{s.score}</Text>
        </View>
      ))}
      <Text style={styles.next}>Next round in {countdown}s</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 24, paddingTop: 48, paddingBottom: 48 },
  reveal: {
    backgroundColor: '#fef3c7',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  revealTitle: { fontSize: 16, color: '#92400e', marginBottom: 8 },
  fakeName: { fontSize: 28, fontWeight: '800', color: '#78350f' },
  outcome: { fontSize: 20, fontWeight: '700', marginTop: 12 },
  caught: { color: '#15803d' },
  escaped: { color: '#dc2626' },
  fakeQ: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  fakeQLabel: { fontSize: 12, color: '#b45309', marginBottom: 6 },
  fakeQText: { fontSize: 16, fontWeight: '600', color: '#78350f' },
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
  next: {
    marginTop: 24,
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
});
