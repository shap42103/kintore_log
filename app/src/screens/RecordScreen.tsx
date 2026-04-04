import { Feather, Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { addHistories, getExercises } from '../db/database';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { parseTrainingWithGemini } from '../services/geminiService';
import type { Exercise } from '../types';

export function RecordScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [voiceText, setVoiceText] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState('');
  const [notes, setNotes] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const speech = useSpeechToText();

  useEffect(() => {
    if (speech.transcript) {
      setVoiceText(speech.transcript);
    }
  }, [speech.transcript]);

  const reloadExercises = useCallback(async () => {
    const list = await getExercises();
    setExercises(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reloadExercises();
    }, [reloadExercises]),
  );

  useEffect(() => {
    if (exerciseId === null && exercises.length > 0) {
      setExerciseId(exercises[0].id);
    }
  }, [exerciseId, exercises]);

  const canAnalyze = useMemo(() => voiceText.trim().length > 0 && exercises.length > 0, [voiceText, exercises.length]);
  const canSave = useMemo(() => {
    return date.trim().length > 0 && !!exerciseId && Number(weight) > 0 && Number(reps) > 0 && Number(sets) > 0;
  }, [date, exerciseId, weight, reps, sets]);

  const onAnalyzeVoice = useCallback(async () => {
    if (!canAnalyze) {
      return;
    }

    setIsParsing(true);
    try {
      const result = await parseTrainingWithGemini(voiceText, exercises);
      const first = result[0];
      if (!first) {
        Alert.alert('解析結果なし', '入力から記録可能なデータを抽出できませんでした。');
        return;
      }

      const matchedExercise = exercises.find((entry) => entry.name === first.exercise);
      if (!matchedExercise) {
        Alert.alert('種目エラー', `種目「${first.exercise}」が未登録です。設定画面で追加してください。`);
        return;
      }

      setDate(first.date);
      setExerciseId(matchedExercise.id);
      setWeight(String(first.weight));
      setReps(String(first.reps));
      setSets(String(first.sets));
      setNotes(first.notes ?? '');
    } catch (error) {
      const message = error instanceof Error ? error.message : '解析に失敗しました。';
      Alert.alert('解析エラー', message);
    } finally {
      setIsParsing(false);
    }
  }, [canAnalyze, exercises, voiceText]);

  const onSave = useCallback(async () => {
    if (!canSave || !exerciseId) {
      Alert.alert('入力エラー', '日付・種目・重量・回数・セットを入力してください。');
      return;
    }

    setIsSaving(true);
    try {
      await addHistories([
        {
          date,
          exerciseId,
          weight: Number(weight),
          reps: Number(reps),
          sets: Number(sets),
          notes,
        },
      ]);

      setWeight('');
      setReps('');
      setSets('');
      setNotes('');
      setVoiceText('');
      speech.clear();
      Alert.alert('保存完了', 'トレーニング記録を保存しました。');
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存に失敗しました。';
      Alert.alert('保存エラー', message);
    } finally {
      setIsSaving(false);
    }
  }, [canSave, date, exerciseId, weight, reps, sets, notes, speech]);

  const formatDateLabel = useMemo(() => date.replace(/-/g, '/'), [date]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>トレーニング記録</Text>

      <View style={styles.voiceBlock}>
        <View style={styles.voiceHeader}>
          <Feather name="mic" size={16} color="#3f3aa8" />
          <Text style={styles.voiceTitle}>AI音声入力（テスト用モック）</Text>
        </View>

        <View style={styles.voiceInputWrap}>
          <TextInput
            multiline
            style={styles.voiceTextArea}
            value={voiceText}
            onChangeText={setVoiceText}
            placeholder="例：今日、ベンチプレス60kgを10回3セット、調子よかった"
          />
          <Pressable
            style={[styles.micFab, speech.isListening ? styles.micFabDanger : styles.micFabPrimary]}
            onPress={speech.isListening ? speech.stop : speech.start}
          >
            <Ionicons name="mic" size={18} color="#fff" />
          </Pressable>
        </View>

        <Pressable
          disabled={!canAnalyze || isParsing}
          style={[styles.parseButton, (!canAnalyze || isParsing) && styles.buttonDisabled]}
          onPress={onAnalyzeVoice}
        >
          {isParsing ? <ActivityIndicator color="#fff" /> : <Text style={styles.parseButtonText}>テキストを解析</Text>}
        </Pressable>

        {speech.error ? <Text style={styles.errorText}>{speech.error}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>年月日</Text>
        <View style={styles.dateRow}>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
          <Text style={styles.datePreview}>{formatDateLabel}</Text>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>種目</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={exerciseId ?? 0}
            onValueChange={(value) => setExerciseId(Number(value))}
          >
            {exercises.map((exercise) => (
              <Picker.Item key={exercise.id} label={exercise.name} value={exercise.id} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricBox}>
          <Text style={styles.label}>
            重量 <Text style={styles.muted}>(kg)</Text>
          </Text>
          <TextInput
            style={styles.metricInput}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="0.0"
          />
        </View>

        <View style={styles.metricBox}>
          <Text style={styles.label}>回数</Text>
          <TextInput
            style={styles.metricInput}
            value={reps}
            onChangeText={setReps}
            keyboardType="number-pad"
            placeholder="0"
          />
        </View>

        <View style={styles.metricBox}>
          <Text style={styles.label}>セット</Text>
          <TextInput
            style={styles.metricInput}
            value={sets}
            onChangeText={setSets}
            keyboardType="number-pad"
            placeholder="0"
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <View style={styles.notesHeader}>
          <Text style={styles.label}>備考</Text>
          <Text style={styles.noteOptional}>任意</Text>
        </View>
        <TextInput
          multiline
          style={styles.notesArea}
          value={notes}
          onChangeText={setNotes}
          placeholder="気づいたことなど..."
        />
      </View>

      <Pressable
        disabled={!canSave || isSaving}
        style={[styles.saveButton, (!canSave || isSaving) && styles.buttonDisabled]}
        onPress={onSave}
      >
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>記録を保存する</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 96,
    gap: 18,
    backgroundColor: '#f4f4f5',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#14151e',
    marginTop: 6,
  },
  voiceBlock: {
    backgroundColor: '#dfe3f4',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d3d9f1',
    gap: 10,
  },
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voiceTitle: {
    color: '#2f339f',
    fontWeight: '700',
    fontSize: 17,
  },
  voiceInputWrap: {
    position: 'relative',
  },
  voiceTextArea: {
    minHeight: 108,
    borderColor: '#d4d5dc',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 54,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
    fontSize: 18,
    color: '#1f2430',
  },
  micFab: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micFabPrimary: {
    backgroundColor: '#4d3ff0',
  },
  micFabDanger: {
    backgroundColor: '#d64545',
  },
  parseButton: {
    borderRadius: 12,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4d3ff0',
  },
  parseButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontWeight: '700',
    color: '#30303a',
    fontSize: 32,
  },
  muted: {
    color: '#74757d',
    fontWeight: '500',
    fontSize: 20,
  },
  noteOptional: {
    color: '#92939a',
    fontSize: 22,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4d5dc',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    color: '#10111a',
    fontSize: 26,
    fontWeight: '600',
  },
  dateRow: {
    position: 'relative',
  },
  datePreview: {
    position: 'absolute',
    right: 14,
    top: 16,
    fontSize: 22,
    color: '#11121b',
    fontWeight: '700',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#d4d5dc',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricBox: {
    flex: 1,
    gap: 8,
  },
  metricInput: {
    borderWidth: 1,
    borderColor: '#d4d5dc',
    borderRadius: 14,
    backgroundColor: '#fff',
    minHeight: 54,
    fontSize: 26,
    color: '#1b1c26',
    fontWeight: '600',
    textAlign: 'center',
  },
  notesArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#d4d5dc',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
    color: '#1b1c26',
    fontSize: 22,
  },
  saveButton: {
    borderRadius: 14,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151721',
    marginTop: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 28,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  errorText: {
    color: '#d64545',
    fontSize: 18,
  },
});
