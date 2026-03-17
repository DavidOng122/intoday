import { supabase } from '../supabase';

/**
 * Tracks a user analytics event by storing it in the user_analytics table.
 * 
 * @param {string} userId - The ID of the authenticated user.
 * @param {string} eventType - The type of event (e.g., 'app_opened', 'task_added', 'task_clicked').
 * @param {object} [eventData] - Optional JSON data associated with the event.
 */
export const trackUserEvent = async (userId, eventType, eventData = {}) => {
  if (!supabase || !userId) return;

  try {
    const { error } = await supabase
      .from('user_analytics')
      .insert([
        {
          user_id: userId,
          event_type: eventType,
          event_data: eventData,
        }
      ]);

    if (error) {
      console.warn('Analytics Error:', error.message);
    }
  } catch (err) {
    console.warn('Analytics Exception:', err);
  }
};
