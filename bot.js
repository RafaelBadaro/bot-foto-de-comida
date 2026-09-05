// Biblioteca para ler e salvar arquivos (controle de contagem)
const fs = require('fs');
// Biblioteca para interagir com o WhatsApp
const { Client, LocalAuth } = require('whatsapp-web.js');
// Biblioteca para gerar QR Code no terminal
const qrcode = require('qrcode-terminal');

// Caminho do arquivo onde o contador será salvo
const DATA_FILE = './contador_capas.json';

// FIX: ID do grupo autorizado a usar o bot. Deixe vazio ('') na primeira vez rodando
// pra descobrir o ID no terminal (veja o log '[INFO] Mensagem recebida do grupo:').
// Depois de pegar o ID, cole ele aqui entre aspas, ex: '120363012345678901@g.us'
const GRUPO_AUTORIZADO_ID = '120363418902089957@g.us';

// Função para carregar os dados salvos
function carregarDados() {
    if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
    return {};
}

// Função para salvar os dados atualizados
function salvarDados(dados) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
}

// Inicializa os dados na memória
let bancoDados = carregarDados();

// Configura o cliente do WhatsApp com sessão persistente
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
    // DESATIVADO TEMPORARIAMENTE: comentado pra primeiro testar a captura do ID do grupo
    // sem depender de ter uma URL válida aqui ainda. Descomenta (e preenche o remotePath)
    // quando for de fato corrigir o erro do getQuotedMessage.
    // ,webVersionCache: {
    //     type: 'remote',
    //     remotePath: 'COLE_AQUI_A_URL_RAW_DO_ARQUIVO_HTML_ESCOLHIDO'
    // }
});

// Exibe o QR Code no terminal para você escanear com o celular
client.on('qr', (qr) => {
    console.log('--- ESCANEIE O QR CODE ABAIXO ---');
    qrcode.generate(qr, { small: true });
});

// Avisa quando o bot conectou com sucesso
client.on('ready', () => {
    console.log('Bot de validação de Capas está online e operando nos grupos!');
});

// Monitora TODAS as mensagens, incluindo as enviadas pelo próprio número do bot.
// FIX: 'message' só captura mensagens de terceiros. 'message_create' captura tudo,
// permitindo que o dono do número do bot também mande foto/participe da dinâmica de "capa".
client.on('message_create', async (msg) => {
    try {
        // FIX: como 'message_create' também dispara para as mensagens que O PRÓPRIO BOT envia
        // (ex: a resposta de confirmação "Capa validada..."), sem esse filtro o bot entraria
        // em looping tentando processar sua própria resposta como se fosse um comando.
        // Aqui só bloqueamos mensagens próprias que sejam RESULTADO do bot (mídia ou o emoji de aviso),
        // mas deixamos passar se o dono do bot mandar "capa" manualmente como qualquer outro usuário.
        const ehRespostaDoProprioBot = msg.fromMe && msg.body && msg.body.startsWith('📸');
        if (ehRespostaDoProprioBot) return;

        // 1. Verifica se a mensagem foi enviada dentro de um GRUPO
        if (!msg.from.endsWith('@g.us')) return;

        // FIX: se um grupo autorizado foi definido, ignora qualquer mensagem vinda de outro grupo.
        if (GRUPO_AUTORIZADO_ID && msg.from !== GRUPO_AUTORIZADO_ID) return;

        // 2. Valida se o texto exato digitado na mensagem é "Capa" (ignora maiúsculas/minúsculas e espaços)
        const textoFormatado = msg.body ? msg.body.trim().toLowerCase() : '';
        if (textoFormatado !== 'capa') return;

        // 3. Verifica se esta mensagem está respondendo/marcando outra mensagem (Quoted Message)
        if (msg.hasQuotedMsg) {
            const mensagemMarcada = await msg.getQuotedMessage();

            // 4. Valida se a mensagem marcada original contém uma FOTO (imagem)
            if (mensagemMarcada.hasMedia && mensagemMarcada.type === 'image') {
                
                // Pega o ID único da mensagem com a imagem para evitar contar a mesma foto duas vezes
                const fotoId = mensagemMarcada.id.id;
                // Descobre quem foi a pessoa que enviou a FOTO original.
                // FIX: quando a FOTO foi enviada pelo próprio número do bot, o campo '.author'
                // não vem preenchido e '.from' aponta pro ID do GRUPO (não da pessoa) — sem esse
                // caso especial, o autor ficaria errado (o grupo levaria o crédito da foto).
                const autorFoto = mensagemMarcada.fromMe
                    ? client.info.wid._serialized
                    : (mensagemMarcada.author || mensagemMarcada.from);

                // Se essa foto específica já foi contabilizada, o bot ignora para evitar spam
                if (bancoDados[fotoId]) {
                    await msg.reply('⚠️ Esta foto já foi contabilizada como Capas anteriormente!');
                    return;
                }

                // --- NOVA FUNÇÃO: ALTERAÇÃO DA CAPA DO GRUPO ---
                // Obtém o objeto do chat do grupo atual
                const chatGrupo = await msg.getChat();
                
                if (chatGrupo.isGroup) {
                    // Verifica se o bot é administrador para poder alterar a foto
                    const participanteBot = chatGrupo.participants.find(p => p.id._serialized === client.info.wid._serialized);
                    
                    if (participanteBot && (participanteBot.isAdmin || participanteBot.isSuperAdmin)) {
                        try {
                            // Faz o download do arquivo de mídia da foto marcada
                            const midiaFoto = await mensagemMarcada.downloadMedia();
                            // Aplica o arquivo baixado como nova foto do grupo
                            await chatGrupo.setPicture(midiaFoto);
                            console.log(`[SUCESSO] Capa do grupo ${chatGrupo.name} atualizada.`);
                        } catch (erroMídia) {
                            console.error('Erro ao baixar ou definir a foto do grupo:', erroMídia);
                            await msg.reply('❌ Consegui validar a foto, mas ocorreu um erro técnico ao tentar alterar a capa do grupo.');
                        }
                    } else {
                        // Alerta visual no terminal e aviso opcional no chat
                        console.log(`[AVISO] O bot não pôde alterar a foto do grupo ${chatGrupo.name} porque NÃO É ADMINISTRADOR.`);
                        await msg.reply('⚠️ Foto validada! Porém, preciso que me deem cargo de *Administrador* do grupo para que eu consiga alterar a imagem da capa automaticamente.');
                    }
                }
                // -----------------------------------------------

                // Registra a foto no banco de dados e cria a chave para o autor se não existir
                bancoDados[fotoId] = {
                    autor: autorFoto,
                    data: new Date().toISOString()
                };

                // Inicializa a contagem geral do usuário se for a primeira vez dele
                if (!bancoDados[`count_${autorFoto}`]) {
                    bancoDados[`count_${autorFoto}`] = 0;
                }

                // Incrementa a contagem do usuário que tirou/enviou a foto
                bancoDados[`count_${autorFoto}`] += 1;
                const totalCapas = bancoDados[`count_${autorFoto}`];

                // Salva as alterações no arquivo JSON local
                salvarDados(bancoDados);

                // Envia uma resposta confirmando e mostrando o placar atualizado do usuário
                await msg.reply(`📸 *Capa validada e atualizada com sucesso!*\n👤 Autor da foto: @${autorFoto.split('@')[0]}\n🔢 Total acumulado por este usuário: *${totalCapas}* capas.`, {
                    mentions: [autorFoto]
                });
            }
        }
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
    }
});

// Inicializa o robô
client.initiate = () => client.initialize();
client.initiate();