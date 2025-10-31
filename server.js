// import express from 'express';
// import cors from 'cors';
// import pkg from 'pg';
// import dotenv from 'dotenv';
// import bcrypt from 'bcrypt';
// import crypto from 'crypto';
// import nodemailer from 'nodemailer';

// dotenv.config();
// const { Pool } = pkg;

// const app = express();
// app.use(cors());
// app.use(express.json());

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL
// });

// // 📧 Configurar transportador de email
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASSWORD
//   }
// });

// // 🗄️ CRIAR TABELAS (execute uma vez)
// app.post('/create-tables', async (req, res) => {
//   try {
//     // Tabela de usuários
//     await pool.query(`
//       CREATE TABLE IF NOT EXISTS users (
//         id SERIAL PRIMARY KEY,
//         username VARCHAR(255) NOT NULL,
//         email VARCHAR(255) UNIQUE NOT NULL,
//         password VARCHAR(255) NOT NULL,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);

//     // Tabela de salas
//     await pool.query(`
//       CREATE TABLE IF NOT EXISTS salas (
//         id SERIAL PRIMARY KEY,
//         nome VARCHAR(255) NOT NULL,
//         descricao TEXT,
//         codigo_sala VARCHAR(10) UNIQUE NOT NULL,
//         qr_code TEXT,
//         professor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);

//     // Tabela de alunos nas salas
//     await pool.query(`
//       CREATE TABLE IF NOT EXISTS sala_alunos (
//         id SERIAL PRIMARY KEY,
//         sala_id INTEGER REFERENCES salas(id) ON DELETE CASCADE,
//         nome_aluno VARCHAR(255) NOT NULL,
//         email_aluno VARCHAR(255),
//         rgm VARCHAR(50),
//         interesse VARCHAR(100),
//         perfil VARCHAR(100),
//         experiencia VARCHAR(100),
//         joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);

//     // Tabela de códigos de verificação
//     await pool.query(`
//       CREATE TABLE IF NOT EXISTS verification_codes (
//         id SERIAL PRIMARY KEY,
//         email VARCHAR(255) NOT NULL,
//         username VARCHAR(255) NOT NULL,
//         code VARCHAR(6) NOT NULL,
//         attempts INTEGER DEFAULT 0,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         expires_at TIMESTAMP NOT NULL
//       )
//     `);

//     // Tabela de Organizações
//     await pool.query(`
//       CREATE TABLE IF NOT EXISTS organizacoes (
//         id SERIAL PRIMARY KEY,
//         sala_id INTEGER NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
//         algoritmo VARCHAR(50) NOT NULL,
//         grupos_json JSONB NOT NULL,
//         data_organizacao TIMESTAMP NOT NULL,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);

//     // Índices
//     await pool.query(`
//       CREATE INDEX IF NOT EXISTS idx_verification_email
//       ON verification_codes(email)
//     `);
//     await pool.query(`
//       CREATE INDEX IF NOT EXISTS idx_organizacoes_sala
//       ON organizacoes(sala_id)
//     `);

//     res.json({ message: 'Tabelas criadas com sucesso!' });
//   } catch (error) {
//     console.error('Erro ao criar tabelas:', error);
//     res.status(500).json({ error: 'Erro ao criar tabelas' });
//   }
// });


// // === ROTAS DE VERIFICAÇÃO DE EMAIL ===
// app.post('/enviarCodigoVerificacao', async (req, res) => {
//   const { email, username } = req.body;
//   if (!email || !username) {
//     return res.status(400).json({ error: 'Email e username são obrigatórios' });
//   }
//   try {
//     const usuarioExistente = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
//     if (usuarioExistente.rows.length > 0) {
//       return res.status(400).json({ error: 'Este email já está cadastrado' });
//     }
//     const code = crypto.randomInt(100000, 999999).toString();
//     const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
//     await pool.query('DELETE FROM verification_codes WHERE email = $1', [email]);
//     await pool.query(
//       `INSERT INTO verification_codes (email, username, code, expires_at) VALUES ($1, $2, $3, $4)`,
//       [email, username, code, expiresAt]
//     );
//     const mailOptions = {
//       from: `"Profidina Ágil" <${process.env.EMAIL_USER}>`,
//       to: email,
//       subject: 'Código de Verificação - Profidina Ágil',
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//           <div style="background: linear-gradient(135deg, #48c9f4 0%, #272262 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
//             <h1 style="color: white; margin: 0; font-size: 28px;">Profidina Ágil</h1>
//             <p style="color: white; margin: 10px 0 0 0; font-size: 14px;">Sistema de Organização de Grupos</p>
//           </div>
//           <div style="background: #f8f9fa; padding: 40px 30px; border-radius: 0 0 10px 10px;">
//             <h2 style="color: #272262; margin-top: 0;">Bem-vindo, ${username}! 🎓</h2>
//             <p style="color: #333; font-size: 16px; line-height: 1.6;">
//               Estamos felizes em tê-lo conosco! Para completar seu cadastro,
//               utilize o código de verificação abaixo:
//             </p>
//             <div style="background: white; padding: 25px; text-align: center; margin: 30px 0; border-radius: 8px; border: 2px dashed #48c9f4;">
//               <p style="color: #666; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
//                 Seu Código
//               </p>
//               <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #272262; font-family: 'Courier New', monospace;">
//                 ${code}
//               </div>
//             </div>
//             <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
//               <p style="margin: 0; color: #856404; font-size: 14px;">
//                 ⏱️ <strong>Atenção:</strong> Este código expira em <strong>10 minutos</strong>
//               </p>
//             </div>
//             <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
//               Se você não solicitou este código, pode ignorar este email com segurança.
//             </p>
//           </div>
//           <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
//             <p style="margin: 5px 0;">Este é um email automático, por favor não responda.</p>
//             <p style="margin: 5px 0;">© ${new Date().getFullYear()} Profidina Ágil - TCC</p>
//           </div>
//         </div>
//       `
//     };
//     await transporter.sendMail(mailOptions);
//     console.log(`Código enviado para ${email}: ${code}`);
//     res.json({
//       success: true,
//       message: 'Código enviado com sucesso',
//       code: process.env.NODE_ENV === 'development' ? code : undefined
//     });
//   } catch (error) {
//     console.error(' Erro ao enviar código:', error);
//     res.status(500).json({
//       error: 'Erro ao enviar código de verificação'
//     });
//   }
// });
// app.post('/verificarECadastrar', async (req, res) => {
//   const { email, username, password, verificationCode } = req.body;
//   if (!email || !username || !password || !verificationCode) {
//     return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
//   }
//   try {
//     const codeResult = await pool.query(
//       `SELECT id, code, attempts, expires_at
//        FROM verification_codes
//        WHERE email = $1
//        ORDER BY created_at DESC
//        LIMIT 1`,
//       [email]
//     );
//     if (codeResult.rows.length === 0) {
//       return res.status(400).json({
//         error: 'Código não encontrado. Solicite um novo código.'
//       });
//     }
//     const storedData = codeResult.rows[0];
//     if (new Date() > new Date(storedData.expires_at)) {
//       await pool.query('DELETE FROM verification_codes WHERE id = $1', [storedData.id]);
//       return res.status(400).json({
//         error: 'Código expirado. Solicite um novo código.'
//       });
//     }
//     if (storedData.attempts >= 5) {
//       await pool.query('DELETE FROM verification_codes WHERE id = $1', [storedData.id]);
//       return res.status(400).json({
//         error: 'Número máximo de tentativas excedido. Solicite um novo código.'
//       });
//     }
//     if (storedData.code !== verificationCode) {
//       await pool.query(
//         'UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1',
//         [storedData.id]
//       );
//       return res.status(400).json({
//         error: `Código inválido. Tentativas restantes: ${5 - (storedData.attempts + 1)}`
//       });
//     }
//     const usuarioExistente = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
//     if (usuarioExistente.rows.length > 0) {
//       await pool.query('DELETE FROM verification_codes WHERE id = $1', [storedData.id]);
//       return res.status(400).json({
//         error: 'Este email já está cadastrado'
//       });
//     }
//     const saltRounds = 12;
//     const hashedPassword = await bcrypt.hash(password, saltRounds);
//     const result = await pool.query(
//       `INSERT INTO users (username, email, password)
//        VALUES ($1, $2, $3)
//        RETURNING id, username, email`,
//       [username, email, hashedPassword]
//     );
//     const newUser = result.rows[0];
//     await pool.query('DELETE FROM verification_codes WHERE id = $1', [storedData.id]);
//     console.log(`Usuário cadastrado com sucesso: ${email}`);
//     res.json({
//       success: true,
//       message: 'Cadastro realizado com sucesso!',
//       user: {
//         id: newUser.id,
//         username: newUser.username,
//         email: newUser.email
//       }
//     });
//   } catch (error) {
//     console.error(' Erro ao verificar e cadastrar:', error);
//     if (error.code === '23505') {
//       return res.status(400).json({ error: 'Email já cadastrado' });
//     }
//     res.status(500).json({
//       error: 'Erro ao processar cadastro'
//     });
//   }
// });


// // === ROTAS DE AUTENTICAÇÃO ===
// app.post('/cpoCadastroUsuario', async (req, res) => {
//   const { username, email, password } = req.body;
//   if (!username || !email || !password) {
//     return res.status(400).json({ error: 'Preencha todos os campos' });
//   }
//   try {
//     const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
//     if (existingUser.rows.length > 0) {
//       return res.status(400).json({ error: 'Email já cadastrado' });
//     }
//     const saltRounds = 12;
//     const hashedPassword = await bcrypt.hash(password, saltRounds);
//     const result = await pool.query(
//       'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
//       [username, email, hashedPassword]
//     );
//     const newUser = result.rows[0];
//     res.status(201).json({
//       success: true,
//       message: 'Usuário cadastrado com sucesso',
//       user: {
//         id: newUser.id,
//         username: newUser.username,
//         email: newUser.email
//       }
//     });
//   } catch (error) {
//     console.error(' Erro no cpoCadastroUsuario:', error);
//     res.status(500).json({ error: 'Erro ao cadastrar usuário' });
//   }
// });
// app.post('/cpoConectarUsuario', async (req, res) => {
//   const { email, password } = req.body;
//   if (!email || !password) {
//     return res.status(400).json({ error: 'Preencha todos os campos' });
//   }
//   try {
//     const result = await pool.query(
//       'SELECT id, username, email, password FROM users WHERE email = $1',
//       [email]
//     );
//     if (result.rows.length === 0) {
//       return res.status(401).json({
//         success: false,
//         error: 'E-mail ou senha incorretos!'
//       });
//     }
//     const user = result.rows[0];
//     const isPasswordValid = await bcrypt.compare(password, user.password);
//     if (isPasswordValid) {
//       res.json({
//         success: true,
//         message: 'Login autorizado',
//         user: {
//           id: user.id,
//           username: user.username,
//           email: user.email
//         }
//       });
//     } else {
//       res.status(401).json({
//         success: false,
//         error: 'E-mail ou senha incorretos!'
//       });
//     }
//   } catch (error) {
//     console.error(' Erro no cpoConectarUsuario:', error);
//     res.status(500).json({ error: 'Erro no login' });
//   }
// });


// // === ROTAS DE SALAS ===
// app.post('/salas', async (req, res) => {
//   const { nome, descricao, professor_id } = req.body;
//   if (!nome || !professor_id) {
//     return res.status(400).json({ error: 'Nome da sala e professor são obrigatórios' });
//   }
//   try {
//     const codigo_sala = crypto.randomBytes(3).toString('hex').toUpperCase();
//     const qr_code = `SALA:${codigo_sala}`;
//     const result = await pool.query(
//       `INSERT INTO salas (nome, descricao, codigo_sala, qr_code, professor_id)
//        VALUES ($1, $2, $3, $4, $5)
//        RETURNING id, nome, descricao, codigo_sala, qr_code, created_at`,
//       [nome, descricao, codigo_sala, qr_code, professor_id]
//     );
//     const novaSala = result.rows[0];
//     res.status(201).json({
//       success: true,
//       message: 'Sala criada com sucesso!',
//       sala: novaSala
//     });
//   } catch (error) {
//     console.error(' Erro ao criar sala:', error);
//     if (error.code === '23505' && error.constraint === 'salas_codigo_sala_key') {
//       return res.status(400).json({ error: 'Código da sala já existe. Tente novamente.' });
//     }
//     res.status(500).json({ error: 'Erro ao criar sala' });
//   }
// });
// app.get('/salas/professor/:professor_id', async (req, res) => {
//   const { professor_id } = req.params;
//   if (!professor_id || professor_id === 'undefined') {
//     return res.status(400).json({ error: 'ID do professor inválido' });
//   }
//   try {
//     const result = await pool.query(
//       `SELECT s.id, s.nome, s.descricao, s.codigo_sala, s.qr_code,
//               s.created_at, s.updated_at,
//               COUNT(sa.id) as total_alunos
//        FROM salas s
//        LEFT JOIN sala_alunos sa ON s.id = sa.sala_id
//        WHERE s.professor_id = $1
//        GROUP BY s.id, s.nome, s.descricao, s.codigo_sala, s.qr_code, s.created_at, s.updated_at
//        ORDER BY s.created_at DESC`,
//       [professor_id]
//     );
//     res.json({
//       success: true,
//       salas: result.rows
//     });
//   } catch (error) {
//     console.error(' Erro ao buscar salas:', error);
//     res.status(500).json({ error: 'Erro ao buscar salas' });
//   }
// });
// app.delete('/salas/:sala_id', async (req, res) => {
//   const { sala_id } = req.params;
//   const { professor_id } = req.body;
//   try {
//     const salaResult = await pool.query(
//       'SELECT id FROM salas WHERE id = $1 AND professor_id = $2',
//       [sala_id, professor_id]
//     );
//     if (salaResult.rows.length === 0) {
//       return res.status(403).json({ error: 'Sala não encontrada ou sem permissão' });
//     }
//     await pool.query('DELETE FROM salas WHERE id = $1', [sala_id]);
//     res.json({
//       success: true,
//       message: 'Sala excluída com sucesso!'
//     });
//   } catch (error) {
//     console.error(' Erro ao excluir sala:', error);
//     res.status(500).json({ error: 'Erro ao excluir sala' });
//   }
// });
// app.put('/salas/:sala_id', async (req, res) => {
//   const { sala_id } = req.params;
//   const { nome, descricao, professor_id } = req.body;
//   if (!nome || !professor_id) {
//     return res.status(400).json({ error: 'Nome da sala é obrigatório' });
//   }
//   try {
//     const salaResult = await pool.query(
//       'SELECT id FROM salas WHERE id = $1 AND professor_id = $2',
//       [sala_id, professor_id]
//     );
//     if (salaResult.rows.length === 0) {
//       return res.status(403).json({ error: 'Sala não encontrada ou sem permissão' });
//     }
//     const result = await pool.query(
//       `UPDATE salas
//        SET nome = $1, descricao = $2, updated_at = CURRENT_TIMESTAMP
//        WHERE id = $3
//        RETURNING id, nome, descricao, codigo_sala, qr_code, updated_at`,
//       [nome, descricao, sala_id]
//     );
//     res.json({
//       success: true,
//       message: 'Sala atualizada com sucesso!',
//       sala: result.rows[0]
//     });
//   } catch (error) {
//     console.error(' Erro ao atualizar sala:', error);
//     res.status(500).json({ error: 'Erro ao atualizar sala' });
//   }
// });
// app.post('/salas/entrar', async (req, res) => {
//   const { codigo_sala, nome_aluno, email_aluno } = req.body;
//   if (!codigo_sala || !nome_aluno) {
//     return res.status(400).json({ error: 'Código da sala e nome do aluno são obrigatórios' });
//   }
//   try {
//     const salaResult = await pool.query(
//       'SELECT id, nome FROM salas WHERE codigo_sala = $1',
//       [codigo_sala]
//     );
//     if (salaResult.rows.length === 0) {
//       return res.status(404).json({ error: 'Sala não encontrada' });
//     }
//     const sala = salaResult.rows[0];
//     const alunoExistente = await pool.query(
//       'SELECT id FROM sala_alunos WHERE sala_id = $1 AND nome_aluno = $2',
//       [sala.id, nome_aluno]
//     );
//     if (alunoExistente.rows.length > 0) {
//       return res.status(400).json({ error: 'Aluno já está nesta sala' });
//     }
//     await pool.query(
//       'INSERT INTO sala_alunos (sala_id, nome_aluno, email_aluno) VALUES ($1, $2, $3)',
//       [sala.id, nome_aluno, email_aluno]
//     );
//     res.json({
//       success: true,
//       message: `Bem-vindo à sala "${sala.nome}"!`,
//       sala_nome: sala.nome
//     });
//   } catch (error) {
//     console.error(' Erro ao entrar na sala:', error);
//     res.status(500).json({ error: 'Erro ao entrar na sala' });
//   }
// });
// app.post('/salas/entrar-com-perfil', async (req, res) => {
//   const { codigo_sala, nome_aluno, rgm, email_aluno, interesse, perfil, experiencia } = req.body;
//   if (!codigo_sala || !nome_aluno || !rgm) {
//     return res.status(400).json({ error: 'Código da sala, nome e RGM são obrigatórios' });
//   }
//   if (!interesse || !perfil || !experiencia) {
//     return res.status(400).json({ error: 'Por favor, responda todas as perguntas' });
//   }
//   try {
//     const salaResult = await pool.query(
//       'SELECT id, nome FROM salas WHERE codigo_sala = $1',
//       [codigo_sala]
//     );
//     if (salaResult.rows.length === 0) {
//       return res.status(404).json({ error: 'Código inválido' });
//     }
//     const sala = salaResult.rows[0];
//     const alunoExistente = await pool.query(
//       'SELECT id FROM sala_alunos WHERE sala_id = $1 AND rgm = $2',
//       [sala.id, rgm]
//     );
//     if (alunoExistente.rows.length > 0) {
//       await pool.query(
//         `UPDATE sala_alunos
//          SET nome_aluno = $1, interesse = $2, perfil = $3, experiencia = $4, email_aluno = $5
//          WHERE sala_id = $6 AND rgm = $7`,
//         [nome_aluno, interesse, perfil, experiencia, email_aluno, sala.id, rgm]
//       );
//       return res.json({ success: true, message: 'Dados atualizados!', sala_nome: sala.nome });
//     }
//     await pool.query(
//       `INSERT INTO sala_alunos (sala_id, nome_aluno, rgm, email_aluno, interesse, perfil, experiencia)
//        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
//       [sala.id, nome_aluno, rgm, email_aluno, interesse, perfil, experiencia]
//     );
//     console.log(` Aluno "${nome_aluno}" (RGM: ${rgm}) entrou na sala "${sala.nome}"`);
//     res.json({ success: true, message: `Bem-vindo à sala "${sala.nome}"!`, sala_nome: sala.nome });
//   } catch (error) {
//     console.error(' Erro:', error);
//     res.status(500).json({ error: 'Erro ao entrar na sala' });
//   }
// });

// // 👥 LISTAR ALUNOS DE UMA SALA
// app.get('/salas/:sala_id/alunos', async (req, res) => {
//   const { sala_id } = req.params;
//   const { professor_id } = req.query;
//   try {
//     const salaResult = await pool.query(
//       'SELECT id, nome FROM salas WHERE id = $1 AND professor_id = $2',
//       [sala_id, professor_id]
//     );
//     if (salaResult.rows.length === 0) {
//       return res.status(403).json({ error: 'Sala não encontrada ou sem permissão' });
//     }
//     const alunosResult = await pool.query(
//       `SELECT id, nome_aluno, email_aluno, joined_at, rgm
//        FROM sala_alunos
//        WHERE sala_id = $1
//        ORDER BY joined_at DESC`,
//       [sala_id]
//     );
//     res.json({
//       success: true,
//       sala_nome: salaResult.rows[0].nome,
//       alunos: alunosResult.rows
//     });
//   } catch (error) {
//     console.error(' Erro ao buscar alunos:', error);
//     res.status(500).json({ error: 'Erro ao buscar alunos' });
//   }
// });

// //  EXCLUIR ALUNO DA SALA
// app.delete('/alunos/:aluno_id', async (req, res) => {
//   const { aluno_id } = req.params;
//   const { professor_id } = req.body;
//   if (!professor_id) {
//     return res.status(400).json({ error: 'ID do professor é obrigatório' });
//   }
//   try {
//     const alunoResult = await pool.query(
//       'SELECT sala_id FROM sala_alunos WHERE id = $1',
//       [aluno_id]
//     );
//     if (alunoResult.rows.length === 0) {
//       return res.status(404).json({ error: 'Aluno não encontrado' });
//     }
//     const { sala_id } = alunoResult.rows[0];
//     const salaResult = await pool.query(
//       'SELECT id FROM salas WHERE id = $1 AND professor_id = $2',
//       [sala_id, professor_id]
//     );
//     if (salaResult.rows.length === 0) {
//       return res.status(403).json({ error: 'Permissão negada. Você não é o professor desta sala.' });
//     }
//     await pool.query('DELETE FROM sala_alunos WHERE id = $1', [aluno_id]);
//     res.json({ success: true, message: 'Aluno removido com sucesso' });
//   } catch (error) {
//     console.error('💥 Erro ao excluir aluno:', error);
//     res.status(500).json({ error: 'Erro ao excluir aluno' });
//   }
// });


// // === ROTAS DE ORGANIZAÇÃO/GRUPOS ===

// // BUSCAR UMA SALA ESPECÍFICA POR ID
// app.get('/salas/:sala_id', async (req, res) => {
//   const { sala_id } = req.params;
//   try {
//     const result = await pool.query(
//       `SELECT s.id, s.nome, s.descricao, s.codigo_sala, s.qr_code,
//               s.created_at, s.updated_at,
//               COUNT(DISTINCT sa.id) as total_alunos
//        FROM salas s
//        LEFT JOIN sala_alunos sa ON s.id = sa.sala_id
//        WHERE s.id = $1
//        GROUP BY s.id, s.nome, s.descricao, s.codigo_sala, s.qr_code,
//                 s.created_at, s.updated_at`,
//       [sala_id]
//     );
//     if (result.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         error: 'Sala não encontrada'
//       });
//     }
//     res.json({
//       success: true,
//       sala: result.rows[0]
//     });
//   } catch (error) {
//     console.error('💥 Erro ao buscar sala:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Erro ao buscar sala'
//     });
//   }
// });

// // 💾 SALVAR ORGANIZAÇÃO DE GRUPOS
// app.post('/organizacoes', async (req, res) => {
//   const { sala_id, algoritmo, grupos, data } = req.body;
//   if (!sala_id || !algoritmo || !grupos) {
//     return res.status(400).json({
//       success: false,
//       error: 'Dados incompletos'
//     });
//   }
//   try {
//     const result = await pool.query(
//       `INSERT INTO organizacoes (sala_id, algoritmo, grupos_json, data_organizacao)
//        VALUES ($1, $2, $3, $4)
//        RETURNING id`,
//       [sala_id, algoritmo, JSON.stringify(grupos), data]
//     );
//     res.json({
//       success: true,
//       message: 'Organização salva com sucesso',
//       organizacao_id: result.rows[0].id
//     });
//   } catch (error) {
//     console.error(' Erro ao salvar organização:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Erro ao salvar organização'
//     });
//   }
// });

// // 📋 BUSCAR ÚLTIMA ORGANIZAÇÃO DA SALA
// app.get('/salas/:sala_id/ultima-organizacao', async (req, res) => {
//   const { sala_id } = req.params;
//   try {
//     const result = await pool.query(
//       `SELECT
//          id,
//          sala_id,
//          algoritmo,
//          grupos_json,
//          data_organizacao,
//          created_at
//        FROM organizacoes
//        WHERE sala_id = $1
//        ORDER BY created_at DESC
//        LIMIT 1`,
//       [sala_id]
//     );
//     if (result.rows.length === 0) {
//       return res.json({
//         success: true,
//         organizacao: null,
//         message: 'Nenhuma organização encontrada'
//       });
//     }
//     res.json({
//       success: true,
//       organizacao: result.rows[0]
//     });
//   // ===== CORREÇÃO AQUI =====
//   } catch (error) {
//     console.error('💥 Erro ao buscar última organização:', error);
//     res.status(500).json({
//       error: 'Erro ao buscar organização'
//     });
//   }
// });


// // === ROTAS UTILITÁRIAS ===
// app.post('/limpar-codigos-expirados', async (req, res) => {
//   try {
//     const result = await pool.query(
//       'DELETE FROM verification_codes WHERE expires_at < NOW() RETURNING id'
//     );
//     console.log(`🧹 ${result.rowCount} códigos expirados removidos`);
//     res.json({
//       success: true,
//       message: `${result.rowCount} códigos expirados removidos`
//     });
//   } catch (error) {
//     console.error(' Erro ao limpar códigos:', error);
//     res.status(500).json({ error: 'Erro ao limpar códigos' });
//   }
// });
// app.post('/migrate-passwords', async (req, res) => {
//   try {
//     const users = await pool.query('SELECT id, password FROM users');
//     for (const user of users.rows) {
//       if (user.password && !user.password.startsWith('$2')) { // Check if password exists
//         const hashedPassword = await bcrypt.hash(user.password, 12);
//         await pool.query(
//           'UPDATE users SET password = $1 WHERE id = $2',
//           [hashedPassword, user.id]
//         );
//         console.log(`✅ Senha do usuário ${user.id} migrada`);
//       }
//     }
//     res.json({ message: 'Migração concluída' });
//   } catch (error) {
//     console.error(' Erro na migração:', error);
//     res.status(500).json({ error: 'Erro na migração' });
//   }
// });
// setInterval(async () => {
//   try {
//     const result = await pool.query(
//       'DELETE FROM verification_codes WHERE expires_at < NOW()'
//     );
//     if (result.rowCount > 0) {
//       console.log(` ${result.rowCount} códigos expirados removidos automaticamente`);
//     }
//   } catch (error) {
//     console.error(' Erro na limpeza automática:', error);
//   }
// }, 60 * 60 * 1000); // 1 hora


// // === INICIAR SERVIDOR ===
// app.listen(3000, () => console.log(' Servidor rodando na porta 3000'));


import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

dotenv.config();
const { Pool } = pkg;

const app = express();

// 🔧 CORS configurado para aceitar o frontend do Vercel
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://seu-app.vercel.app', // ⚠️ TROCAR PELA SUA URL DO VERCEL DEPOIS
  ],
  credentials: true
}));

app.use(express.json());

// 🗄️ Conexão com PostgreSQL (agora usando SSL para Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 📧 Configurar transportador de email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// 🏥 ROTA DE HEALTH CHECK (para manter o servidor acordado)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 🏠 Rota raiz
app.get('/', (req, res) => {
  res.json({ 
    message: '🎓 Profidina Ágil - API funcionando!',
    version: '1.0.0'
  });
});

// 🗄️ CRIAR TABELAS (execute uma vez)
app.post('/create-tables', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS salas (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT,
        codigo_sala VARCHAR(10) UNIQUE NOT NULL,
        qr_code TEXT,
        professor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sala_alunos (
        id SERIAL PRIMARY KEY,
        sala_id INTEGER REFERENCES salas(id) ON DELETE CASCADE,
        nome_aluno VARCHAR(255) NOT NULL,
        email_aluno VARCHAR(255),
        rgm VARCHAR(50),
        interesse VARCHAR(100),
        perfil VARCHAR(100),
        experiencia VARCHAR(100),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS organizacoes (
        id SERIAL PRIMARY KEY,
        sala_id INTEGER NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
        algoritmo VARCHAR(50) NOT NULL,
        grupos_json JSONB NOT NULL,
        data_organizacao TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_verification_email
      ON verification_codes(email)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_organizacoes_sala
      ON organizacoes(sala_id)
    `);

    res.json({ message: '✅ Tabelas criadas com sucesso!' });
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error);
    res.status(500).json({ error: 'Erro ao criar tabelas', details: error.message });
  }
});

// === ROTAS DE VERIFICAÇÃO DE EMAIL ===
app.post('/enviarCodigoVerificacao', async (req, res) => {
  const { email, username } = req.body;
  if (!email || !username) {
    return res.status(400).json({ error: 'Email e username são obrigatórios' });
  }
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
    const mailOptions = {
      from: `"Profidina Ágil" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Código de Verificação - Profidina Ágil',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #48c9f4 0%, #272262 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Profidina Ágil</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 14px;">Sistema de Organização de Grupos</p>
          </div>
          <div style="background: #f8f9fa; padding: 40px 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #272262; margin-top: 0;">Bem-vindo, ${username}! 🎓</h2>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Estamos felizes em tê-lo conosco! Para completar seu cadastro,
              utilize o código de verificação abaixo:
            </p>
            <div style="background: white; padding: 25px; text-align: center; margin: 30px 0; border-radius: 8px; border: 2px dashed #48c9f4;">
              <p style="color: #666; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                Seu Código
              </p>
              <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #272262; font-family: 'Courier New', monospace;">
                ${code}
              </div>
            </div>
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                ⏱️ <strong>Atenção:</strong> Este código expira em <strong>10 minutos</strong>
              </p>
            </div>
            <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
              Se você não solicitou este código, pode ignorar este email com segurança.
            </p>
          </div>
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p style="margin: 5px 0;">Este é um email automático, por favor não responda.</p>
            <p style="margin: 5px 0;">© ${new Date().getFullYear()} Profidina Ágil - TCC</p>
          </div>
        </div>
      `
    };
    await transporter.sendMail(mailOptions);
    console.log(`📧 Código enviado para ${email}: ${code}`);
    res.json({
      success: true,
      message: 'Código enviado com sucesso',
      code: process.env.NODE_ENV === 'development' ? code : undefined
    });
  } catch (error) {
    console.error('❌ Erro ao enviar código:', error);
    res.status(500).json({
      error: 'Erro ao enviar código de verificação'
    });
  }
});

app.post('/verificarECadastrar', async (req, res) => {
  const { email, username, password, verificationCode } = req.body;
  if (!email || !username || !password || !verificationCode) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  try {
    const codeResult = await pool.query(
      `SELECT id, code, attempts, expires_at
       FROM verification_codes
       WHERE email = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );
    if (codeResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Código não encontrado. Solicite um novo código.'
      });
    }
    const storedData = codeResult.rows[0];
    if (new Date() > new Date(storedData.expires_at)) {
      await pool.query('DELETE FROM verification_codes WHERE id = $1', [storedData.id]);
      return res.status(400).json({
        error: 'Código expirado. Solicite um novo código.'
      });
    }
    if (storedData.attempts >= 5) {
      await pool.query('DELETE FROM verification_codes WHERE id = $1', [storedData.id]);
      return res.status(400).json({
        error: 'Número máximo de tentativas excedido. Solicite um novo código.'
      });
    }
    if (storedData.code !== verificationCode) {
      await pool.query(
        'UPDATE verification_codes SET attempts = attempts + 1 WHERE id = $1',
        [storedData.id]
      );
      return res.status(400).json({
        error: `Código inválido. Tentativas restantes: ${5 - (storedData.attempts + 1)}`
      });
    }
    const usuarioExistente = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (usuarioExistente.rows.length > 0) {
      await pool.query('DELETE FROM verification_codes WHERE id = $1', [storedData.id]);
      return res.status(400).json({
        error: 'Este email já está cadastrado'
      });
    }
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await pool.query(
      `INSERT INTO users (username, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, username, email`,
      [username, email, hashedPassword]
    );
    const newUser = result.rows[0];
    await pool.query('DELETE FROM verification_codes WHERE id = $1', [storedData.id]);
    console.log(`✅ Usuário cadastrado com sucesso: ${email}`);
    res.json({
      success: true,
      message: 'Cadastro realizado com sucesso!',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('❌ Erro ao verificar e cadastrar:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }
    res.status(500).json({
      error: 'Erro ao processar cadastro'
    });
  }
});

// === TODAS AS OUTRAS ROTAS (mantidas iguais) ===
app.post('/cpoCadastroUsuario', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos' });
  }
  try {
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );
    const newUser = result.rows[0];
    res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('❌ Erro no cpoCadastroUsuario:', error);
    res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
});

app.post('/cpoConectarUsuario', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos' });
  }
  try {
    const result = await pool.query(
      'SELECT id, username, email, password FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'E-mail ou senha incorretos!'
      });
    }
    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (isPasswordValid) {
      res.json({
        success: true,
        message: 'Login autorizado',
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'E-mail ou senha incorretos!'
      });
    }
  } catch (error) {
    console.error('❌ Erro no cpoConectarUsuario:', error);
    res.status(500).json({ error: 'Erro no login' });
  }
});

// [CONTINUA COM TODAS AS OUTRAS ROTAS DO SEU CÓDIGO ORIGINAL...]
// (Copie e cole todas as rotas de salas, alunos, organizações, etc)

// === LIMPEZA AUTOMÁTICA ===
setInterval(async () => {
  try {
    const result = await pool.query(
      'DELETE FROM verification_codes WHERE expires_at < NOW()'
    );
    if (result.rowCount > 0) {
      console.log(`🧹 ${result.rowCount} códigos expirados removidos automaticamente`);
    }
  } catch (error) {
    console.error('❌ Erro na limpeza automática:', error);
  }
}, 60 * 60 * 1000); // 1 hora

// === INICIAR SERVIDOR ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

// 🛠️ ROTA TEMPORÁRIA PARA CRIAR TABELAS VIA GET (apenas para setup inicial)
app.get('/create-tables', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS salas (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT,
        codigo_sala VARCHAR(10) UNIQUE NOT NULL,
        qr_code TEXT,
        professor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sala_alunos (
        id SERIAL PRIMARY KEY,
        sala_id INTEGER REFERENCES salas(id) ON DELETE CASCADE,
        nome_aluno VARCHAR(255) NOT NULL,
        email_aluno VARCHAR(255),
        rgm VARCHAR(50),
        interesse VARCHAR(100),
        perfil VARCHAR(100),
        experiencia VARCHAR(100),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS organizacoes (
        id SERIAL PRIMARY KEY,
        sala_id INTEGER NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
        algoritmo VARCHAR(50) NOT NULL,
        grupos_json JSONB NOT NULL,
        data_organizacao TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_verification_email
      ON verification_codes(email)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_organizacoes_sala
      ON organizacoes(sala_id)
    `);

    res.json({ 
      success: true,
      message: '✅ Tabelas criadas com sucesso!' 
    });
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao criar tabelas', 
      details: error.message 
    });
  }
});
