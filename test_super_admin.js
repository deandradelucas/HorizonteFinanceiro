// test_super_admin.js - CommonJS version
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // carrega variáveis do .env

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testLogin() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'lukas.andrd@gmail.com')
    .single();

  if (error) {
    console.error('Erro ao buscar usuário:', error);
    return;
  }

  console.log('User data:', data);

  const senhaCorreta = bcrypt.compareSync('09813Lucas**', data.password_hash);
  console.log('Senha correta?', senhaCorreta);
}

testLogin();