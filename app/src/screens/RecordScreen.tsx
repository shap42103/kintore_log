import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import TrainingForm from '../components/TrainingForm';
import COLORS from '../constants/colors';
import { addHistories, getExercises } from '../db/database';
import { parseTrainingWithGemini } from '../services/geminiService';
import type { Exercise } from '../types';

export function RecordScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);

  

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
    // no-op: TrainingForm will pick first exercise if needed
  }, [exercises]);

  const onAnalyze = useCallback(async (voiceText: string, applyParsed: (vals: any) => void) => {
    if (!voiceText || exercises.length === 0) return;
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

      applyParsed({
        date: first.date,
        exerciseId: matchedExercise.id,
        weight: String(first.weight ?? ''),
        isBodyweight: !!first.isBodyweight,
        reps: Number(first.reps),
        sets: Number(first.sets),
        notes: first.notes ?? '',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '解析に失敗しました。';
      Alert.alert('解析エラー', message);
    }
  }, [exercises]);

  const onSaveForm = useCallback(async (vals: { date: string; exerciseId: number; weight: string; isBodyweight?: boolean; reps: number; sets: number; notes: string }) => {
    try {
      await addHistories([
        {
          date: vals.date,
          exerciseId: vals.exerciseId,
          weight: vals.isBodyweight ? null : Number(vals.weight),
          isBodyweight: !!vals.isBodyweight,
          reps: vals.reps,
          sets: vals.sets,
          notes: vals.notes,
        },
      ]);
      Alert.alert('保存完了', 'トレーニング記録を保存しました。');
    } catch (e) {
      const message = e instanceof Error ? e.message : '保存に失敗しました。';
      Alert.alert('保存エラー', message);
    }
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <TrainingForm exercises={exercises} onAnalyze={onAnalyze} onSave={onSaveForm} debugShowParsed={true} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    paddingTop: 6,
    paddingBottom: 80,
    gap: 12,
    backgroundColor: COLORS.surface,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textHeavy,
    marginTop: 6,
  },
  voiceBlock: {
    backgroundColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voiceTitle: {
    color: COLORS.accentDark,
    fontWeight: '700',
    fontSize: 12,
  },
  voiceInputWrap: {
    position: 'relative',
  },
  voiceTextArea: {
    minHeight: 64,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    paddingRight: 48,
    backgroundColor: COLORS.white,
    fontSize: 14,
    color: COLORS.textDark2,
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
    color: COLORS.textMutedLight,
    fontSize: 16,
  },
  muted: {
    color: COLORS.textMuted,
    fontWeight: '500',
    fontSize: 14,
  },
  noteOptional: {
    color: COLORS.textMutedLight,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.borderGray2,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    color: COLORS.textBlack,
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
    borderColor: COLORS.borderGray2,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
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
    borderColor: COLORS.borderGray2,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    minHeight: 64,
    paddingVertical: 8,
    fontSize: 18,
    lineHeight: 22,
    color: COLORS.textDark3,
    fontWeight: '400',
    textAlign: 'left',
    paddingHorizontal: 12,
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
    paddingVertical: 4,
  },
  notesArea: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: COLORS.borderGray2,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top',
    backgroundColor: COLORS.white,
    color: COLORS.textDark3,
    fontSize: 14,
  },
  saveButton: {
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgDark,
    marginTop: 6,
  },
  saveButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 18,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  errorText: {
    color: COLORS.dangerAlt,
    fontSize: 18,
  },
});
