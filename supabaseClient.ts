import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Expo, EXPO_PUBLIC_ ile başlayan .env değişkenlerini otomatik olarak okur
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Değişkenlerin tanımlı olup olmadığını kontrol ediyoruz
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase URL veya Anon Key bulunamadı. Lütfen .env dosyanızı kontrol edin.'
  );
}

// React Native için AsyncStorage entegrasyonu ile client oluşturuluyor
const serverStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

const authStorage = typeof window === 'undefined' ? serverStorage : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // React Native'de URL üzerinden session yakalamaya gerek yoktur
  },
});
