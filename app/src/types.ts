export type Exercise = {
  id: number;
  name: string;
};

export type History = {
  id: number;
  date: string;
  exerciseId: number;
  exerciseName: string;
  weight: number;
  reps: number;
  sets: number;
  notes: string;
};

export type HistoryInput = {
  date: string;
  exerciseId: number;
  weight: number;
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
  weight: number;
  reps: number;
  sets: number;
  notes: string;
};
