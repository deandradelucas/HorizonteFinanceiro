// api/usuarios.js
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://rjdlzohjxllmigaupwet.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZGx6b2hqeGxsbWlnYXVwd2V0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU2MzIwNCwiZXhwIjoyMDg4MTM5MjA0fQ.Msxf6C6IHh0w78ixmjkzgpCqZRe2bt8lEVoiRxOPEEU'
const supabase = createClient(supabaseUrl, supabaseKey)

module.exports = async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            const { data, error } = await supabase.from('users').select('*')
            if (error) throw error
            return res.status(200).json(data)
        }

        if (req.method === 'POST') {
            const { nome } = req.body
            const { data, error } = await supabase.from('users').insert([{ nome }])
            if (error) throw error
            return res.status(200).json(data)
        }

        return res.status(405).json({ message: 'Method not allowed' })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: err.message })
    }
}