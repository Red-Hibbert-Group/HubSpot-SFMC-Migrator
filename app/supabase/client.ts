/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if Supabase credentials are available
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials are missing. Please check your .env.local file.');
}

// Create client with fallback empty strings to prevent runtime errors
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Helper function to store integration tokens in Supabase
export const storeIntegrationTokens = async (
  userId: string,
  platform: 'hubspot' | 'sfmc',
  tokens: Record<string, any>
) => {
  // Check if Supabase is properly configured
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Cannot store tokens: Supabase not configured');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('integration_tokens')
      .upsert(
        {
          user_id: userId,
          platform,
          tokens,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,platform' }
      );

    if (error) {
      console.error(`Error storing ${platform} tokens:`, error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`Error in storeIntegrationTokens:`, error);
    return null;
  }
};

// Helper function to retrieve integration tokens from Supabase
export const getIntegrationTokens = async (
  userId: string,
  platform: 'hubspot' | 'sfmc'
) => {
  // Check if Supabase is properly configured
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Cannot retrieve tokens: Supabase not configured');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('integration_tokens')
      .select('tokens')
      .eq('user_id', userId)
      .eq('platform', platform)
      .single();

    if (error) {
      console.error(`Error retrieving ${platform} tokens:`, error);
      return null;
    }

    return data?.tokens;
  } catch (error) {
    console.error(`Error in getIntegrationTokens:`, error);
    return null;
  }
}; 