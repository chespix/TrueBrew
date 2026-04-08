import fs from 'fs';

try {
  const data = JSON.parse(fs.readFileSync('raw_cafes.json', 'utf8'));
  let shops = [];
  let idCounter = 1;
  
  // Also push the fake one for UI test
  shops.push({
    id: idCounter++,
    name: "Estilo Comercial Café",
    lat: -34.5900,
    lng: -58.4200,
    status: "fake",
    details: "Dice 'Especialidad' pero sirve café comercial tostado oscuro.",
    address: "Av. Ficticia 123, CABA",
  });

  for (const el of data) {
    if (!el.tags || !el.tags.name) continue;
    
    const lat = el.lat || (el.center && el.center.lat);
    const lon = el.lon || (el.center && el.center.lon);
    
    if (!lat || !lon) continue;
    
    // De-duplicate simply by checking if already exist based on coordinates (basic proximity)
    const isDup = shops.some(s => Math.abs(s.lat - lat) < 0.0001 && Math.abs(s.lng - lon) < 0.0001);
    if(isDup) continue;

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

  const content = `export const mockShops = ${JSON.stringify(shops, null, 2)};\n`;
  fs.writeFileSync('src/data/mockShops.js', content);
  console.log("Imported " + shops.length + " specialty cafes via OSM!!");
} catch (e) {
  console.error(e);
}
