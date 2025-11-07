const express = require('express');
const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// Histórico em memória e controle de duplicatas
const messageHistory = [];
const processedMessages = new Set();

const resposta = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "Você é um atendente simpático da empresa Táttica, responda como humano, educado e útil." },
    { role: "user", content: "Quero saber mais sobre o serviço." }
  ]
})


// Configuração do cliente Notion
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Configuração do WhatsApp
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Middleware para logar requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Rota raiz
app.get('/', (req, res) => {
  res.send('Servidor está funcionando!');
});

// Webhook de verificação
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado!');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Receber mensagens do WhatsApp
app.post('/webhook', async (req, res) => {
  console.log('\n📩 Corpo recebido:', JSON.stringify(req.body, null, 2));

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];

    // Checa se existem mensagens
    const message = changes?.value?.messages?.[0];
    if (!message) {
      console.log('⚠️ Nenhuma mensagem de usuário detectada.');
      return res.sendStatus(200);
    }

    const from = message.from;
    const msg_body = message.text?.body || '';

    // Evita mensagens duplicadas
    if (processedMessages.has(message.id)) return res.sendStatus(200);
    processedMessages.add(message.id);

    // Pega profile name
    const contact = changes.value.contacts?.[0];
    const profileName = contact?.profile?.name || `Contato ${from}`;

    console.log(`💬 Mensagem de ${profileName} (${from}): ${msg_body}`);

    // Salva no histórico em memória
    messageHistory.push({ id: message.id, timestamp: new Date().toISOString(), from, profileName, message: msg_body });

    // Salva no Notion
    await saveMessageToNotion(from, msg_body, profileName);

    // Opcional: responder usando portfólio do Notion
    const portfolioData = await getPortfolioData();
    const response = processMessage(msg_body, portfolioData);

    // Envia resposta pelo WhatsApp
    const phone_number_id = changes.value.metadata.phone_number_id;
    await axios.post(
      `https://graph.facebook.com/v21.0/${phone_number_id}/messages?access_token=${WHATSAPP_TOKEN}`,
      { messaging_product: 'whatsapp', to: from, text: { body: response } }
    );

    console.log('✅ Resposta enviada com sucesso!');
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error.response?.data || error.message);
    res.sendStatus(500);
  }
});

// Rota para listar histórico em memória
app.get('/messages', (req, res) => res.json(messageHistory));

// Função para buscar dados do portfólio (opcional)
async function getPortfolioData() {
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_CONTATOS_DB_ID,
    });
    return response.results;
  } catch (error) {
    console.error('Erro ao buscar dados do Notion:', error.message);
    return [];
  }
}

// Salvar mensagem no Notion com relação ao contato
async function saveMessageToNotion(from, messageText, profileName) {
  const contatosDbId = process.env.NOTION_CONTATOS_DB_ID;
  const mensagensDbId = process.env.NOTION_MENSAGENS_DB_ID;
  if (!contatosDbId || !mensagensDbId) throw new Error('IDs dos bancos não configurados');

  // Verifica se o contato existe
  const contatoSearch = await notion.databases.query({
    database_id: contatosDbId,
    filter: { property: 'Número', rich_text: { equals: from } },
  });

  let contatoId;
  if (contatoSearch.results.length > 0) {
    contatoId = contatoSearch.results[0].id;
  } else {
    // Cria contato com profile name
    const newContato = await notion.pages.create({
      parent: { database_id: contatosDbId },
      properties: {
        Nome: { title: [{ text: { content: profileName } }] },
        Número: { rich_text: [{ text: { content: from } }] },
      },
    });
    contatoId = newContato.id;
  }

  // Salva a mensagem
  const now = new Date();
  const localDate = new Date(now.getTime() - 3 * 60 * 60 * 1000); // UTC-3

  await notion.pages.create({
    parent: { database_id: mensagensDbId },
    properties: {
      Mensagem: { title: [{ text: { content: messageText || 'Mensagem vazia' } }] },
      'Data/Hora': { date: { start: localDate.toISOString() } },
      Contato: { relation: [{ id: contatoId }] },
    },

  });

   // Após salvar a mensagem no Notion, atualizar a categoria automaticamente
  await atualizarCategoriaContato(contatoId, messageText);

    // Após salvar a mensagem, atualizar Categoria e Status automaticamente
  await atualizarContatoStatusECategoria(contatoId, messageText);

}


async function atualizarContatoStatusECategoria(contatoId, ultimaMensagem) {
  let categoria = 'Follow-up';
  let categoriaCor = 'yellow';
  let status = 'Em conversa';
  let statusCor = 'blue';

  const msg = ultimaMensagem.toLowerCase();

  // 🔍 Lógica inteligente de detecção automática
  if (msg.includes('vamos fechar') || msg.includes('contratar') || msg.includes('confirmado') || msg.includes('ok') || msg.includes('quero fechar') || msg.includes('tenho interesse')) {
    categoria = 'Fechou';
    categoriaCor = 'green';
    status = 'Fechado';
    statusCor = 'green';
  } else if (msg.includes('não quero') || msg.includes('sem interesse') || msg.includes('talvez depois')) {
    categoria = 'Sem Interesse';
    categoriaCor = 'red';
    status = 'Finalizado';
    statusCor = 'gray';
  } else if (msg.includes('depois') || msg.includes('sem tempo') || msg.includes('chama depois')) {
    categoria = 'Follow-up';
    categoriaCor = 'yellow';
    status = 'Aguardando retorno';
    statusCor = 'orange';
  } else {
    categoria = 'Em conversa';
    categoriaCor = 'blue';
    status = 'Ativo';
    statusCor = 'blue';
  }

  try {
    await notion.pages.update({
      page_id: contatoId,
      properties: {
        Categoria: { select: { name: categoria, color: categoriaCor } },
        Status: { select: { name: status, color: statusCor } },
      },
    });

    console.log(`✅ Contato atualizado: ${categoria} / ${status}`);
  } catch (error) {
    console.error('❌ Erro ao atualizar contato:', error.message);
  }
}


async function atualizarCategoriaContato(contatoId, ultimaMensagem) {
  let categoria = 'Follow-up';
  let cor = 'gray';

  // Lógica simples de classificação automática
  const msg = ultimaMensagem.toLowerCase();

  if (msg.includes('interessado') || msg.includes('vamos fechar') || msg.includes('ok')) {
    categoria = 'Fechou';
    cor = 'green';
  } else if (msg.includes('não quero') || msg.includes('sem interesse')) {
    categoria = 'Sem Interesse';
    cor = 'red';
  } else if (msg.includes('chama depois') || msg.includes('falamos mais tarde')) {
    categoria = 'Follow-up';
    cor = 'yellow';
  }

  try {
    await notion.pages.update({
      page_id: contatoId,
      properties: {
        Categoria: {
          select: { name: categoria, color: cor },
        },
      },
    });

    console.log(`✅ Categoria atualizada para ${categoria} (${cor})`);
  } catch (error) {
    console.error('❌ Erro ao atualizar categoria do contato:', error.message);
  }
}


// Gerar relatório por contato
async function getMessagesByContact(from) {
  const contatoSearch = await notion.databases.query({
    database_id: process.env.NOTION_CONTATOS_DB_ID,
    filter: { property: 'Número', rich_text: { equals: from } },
  });
  if (contatoSearch.results.length === 0) return [];

  const contatoId = contatoSearch.results[0].id;
  const messages = await notion.databases.query({
    database_id: process.env.NOTION_MENSAGENS_DB_ID,
    filter: { property: 'Contato', relation: { contains: contatoId } },
    sorts: [{ property: 'Data/Hora', direction: 'ascending' }],
  });

  return messages.results.map(msg => ({
    mensagem: msg.properties.Mensagem.title[0]?.text.content || '',
    dataHora: msg.properties['Data/Hora'].date.start,
  }));
}

// Processa mensagem para resposta
function processMessage(message, portfolioData) {
  const msg = message.toLowerCase();
  if (msg.includes('projetos')) return formatProjects(portfolioData);
  if (msg.includes('sobre') || msg.includes('apresentação'))
    return 'Olá! Sou um bot conectado ao meu portfólio do Notion. Você pode perguntar sobre meus projetos!';
  return 'Desculpe, não entendi. Pergunte sobre:\n- Projetos\n- Sobre/Apresentação';
}

// Formata projetos
function formatProjects(portfolioData) {
  let response = '📚 Meus projetos:\n\n';
  portfolioData.forEach(page => {
    const name = page.properties?.Name?.title?.[0]?.plain_text || 'Sem título';
    response += `- ${name}\n`;
  });
  return response || 'Nenhum projeto encontrado.';
}

// Inicializa servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log('--- CONFIGURAÇÕES ---');
  console.log('VERIFY_TOKEN:', VERIFY_TOKEN);
  console.log('WHATSAPP_TOKEN:', WHATSAPP_TOKEN ? '✅' : '❌');
  console.log('NOTION_API_KEY:', process.env.NOTION_API_KEY ? '✅' : '❌');
  console.log('NOTION_CONTATOS_DB_ID:', process.env.NOTION_CONTATOS_DB_ID ? '✅' : '❌');
  console.log('NOTION_MENSAGENS_DB_ID:', process.env.NOTION_MENSAGENS_DB_ID ? '✅' : '❌');
});
