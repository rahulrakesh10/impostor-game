import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useGame } from '../context/GameContext';

export function VotingScreen() {
  const {
    gameState,
    countdown,
    selectedAnswer,
    setSelectedAnswer,
    submitVote,
    voteSubmitted,
  } = useGame();
  const players = gameState.room?.players ?? [];
  const others = players.filter((p) => p.id !== gameState.user?.id);

  if (voteSubmitted) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.timerBox, countdown <= 3 && styles.timerUrgent]}>
        <Text style={styles.timerNum}>{countdown}</Text>
        <Text style={styles.timerLabel}>seconds to vote</Text>
      </View>

      <Text style={styles.title}>Who is the fake?</Text>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {others.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.option, selectedAnswer === p.id && styles.optionSelected]}
            onPress={() => setSelectedAnswer(p.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.optionText}>{p.displayName}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.button, !selectedAnswer && styles.buttonDisabled]}
        onPress={submitVote}
        disabled={!selectedAnswer}
      >
        <Text style={styles.buttonText}>Submit vote</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 20,
    paddingTop: 48,
  },
  timerBox: {
    backgroundColor: '#e0e7ff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  timerUrgent: {
    backgroundColor: '#fecaca',
  },
  timerNum: {
    fontSize: 42,
    fontWeight: '800',
    color: '#3730a3',
  },
  timerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4f46e5',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  list: { flex: 1 };
  listContent: { paddingBottom: 16 },
  option: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  optionSelected: {
    borderColor: '#667eea',
    backgroundColor: '#eef2ff',
  },
  optionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  button: {
    backgroundColor: '#667eea',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
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
