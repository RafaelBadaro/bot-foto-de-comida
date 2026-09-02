# Bot de WhatsApp - Validador de Capas

Bot em Node.js que monitora grupos. Ao responderem uma foto com a palavra **"Capa"**, o bot valida a imagem, atualiza o placar do autor e altera a foto de perfil do grupo.

## 📦 1. Instalação e Dependências

Abra o terminal na pasta onde está o seu arquivo `bot.js` e execute os comandos abaixo na ordem indicada:

1. Inicialize o projeto Node.js para criar o arquivo de configuração:
   ```bash
   npm init -y
   ```

2. Instale as dependências obrigatórias do projeto:
   ```bash
   npm install whatsapp-web.js qrcode-terminal
   ```

## 🛠️ 2. Como Executar

1. Com as dependências instaladas, inicie o robô executando o comando:
   ```bash
   node bot.js
   ```

2. Um **QR Code** vai aparecer no seu terminal.
3. Abra o WhatsApp no seu celular, vá em **Aparelhos Conectados** > **Conectar um aparelho** e escaneie o código da tela.

## ⚠️ Observações Importantes

* **Cargo de Admin:** O número conectado ao bot **precisa ser Administrador** do grupo para conseguir mudar a foto de capa do perfil.
* **Persistência:** O histórico de contagem é gerado sozinho no arquivo `contador_capas.json`. Não delete esse arquivo para não zerar os placares.
* **Funcionamento:** O bot roda direto no seu computador. Se você fechar o terminal ou desligar a máquina, ele sairá do ar.
