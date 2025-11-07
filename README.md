# 🤖 WhatsApp → Notion Integration | OpusOne

Integração desenvolvida por **OpusOne** que conecta o **WhatsApp Cloud API** ao **Notion**, automatizando o registro de contatos e mensagens recebidas em tempo real.  
Ideal para quem deseja construir um **CRM inteligente e escalável**, com base em automação de comunicação e IA.

---

## 🚀 Funcionalidades

- 📥 **Webhook inteligente** para receber mensagens do WhatsApp Business API.  
- 🧾 **Registro automático** de contatos e histórico de mensagens no Notion.  
- 🔍 **Identificação de perfil** via nome e número de telefone.  
- 🔄 **Controle de duplicatas** (evita mensagens repetidas).  
- ⏰ Registro de data/hora local (UTC-3).  
- 🧠 Estrutura pronta para expansão com **IA de atendimento automático** e CRM completo.  

---

## ⚙️ Tecnologias utilizadas

- **Node.js + Express** — servidor de integração.  
- **Notion API (@notionhq/client)** — para criar e atualizar páginas automaticamente.  
- **Axios** — integração HTTP com a API do WhatsApp.  
- **WhatsApp Cloud API (Meta Developers)** — envio e recebimento de mensagens.  
- **dotenv** — gerenciamento seguro de variáveis de ambiente.  

---

## 🧩 Estrutura dos Bancos de Dados no Notion

### 📇 Contatos
| Propriedade | Tipo | Descrição |
|--------------|------|-----------|
| Nome | Título | Nome do perfil do WhatsApp |
| Número | Texto | Número completo (com DDI e DDD) |
| Status | Select | Ex: “Fechou”, “Follow-up”, “Sem interesse” |
| Categoria | Select | Classificação automática futura |
| Última Mensagem (Data) | Rollup | Data da última interação |
| Dias sem resposta | Fórmula | Calcula tempo desde a última mensagem |

### 💬 Mensagens
| Propriedade | Tipo | Descrição |
|--------------|------|-----------|
| Mensagem | Título | Conteúdo da mensagem recebida |
| Data/Hora | Data | Horário da mensagem |
| Contato | Relação | Conexão com a tabela Contatos |

---

## 🧠 Possibilidades Futuras

- ✨ **Classificação automática de leads** (via IA e análise de texto).  
- 🤝 **CRM completo** com painel visual e estatísticas.  
- 💬 **Respostas automáticas inteligentes** integradas ao ChatGPT.  
- 🔔 **Sistema de follow-up automático** com base em datas de inatividade.  

---

## 🧰 Como executar o projeto

1. Clone o repositório:
   ```bash
   git clone https://github.com/dean-m-v/whatsapp-notion-integration.git
