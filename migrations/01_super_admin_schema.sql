-- 1. ADICIONAR COLUNAS RBAC NA TABELA DE USUÁRIOS EXISTENTE
-- Só execute se essas colunas não existirem!
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user',
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS last_login timestamp with time zone,
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. GARANTIR QUE OS USUÁRIOS ATUAIS TENHAM ROLE "user"
UPDATE public.users 
SET role = 'user' 
WHERE role IS NULL;

-- 3. INSERIR SUPER ADMIN PADRÃO (SE NÃO EXISTIR)
INSERT INTO public.users (name, email, password, role, is_active)
SELECT 'Super Admin', 'lukas.andrd@gmail.com', '09813Lucas**', 'super_admin', true
WHERE NOT EXISTS (
    SELECT id FROM public.users WHERE email = 'lukas.andrd@gmail.com'
);

-- (Nota: A senha acima será exposta em texto puro no sistema local
-- pois o seu sistema express está verificando auth básico com `SELECT * WHERE email=? and password=?`. 
-- O SuperAdmin depois pode alterar email/senha).

-- 4. CRIAR TABELA DE LOGS DE ATIVIDADE
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id integer REFERENCES public.users(id) ON DELETE CASCADE,
    action text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);

-- 5. CRIAR TABELA DE PERMISSÕES 
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id integer UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    permissions jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT now()
);

-- 6. CRIAR COLUNA PARA CONTROLE 2FA (PLACEHOLDER)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS two_factor_secret text;
