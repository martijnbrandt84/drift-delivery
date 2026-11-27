// =========================================================
// KAART-LABELS: gebouwen en verharde terreinen krijgen een soort mee,
// zodat de kaart hun echte omtrek in een eigen kleur kan tekenen.
// =========================================================
export const MAP_KINDS = {
  paved: { fill: '#9d988f', stroke: 'rgba(60, 55, 50, 0.55)', label: 'Parking & squares', legend: true },
  runway: { fill: '#6d6965', stroke: 'rgba(40, 38, 36, 0.6)', label: null, legend: false },
  yard: { fill: '#d2b98c', stroke: 'rgba(110, 85, 50, 0.5)', label: 'Yards & grounds', legend: true },
  home: { fill: '#c4664a', stroke: '#4a2418', label: 'Homes', legend: true },
  shop: { fill: '#e8a63a', stroke: '#5a3a12', label: 'Shops & food', legend: true },
  civic: { fill: '#5b82b8', stroke: '#1f3350', label: 'Public', legend: true },
  farm: { fill: '#a8352a', stroke: '#4a1410', label: 'Farms', legend: true },
  leisure: { fill: '#9a62c4', stroke: '#3c1f52', label: 'Leisure', legend: true },
  industry: { fill: '#7f6e60', stroke: '#33281f', label: 'Industry', legend: true }
};

export function tagMap(obj, kind) {
  if (obj && obj.userData) obj.userData.mapKind = kind;
  return obj;
}
