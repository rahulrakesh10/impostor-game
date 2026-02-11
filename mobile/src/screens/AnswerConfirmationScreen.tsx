import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGame } from '../context/GameContext';

export function AnswerConfirmationScreen() {
  const { gameState, countdown, selectedAnswer } = useGame();
  const players = gameState.room?.players ?? [];
  const selected = players.find((p) => p.id === selectedAnswer);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Answer submitted</Text>
      <View style={styles.card}>
        <Text style={styles.label}>You chose</Text>
        <Text style={styles.name}>{selected?.displayName ?? '—'}</Text>
      </View>
      <Text style={styles.timer}>Next: {countdown}s</Text>
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
    backgroundColor: '#dcfce7',
    padding: 24,
    borderRadius: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  label: { fontSize: 14, color: '#166534', marginBottom: 8 },
  name: { fontSize: 22, fontWeight: '800', color: '#14532d' },
  timer: {
    marginTop: 32,
    fontSize: 18,
    color: '#64748b',
  },
});
