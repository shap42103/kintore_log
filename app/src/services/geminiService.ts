import Constants from "expo-constants";
import { z } from "zod";

import { EXERCISE_ALIASES } from "../constants/presetExercises";
import type { Exercise, ParsedTrainingItem } from "../types";

const parsedSchema = z.array(
  z.object({
    date: z.string().optional(),
    exercise: z.string().min(1),
    weight: z.number().positive(),
    reps: z.number().int().positive(),
    sets: z.number().int().positive(),
    notes: z.string().nullable().optional(),
  }),
);

function toTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeExerciseName(name: string) {
  return name
    .trim()
    .replace(/[\s　]/g, "")
    .toLowerCase();
}

function mapExerciseName(name: string, exercises: Exercise[]) {
  const trimmed = name.trim();
  const normalized = normalizeExerciseName(trimmed);

  const aliasMatch = Object.entries(EXERCISE_ALIASES).find(
    ([key]) => normalizeExerciseName(key) === normalized,
  );
  const canonical = aliasMatch ? aliasMatch[1] : trimmed;

  const exactMatch = exercises.find(
    (exercise) =>
      normalizeExerciseName(exercise.name) === normalizeExerciseName(canonical),
  );
  if (exactMatch) {
    return exactMatch.name;
  }

  const partialMatch = exercises.find((exercise) =>
    normalizeExerciseName(exercise.name).includes(
      normalizeExerciseName(canonical),
    ),
  );

  return partialMatch?.name ?? canonical;
}

function extractJsonArray(raw: string) {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");

  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Geminiの出力からJSON配列を抽出できませんでした。");
  }

  return cleaned.slice(start, end + 1);
}

export async function parseTrainingWithGemini(
  inputText: string,
  exercises: Exercise[],
) {
  const apiKey =
    Constants.expoConfig?.extra?.geminiApiKey ??
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ??
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Gemini APIキーが未設定です。READMEの環境変数設定を確認してください。",
    );
  }

  const names = exercises.map((exercise) => exercise.name).join(", ");
  const prompt = `あなたは筋トレ記録アシスタントです。\n
ユーザー入力を解析し、必ずJSON配列のみを返してください。\n
制約:\n- 返却形式は [{date, exercise, weight, reps, sets, notes}]\n- dateはYYYY-MM-DD。日付が明示されない場合は今日 (${toTodayDateString()}) を使う\n- exerciseは次の候補へ正規化: ${names}\n- 表記ゆれを解決する（例: ベンチ -> ベンチプレス）\n- 複数重量が含まれる場合はレコードを分割\n- notes以外は必須\n- 説明文は禁止、JSONのみ\n
入力:\n${inputText}`;

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini APIエラー: ${errorText}`);
  }

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = json.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Geminiから有効な応答が返りませんでした。");
  }

  const parsed = parsedSchema.parse(JSON.parse(extractJsonArray(text)));

  return parsed.map((item) => {
    const mappedExercise = mapExerciseName(item.exercise, exercises);

    return {
      date:
        item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
          ? item.date
          : toTodayDateString(),
      exercise: mappedExercise,
      weight: item.weight,
      reps: item.reps,
      sets: item.sets,
      notes: item.notes?.trim() ?? "",
    } satisfies ParsedTrainingItem;
  });
}
