const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bzvkeqrwegpvioihzeeu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6dmtlcXJ3ZWdwdmlvaWh6ZWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MTIyNzUsImV4cCI6MjA4NzM4ODI3NX0.N0-DVwQE935WqhN2jZRx-uYcYsxU8CY97UmPlLO9XP4';

async function run() {
  try {
    console.log('Testing Supabase connection to', SUPABASE_URL);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('Querying table `reports` (select 1 row)');
    const { data, error, status } = await supabase.from('reports').select('*').limit(1);
    console.log('status:', status);
    console.log('data:', JSON.stringify(data, null, 2));
    console.log('error:', JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2));
    if (error) process.exitCode = 2;
  } catch (e) {
    console.error('Unhandled error:', e);
    process.exitCode = 3;
  }
}

run();
