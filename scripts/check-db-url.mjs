import fs from 'fs';

let envText = '';
try { envText += fs.readFileSync('.env.local', 'utf8') + '\n'; } catch {}

const lines = envText.split('\n');
for (const line of lines) {
  if (line.startsWith('SUPABASE_DB_URL') || line.startsWith('DATABASE_URL') || line.startsWith('POSTGRES')) {
    const [k, ...rest] = line.split('=');
    const val = rest.join('=');
    const masked = val.replace(/:([^:@]+)@/, ':****@');
    console.log(`${k}=${masked}`);
  }
}
