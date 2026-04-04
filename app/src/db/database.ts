import * as SQLite from "expo-sqlite";

import { INITIAL_EXERCISES } from "../constants/presetExercises";
import type { Exercise, History, HistoryFilter, HistoryInput } from "../types";

const dbPromise = SQLite.openDatabaseAsync("kintore_log.db");

export async function initializeDatabase() {
  const db = await dbPromise;

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS histories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      exercise_id INTEGER NOT NULL,
      weight REAL,
      is_bodyweight INTEGER NOT NULL DEFAULT 0,
      reps INTEGER NOT NULL,
      sets INTEGER NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_histories_date ON histories(date);
    CREATE INDEX IF NOT EXISTS idx_histories_exercise_id ON histories(exercise_id);
  `);

  // Migration: if older DB schema exists without is_bodyweight or weight nullable, migrate to new schema
  // We use user_version to track migration state.
  const userVersionRows = await db.getAllAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const userVersion = userVersionRows?.[0]?.user_version ?? 0;
  if (userVersion < 2) {
    // Create new table and copy data
    await db.execAsync(`
      BEGIN TRANSACTION;
      CREATE TABLE IF NOT EXISTS histories_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        exercise_id INTEGER NOT NULL,
        weight REAL,
        is_bodyweight INTEGER NOT NULL DEFAULT 0,
        reps INTEGER NOT NULL,
        sets INTEGER NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT
      );
      INSERT INTO histories_new (id, date, exercise_id, weight, reps, sets, notes, is_bodyweight)
        SELECT id, date, exercise_id, weight, reps, sets, notes, 0 FROM histories;
      DROP TABLE IF EXISTS histories;
      ALTER TABLE histories_new RENAME TO histories;
      CREATE INDEX IF NOT EXISTS idx_histories_date ON histories(date);
      CREATE INDEX IF NOT EXISTS idx_histories_exercise_id ON histories(exercise_id);
      PRAGMA user_version = 2;
      COMMIT;
    `);
  }

  for (const name of INITIAL_EXERCISES) {
    await db.runAsync("INSERT OR IGNORE INTO exercises (name) VALUES (?)", [
      name,
    ]);
  }
}

export async function getExercises() {
  const db = await dbPromise;
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
  }>("SELECT id, name FROM exercises ORDER BY name ASC");

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
  })) satisfies Exercise[];
}

export async function addExercise(name: string) {
  const db = await dbPromise;
  await db.runAsync("INSERT INTO exercises (name) VALUES (?)", [name.trim()]);
}

export async function updateExercise(id: number, name: string) {
  const db = await dbPromise;
  await db.runAsync("UPDATE exercises SET name = ? WHERE id = ?", [
    name.trim(),
    id,
  ]);
}

export async function deleteExercise(id: number) {
  const db = await dbPromise;
  await db.runAsync("DELETE FROM exercises WHERE id = ?", [id]);
}

export async function getHistories(filter: HistoryFilter = {}) {
  const db = await dbPromise;

  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (filter.fromDate) {
    whereClauses.push("h.date >= ?");
    params.push(filter.fromDate);
  }

  if (filter.toDate) {
    whereClauses.push("h.date <= ?");
    params.push(filter.toDate);
  }

  if (filter.exerciseId) {
    whereClauses.push("h.exercise_id = ?");
    params.push(filter.exerciseId);
  }

  const where =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const rows = await db.getAllAsync<{
    id: number;
    date: string;
    exercise_id: number;
    exercise_name: string;
    weight: number | null;
    is_bodyweight: number;
    reps: number;
    sets: number;
    notes: string;
  }>(
    `
      SELECT
        h.id,
        h.date,
        h.exercise_id,
        e.name AS exercise_name,
        h.weight,
        h.is_bodyweight,
        h.reps,
        h.sets,
        h.notes
      FROM histories h
      INNER JOIN exercises e ON e.id = h.exercise_id
      ${where}
      ORDER BY h.date DESC, h.id DESC
    `,
    params,
  );

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    weight: row.weight === null ? null : row.weight,
    isBodyweight: !!row.is_bodyweight,
    reps: row.reps,
    sets: row.sets,
    notes: row.notes,
  })) satisfies History[];
}

export async function addHistories(items: HistoryInput[]) {
  if (items.length === 0) {
    return;
  }

  const db = await dbPromise;
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const item of items) {
      await tx.runAsync(
        `
          INSERT INTO histories (date, exercise_id, weight, is_bodyweight, reps, sets, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          item.date,
          item.exerciseId,
          item.weight,
          item.isBodyweight ? 1 : 0,
          item.reps,
          item.sets,
          item.notes,
        ],
      );
    }
  });
}

export async function updateHistory(id: number, item: HistoryInput) {
  const db = await dbPromise;
  await db.runAsync(
    `
      UPDATE histories
      SET date = ?, exercise_id = ?, weight = ?, is_bodyweight = ?, reps = ?, sets = ?, notes = ?
      WHERE id = ?
    `,
    [
      item.date,
      item.exerciseId,
      item.weight,
      item.isBodyweight ? 1 : 0,
      item.reps,
      item.sets,
      item.notes,
      id,
    ],
  );
}

export async function deleteHistory(id: number) {
  const db = await dbPromise;
  await db.runAsync("DELETE FROM histories WHERE id = ?", [id]);
}
