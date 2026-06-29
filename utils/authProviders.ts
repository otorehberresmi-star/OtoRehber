const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const getGoogleAuthAvailability = async () => {
  if (!supabaseUrl || !supabaseAnonKey) return false;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
    });
    if (!response.ok) return false;

    const settings = await response.json();
    return settings?.external?.google === true;
  } catch {
    return false;
  }
};
