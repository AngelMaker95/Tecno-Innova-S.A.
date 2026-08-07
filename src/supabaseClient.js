import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://icdgpazwuejkvdlfmumy.supabase.co'; // Reemplaza con tu URL de Supabase
const SUPABASE_ANON_KEY = 'sb_publishable_0qWJrSfXS6RvgPVU6g3n7A_D2MnIo73'; // Reemplaza con tu Anon Key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);