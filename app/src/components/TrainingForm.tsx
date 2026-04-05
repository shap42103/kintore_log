import { Feather, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import COLORS from '../constants/colors';
import FONT_SIZES from '../constants/fontSizes';
import FONT_WEIGHTS from '../constants/fontWeights';
import SPACING from '../constants/spacing';
import { useSpeechToText } from '../hooks/useSpeechToText';
import type { Exercise } from '../types';

type Values = {
  date: string;
  exerciseId: number;
  weight: string;
  isBodyweight?: boolean;
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
  metricFlexes?: { weight?: number; reps?: number; sets?: number };
  debugShowParsed?: boolean;
};

export default function TrainingForm({ exercises, initial = {}, onAnalyze, onSave, saveLabel = '記録を保存する', onClose, metricFlexes, debugShowParsed }: Props) {
  const [debugCandidate, setDebugCandidate] = useState<Partial<Values> | null>(null);
  const [debugModalVisible, setDebugModalVisible] = useState(false);
  const [date, setDate] = useState(initial.date ?? new Date().toISOString().slice(0, 10));
  // default to 0 = no selection so Record screen starts with empty exercise
  const [exerciseId, setExerciseId] = useState<number>(initial.exerciseId ?? 0);
  const [weight, setWeight] = useState(initial.weight ?? '');
  const [isBodyweight, setIsBodyweight] = useState<boolean>(
    (initial as any).isBodyweight ?? false,
  );

  // If initial or later isBodyweight is true, ensure weight input is cleared
  useEffect(() => {
    if (isBodyweight && weight) {
      setWeight('');
    }
  }, [isBodyweight]);
  const [reps, setReps] = useState<number>(initial.reps ?? 0);
  const [sets, setSets] = useState<number>(initial.sets ?? 0);
  const [pickerKey, setPickerKey] = useState(0);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [voiceText, setVoiceText] = useState<string>(String((initial as any)['voiceText'] ?? ''));
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
  const canSave = useMemo(
    () =>
      date.trim().length > 0 &&
      !!exerciseId &&
      (isBodyweight || Number(weight) > 0) &&
      Number(reps) > 0 &&
      Number(sets) > 0,
    [date, exerciseId, weight, reps, sets, isBodyweight],
  );

  const applyParsed = (first: any) => {
    if (!first) return;
    setDate(first.date ?? date);
    // Accept either exerciseId (from caller) or exercise name (from parser)
    if (typeof first.exerciseId === 'number' && first.exerciseId > 0) {
      setExerciseId(Number(first.exerciseId));
    } else {
      const matched = exercises.find((e) => e.name === first.exercise);
      if (matched) setExerciseId(matched.id);
    }
    // If parsed indicates bodyweight, clear weight regardless of parsed weight
    if (first.isBodyweight) {
      setWeight('');
    } else {
      setWeight(String(first.weight ?? ''));
    }
    setIsBodyweight(!!first.isBodyweight);
    setReps(Number(first.reps ?? 0));
    setSets(Number(first.sets ?? 0));
    setNotes(first.notes ?? '');
    setPickerKey((k) => k + 1);
  };

  // Debug modal: show parsed result for manual apply/inspect
  const handleDebugApply = (apply: boolean) => {
    if (!debugCandidate) return;
    if (apply) {
      applyParsed(debugCandidate as any);
    }
    setDebugCandidate(null);
    setDebugModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.voiceBlock}>
        <View style={styles.voiceHeader}>
          <Feather name="file-text" size={16} color={COLORS.mutedAccent} />
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
            <Ionicons name="mic" size={18} color={COLORS.white} />
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
                // If debug modal enabled, show parsed data first for confirmation
                if ((debugShowParsed as unknown as boolean) === true) {
                  setDebugCandidate(parsed);
                  setDebugModalVisible(true);
                } else {
                  applyParsed(parsed);
                }
              });
            } catch (e) {
              const message = e instanceof Error ? e.message : '解析に失敗しました。';
              Alert.alert('解析エラー', message);
            } finally {
              setIsParsing(false);
            }
          }}
        >
          {isParsing ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.parseButtonText}>テキストを解析</Text>}
        </Pressable>

        {speech.error ? <Text style={styles.errorText}>{speech.error}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>日時</Text>
        <View style={styles.dateRow}>
          <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={{ fontSize: FONT_SIZES.xl, fontWeight: FONT_WEIGHTS.regular, color: COLORS.textBlack }}>{formatDateLabel}</Text>
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
          <Picker selectedValue={exerciseId} onValueChange={(value) => setExerciseId(Number(value))} style={{ color: COLORS.textBlack, fontSize: FONT_SIZES.lg, height: 56, fontWeight: FONT_WEIGHTS.bold }} itemStyle={{ color: COLORS.textBlack, fontSize: FONT_SIZES.lg, height: 56, fontWeight: FONT_WEIGHTS.bold }}>
            <Picker.Item label="種目を選択" value={0} />
            {exercises.map((exercise) => (
              <Picker.Item key={exercise.id} label={exercise.name} value={exercise.id} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={[styles.metricBox, { flex: metricFlexes?.weight ?? 1.4, alignItems: 'flex-start', position: 'relative' }]}>
          <Text style={styles.label}>
              重量 <Text style={styles.muted}>(kg)</Text>
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
            <TextInput
              style={[styles.metricInput, { flex: 1 }, isBodyweight && { opacity: 0.6 }]}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="0.0"
              editable={!isBodyweight}
            />
            <Pressable
              onPress={() =>
                setIsBodyweight((s) => {
                  const next = !s;
                  if (next) {
                    setWeight('');
                  }
                  return next;
                })
              }
              style={{ padding: SPACING.sm, borderRadius: 8, backgroundColor: isBodyweight ? COLORS.accent : COLORS.bgMuted, marginRight: SPACING.xs }}
            >x
              <Text style={{ color: isBodyweight ? COLORS.white : COLORS.textDarkAlt, fontWeight: FONT_WEIGHTS.bold }}>自重</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.metricBox, { flex: metricFlexes?.reps ?? 1.0, alignItems: 'flex-end' }]}>
          <Text style={[styles.label, { alignSelf: 'flex-start' }]}>回数</Text>
          <View style={[styles.metricPickerWrapper, { width: '100%', alignItems: 'flex-end' }]}>
            <Picker key={'reps-' + pickerKey} selectedValue={reps} onValueChange={(v) => setReps(Number(v))} style={{ width: 84, color: COLORS.textBlack, fontSize: FONT_SIZES.lg, height: 56, fontWeight: FONT_WEIGHTS.bold, textAlign: 'right' }} itemStyle={{ color: COLORS.textBlack, fontSize: FONT_SIZES.lg, height: 56, fontWeight: FONT_WEIGHTS.bold }}>
                {Array.from({ length: 21 }).map((_, i) => (
                  <Picker.Item key={i} label={String(i)} value={i} />
                ))}
            </Picker>
          </View>
        </View>

        <View style={[styles.metricBox, { flex: metricFlexes?.sets ?? 1.0, alignItems: 'flex-end' }]}>
          <Text style={[styles.label, { alignSelf: 'flex-start' }]}>セット</Text>
          <View style={[styles.metricPickerWrapper, { width: '100%', alignItems: 'flex-end' }]}>
            <Picker key={'sets-' + pickerKey} selectedValue={sets} onValueChange={(v) => setSets(Number(v))} style={{ width: 84, color: COLORS.textBlack, fontSize: FONT_SIZES.lg, height: 56, fontWeight: FONT_WEIGHTS.bold, textAlign: 'right' }} itemStyle={{ color: COLORS.textBlack, fontSize: FONT_SIZES.lg, height: 56, fontWeight: FONT_WEIGHTS.bold }}>
                {Array.from({ length: 11 }).map((_, i) => (
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
          await onSave({ date, exerciseId, weight, isBodyweight, reps, sets, notes });
        } catch (e) {
          const message = e instanceof Error ? e.message : '保存に失敗しました。';
          Alert.alert('保存エラー', message);
        } finally {
          setIsSaving(false);
        }
      }}>
        {isSaving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveButtonText}>{saveLabel}</Text>}
      </Pressable>

      {onClose ? (
        <Pressable style={[styles.saveButton, { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.mutedBorder, marginTop: SPACING.sm }]} onPress={onClose}>
          <Text style={{ color: COLORS.textDarkAlt }}>閉じる</Text>
        </Pressable>
      ) : null}
      <Modal visible={debugModalVisible} animationType="slide" onRequestClose={() => setDebugModalVisible(false)}>
        <ScrollView contentContainerStyle={{ padding: SPACING.xl }}>
          <Text style={{ fontWeight: FONT_WEIGHTS.bold, fontSize: FONT_SIZES.lg, marginBottom: SPACING.sm }}>解析結果（デバッグ）</Text>
          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: COLORS.codeBg, padding: SPACING.lg, borderRadius: 8 }}>{JSON.stringify(debugCandidate ?? {}, null, 2)}</Text>
          <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
            <Pressable style={[styles.saveButton, { flex: 1 }]} onPress={() => handleDebugApply(true)}>
              <Text style={styles.saveButtonText}>適用する</Text>
            </Pressable>
              <Pressable style={[styles.saveButton, { flex: 1, backgroundColor: COLORS.mutedBorder }]} onPress={() => handleDebugApply(false)}>
                <Text style={{ color: COLORS.textDarkAlt, fontWeight: FONT_WEIGHTS.bold }}>破棄</Text>
              </Pressable>
          </View>
          <Pressable style={{ marginTop: SPACING.lg }} onPress={() => setDebugModalVisible(false)}>
            <Text style={{ color: COLORS.textGray }}>閉じる</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.lg,
    paddingTop: SPACING.xxs,
    paddingBottom: SPACING.xxl,
    gap: SPACING.lg,
    backgroundColor: COLORS.surface,
  },
  voiceBlock: {
    backgroundColor: COLORS.borderLighter,
    borderRadius: 12,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderGray,
    gap: SPACING.sm,
  },
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  voiceTitle: {
    color: COLORS.accentDark,
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES.xs,
  },
  voiceInputWrap: {
    position: 'relative',
  },
  voiceTextArea: {
    minHeight: 64,
    borderColor: COLORS.borderGray2,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingRight: SPACING.huge,
    backgroundColor: COLORS.white,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textDark3,
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
    backgroundColor: COLORS.accent,
  },
  micFabDanger: {
    backgroundColor: COLORS.dangerAlt,
  },
  parseButton: {
    borderRadius: 10,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
  },
  parseButtonText: {
    color: COLORS.white,
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES.xxs,
  },
  fieldGroup: {
    gap: SPACING.xxs,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.textMutedLight,
    fontSize: FONT_SIZES.md,
  },
  muted: {
    color: COLORS.textMuted,
    fontWeight: FONT_WEIGHTS.medium,
    fontSize: FONT_SIZES.sm,
  },
  noteOptional: {
    color: COLORS.textMutedLight,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.borderGray2,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    color: COLORS.textBlack,
    fontSize: FONT_SIZES.base,
    fontWeight: FONT_WEIGHTS.semibold,
    minHeight: 56,
    justifyContent: 'center',
  },
  dateRow: {
    position: 'relative',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: COLORS.borderGray2,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  metricBox: {
    flex: 1,
    gap: SPACING.sm,
  },
  metricInput: {
    borderWidth: 1,
    borderColor: COLORS.borderGray2,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    minHeight: 64,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.lg,
    lineHeight: 22,
    color: COLORS.textDark3,
    fontWeight: FONT_WEIGHTS.regular,
    textAlign: 'left',
    paddingHorizontal: SPACING.lg,
    textAlignVertical: 'center',
  },
  metricPickerWrapper: {
    borderWidth: 1,
    borderColor: COLORS.borderGray2,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
  },
  notesArea: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: COLORS.borderGray2,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    textAlignVertical: 'top',
    backgroundColor: COLORS.white,
    color: COLORS.textDark3,
    fontSize: FONT_SIZES.sm,
  },
  saveButton: {
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgDark,
    marginTop: SPACING.xxs,
  },
  saveButtonText: {
    color: COLORS.white,
    fontWeight: FONT_WEIGHTS.bold,
    fontSize: FONT_SIZES.lg,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  errorText: {
    color: COLORS.dangerAlt,
    fontSize: FONT_SIZES.lg,
  },
});

