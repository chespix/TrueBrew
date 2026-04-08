import https from 'https';
import fs from 'fs';

const OVERPASS_ENDPOINTS = [
  'overpass-api.de',
  'lz4.overpass-api.de'
];

const QUERY = `[out:json][timeout:25];
area["name"="Ciudad Autónoma de Buenos Aires"]->.searchArea;
(
  node["amenity"="cafe"]["name"~"specialty|especialidad|coffee|roaster|tostador",i](area.searchArea);
  way["amenity"="cafe"]["name"~"specialty|especialidad|coffee|roaster|tostador",i](area.searchArea);
);
out center;`;

async function fetchFromEndpoint(host) {
  return new Promise((resolve, reject) => {
    const dataString = "data=" + encodeURIComponent(QUERY);
    const options = {
      hostname: host,
      path: '/api/interpreter',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(dataString),
        'User-Agent': 'TrueBrew-Importer/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk.toString());
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(body));
          } catch(e) {
            reject(new Error("Parse error: " + e.message));
          }
        } else {
          reject(new Error("HTTP " + res.statusCode));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(dataString);
    req.end();
  });
}

async function run() {
  console.log("Comenzando búsqueda masiva de todos los cafés de especialidad...");
  
  let data = null;
  for (const host of OVERPASS_ENDPOINTS) {
    console.log(`Intentando con ${host}...`);
    try {
      data = await fetchFromEndpoint(host);
      console.log("¡Datos obtenidos exitosamente!");
      break;
    } catch (e) {
      console.log(`Falló ${host}: ${e.message}`);
    }
  }

  if (!data) {
    console.error("No se pudo conectar a ningún servidor de mapas.");
    process.exit(1);
  }

  let shops = [];
  let idCounter = Date.now();
  
  for (const el of data.elements) {
    if (!el.tags || !el.tags.name) continue;
    const lat = el.lat || (el.center && el.center.lat);
    const lon = el.lon || (el.center && el.center.lon);
    
    if (!lat || !lon) continue;

    const isDup = shops.some(s => Math.abs(s.lat - lat) < 0.0001 && Math.abs(s.lng - lon) < 0.0001);
    if(isDup) continue;

    shops.push({
      id: idCounter++,
      name: el.tags.name,
      lat: lat,
      lng: lon,
      upvotes: 0,
      downvotes: 0,
      details: "Importado automáticamente de OpenStreetMap.",
      address: [el.tags["addr:street"], el.tags["addr:housenumber"]].filter(Boolean).join(" ") || "Dirección aproximada, CABA"
    });
  }

  const content = `export const mockShops = ${JSON.stringify(shops, null, 2)};\n`;
  fs.writeFileSync('src/data/mockShops.js', content);
  console.log(`¡Impresionante! Se importaron correctamente ${shops.length} cafés de CABA en src/data/mockShops.js`);
}

run();
