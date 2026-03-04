const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static('public'));

// Configuración de User-Agent
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Headers por defecto
const defaultHeaders = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

// ============================================
// ENDPOINT PRINCIPAL
// ============================================
app.get('/', (req, res) => {
  res.json({
    nombre: 'API AnimeFLV - Backend para app personal',
    version: '1.0.0',
    endpoints: {
      ultimos_animes: '/animeflv',
      buscar_anime: '/buscar/:query',
      info_anime: '/anime/:id',
      episodios: '/anime/:id/episodios',
      video_episodio: '/ver/:animeId/:episodio'
    },
    ejemplo_anime_id: 'one-piece-tv',
    estado: 'Servidor funcionando correctamente 🚀'
  });
});

// ============================================
// ENDPOINT 1: Últimos animes
// ============================================
app.get('/animeflv', async (req, res) => {
  try {
    console.log('🌐 Obteniendo últimos animes de AnimeFLV...');
    
    const response = await axios.get('https://www3.animeflv.net', {
      headers: defaultHeaders,
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    let animes = [];

    $('.ListAnimes .Anime').each((i, el) => {
      const link = $(el).find('a').first();
      const href = link.attr('href');
      const title = link.find('h3.Title').text().trim();
      const imagen = $(el).find('.Image img').attr('src');
      const tipo = $(el).find('.Type').text().trim();
      
      if (href && title && !title.includes('INICIAR SESION')) {
        const match = href.match(/\/anime\/(.+)/);
        const id = match ? match[1] : null;
        
        animes.push({
          id: id,
          title: title,
          type: tipo || 'Anime',
          image: imagen ? (imagen.startsWith('http') ? imagen : 'https://www3.animeflv.net' + imagen) : null,
          url: 'https://www3.animeflv.net' + href
        });
      }
    });

    const uniqueAnimes = Array.from(new Map(animes.map(a => [a.id, a])).values());
    
    console.log(`✅ Encontrados ${uniqueAnimes.length} animes`);
    res.json({
      success: true,
      count: uniqueAnimes.length,
      data: uniqueAnimes.slice(0, 50)
    });

  } catch (error) {
    console.error('❌ Error en /animeflv:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al conectar con AnimeFLV',
      details: error.message
    });
  }
});

// ============================================
// ENDPOINT 2: Buscar animes
// ============================================
app.get('/buscar/:query', async (req, res) => {
  const query = req.params.query;
  
  try {
    console.log(`🔍 Buscando: "${query}"`);
    
    const response = await axios.get(`https://www3.animeflv.net/browse?q=${encodeURIComponent(query)}`, {
      headers: defaultHeaders,
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    let resultados = [];

    $('.ListAnimes .Anime').each((i, el) => {
      const link = $(el).find('a').first();
      const href = link.attr('href');
      const title = link.find('h3.Title').text().trim();
      const imagen = $(el).find('.Image img').attr('src');
      const tipo = $(el).find('.Type').text().trim();
      
      if (href && title) {
        const match = href.match(/\/anime\/(.+)/);
        const id = match ? match[1] : null;
        
        resultados.push({
          id: id,
          title: title,
          type: tipo || 'Anime',
          image: imagen ? (imagen.startsWith('http') ? imagen : 'https://www3.animeflv.net' + imagen) : null,
          url: 'https://www3.animeflv.net' + href
        });
      }
    });

    res.json({
      success: true,
      query: query,
      count: resultados.length,
      data: resultados
    });

  } catch (error) {
    console.error('❌ Error en búsqueda:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al realizar la búsqueda'
    });
  }
});

// ============================================
// ENDPOINT 3: Información detallada
// ============================================
app.get('/anime/:id', async (req, res) => {
  const animeId = req.params.id;
  
  try {
    console.log(`📋 Obteniendo info de: ${animeId}`);
    
    const response = await axios.get(`https://www3.animeflv.net/anime/${animeId}`, {
      headers: defaultHeaders,
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    const title = $('h1.Title').first().text().trim();
    const synopsis = $('.Description p').text().trim();
    
    let image = $('.AnimeCover .Image img').attr('src');
    if (!image) image = $('meta[property="og:image"]').attr('content');
    
    const generos = [];
    $('.Nvgnrs a').each((i, el) => {
      generos.push($(el).text().trim());
    });
    
    const estado = $('.AnmStts span').text().trim();
    const rating = $('#votes_prmd').text().trim();
    
    const html = response.data;
    let totalEpisodios = 'Desconocido';
    
    const match = html.match(/var episodes = (\[.*?\]);/s);
    if (match) {
      try {
        const episodesData = JSON.parse(match[1]);
        totalEpisodios = episodesData.length.toString();
      } catch (e) {
        console.log('Error parseando episodios');
      }
    }

    res.json({
      success: true,
      data: {
        id: animeId,
        title: title || 'Título no disponible',
        synopsis: synopsis || 'Sin sinopsis disponible',
        image: image ? (image.startsWith('http') ? image : 'https://www3.animeflv.net' + image) : null,
        generos: generos,
        estado: estado || 'Desconocido',
        rating: rating || '0',
        totalEpisodios: totalEpisodios
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo info:', error.message);
    res.status(500).json({
      success: false,
      error: `No se pudo obtener información para: ${animeId}`
    });
  }
});

// ============================================
// ENDPOINT 4: Lista de episodios
// ============================================
app.get('/anime/:id/episodios', async (req, res) => {
  const animeId = req.params.id;
  
  try {
    console.log(`📺 Obteniendo episodios de: ${animeId}`);
    
    const response = await axios.get(`https://www3.animeflv.net/anime/${animeId}`, {
      headers: defaultHeaders,
      timeout: 10000
    });

    const html = response.data;
    let episodios = [];

    const match = html.match(/var episodes = (\[.*?\]);/s);
    
    if (match) {
      try {
        const episodesData = JSON.parse(match[1]);
        
        episodesData.forEach((ep, index) => {
          const numero = ep[0];
          const episodeId = ep[1];
          
          episodios.push({
            numero: numero,
            titulo: `Episodio ${numero}`,
            id: episodeId,
            url: `https://www3.animeflv.net/ver/${animeId}-${numero}`
          });
        });
        
        episodios.sort((a, b) => a.numero - b.numero);
        
        console.log(`✅ Encontrados ${episodios.length} episodios para ${animeId}`);
      } catch (e) {
        console.error('Error parseando episodes:', e);
      }
    }

    res.json({
      success: true,
      animeId: animeId,
      total: episodios.length,
      data: episodios
    });

  } catch (error) {
    console.error('❌ Error obteniendo episodios:', error.message);
    res.status(500).json({
      success: false,
      error: `No se pudieron obtener los episodios para: ${animeId}`
    });
  }
});

function cambiarServidor(serv, index) {
    const videoContainer = document.getElementById('videoContainer');
    const botones = document.querySelectorAll('.servidor-btn');
    
    botones.forEach((btn, i) => {
        if (i === index) btn.classList.add('activo');
        else btn.classList.remove('activo');
    });

    if (serv.tipo === 'proxy') {
        videoContainer.innerHTML = `
            <div style="padding: 0; background: #000; border-radius: 10px;">
                <video controls style="width: 100%; max-height: 400px;" autoplay>
                    <source src="${serv.proxy_url}" type="video/mp4">
                    Tu navegador no soporta el elemento video.
                </video>
                <p style="color: #4caf50; text-align: center; padding: 10px; background: #1a1a1a; margin: 0;">
                    ✅ Reproduciendo desde ${serv.nombre}
                </p>
            </div>
        `;
    } else {
        videoContainer.innerHTML = `
            <div style="padding: 20px; background: #2d2d2d; border-radius: 10px; text-align: center;">
                <p style="color: #ff9800; margin-bottom: 15px;">⚠️ Este servidor requiere abrirse externamente</p>
                <a href="${serv.url_original}" target="_blank" 
                   style="display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 25px;">
                    Abrir en navegador
                </a>
            </div>
        `;
    }
}

// ============================================
// ENDPOINT 5: Obtener enlaces REALES de video (VERSIÓN FINAL)
// ============================================
app.get('/ver/:animeId/:episodio', async (req, res) => {
  const { animeId, episodio } = req.params;
  
  try {
    console.log(`🎬 Buscando video para: ${animeId} - Episodio ${episodio}`);
    
    const episodeUrl = `https://www3.animeflv.net/ver/${animeId}-${episodio}`;
    
    const response = await axios.get(episodeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www3.animeflv.net/'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    let servidores = [];

    // Buscar en la tabla de descarga
    $('table tr').each((i, row) => {
      if (i === 0) return;
      
      const columns = $(row).find('td');
      if (columns.length >= 4) {
        const nombre = $(columns[0]).text().trim();
        const tamaño = $(columns[1]).text().trim();
        const formato = $(columns[2]).text().trim();
        const linkElement = $(columns[3]).find('a');
        const link = linkElement.attr('href');
        
        if (nombre && link) {
          servidores.push({
            nombre,
            tamaño,
            formato,
            link_original: link
          });
        }
      }
    });

    // Para cada servidor, seguir la redirección hasta obtener la URL real
    const servidoresConEnlacesReales = await Promise.all(servidores.map(async (serv) => {
      try {
        console.log(`🔄 Siguiendo redirección para ${serv.nombre}...`);
        
        // CASO ESPECIAL: MEGA - No necesitamos seguir redirecciones
        if (serv.nombre === 'MEGA' || serv.link_original.includes('mega.nz')) {
          console.log('🎯 MEGA detectado directamente');
          
          // Extraer ID de MEGA de la URL original
          let megaId = '';
          const megaMatch = serv.link_original.match(/mega\.nz\/file\/([a-zA-Z0-9_-]+)/) || 
                           serv.link_original.match(/mega\.nz\/#!([a-zA-Z0-9_-]+)/) ||
                           serv.link_original.match(/[!\/]([a-zA-Z0-9_-]{8,})$/);
          
          if (megaMatch) {
            megaId = megaMatch[1] || megaMatch[0];
          }
          
          return {
            ...serv,
            url_real: serv.link_original,
            mega_id: megaId,
            tipo: 'mega',
            es_mega: true
          };
        }

        // Para otros servidores, seguir redirecciones con headers de navegador
        const redirectResponse = await axios.get(serv.link_original, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': episodeUrl,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
          },
          maxRedirects: 5,
          timeout: 15000,
          validateStatus: false
        });

        const urlFinal = redirectResponse.request?.res?.responseUrl || serv.link_original;
        
        // Detectar si es MEGA después de redirección (por si acaso)
        if (urlFinal.includes('mega.nz')) {
          console.log('🎯 MEGA detectado después de redirección');
          let megaId = '';
          const megaMatch = urlFinal.match(/mega\.nz\/file\/([a-zA-Z0-9_-]+)/) || 
                           urlFinal.match(/mega\.nz\/#!([a-zA-Z0-9_-]+)/) ||
                           urlFinal.match(/[!\/]([a-zA-Z0-9_-]{8,})$/);
          
          if (megaMatch) {
            megaId = megaMatch[1] || megaMatch[0];
          }
          
          return {
            ...serv,
            url_real: urlFinal,
            mega_id: megaId,
            tipo: 'mega',
            es_mega: true
          };
        }

        // Si no es MEGA, devolver como enlace normal
        return {
          ...serv,
          url_real: urlFinal,
          tipo: 'enlace'
        };

      } catch (error) {
        console.log(`⚠️ Error siguiendo ${serv.nombre}:`, error.message);
        
        // Incluso si hay error, intentar detectar MEGA por el nombre
        if (serv.nombre === 'MEGA') {
          return {
            ...serv,
            url_real: serv.link_original,
            tipo: 'mega',
            es_mega: true,
            error: error.message
          };
        }
        
        return {
          ...serv,
          url_real: null,
          tipo: 'error',
          error: error.message
        };
      }
    }));

    // Separar MEGA y otros, y ordenar (MEGA primero)
    const megaServers = servidoresConEnlacesReales.filter(s => s.tipo === 'mega' || s.es_mega);
    const otrosServers = servidoresConEnlacesReales.filter(s => s.tipo !== 'mega' && !s.es_mega && s.url_real);
    const servidoresValidos = [...megaServers, ...otrosServers];

    if (servidoresValidos.length > 0) {
      res.json({
        success: true,
        animeId,
        episodio,
        servidores: servidoresValidos
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No se encontraron servidores válidos'
      });
    }

  } catch (error) {
    console.error('❌ Error en /ver:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el video',
      details: error.message
    });
  }
});

// ============================================
// ENDPOINT PROXY DE VIDEO (OPCIONAL - PARA OTROS SERVIDORES)
// ============================================
app.get('/proxy/video/:videoId', async (req, res) => {
  const { videoId } = req.params;
  
  try {
    const videoUrl = Buffer.from(videoId, 'base64').toString('ascii');
    console.log(`🎥 Proxy solicitado: ${videoUrl.substring(0, 50)}...`);
    
    const response = await axios({
      method: 'GET',
      url: videoUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www3.animeflv.net/'
      },
      maxRedirects: 5,
      timeout: 30000
    });

    res.set({
      'Content-Type': response.headers['content-type'] || 'video/mp4',
      'Content-Length': response.headers['content-length'],
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600'
    });

    response.data.pipe(res);

  } catch (error) {
    console.error('❌ Error en proxy:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ENDPOINT DE DIAGNÓSTICO
// ============================================
app.get('/diagnostico/:id', async (req, res) => {
  const animeId = req.params.id;
  
  try {
    const response = await axios.get(`https://www3.animeflv.net/anime/${animeId}`, {
      headers: defaultHeaders
    });
    
    const html = response.data;
    const match = html.match(/var episodes = (\[.*?\]);/s);
    
    res.json({
      tieneVariableEpisodes: !!match,
      data: match ? match[1].substring(0, 500) : 'No encontrado'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DIAGNÓSTICO: Ver estructura de la página de video
// ============================================
app.get('/diagnostico-video/:animeId/:episodio', async (req, res) => {
  const { animeId, episodio } = req.params;
  
  try {
    const episodeUrl = `https://www3.animeflv.net/ver/${animeId}-${episodio}`;
    console.log(`🔍 Diagnosticando: ${episodeUrl}`);
    
    const response = await axios.get(episodeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www3.animeflv.net/'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // 1. Buscar todas las tablas
    const tablas = [];
    $('table').each((i, table) => {
      tablas.push({
        index: i,
        contenido: $(table).text().substring(0, 200).replace(/\s+/g, ' ').trim()
      });
    });

    // 2. Buscar todos los enlaces que parezcan de descarga
    const enlacesDescarga = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const texto = $(el).text().trim();
      
      if (href && (
        href.includes('mega') || 
        href.includes('1fichier') || 
        href.includes('mediafire') || 
        href.includes('.mp4') ||
        href.includes('linkinpork')
      )) {
        enlacesDescarga.push({
          texto: texto.substring(0, 50),
          href: href.substring(0, 100),
          html: $(el).html().substring(0, 100)
        });
      }
    });

    // 3. Ver los primeros 5000 caracteres del HTML
    const htmlPreview = response.data.substring(0, 5000);

    res.json({
      success: true,
      url: episodeUrl,
      status: response.status,
      total_tablas: tablas.length,
      tablas: tablas.slice(0, 3), // Solo las primeras 3
      total_enlaces_descarga: enlacesDescarga.length,
      enlaces_descarga: enlacesDescarga.slice(0, 10),
      html_preview: htmlPreview
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      url: `https://www3.animeflv.net/ver/${animeId}-${episodio}`
    });
  }
});

// ============================================
// Manejador de errores 404
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    endpoints_disponibles: [
      '/',
      '/animeflv',
      '/buscar/:query',
      '/anime/:id',
      '/anime/:id/episodios',
      '/ver/:animeId/:episodio',
      '/proxy/video/:videoId',
      '/diagnostico/:id',
      '/diagnostico-video/:animeId/:episodio'
    ]
  });
});

// ============================================
// Iniciar servidor
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════╗
║     🚀 SERVIDOR ANIME FLV INICIADO       ║
╠══════════════════════════════════════════╣
║  Puerto: ${PORT}                             
║  Accesible desde: http://localhost:${PORT}
║  En tu red local: http://192.168.1.16:${PORT}
║  Endpoint principal: http://localhost:${PORT}  
║  Últimos animes: http://localhost:${PORT}/animeflv
╚══════════════════════════════════════════╝
  `);
});