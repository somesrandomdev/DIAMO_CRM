import { supabase } from '../lib/supabase';

export interface ObjectifRow {
  id: string;
  kiosque_id: string;
  mois: string;
  ca_cible: number;
  created_by?: string;
  created_at?: string;
}

export interface ObjectifInsert {
  kiosque_id: string;
  mois: string;
  ca_cible: number;
  created_by?: string;
}

export class ObjectifService {
  /**
   * Fetches objectives for a specific kiosk.
   * If kioskId is null, fetches ALL objectives (Admin only).
   */
  static async getObjectifs(kioskId: string | null = null) {
    try {
      let query = supabase
        .from('objectifs')
        .select('*')
        .order('mois', { ascending: false });

      if (kioskId) {
        query = query.eq('kiosque_id', kioskId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data: data as ObjectifRow[] };
    } catch (error: any) {
      console.error('Error fetching objectifs:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Creates or updates an objective for a specific month/kiosk.
   * Uses UPSERT logic based on the unique constraint (kiosque_id, mois).
   */
  static async upsertObjectif(objectif: ObjectifInsert) {
    // Validation
    if (!objectif.kiosque_id || !objectif.mois || !objectif.ca_cible) {
      return { success: false, error: 'Missing required fields' };
    }
    if (objectif.ca_cible <= 0) {
      return { success: false, error: 'Target amount must be positive' };
    }

    try {
      const { data, error } = await supabase
        .from('objectifs')
        .upsert(objectif, { onConflict: 'kiosque_id,mois' })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as ObjectifRow };
    } catch (error: any) {
      console.error('Error saving objectif:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Deletes an objective by ID.
   */
  static async deleteObjectif(id: string) {
    try {
      const { error } = await supabase
        .from('objectifs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting objectif:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper to get first day of month as ISO string
   */
  static getMonthStart(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    return firstDay.toISOString().split('T')[0] + 'T00:00:00Z';
  }

  /**
   * Helper to parse month string back to Date
   */
  static parseMonth(mois: string): Date {
    return new Date(mois);
  }
}
