import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rjdlzohjxllmigaupwet.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqZGx6b2hqeGxsbWlnYXVwd2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjMyMDQsImV4cCI6MjA4ODEzOTIwNH0.Pb78_E032nE9mttwib8U6w16l6ymbNCMQCQRLAWUl_8'

const supabase = createClient(supabaseUrl, supabaseKey)

const test = async () => {
  const { data, error } = await supabase
    .from('sua_tabela')
    .select('*')

  if (error) console.log(error)
  else console.log(data)
}

test()