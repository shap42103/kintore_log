import { Feather, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert, Platform, Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
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
  const [reps, setReps] = useState<number>(0);
  const [sets, setSets] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
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
      setReps(Number(first.reps));
      setSets(Number(first.sets));
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
          reps,
          sets,
          notes,
        },
      ]);

      setWeight('');
      setReps(0);
      setSets(0);
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
    <View style={styles.container}>
      <View style={styles.voiceBlock}>
        <View style={styles.voiceHeader}>
          <Feather name="file-text" size={16} color="#3f3aa8" />
          <Text style={styles.voiceTitle}>トレーニング内容</Text>
        </View>

        <View style={styles.voiceInputWrap}>
          <TextInput
            multiline={true}
            numberOfLines={2}
            style={styles.voiceTextArea}
            value={voiceText}
            onChangeText={setVoiceText}
            placeholder="例：ベンチ60kg 10x3、調子良し"
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
        <Text style={styles.label}>日時</Text>
        <View style={styles.dateRow}>
          <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={{ fontSize: 20, fontWeight: '400', color: '#111' }}>{formatDateLabel}</Text>
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={new Date(date)}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(event, selected) => {
                // Android: event.type === 'dismissed' when cancelled and selected is undefined.
                if (Platform.OS !== 'ios') {
                  if (event?.type === 'dismissed' || !selected) {
                    setShowDatePicker(false);
                    return;
                  }
                }

                const current = selected || new Date(date);
                const y = current.getFullYear();
                const m = String(current.getMonth() + 1).padStart(2, '0');
                const d = String(current.getDate()).padStart(2, '0');
                setDate(`${y}-${m}-${d}`);
                if (Platform.OS !== 'ios') setShowDatePicker(false);
              }}
            />
          )}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>種目</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={exerciseId ?? (exercises[0]?.id ?? 0)}
            onValueChange={(value) => setExerciseId(Number(value))}
            style={{ color: '#111', fontSize: 18, height: 56, fontWeight: '700' }}
            itemStyle={{ color: '#111', fontSize: 18, height: 56, fontWeight: '700' }}
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
          <View style={styles.metricPickerWrapper}>
            <Picker selectedValue={reps} onValueChange={(v) => setReps(Number(v))} style={{ color: '#111', fontSize: 18, height: 56, fontWeight: '700' }} itemStyle={{ color: '#111', fontSize: 18, height: 56, fontWeight: '700' }}>
              {Array.from({ length: 51 }).map((_, i) => (
                <Picker.Item key={i} label={String(i)} value={i} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.metricBox}>
          <Text style={styles.label}>セット</Text>
          <View style={styles.metricPickerWrapper}>
            <Picker selectedValue={sets} onValueChange={(v) => setSets(Number(v))} style={{ color: '#111', fontSize: 18, height: 56, fontWeight: '700' }} itemStyle={{ color: '#111', fontSize: 18, height: 56, fontWeight: '700' }}>
              {Array.from({ length: 21 }).map((_, i) => (
                <Picker.Item key={i} label={String(i)} value={i} />
              ))}
            </Picker>
          </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    paddingTop: 6,
    paddingBottom: 80,
    gap: 12,
    backgroundColor: '#f4f4f5',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#14151e',
    marginTop: 6,
  },
  voiceBlock: {
    backgroundColor: '#dfe3f4',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#d3d9f1',
    gap: 8,
  },
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voiceTitle: {
    color: '#2f339f',
    fontWeight: '700',
    fontSize: 12,
  },
  voiceInputWrap: {
    position: 'relative',
  },
  voiceTextArea: {
    minHeight: 64,
    borderColor: '#d4d5dc',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingRight: 48,
    backgroundColor: '#fff',
    fontSize: 14,
    color: '#1f2430',
    textAlignVertical: 'top',
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
    borderRadius: 10,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4d3ff0',
  },
  parseButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  fieldGroup: {
    gap: 6,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontWeight: '700',
    color: '#30303a',
    fontSize: 16,
  },
  muted: {
    color: '#74757d',
    fontWeight: '500',
    fontSize: 14,
  },
  noteOptional: {
    color: '#92939a',
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4d5dc',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    color: '#10111a',
    fontSize: 15,
    fontWeight: '600',
    minHeight: 56,
    justifyContent: 'center',
  },
  dateRow: {
    position: 'relative',
  },
  
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#d4d5dc',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#fff',
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: 4,
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
    borderRadius: 12,
    backgroundColor: '#fff',
    minHeight: 64,
    paddingVertical: 8,
    fontSize: 18,
    lineHeight: 22,
    color: '#1b1c26',
    fontWeight: '400',
    textAlign: 'left',
    paddingHorizontal: 12,
    textAlignVertical: 'center',
  },
  metricPickerWrapper: {
    borderWidth: 1,
    borderColor: '#d4d5dc',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  notesArea: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#d4d5dc',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
    color: '#1b1c26',
    fontSize: 14,
  },
  saveButton: {
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151721',
    marginTop: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  errorText: {
    color: '#d64545',
    fontSize: 18,
  },
});
