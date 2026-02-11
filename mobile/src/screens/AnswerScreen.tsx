import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useGame } from '../context/GameContext';

export function AnswerScreen() {
  const {
    gameState,
    countdown,
    selectedAnswer,
    setSelectedAnswer,
    submitAnswer,
    answerSubmitted,
  } = useGame();
  const { currentQuestion, isFake, room } = gameState;
  const players = room?.players ?? [];
  const others = players.filter((p) => p.id !== gameState.user?.id);

  if (answerSubmitted) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.timerBox, countdown <= 3 && styles.timerUrgent]}>
        <Text style={styles.timerNum}>{countdown}</Text>
        <Text style={styles.timerLabel}>seconds to answer</Text>
      </View>

      <View style={[styles.questionBox, isFake && styles.questionFake]}>
        <Text style={styles.questionLabel}>{isFake ? '🎭 Your question' : 'Question'}</Text>
        <Text style={styles.questionText}>{currentQuestion}</Text>
      </View>

      <Text style={styles.prompt}>Who fits best? (tap to select)</Text>
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
        onPress={submitAnswer}
        disabled={!selectedAnswer}
      >
        <Text style={styles.buttonText}>Submit answer</Text>
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
    backgroundColor: '#e0f2fe',
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
    color: '#0c4a6e',
  },
  timerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369a1',
    textTransform: 'uppercase',
  },
  questionBox: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#0ea5e9',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  questionFake: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 28,
  },
  prompt: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 12,
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
