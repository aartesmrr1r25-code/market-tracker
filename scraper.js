const axios = require('axios');
const fs = require('fs');

// Configuración desde variables de entorno (GitHub Secrets)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const KEYWORD = 'seiko 5';
const HISTORY_FILE = './history.json';

// 1. Cargar historial de IDs ya enviados
let history = [];
if (fs.existsSync(HISTORY_FILE)) {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
}

async function searchWallapop() {
    try {
        // Nota: Wallapop a veces bloquea peticiones directas. 
        // Usamos una URL de búsqueda simplificada o su API interna si está disponible.
        const url = `https://api.wallapop.com/api/v3/general/search?keywords=${encodeURIComponent(KEYWORD)}&filters_source=search_box&latitude=40.416775&longitude=-3.703790`;
        
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const items = response.data.search_objects || [];
        let newItemsFound = 0;

        for (const item of items) {
            // Si el ID no está en el historial, es una novedad
            if (!history.includes(item.id)) {
                const message = `⌚ ¡Nuevo Seiko 5!\n\n💰 Precio: ${item.price.amount} ${item.price.currency}\n📝 ${item.title}\n\n🔗 Enlace: https://es.wallapop.com/item/${item.web_slug}`;
                
                await sendTelegram(message);
                history.push(item.id);
                newItemsFound++;
            }
        }

        // 2. Guardar el historial actualizado (solo si hay novedades)
        if (newItemsFound > 0) {
            // Mantener el historial manejable (últimos 200 items)
            if (history.length > 200) history = history.slice(-200);
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(history));
            console.log(`Se han encontrado ${newItemsFound} anuncios nuevos.`);
        } else {
            console.log("No hay novedades por ahora.");
        }

    } catch (error) {
        console.error("Error en la búsqueda:", error.message);
    }
}

async function sendTelegram(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    try {
        await axios.post(url, {
            chat_id: CHAT_ID,
            text: text
        });
    } catch (e) {
        console.error("Error enviando a Telegram");
    }
}

searchWallapop();