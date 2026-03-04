const express = require('express')
const supabase = require('../config/supabaseClient')

const router = express.Router()

// GET todos usuários
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('usuarios')  // nome da tabela no Supabase
    .select('*')

  if (error) return res.status(500).json({ error })
  res.json(data)
})

// POST criar usuário
router.post('/', async (req, res) => {
  const { nome } = req.body

  const { data, error } = await supabase
    .from('usuarios')
    .insert([{ nome }])

  if (error) return res.status(500).json({ error })
  res.json(data)
})

module.exports = router