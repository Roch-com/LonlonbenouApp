// Vérifie les contrastes de la palette réellement écrite dans les tokens,
// et non d'une copie qui pourrait avoir divergé.
import { colors, colorsSombre, degrades, degradesSombre } from '../src/design/tokens.ts';

const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126*lin((n>>16)&255) + 0.7152*lin((n>>8)&255) + 0.0722*lin(n&255); };
const r = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

let echecs = 0;
const v = (quoi, a, b, seuil) => {
  const x = r(a, b);
  const ok = x >= seuil;
  if (!ok) echecs++;
  console.log(`  ${ok ? 'OK ' : 'NON'} ${x.toFixed(2)} (min ${seuil})  ${quoi}`);
};

for (const [nom, c, d] of [['CLAIR', colors, degrades], ['SOMBRE', colorsSombre, degradesSombre]]) {
  console.log(`\n═══ ${nom} ═══`);
  v('texte sur fond', c.texte, c.fond, 4.5);
  v('texte sur surface', c.texte, c.fondEleve, 4.5);
  v('texte doux sur surface', c.texteDoux, c.fondEleve, 4.5);
  v('texte voile sur fond (grand)', c.texteVoile, c.fond, 3.0);
  v('accent sur fond', c.accent, c.fond, 4.5);
  v('accent sur surface', c.accent, c.fondEleve, 4.5);
  v('rose sur surface', c.tendresse, c.fondEleve, 4.5);
  v('urgence sur fond', c.urgence, c.fond, 4.5);
  v('or sur fond (grand)', c.or, c.fond, 3.0);
  // Chaque arrêt du dégradé de bouton doit porter le libellé.
  d.accent.forEach((arret, i) => v(`libelle sur bouton, arret ${i}`, c.texteInverse, arret, 4.5));
  // Chaque arrêt du dégradé doré doit porter l'encre.
  d.or.forEach((arret, i) => v(`encre sur carte doree, arret ${i}`, c.texteSurAccent, arret, 4.5));
}

console.log(echecs === 0 ? '\n✅ Tous les contrastes passent.' : `\n❌ ${echecs} contraste(s) en échec.`);
process.exit(echecs === 0 ? 0 : 1);
