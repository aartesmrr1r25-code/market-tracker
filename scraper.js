const axios = require('axios');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// Configuración desde variables de entorno (GitHub Secrets)
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const bot = new TelegramBot(TOKEN);

const HISTORY_FILE = './history.json';
const KEYWORD = 'seiko 5';
const SEARCH_URL = `https://api.wallapop.com/api/v3/general/search?keywords=${encodeURIComponent(KEYWORD)}&filters_source=search_box&longitude=-3.69196&latitude=40.41956`;

async function run() {
    try {
        // 1. Leer historial local
        let history = [];
        if (fs.existsSync(HISTORY_FILE)) {
            history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
        }

        console.log(`Buscando: ${KEYWORD}...`);

        // 2. Llamada a Wallapop con Headers para evitar bloqueos
        const response = await axios.get(SEARCH_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        const items = response.data.search_objects || [];
        let newItemsFound = 0;

        // 3. Filtrar y Notificar
        for (const item of items) {
            // Usamos el ID de Wallapop para saber si es nuevo
            if (!history.includes(item.id)) {
                const message = `⌚ ¡Nuevo Seiko 5!\n\n💰 Precio: ${item.price.amount} ${item.price.currency}\n📝 ${item.title}\n\n🔗 Ver producto: https://es.wallapop.com/item/${item.web_slug}`;
                
                await bot.sendMessage(CHAT_ID, message);
                history.push(item.id);
                newItemsFound++;
            }
        }

        // 4. Actualizar historial (mantener solo los últimos 200 para no inflar el JSON)
        const updatedHistory = history.slice(-200);
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(updatedHistory, null, 2));

        console.log(`Proceso terminado. Se encontraron ${newItemsFound} novedades.`);

    } catch (error) {
        console.error('Error en el scraper:', error.message);
        process.exit(1); // Importante para que GitHub Actions marque error si falla
    }
}

run();