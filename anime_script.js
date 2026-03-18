const BOT_TOKEN = '7187331068:AAElAHfEZ-BmC4HdzNaUjBy6gqmE1OpfqYc';
const JIKAN_API_BASE = 'https://api.jikan.moe/v4';
const TMDB_KEY = '9ef118499c4e6a024523225878b5dbb1';

// State
let currentMode = 'anime'; // 'anime' or 'cartoon'
let selectedResult = null;
let siteSettings = null;

// Load Settings
async function loadSettings() {
    try {
        const res = await fetch('data/settings.json?t=' + new Date().getTime());
        siteSettings = await res.json();
        
        const targetChannelSelect = document.getElementById('targetChannel');
        targetChannelSelect.innerHTML = '';
        if (siteSettings.channels && siteSettings.channels.length > 0) {
            siteSettings.channels.forEach(ch => {
                const opt = document.createElement('option');
                opt.value = ch.id;
                opt.textContent = ch.name;
                targetChannelSelect.appendChild(opt);
            });
        } else {
            targetChannelSelect.innerHTML = '<option value="">Nenhum canal configurado</option>';
        }
    } catch (e) {
        console.error('Error loading settings:', e);
    }
}
loadSettings();

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsGrid = document.getElementById('resultsGrid');
const toggleBtns = document.querySelectorAll('.toggle-btn');
const botForm = document.getElementById('botForm');
const messagePreview = document.getElementById('messagePreview');
const previewPoster = document.getElementById('previewPoster');

// Form Inputs
const inputs = {
    title: document.getElementById('entryTitle'),
    year: document.getElementById('entryYear'),
    rating: document.getElementById('entryRating'),
    episodes: document.getElementById('entryEpisodes'),
    audio: document.getElementById('entryAudio'),
    genres: document.getElementById('entryGenres'),
    studio: document.getElementById('entryStudio'),
    synopsis: document.getElementById('entrySynopsis'),
    watchLink: document.getElementById('entryWatchLink')
};

// Event Listeners - Toggle between Anime and Cartoon
toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        toggleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.type;

        // Toggle theme colors
        if (currentMode === 'cartoon') {
            document.body.classList.add('cartoon-mode');
        } else {
            document.body.classList.remove('cartoon-mode');
        }

        // Load season if anime mode, otherwise clear results
        if (currentMode === 'anime') {
            loadSeasonNow();
        } else {
            resultsGrid.innerHTML = '<div class="placeholder-msg">Faça uma busca para ver os resultados.</div>';
        }
    });
});

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});

Object.values(inputs).forEach(input => {
    input.addEventListener('input', updatePreview);
});

botForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await sendToTelegram();
});

// Initial Load - Season Now for Anime
document.addEventListener('DOMContentLoaded', loadSeasonNow);

// Logic - Load Current Season Anime
async function loadSeasonNow() {
    resultsGrid.innerHTML = '<div class="placeholder-msg">Carregando temporada atual...</div>';
    try {
        const response = await fetch(`${JIKAN_API_BASE}/seasons/now`);
        const data = await response.json();
        renderResults(data.data, 'anime');
    } catch (error) {
        console.error(error);
        resultsGrid.innerHTML = '<div class="placeholder-msg">Erro ao carregar temporada.</div>';
    }
}

// Search Handler
async function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    resultsGrid.innerHTML = '<div class="placeholder-msg">Buscando...</div>';

    try {
        let results = [];
        if (currentMode === 'anime') {
            results = await searchAnime(query);
            renderResults(results, 'anime');
        } else {
            results = await searchCartoon(query);
            renderResults(results, 'cartoon');
        }
    } catch (error) {
        console.error(error);
        resultsGrid.innerHTML = '<div class="placeholder-msg">Erro ao buscar. Tente novamente.</div>';
    }
}

// API: Jikan (Anime)
async function searchAnime(query) {
    const response = await fetch(`${JIKAN_API_BASE}/anime?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data.data;
}

// API: TVMaze (Cartoon/Series)
async function searchCartoon(query) {
    const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data.map(item => {
        const show = item.show;
        return {
            id: show.id,
            title: show.name,
            year: show.premiered ? show.premiered.split('-')[0] : 'N/A',
            rating: show.rating.average || 'N/A',
            poster: show.image ? show.image.original : 'placeholder_poster.png',
            genres: show.genres || [],
            synopsis: show.summary ? show.summary.replace(/<[^>]*>/g, '') : 'Sem sinopse.',
            episodes: 'N/A' // TVMaze doesn't provide total episodes easily
        };
    });
}

// Render Results Grid
function renderResults(items, type) {
    resultsGrid.innerHTML = '';
    if (!items || items.length === 0) {
        resultsGrid.innerHTML = '<div class="placeholder-msg">Nenhum resultado encontrado.</div>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'anime-card';

        let poster, title, year;
        if (type === 'anime') {
            poster = item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || 'placeholder_poster.png';
            title = item.title;
            year = item.year || 'N/A';
        } else {
            poster = item.poster;
            title = item.title;
            year = item.year;
        }

        card.innerHTML = `
            <img src="${poster}" alt="${title}">
            <div class="info">
                <h3>${title}</h3>
                <span>${year}</span>
            </div>
        `;
        card.addEventListener('click', () => populateEditor(item, type));
        resultsGrid.appendChild(card);
    });
}

// Genre Translations
const genreTranslations = {
    'Action': 'Ação', 'Adventure': 'Aventura', 'Comedy': 'Comédia',
    'Drama': 'Drama', 'Sci-Fi': 'Ficção Científica', 'Slice of Life': 'Cotidiano',
    'Fantasy': 'Fantasia', 'Magic': 'Magia', 'Supernatural': 'Sobrenatural',
    'Horror': 'Terror', 'Mystery': 'Mistério', 'Psychological': 'Psicológico',
    'Romance': 'Romance', 'Thriller': 'Suspense', 'Sports': 'Esportes',
    'Music': 'Música', 'Mecha': 'Mecha', 'School': 'Escolar',
    'Military': 'Militar', 'Space': 'Espaço', 'Vampire': 'Vampiro',
    'Historical': 'Histórico', 'Harem': 'Harém', 'Isekai': 'Isekai',
    'Shounen': 'Shounen', 'Shoujo': 'Shoujo', 'Seinen': 'Seinen',
    'Josei': 'Josei', 'Kids': 'Infantil', 'Family': 'Família',
    'Crime': 'Crime', 'Legal': 'Legal', 'Medical': 'Médico',
    'Ecchi': 'Ecchi', 'Demons': 'Demônios', 'Game': 'Jogo',
    'Martial Arts': 'Artes Marciais', 'Samurai': 'Samurai', 'Super Power': 'Super Poder'
};

function translateGenres(genresArray) {
    if (!genresArray || genresArray.length === 0) return '';
    return genresArray.map(genre => {
        const genreName = typeof genre === 'string' ? genre : genre.name;
        const translated = genreTranslations[genreName] || genreName;
        return `#${translated.replace(/\s+/g, '')}`;
    }).join(' ');
}

// Populate Editor
async function populateEditor(item, type) {
    selectedResult = item;

    if (type === 'anime') {
        // Start with English title, will try to get Portuguese
        const originalTitle = item.title_english || item.title;
        inputs.title.value = originalTitle;

        inputs.year.value = item.year || (item.aired?.from ? item.aired.from.split('-')[0] : 'N/A');
        inputs.rating.value = item.score ? item.score.toFixed(1) : 'N/A';
        inputs.episodes.value = item.episodes || 'N/A';

        // Genres with translation
        const genresList = [...(item.genres || []), ...(item.themes || [])];
        inputs.genres.value = translateGenres(genresList);

        // Studio
        inputs.studio.value = item.studios && item.studios.length > 0 ? item.studios[0].name : 'N/A';

        // Synopsis - Start with English, then try to translate
        const originalSynopsis = item.synopsis ? item.synopsis.replace('[Written by MAL Rewrite]', '').trim() : '';
        inputs.synopsis.value = 'Traduzindo sinopse... Aguarde...';
        inputs.synopsis.disabled = true;

        inputs.audio.value = 'Português'; // Default

        const poster = item.images?.jpg?.large_image_url || item.images?.jpg?.image_url;
        previewPoster.src = poster;

        updatePreview();

        // Try TMDB first for PT-BR title and synopsis
        console.log(`Searching TMDB for: ${item.title} (Type: ${item.type})`);
        const ptData = await fetchPortugueseData(item.title, item.type);
        console.log('TMDB Result:', ptData);

        // Update title if Portuguese version found
        if (ptData.title) {
            inputs.title.value = ptData.title;
            updatePreview();
        }

        // Update synopsis
        if (ptData.synopsis) {
            inputs.synopsis.value = ptData.synopsis;
            inputs.synopsis.disabled = false;
            updatePreview();
        } else {
            // Fallback to translation API
            console.log('TMDB failed/incomplete. Trying Translation API...');
            try {
                const translatedSynopsis = await translateText(originalSynopsis);
                console.log('Translation API Result:', translatedSynopsis);
                inputs.synopsis.value = translatedSynopsis;
            } catch (e) {
                console.error('Translation failed', e);
                inputs.synopsis.value = originalSynopsis; // Fallback to English
            } finally {
                inputs.synopsis.disabled = false;
                updatePreview();
            }
        }
    } else {
        // Cartoon mode
        inputs.title.value = item.title;
        inputs.year.value = item.year;
        inputs.rating.value = item.rating !== 'N/A' ? `${item.rating}/10` : 'N/A';
        inputs.episodes.value = item.episodes || 'N/A';

        // Genres with translation
        inputs.genres.value = translateGenres(item.genres);

        inputs.studio.value = 'N/A';

        // Synopsis translation
        inputs.synopsis.value = 'Traduzindo sinopse... Aguarde...';
        inputs.synopsis.disabled = true;

        inputs.audio.value = 'Português'; // Default for cartoons

        previewPoster.src = item.poster;

        updatePreview();

        // Translate synopsis
        try {
            const translatedSynopsis = await translateText(item.synopsis);
            inputs.synopsis.value = translatedSynopsis;
        } catch (e) {
            console.error('Translation failed', e);
            inputs.synopsis.value = item.synopsis; // Fallback to original
        } finally {
            inputs.synopsis.disabled = false;
            updatePreview();
        }
    }

    if (window.innerWidth <= 900) {
        document.getElementById('editorSection').scrollIntoView({ behavior: 'smooth' });
    }
}

// TMDB Integration for PT-BR Title and Synopsis
async function fetchPortugueseData(animeTitle, jikanType) {
    try {
        const tmdbType = (jikanType === 'Movie') ? 'movie' : 'tv';

        console.log(`[TMDB] Step 1: Searching ID for "${animeTitle}" (${tmdbType})...`);
        // Step 1: Search in English to find the correct ID (matches Jikan title better)
        const searchUrl = `https://api.themoviedb.org/3/search/${tmdbType}?api_key=${TMDB_KEY}&query=${encodeURIComponent(animeTitle)}`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (searchData.results && searchData.results.length > 0) {
            const id = searchData.results[0].id;
            console.log(`[TMDB] Found ID: ${id}. Step 2: Fetching PT-BR details...`);

            // Step 2: Fetch details in Portuguese using the found ID
            const detailsUrl = `https://api.themoviedb.org/3/${tmdbType}/${id}?api_key=${TMDB_KEY}&language=pt-BR`;
            const detailsRes = await fetch(detailsUrl);
            const detailsData = await detailsRes.json();

            // Movies use 'title', TV uses 'name'
            const ptTitle = tmdbType === 'movie' ? detailsData.title : detailsData.name;
            return {
                title: ptTitle || null,
                synopsis: detailsData.overview || null
            };
        } else {
            console.log('[TMDB] No results found in Step 1.');
        }
    } catch (e) {
        console.error("Erro ao buscar dados no TMDB:", e);
    }
    return { title: null, synopsis: null };
}

// Translation API (MyMemory)
async function translateText(text) {
    if (!text || text === 'Sem sinopse.') return text;

    // MyMemory limit is 500 chars. Split into chunks.
    const chunks = splitTextIntoChunks(text, 450);
    let translatedParts = [];

    for (const chunk of chunks) {
        try {
            const part = await fetchTranslation(chunk);
            translatedParts.push(part);
        } catch (e) {
            console.error('Chunk translation failed', e);
            translatedParts.push(chunk); // Fallback to original for this chunk
        }
    }

    return translatedParts.join(' ');
}

async function fetchTranslation(text) {
    const encoded = encodeURIComponent(text);
    const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|pt-br`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.responseStatus === 200 && data.responseData.translatedText) {
        return data.responseData.translatedText;
    }
    if (data.responseStatus !== 200) {
        throw new Error(data.responseDetails || 'Translation API Error');
    }
    return text;
}

function splitTextIntoChunks(text, maxLength) {
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = '';

    words.forEach(word => {
        if ((currentChunk + word).length < maxLength) {
            currentChunk += (currentChunk ? ' ' : '') + word;
        } else {
            chunks.push(currentChunk);
            currentChunk = word;
        }
    });
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
}

// HTML Escape
function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Generate Message
function generateMessage() {
    const t = escapeHtml(inputs.title.value);
    const y = escapeHtml(inputs.year.value);
    const r = escapeHtml(inputs.rating.value);
    const e = escapeHtml(inputs.episodes.value);
    const a = escapeHtml(inputs.audio.value);
    const g = escapeHtml(inputs.genres.value);
    const st = escapeHtml(inputs.studio.value);
    const s = escapeHtml(inputs.synopsis.value);

    let wVal = inputs.watchLink.value;
    if (!wVal && siteSettings && siteSettings.defaultWatchLink) {
        wVal = siteSettings.defaultWatchLink;
    }
    const w = wVal ? escapeHtml(wVal) : '';

    let msg = `🌟 <b>${t}</b> 🌟\n\n`;

    if (y && y !== 'N/A') msg += `📅 <b>Ano:</b> ${y}\n`;
    if (e && e !== 'N/A') msg += `📺 <b>Episódios:</b> ${e}\n`;
    if (r && r !== 'N/A') msg += `⭐️ <b>Nota:</b> ${r}\n`;
    if (a && a !== 'N/A') msg += `🎧 <b>Áudio:</b> ${a}\n`;
    if (st && st !== 'N/A') msg += `🏢 <b>Estúdio:</b> ${st}\n`;
    if (g && g !== 'N/A') msg += `🎭 <b>Gêneros:</b> ${g}\n`;

    if (s && s !== 'N/A') {
        msg += `\n\n📖 <b>Sinopse:</b>  \n<blockquote>${s}</blockquote>\n`;
    }

    if (w) {
        msg += `\n👉 <a href="${w}">Assistir</a> 👈\n\n`;
    } else {
        msg += `\n`;
    }

    const support = (siteSettings && siteSettings.supportLink) ? siteSettings.supportLink : 'https://t.me/c/1910214917/61/1893';
    const more = (siteSettings && siteSettings.moreLink) ? siteSettings.moreLink : 'https://t.me/+bfifdpJ6lypkYjUx';

    msg += `🌟 <a href="${support}">Apoie o Projeto</a> 🌟\n\n`;
    msg += `📺 <a href="${more}">Para Mais</a> 📺\n\n.`;

    return msg;
}

// Send to Telegram with Inline Buttons
async function sendToTelegram() {
    const message = generateMessage();
    const posterUrl = previewPoster.src;

    if (!selectedResult && previewPoster.src.includes('placeholder')) {
        alert('Selecione um anime/desenho primeiro!');
        return;
    }

    const btn = document.getElementById('sendBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    btn.disabled = true;

    try {
        const formData = new FormData();
        const chatId = document.getElementById('targetChannel').value;
        formData.append('chat_id', chatId);

        // Handle local placeholder image
        if (posterUrl.includes('placeholder_poster.png')) {
            try {
                // Try to fetch the local image and send as file
                const res = await fetch(posterUrl);
                const blob = await res.blob();
                formData.append('photo', blob, 'placeholder.png');
            } catch (e) {
                console.warn('Could not fetch local placeholder, using public fallback.', e);
                // Fallback to a public URL if local fetch fails (e.g. file:// protocol restriction)
                formData.append('photo', 'https://image.tmdb.org/t/p/w500/iPXzJLl1zkSM1dT3jrv2K6qNi8q.jpg');
            }
        } else {
            // Normal URL
            formData.append('photo', posterUrl);
        }

        formData.append('caption', message);
        formData.append('parse_mode', 'HTML');

        // Buttons removed as per user request


        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.ok) {
            showToast('Enviado com sucesso!');

            // Clear form but keep channel selection
            const currentChannel = document.getElementById('targetChannel').value;
            botForm.reset();
            document.getElementById('targetChannel').value = currentChannel;

            previewPoster.src = 'placeholder_poster.png';
            messagePreview.textContent = '';
            selectedResult = null;

            // Clear focus and scroll to top
            if (document.activeElement) {
                document.activeElement.blur();
            }

            setTimeout(() => {
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
            }, 100);
        } else {
            console.error(data);
            alert('Erro ao enviar: ' + data.description);
        }
    } catch (error) {
        console.error(error);
        alert('Erro de conexão com o Telegram.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function updatePreview() {
    const text = generateMessage();
    messagePreview.textContent = text;
}
