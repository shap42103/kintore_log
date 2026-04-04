import { Feather, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSpeechToText } from '../hooks/useSpeechToText';
import type { Exercise } from '../types';

type Values = {
  date: string;
  exerciseId: number;
  weight: string;
  reps: number;
  sets: number;
  notes: string;
};

type Props = {
  exercises: Exercise[];
  initial?: Partial<Values>;
  onAnalyze?: (voiceText: string, applyParsed: (vals: Partial<Values>) => void) => Promise<void> | void;
  onSave: (vals: Values) => Promise<void> | void;
  saveLabel?: string;
  onClose?: () => void;
};

export default function TrainingForm({ exercises, initial = {}, onAnalyze, onSave, saveLabel = '記録を保存する', onClose }: Props) {
  const [date, setDate] = useState(initial.date ?? new Date().toISOString().slice(0, 10));
  const [exerciseId, setExerciseId] = useState<number>(initial.exerciseId ?? (exercises[0]?.id ?? 0));
  const [weight, setWeight] = useState(initial.weight ?? '');
  const [reps, setReps] = useState<number>(initial.reps ?? 0);
  const [sets, setSets] = useState<number>(initial.sets ?? 0);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [voiceText, setVoiceText] = useState(initial['voiceText' as keyof typeof initial] ?? '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const speech = useSpeechToText();
  const [committedVoice, setCommittedVoice] = useState('');
  const lastAppendedRef = useRef('');
  const pauseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current as unknown as number);
      }
    };
  }, []);

  useEffect(() => {
    if (speech.isListening) {
      const combined = committedVoice ? `${committedVoice} ${speech.transcript}` : speech.transcript;
      setVoiceText(combined.trim());

      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current as unknown as number);
      }
      if (speech.transcript) {
        pauseTimerRef.current = setTimeout(() => {
          if (lastAppendedRef.current !== speech.transcript) {
            setCommittedVoice((prev) => {
              const next = prev ? `${prev} ${speech.transcript}` : speech.transcript;
              setVoiceText(next.trim());
              lastAppendedRef.current = speech.transcript;
              return next;
            });
          }
          speech.clear();
        }, 1500) as unknown as number;
      }

      return;
    }

    if (!speech.isListening && speech.transcript) {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current as unknown as number);
        pauseTimerRef.current = null;
      }
      if (lastAppendedRef.current !== speech.transcript) {
        setCommittedVoice((prev) => {
          const next = prev ? `${prev} ${speech.transcript}` : speech.transcript;
          setVoiceText(next.trim());
          lastAppendedRef.current = speech.transcript;
          return next;
        });
      }
      speech.clear();
    }
  }, [speech.isListening, speech.transcript, committedVoice, speech]);

  const formatDateLabel = useMemo(() => date.replace(/-/g, '/'), [date]);

  const canAnalyze = useMemo(() => voiceText.trim().length > 0 && exercises.length > 0, [voiceText, exercises.length]);
  const canSave = useMemo(() => date.trim().length > 0 && !!exerciseId && Number(weight) > 0 && Number(reps) > 0 && Number(sets) > 0, [date, exerciseId, weight, reps, sets]);

  const applyParsed = (first: any) => {
    if (!first) return;
    setDate(first.date);
    const matched = exercises.find((e) => e.name === first.exercise);
    if (matched) setExerciseId(matched.id);
    setWeight(String(first.weight ?? ''));
    setReps(Number(first.reps ?? 0));
    setSets(Number(first.sets ?? 0));
    setNotes(first.notes ?? '');
  };

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
          disabled={!canAnalyze || isParsing || !onAnalyze}
          style={[styles.parseButton, (!canAnalyze || isParsing || !onAnalyze) && styles.buttonDisabled]}
          onPress={async () => {
            if (!onAnalyze) return;
            setIsParsing(true);
            try {
              await onAnalyze(voiceText, (parsed) => {
                applyParsed(parsed);
              });
            } catch (e) {
              const message = e instanceof Error ? e.message : '解析に失敗しました。';
              Alert.alert('解析エラー', message);
            } finally {
              setIsParsing(false);
            }
          }}
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
          <Picker selectedValue={exerciseId} onValueChange={(value) => setExerciseId(Number(value))} style={{ color: '#111', fontSize: 18, height: 56, fontWeight: '700' }} itemStyle={{ color: '#111', fontSize: 18, height: 56, fontWeight: '700' }}>
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
          <TextInput style={styles.metricInput} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="0.0" />
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
        <TextInput multiline style={styles.notesArea} value={notes} onChangeText={setNotes} placeholder="気づいたことなど..." />
      </View>

      <Pressable disabled={!canSave || isSaving} style={[styles.saveButton, (!canSave || isSaving) && styles.buttonDisabled]} onPress={async () => {
        if (!canSave) {
          Alert.alert('入力エラー', '日付・種目・重量・回数・セットを入力してください。');
          return;
        }
        setIsSaving(true);
        try {
          await onSave({ date, exerciseId, weight, reps, sets, notes });
        } catch (e) {
          const message = e instanceof Error ? e.message : '保存に失敗しました。';
          Alert.alert('保存エラー', message);
        } finally {
          setIsSaving(false);
        }
      }}>
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{saveLabel}</Text>}
      </Pressable>

      {onClose ? (
        <Pressable style={[styles.saveButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', marginTop: 8 }]} onPress={onClose}>
          <Text style={{ color: '#333' }}>閉じる</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    paddingTop: 6,
    paddingBottom: 24,
    gap: 12,
    backgroundColor: '#f4f4f5',
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
