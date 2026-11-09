export const slugify = (s="") => s.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9_-]/g,"").slice(0,24);

export function formatTime(value, unit="s") {
  if (value === null || value === undefined || value === "") return "—";
  if (unit !== "s") return `${value} ${unit}`;
  return `${Number(value).toFixed(2)} s`;
}
export function computeAverage(values) {
  const nums = values.filter(v => Number.isFinite(Number(v))).map(Number);
  if (nums.length < 5) return null;
  const sorted = [...nums].sort((a,b)=>a-b);
  return (sorted.slice(1,-1).reduce((a,b)=>a+b,0))/(nums.length-2);
}
export function levelFor(value, thresholds) {
  if (value === null || value === undefined) return "Non classé";
  const eligible = [...thresholds].sort((a,b)=>Number(a.max_value)-Number(b.max_value));
  const found = eligible.find(t=>Number(value) <= Number(t.max_value));
  return found?.level_name || (eligible.length ? "À définir" : "Sans niveau");
}
export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}
