// Catalogue initial des événements WCA. Les événements additionnels peuvent être ajoutés par l'administrateur.
export const EVENTS = [
 ["222","2×2×2"],["333","3×3×3"],["444","4×4×4"],["555","5×5×5"],
 ["666","6×6×6"],["777","7×7×7"],["333oh","3×3 à une main"],
 ["333bf","3×3 à l'aveugle"],["444bf","4×4 à l'aveugle"],["555bf","5×5 à l'aveugle"],
 ["333fm","3×3 Fewest Moves"],["333mbf","3×3 Multi-Blind"],["clock","Clock"],
 ["minx","Megaminx"],["pyram","Pyraminx"],["skewb","Skewb"],["sq1","Square-1"]
].map(([id,name],i)=>({id,name,is_official:true,is_active:true,sort_order:i+1}));

export const DEFAULT_STATS = [
 {stat_type:"single",label:"Single",unit:"s"},
 {stat_type:"mean3",label:"Mean of 3",unit:"s"},
 {stat_type:"ao5",label:"Ao5",unit:"s"},
 {stat_type:"ao12",label:"Ao12",unit:"s"},
 {stat_type:"ao100",label:"Ao100",unit:"s"}
];
