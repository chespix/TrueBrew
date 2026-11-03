import L from 'leaflet';

// Leaflet div icons for shop markers and clusters (colored by status).
export const createIcon = (status) => {
  let iconClass = 'marker-unverified';
  let innerHtml = '<div style="color:white; display:flex; align-items:center; justify-content:center; height:100%;">';
  if (status === 'specialty') {
    iconClass = 'marker-specialty';
    innerHtml += '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/></svg>';
  } else if (status === 'fake') {
    iconClass = 'marker-fake';
    innerHtml += '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  } else {
    innerHtml += '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
  }
  innerHtml += '</div>';
  return L.divIcon({ className: `custom-marker ${iconClass}`, html: innerHtml, iconSize: [32, 32], iconAnchor: [16, 16] });
};

export const createClusterCustomIcon = (cluster) => {
  const childCount = cluster.getChildCount();
  const markers = cluster.getAllChildMarkers();
  
  let specialty = 0;
  let fake = 0;
  let unverified = 0;

  markers.forEach(m => {
    const className = m.options.icon?.options?.className || '';
    if (className.includes('marker-specialty')) specialty++;
    else if (className.includes('marker-fake')) fake++;
    else unverified++;
  });

  // Default color is unverified/yellow
  let dominantClass = 'marker-cluster-unverified';
  
  // If the majority of the nodes inside are specialty
  if (specialty > fake && specialty >= unverified) {
    dominantClass = 'marker-cluster-specialty';
  } 
  // If the majority are fake
  else if (fake > specialty && fake > unverified) {
    dominantClass = 'marker-cluster-fake';
  }

  return L.divIcon({
    html: `<div><span>${childCount}</span></div>`,
    className: `marker-cluster ${dominantClass}`,
    iconSize: L.point(40, 40)
  });
};
