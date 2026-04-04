import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    Modal, Platform, Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import {
    deleteHistory,
    getExercises,
    getHistories,
    updateHistory,
} from '../db/database';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { parseTrainingWithGemini } from '../services/geminiService';
import type { Exercise, History } from '../types';

type EditForm = {
  id: number;
  date: string;
  exerciseId: number;
  weight: string;
  reps: string;
  sets: string;
  notes: string;
};

const today = new Date().toISOString().slice(0, 10);

export function HistoryScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [histories, setHistories] = useState<History[]>([]);
  const [exerciseFilter, setExerciseFilter] = useState<number | undefined>(undefined);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [voiceText, setVoiceText] = useState('');

  const speech = useSpeechToText();

  const reloadAll = useCallback(async () => {
    const exerciseList = await getExercises();
    setExercises(exerciseList);

    const historyList = await getHistories({
      exerciseId: exerciseFilter,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    });
    setHistories(historyList);
  }, [exerciseFilter, fromDate, toDate]);

  useFocusEffect(
    useCallback(() => {
      void reloadAll();
    }, [reloadAll]),
  );

  const markedDates = useMemo(() => {
    const base: Record<string, { marked?: boolean; selected?: boolean; selectedColor?: string }> = {};

    for (const item of histories) {
      base[item.date] = { marked: true };
    }

    if (fromDate && fromDate === toDate) {
      base[fromDate] = {
        ...(base[fromDate] ?? {}),
        selected: true,
        selectedColor: '#175fe8',
      };
    }

    return base;
  }, [fromDate, histories, toDate]);

  const openEdit = useCallback((item: History) => {
    setEditing({
      id: item.id,
      date: item.date,
      exerciseId: item.exerciseId,
      weight: String(item.weight),
      reps: String(item.reps),
      sets: String(item.sets),
      notes: item.notes,
    });
    setVoiceText('');
    speech.clear();
  }, [speech]);

  const applyVoiceEdit = useCallback(async () => {
    if (!editing || !voiceText.trim()) {
      return;
    }

    try {
      const result = await parseTrainingWithGemini(voiceText, exercises);
      const first = result[0];
      if (!first) {
        Alert.alert('解析結果なし', '編集に使えるデータが抽出できませんでした。');
        return;
      }

      const exercise = exercises.find((entry) => entry.name === first.exercise);
      if (!exercise) {
        Alert.alert('種目エラー', `種目「${first.exercise}」が設定に存在しません。`);
        return;
      }

      setEditing((prev) =>
        prev
          ? {
              ...prev,
              date: first.date,
              exerciseId: exercise.id,
              weight: String(first.weight),
              reps: String(first.reps),
              sets: String(first.sets),
              notes: first.notes,
            }
          : prev,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '音声編集の解析に失敗しました。';
      Alert.alert('解析エラー', message);
    }
  }, [editing, exercises, voiceText]);

  const saveEdit = useCallback(async () => {
    if (!editing) {
      return;
    }

    const weight = Number(editing.weight);
    const reps = Number(editing.reps);
    const sets = Number(editing.sets);

    if (!editing.date || !editing.exerciseId || !weight || !reps || !sets) {
      Alert.alert('入力エラー', '日付・種目・重量・回数・セット数は必須です。');
      return;
    }

    await updateHistory(editing.id, {
      date: editing.date,
      exerciseId: editing.exerciseId,
      weight,
      reps,
      sets,
      notes: editing.notes,
    });

    setEditing(null);
    await reloadAll();
  }, [editing, reloadAll]);

  const removeHistory = useCallback((id: number) => {
    Alert.alert('削除確認', 'この履歴を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await deleteHistory(id);
          await reloadAll();
        },
      },
    ]);
  }, [reloadAll]);

  const onDayPress = useCallback((day: DateData) => {
    setFromDate(day.dateString);
    setToDate(day.dateString);
  }, []);

  const isPeriodInvalid = useMemo(() => {
    if (!fromDate || !toDate) return false;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    return to < from;
  }, [fromDate, toDate]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.block}>
        <Text style={styles.label}>カレンダー</Text>
        <Calendar markedDates={markedDates} onDayPress={onDayPress} />
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>フィルター</Text>
        <View style={styles.filterSummaryRow}>
          <Text style={styles.filterSummaryText}>{fromDate || '開始日未選択'} ～ {toDate || '終了日未選択'}</Text>
          <Text style={styles.filterSummaryText}>{exerciseFilter ? (exercises.find(e => e.id === exerciseFilter)?.name ?? '種目選択') : '全種目'}</Text>
        </View>
        <Pressable style={[styles.button, styles.buttonPrimary]} onPress={() => setIsFilterOpen(true)}>
          <Text style={styles.buttonText}>フィルタを編集</Text>
        </Pressable>
      </View>

      {isFilterOpen && (
        <Modal visible={isFilterOpen} animationType="slide" transparent onRequestClose={() => setIsFilterOpen(false)}>
          <View style={styles.filterOverlay}>
            <View style={styles.filterSheet}>
              <View style={styles.filterHeader}>
                <Text style={styles.filterTitle}>フィルタ</Text>
                <Pressable onPress={() => setIsFilterOpen(false)} style={styles.filterCloseButton}><Text style={styles.filterCloseText}>閉じる</Text></Pressable>
              </View>

              <View style={styles.filterBody}>
                <Text style={styles.label}>種目で絞り込み</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={exerciseFilter ?? 0}
                    onValueChange={(value) => setExerciseFilter(value === 0 ? undefined : Number(value))}
                    style={{ color: '#111' }}
                    itemStyle={{ color: '#111' }}
                  >
                    <Picker.Item label="すべての種目" value={0} />
                    {exercises.map((exercise) => (
                      <Picker.Item key={exercise.id} label={exercise.name} value={exercise.id} />
                    ))}
                  </Picker>
                </View>

                <Text style={[styles.label, { marginTop: 12 }]}>期間で絞り込み</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable style={styles.input} onPress={() => setShowFromPicker(true)}>
                    <Text style={{ color: '#111' }}>{fromDate || '開始日'}</Text>
                  </Pressable>
                  <Pressable style={styles.input} onPress={() => setShowToPicker(true)}>
                    <Text style={{ color: '#111' }}>{toDate || '終了日'}</Text>
                  </Pressable>
                </View>
                {isPeriodInvalid ? <Text style={styles.periodError}>終了日は開始日以降に設定してください。</Text> : null}
                {showFromPicker && (
                  <DateTimePicker
                    value={fromDate ? new Date(fromDate) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={(event, selected) => {
                      // On Android, event.type === 'dismissed' when cancelled
                      if (Platform.OS === 'android' && event?.type === 'dismissed') {
                        setShowFromPicker(false);
                        return;
                      }
                      if (selected) {
                        const current = selected;
                        const y = current.getFullYear();
                        const m = String(current.getMonth() + 1).padStart(2, '0');
                        const d = String(current.getDate()).padStart(2, '0');
                        setFromDate(`${y}-${m}-${d}`);
                      }
                      if (Platform.OS !== 'ios') setShowFromPicker(false);
                    }}
                  />
                )}
                {showToPicker && (
                  <DateTimePicker
                    value={toDate ? new Date(toDate) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={(event, selected) => {
                      if (Platform.OS === 'android' && event?.type === 'dismissed') {
                        setShowToPicker(false);
                        return;
                      }
                      if (selected) {
                        const current = selected;
                        const y = current.getFullYear();
                        const m = String(current.getMonth() + 1).padStart(2, '0');
                        const d = String(current.getDate()).padStart(2, '0');
                        setToDate(`${y}-${m}-${d}`);
                      }
                      if (Platform.OS !== 'ios') setShowToPicker(false);
                    }}
                  />
                )}
              </View>

              <View style={styles.filterFooter}>
                <Pressable style={[styles.button, styles.buttonGhost]} onPress={() => { setExerciseFilter(undefined); setFromDate(''); setToDate(''); void reloadAll(); setIsFilterOpen(false); }}>
                  <Text style={styles.buttonGhostText}>クリア</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.buttonPrimary, isPeriodInvalid && styles.buttonDisabled]}
                  disabled={isPeriodInvalid}
                  onPress={() => {
                    void reloadAll();
                    setIsFilterOpen(false);
                  }}
                >
                  <Text style={styles.buttonText}>適用</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <View style={styles.block}>
        <Text style={styles.label}>履歴一覧 ({histories.length}件)</Text>
        {histories.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.exerciseName}</Text>
            <Text style={styles.cardText}>{item.date}</Text>
            <Text style={styles.cardText}>
              {item.weight}kg / {item.reps}回 / {item.sets}セット
            </Text>
            <Text style={styles.cardText}>備考: {item.notes || 'なし'}</Text>
            <View style={styles.row}>
              <Pressable style={[styles.button, styles.buttonGhost]} onPress={() => openEdit(item)}>
                <Text style={styles.buttonGhostText}>編集</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.buttonDanger]} onPress={() => removeHistory(item.id)}>
                <Text style={styles.buttonText}>削除</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <ScrollView contentContainerStyle={styles.modalContainer}>
          <Text style={styles.title}>履歴編集</Text>
          {editing ? (
            <>
              <TextInput style={styles.input} value={editing.date} onChangeText={(text) => setEditing({ ...editing, date: text })} />
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={editing.exerciseId}
                  onValueChange={(value) => setEditing({ ...editing, exerciseId: Number(value) })}
                >
                  {exercises.map((exercise) => (
                    <Picker.Item key={exercise.id} label={exercise.name} value={exercise.id} />
                  ))}
                </Picker>
              </View>
              <TextInput style={styles.input} keyboardType="decimal-pad" value={editing.weight} onChangeText={(text) => setEditing({ ...editing, weight: text })} placeholder="重量" />
              <TextInput style={styles.input} keyboardType="number-pad" value={editing.reps} onChangeText={(text) => setEditing({ ...editing, reps: text })} placeholder="回数" />
              <TextInput style={styles.input} keyboardType="number-pad" value={editing.sets} onChangeText={(text) => setEditing({ ...editing, sets: text })} placeholder="セット数" />
              <TextInput style={styles.input} value={editing.notes} onChangeText={(text) => setEditing({ ...editing, notes: text })} placeholder="備考" />

              <View style={styles.block}>
                <Text style={styles.label}>音声で編集</Text>
                <TextInput
                  style={[styles.input, styles.voiceInput]}
                  multiline
                  value={voiceText || speech.transcript}
                  onChangeText={setVoiceText}
                  placeholder="例: 今日のベンチを65kg 8回 3セットに変更"
                />
                <View style={styles.row}>
                  <Pressable
                    style={[styles.button, speech.isListening ? styles.buttonDanger : styles.buttonPrimary]}
                    onPress={speech.isListening ? speech.stop : speech.start}
                  >
                    <Text style={styles.buttonText}>{speech.isListening ? '停止' : '音声開始'}</Text>
                  </Pressable>
                  <Pressable style={[styles.button, styles.buttonGhost]} onPress={applyVoiceEdit}>
                    <Text style={styles.buttonGhostText}>解析して反映</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.row}>
                <Pressable style={[styles.button, styles.buttonGhost]} onPress={() => setEditing(null)}>
                  <Text style={styles.buttonGhostText}>閉じる</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.buttonPrimary]} onPress={() => void saveEdit()}>
                  <Text style={styles.buttonText}>保存</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 8,
    gap: 16,
    backgroundColor: '#f6f8fb',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#102542',
  },
  block: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  label: {
    fontWeight: '600',
    color: '#102542',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    color: '#111',
  },
  filterSummaryRow: {
    flexDirection: 'column',
    gap: 6,
    marginBottom: 8,
  },
  filterSummaryText: {
    color: '#334e68',
  },
  filterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  filterCloseButton: {
    padding: 8,
  },
  filterCloseText: {
    color: '#74757d',
    fontWeight: '600',
  },
  filterBody: {
    gap: 12,
  },
  filterFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 8,
    overflow: 'hidden',
  },
  card: {
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  cardTitle: {
    fontWeight: '700',
    color: '#102542',
  },
  cardText: {
    color: '#334e68',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    borderRadius: 8,
    minHeight: 42,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#175fe8',
  },
  buttonDanger: {
    backgroundColor: '#cc2b52',
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: '#bcccdc',
    backgroundColor: '#fff',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonGhostText: {
    color: '#243b53',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  periodError: {
    color: '#d64545',
    marginTop: 6,
    fontWeight: '600',
  },
  modalContainer: {
    padding: 16,
    gap: 10,
    backgroundColor: '#f6f8fb',
  },
  voiceInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
});
