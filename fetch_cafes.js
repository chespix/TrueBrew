import fs from 'fs';

async function fetchCafes() {
  const query = `
    [out:json][timeout:25];
    area["name"="Ciudad Autónoma de Buenos Aires"]->.searchArea;
    (
      node["amenity"="cafe"]["name"~"specialty|especialidad|coffee|roasters|tostadores",i](area.searchArea);
      way["amenity"="cafe"]["name"~"specialty|especialidad|coffee|roasters|tostadores",i](area.searchArea);
    );
    out center;
  `;
  
  console.log("Fetching matching cafes from Overpass API...");
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Found ${data.elements.length} cafes!`);
    
    let shops = [];
    let idCounter = 1;
    
    for (const el of data.elements) {
      if (!el.tags || !el.tags.name) continue;
      
      const lat = el.lat || (el.center && el.center.lat);
      const lon = el.lon || (el.center && el.center.lon);
      
      if (!lat || !lon) continue;
      
      shops.push({
        id: idCounter++,
        name: el.tags.name,
        lat: lat,
        lng: lon,
        status: "unverified",
        details: "Obtenido automáticamente de OpenStreetMap.",
        address: [el.tags["addr:street"], el.tags["addr:housenumber"]].filter(Boolean).join(" ") || "Dirección desconocida, CABA"
      });
    }
    
    // Add a couple of manual ones we know are fake for testing UI if they want
    shops.push({
        id: idCounter++,
        name: "Estilo Comercial Café",
        lat: -34.5900,
        lng: -58.4200,
        status: "fake",
        details: "Dice 'Especialidad' pero sirve café comercial tostado oscuro.",
        address: "Av. Ficticia 123, CABA",
    });

    const fileContent = `export const mockShops = ${JSON.stringify(shops, null, 2)};\n`;
    fs.writeFileSync('./src/data/mockShops.js', fileContent);
    console.log("Successfully wrote data to src/data/mockShops.js");
    
  } catch(e) {
    console.error("Error fetching data:", e);
  }
}

fetchCafes();
