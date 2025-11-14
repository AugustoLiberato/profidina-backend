import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';



dotenv.config();
const { Pool } = pkg;

const app = express();

//  CORS - Permitir requisições do frontend
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
    'https://profidina.vercel.app',
    'https://profidina-7y65.vercel.app',
    'https://profidina-7y65-git-main-augustos-projects-30ec658f.vercel.app'
  ],
  credentials: true
}));

app.use(express.json());

//  Conexão com PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

//  Configurar SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

//  Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get('/', (req, res) => {
  res.json({ message: '🎓 Profidina Ágil - API funcionando!', version: '1.0.0' });
});

//  Criar tabelas (GET e POST)
const createTables = async (req, res) => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, 
      username VARCHAR(255) NOT NULL, 
      email VARCHAR(255) UNIQUE NOT NULL, 
      password VARCHAR(255) NOT NULL, 
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    await pool.query(`CREATE TABLE IF NOT EXISTS salas (
      id SERIAL PRIMARY KEY, 
      nome VARCHAR(255) NOT NULL, 
      descricao TEXT, 
      codigo_sala VARCHAR(10) UNIQUE NOT NULL, 
      qr_code TEXT, 
      professor_id INTEGER REFERENCES users(id) ON DELETE CASCADE, 
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    //  TABELA ATUALIZADA COM JSONB PARA QUESTIONÁRIO
    await pool.query(`CREATE TABLE IF NOT EXISTS sala_alunos (
      id SERIAL PRIMARY KEY, 
      sala_id INTEGER REFERENCES salas(id) ON DELETE CASCADE, 
      nome_aluno VARCHAR(255) NOT NULL, 
      email_aluno VARCHAR(255), 
      rgm VARCHAR(50), 
      questionario JSONB,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    //  Adicionar coluna questionario se não existir (para bancos existentes)
    await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='sala_alunos' AND column_name='questionario'
        ) THEN
          ALTER TABLE sala_alunos ADD COLUMN questionario JSONB;
        END IF;
      END $$;
    `);
    
    await pool.query(`CREATE TABLE IF NOT EXISTS verification_codes (
      id SERIAL PRIMARY KEY, 
      email VARCHAR(255) NOT NULL, 
      username VARCHAR(255) NOT NULL, 
      code VARCHAR(6) NOT NULL, 
      attempts INTEGER DEFAULT 0, 
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
      expires_at TIMESTAMP NOT NULL
    )`);
    
    await pool.query(`CREATE TABLE IF NOT EXISTS organizacoes (
      id SERIAL PRIMARY KEY, 
      sala_id INTEGER NOT NULL REFERENCES salas(id) ON DELETE CASCADE, 
      algoritmo VARCHAR(50) NOT NULL, 
      grupos_json JSONB NOT NULL, 
      data_organizacao TIMESTAMP NOT NULL, 
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_verification_email ON verification_codes(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_organizacoes_sala ON organizacoes(sala_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_alunos_questionario ON sala_alunos USING GIN (questionario)`);
    
    res.json({ success: true, message: '✅ Tabelas criadas com sucesso!' });
  } catch (error) {
    console.error(' Erro ao criar tabelas:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar tabelas', details: error.message });
  }
};
app.get('/create-tables', createTables);
app.post('/create-tables', createTables);

// === ROTAS DE AUTENTICAÇÃO ===
import nodemailer from 'nodemailer';

// Criar transporter do Gmail (adicione no início do arquivo)
const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_HOST_PASSWORD
  }
});

// Na rota /enviarCodigoVerificacao, substitua o envio:
app.post('/enviarCodigoVerificacao', async (req, res) => {
  const { email, username } = req.body;
  if (!email || !username) return res.status(400).json({ error: 'Email e username são obrigatórios' });
  
  try {
    const usuarioExistente = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({ error: 'Este email já está cadastrado' });
    }
    
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    await pool.query('DELETE FROM verification_codes WHERE email = $1', [email]);
    await pool.query(
      `INSERT INTO verification_codes (email, username, code, expires_at) VALUES ($1, $2, $3, $4)`,
      [email, username, code, expiresAt]
    );
    
    // ✅ USAR GMAIL SMTP
    const hasGmailConfig = process.env.EMAIL_USER && process.env.EMAIL_HOST_PASSWORD;
    
    if (hasGmailConfig) {
      try {
        const emailHTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #48c9f4 0%, #272262 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0; color: #ffffff; font-size: 28px;">🎓 Profidina Ágil</h1>
    <p style="margin: 8px 0 0 0; color: #e0e0e0; font-size: 14px;">Sistema de Organização de Salas</p>
  </div>
  
  <div style="background: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
    <h2 style="color: #272262; margin-top: 0;">Olá, ${username}! 👋</h2>
    <p>Bem-vindo ao Profidina Ágil! Use o código abaixo para confirmar seu cadastro:</p>
    
    <div style="background: #f8f9fa; border: 2px dashed #48c9f4; border-radius: 8px; padding: 25px; text-align: center; margin: 25px 0;">
      <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Código de Verificação</p>
      <p style="margin: 0; font-size: 36px; font-weight: bold; color: #272262; letter-spacing: 8px; font-family: monospace;">${code}</p>
    </div>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px; padding: 12px 15px; margin: 20px 0;">
      <p style="margin: 0; color: #856404; font-size: 14px;"><strong>⏰ Validade:</strong> Este código expira em 10 minutos.</p>
    </div>
    
    <p style="color: #666; font-size: 14px;">Se você não solicitou este cadastro, ignore este email.</p>
    <p style="margin-top: 20px; color: #666; font-size: 14px;">Atenciosamente,<br><strong style="color: #272262;">Equipe Profidina Ágil</strong></p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p style="margin: 0;">Este é um email automático, não responda.</p>
    <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} Profidina Ágil - TCC</p>
  </div>
</body>
</html>
        `;

        const emailText = `
Olá, ${username}!

Bem-vindo ao Profidina Ágil!

Seu código de verificação é: ${code}

Este código é válido por 10 minutos.

Se você não solicitou este cadastro, ignore este email.

---
Atenciosamente,
Equipe Profidina Ágil
© ${new Date().getFullYear()} Profidina Ágil
        `.trim();

        // ✅ ENVIAR VIA GMAIL
        await gmailTransporter.sendMail({
          from: {
            name: 'Profidina Ágil',
            address: process.env.EMAIL_USER
          },
          to: email,
          subject: 'Código de Verificação - Profidina Ágil',
          html: emailHTML,
          text: emailText
        });
        
        console.log(`✅ Email enviado via Gmail para ${email}`);
        
      } catch (emailError) {
        console.error('❌ Erro ao enviar email via Gmail:', emailError);
        return res.status(500).json({ 
          success: false,
          error: 'Erro ao enviar email. Tente novamente.' 
        });
      }
    } else {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔧 MODO DESENVOLVIMENTO`);
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 CÓDIGO: ${code}`);
      console.log(`${'='.repeat(60)}\n`);
    }
    
    res.json({ 
      success: true, 
      message: 'Código enviado! Verifique sua caixa de entrada.',
      code: !hasGmailConfig ? code : undefined
    });
    
  } catch (error) {
    console.error('❌ Erro ao enviar código:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao processar solicitação.' 
    });
  }
});

app.post('/verificarECadastrar', async (req, res) => {
  const { email, username, password, verificationCode } = req.body;
  if (!email || !username || !password || !verificationCode) return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  try {
    const codeResult = await pool.query(`SELECT id, code, attempts, expires_at FROM verification_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`, [email]);
    if (codeResult.rows.length === 0) return res.status(400).json({ error: 'Código não encontrado. Solicite um novo código.' });
    const storedData = codeResult.rows[0];
    if (new Date() > new Date(storedData.expires_at)) {
      await pool.query('DELETE FROM verification_codes WHERE id = $1', [storedData.id]);
      return res.status(400).json({ error: 'Código expirado. Solicite um novo código.' });
    }
    if (storedData.attempts >= 5) {
      await pool.query('DELETE FROM verification_codes WHERE id = $1', [storedData.id]);
      return res.status(400).json({ error: 'Número máximo de tentativas excedido. Solicite um novo código.' });
    }
    if (storedData.code !== verificationCode) {
      await pool.query('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1', [storedData.id]);
      return res.status(400).json({ error: `Código inválido. Tentativas restantes: ${5 - (storedData.attempts + 1)}` });
    }
    const usuarioExistente = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (usuarioExistente.rows.length > 0) {
      await pool.query('DELETE FROM verification_codes WHERE id = $1', [storedData.id]);
      return res.status(400).json({ error: 'Este email já está cadastrado' });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await pool.query(`INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email`, [username, email, hashedPassword]);
    const newUser = result.rows[0];
    await pool.query('DELETE FROM verification_codes WHERE id = $1', [storedData.id]);
    console.log(` Usuário cadastrado: ${email}`);
    res.json({ success: true, message: 'Cadastro realizado com sucesso!', user: { id: newUser.id, username: newUser.username, email: newUser.email } });
  } catch (error) {
    console.error(' Erro ao verificar e cadastrar:', error);
    if (error.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    res.status(500).json({ error: 'Erro ao processar cadastro' });
  }
});

app.post('/cpoConectarUsuario', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Preencha todos os campos' });
  try {
    const result = await pool.query('SELECT id, username, email, password FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ success: false, error: 'E-mail ou senha incorretos!' });
    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (isPasswordValid) {
      res.json({ success: true, message: 'Login autorizado', user: { id: user.id, username: user.username, email: user.email } });
    } else {
      res.status(401).json({ success: false, error: 'E-mail ou senha incorretos!' });
    }
  } catch (error) {
    console.error(' Erro no login:', error);
    res.status(500).json({ error: 'Erro no login' });
  }
});

// === ROTAS DE SALAS ===
app.post('/salas', async (req, res) => {
  const { nome, descricao, professor_id } = req.body;
  if (!nome || !professor_id) return res.status(400).json({ error: 'Nome da sala e professor são obrigatórios' });
  try {
    const codigo_sala = crypto.randomBytes(3).toString('hex').toUpperCase();
    const qr_code = `SALA:${codigo_sala}`;
    const result = await pool.query(`INSERT INTO salas (nome, descricao, codigo_sala, qr_code, professor_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, descricao, codigo_sala, qr_code, created_at`, [nome, descricao, codigo_sala, qr_code, professor_id]);
    res.status(201).json({ success: true, message: 'Sala criada com sucesso!', sala: result.rows[0] });
  } catch (error) {
    console.error(' Erro ao criar sala:', error);
    res.status(500).json({ error: 'Erro ao criar sala' });
  }
});

//  ROTA ATUALIZADA: Entrada na sala com novo formato de questionário
app.post('/salas/entrar-com-perfil', async (req, res) => {
  try {
    const { codigo_sala, nome_aluno, rgm, questionario } = req.body;

    console.log(' Dados recebidos:', {
      codigo_sala,
      nome_aluno,
      rgm,
      questionario
    });

    // Validação básica
    if (!codigo_sala || !nome_aluno || !rgm) {
      return res.status(400).json({
        success: false,
        error: 'Código da sala, nome e RGM são obrigatórios'
      });
    }

    // Buscar sala pelo código
    const salaResult = await pool.query(
      'SELECT id, nome FROM salas WHERE codigo_sala = $1',
      [codigo_sala]
    );

    if (salaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada com este código'
      });
    }

    const sala = salaResult.rows[0];

    // Verificar se o aluno já está na sala (pelo RGM)
    const alunoExistente = await pool.query(
      'SELECT id FROM sala_alunos WHERE sala_id = $1 AND rgm = $2',
      [sala.id, rgm]
    );

    if (alunoExistente.rows.length > 0) {
      // Atualizar dados do aluno existente
      await pool.query(
        `UPDATE sala_alunos 
         SET nome_aluno = $1, questionario = $2 
         WHERE sala_id = $3 AND rgm = $4`,
        [nome_aluno, JSON.stringify(questionario || {}), sala.id, rgm]
      );

      console.log(` Dados do aluno "${nome_aluno}" atualizados na sala "${sala.nome}"`);

      return res.json({
        success: true,
        message: 'Dados atualizados com sucesso!',
        sala_nome: sala.nome
      });
    }

    // Inserir novo aluno com o questionário em formato JSON
    const insertResult = await pool.query(
      `INSERT INTO sala_alunos (nome_aluno, rgm, sala_id, questionario, joined_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       RETURNING id`,
      [
        nome_aluno, 
        rgm, 
        sala.id, 
        JSON.stringify(questionario || {})
      ]
    );

    console.log(` Aluno "${nome_aluno}" entrou na sala "${sala.nome}" (ID: ${insertResult.rows[0].id})`);

    res.json({
      success: true,
      message: `Bem-vindo à sala "${sala.nome}"!`,
      sala_nome: sala.nome,
      aluno_id: insertResult.rows[0].id
    });

  } catch (error) {
    console.error(' Erro ao processar entrada na sala:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar entrada na sala',
      details: error.message
    });
  }
});

app.get('/salas/professor/:professor_id', async (req, res) => {
  const { professor_id } = req.params;
  if (!professor_id || professor_id === 'undefined') return res.status(400).json({ error: 'ID do professor inválido' });
  try {
    const result = await pool.query(`SELECT s.id, s.nome, s.descricao, s.codigo_sala, s.qr_code, s.created_at, s.updated_at, COUNT(sa.id) as total_alunos FROM salas s LEFT JOIN sala_alunos sa ON s.id = sa.sala_id WHERE s.professor_id = $1 GROUP BY s.id ORDER BY s.created_at DESC`, [professor_id]);
    res.json({ success: true, salas: result.rows });
  } catch (error) {
    console.error(' Erro ao buscar salas:', error);
    res.status(500).json({ error: 'Erro ao buscar salas' });
  }
});

app.get('/salas/:sala_id', async (req, res) => {
  const { sala_id } = req.params;
  try {
    const result = await pool.query(`SELECT s.id, s.nome, s.descricao, s.codigo_sala, s.qr_code, s.created_at, s.updated_at, COUNT(DISTINCT sa.id) as total_alunos FROM salas s LEFT JOIN sala_alunos sa ON s.id = sa.sala_id WHERE s.id = $1 GROUP BY s.id`, [sala_id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Sala não encontrada' });
    res.json({ success: true, sala: result.rows[0] });
  } catch (error) {
    console.error(' Erro ao buscar sala:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar sala' });
  }
});

//  ROTA ATUALIZADA: Buscar alunos com questionário
app.get('/salas/:sala_id/alunos', async (req, res) => {
  try {
    const { sala_id } = req.params;
    const { professor_id } = req.query;

    console.log(' Buscando alunos da sala:', sala_id);

    // Verificar se a sala pertence ao professor
    const salaCheck = await pool.query(
      'SELECT id, nome FROM salas WHERE id = $1 AND professor_id = $2',
      [sala_id, professor_id]
    );

    if (salaCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Sala não encontrada ou você não tem permissão'
      });
    }

    // Buscar alunos com o questionário
    const result = await pool.query(
      `SELECT 
        id, 
        nome_aluno, 
        rgm, 
        questionario,
        joined_at 
       FROM sala_alunos 
       WHERE sala_id = $1 
       ORDER BY joined_at DESC`,
      [sala_id]
    );

    // Processar os resultados para garantir que questionario seja um objeto
    const alunos = result.rows.map(aluno => ({
      ...aluno,
      questionario: aluno.questionario || {}
    }));

    console.log(` ${alunos.length} alunos encontrados`);

    res.json({
      success: true,
      sala_nome: salaCheck.rows[0].nome,
      alunos: alunos
    });

  } catch (error) {
    console.error(' Erro ao buscar alunos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar alunos da sala',
      details: error.message
    });
  }
});

app.delete('/salas/:sala_id', async (req, res) => {
  const { sala_id } = req.params;
  const { professor_id } = req.body;
  try {
    const salaResult = await pool.query('SELECT id FROM salas WHERE id = $1 AND professor_id = $2', [sala_id, professor_id]);
    if (salaResult.rows.length === 0) return res.status(403).json({ error: 'Sala não encontrada ou sem permissão' });
    await pool.query('DELETE FROM salas WHERE id = $1', [sala_id]);
    res.json({ success: true, message: 'Sala excluída com sucesso!' });
  } catch (error) {
    console.error(' Erro ao excluir sala:', error);
    res.status(500).json({ error: 'Erro ao excluir sala' });
  }
});

app.put('/salas/:sala_id', async (req, res) => {
  const { sala_id } = req.params;
  const { nome, descricao, professor_id } = req.body;
  if (!nome || !professor_id) return res.status(400).json({ error: 'Nome da sala é obrigatório' });
  try {
    const salaResult = await pool.query('SELECT id FROM salas WHERE id = $1 AND professor_id = $2', [sala_id, professor_id]);
    if (salaResult.rows.length === 0) return res.status(403).json({ error: 'Sala não encontrada ou sem permissão' });
    const result = await pool.query(`UPDATE salas SET nome = $1, descricao = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, nome, descricao, codigo_sala, qr_code, updated_at`, [nome, descricao, sala_id]);
    res.json({ success: true, message: 'Sala atualizada com sucesso!', sala: result.rows[0] });
  } catch (error) {
    console.error(' Erro ao atualizar sala:', error);
    res.status(500).json({ error: 'Erro ao atualizar sala' });
  }
});

app.delete('/alunos/:aluno_id', async (req, res) => {
  const { aluno_id } = req.params;
  const { professor_id } = req.body;
  if (!professor_id) return res.status(400).json({ error: 'ID do professor é obrigatório' });
  try {
    const alunoResult = await pool.query('SELECT sala_id FROM sala_alunos WHERE id = $1', [aluno_id]);
    if (alunoResult.rows.length === 0) return res.status(404).json({ error: 'Aluno não encontrado' });
    const { sala_id } = alunoResult.rows[0];
    const salaResult = await pool.query('SELECT id FROM salas WHERE id = $1 AND professor_id = $2', [sala_id, professor_id]);
    if (salaResult.rows.length === 0) return res.status(403).json({ error: 'Permissão negada' });
    await pool.query('DELETE FROM sala_alunos WHERE id = $1', [aluno_id]);
    res.json({ success: true, message: 'Aluno removido com sucesso' });
  } catch (error) {
    console.error(' Erro ao excluir aluno:', error);
    res.status(500).json({ error: 'Erro ao excluir aluno' });
  }
});

// === ROTAS DE ORGANIZAÇÃO ===
app.post('/organizacoes', async (req, res) => {
  const { sala_id, algoritmo, grupos, data } = req.body;
  if (!sala_id || !algoritmo || !grupos) return res.status(400).json({ success: false, error: 'Dados incompletos' });
  try {
    const result = await pool.query(`INSERT INTO organizacoes (sala_id, algoritmo, grupos_json, data_organizacao) VALUES ($1, $2, $3, $4) RETURNING id`, [sala_id, algoritmo, JSON.stringify(grupos), data]);
    res.json({ success: true, message: 'Organização salva com sucesso', organizacao_id: result.rows[0].id });
  } catch (error) {
    console.error(' Erro ao salvar organização:', error);
    res.status(500).json({ success: false, error: 'Erro ao salvar organização' });
  }
});

app.get('/salas/:sala_id/ultima-organizacao', async (req, res) => {
  const { sala_id } = req.params;
  try {
    const result = await pool.query(`SELECT id, sala_id, algoritmo, grupos_json, data_organizacao, created_at FROM organizacoes WHERE sala_id = $1 ORDER BY created_at DESC LIMIT 1`, [sala_id]);
    if (result.rows.length === 0) return res.json({ success: true, organizacao: null, message: 'Nenhuma organização encontrada' });
    res.json({ success: true, organizacao: result.rows[0] });
  } catch (error) {
    console.error(' Erro ao buscar organização:', error);
    res.status(500).json({ error: 'Erro ao buscar organização' });
  }
});

// === LIMPEZA AUTOMÁTICA ===
setInterval(async () => {
  try {
    const result = await pool.query('DELETE FROM verification_codes WHERE expires_at < NOW()');
    if (result.rowCount > 0) console.log(`🧹 ${result.rowCount} códigos expirados removidos`);
  } catch (error) {
    console.error(' Erro na limpeza:', error);
  }
}, 60 * 60 * 1000);

// === INICIAR SERVIDOR ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(` Servidor rodando na porta ${PORT}`);
  console.log(` Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Banco de dados: PostgreSQL`);
});