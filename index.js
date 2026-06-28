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
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// ==========================================
// 1. CONFIGURAÇÕES E CONSTANTES
// ==========================================
const COLORS = {
  PRIMARY: '#00CED1', SUCCESS: '#00FF00', ERROR: '#FF0000',
  WARNING: '#FFAA00', INFO: '#0099FF', BLACKLIST: '#000000'
};

const EMOJIS = {
  SUCCESS: '✅', ERROR: '❌', WARNING: '⚠️', LOADING: '⏳', MONEY: '💰',
  TICKET: '🎫', LOG: '📝', PIX: '💳', BLACKLIST: '🚫', USER: '👤', GAME: '🎮'
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Banco de dados integrado local na raiz
const database = require(path.join(__dirname, 'database.js'));

// Memória temporária para filas ativas de apostados
const filasAtivas = new Map();

// ==========================================
// 2. INICIALIZAÇÃO E CHECAGEM AUTOMÁTICA
// ==========================================
client.once('ready', () => {
  console.log(`🟢 ${client.user.tag} tá online com o sistema COMPLETO integrado!`);
  client.user.setActivity('Filas de Free Fire', { type: ActivityType.Competing });

  // Loop de Verificação Automática (Roda a cada 10 minutos)
  setInterval(async () => {
    console.log('⏳ [INFINITY] Rodando checagem automática de mediadores...');
    try {
      const mediadores = await database.readData('mediadores');
      const agora = Date.now();
      const ativos = [];

      for (const m of mediadores) {
        if (agora > m.expiresAt) {
          console.log(`🚫 Cargo de mediador do usuário ${m.userId} expirou.`);
          const guild = client.guilds.cache.get(process.env.GUILD_ID);
          if (guild) {
            const member = await guild.members.fetch(m.userId).catch(() => null);
            const config = await database.readData('config');
            if (member && config.roles?.mediador) {
              await member.roles.remove(config.roles.mediador).catch(() => null);
              await member.send(`⚠️ Seu acesso de Mediador no **Infinity Bot** expirou (limite de 7 dias)!`).catch(() => null);
            }
          }
        } else {
          ativos.push(m);
        }
      }
      await database.writeData('mediadores', ativos);
    } catch (err) {
      console.error('Erro no verificador de mediadores:', err);
    }
  }, 10 * 60 * 1000);
});

// ==========================================
// 3. COMANDO CENTRAL /PAINEL (DONO)
// ==========================================
client.on('interactionCreate', async (interaction) => {
  const isOwner = interaction.user.id === process.env.OWNER_ID;

  if (interaction.isChatInputCommand() && interaction.commandName === 'painel') {
    if (!isOwner) return interaction.reply({ content: `${EMOJIS.ERROR} Apenas o Dono do Bot tem acesso!`, flags: 64 });

    const embed = new EmbedBuilder()
      .setTitle('🔥 INFINITY BOT - PAINEL DE CONTROLE MASTER')
      .setDescription('Gerencie todo o ecossistema do bot de apostados, filas, finanças e suporte pelos botões abaixo.')
      .setColor(COLORS.PRIMARY)
      .setThumbnail(client.user.displayAvatarURL());

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('owner_config_taxas').setLabel('🪙 Configurar Taxas').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('owner_ver_config').setLabel('🔍 Ver Configurações').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('owner_criar_painel_fila').setLabel('🎮 Painel de Filas').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('owner_add_mediador').setLabel('👤 + Mediador').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('owner_ver_mediadores').setLabel('📋 Listar Mediadores').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('owner_add_blacklist').setLabel('🚫 + Blacklist').setStyle(ButtonStyle.Danger)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('owner_criar_ticket').setLabel('🎫 Criar Central de Tickets').setStyle(ButtonStyle.Primary)
    );

    return interaction.reply({ embeds: [embed], components: [row1, row2, row3], flags: 64 });
  }

  // ==========================================
  // 4. TRATAMENTO COMPLETO DE BOTÕES
  // ==========================================
  if (interaction.isButton()) {
    const id = interaction.customId;

    // Proteção de comandos do Dono
    if (id.startsWith('owner_') && !isOwner) {
      return interaction.reply({ content: `${EMOJIS.ERROR} Acesso negado!`, flags: 64 });
    }

    // --- BOTÕES DO PAINEL DO DONO ---
    if (id === 'owner_config_taxas') {
      const modal = new ModalBuilder().setCustomId('modal_owner_taxas').setTitle('Configurar Taxas Globais');
      const medInput = new TextInputBuilder().setCustomId('med_taxa').setLabel('Taxa do Mediador (%)').setStyle(TextInputStyle.Short).setValue('10');
      const anaInput = new TextInputBuilder().setCustomId('ana_taxa').setLabel('Taxa do Analista (%)').setStyle(TextInputStyle.Short).setValue('5');
      modal.addComponents(new ActionRowBuilder().addComponents(medInput), new ActionRowBuilder().addComponents(anaInput));
      return interaction.showModal(modal);
    }

    if (id === 'owner_ver_config') {
      const config = await database.readData('config');
      const embed = new EmbedBuilder()
        .setTitle('⚙️ Configurações Gerais')
        .setColor(COLORS.INFO)
        .addFields(
          { name: '🪙 Taxa Mediador', value: `${config.taxes?.mediador || 0}%`, inline: true },
          { name: '🎯 Taxa Analista', value: `${config.taxes?.analista || 0}%`, inline: true },
          { name: '🎮 Valores Ativos', value: `${config.defaultQueueValues?.join(', ') || '1, 2, 5, 10'}` }
        );
      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    if (id === 'owner_add_mediador') {
      const modal = new ModalBuilder().setCustomId('modal_owner_add_med').setTitle('Registrar Novo Mediador');
      const userInput = new TextInputBuilder().setCustomId('med_user_id').setLabel('ID do Usuário').setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(userInput));
      return interaction.showModal(modal);
    }

    if (id === 'owner_ver_mediadores') {
      const mediadores = await database.readData('mediadores');
      if (mediadores.length === 0) return interaction.reply({ content: '❌ Nenhum mediador ativo no banco.', flags: 64 });
      const lista = mediadores.map(m => `👤 <@${m.userId}> | Expira: <t:${Math.floor(m.expiresAt / 1000)}:R>`).join('\n');
      return interaction.reply({ content: `**EQUIPE DE MEDIADORES:**\n\n${lista}`, flags: 64 });
    }

    if (id === 'owner_add_blacklist') {
      const modal = new ModalBuilder().setCustomId('modal_owner_blacklist').setTitle('Banir do Sistema (Blacklist)');
      const blInput = new TextInputBuilder().setCustomId('bl_id').setLabel('ID do Infrator').setStyle(TextInputStyle.Short).setRequired(true);
      const motivoInput = new TextInputBuilder().setCustomId('bl_motivo').setLabel('Motivo do Banimento').setStyle(TextInputStyle.Paragraph).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(blInput), new ActionRowBuilder().addComponents(motivoInput));
      return interaction.showModal(modal);
    }

    if (id === 'owner_criar_ticket') {
      const embedTicket = new EmbedBuilder()
        .setTitle('🎫 CENTRAL DE SUPORTE & ATENDIMENTO')
        .setDescription('Abra um chamado abaixo para resolver problemas ou tratar de vagas.')
        .setColor(COLORS.PRIMARY);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_suporte').setLabel('Suporte Geral').setEmoji('⚙️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ticket_vagas').setLabel('Vagas na Equipe').setEmoji('👔').setStyle(ButtonStyle.Success)
      );

      await interaction.channel.send({ embeds: [embedTicket], components: [row] });
      return interaction.reply({ content: '✅ Central de Tickets enviada no canal!', flags: 64 });
    }

    if (id === 'owner_criar_painel_fila') {
      const embedFila = new EmbedBuilder()
        .setTitle('🎮 ARENA DE APOSTADOS - FILA EXTRA')
        .setDescription('Clique no botão abaixo para entrar na fila de espera dos apostados de Free Fire.')
        .setColor(COLORS.WARNING);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('fila_entrar').setLabel('Entrar na Fila').setEmoji('⚔️').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('fila_sair').setLabel('Sair da Fila').setEmoji('🚪').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('fila_status').setLabel('Ver Fila').setEmoji('📋').setStyle(ButtonStyle.Secondary)
      );

      await interaction.channel.send({ embeds: [embedFila], components: [row] });
      return interaction.reply({ content: '✅ Painel de filas criado!', flags: 64 });
    }

    // --- SISTEMA DE TICKETS (PÚBLICO) ---
    if (id === 'ticket_suporte' || id === 'ticket_vagas') {
      const bl = await database.readData('blacklist');
      if (bl.some(b => b.userId === interaction.user.id)) {
        return interaction.reply({ content: `${EMOJIS.BLACKLIST} Você está na blacklist e não pode usar o suporte.`, flags: 64 });
      }

      await interaction.reply({ content: '⏳ Construindo sua sala de atendimento...', flags: 64 });
      const tipo = id === 'ticket_suporte' ? 'suporte' : 'vagas';

      const canal = await interaction.guild.channels.create({
        name: `🎫-${tipo}-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
        ]
      });

      const embedSala = new EmbedBuilder()
        .setTitle(`🎫 ATENDIMENTO PERSONALIZADO [${tipo.toUpperCase()}]`)
        .setDescription(`Bem-vindo, ${interaction.user}! Diga sua dúvida ou envie os prints. Um membro da equipe vai te responder em breve.`)
        .setColor(COLORS.SUCCESS);

      const rowFechar = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_fechar_canal').setLabel('Fechar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
      );

      await canal.send({ embeds: [embedSala], components: [rowFechar] });
      return interaction.editReply({ content: `✅ Sala de atendimento criada com sucesso: ${canal}` });
    }

    if (id === 'ticket_fechar_canal') {
      await interaction.reply({ content: '🔒 Este ticket será arquivado e deletado em 5 segundos...' });
      setTimeout(async () => {
        await interaction.channel.delete().catch(() => null);
      }, 5000);
      return;
    }

    // --- SISTEMA DE FILAS (PÚBLICO) ---
    if (id.startsWith('fila_')) {
      const bl = await database.readData('blacklist');
      if (bl.some(b => b.userId === interaction.user.id)) {
        return interaction.reply({ content: `${EMOJIS.BLACKLIST} Você está impedido de entrar em filas (Lista Negra).`, flags: 64 });
      }

      const guildId = interaction.guild.id;
      if (!filasAtivas.has(guildId)) filasAtivas.set(guildId, []);
      const fila = filasAtivas.get(guildId);

      if (id === 'fila_entrar') {
        if (fila.includes(interaction.user.id)) return interaction.reply({ content: '⚠️ Você já está na fila de espera!', flags: 64 });
        fila.push(interaction.user.id);
        return interaction.reply({ content: `✅ Você entrou na fila com sucesso! Posição atual: **${fila.length}º**`, flags: 64 });
      }

      if (id === 'fila_sair') {
        const index = fila.indexOf(interaction.user.id);
        if (index === -1) return interaction.reply({ content: '⚠️ Você não está em nenhuma fila.', flags: 64 });
        fila.splice(index, 1);
        return interaction.reply({ content: '🚪 Você saiu da fila de espera.', flags: 64 });
      }

      if (id === 'fila_status') {
        if (fila.length === 0) return interaction.reply({ content: '🎮 A fila está completamente vazia no momento.', flags: 64 });
        const visual = fila.map((id, idx) => `**${idx + 1}º** - <@${id}>`).join('\n');
        return interaction.reply({ content: `📋 **JOGADORES NA FILA ATUAL:**\n\n${visual}`, flags: 64 });
      }
    }
  }

  // ==========================================
  // 5. PROCESSAMENTO DE FORMULÁRIOS (MODAIS)
  // ==========================================
  if (interaction.isModalSubmit()) {
    const id = interaction.customId;

    if (id === 'modal_owner_taxas') {
      const med = parseInt(interaction.fields.getTextInputValue('med_taxa')) || 0;
      const ana = parseInt(interaction.fields.getTextInputValue('ana_taxa')) || 0;

      const config = await database.readData('config');
      config.taxes = { mediador: med, analista: ana };
      await database.writeData('config', config);

      return interaction.reply({ content: `${EMOJIS.SUCCESS} Configuração salva! Novas Taxas: Mediadores: **${med}%** | Analistas: **${ana}%**`, flags: 64 });
    }

    if (id === 'modal_owner_add_med') {
      const userId = interaction.fields.getTextInputValue('med_user_id');
      const mediadores = await database.readData('mediadores');

      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // Expiração exata de 7 dias
      mediadores.push({ userId, expiresAt });
      await database.writeData('mediadores', mediadores);

      return interaction.reply({ content: `${EMOJIS.SUCCESS} O usuário <@${userId}> foi registrado como Mediador por 7 dias!`, flags: 64 });
    }

    if (id === 'modal_owner_blacklist') {
      const userId = interaction.fields.getTextInputValue('bl_id');
      const motivo = interaction.fields.getTextInputValue('bl_motivo');
      const blacklist = await database.readData('blacklist');

      if (blacklist.some(b => b.userId === userId)) return interaction.reply({ content: '⚠️ Esse usuário já está banido.', flags: 64 });

      blacklist.push({ userId, motivo, data: new Date().toLocaleDateString('pt-BR') });
      await database.writeData('blacklist', blacklist);

      return interaction.reply({ content: `${EMOJIS.SUCCESS} Usuário <@${userId}> inserido com sucesso na Blacklist por: *${motivo}*`, flags: 64 });
    }
  }
});

client.login(process.env.TOKEN);
                       
