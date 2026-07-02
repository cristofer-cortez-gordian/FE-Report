import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extras = Constants.expoConfig?.extra || Constants.manifest?.extra || {};
const SUPABASE_URL = extras.SUPABASE_URL || process.env.SUPABASE_URL || 'https://bzvkeqrwegpvioihzeeu.supabase.co';
const SUPABASE_ANON_KEY = extras.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6dmtlcXJ3ZWdwdmlvaWh6ZWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MTIyNzUsImV4cCI6MjA4NzM4ODI3NX0.N0-DVwQE935WqhN2jZRx-uYcYsxU8CY97UmPlLO9XP4';
const SUPABASE_STORAGE_BUCKET =
	extras.SUPABASE_STORAGE_BUCKET ||
	process.env.SUPABASE_STORAGE_BUCKET ||
	'report-photos';
const isWeb = Platform.OS === 'web';
const isBrowser = typeof window !== 'undefined';

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
	const authConfig = {
		autoRefreshToken: !isWeb || isBrowser,
		persistSession: !isWeb || isBrowser,
		detectSessionInUrl: isWeb && isBrowser
	};

	if (!isWeb) {
		authConfig.storage = AsyncStorage;
	}

	supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		auth: authConfig
	});
} else {
	console.warn('Supabase credentials missing: set SUPABASE_URL and SUPABASE_ANON_KEY in app config or .env');
	// create a minimal stub to avoid runtime crashes when supabase is used without credentials
	supabase = {
		from: () => ({
			upload: async () => ({ data: null, error: new Error('Supabase not configured') }),
			getPublicUrl: () => ({ data: { publicUrl: null }, error: new Error('Supabase not configured') })
		}),
		from: (/* bucket */) => ({
			upload: async () => ({ data: null, error: new Error('Supabase not configured') }),
			getPublicUrl: () => ({ data: { publicUrl: null }, error: new Error('Supabase not configured') })
		}),
		fromTable: () => ({
			select: async () => ({ data: [], error: new Error('Supabase not configured') }),
			upsert: async () => ({ data: null, error: new Error('Supabase not configured') })
		}),
		// fallback methods used in code
		from: (bucket) => ({
			upload: async () => ({ data: null, error: new Error('Supabase not configured') }),
			getPublicUrl: () => ({ data: { publicUrl: null }, error: new Error('Supabase not configured') })
		}),
		fromTableName: (/* name */) => ({
			select: async () => ({ data: [], error: new Error('Supabase not configured') }),
			upsert: async () => ({ data: null, error: new Error('Supabase not configured') })
		})
	};
}

export async function testSupabaseConnection() {
	if (!supabase || typeof supabase.from !== 'function') {
		return { ok: false, error: 'Supabase client not initialized' };
	}

	try {
		const { data, error, status } = await supabase.from('reports').select('id').limit(1);
		if (error) {
			return { ok: false, error, status };
		}
		return { ok: true, status, count: Array.isArray(data) ? data.length : 0 };
	} catch (e) {
		return { ok: false, error: e };
	}
}

export default supabase;
export { supabase, SUPABASE_STORAGE_BUCKET };

