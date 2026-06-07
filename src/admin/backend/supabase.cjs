require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get credentials from .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
;
if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env file');
    console.error('SUPABASE_URL:', supabaseUrl || 'NOT SET');
    console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'NOT SET');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };