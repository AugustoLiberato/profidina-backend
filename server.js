import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
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
app.post('/enviarCodigoVerificacao', async (req, res) => {
  const { email, username } = req.body;
  if (!email || !username) return res.status(400).json({ error: 'Email e username são obrigatórios' });
  
  try {
    // Verificar se o email já está cadastrado
    const usuarioExistente = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({ error: 'Este email já está cadastrado' });
    }
    
    // Gerar código de 6 dígitos
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    
    // Limpar códigos anteriores do mesmo email
    await pool.query('DELETE FROM verification_codes WHERE email = $1', [email]);
    
    // Inserir novo código
    await pool.query(
      `INSERT INTO verification_codes (email, username, code, expires_at) VALUES ($1, $2, $3, $4)`,
      [email, username, code, expiresAt]
    );
    
    const hasSendGrid = process.env.SENDGRID_API_KEY && 
                        process.env.SENDGRID_API_KEY.length > 0 && 
                        process.env.SENDGRID_API_KEY.startsWith('SG.');
    
    if (hasSendGrid) {
      try {
        //  TEMPLATE MELHORADO PARA EVITAR SPAM
        const emailHTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Verificação - Profidina Ágil</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 12px; overflow: hidden;">
          
          <!-- CABEÇALHO -->
          <tr>
            <td style="background: linear-gradient(135deg, #48c9f4 0%, #272262 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 600; letter-spacing: 1px;">
                🎓 Profidina Ágil
              </h1>
              <p style="margin: 10px 0 0 0; color: #e0e0e0; font-size: 16px;">
                Sistema de Organização de Salas de Aula
              </p>
            </td>
          </tr>
          
          <!-- CONTEÚDO PRINCIPAL -->
          <tr>
            <td style="padding: 40px 30px; background-color: #ffffff;">
              <h2 style="margin: 0 0 20px 0; color: #272262; font-size: 24px; font-weight: 600;">
                Olá, ${username}! 👋
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Obrigado por se cadastrar no <strong>Profidina Ágil</strong>. Para completar seu cadastro e garantir a segurança da sua conta, utilize o código de verificação abaixo:
              </p>
              
              <!-- CÓDIGO DE VERIFICAÇÃO -->
              <table role="presentation" style="width: 100%; margin: 30px 0; border-collapse: collapse;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border: 3px dashed #48c9f4; border-radius: 12px; padding: 30px; text-align: center;">
                    <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                      Seu Código de Verificação
                    </p>
                    <p style="margin: 0; font-size: 48px; font-weight: bold; color: #272262; letter-spacing: 12px; font-family: 'Courier New', Courier, monospace;">
                      ${code}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- AVISO DE EXPIRAÇÃO -->
              <table role="presentation" style="width: 100%; margin: 25px 0; border-collapse: collapse;">
                <tr>
                  <td style="background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 6px; padding: 15px 20px;">
                    <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.6;">
                      <strong>⏰ Atenção:</strong> Este código é válido por <strong>10 minutos</strong>. Após esse período, será necessário solicitar um novo código.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- INSTRUÇÕES -->
              <div style="margin: 25px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
                <h3 style="margin: 0 0 15px 0; color: #272262; font-size: 16px; font-weight: 600;">
                  📋 Como usar o código:
                </h3>
                <ol style="margin: 0; padding-left: 20px; color: #555555; font-size: 14px; line-height: 1.8;">
                  <li>Volte para a página de cadastro</li>
                  <li>Digite o código de 6 dígitos no campo indicado</li>
                  <li>Clique em "Confirmar e Cadastrar"</li>
                </ol>
              </div>
              
              <!-- SEGURANÇA -->
              <table role="presentation" style="width: 100%; margin: 25px 0; border-collapse: collapse;">
                <tr>
                  <td style="background-color: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 6px; padding: 15px 20px;">
                    <p style="margin: 0; color: #0c5460; font-size: 14px; line-height: 1.6;">
                      <strong>🔒 Segurança:</strong> Se você não solicitou este cadastro, ignore este email. Sua segurança é nossa prioridade.
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 25px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                Atenciosamente,<br>
                <strong style="color: #272262;">Equipe Profidina Ágil</strong>
              </p>
            </td>
          </tr>
          
          <!-- RODAPÉ -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px 0; color: #999999; font-size: 12px; line-height: 1.6;">
                Este é um email automático, por favor não responda.
              </p>
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} <strong>Profidina Ágil</strong> - Sistema de Organização de Salas de Aula
              </p>
              <p style="margin: 10px 0 0 0; color: #999999; font-size: 11px;">
                Desenvolvido como Trabalho de Conclusão de Curso
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `;

        // ✅ VERSÃO EM TEXTO PURO (IMPORTANTE!)
        const emailText = `
Olá, ${username}!

Obrigado por se cadastrar no Profidina Ágil.

Seu código de verificação é: ${code}

Este código é válido por 10 minutos.

Como usar:
1. Volte para a página de cadastro
2. Digite o código de 6 dígitos
3. Clique em "Confirmar e Cadastrar"

Se você não solicitou este cadastro, ignore este email.

---
Atenciosamente,
Equipe Profidina Ágil
Sistema de Organização de Salas de Aula

© ${new Date().getFullYear()} Profidina Ágil
Este é um email automático, não responda.
        `.trim();

        // ✅ ENVIAR COM SENDGRID
        await sgMail.send({
          from: {
            email: 'zorobabilo@gmail.com', // ⚠️ Certifique-se que este email está verificado no SendGrid
            name: 'Profidina Ágil'
          },
          to: email,
          subject: 'Código de Verificação - Profidina Ágil', // Título claro e direto
          html: emailHTML,
          text: emailText, // ✅ FUNDAMENTAL para evitar SPAM
          // ✅ Configurações adicionais anti-spam
          trackingSettings: {
            clickTracking: {
              enable: false
            },
            openTracking: {
              enable: false
            }
          },
          // ✅ Categoria para organização no SendGrid
          categories: ['verificacao-email'],
          // ✅ Custom Args (opcional)
          customArgs: {
            tipo: 'verificacao',
            ambiente: process.env.NODE_ENV || 'development'
          }
        });
        
        console.log(`✅ Email enviado com sucesso para ${email}`);
        
      } catch (emailError) {
        console.error('❌ Erro ao enviar email via SendGrid:', emailError);
        
        // Log detalhado do erro
        if (emailError.response) {
          console.error('Resposta do SendGrid:', emailError.response.body);
        }
        
        return res.status(500).json({ 
          success: false,
          error: 'Erro ao enviar email de verificação. Verifique se o email está correto.' 
        });
      }
    } else {
      // Modo desenvolvimento (sem SendGrid)
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔧 MODO DESENVOLVIMENTO - SendGrid não configurado`);
      console.log(`📧 Email: ${email}`);
      console.log(`👤 Username: ${username}`);
      console.log(`🔑 CÓDIGO DE VERIFICAÇÃO: ${code}`);
      console.log(`⏱️  Expira em: 10 minutos`);
      console.log(`💡 Copie o código acima e cole na tela de verificação`);
      console.log(`${'='.repeat(60)}\n`);
    }
    
    res.json({ 
      success: true, 
      message: 'Código enviado com sucesso! Verifique sua caixa de entrada e pasta de spam.',
      // ⚠️ REMOVA em produção (apenas para desenvolvimento)
      code: !hasSendGrid ? code : undefined
    });
    
  } catch (error) {
    console.error('❌ Erro geral ao enviar código:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao processar solicitação. Tente novamente.' 
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

//TESTEEEEEEEE
// ROTA DE TESTE - Adicione temporariamente no server.js
app.get('/test-sendgrid', async (req, res) => {
  try {
    console.log('🧪 Testando SendGrid...');
    
    await sgMail.send({
      from: {
        email: 'zorobabilo@gmail.com',
        name: 'Profidina Ágil'
      },
      to: 'zorobabilo@gmail.com', // Envie para você mesmo
      subject: '🧪 Teste SendGrid - Profidina Ágil',
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px;">
          <h1 style="color: #48c9f4;">✅ SendGrid Funcionando!</h1>
          <p>Se você recebeu este email, sua configuração do SendGrid está correta.</p>
          <p><strong>Próximo passo:</strong> Teste o cadastro completo no sistema.</p>
        </div>
      `,
      text: 'SendGrid funcionando! Se você recebeu este email, está tudo certo.',
      trackingSettings: {
        clickTracking: { enable: false },
        openTracking: { enable: false }
      }
    });
    
    console.log('✅ Email de teste enviado com sucesso!');
    res.json({ 
      success: true, 
      message: '✅ Email enviado! Verifique sua caixa de entrada (e spam).' 
    });
    
  } catch (error) {
    console.error('❌ Erro no teste do SendGrid:', error);
    if (error.response) {
      console.error('Detalhes do erro:', JSON.stringify(error.response.body, null, 2));
    }
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao enviar email',
      details: error.response?.body || error.message 
    });
  }
});