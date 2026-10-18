/*
 * aide.js : carte « Commandes » (légende illustrée : souris en SVG, touches en CSS), à droite du plateau (voir styles/aide.css).
 * Le contenu change avec l'onglet actif (Plateau / Tuiles). Repliable (<details>, ouvert par défaut) ; l'état est mémorisé
 * dans localStorage sous « plateau-modulaire:aide ».
 *
 * La liste est une donnée unique : PM.aide.COMMANDES. Chaque ligne cite le fichier source (`source`) et un extrait de code
 * (`preuve`) qui implémente le geste ou la touche : tests/aide.test.js vérifie que l'extrait est bien dans le fichier,
 * pour qu'une commande retirée ou renommée du code fasse échouer le test. Ne décrire ici que ce qui existe vraiment.
 * lignesAide(onglet) n'accède pas au DOM : testable sous Node.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

(function () {
  'use strict';

  var CLE_STOCKAGE = 'plateau-modulaire:aide';
  var ONGLETS = ['plateau', 'tuiles'];
  var TITRES_ONGLET = { plateau: 'Plateau', tuiles: 'Tuiles' };
  var TITRES_GROUPE = { souris: 'Souris', clavier: 'Clavier' };
  var BP = 'src/bibliotheque.js', AS = 'src/assemblage.js', ED = 'src/editeur-tuile.js', AP = 'src/app.js', CO = 'src/controles.js';

  /**
   * Toutes les commandes. Champs : onglets (où la ligne s'affiche), groupe ('souris' | 'clavier'), geste (libellé court),
   * effet (ce qui se passe réellement), source (fichier) et preuve (extrait de code exact de ce fichier).
   */
  var COMMANDES = [
    /* ---------------- Souris, onglet Plateau ---------------- */
    { onglets: ['plateau'], groupe: 'souris', geste: 'Clic sur une tuile de la bibliothèque',
      court: 'Choisir une tuile', picto: ['sg'],
      effet: 'La choisir ; un clic sur une case éclairée la pose. Nouveau clic sur la même tuile : annule.',
      source: BP, preuve: "etat.majUi({ aPoser: id, onglet: 'plateau' })" },
    { onglets: ['plateau'], groupe: 'souris', geste: 'Clic sur une case éclairée',
      court: 'Poser', picto: ['sg'],
      effet: 'Pose la tuile choisie (rotation suggérée pour un bord ou un coin).',
      source: AS, preuve: 'poserIci(ui.aPoser, col, lig, null)' },
    { onglets: ['plateau'], groupe: 'souris', geste: 'Glisser une tuile de la bibliothèque',
      court: 'Glisser sur le plateau', picto: ['sg','->'],
      effet: 'La poser directement sur une case du plateau (R pendant le glissement la tourne).',
      source: BP, preuve: 'PM.assemblage.demarrerGlissement(id, ev)' },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Clic sur une tuile de la bibliothèque',
      court: 'Choisir une tuile', picto: ['sg'],
      effet: 'Revient au Plateau et la choisit pour la pose (pour l’éditer : double-clic).',
      source: BP, preuve: "etat.majUi({ aPoser: id, onglet: 'plateau' })" },
    { onglets: ['plateau', 'tuiles'], groupe: 'souris', geste: 'Double-clic sur une tuile de la bibliothèque',
      court: 'Modifier la tuile', picto: ['sg','x2'],
      effet: 'L’ouvrir dans l’éditeur (onglet Tuiles).',
      source: BP, preuve: "liste.addEventListener('dblclick'" },
    { onglets: ['plateau'], groupe: 'souris', geste: 'Clic sur une tuile posée',
      court: 'Choisir, puis tourner', picto: ['sg'],
      effet: 'La sélectionner ; un second clic sur la tuile sélectionnée la tourne d’un quart de tour.',
      source: AS, preuve: 'if (selection && selection.col === col && selection.lig === lig) { pivoterSelection(); return; }' },
    { onglets: ['plateau'], groupe: 'souris', geste: 'Glisser une tuile posée',
      court: 'Déplacer la tuile', picto: ['sg','->'],
      effet: 'La déplacer vers une autre case compatible (sa rotation est conservée).',
      source: AS, preuve: 'if (g.de) deplacerIci(g.de, c);' },
    { onglets: ['plateau'], groupe: 'souris', geste: 'Clic droit sur une tuile posée',
      court: 'Retirer la tuile', picto: ['sd'],
      effet: 'La retirer (annulable).',
      source: AS, preuve: "scene.addEventListener('contextmenu'" },
    { onglets: ['plateau'], groupe: 'souris', geste: 'Clic sur une jonction',
      court: 'Ville / case chemin', picto: ['sg'],
      effet: 'Poser une ville ; un clic sur une ville la retire (la jonction redevient une case chemin).',
      source: AS, preuve: 'cyclerIci(pj[0], pj[1])' },
    { onglets: ['plateau'], groupe: 'souris', geste: 'Clic sur une alerte du panneau de droite',
      court: 'Montrer l’alerte', picto: ['sg'],
      effet: 'La montrer sur le plateau (clignote jusqu’au clic suivant).',
      source: CO, preuve: "etat.majUi({ surbrillance: Object.assign({}, e.cible), onglet: 'plateau' })" },
    { onglets: ['plateau', 'tuiles'], groupe: 'souris', geste: '✕ sur une tuile utilisateur',
      court: 'Supprimer (tuile perso)', picto: ['✕'],
      effet: 'La supprimer de la bibliothèque, après confirmation (annulable). Absent sur les tuiles du catalogue.',
      source: BP, preuve: 'data-action="supprimer"' },

    /* ---------------- Souris, onglet Tuiles (éditeur) ---------------- */
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Boutons Centrale, Bord, Coin, Dupliquer, Supprimer cette tuile',
      court: 'Créer, copier, supprimer', picto: ['sg'],
      effet: 'Créer une tuile (Nouveau), copier la tuile ouverte, ou supprimer une tuile utilisateur (confirmation).',
      source: ED, preuve: "'Supprimer cette tuile'" },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Clic sur le fond du canevas',
      court: 'Ajouter une case', picto: ['sg'],
      effet: 'Ajouter une case à cet endroit.',
      source: ED, preuve: "'Ajouter une case'" },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Clic sur une case, un raccord ou un coin',
      court: 'Choisir, tracer un chemin', picto: ['sg'],
      effet: 'Le sélectionner et commencer un chemin ; un clic sur une autre extrémité trace le chemin (Échap annule).',
      source: ED, preuve: 'tracer(arme, ext)' },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Glisser une case',
      court: 'Déplacer / relier', picto: ['sg','->'],
      effet: 'La déplacer (aimantée à la grille) ; la lâcher sur une autre case, un raccord ou un coin trace un chemin.',
      source: ED, preuve: "tracer({ 'case': d.id }, ext)" },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Glisser depuis un raccord ou un coin',
      court: 'Tracer un chemin', picto: ['sg','->'],
      effet: 'Tracer un chemin vers la case (ou le pivot) sur laquelle on relâche ; avec l’outil Passage, un raccord convient aussi.',
      source: ED, preuve: 'tracer(extremiteDeCible(cible2), extremiteDeCible(d))' },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Bouton Outil : Chemin / Passage',
      court: 'Outil Passage (courbe)', picto: ['sg'],
      effet: 'Basculer l’outil de tracé : Passage = courbe vers un raccord, une case ou un pivot, sans case sur le trajet ; Chemin = droit entre cases.',
      source: ED, preuve: "btnOutil.classList.add('pm-editeur-bouton-outil')" },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Maj + clic sur le fond du canevas',
      court: 'Ajouter un pivot (T)', picto: ['Maj','+','sg'],
      effet: 'Poser un pivot : point de ramification sans case, qui relie jusqu’à 3 passages en T (tracés avec l’outil Passage, ou en glissant depuis le pivot).',
      source: ED, preuve: 'if (ev.shiftKey && !cible) { creerPivot(p); return; }' },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Glisser la poignée d’un passage sélectionné',
      court: 'Courber le passage', picto: ['sg','->'],
      effet: 'Cliquer un passage le sélectionne et montre sa poignée ; la glisser règle la courbe (point de contrôle).',
      source: ED, preuve: "modifier(function (x) { return definirCourbe(x, g.id, p.x, p.y, fmt()); }, 'Courber un passage')" },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Double-clic sur la poignée d’un passage',
      court: 'Courbe par défaut', picto: ['sg','x2'],
      effet: 'Rendre au passage sélectionné sa courbe par défaut.',
      source: ED, preuve: "svg.addEventListener('dblclick'" },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Clic droit sur une case',
      court: 'Changer le type', picto: ['sd'],
      effet: 'Changer son type (déplacement / apparition).',
      source: ED, preuve: "svg.addEventListener('contextmenu'" },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Clic sur une erreur ou une alerte de la liste Validation',
      court: 'Repérer l’erreur', picto: ['sg'],
      effet: 'Entourer l’élément concerné sur le canevas.',
      source: ED, preuve: 'haloLocal = e.ref || null' },

    /* ---------------- Clavier, deux onglets ---------------- */
    { onglets: ['plateau', 'tuiles'], groupe: 'clavier', geste: 'Ctrl+Z',
      court: 'Annuler', picto: ['Ctrl','+','Z'],
      effet: 'Annuler la dernière action.',
      source: AP, preuve: "k === 'z' && !ev.shiftKey" },
    { onglets: ['plateau', 'tuiles'], groupe: 'clavier', geste: 'Ctrl+Y ou Ctrl+Maj+Z',
      court: 'Rétablir', picto: ['Ctrl','+','Y'],
      effet: 'Rétablir l’action annulée.',
      source: AP, preuve: "(k === 'y' || (k === 'z' && ev.shiftKey))" },
    { onglets: ['plateau', 'tuiles'], groupe: 'clavier', geste: 'Ctrl+S',
      court: 'Enregistrer', picto: ['Ctrl','+','S'],
      effet: 'Enregistrer le travail en fichier JSON. (Ces trois raccourcis ne marchent pas dans un champ de saisie.)',
      source: AP, preuve: "k === 's') { ev.preventDefault(); enregistrer()" },
    { onglets: ['plateau', 'tuiles'], groupe: 'clavier', geste: 'Tab, puis Entrée ou Espace sur une tuile de la bibliothèque',
      court: 'Choisir (clavier)', picto: ['Tab','Entrée'],
      effet: 'La choisir pour la pose (comme un clic).',
      source: BP, preuve: 'data-action="armer"' },
    { onglets: ['plateau', 'tuiles'], groupe: 'clavier', geste: 'E sur une tuile de la bibliothèque (focus)',
      court: 'Modifier la tuile', picto: ['E'],
      effet: 'L’ouvrir dans l’éditeur.',
      source: BP, preuve: "ev.key !== 'e' && ev.key !== 'E'" },

    /* ---------------- Clavier, onglet Plateau ---------------- */
    { onglets: ['plateau'], groupe: 'clavier', geste: 'R',
      court: 'Tourner', picto: ['R'],
      effet: 'Tourner d’un quart de tour la tuile sélectionnée (ou la tuile en cours de glissement).',
      source: AS, preuve: "k === 'r' || k === 'R'" },
    { onglets: ['plateau'], groupe: 'clavier', geste: 'Suppr',
      court: 'Retirer la tuile', picto: ['Suppr'],
      effet: 'Retirer la tuile sélectionnée.',
      source: AS, preuve: "k === 'Delete'" },
    { onglets: ['plateau'], groupe: 'clavier', geste: 'Échap',
      court: 'Annuler le geste', picto: ['Échap'],
      effet: 'Annuler le glissement, sinon la pose armée, sinon la sélection.',
      source: AS, preuve: "k === 'Escape'" },
    { onglets: ['plateau'], groupe: 'clavier', geste: 'Tab, puis Entrée ou Espace sur une case ou une jonction',
      court: 'Agir comme un clic', picto: ['Tab','Entrée'],
      effet: 'Même effet qu’un clic.',
      source: AS, preuve: "(ev.key === 'Enter' || ev.key === ' ') && ev.target.closest('[data-cle]')" },

    /* ---------------- Clavier, onglet Tuiles (une tuile ouverte) ---------------- */
    { onglets: ['tuiles'], groupe: 'clavier', geste: 'A',
      court: 'Changer le type', picto: ['A'],
      effet: 'Changer le type de la case sélectionnée (déplacement / apparition).',
      source: ED, preuve: "k === 'a' || k === 'A'" },
    { onglets: ['tuiles'], groupe: 'clavier', geste: 'Flèches',
      court: 'Déplacer la case', picto: ['←','↑','→','↓'],
      effet: 'Déplacer d’un pas la case sélectionnée.',
      source: ED, preuve: "k.indexOf('Arrow') === 0" },
    { onglets: ['tuiles'], groupe: 'clavier', geste: 'P',
      court: 'Outil Chemin / Passage', picto: ['P'],
      effet: 'Basculer l’outil de tracé entre Chemin (droit) et Passage (courbe sans case).',
      source: ED, preuve: "k === 'p' || k === 'P'" },
    { onglets: ['tuiles'], groupe: 'clavier', geste: 'Suppr',
      court: 'Supprimer l’élément', picto: ['Suppr'],
      effet: 'Supprimer l’élément sélectionné (une case emporte ses chemins et passages ; un pivot, ses passages ; sur un raccord ou un coin : ce qui y aboutit).',
      source: ED, preuve: "k === 'Delete'" },
    { onglets: ['tuiles'], groupe: 'clavier', geste: 'Échap',
      court: 'Désélectionner', picto: ['Échap'],
      effet: 'Annuler le geste ou le chemin en cours, sinon désélectionner.',
      source: ED, preuve: "k === 'Escape'" },
    { onglets: ['tuiles'], groupe: 'clavier', geste: 'Ctrl+D',
      court: 'Dupliquer la tuile', picto: ['Ctrl','+','D'],
      effet: 'Dupliquer la tuile ouverte.',
      source: ED, preuve: "(k === 'd' || k === 'D')" }
  ];

  /**
   * Lignes à afficher pour un onglet (pure) : { souris: [...], clavier: [...] }, dans l'ordre de COMMANDES.
   * Un onglet inconnu donne deux listes vides.
   */
  function lignesAide(onglet) {
    var res = { souris: [], clavier: [] };
    COMMANDES.forEach(function (c) {
      if (c.onglets.indexOf(onglet) >= 0) res[c.groupe].push(c);
    });
    return res;
  }

  /** Lit l'état mémorisé : true (ouvert), false (replié) ou null (rien de mémorisé ou stockage indisponible). */
  function lireEtat() {
    try {
      var v = window.localStorage.getItem(CLE_STOCKAGE);
      return v === 'ouvert' ? true : v === 'ferme' ? false : null;
    } catch (e) { return null; }
  }
  function ecrireEtat(ouvert) {
    try { window.localStorage.setItem(CLE_STOCKAGE, ouvert ? 'ouvert' : 'ferme'); } catch (e) { /* stockage indisponible : pas de mémoire */ }
  }

  var NS = 'http://www.w3.org/2000/svg';

  /** Souris en SVG : le bouton concerné ('g' gauche, 'd' droit) est coloré. */
  function souris(bouton) {
    function n(tag, attrs) {
      var e = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      return e;
    }
    var svg = n('svg', { viewBox: '0 0 24 32', width: '20', height: '27', 'class': 'pm-aide-souris', focusable: 'false' });
    svg.appendChild(n('rect', { x: '2', y: '2', width: '20', height: '28', rx: '10', fill: '#fff', stroke: '#555', 'stroke-width': '2' }));
    svg.appendChild(n('path', { d: 'M12 3 V15 H3 V12 A9 9 0 0 1 12 3 Z', fill: bouton === 'g' ? '#007A4D' : '#e3e5e0' }));
    svg.appendChild(n('path', { d: 'M12 3 V15 H21 V12 A9 9 0 0 0 12 3 Z', fill: bouton === 'd' ? '#c46a00' : '#e3e5e0' }));
    svg.appendChild(n('path', { d: 'M2.5 15 H21.5 M12 3 V15', fill: 'none', stroke: '#555', 'stroke-width': '1.5' }));
    return svg;
  }

  /** Un élément de pictogramme : 'sg' / 'sd' (souris), 'x2' (double-clic), '->' (glisser), '+' (séparateur), sinon une touche. */
  function pictogramme(t) {
    var e;
    if (t === 'sg' || t === 'sd') return souris(t === 'sg' ? 'g' : 'd');
    if (t === 'x2') { e = document.createElement('span'); e.className = 'pm-aide-badge'; e.textContent = '×2'; return e; }
    if (t === '->') { e = document.createElement('span'); e.className = 'pm-aide-fleche'; e.textContent = '➜'; return e; }
    if (t === '+') { e = document.createElement('span'); e.className = 'pm-aide-plus'; e.textContent = '+'; return e; }
    e = document.createElement('kbd');
    e.textContent = t;
    return e;
  }

  /** Monte le bloc dans `conteneur`. Seule la liste est redessinée au changement d'onglet (le <details> garde son état). */
  function monter(conteneur, etat) {
    conteneur.classList.add('pm-aide');
    conteneur.innerHTML = '';
    function el(tag, classe, texte) {
      var e = document.createElement(tag);
      if (classe) e.className = classe;
      if (texte !== undefined) e.textContent = texte;
      return e;
    }
    var details = el('details', 'pm-aide-bloc');
    var memo = lireEtat();
    // Sans état mémorisé : ouvert, sauf sur écran étroit où la colonne est courte
    var etroit = !!(window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
    details.open = memo === null ? !etroit : memo;
    var resume = el('summary', 'pm-aide-titre');
    resume.appendChild(el('span', 'pm-aide-titre-texte', 'Commandes'));
    var rappel = el('span', 'pm-aide-onglet');
    resume.appendChild(rappel);
    details.appendChild(resume);
    var corps = el('div', 'pm-aide-corps');
    details.appendChild(corps);
    conteneur.appendChild(details);
    details.addEventListener('toggle', function () { ecrireEtat(details.open); });

    var affiche = null;
    function dessiner() {
      var onglet = etat.ui().onglet;
      if (onglet === affiche) return;
      affiche = onglet;
      var lignes = lignesAide(onglet);
      rappel.textContent = ' · onglet ' + (TITRES_ONGLET[onglet] || onglet);
      corps.innerHTML = '';
      corps.setAttribute('data-onglet', onglet);
      ['souris', 'clavier'].forEach(function (g) {
        if (!lignes[g].length) return;
        var section = el('section', 'pm-aide-groupe');
        section.setAttribute('data-groupe', g);
        section.appendChild(el('h3', 'pm-aide-groupe-titre', TITRES_GROUPE[g]));
        var ul = el('ul', 'pm-aide-liste');
        lignes[g].forEach(function (c) {
          var li = el('li', 'pm-aide-ligne');
          li.title = c.geste + ' : ' + c.effet; // détail au survol
          var pic = el('span', 'pm-aide-picto');
          pic.setAttribute('aria-hidden', 'true');
          c.picto.forEach(function (t) { pic.appendChild(pictogramme(t)); });
          li.appendChild(pic);
          li.appendChild(el('span', 'pm-aide-court', c.court));
          ul.appendChild(li);
        });
        section.appendChild(ul);
        corps.appendChild(section);
      });
    }
    etat.abonner(dessiner);
    dessiner();
  }

  PM.aide = {
    CLE_STOCKAGE: CLE_STOCKAGE,
    ONGLETS: ONGLETS,
    COMMANDES: COMMANDES,
    lignesAide: lignesAide,
    monter: monter
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.aide;
})();
