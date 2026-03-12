const axios = require('axios');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

// Configuración
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TOKEN || !CHAT_ID) {
    console.error('Faltan variables de entorno TELEGRAM_TOKEN o TELEGRAM_CHAT_ID');
    process.exit(1);
}

const bot = new TelegramBot(TOKEN);
const HISTORY_FILE = path.join(__dirname, 'history.json');
const KEYWORD = 'seiko 5';
const SEARCH_URL = `https://api.wallapop.com/api/v3/general/search?keywords=${encodeURIComponent(KEYWORD)}&filters_source=search_box&latitude=40.416775&longitude=-3.703790`;

async function run() {
    try {
        // 1. Leer historial
        let history = [];
        if (fs.existsSync(HISTORY_FILE)) {
            history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
        }

        console.log(`🔍 Buscando: ${KEYWORD}...`);

        // 2. Llamada a Wallapop
        const response = await axios.get(SEARCH_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'es-ES,es;q=0.9'
            },
            timeout: 10000
        });

        const items = response.data.search_objects || [];
        let newItemsFound = 0;

        // 3. Procesar items
        for (const item of items) {
            // Usar content_id que es el identificador correcto
            const itemId = item.content_id || item.id;
            
            if (itemId && !history.includes(itemId.toString())) {
                const precio = item.price?.amount || 'N/D';
                const moneda = item.price?.currency || 'EUR';
                const titulo = item.title || 'Sin título';
                const webSlug = item.web_slug || itemId;

                const message = `⌚ *¡Nuevo Seiko 5!*\n\n` +
                    `💰 *Precio:* ${precio} ${moneda}\n` +
                    `📝 *Título:* ${titulo}\n` +
                    `🔗 *Enlace:* https://es.wallapop.com/item/${webSlug}`;

                await bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
                history.push(itemId.toString());
                newItemsFound++;
                
                // Pequeña pausa para no saturar Telegram
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // 4. Guardar historial
        const updatedHistory = history.slice(-300); // Mantener últimos 300
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(updatedHistory, null, 2));
        
        console.log(`✅ Proceso completado. ${newItemsFound} nuevos items encontrados.`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Detalles:', error.response.status, error.response.data);
        }
        process.exit(1);
    }
}

run();