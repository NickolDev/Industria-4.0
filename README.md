# 🔧 Paulinho Auto-Center 4.0 — Vercel + Supabase

## Credenciais de acesso
| Perfil    | Usuário   | Senha    |
|-----------|-----------|----------|
| Gerente   | admin     | admin123 |
| Atendente | atendente | 1234     |
| Mecânico  | mec1      | 1234     |

## Módulos
- 👥 Clientes — cadastro com histórico completo
- 🚗 Veículos — vinculado ao cliente
- 📦 Peças — estoque com alertas de mínimo
- 📋 OS — ordens de serviço digitais
- 🔧 Elevadores — cronômetro em tempo real
- 📈 Relatórios — exportação CSV
- 👤 Usuários — controle de acesso
- 🔍 Auditoria — log LGPD
- 📱 WhatsApp — template pronto ao concluir OS

## Deploy no Vercel

### 1. Variável de ambiente obrigatória
No Vercel: Settings → Environment Variables
```
DATABASE_URL = postgresql://postgres:[SENHA]@db.[PROJETO].supabase.co:5432/postgres
```

### 2. Build settings
- Framework: Other
- Build command: npm install
- Output directory: public
- Install command: npm install

### 3. Via GitHub
1. Suba este projeto no GitHub
2. Importe no Vercel
3. Configure a variável DATABASE_URL
4. Deploy automático
