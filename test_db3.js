const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
    const { data, error } = await supabase.from('usuarios').insert({
        name: 'test', email: 'test_insert@example.com', password: 'test', darkmode: 'disabled'
    }).select().single();
    console.log('Insert result:', { data: data, error: error });
}

check();
testeonline()
