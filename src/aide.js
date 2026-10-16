/*
 * aide.js : bloc « Commandes » (légende des gestes à la souris et des raccourcis clavier), en bas de la colonne de gauche.
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
      effet: 'La choisir ; un clic sur une case éclairée la pose. Nouveau clic sur la même tuile : annule.',
      source: BP, preuve: "etat.majUi({ aPoser: id, onglet: 'plateau' })" },
    { onglets: ['plateau'], groupe: 'souris', geste: 'Clic sur une case éclairée',
      effet: 'Pose la tuile choisie (rotation suggérée pour un bord ou un coin).',
      source: AS, preuve: 'poserIci(ui.aPoser, col, lig, null)' },
    { onglets: ['plateau'], groupe: 'souris', geste: 'Glisser une tuile de la bibliothèque',
      effet: 'La poser directement sur une case du plateau (R pendant le glissement la tourne).',
      source: BP, preuve: 'PM.assemblage.demarrerGlissement(id, ev)' },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Clic sur une tuile de la bibliothèque',
      effet: 'Revient au Plateau et la choisit pour la pose (pour l’éditer : double-clic).',
      source: BP, preuve: "etat.majUi({ aPoser: id, onglet: 'plateau' })" },
    { onglets: ['plateau', 'tuiles'], groupe: 'souris', geste: 'Double-clic sur une tuile de la bibliothèque',
      effet: 'L’ouvrir dans l’éditeur (onglet Tuiles).',
      source: BP, preuve: "liste.addEventListener('dblclick'" },
    { onglets: ['plateau'], groupe: 'souris', geste: 'Clic sur une tuile posée',
      effet: 'La sélectionner ; un second clic sur la tuile sélectionnée la tourne d’un quart de tour.',
      source: AS, preuve: 'if (selection && selection.col === col && selection.lig === lig) { pivoterSelection(); return; }' },
    { onglets: ['plateau'], groupe: 'souris', geste: 'Glisser une tuile posée',
      effet: 'La déplacer vers une autre case compatible (sa rotation est conservée).',
      source: AS, preuve: 'if (g.de) deplacerIci(g.de, c);' },
    { onglets: ['plateau'], groupe: 'souris', geste: 'Clic droit sur une tuile posée',
      effet: 'La retirer (annulable).',
      source: AS, preuve: "scene.addEventListener('contextmenu'" },
    { onglets: ['plateau'], groupe: 'souris', geste: 'Clic sur une jonction',
      effet: 'Poser une ville ; un clic sur une ville la retire (la jonction redevient une case chemin).',
      source: AS, preuve: 'cyclerIci(pj[0], pj[1])' },
    { onglets: ['plateau'], groupe: 'souris', geste: 'Clic sur une alerte du panneau de droite',
      effet: 'La montrer sur le plateau (clignote jusqu’au clic suivant).',
      source: CO, preuve: "etat.majUi({ surbrillance: Object.assign({}, e.cible), onglet: 'plateau' })" },
    { onglets: ['plateau', 'tuiles'], groupe: 'souris', geste: '✕ sur une tuile utilisateur',
      effet: 'La supprimer de la bibliothèque, après confirmation (annulable). Absent sur les tuiles du catalogue.',
      source: BP, preuve: 'data-action="supprimer"' },

    /* ---------------- Souris, onglet Tuiles (éditeur) ---------------- */
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Boutons Centrale, Bord, Coin, Dupliquer, Supprimer cette tuile',
      effet: 'Créer une tuile (Nouveau), copier la tuile ouverte, ou supprimer une tuile utilisateur (confirmation).',
      source: ED, preuve: "'Supprimer cette tuile'" },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Clic sur le fond du canevas',
      effet: 'Ajouter une case à cet endroit.',
      source: ED, preuve: "'Ajouter une case'" },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Clic sur une case, un raccord ou un coin',
      effet: 'Le sélectionner et commencer un chemin ; un clic sur une autre extrémité trace le chemin (Échap annule).',
      source: ED, preuve: 'tracer(arme, ext)' },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Glisser une case',
      effet: 'La déplacer (aimantée à la grille) ; la lâcher sur une autre case, un raccord ou un coin trace un chemin.',
      source: ED, preuve: "tracer({ 'case': d.id }, ext)" },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Glisser depuis un raccord ou un coin',
      effet: 'Tracer un chemin vers la case sur laquelle on relâche.',
      source: ED, preuve: "tracer({ 'case': cible2.id }, extremiteDeCible(d))" },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Clic droit sur une case',
      effet: 'Changer son type (déplacement / apparition).',
      source: ED, preuve: "svg.addEventListener('contextmenu'" },
    { onglets: ['tuiles'], groupe: 'souris', geste: 'Clic sur une erreur ou une alerte de la liste Validation',
      effet: 'Entourer l’élément concerné sur le canevas.',
      source: ED, preuve: 'haloLocal = e.ref || null' },

    /* ---------------- Clavier, deux onglets ---------------- */
    { onglets: ['plateau', 'tuiles'], groupe: 'clavier', geste: 'Ctrl+Z',
      effet: 'Annuler la dernière action.',
      source: AP, preuve: "k === 'z' && !ev.shiftKey" },
    { onglets: ['plateau', 'tuiles'], groupe: 'clavier', geste: 'Ctrl+Y ou Ctrl+Maj+Z',
      effet: 'Rétablir l’action annulée.',
      source: AP, preuve: "(k === 'y' || (k === 'z' && ev.shiftKey))" },
    { onglets: ['plateau', 'tuiles'], groupe: 'clavier', geste: 'Ctrl+S',
      effet: 'Enregistrer le travail en fichier JSON. (Ces trois raccourcis ne marchent pas dans un champ de saisie.)',
      source: AP, preuve: "k === 's') { ev.preventDefault(); enregistrer()" },
    { onglets: ['plateau', 'tuiles'], groupe: 'clavier', geste: 'Tab, puis Entrée ou Espace sur une tuile de la bibliothèque',
      effet: 'La choisir pour la pose (comme un clic).',
      source: BP, preuve: 'data-action="armer"' },
    { onglets: ['plateau', 'tuiles'], groupe: 'clavier', geste: 'E sur une tuile de la bibliothèque (focus)',
      effet: 'L’ouvrir dans l’éditeur.',
      source: BP, preuve: "ev.key !== 'e' && ev.key !== 'E'" },

    /* ---------------- Clavier, onglet Plateau ---------------- */
    { onglets: ['plateau'], groupe: 'clavier', geste: 'R',
      effet: 'Tourner d’un quart de tour la tuile sélectionnée (ou la tuile en cours de glissement).',
      source: AS, preuve: "k === 'r' || k === 'R'" },
    { onglets: ['plateau'], groupe: 'clavier', geste: 'Suppr',
      effet: 'Retirer la tuile sélectionnée.',
      source: AS, preuve: "k === 'Delete'" },
    { onglets: ['plateau'], groupe: 'clavier', geste: 'Échap',
      effet: 'Annuler le glissement, sinon la pose armée, sinon la sélection.',
      source: AS, preuve: "k === 'Escape'" },
    { onglets: ['plateau'], groupe: 'clavier', geste: 'Tab, puis Entrée ou Espace sur une case ou une jonction',
      effet: 'Même effet qu’un clic.',
      source: AS, preuve: "(ev.key === 'Enter' || ev.key === ' ') && ev.target.closest('[data-cle]')" },

    /* ---------------- Clavier, onglet Tuiles (une tuile ouverte) ---------------- */
    { onglets: ['tuiles'], groupe: 'clavier', geste: 'A',
      effet: 'Changer le type de la case sélectionnée (déplacement / apparition).',
      source: ED, preuve: "k === 'a' || k === 'A'" },
    { onglets: ['tuiles'], groupe: 'clavier', geste: 'Flèches',
      effet: 'Déplacer d’un pas la case sélectionnée.',
      source: ED, preuve: "k.indexOf('Arrow') === 0" },
    { onglets: ['tuiles'], groupe: 'clavier', geste: 'Suppr',
      effet: 'Supprimer l’élément sélectionné (une case emporte ses chemins ; sur un raccord ou un coin : les chemins qui y aboutissent).',
      source: ED, preuve: "k === 'Delete'" },
    { onglets: ['tuiles'], groupe: 'clavier', geste: 'Échap',
      effet: 'Annuler le geste ou le chemin en cours, sinon désélectionner.',
      source: ED, preuve: "k === 'Escape'" },
    { onglets: ['tuiles'], groupe: 'clavier', geste: 'Ctrl+D',
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
        var dl = el('dl', 'pm-aide-liste');
        lignes[g].forEach(function (c) {
          dl.appendChild(el('dt', 'pm-aide-geste', c.geste));
          dl.appendChild(el('dd', 'pm-aide-effet', c.effet));
        });
        section.appendChild(dl);
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
