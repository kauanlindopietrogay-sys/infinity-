require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Collection, 
  ActivityType, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// ==========================================
// 1. CONSTANTES DO INFINITY BOT
// ==========================================
const COLORS = {
  PRIMARY: '#00CED1', SUCCESS: '#00FF00', ERROR: '#FF0000',
  WARNING: '#FFAA00', INFO: '#0099FF', BLACKLIST: '#000000'
};

const EMOJIS = {
  SUCCESS: '✅', ERROR: '❌', WARNING: '⚠️', LOADING: '⏳', MONEY: '💰',
  TICKET: '🎫', LOG: '📝', PIX: '💳', BLACKLIST: '🚫', USER: '👤'
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Banco de dados integrado
const database = require('./database.js');


// ==========================================
// 2. INICIALIZAÇÃO DO BOT
// ==========================================
client.once('ready', () => {
  console.log(`🟢 ${client.user.tag} tá online com tudo incluído!`);
  client.user.setActivity('Filas de Free Fire', { type: ActivityType.Competing });

  // Loop de verificação de mediadores (Checa a cada 10 minutos)
  setInterval(async () => {
    console.log('⏳ [INFINITY] Rodando checagem automática de mediadores vencidos...');
    try {
      const mediadores = await database.readData('mediadores');
      const agora = Date.now();
      const ativos = [];

      for (const m of mediadores) {
        if (agora > m.expiresAt) {
          console.log(`🚫 Mediador ${m.userId} venceu o tempo de 7 dias.`);
          const guild = client.guilds.cache.get(process.env.GUILD_ID);
          if (guild) {
            const member = await guild.members.fetch(m.userId).catch(() => null);
            const config = await database.readData('config');
            if (member && config.roles?.mediador) {
              await member.roles.remove(config.roles.mediador).catch(() => null);
              await member.send(`⚠️ Seu cargo de Mediador no **Infinity Bot** expirou!`).catch(() => null);
            }
          }
        } else {
          ativos.push(m);
        }
      }
      await database.writeData('mediadores', ativos);
    } catch (err) {
      console.error('Erro no loop de mediadores:', err);
    }
  }, 10 * 60 * 1000);
});

// ==========================================
// 3. EVENTO DE INTERAÇÃO (BOTÕES E MODAIS)
// ==========================================
client.on('interactionCreate', async (interaction) => {
  const isOwner = interaction.user.id === process.env.OWNER_ID;

  // --- COMANDO /PAINEL ---
  if (interaction.isChatInputCommand() && interaction.commandName === 'painel') {
    if (!isOwner) {
      return interaction.reply({ content: `${EMOJIS.ERROR} Apenas o Dono do Bot pode usar isso!`, flags: 64 });
    }

    const embed = new EmbedBuilder()
      .setTitle('🔥 INFINITY BOT - PAINEL DO DONO')
      .setDescription('Gerencie as taxas, mediadores, filas e configurações do seu sistema aqui pelos botões abaixo.')
      .setColor(COLORS.PRIMARY)
      .setFooter({ text: 'Sistema Operacional Infinity' });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('owner_config_taxas').setLabel('🪙 Configurar Taxas').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('owner_ver_config').setLabel('🔍 Ver Configurações').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('owner_valores_filas').setLabel('🎮 Valores de Filas').setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('owner_add_mediador').setLabel('👤 Adicionar Mediador').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('owner_ver_mediadores').setLabel('📋 Ver Mediadores').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('owner_rem_mediador').setLabel('❌ Remover Mediador').setStyle(ButtonStyle.Danger)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('owner_criar_ticket').setLabel('🎫 Criar Painel Ticket').setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ embeds: [embed], components: [row1, row2, row3], flags: 64 });
  }

  // --- CLIQUES NOS BOTÕES ---
  if (interaction.isButton()) {
    const id = interaction.customId;

    if (!isOwner && id.startsWith('owner_')) {
      return interaction.reply({ content: `${EMOJIS.ERROR} Sem permissão!`, flags: 64 });
    }

    // Botão: Configurar Taxas
    if (id === 'owner_config_taxas') {
      const modal = new ModalBuilder().setCustomId('modal_owner_taxas').setTitle('Configurar Taxas');
      const medInput = new TextInputBuilder().setCustomId('med_taxa').setLabel('Taxa Mediador (%)').setStyle(TextInputStyle.Short).setValue('10');
      const anaInput = new TextInputBuilder().setCustomId('ana_taxa').setLabel('Taxa Analista (%)').setStyle(TextInputStyle.Short).setValue('5');
      
      modal.addComponents(new ActionRowBuilder().addComponents(medInput), new ActionRowBuilder().addComponents(anaInput));
      return interaction.showModal(modal);
    }

    // Botão: Ver Configurações
    if (id === 'owner_ver_config') {
      const config = await database.readData('config');
      const embed = new EmbedBuilder()
        .setTitle('📋 Configurações Atuais')
        .setColor(COLORS.INFO)
        .addFields(
          { name: '🪙 Taxa Mediador', value: `${config.taxes?.mediador || 0}%`, inline: true },
          { name: '🎯 Taxa Analista', value: `${config.taxes?.analista || 0}%`, inline: true },
          { name: '🎮 Valores de Fila', value: `${config.defaultQueueValues?.join(', ') || 'Padrão'}`, inline: false }
        );
      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    // Botão: Adicionar Mediador
    if (id === 'owner_add_mediador') {
      const modal = new ModalBuilder().setCustomId('modal_owner_add_med').setTitle('Adicionar Mediador');
      const userInput = new TextInputBuilder().setCustomId('med_user_id').setLabel('ID do Usuário').setStyle(TextInputStyle.Short).setRequired(true);
      
      modal.addComponents(new ActionRowBuilder().addComponents(userInput));
      return interaction.showModal(modal);
    }

    // Botão: Ver Mediadores
    if (id === 'owner_ver_mediadores') {
      const mediadores = await database.readData('mediadores');
      if (mediadores.length === 0) return interaction.reply({ content: '❌ Nenhum mediador ativo registrado no sistema.', flags: 64 });
      
      const lista = mediadores.map(m => `👤 <@${m.userId}> - Expira em: <t:${Math.floor(m.expiresAt / 1000)}:R>`).join('\n');
      return interaction.reply({ content: `**Mediadores Ativos:**\n${lista}`, flags: 64 });
    }

    // Botão: Criar Painel de Ticket
    if (id === 'owner_criar_ticket') {
      const embedTicket = new EmbedBuilder()
        .setTitle('🎫 CENTRAL DE ATENDIMENTO - TICKETS')
        .setDescription('Precisa de ajuda ou deseja entrar para a equipe? Escolha uma categoria abaixo.')
        .setColor(COLORS.PRIMARY);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_suporte').setLabel('Suporte').setEmoji('⚙️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ticket_vagas').setLabel('Vagas Equipe').setEmoji('👔').setStyle(ButtonStyle.Success)
      );

      await interaction.channel.send({ embeds: [embedTicket], components: [row] });
      return interaction.reply({ content: '✅ Painel de tickets gerado no canal!', flags: 64 });
    }

    // Botões de abertura de Ticket (Acessível a qualquer membro)
    if (id === 'ticket_suporte' || id === 'ticket_vagas') {
      return interaction.reply({ content: `⏳ Criando seu canal de ticket de ${id === 'ticket_suporte' ? 'Suporte' : 'Vagas'}... Nosso sistema está preparando a sala.`, flags: 64 });
    }
  }

  // --- ENVIO DOS FORMULÁRIOS (MODAIS) ---
  if (interaction.isModalSubmit()) {
    const id = interaction.customId;

    // Recebendo as taxas do formulário
    if (id === 'modal_owner_taxas') {
      const med = parseInt(interaction.fields.getTextInputValue('med_taxa'));
      const ana = parseInt(interaction.fields.getTextInputValue('ana_taxa'));

      const config = await database.readData('config');
      config.taxes = { mediador: med, analista: ana };
      await database.writeData('config', config);

      return interaction.reply({ content: `${EMOJIS.SUCCESS} Taxas atualizadas! Mediador: **${med}%** | Analista: **${ana}%**`, flags: 64 });
    }

    // Recebendo o ID para adicionar mediador
    if (id === 'modal_owner_add_med') {
      const userId = interaction.fields.getTextInputValue('med_user_id');
      const mediadores = await database.readData('mediadores');
      
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 dias em ms
      mediadores.push({ userId, expiresAt });
      await database.writeData('mediadores', mediadores);

      return interaction.reply({ content: `${EMOJIS.SUCCESS} Usuário <@${userId}> adicionado como Mediador por 7 dias!`, flags: 64 });
    }
  }
});

client.login(process.env.TOKEN);

