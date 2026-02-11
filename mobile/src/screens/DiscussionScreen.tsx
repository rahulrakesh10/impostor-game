import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useGame } from '../context/GameContext';

export function DiscussionScreen() {
  const { gameState, countdown } = useGame();
  const { currentQuestion } = gameState;

  return (
    <View style={styles.container}>
      <View style={styles.timerBox}>
        <Text style={styles.timerNum}>{countdown}</Text>
        <Text style={styles.timerLabel}>seconds to discuss</Text>
      </View>
      <Text style={styles.title}>Discuss</Text>
      <View style={styles.questionBox}>
        <Text style={styles.questionText}>{currentQuestion}</Text>
      </View>
      <Text style={styles.hint}>Compare answers and find who doesn’t fit.</Text>
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
  timerBox: {
    backgroundColor: '#dcfce7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  timerNum: { fontSize: 36, fontWeight: '800', color: '#166534' },
  timerLabel: { fontSize: 12, fontWeight: '600', color: '#15803d', textTransform: 'uppercase' },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  questionBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#86efac',
    marginBottom: 24,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 28,
  },
  hint: {
    fontSize: 16,
    color: '#64748b',
  },
});
