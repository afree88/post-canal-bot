const BOT_TOKEN = '7187331068:AAElAHfEZ-BmC4HdzNaUjBy6gqmE1OpfqYc';
const CHAT_ID = '-1003671078681';
const TMDB_KEY = '9ef118499c4e6a024523225878b5dbb1';
const IMG_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// State
let currentMode = 'tv'; // 'movie' or 'tv'
let selectedResult = null;
let siteSettings = null;

// Load Settings
async function loadSettings() {
    try {
        // Cache busting to ensure we get latest settings
        const res = await fetch('data/settings.json?t=' + new Date().getTime());
        siteSettings = await res.json();
        
        // Populate channels
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
    creator: document.getElementById('entryCreator'),
    cast: document.getElementById('entryCast'),
    synopsis: document.getElementById('entrySynopsis'),
    watchLink: document.getElementById('entryWatchLink'),
    poster: document.getElementById('entryPoster')
};

// Event Listeners (Add poster preview update)
inputs.poster.addEventListener('input', () => {
    const defaultPoster = 'placeholder_poster.png';
    previewPoster.src = inputs.poster.value || defaultPoster;
});

// Event Listeners
toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        toggleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.type;

        // Toggle Theme
        if (currentMode === 'movie') {
            document.body.classList.add('movie-mode');
        } else {
            document.body.classList.remove('movie-mode');
        }

        resultsGrid.innerHTML = '<div class="placeholder-msg">Faça uma busca...</div>';
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

// Search Logic
async function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    resultsGrid.innerHTML = '<div class="placeholder-msg">Carregando TMDB...</div>';

    try {
        const results = await searchTmdb(query, currentMode);
        renderResults(results);
    } catch (error) {
        console.error(error);
        resultsGrid.innerHTML = '<div class="placeholder-msg">Erro ao buscar no TMDB. Verifique a chave API.</div>';
    }
}

// TMDB API
async function searchTmdb(query, type) {
    // Type 'movie' or 'tv'
    const url = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(query)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.results) return [];

    // Need to fetch genres list separately ideally, but for now we might map IDs or just skip.
    // TMDB returns genre_ids. Let's make a quick map for common ones or fetch it.
    // For simplicity/speed, we will fetch genre list once or hardcode a small map.
    // Actually, let's fetch details for the clicked item to get full genre names, 
    // but for the grid we just show Title/Year.

    return data.results.map(item => ({
        id: item.id,
        title: item.title || item.name, // Movie has title, TV has name
        year: (item.release_date || item.first_air_date || 'N/A').split('-')[0],
        rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        poster: item.poster_path ? IMG_BASE_URL + item.poster_path : 'placeholder_poster.png',
        synopsis: item.overview || 'Sem sinopse.',
        genre_ids: item.genre_ids,
        type: type
    }));
}

// Render Grid
function renderResults(items) {
    resultsGrid.innerHTML = '';
    if (items.length === 0) {
        resultsGrid.innerHTML = '<div class="placeholder-msg">Nenhum resultado encontrado.</div>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'anime-card';
        card.innerHTML = `
            <img src="${item.poster}" alt="${item.title}">
            <div class="info">
                <h3>${item.title}</h3>
                <span>${item.year}</span>
            </div>
        `;
        card.addEventListener('click', () => populateEditor(item));
        resultsGrid.appendChild(card);
    });
}

// Editor & Logic
async function populateEditor(item) {
    selectedResult = item;

    // Fetch full details to get Genres Names (since search only gives IDs)
    const detailedItem = await fetchDetails(item.id, item.type);

    inputs.title.value = detailedItem.title;
    inputs.year.value = detailedItem.year;
    inputs.rating.value = detailedItem.rating !== 'N/A' ? `${detailedItem.rating}/10` : 'N/A';

    // Format Genres: #Action #Drama
    inputs.genres.value = formatGenres(detailedItem.genres);

    inputs.creator.value = detailedItem.creator || 'N/A';
    inputs.cast.value = detailedItem.cast || 'N/A';
    inputs.episodes.value = detailedItem.episodes || 'N/A';
    inputs.synopsis.value = detailedItem.synopsis || 'Sem sinopse.';
    inputs.audio.value = 'Português'; // Default

    inputs.poster.value = detailedItem.poster;
    previewPoster.src = detailedItem.poster;
}

// Genre Translation Map for TMDB
const genreTranslations = {
    'Action': 'Ação', 'Adventure': 'Aventura', 'Animation': 'Animação',
    'Comedy': 'Comédia', 'Crime': 'Crime', 'Documentary': 'Documentário',
    'Drama': 'Drama', 'Family': 'Família', 'Fantasy': 'Fantasia',
    'History': 'História', 'Horror': 'Terror', 'Music': 'Música',
    'Mystery': 'Mistério', 'Romance': 'Romance', 'Science Fiction': 'Ficção Científica',
    'TV Movie': 'Filme de TV', 'Thriller': 'Suspense', 'War': 'Guerra',
    'Western': 'Faroeste', 'Action & Adventure': 'Ação e Aventura',
    'Sci-Fi & Fantasy': 'Ficção Científica e Fantasia', 'Kids': 'Infantil',
    'News': 'Notícias', 'Reality': 'Reality Show', 'Soap': 'Novela',
    'Talk': 'Talk Show', 'Politics': 'Política', 'War & Politics': 'Guerra e Política'
};

function formatGenres(genresArray) {
    if (!genresArray || !Array.isArray(genresArray)) return 'N/A';

    return genresArray.map(g => {
        const originalName = g.name;
        // Translate or use original if not found
        const translatedName = genreTranslations[originalName] || originalName;

        // Remove ' & ', spaces, special chars to make a clean hashtag
        // e.g. "Ficção Científica e Fantasia" -> "#FicçãoCientíficaeFantasia"
        // Also handle cases like "Sci-Fi" -> removal of hyphen
        const cleanTag = translatedName
            .replace(/&/g, 'e') // Replace ampersand with 'e'
            .replace(/[^\w\s\u00C0-\u00FF]/g, '') // Remove non-word chars (except spaces and accents)
            .replace(/\s+/g, ''); // Remove spaces

        return `#${cleanTag}`;
    }).join(' ');




    if (window.innerWidth <= 900) {
        document.getElementById('editorSection').scrollIntoView({ behavior: 'smooth' });
    }

    updatePreview();
}

async function fetchDetails(id, type) {
    const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&language=pt-BR&append_to_response=credits`;
    const res = await fetch(url);
    const data = await res.json();

    // Get creator/director
    let creator = 'N/A';
    if (type === 'movie') {
        // For movies, get the director
        const director = data.credits?.crew?.find(person => person.job === 'Director');
        creator = director ? director.name : 'N/A';
    } else {
        // For TV shows, get the creator
        if (data.created_by && data.created_by.length > 0) {
            creator = data.created_by[0].name;
        }
    }

    // Get top 3 cast members
    let cast = 'N/A';
    if (data.credits?.cast && data.credits.cast.length > 0) {
        const topCast = data.credits.cast.slice(0, 3).map(actor => actor.name);
        cast = topCast.join(', ');
    }

    // Get episode count for TV shows
    let episodes = 'N/A';
    if (type === 'tv' && data.number_of_episodes) {
        episodes = data.number_of_episodes.toString();
    }

    return {
        title: data.title || data.name,
        year: (data.release_date || data.first_air_date || 'N/A').split('-')[0],
        rating: data.vote_average ? data.vote_average.toFixed(1) : 'N/A',
        poster: data.poster_path ? IMG_BASE_URL + data.poster_path : 'placeholder_poster.png',
        synopsis: data.overview,
        genres: data.genres || [],
        creator: creator,
        cast: cast,
        episodes: episodes
    };
}

// Helper to escape HTML special characters
function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function generateMessage() {
    const t = escapeHtml(inputs.title.value);
    const y = escapeHtml(inputs.year.value);
    const r = escapeHtml(inputs.rating.value);
    const ep = escapeHtml(inputs.episodes.value);
    const a = escapeHtml(inputs.audio.value);
    const g = escapeHtml(inputs.genres.value);
    const c = escapeHtml(inputs.creator.value);
    const cast = escapeHtml(inputs.cast.value);
    const s = escapeHtml(inputs.synopsis.value);

    // Apply default watch link only if it is configured and the user left the input blank
    let wVal = inputs.watchLink.value;
    if (!wVal && siteSettings && siteSettings.defaultWatchLink) {
        wVal = siteSettings.defaultWatchLink;
    }
    const w = wVal ? escapeHtml(wVal) : '';

    let msg = `🌟 <b>${t}</b> 🌟\n\n`;

    if (y && y !== 'N/A') msg += `📅 <b>Ano:</b> ${y}\n`;
    if (c && c !== 'N/A') msg += `🎬 <b>Criador:</b> ${c}\n`;
    if (r && r !== 'N/A') msg += `⭐️ <b>Avaliação:</b> ${r}\n`;
    if (ep && ep !== 'N/A') msg += `📺 <b>Episódios:</b> ${ep}\n`;
    if (a && a !== 'N/A') msg += `🎧 <b>Áudio:</b> ${a}\n`;
    if (g && g !== 'N/A') msg += `🎭 <b>Gênero:</b> ${g}\n`;
    if (cast && cast !== 'N/A') msg += `🎭 <b>Elenco:</b> ${cast}\n`;

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

// Send to Telegram
async function sendToTelegram() {
    const message = generateMessage();
    // Get poster from input, fallback to selectedResult if empty (though input should be populated)
    const posterUrl = inputs.poster.value || (selectedResult ? selectedResult.poster : null);

    if (!posterUrl) {
        alert('Insira o link da capa ou selecione uma obra!');
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

        // Buttons removed as per request
        // const replyMarkup = { ... };
        // formData.append('reply_markup', JSON.stringify(replyMarkup));

        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.ok) {
            showToast('Enviado com sucesso!');

            // Clear all data
            // Clear all data but keep channel and audio defaults if desired
            const currentChannel = document.getElementById('targetChannel').value;
            botForm.reset();
            document.getElementById('targetChannel').value = currentChannel; // Restore channel

            document.getElementById('targetChannel').value = currentChannel; // Restore channel

            previewPoster.src = 'placeholder_poster.png';
            inputs.poster.value = ''; // Clear poster input
            messagePreview.textContent = '';
            selectedResult = null;

            // Clear focus
            if (document.activeElement) {
                document.activeElement.blur();
            }

            // Force scroll to top after a small delay to ensure DOM updates complete
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
