import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGame } from '../context/GameContext';

export function VoteConfirmationScreen() {
  const { gameState, countdown, selectedAnswer } = useGame();
  const players = gameState.room?.players ?? [];
  const selected = players.find((p) => p.id === selectedAnswer);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vote submitted</Text>
      <View style={styles.card}>
        <Text style={styles.label}>You voted for</Text>
        <Text style={styles.name}>{selected?.displayName ?? '—'}</Text>
      </View>
      <Text style={styles.timer}>Results in: {countdown}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#e0e7ff',
    padding: 24,
    borderRadius: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  label: { fontSize: 14, color: '#3730a3', marginBottom: 8 },
  name: { fontSize: 22, fontWeight: '800', color: '#312e81' },
  timer: {
    marginTop: 32,
    fontSize: 18,
    color: '#64748b',
  },
});
