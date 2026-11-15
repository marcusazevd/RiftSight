// Dados do jogo: domínios, sets e lendas.
// Fonte das lendas/domínios: grade de lendas por domínio (Origins → Vendetta)
// e lista de Radiance. Atualize aqui a cada set novo (ou pela tela "Sets").

export const DOMAINS = {
  fury:  { name: "Fúria", color: "#e2483d" },
  calm:  { name: "Calma", color: "#36a86a" },
  mind:  { name: "Mente", color: "#3b8fe0" },
  body:  { name: "Corpo", color: "#f08a2c" },
  chaos: { name: "Caos",  color: "#9b59d6" },
  order: { name: "Ordem", color: "#e2b93b" },
};

// Datas de lançamento em inglês (início de cada temporada).
export const DEFAULT_SETS = [
  { id: "OGN", name: "Origins",     start: "2025-10-31", color: "#5ee7ff", glyph: "origin" },
  { id: "SFD", name: "Spiritforged", start: "2026-02-13", color: "#26d9a6", glyph: "spirit" },
  { id: "UNL", name: "Unleashed",   start: "2026-05-08", color: "#ff7a45", glyph: "claw" },
  { id: "VEN", name: "Vendetta",    start: "2026-07-31", color: "#ff5f7e", glyph: "blade" },
  { id: "RAD", name: "Radiance",    start: "2026-10-23", color: "#ffcf3f", glyph: "sun" },
];
// Cores para sets adicionados à mão (escolhida pelo código do set).
export const SET_PALETTE = ["#c9b8ff", "#5ee7ff", "#26d9a6", "#ffcf3f", "#ff7a45", "#ff5f7e", "#9b8cff", "#7fd36b"];

// [nome no app, domínio 1, domínio 2, set]
const L = [
  // Origins
  ["Kai'Sa","fury","mind","OGN"],["Volibear","fury","body","OGN"],["Jinx","fury","chaos","OGN"],
  ["Darius","fury","order","OGN"],["Ahri","calm","mind","OGN"],["Lee Sin","calm","body","OGN"],
  ["Yasuo","calm","chaos","OGN"],["Leona","calm","order","OGN"],["Teemo","mind","chaos","OGN"],
  ["Viktor","mind","order","OGN"],["Miss Fortune","body","chaos","OGN"],["Sett","body","order","OGN"],
  // Proving Grounds (Origins)
  ["Annie","fury","chaos","OGN"],["Master Yi - Wuju Bladesman","calm","body","OGN"],
  ["Lux","mind","order","OGN"],["Garen","body","order","OGN"],
  // Spiritforged
  ["Rumble","fury","mind","SFD"],["Lucian","fury","body","SFD"],["Draven","fury","chaos","SFD"],
  ["Rek'Sai","fury","order","SFD"],["Ornn","calm","mind","SFD"],["Jax","calm","body","SFD"],
  ["Irelia","calm","chaos","SFD"],["Azir","calm","order","SFD"],["Ezreal","mind","chaos","SFD"],
  ["Renata Glasc","mind","order","SFD"],["Sivir","body","chaos","SFD"],["Fiora","body","order","SFD"],
  // Unleashed
  ["Jhin","fury","mind","UNL"],["Rengar","fury","body","UNL"],["Pyke","fury","chaos","UNL"],
  ["Vi","fury","order","UNL"],["Lillia","calm","mind","UNL"],["Master Yi - Wuju Master","calm","body","UNL"],
  ["Vex","calm","chaos","UNL"],["Ivern","calm","order","UNL"],["Diana","mind","chaos","UNL"],
  ["LeBlanc","mind","order","UNL"],["Kha'Zix","body","chaos","UNL"],["Poppy","body","order","UNL"],
  // Vendetta
  ["Renekton","fury","body","VEN"],["Zed","fury","chaos","VEN"],["Nasus","calm","mind","VEN"],
  ["Shen","calm","order","VEN"],["Mel","mind","chaos","VEN"],["Ambessa","body","order","VEN"],
  ["Akali","fury","calm","VEN"],["Jayce","mind","body","VEN"],["Kennen","chaos","order","VEN"],
  // Radiance
  ["Ekko","fury","mind","RAD"],["Ziggs","fury","chaos","RAD"],["Mordekaiser","fury","order","RAD"],
  ["Orianna","calm","mind","RAD"],["K'Sante","calm","body","RAD"],["Riven","calm","chaos","RAD"],
  ["Seraphine","mind","order","RAD"],["Evelynn","body","chaos","RAD"],["Jarvan IV","body","order","RAD"],
];

export const LEGENDS = Object.fromEntries(
  L.map(([name, d1, d2, set]) => [name, { name, domains: [d1, d2], set }])
);

export const EVENT_TYPES = ["Casual", "Nexus Night", "Skirmish", "Showdown", "Riftatlas", "Regional (RQ)", "Outro"];

// Battlefields por set (só os nomes, da galeria de cartas da Riot; lista de 1/11/2026).
// Banidos no Constructed (lista de 18/09/2026) ficam marcados.
export const BATTLEFIELDS = {
  OGN: ["Altar to Unity", "Aspirant's Climb", "Back-Alley Bar", "Bandle Tree", "Fortified Position", "Grove of the God-Willow", "Hallowed Tomb", "Monastery of Hirana", "Navori Fighting Pit", "Obelisk of Power", "Reaver's Row", "Reckoner's Arena", "Sigil of the Storm", "Startipped Peak", "Targon's Peak", "The Arena's Greatest", "The Candlelit Sanctum", "The Dreaming Tree", "The Grand Plaza", "Trifarian War Camp", "Vilemaw's Lair", "Void Gate", "Windswept Hillock", "Zaun Warrens"],
  SFD: ["Emperor's Dais", "Forge of the Fluft", "Forgotten Monument", "Hall of Legends", "Marai Spire", "Minefield", "Ornn's Forge", "Power Nexus", "Ravenbloom Conservatory", "Rockfall Path", "Seat of Power", "Sunken Temple", "The Papertree", "Treasure Hoard", "Veiled Temple"],
  UNL: ["Abandoned Hall", "Altar of Blood", "Amateur Recital", "Black Flame Altar", "Dusk Rose Lab", "Forbidding Waste", "Forgotten Library", "Frozen Fortress", "Gardens of Becoming", "Ripper's Bay", "Star Spring", "The Academy", "Trapping Grounds", "Valley of Idols", "Vaults of Helia"],
  VEN: ["Dragon Roost", "Heisho, Shell of the World", "Kinkou Temple", "Mystic Vortex", "Piltovan Forge", "Protective Sands", "Risen Altar", "Sandswept Tomb", "Shadow Temple", "Threshold of the Gray"],
  RAD: ["Bandle Scouts' Academy", "Black Market", "Black Rose Sanctum", "Cosmic Vista", "Durand Memorial", "Firelights' Hideout", "Hunters' Circle", "Packed Amphitheater", "Rakelstake", "Ruined Monastery"],
};
export const BANNED_BF = ["Aspirant's Climb", "Obelisk of Power", "Reaver's Row", "The Arena's Greatest", "The Dreaming Tree"];
