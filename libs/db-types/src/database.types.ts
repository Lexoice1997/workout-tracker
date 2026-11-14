// Сгенерировано из живой схемы Supabase (проект msecftduxfzbtgihsyem), 2026-11-01.
// Формат совместим с `supabase gen types typescript`: при работающем CLI можно перегенерировать поверх.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      body_metrics: {
        Row: {
          id: string
          user_id: string
          date: string
          weight_kg: number | null
          waist_cm: number | null
          chest_cm: number | null
          biceps_r_cm: number | null
          biceps_l_cm: number | null
        }
        Insert: {
          id?: string
          user_id?: string
          date: string
          weight_kg?: number | null
          waist_cm?: number | null
          chest_cm?: number | null
          biceps_r_cm?: number | null
          biceps_l_cm?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          weight_kg?: number | null
          waist_cm?: number | null
          chest_cm?: number | null
          biceps_r_cm?: number | null
          biceps_l_cm?: number | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          id: string
          user_id: string | null
          name: string
          equipment: string
          default_step_kg: number | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          equipment: string
          default_step_kg?: number | null
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          equipment?: string
          default_step_kg?: number | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          id: string
          user_id: string
          exercise_id: string
          target_kg: number
          target_reps: number
          deadline: string
          achieved_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          exercise_id: string
          target_kg: number
          target_reps: number
          deadline: string
          achieved_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          exercise_id?: string
          target_kg?: number
          target_reps?: number
          deadline?: string
          achieved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          id: string
          user_id: string
          date: string
          slot: string
          title: string
          items: Json
          kcal: number
          protein_g: number
          fat_g: number
          carbs_g: number
          source: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          date: string
          slot: string
          title: string
          items?: Json
          kcal: number
          protein_g: number
          fat_g: number
          carbs_g: number
          source?: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          slot?: string
          title?: string
          items?: Json
          kcal?: number
          protein_g?: number
          fat_g?: number
          carbs_g?: number
          source?: string
          note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          user_id: string
          timezone: string
          kcal_target: number | null
          protein_target_g: number | null
        }
        Insert: {
          user_id?: string
          timezone?: string
          kcal_target?: number | null
          protein_target_g?: number | null
        }
        Update: {
          user_id?: string
          timezone?: string
          kcal_target?: number | null
          protein_target_g?: number | null
        }
        Relationships: []
      }
      program_days: {
        Row: {
          id: string
          user_id: string | null
          program_id: string
          code: string
          title: string
          weekday: number | null
          sort: number
        }
        Insert: {
          id?: string
          user_id?: string | null
          program_id: string
          code: string
          title: string
          weekday?: number | null
          sort?: number
        }
        Update: {
          id?: string
          user_id?: string | null
          program_id?: string
          code?: string
          title?: string
          weekday?: number | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_days_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_exercises: {
        Row: {
          id: string
          user_id: string | null
          day_id: string
          exercise_id: string
          sets: number
          rep_min: number
          rep_max: number
          step_kg: number | null
          start_kg: number | null
          is_main: boolean
          sort: number
        }
        Insert: {
          id?: string
          user_id?: string | null
          day_id: string
          exercise_id: string
          sets: number
          rep_min: number
          rep_max: number
          step_kg?: number | null
          start_kg?: number | null
          is_main?: boolean
          sort?: number
        }
        Update: {
          id?: string
          user_id?: string | null
          day_id?: string
          exercise_id?: string
          sets?: number
          rep_min?: number
          rep_max?: number
          step_kg?: number | null
          start_kg?: number | null
          is_main?: boolean
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_exercises_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          id: string
          user_id: string | null
          title: string
          is_active: boolean
          cycle_start: string | null
          deload_every: number
        }
        Insert: {
          id?: string
          user_id?: string | null
          title: string
          is_active?: boolean
          cycle_start?: string | null
          deload_every?: number
        }
        Update: {
          id?: string
          user_id?: string | null
          title?: string
          is_active?: boolean
          cycle_start?: string | null
          deload_every?: number
        }
        Relationships: []
      }
      set_logs: {
        Row: {
          id: string
          user_id: string
          workout_id: string
          program_exercise_id: string | null
          exercise_id: string
          rep_min: number
          rep_max: number
          weight_kg: number
          reps: number[]
          updated_at: string
        }
        Insert: {
          id: string
          user_id?: string
          workout_id: string
          program_exercise_id?: string | null
          exercise_id: string
          rep_min: number
          rep_max: number
          weight_kg: number
          reps: number[]
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workout_id?: string
          program_exercise_id?: string | null
          exercise_id?: string
          rep_min?: number
          rep_max?: number
          weight_kg?: number
          reps?: number[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_program_exercise_id_fkey"
            columns: ["program_exercise_id"]
            isOneToOne: false
            referencedRelation: "program_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          day_id: string | null
          day_title: string
          date: string
          is_deload: boolean
          cardio_min: number | null
          note: string | null
          updated_at: string
          finished_at: string | null
        }
        Insert: {
          id: string
          user_id?: string
          day_id?: string | null
          day_title: string
          date: string
          is_deload?: boolean
          cardio_min?: number | null
          note?: string | null
          updated_at?: string
          finished_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          day_id?: string | null
          day_title?: string
          date?: string
          is_deload?: boolean
          cardio_min?: number | null
          note?: string | null
          updated_at?: string
          finished_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workouts_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      last_normal_set_logs: {
        Row: {
          id: string | null
          user_id: string | null
          workout_id: string | null
          program_exercise_id: string | null
          exercise_id: string | null
          rep_min: number | null
          rep_max: number | null
          weight_kg: number | null
          reps: number[] | null
          updated_at: string | null
          date: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public'];
type TablesAndViews = PublicSchema['Tables'] & PublicSchema['Views'];

/** Строка таблицы или view: Tables<'set_logs'> */
export type Tables<T extends keyof TablesAndViews> = TablesAndViews[T] extends { Row: infer R } ? R : never;

/** Объект для insert: TablesInsert<'set_logs'> */
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];

/** Объект для update: TablesUpdate<'set_logs'> */
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
