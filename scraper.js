const axios = require('axios');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const https = require('https');

// Configuración
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TOKEN || !CHAT_ID) {
    console.error('❌ Faltan variables de entorno TELEGRAM_TOKEN o TELEGRAM_CHAT_ID');
    process.exit(1);
}

const bot = new TelegramBot(TOKEN);
const HISTORY_FILE = path.join(__dirname, 'history.json');
const KEYWORD = 'seiko 5';
const SEARCH_URL = `https://api.wallapop.com/api/v3/general/search?keywords=${encodeURIComponent(KEYWORD)}&filters_source=search_box&latitude=40.416775&longitude=-3.703790&step=0`;

// Headers más realistas
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://es.wallapop.com/',
    'Origin': 'https://es.wallapop.com',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache'
};

// Configuración para evitar detección
const axiosConfig = {
    headers: headers,
    timeout: 15000,
    httpsAgent: new https.Agent({  
        rejectUnauthorized: false,
        keepAlive: true
    }),
    validateStatus: function (status) {
        return status < 500; // Aceptar códigos 400 para poder manejarlos
    }
};

async function run() {
    try {
        // 1. Leer historial
        let history = [];
        if (fs.existsSync(HISTORY_FILE)) {
            history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
            console.log(`📂 Historial cargado: ${history.length} items`);
        }

        console.log(`🔍 Buscando: ${KEYWORD}...`);

        // 2. Pequeña pausa aleatoria para parecer humano
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));

        // 3. Llamada a Wallapop
        const response = await axios.get(SEARCH_URL, axiosConfig);

        if (response.status !== 200) {
            console.error(`❌ Respuesta no exitosa: ${response.status}`);
            console.error('Headers de respuesta:', JSON.stringify(response.headers, null, 2));
            
            // Si es 403, intentamos con otra estrategia
            if (response.status === 403) {
                console.log('🔄 Intentando con User-Agent diferente...');
                axiosConfig.headers['User-Agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
                const retryResponse = await axios.get(SEARCH_URL, axiosConfig);
                
                if (retryResponse.status !== 200) {
                    throw new Error(`Error ${retryResponse.status}: ${retryResponse.statusText}`);
                }
                
                response.data = retryResponse.data;
            } else {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
        }

        // Verificar estructura de datos
        const items = response.data.search_objects || [];
        console.log(`📊 Total items encontrados: ${items.length}`);
        
        let newItemsFound = 0;

        // 4. Procesar items
        for (const item of items) {
            const itemId = item.content_id || item.id;
            
            if (!itemId) continue;
            
            if (!history.includes(itemId.toString())) {
                const precio = item.price?.amount || 'N/D';
                const moneda = item.price?.currency || 'EUR';
                const titulo = item.title || 'Sin título';
                const webSlug = item.web_slug || itemId;

                const message = `⌚ *¡Nuevo Seiko 5!*\n\n` +
                    `💰 *Precio:* ${precio} ${moneda}\n` +
                    `📝 *Título:* ${titulo}\n` +
                    `🔗 *Enlace:* https://es.wallapop.com/item/${webSlug}`;

                try {
                    await bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
                    console.log(`✅ Notificación enviada: ${titulo}`);
                    history.push(itemId.toString());
                    newItemsFound++;
                    
                    // Pausa entre mensajes
                    await new Promise(resolve => setTimeout(resolve, 1500));
                } catch (telegramError) {
                    console.error('❌ Error enviando mensaje a Telegram:', telegramError.message);
                }
            }
        }

        // 5. Guardar historial
        const updatedHistory = history.slice(-300);
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(updatedHistory, null, 2));
        
        console.log(`✅ Proceso completado. ${newItemsFound} nuevos items encontrados.`);
        
        // Mensaje de resumen si no hay items nuevos
        if (newItemsFound === 0) {
            console.log('📭 No hay items nuevos.');
        }
        
    } catch (error) {
        console.error('❌ Error en el scraper:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
            console.error('Data:', error.response.data?.substring?.(0, 500) || error.response.data);
        }
        
        // Notificar error por Telegram
        try {
            await bot.sendMessage(CHAT_ID, `❌ *Error en el scraper:*\n\`\`\`${error.message.substring(0, 200)}\`\`\``, { parse_mode: 'Markdown' });
        } catch (e) {
            // Ignorar error de notificación
        }
        
        process.exit(1);
    }
}

run();