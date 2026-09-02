// Biblioteca para ler e salvar arquivos (controle de contagem)
const fs = require('fs');
// Biblioteca para interagir com o WhatsApp
const { Client, LocalAuth } = require('whatsapp-web.js');
// Biblioteca para gerar QR Code no terminal
const qrcode = require('qrcode-terminal');

// Caminho do arquivo onde o contador será salvo
const DATA_FILE = './contador_capas.json';

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

// Monitora todas as mensagens que chegam
client.on('message', async (msg) => {
    try {
        // 1. Verifica se a mensagem foi enviada dentro de um GRUPO
        if (!msg.from.endsWith('@g.us')) return;

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
                // Descobre quem foi a pessoa que enviou a FOTO original
                const autorFoto = mensagemMarcada.author || mensagemMarcada.from;

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