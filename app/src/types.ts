export type Exercise = {
  id: number;
  name: string;
};

export type History = {
  id: number;
  date: string;
  exerciseId: number;
  exerciseName: string;
  weight: number | null;
  isBodyweight: boolean;
  reps: number;
  sets: number;
  notes: string;
};

export type HistoryInput = {
  date: string;
  exerciseId: number;
  weight: number | null;
  isBodyweight?: boolean;
  reps: number;
  sets: number;
  notes: string;
};

export type HistoryFilter = {
  fromDate?: string;
  toDate?: string;
  exerciseId?: number;
};

export type ParsedTrainingItem = {
  date: string;
  exercise: string;
  weight: number | null;
  reps: number;
  sets: number;
  notes: string;
};
