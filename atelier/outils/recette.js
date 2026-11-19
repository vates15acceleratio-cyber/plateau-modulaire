/*
 * recette.js : recette automatique de l'atelier dans un vrai navigateur (outils/recette.html).
 * Charge l'atelier tel quel (même CSP), exerce les parcours principaux par de vrais événements
 * (clics, touches, survols) et écrit une dernière ligne « TOTAL : N OK, M ÉCHEC ».
 * Une erreur JavaScript ou une violation de la politique de sécurité compte comme un échec.
 * Rien n'est écrit sur le disque : les téléchargements sont interceptés.
 *
 * Paramètres d'adresse :
 *   recette.html#arret=plateau|inventaire|partie laisse cet onglet affiché à la fin et masque le rapport
 *   (pour une capture d'écran d'un état « en cours d'usage ») ;
 *   recette.html#arret=creation|pinceau|villes|monoblocs|bibliotheque : idem pour la création à la main et l'étape « Villes » ;
 *   recette.html#persistance=ecrire puis #persistance=lire, sur le même dossier de profil : seul cas où le vrai
 *   stockage du navigateur est utilisé (la recette normale travaille sur un stockage en mémoire) ;
 *   recette.html#persistance=ecrire-villes puis #persistance=lire-villes : idem, avec un plateau du catalogue 2 dont
 *   les villes ont été posées à 3 rangées (fiche de la bibliothèque et travail en cours).
 */
(function () {
  'use strict';

  var ok = 0, echecs = 0, lignes = [], erreursJs = [], violations = [], telecharges = [], durees = [];

  window.addEventListener('error', function (ev) { erreursJs.push((ev.message || 'erreur') + ' (' + String(ev.filename || '').split('/').pop() + ':' + ev.lineno + ')'); });
  window.addEventListener('unhandledrejection', function (ev) { erreursJs.push('promesse rejetée : ' + (ev.reason && ev.reason.message || ev.reason)); });
  document.addEventListener('securitypolicyviolation', function (ev) { violations.push(ev.violatedDirective + ' ' + (ev.blockedURI || '') + ' ' + String(ev.sourceFile || '').split('/').pop() + ':' + ev.lineNumber); });

  // Stockage : la recette ne touche JAMAIS à la bibliothèque du poste. Un stockage en mémoire (dont les écritures
  // sont comptées) est donné à l'atelier avant son démarrage : cet écouteur est posé avant celui de src/app.js.
  // Seule exception : recette.html#persistance=ecrire|lire, qui vérifie le vrai stockage du navigateur (à lancer
  // sur un dossier de profil temporaire).
  var persistance = /persistance=(ecrire-villes|lire-villes|ecrire|lire)/.exec(window.location.hash);
  var ecritures = [], stockageRecette = null;
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.AT || !AT.app || !AT.bibliotheque || persistance) return;
    var memoire = AT.bibliotheque.stockageMemoire();
    stockageRecette = {
      getItem: memoire.getItem,
      setItem: function (k, v) { memoire.setItem(k, v); ecritures.push(String(k)); },
      removeItem: memoire.removeItem
    };
    AT.app.stockage = stockageRecette;
  });

  function verifier(nom, condition, detail) {
    if (condition) { ok += 1; lignes.push('OK    ' + nom); } else { echecs += 1; lignes.push('ÉCHEC ' + nom + (detail !== undefined ? ' → ' + detail : '')); }
  }

  function $(selecteur, racine) { return (racine || document).querySelector(selecteur); }
  function $$(selecteur, racine) { return Array.prototype.slice.call((racine || document).querySelectorAll(selecteur)); }
  function clic(element) { if (!element) throw new Error('élément à cliquer introuvable'); element.click(); }
  function attendre(ms) { return new Promise(function (resoudre) { setTimeout(resoudre, ms); }); }

  function clicCase(vue, cle) {
    var p = vue.pointEcran(cle);
    vue.svg.dispatchEvent(new MouseEvent('click', { clientX: p.x, clientY: p.y, bubbles: true, cancelable: true }));
  }
  function survolCase(vue, cle) {
    var p = vue.pointEcran(cle);
    vue.svg.dispatchEvent(new PointerEvent('pointermove', { clientX: p.x, clientY: p.y, bubbles: true }));
  }
  function touche(cle, options, cible) {
    var o = { key: cle, bubbles: true, cancelable: true };
    Object.keys(options || {}).forEach(function (k) { o[k] = options[k]; });
    (cible || document.body).dispatchEvent(new KeyboardEvent('keydown', o));
  }
  function choisir(select, valeur) { select.value = String(valeur); select.dispatchEvent(new Event('change', { bubbles: true })); }
  function marques(vue, classe) { return $$('.at-interface .' + classe, vue.svg).length; }
  function etatBarre() { return $('#barre-etat').className; }
  /** Vide le texte de la barre d'état, pour vérifier que le geste suivant y écrit bien son propre message. */
  function ctxMessageEfface() { $('#barre-etat').textContent = ''; }

  var scenarios = [];
  function scenario(nom, f) { scenarios.push({ nom: nom, f: f }); }

  // ================================================================== A. démarrage
  scenario('Démarrage', function () {
    var vp = AT.app.vues.plateau;
    verifier('trois onglets', $$('[role="tab"]').length === 3);
    verifier('onglet Plateau affiché', AT.app.ongletActif() === 'plateau' && !$('#panneau-plateau').hidden && $('#panneau-partie').hidden);
    verifier('plateau généré au démarrage : 26 pièces (24 de terrain, 2 villes neutres)', vp.plateau().pieces.length === 26, vp.plateau().pieces.length);
    verifier('plateau généré au démarrage : 4 villes de déploiement posées par-dessus une Plaine, étape « complet »', AT.plateau.deploiements(vp.plateau()).length === 4 && vp.bilan().etape === 'complet'
      && /Plateau complet/.test($('#pl-etape').textContent), $('#pl-etape') && $('#pl-etape').textContent);
    verifier('93 cases dessinées (91 de terrain, 2 villes neutres)', $$('svg > g:first-of-type > g:first-child > polygon', vp.vue.parentSvg || vp.vue.svg.parentNode).length === 93, $$('svg > g:first-of-type > g:first-child > polygon', vp.vue.parentSvg || vp.vue.svg.parentNode).length);
    verifier('12 motifs de terrain définis', $$('pattern', vp.vue.svg).length === 12, $$('pattern', vp.vue.svg).length);
    verifier('aucune erreur aux contrôles', vp.bilan().erreurs === 0 && /aucune erreur/i.test($('#pl-bilan').textContent), $('#pl-bilan').textContent);
    verifier('les 7 contrôles sont listés', $$('#pl-controles .at-regle').length === 7);
    verifier('seuil et mesure de contact initialisés depuis les réglages du catalogue', $('#pl-seuil').value === String(AT.catalogue.REGLAGES.seuilContact) && $('#pl-mesure').value === AT.catalogue.REGLAGES.mesureContact
      && vp.reglages().seuilContact === AT.catalogue.REGLAGES.seuilContact && vp.reglages().mesureContact === AT.catalogue.REGLAGES.mesureContact, $('#pl-seuil').value + ' / ' + $('#pl-mesure').value);
    verifier('au moins un constat par contrôle', $$('#pl-controles .at-constat').length >= 7);
    verifier('tableau d’équilibre : 7 villes', $$('#pl-equilibre tbody tr').length === 7);
    verifier('score d’équilibre affiché (sans symétrie : centre, villes neutres, villes adverses)', /Score d’équilibre : \d+ \(0 = équilibré\)/.test($('#pl-score').textContent) && /villes de déploiement adverses/.test($('#pl-score').textContent), $('#pl-score').textContent);
    verifier('répartition des terrains : 3 lignes', $$('#pl-terrains tbody tr').length === 3);
    verifier('légende : 5 terrains, 8 événements, 6 repères (2 villes de déploiement, ville neutre, remplissage, monobloc, noyau)', $$('#pl-legende .at-legende-item').length === 19 && $$('#pl-legende svg').length === 17, $$('#pl-legende .at-legende-item').length);
    verifier('7 villes numérotées sur le plateau', [1, 2, 3, 4, 5, 6, 7].every(function (n) {
      return $$('text', vp.vue.svg).some(function (t) { return t.textContent === String(n); });
    }));
    verifier('villes de déploiement aux couleurs des camps', $$('circle[fill="#007A4D"]', vp.vue.svg).length === 2 && $$('circle[fill="#D8321C"]', vp.vue.svg).length === 2);
    verifier('contours épais : 23 monoblocs et le noyau', $$('path[stroke-width="4"]', vp.vue.svg).length === 23 && $$('path[stroke-width="6"]', vp.vue.svg).length === 1,
      $$('path[stroke-width="4"]', vp.vue.svg).length + ' / ' + $$('path[stroke-width="6"]', vp.vue.svg).length);
  });

  // ================================================================== B. générer
  scenario('Générer', function () {
    var vp = AT.app.vues.plateau;
    $('#pl-graine').value = '7';
    clic($('#pl-generer'));
    verifier('graine « 7 » saisie = graine 7 (entier)', vp.plateau().graine === 7, typeof vp.plateau().graine);
    verifier('même graine = même plateau que le générateur', JSON.stringify(vp.plateau()) === JSON.stringify(AT.plateau.avecCamps(AT.generateur.generer(7).plateau)));
    clic($('#pl-suivante'));
    verifier('graine suivante : 8', vp.plateau().graine === 8 && $('#pl-graine').value === '8');
    choisir($('#pl-seuil'), 2);
    clic($('#pl-generer'));
    verifier('seuil de contact 2 : plateau généré sans erreur', vp.reglages().seuilContact === 2 && vp.bilan().erreurs === 0);
    verifier('le contrôle de contact annonce le seuil 2', /seuil 2/.test($('#pl-controles').textContent));
    choisir($('#pl-mesure'), 'pieces');
    verifier('mesure « pièces » retenue dans les contrôles', /pièces » \(retenue\)/.test($('#pl-controles').textContent));
    choisir($('#pl-mesure'), 'cotes');
    verifier('mesure « côtés » retenue dans les contrôles quand on la choisit', /côtés » \(retenue\)/.test($('#pl-controles').textContent) && vp.reglages().mesureContact === 'cotes');
    choisir($('#pl-seuil'), 3);
    // Retour au réglage livré : toute la suite de la recette tourne sous la mesure par défaut du catalogue.
    choisir($('#pl-mesure'), AT.catalogue.REGLAGES.mesureContact);
    // Échec de génération simulé : le message doit être clair et le plateau inchangé.
    var vrai = AT.generateur.generer, avant = JSON.stringify(vp.plateau());
    AT.generateur.generer = function () { return { ok: false, plateau: null, raison: 'Aucun plateau valide en 72 essais.' }; };
    try { clic($('#pl-generer')); } finally { AT.generateur.generer = vrai; }
    verifier('échec de génération : message visible', !$('#pl-avis').hidden && /Échec de la génération/.test($('#pl-avis').textContent) && /72 essais/.test($('#pl-avis').textContent));
    verifier('échec de génération : plateau inchangé', JSON.stringify(vp.plateau()) === avant);
    $('#pl-graine').value = '1';
    clic($('#pl-generer'));
    verifier('nouvelle génération : le message d’échec disparaît', $('#pl-avis').hidden && vp.plateau().graine === 1);
  });

  // ================================================================== C. retouche à la main
  scenario('Retouche', function () {
    var vp = AT.app.vues.plateau, P = AT.plateau, vue = vp.vue;
    var plaine = vp.plateau().pieces.filter(function (p) { return p.modele === 'VN'; })[0];
    var cle = AT.hex.cle(plaine.q, plaine.r);
    // Une case vide au-dessus du plateau : une ville neutre y est mal placée (erreur du contrôle des villes).
    var terrainRetouche = P.cases(vp.plateau(), { sansVilles: true }), etendueRetouche = P.etendueSurCases(terrainRetouche);
    var sommet = AT.hex.decle(Object.keys(terrainRetouche).filter(function (k) { return AT.hex.decle(k).r === etendueRetouche.haut; })[0]);
    var mauvaise = AT.hex.cle(sommet.q, sommet.r - 1);
    // Une ville neutre ne se déplace que par l'étape « Villes » : on la retire d'un clic, puis on la repose (en pose
    // libre, pour pouvoir la mettre à une mauvaise place). Deux étapes d'annulation.
    function deplacerVilleNeutre(depuis, vers) {
      clic($('#pl-mode-villes'));
      clicCase(vue, depuis);
      clic($('#vi-outil-neutre'));
      if (!$('#vi-libre').checked) clic($('#vi-libre'));
      clicCase(vue, vers);
      clic($('#vi-libre'));
      clic($('#pl-mode-generer'));
    }
    clicCase(vue, cle);
    verifier('clic sur une case : la pièce est sélectionnée', vp.etat().selection === plaine.id && marques(vue, 'at-selection') === 1, vp.etat().selection);
    // Correction 2 : une ville neutre posée ne se retire, ne se tourne et ne se déplace que par l'étape « Villes ».
    var rangVille = vp.etat().rang, refusVille = /Une ville neutre ne se déplace, ne se tourne et ne se retire qu’à l’étape « Villes »/;
    clic($('#pl-retirer'));
    verifier('ville neutre sélectionnée, « Retirer » : refusé, message qui renvoie à l’étape « Villes »', vp.plateau().pieces.length === 26 && vp.etat().rang === rangVille && refusVille.test($('#barre-etat').textContent)
      && /at-etat-erreur/.test(etatBarre()), $('#barre-etat').textContent);
    ctxMessageEfface();
    touche('Delete');
    verifier('ville neutre sélectionnée, touche Suppr : refusé de même', vp.plateau().pieces.length === 26 && vp.etat().rang === rangVille && refusVille.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    ctxMessageEfface();
    touche('r');
    verifier('ville neutre sélectionnée, touche R (tourner) : refusé de même', vp.etat().rang === rangVille && refusVille.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    ctxMessageEfface();
    clic($('#pl-deplacer'));
    verifier('ville neutre sélectionnée, « Déplacer » : refusé, aucun déplacement en attente', vp.etat().rang === rangVille && vp.etat().aPoser === null && refusVille.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    touche('Escape');
    clic($('#pl-mode-villes'));
    clicCase(vue, cle);
    verifier('retirer (étape « Villes », clic sur la ville neutre) : 25 pièces', vp.plateau().pieces.length === 25 && vp.etat().rang === rangVille + 1 && /Ville neutre retirée/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    verifier('retirer : la ville neutre revient au stock (compteur de l’étape « Villes » : 1 / 2)', $('#vi-outils [data-compteur="neutre"]').textContent === '1 / 2' && !$('#pl-stock [data-modele="VN"]'), $('#vi-outils').textContent);
    verifier('retirer : les contrôles signalent le changement en direct (ville à poser : alerte, pas erreur)', /villes à poser : 1 ville neutre/.test($('#pl-controles').textContent) && vp.bilan().alertes > 0
      && vp.bilan().erreurs === 0 && vp.bilan().etape === 'villes', $('#pl-bilan').textContent);
    // La ville neutre se repose par l'étape « Villes » (elle n'est plus dans la palette).
    clic($('#pl-mode-villes'));
    clic($('#vi-outil-neutre'));
    var placesNeutres = AT.vueVilles.places(vp.plateau(), 'neutre');
    verifier('étape « Villes », outil « ville neutre » : les places admissibles sont en surbrillance', $('#vi-outil-neutre').getAttribute('aria-pressed') === 'true' && placesNeutres.indexOf(cle) !== -1
      && marques(vue, 'at-admissible') === placesNeutres.length, marques(vue, 'at-admissible') + ' / ' + placesNeutres.length);
    clicCase(vue, '1,0');
    verifier('pose refusée sur une case occupée, avec la raison du modèle', vp.plateau().pieces.length === 25 && /at-etat-erreur/.test(etatBarre()) && /Pose refusée : .*déjà occupée/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    clicCase(vue, cle);
    verifier('pose : 26 pièces, plateau de nouveau complet', vp.plateau().pieces.length === 26 && vp.bilan().erreurs === 0 && vp.bilan().etape === 'complet');
    clic($('#pl-mode-generer'));
    touche('z', { ctrlKey: true });
    verifier('Ctrl+Z annule la pose', vp.plateau().pieces.length === 25);
    touche('y', { ctrlKey: true });
    verifier('Ctrl+Y la rétablit', vp.plateau().pieces.length === 26);
    clic($('#pl-annuler'));
    clic($('#pl-retablir'));
    verifier('boutons Annuler / Rétablir', vp.plateau().pieces.length === 26 && $('#pl-retablir').disabled);

    // Vider, puis reconstruire à la main : noyau, montagne tournée, déplacement.
    clic($('#pl-vider'));
    verifier('vider le plateau : 0 pièce, 25 modèles au stock (les villes ne sont pas dans la palette)', vp.plateau().pieces.length === 0 && $$('#pl-stock [data-modele]:not([disabled])').length === 25, $$('#pl-stock [data-modele]:not([disabled])').length);
    clic($('#pl-stock [data-modele="N1"]'));
    survolCase(vue, '0,0');
    verifier('fantôme du noyau : 7 cases', marques(vue, 'at-fantome') === 7);
    clicCase(vue, '0,0');
    verifier('noyau posé (7 cases) et épuisé dans la palette', Object.keys(P.cases(vp.plateau())).length === 7 && $('#pl-stock [data-modele="N1"]').disabled && /Noyau × 0/.test($('#pl-stock [data-modele="N1"]').textContent));
    clic($('#pl-stock [data-modele="M4"]'));
    touche('r');
    verifier('touche R : la pièce à poser tourne', vp.etat().aPoser.rotation === 1);
    clic($('#pl-tourner'));
    verifier('bouton Tourner : idem', vp.etat().aPoser.rotation === 2);
    clicCase(vue, '3,0');
    var montagne = vp.plateau().pieces.filter(function (p) { return p.modele === 'M4'; })[0];
    verifier('montagne posée tournée de 2 sixièmes', !!montagne && montagne.rotation === 2 && montagne.q === 3);
    clicCase(vue, '3,0');
    verifier('sélection de la montagne', vp.etat().selection === montagne.id && marques(vue, 'at-selection') === 4);
    touche('r');
    var tournee = vp.plateau().pieces.filter(function (p) { return p.modele === 'M4'; })[0];
    verifier('touche R : la pièce sélectionnée tourne (ou refus expliqué)', tournee.rotation === 3 || /at-etat-erreur/.test(etatBarre()), tournee.rotation);
    clic($('#pl-deplacer'));
    survolCase(vue, '-4,0');
    verifier('déplacement : fantôme de 4 cases', marques(vue, 'at-fantome') === 4);
    clicCase(vue, '-4,0');
    var deplacee = vp.plateau().pieces.filter(function (p) { return p.modele === 'M4'; })[0];
    verifier('pièce déplacée, sélection conservée', deplacee.q === -4 && deplacee.r === 0 && vp.etat().selection === deplacee.id && vp.plateau().pieces.length === 2);
    touche('Delete');
    verifier('touche Suppr : la pièce sélectionnée est retirée', vp.plateau().pieces.length === 1);
    touche('Escape');

    // Retour à un plateau complet ; tuile d'événement à l'essai ; surbrillance des constats.
    $('#pl-graine').value = '1';
    clic($('#pl-generer'));
    clic($('#pl-stock [data-evenement="E2"]'));
    var admissibles = AT.vuePlateau.casesAdmissibles(vp.plateau(), 'E2');
    verifier('événement à l’essai : cases admissibles en surbrillance', marques(vue, 'at-admissible') === admissibles.length && admissibles.length > 0, marques(vue, 'at-admissible'));
    clicCase(vue, '0,0');
    verifier('événement refusé sur le noyau, avec explication', vp.plateau().recouvrements.length === 0 && /at-etat-erreur/.test(etatBarre()));
    clicCase(vue, admissibles[0]);
    verifier('événement posé', vp.plateau().recouvrements.length === 1 && vp.plateau().recouvrements[0].cle === admissibles[0]);
    verifier('contrôle 7 mis à jour', /1 tuile d’événement|coupent le plateau/.test($('#pl-controles').textContent));
    verifier('tuile d’événement dessinée (cadre en tirets et identifiant)', $$('polygon[stroke-dasharray="6 4"]', vue.svg).length === 1 && $$('text', vue.svg).some(function (t) { return t.textContent === 'E2'; }));
    clicCase(vue, admissibles[0]);
    clic($('#pl-retirer-evenement'));
    verifier('événement retiré', vp.plateau().recouvrements.length === 0);
    touche('Escape');

    // Une erreur épinglée puis corrigée ne laisse pas de surbrillance orpheline.
    deplacerVilleNeutre(cle, mauvaise);
    clic($$('#pl-controles button.at-constat[data-niveau="erreur"]')[0]);
    var epinglees = marques(vue, 'at-surbrillance');
    deplacerVilleNeutre(mauvaise, cle);
    verifier('surbrillance épinglée effacée dès que le plateau change', epinglees > 0 && marques(vue, 'at-surbrillance') === 0, epinglees);
    touche('Escape');
    $('#pl-graine').value = '1';
    clic($('#pl-generer'));

    deplacerVilleNeutre(cle, mauvaise);
    var constat = $$('#pl-controles button.at-constat[data-niveau="erreur"]')[0];
    verifier('ville neutre déplacée au-dessus du plateau : erreur « mal placée » avec case à montrer', !!constat && vp.bilan().erreurs > 0 && /Ville neutre en .* mal placée/.test(constat.textContent), constat && constat.textContent);
    constat.dispatchEvent(new MouseEvent('mouseenter'));
    var surlignees = marques(vue, 'at-surbrillance');
    constat.dispatchEvent(new MouseEvent('mouseleave'));
    verifier('survol d’un constat : cases en surbrillance, puis effacées', surlignees > 0 && marques(vue, 'at-surbrillance') === 0, surlignees);
    clic(constat);
    verifier('clic sur un constat : surbrillance épinglée', marques(vue, 'at-surbrillance') === surlignees && !!$('#pl-controles button.at-constat[aria-pressed="true"]'));
    clic($('#pl-annuler'));
    clic($('#pl-annuler'));
    verifier('annuler (la pose, puis le retrait de la ville neutre) : plateau de nouveau conforme', vp.bilan().erreurs === 0 && vp.plateau().pieces.length === 26);
    // Le cadre a suivi la ville posée au-dessus du plateau ; annuler garde la vue : on recadre avant les essais de zoom.
    clic($$('.at-vue-barre button', vp.element)[2]);

    var textes = $$('text', vue.svg).length;
    choisir($('#pl-affichage'), 'cotes');
    verifier('affichage des contacts sur chaque case', $$('text', vue.svg).length === textes + 91, $$('text', vue.svg).length - textes);
    choisir($('#pl-affichage'), 'rations-vert');
    verifier('affichage des rations depuis Vert', $$('text', vue.svg).length > textes + 70);
    choisir($('#pl-affichage'), 'rien');

    // Clavier : curseur sur le plateau.
    vue.svg.focus();
    touche('ArrowRight', {}, vue.svg);
    verifier('clavier : curseur visible sur le plateau', marques(vue, 'at-curseur') === 1 && vue.curseur() === '1,0');
    touche('Enter', {}, vue.svg);
    verifier('clavier : Entrée sélectionne la pièce sous le curseur', vp.etat().selection !== null && marques(vue, 'at-selection') === 7);
    var rangAvant = vp.etat().rang;
    touche('r', {}, $('#pl-graine'));
    touche('z', { ctrlKey: true }, $('#pl-graine'));
    verifier('raccourcis R et Ctrl+Z ignorés pendant la saisie dans un champ', vp.etat().rang === rangAvant && vp.etat().selection !== null);
    touche('Escape');
    verifier('Échap : plus de sélection', vp.etat().selection === null && marques(vue, 'at-selection') === 0);
    var zoom = vue.svg.getAttribute('viewBox');
    // Déplacement de la vue par cliquer-glisser, puis zoom à la molette.
    var centre = vue.pointEcran('0,0'), plateauAvant = JSON.stringify(vp.plateau()), selectionAvant = vp.etat().selection;
    vue.svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: centre.x, clientY: centre.y, button: 0, pointerId: 1, bubbles: true }));
    vue.svg.dispatchEvent(new PointerEvent('pointermove', { clientX: centre.x + 60, clientY: centre.y + 30, pointerId: 1, bubbles: true }));
    vue.svg.dispatchEvent(new PointerEvent('pointerup', { clientX: centre.x + 60, clientY: centre.y + 30, pointerId: 1, bubbles: true }));
    vue.svg.dispatchEvent(new MouseEvent('click', { clientX: centre.x + 60, clientY: centre.y + 30, bubbles: true }));
    var apresGlisse = vue.pointEcran('0,0');
    verifier('cliquer-glisser déplace la vue sans agir sur les cases', Math.abs(apresGlisse.x - centre.x - 60) < 2 && Math.abs(apresGlisse.y - centre.y - 30) < 2
      && vp.etat().selection === selectionAvant && JSON.stringify(vp.plateau()) === plateauAvant, Math.round(apresGlisse.x - centre.x) + ',' + Math.round(apresGlisse.y - centre.y));
    var avantMolette = vue.svg.getAttribute('viewBox');
    vue.svg.dispatchEvent(new WheelEvent('wheel', { clientX: centre.x, clientY: centre.y, deltaY: -100, bubbles: true, cancelable: true }));
    verifier('la molette zoome', parseFloat(vue.svg.getAttribute('viewBox').split(' ')[2]) < parseFloat(avantMolette.split(' ')[2]));
    clic($$('.at-vue-barre button', vp.element)[2]);
    vue.svg.dispatchEvent(new PointerEvent('pointerdown', { clientX: centre.x, clientY: centre.y, button: 0, pointerId: 1, bubbles: true }));
    vue.svg.dispatchEvent(new PointerEvent('pointerup', { clientX: centre.x, clientY: centre.y, pointerId: 1, bubbles: true }));
    clicCase(vue, '0,0');
    verifier('après un glissement, un clic simple agit de nouveau sur la case', vp.etat().selection !== null);
    touche('Escape');
    clic($('.at-vue-barre button', vp.element));
    verifier('zoom par bouton', vue.svg.getAttribute('viewBox') !== zoom);
    clic($$('.at-vue-barre button', vp.element)[2]);
    verifier('bouton Tout voir', vue.svg.getAttribute('viewBox') === zoom);
  });

  // ================================================================== D. fichiers et images
  scenario('Fichiers', async function () {
    var vp = AT.app.vues.plateau;
    var texte = vp.texteEnregistrement(), avant = JSON.stringify(vp.plateau());
    clic($('#pl-vider'));
    verifier('ouvrir un plateau enregistré', vp.ouvrirTexte(texte) === true && JSON.stringify(vp.plateau()) === avant);
    telecharges.length = 0;
    clic($('#pl-enregistrer'));
    verifier('enregistrer : fichier JSON produit', telecharges.length === 1 && /^plateau-graine-1\.json$/.test(telecharges[0].nom) && telecharges[0].taille > 1000, telecharges.map(function (t) { return t.nom; }).join());
    verifier('fichier qui n’est pas du JSON : refusé', vp.ouvrirTexte('{ceci n’est pas du JSON') === false && /at-etat-erreur/.test(etatBarre()) && JSON.stringify(vp.plateau()) === avant);
    var piege = JSON.parse(texte);
    piege.surprise = '<img src=x onerror=alert(1)>';
    verifier('fichier avec un champ inconnu : refusé', vp.ouvrirTexte(JSON.stringify(piege)) === false && JSON.stringify(vp.plateau()) === avant);
    var hostile = JSON.parse(texte);
    hostile.graine = '<img src=x onerror=alert(1)>';
    verifier('graine contenant du HTML : affichée comme du texte', vp.ouvrirTexte(JSON.stringify(hostile)) === true && $$('img').length === 0 && /<img/.test($('#pl-info').textContent));
    vp.ouvrirTexte(texte);

    var image = vp.imageExport(), doc = new DOMParser().parseFromString(image.texte, 'image/svg+xml');
    verifier('export SVG : document valide', !doc.querySelector('parsererror') && doc.documentElement.nodeName === 'svg');
    verifier('export SVG : 93 cases, 12 motifs', doc.querySelectorAll('svg > g:first-of-type > g:first-child > polygon').length === 93 && doc.querySelectorAll('pattern').length === 12);
    verifier('export SVG : autonome (ni classe, ni style, ni élément d’interface)', !/ class=| style=|at-/.test(image.texte));
    telecharges.length = 0;
    clic($('#pl-svg'));
    verifier('export SVG : fichier produit', telecharges.length === 1 && telecharges[0].type === 'image/svg+xml' && /\.svg$/.test(telecharges[0].nom));
    telecharges.length = 0;
    var png = await Promise.race([new Promise(function (resoudre) { vp.exporterPng(resoudre); }), attendre(8000).then(function () { return 'délai dépassé'; })]);
    verifier('export PNG sous la CSP stricte', !!png && png !== 'délai dépassé' && png.type === 'image/png' && png.size > 5000, png && png.size ? png.size + ' octets' : String(png));
    verifier('export PNG : fichier produit', telecharges.length === 1 && /\.png$/.test(telecharges[0].nom));

    // 3 villes sur la rangée du haut (cas ambigu) : aucune ville de déploiement désignée pour Vert, le contrôle 4
    // le dit, et le plateau en cours de retouche reste enregistrable et relisible.
    // Ce cas est celui d'un plateau du PREMIER catalogue (villes d'une case sur les rangées extrêmes) : on ouvre un
    // fichier enregistré en version 1, ce qui vérifie au passage que les anciens fichiers s'ouvrent toujours.
    var ancienOuvert = vp.ouvrirTexte(RECETTE_ANCIEN_PLATEAU) === true;
    verifier('ancien plateau (fichier de version 1) : ouvert, 64 pièces, 91 cases dessinées, 7 villes, relu au format courant', ancienOuvert && vp.plateau().pieces.length === 64
      && doc.documentElement && $$('svg > g:first-of-type > g:first-child > polygon', vp.vue.svg.parentNode).length === 91 && AT.plateau.villes(vp.plateau()).length === 7 && vp.plateau().version === 2,
      vp.plateau().pieces.length + ' pièces, version ' + vp.plateau().version);
    verifier('ancien plateau : villes de déploiement des rangées extrêmes reconnues, aucune erreur de villes',
      vp.plateau().camps.vert.length === 2 && vp.plateau().camps.rouge.length === 2 && vp.bilan().villes.erreurs === 0 && /ancien catalogue/.test($('#pl-etape').textContent), $('#pl-etape').textContent);
    // Correction 6 : le contrôle 1 ne compte pas un ancien plateau avec l'inventaire du catalogue 2.
    var inventaireAncien = $$('#pl-controles [data-regle="inventaire"]').map(function (e) { return e.textContent; }).join(' | ');
    verifier('ancien plateau, contrôle 1 : « Plateau de l’ancien catalogue : 55 tuiles d’une case… », en « Conforme », un seul constat',
      /Conforme Plateau de l’ancien catalogue : 55 tuiles d’une case de ce catalogue \(39 × Plaine, 5 × Forêt, 5 × Marais, 6 × Ville \(ancien catalogue\)\)\. Il ne se compare pas à l’inventaire du catalogue 2\./.test(inventaireAncien)
      && $$('#pl-controles [data-regle="inventaire"]').length === 1, inventaireAncien);
    verifier('ancien plateau, contrôle 1 : ni « pièces de terrain restantes / à poser » ni « tuiles à prévoir en plus », nulle part dans les contrôles',
      !/Pièces de terrain restantes|pièces? de terrain à poser|à prévoir en plus du catalogue/.test($('#pl-controles').textContent) && vp.bilan().construction.alertes === 0, $('#pl-controles').textContent.slice(0, 400));
    var P = AT.plateau, pl = vp.plateau(), cases = P.cases(pl);
    var rangeeHaut = Math.min.apply(null, Object.keys(cases).map(function (k) { return AT.hex.decle(k).r; }));
    var haut = Object.keys(cases).filter(function (k) { return AT.hex.decle(k).r === rangeeHaut && cases[k].modele === 'P'; })[0];
    var neutre = P.villes(pl).filter(function (k) { return k !== '0,0' && pl.camps.vert.indexOf(k) === -1 && pl.camps.rouge.indexOf(k) === -1; })[0];
    verifier('plateau de référence : une plaine sur la rangée du haut et une ville neutre', !!haut && !!neutre, haut + ' / ' + neutre);
    clicCase(vp.vue, haut); clic($('#pl-retirer'));
    clicCase(vp.vue, neutre); clic($('#pl-deplacer')); clicCase(vp.vue, haut); touche('Escape');
    verifier('3 villes en haut : aucune ville de déploiement désignée pour Vert (pas de choix silencieux)',
      P.villesRangeesExtremes(vp.plateau()).vert.length === 3 && vp.plateau().camps.vert.length === 0 && vp.plateau().camps.rouge.length === 2, JSON.stringify(vp.plateau().camps));
    verifier('3 villes en haut : le contrôle 4 signale l’égalité', /3 villes à égalité sur la rangée du haut/.test($('#pl-controles').textContent) && vp.bilan().erreurs > 0);
    telecharges.length = 0;
    clic($('#pl-enregistrer'));
    verifier('3 villes en haut : le plateau s’enregistre quand même', telecharges.length === 1 && !/at-etat-erreur/.test(etatBarre()), $('#barre-etat').textContent);
    var ambigu = vp.texteEnregistrement(), ambiguAvant = JSON.stringify(vp.plateau());
    clic($('#pl-vider'));
    verifier('3 villes en haut : le fichier se rouvre à l’identique', vp.ouvrirTexte(ambigu) === true && JSON.stringify(vp.plateau()) === ambiguAvant, $('#barre-etat').textContent);
    vp.ouvrirTexte(texte);
  });

  // ================================================================== E. inventaire
  scenario('Inventaire', function () {
    AT.app.montrer('inventaire');
    verifier('onglet Inventaire affiché', !$('#panneau-inventaire').hidden && $('#panneau-plateau').hidden);
    verifier('26 modèles de pièces, tous dessinés', $$('#inv-pieces tbody tr[data-modele]').length === 26 && $$('#inv-pieces tbody tr[data-modele] svg').length === 26, $$('#inv-pieces tbody tr[data-modele]').length);
    verifier('catalogue 2 : terrain en monoblocs de 3 ou 4 cases ; seules tuiles d’une case : remplissage et ville neutre', $$('#inv-pieces tbody tr[data-modele]').filter(function (tr) {
      return /^1 case/.test(tr.querySelectorAll('td')[1].textContent);
    }).map(function (tr) { return tr.getAttribute('data-modele'); }).join() === 'R,VN' && !$('#inv-pieces [data-modele="P"]'));
    verifier('totaux : 28 pièces, 95 cases, dont 24 pièces de terrain pour 91 cases', /28 pièces, 95 cases \(dont 24 pièces de terrain pour 91 cases, et 2 tuiles de remplissage facultatives\)/.test($('#inv-totaux').textContent), $('#inv-totaux').textContent);
    verifier('quantités posées sur le plateau courant', /26 pièces posées \(93 cases\), 2 restantes/.test($('#inv-totaux').textContent), $('#inv-totaux').textContent);
    verifier('répartition affichée', /75 cases des monoblocs/.test($('#inv-repartition').textContent) && /53 plaines \(70,7 %\)/.test($('#inv-repartition').textContent) && /11 forêts \(14,7 %\)/.test($('#inv-repartition').textContent) && /11 marais \(14,7 %\)/.test($('#inv-repartition').textContent), $('#inv-repartition').textContent);
    verifier('villes : 2 villes neutres et 4 tuiles de ville de déploiement, 4 posées', /2 villes neutres/.test($('#inv-villes').textContent) && /4 tuiles de ville de déploiement/.test($('#inv-villes').textContent)
      && /4 posée\(s\) sur le plateau courant/.test($('#inv-villes').textContent), $('#inv-villes').textContent);
    var plaines = $('#inv-pieces [data-modele="R"]').querySelectorAll('td.at-nombre');
    verifier('remplissage : 2 au total, 0 posée, 2 restantes (le générateur n’en pose pas)', plaines[0].textContent === '2' && plaines[1].textContent === '0' && plaines[2].textContent === '2');
    verifier('réserve : 8 tuiles d’événement avec condition et effet', $$('#inv-evenements tbody tr').length === 8 && /montagne/.test($('#inv-evenements [data-evenement="E3"]').textContent) && /coût 2/i.test($('#inv-evenements [data-evenement="E3"]').textContent));
    verifier('mention « proposition provisoire, à valider »', /provisoire, à valider/i.test($('#inv-provisoire').textContent));
  });

  // ================================================================== F. partie fictive
  scenario('Partie', function () {
    var vq = AT.app.vues.partie, vp = AT.app.vues.plateau, PA = AT.partie, vue = vq.vue;
    AT.app.montrer('partie');
    verifier('sans partie : invitation à en créer une', vq.etat() === null && !$('#pa-vide').hidden && $('#pa-corps').hidden);
    $('#pa-graine').value = '5';
    clic($('#pa-nouvelle'));
    var e = vq.etat();
    verifier('nouvelle partie créée', !!e && e.graine === 5 && $('#pa-vide').hidden && !$('#pa-corps').hidden);
    var reference = PA.creer({ graine: 5, plateau: vp.plateau() }, { alea: AT.alea.creer(5), hex: AT.hex, plateau: AT.plateau });
    verifier('même graine = même mise en place', JSON.stringify(e) === JSON.stringify(reference.etat));
    verifier('mains affichées, cartes étiquetées « provisoire »', $$('[data-main="vert"] .at-carte').length === 3 && $$('[data-main="rouge"] .at-carte').length === 2 && $$('[data-main="vert"] .at-etiquette-provisoire').length === 3);
    verifier('tour, joueur actif et actions affichés', /Tour 1 — au tour de Vert — actions comptées : 0 \/ 2/.test($('#pa-tour-texte').textContent), $('#pa-tour-texte').textContent);
    verifier('4 bataillons par joueur, en réserve', $$('.at-bataillon-reserve').length === 8);
    verifier('plateau de la partie dessiné', $$('svg > g:first-of-type > g:first-child > polygon', vue.svg.parentNode).length === 93);

    // Former : par bouton, par clic sur le plateau, puis hors déploiement (avertissement à forcer).
    var camps = e.plateau.camps.vert;
    clic($$('[data-main="vert"] .at-carte')[0]);
    verifier('carte choisie : villes de déploiement en surbrillance', vq.ui().carte !== null && marques(vue, 'at-admissible') === 2);
    clic($('[data-former="' + camps[0] + '"]'));
    e = vq.etat();
    verifier('former par bouton : bataillon 1 sur la ville de déploiement', e.bataillons.vert[0].case === camps[0] && e.bataillons.vert[0].troupes.length === 1 && e.actions === 1 && e.paquets.vert.main.length === 2);
    verifier('pion dessiné', $$('text', vue.svg).some(function (t) { return t.textContent === 'V1'; }));
    clic($$('[data-main="vert"] .at-carte')[0]);
    clicCase(vue, camps[1]);
    e = vq.etat();
    verifier('former par clic sur le plateau : bataillon 2', e.bataillons.vert[1].case === camps[1] && e.actions === 2);
    clic($$('[data-main="vert"] .at-carte')[0]);
    clicCase(vue, '0,0');
    verifier('former hors déploiement : avertissement, rien n’est fait', !!$('#pa-avertissement') && /ville de déploiement/.test($('#pa-avertissement').textContent) && vq.etat().bataillons.vert[2].case === null);
    clic($('#pa-forcer'));
    e = vq.etat();
    verifier('« Faire quand même » : formé, noté « forcé » au journal', e.bataillons.vert[2].case === '0,0' && /\(forcé\)/.test(e.journal[e.journal.length - 1].texte) && $('#pa-avis').hidden);

    // Déplacer.
    clicCase(vue, camps[0]);
    verifier('clic sur un pion : bataillon sélectionné, coûts des cases voisines affichés', vq.ui().bataillon && vq.ui().bataillon.numero === 1 && marques(vue, 'at-selection') === 1 && marques(vue, 'at-admissible') > 0);
    var cases = AT.plateau.cases(e.plateau);
    var voisine = AT.hex.voisines(camps[0]).filter(function (k) { return cases[k] && AT.plateau.cout(e.plateau, k) !== Infinity; })[0];
    clicCase(vue, voisine);
    e = vq.etat();
    verifier('déplacement vers une case voisine, coût au journal', e.bataillons.vert[0].case === voisine && /ration\(s\)/.test(e.journal[e.journal.length - 1].texte));
    clicCase(vue, e.plateau.camps.rouge[0]);
    verifier('déplacement lointain : avertissement « non voisine »', !!$('#pa-avertissement') && /voisine/.test($('#pa-avertissement').textContent) && vq.etat().bataillons.vert[0].case === voisine);
    clic($('#pa-renoncer'));
    verifier('renoncer : rien ne bouge', $('#pa-avis').hidden && vq.etat().bataillons.vert[0].case === voisine);
    touche('Escape');

    // Main, pioche, renouvellement, renfort.
    clic($('[data-piocher="vert"]'));
    clic($('[data-piocher="vert"]'));
    e = vq.etat();
    verifier('piocher : 2 cartes en main, compteurs à jour', e.paquets.vert.main.length === 2 && /Pioche : 15 — Défausse : 0 — Main : 2 \/ 5/.test($('[data-compteurs="vert"]').textContent), $('[data-compteurs="vert"]').textContent);
    clic($$('[data-main="vert"] .at-carte')[0]);
    clic($('[data-renforcer="vert-2"]'));
    e = vq.etat();
    verifier('renforcer : 2 Troupes dans le bataillon 2', e.bataillons.vert[1].troupes.length === 2 && e.paquets.vert.main.length === 1);
    clic($$('[data-main="vert"] .at-carte')[0]);
    clic($('[data-defausser="vert"]'));
    verifier('défausser la carte choisie', vq.etat().paquets.vert.main.length === 0 && vq.etat().paquets.vert.defausse.length === 1);
    clic($('[data-piocher="vert"]'));
    var actionsAvant = vq.etat().actions;
    clic($('[data-renouveler="vert"]'));
    e = vq.etat();
    verifier('renouveler la main : défausse puis pioche, 2 actions comptées', e.paquets.vert.main.length === 1 && e.paquets.vert.defausse.length === 2 && e.actions === actionsAvant + 2);
    touche('z', { ctrlKey: true });
    verifier('renouveler s’annule en une seule fois', vq.etat().paquets.vert.defausse.length === 1 && vq.etat().actions === actionsAvant);
    touche('y', { ctrlKey: true });
    verifier('et se rétablit', vq.etat().paquets.vert.defausse.length === 2);

    // Dégâts, dés.
    var moral = PA.troupeDe(vq.etat(), vq.etat().bataillons.vert[1].troupes[0].carte).moral;
    clic($('[data-degats="vert-2-0"]'));
    e = vq.etat();
    verifier('marqueur de dégâts (ou élimination si le moral est atteint)', moral === 1 ? e.bataillons.vert[1].troupes.length === 1 : e.bataillons.vert[1].troupes[0].degats === 1);
    $('#pa-nb-des').value = '4';
    clic($('#pa-lancer'));
    var des = $$('#pa-resultat-des .at-de').map(function (d) { return parseInt(d.textContent, 10); });
    verifier('lancer 4 dés : chaque dé affiché, de 1 à 6', des.length === 4 && des.every(function (d) { return d >= 1 && d <= 6; }), des.join());
    verifier('total affiché et journal', new RegExp('total ' + des.reduce(function (a, b) { return a + b; }, 0)).test($('#pa-resultat-des').textContent) && /lance 4 dé/.test(vq.etat().journal[vq.etat().journal.length - 1].texte));
    var attendus = vq.etat().bataillons.vert[1].troupes.reduce(function (s, t) { return s + PA.troupeDe(vq.etat(), t.carte).des; }, 0);
    clic($('[data-lancer="vert-2"]'));
    verifier('lancer les dés du bataillon : somme des dés de ses Troupes', $$('#pa-resultat-des .at-de').length === attendus && attendus > 0, attendus);

    // Gloire et victoire.
    for (var i = 0; i < 15; i++) clic($('[data-gloire-plus="vert"]'));
    verifier('Gloire + : 15, victoire signalée', vq.etat().gloire.vert === 15 && !!$('#pa-victoire') && /Vert/.test($('#pa-victoire').textContent) && $('[data-gloire-plus="vert"]').disabled);
    verifier('Gloire affichée', $('[data-gloire="vert"]').textContent === '15 / 15');

    // Campement et opérations de paquet.
    clic($('[data-campement="rouge"]'));
    e = vq.etat();
    var idCarte = e.paquets.campement.defausse[e.paquets.campement.defausse.length - 1];
    verifier('carte Campement piochée : texte exact affiché', !!$('#pa-carte-campement') && $('#pa-carte-campement .at-texte-carte').textContent === AT.cartes.trouver(idCarte).texte, idCarte);
    verifier('opérations de paquet proposées pour le joueur qui a pioché', $$('[data-operation]').length === 13 && $('[data-paquet-de="rouge"]').getAttribute('aria-pressed') === 'true');
    var mainRouge = e.paquets.rouge.main.length;
    clic($('[data-operation="piocher1"]'));
    verifier('opération « Piocher 1 » appliquée à Rouge', vq.etat().paquets.rouge.main.length === mainRouge + 1);
    clic($('[data-operation="regarder"]'));
    verifier('« Regarder les 3 premières » : 3 cartes montrées', $$('#pa-regard li').length === 3);
    clic($('#pa-regard [data-prendre]'));
    verifier('prendre en main une carte regardée', vq.etat().paquets.rouge.main.length === mainRouge + 2 && $$('#pa-regard li').length === 2);
    clic($('[data-operation="recycler"]'));
    verifier('« Mélanger la défausse dans la pioche » journalisé', /mélange sa défausse dans sa pioche/.test(vq.etat().journal[vq.etat().journal.length - 1].texte));

    // Événement : pioche, cases admissibles, refus expliqué, pose.
    clic($('#pa-piocher-evenement'));
    var idEv = vq.ui().evenement;
    e = vq.etat();
    var occupees = [];
    ['vert', 'rouge'].forEach(function (j) { e.bataillons[j].forEach(function (b) { if (b.case) occupees.push(b.case); }); });
    var admissibles = AT.vuePlateau.casesAdmissibles(e.plateau, idEv, occupees);
    verifier('événement pioché : carte affichée, cases admissibles en surbrillance', !!idEv && !!$('#pa-evenements [data-evenement="' + idEv + '"]') && marques(vue, 'at-admissible') === admissibles.length && admissibles.length > 0, idEv + ' ' + admissibles.length);
    clicCase(vue, e.plateau.camps.rouge[0]);
    verifier('pose refusée sur une ville, avec explication', vq.etat().plateau.recouvrements.length === 0 && /at-etat-erreur/.test(etatBarre()) && /Refusé/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    clicCase(vue, admissibles[0]);
    e = vq.etat();
    verifier('tuile d’événement posée sur le plateau de la partie', e.plateau.recouvrements.length === 1 && e.plateau.recouvrements[0].cle === admissibles[0] && vq.ui().evenement === null);
    verifier('le plateau de l’onglet Plateau n’est pas touché', vp.plateau().recouvrements.length === 0);
    verifier('tuile dessinée dans la partie', $$('text', vue.svg).some(function (t) { return t.textContent === idEv; }));

    // Ville capturée, élimination, fin de tour, journal, note.
    var neutre = AT.plateau.villes(e.plateau).filter(function (k) { return occupees.indexOf(k) === -1 && e.plateau.camps.vert.indexOf(k) === -1 && e.plateau.camps.rouge.indexOf(k) === -1; })[0];
    clicCase(vue, neutre);
    clic($('[data-capture="rouge"]'));
    verifier('ville capturée par Rouge, fanion dessiné', vq.etat().villes[neutre] === 'rouge' && $$('rect[fill="#D8321C"]', vue.svg).length >= 1);
    clic($('[data-eliminer="vert-3"]'));
    verifier('bataillon éliminé : retour en réserve, Troupes défaussées', vq.etat().bataillons.vert[2].case === null);
    clic($('#pa-fin-tour'));
    e = vq.etat();
    verifier('fin du tour : tour 2, Rouge joue, actions à 0, Rouge pioche', e.tour === 2 && e.actif === 'rouge' && e.actions === 0 && /Tour 2 — au tour de Rouge/.test($('#pa-tour-texte').textContent));
    $('#pa-note').value = '<b>attaque</b> prévue au tour 3';
    clic($('#pa-noter'));
    e = vq.etat();
    verifier('note ajoutée au journal comme du texte', /<b>attaque<\/b>/.test($('#pa-journal li').textContent) && $$('#pa-journal b').length === 0 && $('#pa-note').value === '');
    verifier('journal complet à l’écran', $$('#pa-journal li').length === e.journal.length && e.journal.length > 30, e.journal.length);

    // Annuler / rétablir, enregistrer / ouvrir.
    var longueur = e.journal.length;
    clic($('#pa-annuler'));
    verifier('annuler : la note disparaît', vq.etat().journal.length === longueur - 1);
    clic($('#pa-retablir'));
    verifier('rétablir : elle revient', vq.etat().journal.length === longueur);
    var texte = vq.texteEnregistrement(), avant = JSON.stringify(vq.etat());
    telecharges.length = 0;
    clic($('#pa-enregistrer'));
    verifier('enregistrer la partie : fichier JSON produit', telecharges.length === 1 && /^partie-graine-5-tour-2\.json$/.test(telecharges[0].nom), telecharges.map(function (t) { return t.nom; }).join());
    clic($('#pa-fin-tour'));
    verifier('ouvrir la partie enregistrée : état identique', vq.ouvrirTexte(texte) === true && JSON.stringify(vq.etat()) === avant);
    verifier('fichier de partie invalide : refusé, partie inchangée', vq.ouvrirTexte('{"format":"autre"}') === false && /at-etat-erreur/.test(etatBarre()) && JSON.stringify(vq.etat()) === avant);
    var hostile = JSON.parse(texte);
    hostile.troupes.T1.nom = '<img src=x onerror=alert(1)>';
    verifier('nom de Troupe contenant du HTML : affiché comme du texte', vq.ouvrirTexte(JSON.stringify(hostile)) === true && $$('img').length === 0 && $$('#atelier script').length === 0);
    vq.ouvrirTexte(texte);

    // Éditeur des Troupes provisoires.
    clic($('#pa-troupes'));
    verifier('éditeur des Troupes ouvert', $('#pa-dialogue-troupes').open === true && $$('#pa-dialogue-troupes [data-troupe]').length === 12);
    var ligne = $('#pa-dialogue-troupes [data-troupe="T1"]');
    $('[data-champ="nom"]', ligne).value = 'Conscrits';
    $('[data-champ="des"]', ligne).value = '3';
    clic($('[data-appliquer="T1"]'));
    verifier('Troupe modifiée (nom, dés)', vq.etat().troupes.T1.nom === 'Conscrits' && vq.etat().troupes.T1.des === 3);
    ligne = $('#pa-dialogue-troupes [data-troupe="T2"]');
    $('[data-champ="moral"]', ligne).value = '99';
    clic($('[data-appliquer="T2"]'));
    verifier('valeur hors bornes : refusée avec message', vq.etat().troupes.T2.moral !== 99 && /Refusé/.test($('#pa-message-troupes').textContent));
    clic($('#pa-fermer-troupes'));
    verifier('éditeur refermé', $('#pa-dialogue-troupes').open === false);

    // Sélection périmée : la carte choisie quitte la main par une autre voie.
    clic($$('[data-main="rouge"] .at-carte')[0]);
    clic($('[data-paquet-de="rouge"]'));
    clic($('[data-operation="main"]'));
    verifier('carte choisie puis main défaussée : plus de carte choisie', vq.ui().carte === null && $$('[data-former]').length === 0 && vq.etat().paquets.rouge.main.length === 0);

    // Une tuile d'événement posée à l'essai dans l'onglet Plateau ne bloque pas la partie.
    AT.app.montrer('plateau');
    clic($('#pl-stock [data-evenement="E2"]'));
    clicCase(vp.vue, AT.vuePlateau.casesAdmissibles(vp.plateau(), 'E2')[0]);
    AT.app.montrer('partie');
    clic($('#pa-nouvelle'));
    e = vq.etat();
    verifier('nouvelle partie : les tuiles d’essai restent en réserve (8 cartes, aucune tuile posée), et c’est dit',
      vp.plateau().recouvrements.length === 1 && e.plateau.recouvrements.length === 0 && e.paquets.evenements.pioche.length === 8 && /à l’essai/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    AT.app.montrer('plateau');
    clic($('#pl-annuler'));
    AT.app.montrer('partie');
    verifier('retour au plateau sans tuile d’essai', vp.plateau().recouvrements.length === 0);

    // Partie rejouable à l'identique.
    $('#pa-graine').value = '5';
    clic($('#pa-nouvelle'));
    $('#pa-nb-des').value = '3';
    clic($('#pa-lancer'));
    var premier = $('#pa-resultat-des').textContent;
    clic($('#pa-nouvelle'));
    clic($('#pa-lancer'));
    verifier('même graine de partie : mêmes dés', $('#pa-resultat-des').textContent === premier && /total/.test(premier), premier);
  });

  // ================================================================== H. essais exploratoires (recette du testeur)
  function texteBouton(racine, motif) {
    return $$('button', racine).filter(function (b) { return motif.test(b.textContent); })[0] || null;
  }
  function relisible(vp) { return AT.plateau.lire(vp.texteEnregistrement()).ok; }
  function casesDessinees(vue) { return $$('svg > g:first-of-type > g:first-child > polygon', vue.svg.parentNode).length; }

  scenario('Essais : générer avec plusieurs graines et les deux seuils', function () {
    var vp = AT.app.vues.plateau, P = AT.plateau;
    AT.app.montrer('plateau');
    // Compté seulement en file:// : la recette peut aussi être ouverte par le serveur local (http://127.0.0.1).
    if (window.location.protocol === 'file:') verifier('page ouverte en file:// (hors ligne)', true);
    else lignes.push('INFO  page servie en ' + window.location.protocol + ' : l’ouverture en file:// n’est pas vérifiée ici');
    var graines = ['2', '3', '17', '2024', 'bannerlord', 'Été 1066 !'], mauvais = [], differents = {};
    [3, 2].forEach(function (seuil) {
      choisir($('#pl-seuil'), seuil);
      graines.forEach(function (g) {
        $('#pl-graine').value = g;
        clic($('#pl-generer'));
        var pl = vp.plateau(), premier = JSON.stringify(pl);
        clic($('#pl-generer'));
        var bon = String(pl.graine) === g && vp.bilan().erreurs === 0 && vp.bilan().etape === 'complet' && pl.pieces.length === 26 && casesDessinees(vp.vue) === 93
          && pl.camps.vert.length === 2 && pl.camps.rouge.length === 2 && P.deploiements(pl).length === 4 && $('#pl-avis').hidden && relisible(vp)
          && JSON.stringify(vp.plateau()) === premier && P.villes(pl).length === 7;
        if (!bon) mauvais.push(g + ' (seuil ' + seuil + ') : ' + $('#barre-etat').textContent + ' ' + $('#pl-bilan').textContent);
        differents[premier.replace(/"graine":[^,]*,/, '')] = true;
      });
    });
    verifier('6 graines × 2 seuils : 26 pièces, 93 cases, 7 villes, 2 + 2 villes de déploiement posées sur une Plaine, aucune erreur, étape « complet », fichier relisible, même graine = même plateau', mauvais.length === 0, mauvais.join(' | '));
    verifier('les graines donnent des plateaux différents', Object.keys(differents).length >= 6, Object.keys(differents).length);
    $('#pl-graine').value = '   ';
    clic($('#pl-generer'));
    verifier('graine vide : graine 1 prise par défaut, dite dans le champ', vp.plateau().graine === 1 && $('#pl-graine').value === '1');
    choisir($('#pl-seuil'), 3);
    $('#pl-graine').value = '1';
    clic($('#pl-generer'));
  });

  scenario('Essais : vider puis reconstruire à la main', function () {
    var vp = AT.app.vues.plateau, P = AT.plateau, vue = vp.vue;
    var depart = JSON.stringify(vp.plateau()), rangDepart = vp.etat().rang, illisibles = [];
    function poser(modele, cle, rotations) {
      clic($('#pl-stock [data-modele="' + modele + '"]'));
      for (var i = 0; i < (rotations || 0); i++) touche('r');
      var avant = vp.plateau().pieces.length;
      clicCase(vue, cle);
      touche('Escape');
      if (!relisible(vp)) illisibles.push(modele + ' en ' + cle);
      return vp.plateau().pieces.length === avant + 1;
    }
    // Une pièce retirée ou tournée emporte la tuile d'événement posée dessus : c'est dit.
    var lisiere = vp.plateau().pieces.filter(function (p) { return p.modele === 'F31'; })[0];
    var sousTuile = P.casesPiece(lisiere).filter(function (c) { return c.terrain === 'plaine'; })[0].cle;
    clic($('#pl-stock [data-evenement="E5"]'));
    clicCase(vue, sousTuile);
    verifier('tuile d’essai posée sur une plaine de la lisière', vp.plateau().recouvrements.length === 1 && vp.plateau().recouvrements[0].cle === sousTuile, $('#barre-etat').textContent);
    clicCase(vue, sousTuile);
    touche('Delete');
    verifier('retirer la pièce sous une tuile d’événement : la tuile retourne en réserve, et c’est dit', vp.plateau().recouvrements.length === 0 && /1 tuile d’événement retourne en réserve/.test($('#barre-etat').textContent)
      && !!$('#pl-stock [data-evenement="E5"]'), $('#barre-etat').textContent);
    clic($('#pl-annuler'));
    clicCase(vue, sousTuile);
    touche('r');
    verifier('tourner la pièce sous une tuile d’événement : la tuile retourne en réserve, et c’est dit (ou rotation refusée)', /at-etat-erreur/.test(etatBarre())
      || (vp.plateau().recouvrements.length === 0 && /1 tuile d’événement retourne en réserve/.test($('#barre-etat').textContent)), $('#barre-etat').textContent);
    touche('Escape');
    clic($('#pl-vider'));
    verifier('plateau vide : enregistrable et relisible, contrôles affichés sans erreur JavaScript', relisible(vp) && $$('#pl-controles .at-regle').length === 7 && casesDessinees(vue) === 0);
    telecharges.length = 0;
    clic($('#pl-enregistrer'));
    verifier('plateau vide : fichier produit', telecharges.length === 1);
    verifier('noyau posé au centre', poser('N1', '0,0'));
    // Catalogue 2 : une ville neutre est une tuile ajoutée contre un flanc ; posée ailleurs par la palette, elle est
    // acceptée (pose libre) et le contrôle des villes dit qu'elle est mal placée. Elle ne désigne aucun camp.
    clic($('#pl-mode-villes'));
    clic($('#vi-outil-neutre'));
    clicCase(vue, '0,-2');
    verifier('ville neutre au-dessus du plateau : refusée en pose stricte, avec la raison du modèle', vp.plateau().pieces.length === 1 && /Pose refusée : Une ville neutre se pose sur un côté du plateau/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    clic($('#vi-libre'));
    clicCase(vue, '0,-2');
    clic($('#vi-libre'));
    clic($('#pl-mode-generer'));
    verifier('la même en pose libre : acceptée, « mal placée » au contrôle des villes, aucun camp désigné', vp.plateau().pieces.length === 2 && relisible(vp)
      && /Ville neutre en \(0,-2\) mal placée/.test($('#pl-controles').textContent) && vp.plateau().camps.vert.length === 0 && vp.bilan().villes.erreurs > 0, $('#pl-bilan').textContent);
    telecharges.length = 0;
    clic($('#pl-enregistrer'));
    var ambigu = vp.texteEnregistrement();
    verifier('plateau en cours de retouche, ville mal placée comprise : enregistré et rouvert', telecharges.length === 1 && vp.ouvrirTexte(ambigu) === true && vp.plateau().pieces.length === 2);
    clicCase(vue, '0,-2');
    touche('Delete');
    verifier('ville neutre mal placée, touche Suppr hors de l’étape « Villes » : refusée, renvoi à l’étape « Villes »', vp.plateau().pieces.length === 2
      && /ville neutre .* qu’à l’étape « Villes »/.test($('#barre-etat').textContent) && /at-etat-erreur/.test(etatBarre()), $('#barre-etat').textContent);
    touche('Escape');
    clic($('#pl-mode-villes'));
    clicCase(vue, '0,-2');
    clic($('#pl-mode-generer'));
    verifier('ville neutre retirée (étape « Villes ») : plus d’erreur de villes, étape « construction »', !/mal placée/.test($('#pl-controles').textContent) && vp.bilan().villes.erreurs === 0 && vp.bilan().etape === 'construction'
      && /Construction en cours : 23 pièces de terrain à poser/.test($('#pl-etape').textContent), $('#pl-etape').textContent);
    // Monoblocs : pose tournée, rotation sur place (comparée au modèle), déplacement, retrait.
    verifier('monoblocs posés tournés (bois, lisière, marécage, montagne peigne)', poser('F3', '3,0', 2) && poser('F31', '-4,1', 1) && poser('S3', '2,2', 5) && poser('M5', '-3,-1', 3));
    var bois = vp.plateau().pieces.filter(function (p) { return p.modele === 'F3'; })[0];
    verifier('rotation mémorisée à la pose', bois.rotation === 2 && vp.plateau().pieces.filter(function (p) { return p.modele === 'M5'; })[0].rotation === 3, bois.rotation);
    var ecarts = [];
    ['F3', 'F31', 'S3', 'M5'].forEach(function (modele) {
      var piece = vp.plateau().pieces.filter(function (p) { return p.modele === modele; })[0];
      clicCase(vue, P.casesPiece(piece)[0].cle);
      for (var i = 0; i < 6; i++) {
        var prevu = P.tourner(vp.plateau(), vp.etat().selection, 1);
        touche('r');
        var apres = vp.plateau().pieces.filter(function (p) { return p.id === piece.id; })[0];
        var attendu = prevu.ok ? prevu.plateau.pieces.filter(function (p) { return p.id === piece.id; })[0].rotation : piece.rotation;
        if (!apres || apres.rotation !== attendu || (!prevu.ok && !/at-etat-erreur/.test(etatBarre()))) ecarts.push(modele + ' tour ' + i);
        if (!relisible(vp)) illisibles.push('rotation ' + modele);
        piece = apres || piece;
      }
      touche('Escape');
    });
    verifier('rotation des monoblocs posés : 6 sixièmes de tour chacun, refus expliqué en cas de chevauchement', ecarts.length === 0, ecarts.join(', '));
    verifier('tuile de remplissage posée contre le bois', poser('R', '2,0'));
    bois = vp.plateau().pieces.filter(function (p) { return p.modele === 'F3'; })[0];
    clicCase(vue, P.casesPiece(bois)[0].cle);
    clic($('#pl-deplacer'));
    clicCase(vue, '0,0');
    verifier('déplacement d’un monobloc sur le noyau : refusé, la pièce ne bouge pas', /Déplacement refusé/.test($('#barre-etat').textContent)
      && JSON.stringify(vp.plateau().pieces.filter(function (p) { return p.modele === 'F3'; })[0]) === JSON.stringify(bois), $('#barre-etat').textContent);
    clicCase(vue, '-2,4');
    var boisApres = vp.plateau().pieces.filter(function (p) { return p.modele === 'F3'; })[0];
    verifier('déplacement d’un monobloc vers une place libre : 3 cases déplacées, rotation gardée', boisApres.q === -2 && boisApres.r === 4 && boisApres.rotation === bois.rotation && vp.plateau().pieces.length === 6, JSON.stringify(boisApres) + ' ' + $('#barre-etat').textContent);
    touche('Delete');
    verifier('retrait d’un monobloc : il revient au stock', vp.plateau().pieces.length === 5 && !$('#pl-stock [data-modele="F3"]').disabled, vp.plateau().pieces.length);
    // Épuisement du stock : les 2 tuiles de remplissage (seules tuiles d'une case de la palette).
    var villesPosees = ['-6,0', '6,0'].slice(0, P.stock(vp.plateau()).R.restant).map(function (k) { return poser('R', k); });
    verifier('2 tuiles de remplissage posées : le modèle « Remplissage » est épuisé dans la palette', villesPosees.every(Boolean) && $('#pl-stock [data-modele="R"]').disabled && P.stock(vp.plateau()).R.restant === 0, villesPosees.join());
    verifier('contrôles en direct sur un plateau partiel : inventaire en alerte, contact ou villes mal placées signalés', /Pièces de terrain restantes/.test($('#pl-controles').textContent) && vp.bilan().erreurs > 0);
    verifier('à chaque retouche, le plateau est resté enregistrable et relisible', illisibles.length === 0, illisibles.join(', '));
    verifier('dessin fidèle au modèle : autant de cases dessinées que de cases posées', casesDessinees(vue) === Object.keys(P.cases(vp.plateau())).length, casesDessinees(vue));
    // Partie sur un plateau partiel : possible (table libre), avec l'alerte.
    AT.app.montrer('partie');
    clic($('#pa-nouvelle'));
    verifier('partie sur un plateau partiel : créée, erreurs du plateau rappelées', !!AT.app.vues.partie.etat() && AT.app.vues.partie.etat().plateau.pieces.length === vp.plateau().pieces.length
      && /erreur\(s\) aux contrôles/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    AT.app.montrer('plateau');
    // Retour arrière complet.
    var pas = 0;
    while (vp.etat().rang > rangDepart && pas < 300) { touche('z', { ctrlKey: true }); pas += 1; }
    verifier('Ctrl+Z jusqu’au plateau généré : retrouvé à l’identique', JSON.stringify(vp.plateau()) === depart && vp.bilan().erreurs === 0, pas + ' annulations');
  });

  scenario('Essais : fichiers malformés ou hostiles', function () {
    var vp = AT.app.vues.plateau, vq = AT.app.vues.partie;
    var bon = vp.texteEnregistrement(), avant = JSON.stringify(vp.plateau());
    function mute(f) { var o = JSON.parse(bon); f(o); return JSON.stringify(o); }
    var hostiles = {
      'vide': '', 'null': 'null', 'tableau': '[]', 'nombre': '42', 'chaîne': '"plateau"', 'tronqué': bon.slice(0, bon.length / 2),
      'imbrication profonde': new Array(60001).join('[') + new Array(60001).join(']'),
      'trop gros': '{"version":1,"graine":"' + new Array(200002).join('x') + '"}',
      '__proto__': '{"__proto__":{"pollue":true},"version":1,"graine":1,"pieces":[],"recouvrements":[],"camps":{"vert":[],"rouge":[]}}',
      'constructor': mute(function (o) { o.constructor = { prototype: { pollue: true } }; }),
      'version inconnue': mute(function (o) { o.version = 3; }),
      'graine objet': mute(function (o) { o.graine = { toString: 'x' }; }),
      'graine de 65 caractères': mute(function (o) { o.graine = new Array(66).join('g'); }),
      'graine non entière': mute(function (o) { o.graine = 1.5; }),
      'pièces absentes': mute(function (o) { delete o.pieces; }),
      'pièces en objet': mute(function (o) { o.pieces = { length: 3 }; }),
      '201 pièces': mute(function (o) { while (o.pieces.length < 201) o.pieces.push({ id: 'x' + o.pieces.length, modele: 'P', q: 0, r: 0, rotation: 0 }); }),
      'modèle inconnu': mute(function (o) { o.pieces[0].modele = 'Z9'; }),
      'modèle « constructor »': mute(function (o) { o.pieces[0].modele = 'constructor'; }),
      'modèle « __proto__ »': mute(function (o) { o.pieces[0].modele = '__proto__'; }),
      'identifiant HTML': mute(function (o) { o.pieces[0].id = '<img src=x onerror=alert(1)>'; }),
      'identifiant en double': mute(function (o) { o.pieces[1].id = o.pieces[0].id; }),
      'position énorme': mute(function (o) { o.pieces[0].q = 1e9; }),
      'position en texte': mute(function (o) { o.pieces[0].q = '3'; }),
      'position décimale': mute(function (o) { o.pieces[0].r = 0.5; }),
      'rotation 6': mute(function (o) { o.pieces[0].rotation = 6; }),
      'rotation négative': mute(function (o) { o.pieces[0].rotation = -1; }),
      'champ en trop dans une pièce': mute(function (o) { o.pieces[0].onclick = 'alert(1)'; }),
      'événement inconnu': mute(function (o) { o.recouvrements = [{ evenement: 'E99', cle: '1,1' }]; }),
      'événement « toString »': mute(function (o) { o.recouvrements = [{ evenement: 'toString', cle: '1,1' }]; }),
      'événement en double': mute(function (o) { o.recouvrements = [{ evenement: 'E2', cle: '1,1' }, { evenement: 'E2', cle: '2,1' }]; }),
      'clé de case invalide': mute(function (o) { o.recouvrements = [{ evenement: 'E2', cle: '1;1' }]; }),
      '17 événements': mute(function (o) { o.recouvrements = []; for (var i = 0; i < 17; i++) o.recouvrements.push({ evenement: 'E2', cle: i + ',0' }); }),
      'camps absents': mute(function (o) { o.camps = null; }),
      '3 cases dans un camp': mute(function (o) { o.camps.vert = ['0,0', '1,0', '2,0']; }),
      'camp avec du HTML': mute(function (o) { o.camps.rouge = ['<script>alert(1)</script>']; }),
      'fichier de partie': vq.texteEnregistrement() || '{"format":"atelier-partie"}'
    };
    var acceptes = [];
    Object.keys(hostiles).forEach(function (nom) {
      var accepte;
      try { accepte = vp.ouvrirTexte(hostiles[nom]); } catch (e) { accepte = 'exception ' + e.message; }
      if (accepte !== false || JSON.stringify(vp.plateau()) !== avant || !/at-etat-erreur/.test(etatBarre()) || !/Fichier refusé/.test($('#barre-etat').textContent)) acceptes.push(nom + ' → ' + accepte);
    });
    verifier(Object.keys(hostiles).length + ' fichiers de plateau malformés ou hostiles : tous refusés avec un message, plateau inchangé', acceptes.length === 0, acceptes.join(' | '));
    verifier('aucune pollution de Object.prototype, aucun élément injecté', ({}).pollue === undefined && $$('#atelier img, #atelier script, #atelier iframe').length === 0);

    // Identifiants de pièce valides mais homonymes de propriétés d'objet : le dessin ne doit pas planter.
    var homonymes = mute(function (o) { ['constructor', 'toString', 'valueOf', 'hasOwnProperty'].forEach(function (nom, i) { o.pieces[i].id = nom; }); });
    var ouvert = vp.ouvrirTexte(homonymes);
    verifier('identifiants de pièce « constructor », « toString »… : plateau ouvert et dessiné en entier', ouvert === true && casesDessinees(vp.vue) === 93 && vp.bilan().erreurs === 0, casesDessinees(vp.vue));
    AT.app.montrer('partie');
    clic($('#pa-nouvelle'));
    verifier('partie sur ce plateau : créée et dessinée', casesDessinees(vq.vue) === 93 && vq.etat().plateau.pieces[0].id === 'constructor', casesDessinees(vq.vue));
    AT.app.montrer('plateau');
    vp.ouvrirTexte(bon);
    // Fichiers au bon format mais au contenu fautif : ouverts, dessinés, et les contrôles disent ce qui ne va pas.
    var chevauche = mute(function (o) { o.pieces[1].q = o.pieces[0].q; o.pieces[1].r = o.pieces[0].r; o.pieces[1].modele = 'N1'; });
    verifier('fichier valide avec chevauchement et stock dépassé : ouvert, erreurs affichées', vp.ouvrirTexte(chevauche) === true && /Chevauchement/.test($('#pl-controles').textContent) && /Stock dépassé/.test($('#pl-controles').textContent));
    var disperse = mute(function (o) { o.pieces = o.pieces.slice(0, 3); o.pieces[2].q = 20; o.pieces[2].r = -20; o.deploiements = []; o.camps = { vert: ['20,-20'], rouge: [] }; o.recouvrements = [{ evenement: 'E3', cle: '-20,20' }]; });
    // Correction 5 : le même fichier qui garde ses villes de déploiement, désormais sur des cases absentes, est refusé.
    var orphelines = mute(function (o) { o.pieces = o.pieces.slice(0, 3); o.camps = { vert: [], rouge: [] }; });
    var avantOrphelines = JSON.stringify(vp.plateau());
    verifier('fichier dont les villes de déploiement visent des cases absentes : refusé avec la raison, plateau inchangé', vp.ouvrirTexte(orphelines) === false
      && /Fichier refusé : Ville de déploiement n° 1 : aucune case du plateau en \(/.test($('#barre-etat').textContent) && JSON.stringify(vp.plateau()) === avantOrphelines, $('#barre-etat').textContent);
    verifier('fichier valide très dispersé, tuile d’événement hors plateau : ouvert sans erreur JavaScript, signalé', vp.ouvrirTexte(disperse) === true && vp.bilan().erreurs > 0 && /mal posé/.test($('#pl-controles').textContent), $('#barre-etat').textContent);
    AT.app.montrer('partie');
    var partieAvant = JSON.stringify(vq.etat());
    clic($('#pa-nouvelle'));
    verifier('partie sur ce plateau fautif : créée sans la tuile d’essai, erreurs du plateau rappelées', /erreur\(s\) aux contrôles/.test($('#barre-etat').textContent) && JSON.stringify(vq.etat()) !== partieAvant && vq.etat().plateau.recouvrements.length === 0, $('#barre-etat').textContent);
    AT.app.montrer('plateau');
    var videTexte = mute(function (o) { o.pieces = []; o.deploiements = []; o.camps = { vert: [], rouge: [] }; });
    vp.ouvrirTexte(videTexte);
    AT.app.montrer('partie');
    partieAvant = JSON.stringify(vq.etat());
    clic($('#pa-nouvelle'));
    var fautif = JSON.parse(vq.texteEnregistrement());
    fautif.plateau.pieces[1].q = fautif.plateau.pieces[0].q; fautif.plateau.pieces[1].r = fautif.plateau.pieces[0].r;
    verifier('partie relue dont le plateau a des erreurs de construction : ouverte, et c’est dit', vq.ouvrirTexte(JSON.stringify(fautif)) === true && /erreur\(s\) aux contrôles/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    clic($('#pa-annuler'));
    partieAvant = JSON.stringify(vq.etat());
    clic($('#pa-nouvelle'));
    verifier('partie sur un plateau vide : refus expliqué, partie en cours inchangée', /Partie impossible : Plateau vide/.test($('#barre-etat').textContent) && JSON.stringify(vq.etat()) === partieAvant, $('#barre-etat').textContent);
    AT.app.montrer('plateau');
    verifier('retour au plateau de référence', vp.ouvrirTexte(bon) === true && JSON.stringify(vp.plateau()) === avant && vp.bilan().erreurs === 0);

    // Fichiers de partie.
    AT.app.montrer('partie');
    $('#pa-graine').value = '21';
    clic($('#pa-nouvelle'));
    var partie = vq.texteEnregistrement();
    partieAvant = JSON.stringify(vq.etat());
    function muteP(f) { var o = JSON.parse(partie); f(o); return JSON.stringify(o); }
    var hostilesPartie = {
      'vide': '', 'null': 'null', 'tableau': '[1,2]', 'fichier de plateau': bon, 'tronqué': partie.slice(0, partie.length - 40),
      'imbrication profonde': new Array(60001).join('[') + new Array(60001).join(']'),
      '__proto__': partie.replace(/^\{/, '{"__proto__":{"pollue":true},'),
      'format': muteP(function (o) { o.format = 'autre'; }),
      'version': muteP(function (o) { o.version = 99; }),
      'champ en trop': muteP(function (o) { o.script = '<script>alert(1)</script>'; }),
      'Gloire 99': muteP(function (o) { o.gloire.vert = 99; }),
      'Gloire négative': muteP(function (o) { o.gloire.rouge = -1; }),
      'joueur actif inconnu': muteP(function (o) { o.actif = 'bleu'; }),
      'tour 0': muteP(function (o) { o.tour = 0; }),
      'aléa démesuré': muteP(function (o) { o.alea = new Array(5001).join('9'); }),
      'aléa en texte': muteP(function (o) { o.alea = 'graine'; }),
      'carte en double': muteP(function (o) { o.paquets.vert.pioche[0] = o.paquets.vert.pioche[1]; }),
      'carte de l’adversaire': muteP(function (o) { o.paquets.vert.main.push(o.paquets.rouge.pioche.pop()); }),
      'carte Campement en double': muteP(function (o) { o.paquets.campement.pioche[0] = o.paquets.campement.pioche[1]; }),
      'carte Événement inconnue': muteP(function (o) { o.paquets.evenements.pioche[0] = 'E99'; }),
      'tuile posée dont la carte est encore à piocher': muteP(function (o) {
        var id = o.paquets.evenements.pioche[0];
        var cle = Object.keys(AT.plateau.cases(o.plateau)).filter(function (k) { return AT.plateau.peutPoserEvenement(o.plateau, id, k).ok; })[0];
        o.plateau.recouvrements.push({ evenement: id, cle: cle });
      }),
      'bataillon hors plateau': muteP(function (o) { o.bataillons.vert[0].case = '99,99'; o.bataillons.vert[0].troupes = [{ carte: o.paquets.vert.main.pop(), degats: 0 }]; }),
      'bataillon posé sans Troupe': muteP(function (o) { o.bataillons.vert[0].case = '0,0'; }),
      '9 bataillons': muteP(function (o) { o.bataillons.vert.push({ numero: 5, case: null, troupes: [], campement: false }); }),
      'dégâts au-delà du moral': muteP(function (o) { o.bataillons.rouge[0].case = '0,0'; o.bataillons.rouge[0].troupes = [{ carte: o.paquets.rouge.main.pop(), degats: 50 }]; }),
      'ville capturée qui n’est pas une ville': muteP(function (o) { o.villes['1,0'] = 'vert'; }),
      'propriétaire inconnu': muteP(function (o) { o.villes['0,0'] = 'bleu'; }),
      'Troupe au moral 0': muteP(function (o) { o.troupes.T1.moral = 0; }),
      'nom de Troupe de 41 caractères': muteP(function (o) { o.troupes.T1.nom = new Array(42).join('n'); }),
      'réglage hors bornes': muteP(function (o) { o.reglages.tailleMain = 1000; }),
      'journal : type HTML': muteP(function (o) { o.journal[0].type = '<b>'; }),
      'journal : texte trop long': muteP(function (o) { o.journal[0].texte = new Array(502).join('t'); }),
      'plateau : modèle inconnu': muteP(function (o) { o.plateau.pieces[0].modele = 'Z9'; }),
      'plateau : pièces vides': muteP(function (o) { o.plateau.pieces = []; }),
      'plateau : 3 cases dans un camp': muteP(function (o) { o.plateau.camps.vert.push('0,0'); })
    };
    var acceptesPartie = [];
    Object.keys(hostilesPartie).forEach(function (nom) {
      var accepte;
      try { accepte = vq.ouvrirTexte(hostilesPartie[nom]); } catch (e) { accepte = 'exception ' + e.message; }
      if (accepte !== false || JSON.stringify(vq.etat()) !== partieAvant || !/Fichier refusé/.test($('#barre-etat').textContent)) acceptesPartie.push(nom + ' → ' + accepte);
    });
    verifier(Object.keys(hostilesPartie).length + ' fichiers de partie malformés ou hostiles : tous refusés avec un message, partie inchangée', acceptesPartie.length === 0, acceptesPartie.join(' | '));
    var bavard = muteP(function (o) { o.journal[0].texte = '<img src=x onerror=alert(1)><script>alert(2)</script>'; o.graine = '"><svg onload=alert(3)>'; });
    verifier('journal et graine contenant du HTML : acceptés et affichés comme du texte', vq.ouvrirTexte(bavard) === true && $$('#atelier img, #atelier script').length === 0
      && $$('#atelier svg[onload]').length === 0 && /<img src=x/.test($('#pa-journal').textContent));
    verifier('toujours aucune pollution de Object.prototype', ({}).pollue === undefined);
    vq.ouvrirTexte(partie);
  });

  scenario('Essais : partie fictive complète de quelques tours', function () {
    var vq = AT.app.vues.partie, vp = AT.app.vues.plateau, PA = AT.partie, P = AT.plateau, vue = vq.vue;
    AT.app.montrer('partie');
    $('#pa-graine').value = 'campagne 3';
    clic($('#pa-nouvelle'));
    var e = vq.etat(), debut = JSON.stringify(e), operations = 0;
    function suivre() { operations += 1; return vq.etat(); }
    verifier('partie « campagne 3 » : graine en texte, plateau de l’onglet Plateau', e.graine === 'campagne 3' && JSON.stringify(e.plateau.pieces) === JSON.stringify(vp.plateau().pieces));

    // Tour 1 (Vert) : former sur ses deux villes de déploiement.
    var campsV = e.plateau.camps.vert, campsR = e.plateau.camps.rouge;
    clic($$('[data-main="vert"] .at-carte')[0]); clicCase(vue, campsV[0]); e = suivre();
    clic($$('[data-main="vert"] .at-carte')[0]); clic($('[data-former="' + campsV[1] + '"]')); e = suivre();
    verifier('tour 1 : Vert forme 2 bataillons sur ses villes de déploiement, 2 actions comptées', e.bataillons.vert[0].case === campsV[0] && e.bataillons.vert[1].case === campsV[1] && e.actions === 2 && !$('#pa-avertissement'));
    clic($$('[data-main="vert"] .at-carte')[0]); clicCase(vue, campsV[0]);
    e = suivre();
    verifier('renfort par clic sur le pion ; 3e action signalée sans être interdite', e.bataillons.vert[0].troupes.length === 2 && e.actions === 3 && /Plus de 2 actions/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    clic($('#pa-fin-tour')); e = suivre();
    var mainRouge = e.paquets.rouge.main.length;
    verifier('fin du tour 1 : Rouge joue et a pioché 1 carte', e.tour === 2 && e.actif === 'rouge' && mainRouge === 3 && e.actions === 0, mainRouge);

    // Tour 2 (Rouge) : former, puis former sur la ville de l'adversaire (avertissement, renoncer).
    clic($$('[data-main="rouge"] .at-carte')[0]); clicCase(vue, campsR[0]); e = suivre();
    clic($$('[data-main="rouge"] .at-carte')[0]); clicCase(vue, campsV[1]);
    verifier('Rouge sur une ville de Vert occupée : deux avertissements (hors déploiement, occupée), rien n’est fait', !!$('#pa-avertissement') && /ville de déploiement de Rouge/.test($('#pa-avertissement').textContent)
      && /occupée/.test($('#pa-avertissement').textContent) && vq.etat().bataillons.rouge[1].case === null);
    clic($('#pa-renoncer'));
    touche('Escape');
    clic($('#pa-fin-tour')); e = suivre();

    // Tour 3 (Vert) : marche vers la ville neutre la plus proche, case par case.
    var libres = P.villes(e.plateau).filter(function (k) { return campsV.indexOf(k) === -1 && campsR.indexOf(k) === -1 && k !== '0,0'; });
    var trajets = libres.map(function (k) { return P.chemin(e.plateau, campsV[1], k); }).filter(function (c) { return c.ok; }).sort(function (a, b) { return a.cout - b.cout; });
    var trajet = trajets[0], rations = 0, ecartsCout = [];
    clicCase(vue, campsV[1]);
    for (var i = 1; i < trajet.cases.length; i++) {
      var etiquette = $$('text', vue.svg).filter(function (t) { return t.textContent === String(P.cout(e.plateau, trajet.cases[i])); }).length;
      clicCase(vue, trajet.cases[i]);
      e = suivre();
      var ligne = e.journal[e.journal.length - 1].texte, lu = /\((\d+) ration\(s\)\)/.exec(ligne);
      if (!lu || parseInt(lu[1], 10) !== P.cout(e.plateau, trajet.cases[i]) || !etiquette) ecartsCout.push(trajet.cases[i]);
      rations += lu ? parseInt(lu[1], 10) : 0;
    }
    var cible = trajet.cases[trajet.cases.length - 1];
    verifier('marche de ' + trajet.pas + ' cases vers la ville neutre : pion arrivé, coût de chaque case au journal, total = chemin le moins cher', e.bataillons.vert[1].case === cible && ecartsCout.length === 0 && rations === trajet.cout,
      rations + ' / ' + trajet.cout + ' ' + ecartsCout.join(' '));
    verifier('le pion reste sélectionné et la ville sous lui peut être marquée', vq.ui().bataillon && vq.ui().bataillon.numero === 2 && !!$('[data-capture="vert"]'));
    clic($('[data-capture="vert"]')); e = suivre();
    verifier('capture : ville à Vert, bouton « À Vert » désactivé, Gloire inchangée (rien d’automatique)', e.villes[cible] === 'vert' && $('[data-capture="vert"]').disabled && e.gloire.vert === 0);
    clic($('[data-gloire-plus="vert"]')); e = suivre();
    touche('Escape');

    // Montagne : déplacement vers une case infranchissable (avertissement), puis forcé.
    var cases = P.cases(e.plateau);
    var montagne = Object.keys(cases).filter(function (k) { return cases[k].terrain === 'montagne' && AT.hex.voisines(k).some(function (v) { return cases[v] && cases[v].terrain !== 'montagne'; }); })[0];
    var pied = AT.hex.voisines(montagne).filter(function (v) { return cases[v] && cases[v].terrain !== 'montagne' && !PA.occupants(e, v).length; })[0];
    var r = vq.executer('deplacer', { joueur: 'vert', numero: 1, cle: pied, forcer: true }); e = suivre();
    clicCase(vue, pied); clicCase(vue, montagne);
    verifier('déplacement vers une montagne : avertissement « infranchissable », ✕ affiché sur la case', r.ok && !!$('#pa-avertissement') && /infranchissable/.test($('#pa-avertissement').textContent)
      && $$('text', vue.svg).some(function (t) { return t.textContent === '✕'; }) && vq.etat().bataillons.vert[0].case === pied);
    clic($('#pa-forcer')); e = suivre();
    verifier('« Faire quand même » : pion sur la montagne, noté « (infranchissable) » et « (forcé) »', e.bataillons.vert[0].case === montagne && /\(infranchissable\) \(forcé\)/.test(e.journal[e.journal.length - 1].texte), e.journal[e.journal.length - 1].texte);
    touche('Escape');

    // Dés, Campement (par bataillon : une fois, puis avertissement), dégâts jusqu'à l'élimination.
    clic($('[data-lancer="vert-1"]')); e = suivre();
    var des = $$('#pa-resultat-des .at-de').map(function (d) { return parseInt(d.textContent, 10); });
    verifier('dés du bataillon : valeurs de 1 à 6, total exact', des.length > 0 && des.every(function (d) { return d >= 1 && d <= 6; })
      && new RegExp('total ' + des.reduce(function (a, b) { return a + b; }, 0) + '$').test($('#pa-resultat-des').textContent), des.join());
    $('#pa-nb-des').value = '';
    clic($('#pa-lancer'));
    verifier('nombre de dés vide : refus expliqué', /Refusé : Nombre de dés invalide/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    $('#pa-nb-des').value = '101';
    clic($('#pa-lancer'));
    verifier('101 dés : refus expliqué', /Refusé : Nombre de dés invalide/.test($('#barre-etat').textContent));
    $('#pa-nb-des').value = '2';
    clic(texteBouton($('[data-bataillon="vert-2"]'), /^Carte Campement$/)); e = suivre();
    var campement = e.paquets.campement.defausse[e.paquets.campement.defausse.length - 1];
    verifier('carte Campement par un bataillon : texte exact de l’annexe, bataillon marqué', $('#pa-carte-campement .at-texte-carte').textContent === AT.cartes.trouver(campement).texte
      && e.bataillons.vert[1].campement === true && /a pioché un Campement/.test($('[data-bataillon="vert-2"]').textContent));
    clic(texteBouton($('[data-bataillon="vert-2"]'), /^Carte Campement$/));
    verifier('deuxième carte Campement pour le même bataillon : avertissement', !!$('#pa-avertissement') && /déjà pioché/.test($('#pa-avertissement').textContent) && vq.etat().paquets.campement.defausse.length === 1);
    clic($('#pa-renoncer'));
    var troupe = PA.troupeDe(e, e.bataillons.vert[1].troupes[0].carte);
    for (i = 0; i < troupe.moral; i++) { clic($('[data-degats="vert-2-0"]')); e = suivre(); }
    verifier('dégâts jusqu’au moral : Troupe éliminée, bataillon en réserve, carte dans la défausse, ville toujours à Vert', e.bataillons.vert[1].case === null && e.bataillons.vert[1].campement === false
      && e.paquets.vert.defausse.length === 1 && e.villes[cible] === 'vert');

    // Événements : piocher et poser jusqu'à ce qu'une tuile soit sur le plateau ; une tuile sous un pion est refusée.
    var posee = null, essais = 0;
    while (!posee && essais < 8 && !$('#pa-piocher-evenement').disabled) {
      essais += 1;
      clic($('#pa-piocher-evenement')); e = suivre();
      var id = vq.ui().evenement, occupees = [];
      ['vert', 'rouge'].forEach(function (j) { e.bataillons[j].forEach(function (b) { if (b.case) occupees.push(b.case); }); });
      var admissibles = AT.vuePlateau.casesAdmissibles(e.plateau, id, occupees);
      if (!admissibles.length) { touche('Escape'); continue; }
      clicCase(vue, admissibles[admissibles.length - 1]); e = suivre();
      posee = { id: id, cle: admissibles[admissibles.length - 1] };
    }
    var ev = posee ? AT.catalogue.evenement(posee.id) : null;
    verifier('événement posé sur le plateau de la partie : terrain de la case changé, carte dans la défausse Événement', !!posee && P.cases(e.plateau)[posee.cle].terrain === ev.terrain && P.cases(e.plateau)[posee.cle].evenement === posee.id
      && e.paquets.evenements.defausse.indexOf(posee.id) !== -1 && e.paquets.evenements.pioche.indexOf(posee.id) === -1 && e.paquets.evenements.main.indexOf(posee.id) === -1, posee && posee.id);
    verifier('compteurs Événements à jour', new RegExp('Pioche : ' + e.paquets.evenements.pioche.length + ' — Tuiles posées : 1 — En attente de pose : ' + e.paquets.evenements.main.length).test($('#pa-evenements').textContent), $('#pa-evenements .at-compteurs').textContent);
    var deuxieme = vq.executer('poserEvenement', { evenement: posee.id, cle: posee.cle, forcer: true });
    verifier('la même tuile ne se pose pas deux fois, même en forçant', deuxieme.ok === false && vq.etat().plateau.recouvrements.length === 1, deuxieme.raison);
    clic($('#pa-fin-tour')); e = suivre();
    clic($('#pa-fin-tour')); e = suivre();
    verifier('deux fins de tour : tour 5, Vert joue', e.tour === 5 && e.actif === 'vert');

    // Gloire jusqu'à 15 : victoire signalée, bornes tenues.
    for (i = e.gloire.vert; i < 15; i++) { clic($('[data-gloire-plus="vert"]')); e = suivre(); }
    verifier('Gloire de Vert à 15 : victoire affichée et journalisée, bouton + désactivé', e.gloire.vert === 15 && /Victoire : Vert/.test($('#pa-victoire').textContent) && $('[data-gloire-plus="vert"]').disabled
      && e.journal.some(function (l) { return l.type === 'victoire'; }));
    var trop = vq.executer('modifierGloire', { joueur: 'vert', delta: 5 }); e = suivre();
    verifier('Gloire au-delà de 15 par l’interface interne : bornée à 15', trop.ok && e.gloire.vert === 15);
    verifier('Gloire de Rouge à 0 : bouton − désactivé', e.gloire.rouge === 0 && $$('.at-joueur-rouge .at-gloire button')[0].disabled);
    clic($$('.at-joueur-vert .at-gloire button')[0]); e = suivre();
    verifier('Gloire − : 14, plus de victoire affichée', e.gloire.vert === 14 && !$('#pa-victoire') && !$('[data-gloire-plus="vert"]').disabled);

    // Enregistrer, rouvrir, et vérifier que la suite des tirages est la même.
    var fin = JSON.stringify(e), texte = vq.texteEnregistrement();
    telecharges.length = 0;
    clic($('#pa-enregistrer'));
    verifier('partie enregistrée : nom de fichier sans caractère gênant', telecharges.length === 1 && telecharges[0].nom === 'partie-graine-campagne_3-tour-5.json', telecharges.map(function (t) { return t.nom; }).join());
    $('#pa-nb-des').value = '6';
    clic($('#pa-lancer'));
    var tirage = $('#pa-resultat-des').textContent;
    clic($('[data-campement="rouge"]'));
    var carteApres = $('#pa-carte-campement').textContent;
    verifier('partie rouverte : état identique', vq.ouvrirTexte(texte) === true && JSON.stringify(vq.etat()) === fin && $('#pa-graine').value === 'campagne 3');
    clic($('#pa-lancer'));
    var tirage2 = $('#pa-resultat-des').textContent;
    clic($('[data-campement="rouge"]'));
    verifier('après réouverture : mêmes dés et même carte Campement qu’avant', tirage2 === tirage && $('#pa-carte-campement').textContent === carteApres && /total/.test(tirage), tirage + ' / ' + tirage2);
    vq.ouvrirTexte(texte);

    // Annuler jusqu'au début, rétablir jusqu'à la fin.
    var pas = 0;
    while (JSON.stringify(vq.etat()) !== debut && !$('#pa-annuler').disabled && pas < 400) { clic($('#pa-annuler')); pas += 1; }
    verifier('annuler jusqu’au début de la partie : mise en place retrouvée à l’identique', JSON.stringify(vq.etat()) === debut && $$('.at-bataillon-reserve').length === 8, pas + ' annulations');
    var retours = 0;
    while (!$('#pa-retablir').disabled && retours < 400) { clic($('#pa-retablir')); retours += 1; }
    verifier('rétablir jusqu’au bout : état final retrouvé à l’identique', JSON.stringify(vq.etat()) === fin && retours === pas, retours + ' / ' + pas);
    touche('z', { ctrlKey: true }); touche('z', { ctrlKey: true });
    clic($('[data-gloire-plus="rouge"]'));
    verifier('une opération après « Annuler » vide la liste à rétablir', $('#pa-retablir').disabled && vq.etat().gloire.rouge === 1);
  });

  scenario('Essais : même graine = mêmes tirages', function () {
    var vq = AT.app.vues.partie, vp = AT.app.vues.plateau;
    AT.app.montrer('partie');
    function derouler(graine) {
      $('#pa-graine').value = graine;
      clic($('#pa-nouvelle'));
      $('#pa-nb-des').value = '5';
      clic($('#pa-lancer'));
      clic($('[data-campement="rouge"]'));
      clic($('#pa-piocher-evenement'));
      touche('Escape');
      clic($('[data-paquet-de="vert"]'));
      clic($('[data-operation="hasard"]') || $$('[data-operation]')[0]);
      clic($('#pa-fin-tour'));
      clic($('#pa-fin-tour'));
      clic($('#pa-lancer'));
      return JSON.stringify(vq.etat());
    }
    var a = derouler('abc'), b = derouler('abc'), c = derouler('abd'), d = derouler('7'), d2 = derouler('7');
    verifier('même graine, même suite d’opérations : parties identiques au caractère près (mains, dés, Campement, événement)', a === b && d === d2 && JSON.parse(a).journal.length > 8);
    verifier('autre graine : autres tirages', a !== c && a !== d);
    // Le plateau compte aussi : autre plateau, même graine de partie.
    AT.app.montrer('plateau');
    $('#pl-graine').value = '2';
    clic($('#pl-generer'));
    AT.app.montrer('partie');
    var autrePlateau = JSON.parse(derouler('abc')), memePlateau = JSON.parse(a);
    verifier('autre plateau, même graine de partie : mêmes mains et mêmes dés, plateau différent', JSON.stringify(autrePlateau.paquets) === JSON.stringify(memePlateau.paquets)
      && JSON.stringify(autrePlateau.plateau) !== JSON.stringify(memePlateau.plateau));
    AT.app.montrer('plateau');
    $('#pl-graine').value = '1';
    clic($('#pl-generer'));
    verifier('fin des essais : plateau de référence (graine 1, seuil 3) sans erreur', vp.plateau().graine === 1 && vp.bilan().erreurs === 0 && vp.reglages().seuilContact === 3);
    AT.app.montrer('partie');
  });

  // ================================================================== I. corrections demandées après la revue (docs/05)
  scenario('Corrections après la revue', function () {
    var vp = AT.app.vues.plateau, vq = AT.app.vues.partie, P = AT.plateau, C = AT.catalogue, vue = vp.vue;
    AT.app.montrer('plateau');
    var depart = JSON.stringify(vp.plateau()), rang = vp.etat().rang;

    // Trou : un monobloc entièrement entouré est retiré (catalogue 2 : plus de tuile de terrain d'une case).
    var cases = P.cases(vp.plateau(), { sansVilles: true }), parPiece = {};
    Object.keys(cases).forEach(function (k) { (parPiece[cases[k].piece] = parPiece[cases[k].piece] || []).push(k); });
    var idEntouree = Object.keys(parPiece).filter(function (id) {
      return cases[parPiece[id][0]].modele !== 'N1' && parPiece[id].every(function (k) { return AT.hex.voisines(k).every(function (v) { return !!cases[v]; }); });
    })[0];
    var entouree = idEntouree ? parPiece[idEntouree][0] : null, tailleTrou = idEntouree ? parPiece[idEntouree].length : 0;
    verifier('plateau généré : le contrôle 2 annonce « aucun trou » ; un monobloc y est entièrement entouré', /aucun trou/.test($('#pl-controles').textContent) && !!entouree, idEntouree);
    clicCase(vue, entouree);
    touche('Delete');
    var constatTrou = $$('#pl-controles button.at-constat[data-regle="continuite"]').filter(function (b) { return /trou/i.test(b.textContent); })[0];
    verifier('monobloc entouré retiré : le contrôle 2 signale un trou, en alerte et non en erreur', !!constatTrou && constatTrou.getAttribute('data-niveau') === 'alerte'
      && new RegExp('Un trou dans le plateau : ' + tailleTrou + ' cases vides entourées').test(constatTrou.textContent), constatTrou && constatTrou.textContent);
    constatTrou.dispatchEvent(new MouseEvent('mouseenter'));
    verifier('survol du constat : les cases du trou sont en surbrillance (des cases vides)', marques(vue, 'at-surbrillance') === tailleTrou, marques(vue, 'at-surbrillance'));
    constatTrou.dispatchEvent(new MouseEvent('mouseleave'));
    verifier('le trou n’empêche pas la suite : étape « construction », 1 pièce de terrain à poser', vp.bilan().etape === 'construction' && /1 pièce de terrain à poser/.test($('#pl-etape').textContent), $('#pl-etape').textContent);
    var erreursAvecTrou = vp.bilan().erreurs;
    var niveau = C.REGLAGES.trous;
    C.REGLAGES.trous = 'erreur';
    choisir($('#pl-affichage'), 'rien');
    var enErreur = vp.bilan().erreurs;
    C.REGLAGES.trous = 'ignore';
    choisir($('#pl-affichage'), 'rien');
    var ignore = !/trou/i.test($('#pl-controles').textContent) && vp.bilan().erreurs === erreursAvecTrou;
    C.REGLAGES.trous = niveau;
    choisir($('#pl-affichage'), 'rien');
    verifier('réglage « trous » : erreur, puis ignoré, puis de nouveau alerte', enErreur === erreursAvecTrou + 1 && ignore && /Un trou dans le plateau/.test($('#pl-controles').textContent), enErreur);
    choisir($('#pl-seuil'), 3);
    while (vp.etat().rang > rang) touche('z', { ctrlKey: true });
    verifier('retour au plateau généré', JSON.stringify(vp.plateau()) === depart && vp.bilan().erreurs === 0);

    // Générateur : catalogue hors de ce qu'il sait poser → échec immédiat, cause nommée, pas de conseil trompeur.
    var villes = C.MODELES.VN.nombre;
    C.MODELES.VN.nombre = 3;
    try { clic($('#pl-generer')); } finally { C.MODELES.VN.nombre = villes; }
    verifier('catalogue à 3 villes neutres : la génération échoue tout de suite en nommant la cause', !$('#pl-avis').hidden && /le générateur pose 2 villes neutres/.test($('#pl-avis').textContent)
      && !/Essayez la graine suivante/.test($('#pl-avis').textContent) && JSON.stringify(vp.plateau()) === depart, $('#pl-avis').textContent);
    clic($('#pl-generer'));
    verifier('catalogue rétabli : la génération reprend', $('#pl-avis').hidden && vp.bilan().erreurs === 0 && vp.plateau().pieces.length === 26);

    // Partie : choix du premier joueur.
    AT.app.montrer('partie');
    verifier('premier joueur : liste Vert / Rouge, réglée sur le réglage par défaut', $$('#pa-premier option').length === 2 && $('#pa-premier').value === AT.cartes.REGLAGES.premierJoueur);
    choisir($('#pa-premier'), 'rouge');
    $('#pa-graine').value = '31';
    clic($('#pa-nouvelle'));
    var e = vq.etat();
    verifier('nouvelle partie avec Rouge en premier : Rouge joue le tour 1 et a pioché, c’est écrit', e.actif === 'rouge' && e.reglages.premierJoueur === 'rouge' && e.tour === 1 && e.paquets.rouge.main.length === 3
      && e.paquets.vert.main.length === 2 && /au tour de Rouge/.test($('#pa-tour-texte').textContent) && /Rouge commence/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    var rougeEnPremier = vq.texteEnregistrement();
    choisir($('#pa-premier'), 'vert');
    clic($('#pa-nouvelle'));
    verifier('nouvelle partie avec Vert en premier', vq.etat().actif === 'vert' && vq.etat().paquets.vert.main.length === 3);
    verifier('partie rouverte : la liste reprend le premier joueur du fichier', vq.ouvrirTexte(rougeEnPremier) === true && $('#pa-premier').value === 'rouge' && vq.etat().actif === 'rouge');
    choisir($('#pa-premier'), 'vert');
    clic($('#pa-nouvelle'));

    // Champ des dés : suit le réglage desMax de la partie.
    e = vq.etat();
    verifier('champ des dés : maximum = réglage desMax de la partie', $('#pa-nb-des').max === String(e.reglages.desMax) && e.reglages.desMax === AT.cartes.REGLAGES.desMax, $('#pa-nb-des').max);
    var grand = JSON.parse(vq.texteEnregistrement());
    grand.reglages.desMax = 50;
    vq.ouvrirTexte(JSON.stringify(grand));
    $('#pa-nb-des').value = '40';
    clic($('#pa-lancer'));
    verifier('partie réglée sur 50 dés au plus : le champ passe à 50 et 40 dés se lancent', $('#pa-nb-des').max === '50' && $$('#pa-resultat-des .at-de').length === 40, $('#pa-nb-des').max);
    $('#pa-nb-des').value = '2';
    clic($('#pa-nouvelle'));
    verifier('nouvelle partie : le champ revient au réglage par défaut', $('#pa-nb-des').max === String(AT.cartes.REGLAGES.desMax));

    // Carte Événement en attente : défaussée sans être posée, puis annulation.
    clic($('#pa-piocher-evenement'));
    var id = vq.ui().evenement;
    var boutonDefausse = $('[data-defausser-evenement="' + id + '"]');
    verifier('carte Événement en attente : bouton « Défausser sans poser »', !!id && !!boutonDefausse && /Défausser sans poser/.test(boutonDefausse.textContent));
    clic(boutonDefausse);
    e = vq.etat();
    verifier('défausser sans poser : carte dans la défausse Événement, aucune tuile posée, plus de pose en cours, au journal', e.paquets.evenements.main.length === 0 && e.paquets.evenements.defausse.indexOf(id) !== -1
      && e.plateau.recouvrements.length === 0 && vq.ui().evenement === null && marques(vq.vue, 'at-admissible') === 0 && !$('[data-defausser-evenement]')
      && /défaussée sans être posée/.test(e.journal[e.journal.length - 1].texte) && /Pioche : 7 — Tuiles posées : 0 — En attente de pose : 0/.test($('#pa-evenements').textContent), $('#pa-evenements').textContent);
    clic($('#pa-annuler'));
    verifier('annuler : la carte revient en attente de pose', vq.etat().paquets.evenements.main.indexOf(id) !== -1 && !!$('[data-defausser-evenement="' + id + '"]'));
    clic($('#pa-retablir'));
    verifier('rétablir : de nouveau défaussée ; le fichier de la partie se relit', vq.etat().paquets.evenements.defausse.indexOf(id) !== -1 && vq.ouvrirTexte(vq.texteEnregistrement()) === true);
    AT.app.montrer('plateau');
    $('#pl-graine').value = '1';
    clic($('#pl-generer'));
    AT.app.montrer('partie');
  });

  // ================================================================== F bis. création à la main : modèle (lot D)
  // Ici, l'interface de la première livraison devant un document fait à la main ; les écrans de création (lot E) suivent.
  scenario('Création à la main : modèle (pièce personnelle, M1, équilibre non comparable)', function () {
    var vp = AT.app.vues.plateau, vq = AT.app.vues.partie, P = AT.plateau, B = AT.bibliotheque;
    AT.app.montrer('plateau');
    var doc = P.ajouterModele(P.vierge('main'), { nom: 'Crête', quantite: 2, cases: [{ q: 0, r: 0, terrain: 'montagne' }, { q: 1, r: 0, terrain: 'foret' }, { q: 1, r: 1, terrain: 'plaine' }] }).plateau;
    // Les tuiles d'une case P et V viennent du premier catalogue : hors catalogue, elles se posent hors stock.
    [['X1', 2, 0], ['V', 0, -2], ['P', 0, 2], ['V', 0, 3], ['P', 1, -2]].forEach(function (x) { doc = P.poser(doc, x[0], x[1], x[2], 0, { horsStock: x[0] !== 'X1' }).plateau; });
    doc = P.avecCamps(P.peindre(doc, '-2,0', 'montagne').plateau);
    verifier('fichier avec une pièce personnelle et une montagne d’une case : ouvert et dessiné', vp.ouvrirTexte(P.serialiser(doc)) === true && casesDessinees(vp.vue) === 15, casesDessinees(vp.vue));
    var texte = $('#pl-controles').textContent;
    verifier('contrôle 1 : tuiles de l’ancien catalogue comptées à part ; « à prévoir en plus du catalogue » (la seule montagne d’une case) et « montagne d’une case » en alerte, sans erreur d’inventaire',
      /Plateau de l’ancien catalogue : 4 tuiles d’une case de ce catalogue \(2 × Plaine, 2 × Ville \(ancien catalogue\)\)/.test(texte)
      && /Tuiles à prévoir en plus du catalogue \(1\) : 1 × Montagne d’une case\./.test(texte) && /1 montagne d’une case sur le plateau/.test(texte)
      && /Pièces personnelles restantes \(1\) : 1 × Crête/.test(texte) && !$('#pl-controles [data-regle="inventaire"][data-niveau="erreur"]'), texte.slice(0, 300));
    verifier('équilibre sans symétrie : tableau des coûts par ville, score calculé sur un plateau qui n’est pas symétrique',
      $$('#pl-equilibre tbody tr').length === 3 && /Score d’équilibre : \d+ \(0 = équilibré\)/.test($('#pl-score').textContent)
      && !/null|undefined|NaN|non comparable/.test(texte) && typeof vp.bilan().equilibre.score === 'number', $('#pl-score') && $('#pl-score').textContent);
    clicCase(vp.vue, '3,0');
    verifier('pièce personnelle sélectionnée : nommée, ses 3 cases marquées', /Pièce sélectionnée : Crête \(3 cases\)/.test($('#pl-outil').textContent) && marques(vp.vue, 'at-selection') === 3, $('#pl-outil').textContent);
    clic($('#pl-tourner'));
    var crete = vp.plateau().pieces.filter(function (p) { return p.modele === 'X1'; })[0];
    verifier('pièce personnelle tournée ; le document garde ses pièces personnelles', crete.rotation === 1 && vp.plateau().modeles.length === 1 && casesDessinees(vp.vue) === 15, crete.rotation);
    clicCase(vp.vue, '-2,0');
    verifier('montagne d’une case sélectionnée : nommée', /Pièce sélectionnée : Montagne d’une case \(1 case\)/.test($('#pl-outil').textContent), $('#pl-outil').textContent);
    verifier('le plateau fait à la main s’enregistre et se relit', P.lire(vp.texteEnregistrement()).ok === true && /"modeles"/.test(vp.texteEnregistrement()));
    AT.app.montrer('partie');
    clic($('#pa-nouvelle'));
    verifier('partie sur ce plateau : créée, dessinée, enregistrée puis rouverte avec ses pièces personnelles',
      casesDessinees(vq.vue) === 15 && vq.etat().plateau.modeles[0].id === 'X1' && vq.ouvrirTexte(vq.texteEnregistrement()) === true && vq.etat().plateau.modeles[0].nom === 'Crête', casesDessinees(vq.vue));
    AT.app.montrer('plateau');
    clic($('#pl-vider'));
    verifier('vider le plateau : les pièces personnelles restent dans le document', vp.plateau().pieces.length === 0 && vp.plateau().modeles.length === 1);
    $('#pl-graine').value = '1';
    clic($('#pl-generer'));
    verifier('générer sur un document à pièces personnelles : plateau généré, pièces reportées non posées, note affichée',
      vp.plateau().pieces.length === 26 && vp.plateau().modeles.length === 1 && $('#pl-avis').hidden && /1 pièce personnelle est conservée dans le plateau, non posée/.test($('#barre-etat').textContent)
      && /Pièces personnelles restantes \(2\) : 2 × Crête/.test($('#pl-controles').textContent) && vp.bilan().erreurs === 0, $('#barre-etat').textContent);
    AT.app.montrer('inventaire');
    verifier('inventaire : le catalogue imprimé ne compte ni M1 ni les pièces personnelles',
      $$('#inv-pieces tbody tr[data-modele]').length === 26 && /Catalogue : 28 pièces, 95 cases/.test($('#inv-totaux').textContent) && !$('#inv-pieces [data-modele="M1"]') && !$('#inv-pieces [data-modele="X1"]')
      && !$('#inv-pieces [data-modele="P"]'), $('#inv-totaux').textContent);
    // Bibliothèque : module chargé ; le stockage du navigateur est seulement LU ici (rien n'est écrit sur ce poste).
    var stockage = B.stockageNavigateur(), lu = B.charger(stockage), travail = B.chargerTravail(stockage);
    verifier('bibliothèque : lecture du stockage du navigateur sans exception (présent ou non)',
      (stockage === null || typeof stockage.getItem === 'function') && typeof lu.ok === 'boolean' && Array.isArray(lu.liste) && typeof travail.ok === 'boolean', String(lu.raison));
    var memoire = B.stockageMemoire(), ajout = B.ajouter(B.vide(), 'Essai', doc);
    verifier('bibliothèque : ajouter, enregistrer et recharger un plateau fait à la main (stockage en mémoire)',
      ajout.ok && B.enregistrer(memoire, ajout.liste).ok && JSON.stringify(B.charger(memoire).liste[0].plateau) === JSON.stringify(doc));
    // Retour à l'état attendu par la suite : plateau généré sans pièce personnelle, onglet Partie.
    AT.app.montrer('plateau');
    vp.ouvrirTexte(P.serialiser(AT.generateur.generer(1, vp.reglages()).plateau));
    AT.app.montrer('partie');
  });

  // ================================================================== lot E : création à la main (interface)
  function pointeur(cible, type, p, options) {
    var o = { clientX: p.x, clientY: p.y, button: 0, pointerId: 1, bubbles: true, cancelable: true };
    Object.keys(options || {}).forEach(function (k) { o[k] = options[k]; });
    cible.dispatchEvent(new PointerEvent(type, o));
  }
  /** Appui sur la première case, passage par les suivantes, relâchement, puis le clic que le navigateur envoie après. */
  function glisserCases(vue, cles, options, avantRelachement) {
    var points = cles.map(function (k) { return vue.pointEcran(k); }), dernier = points[points.length - 1];
    pointeur(vue.svg, 'pointerdown', points[0], options);
    points.slice(1).forEach(function (p) { pointeur(vue.svg, 'pointermove', p, options); });
    if (avantRelachement) avantRelachement();
    pointeur(vue.svg, 'pointerup', dernier, options);
    vue.svg.dispatchEvent(new MouseEvent('click', { clientX: dernier.x, clientY: dernier.y, bubbles: true, cancelable: true }));
  }
  /** Glisser-déposer d'une pièce de la palette jusqu'à un point de l'écran (événements pointeur réels, clic final compris). */
  function glisserPalette(idModele, arrivee, avantRelachement) {
    var bouton = $('#pl-stock [data-modele="' + idModele + '"]'), b = bouton.getBoundingClientRect();
    var depart = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    pointeur(bouton, 'pointerdown', depart);
    pointeur(document.body, 'pointermove', { x: depart.x + 14, y: depart.y + 9 });
    pointeur(document.body, 'pointermove', arrivee);
    if (avantRelachement) avantRelachement();
    pointeur(document.body, 'pointerup', arrivee);
    var apres = $('#pl-stock [data-modele="' + idModele + '"]');
    if (apres) apres.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  function casesGrilleDessinees(vue) { return $$('svg > g:nth-of-type(2) > polygon', vue.svg.parentNode).length; }
  function visible(element) { return !!element && element.offsetParent !== null; }
  function saisir(champ, valeur) { champ.value = valeur; champ.dispatchEvent(new Event('input', { bubbles: true })); }
  function reste(nom) { var e = $('#cr-reste [data-reste="' + nom + '"]'); return e ? e.textContent : ''; }
  function mode(id) { clic($('#pl-mode-' + id)); }
  /** Amène le curseur du clavier sur une case, par les flèches. */
  function allerCurseur(vue, cle) {
    var but = AT.hex.decle(cle), garde = 0;
    while (AT.hex.decle(vue.curseur()).r > but.r && garde++ < 40) touche('ArrowUp', {}, vue.svg);
    while (AT.hex.decle(vue.curseur()).r < but.r && garde++ < 40) touche('ArrowDown', {}, vue.svg);
    while (AT.hex.decle(vue.curseur()).q < but.q && garde++ < 80) touche('ArrowRight', {}, vue.svg);
    while (AT.hex.decle(vue.curseur()).q > but.q && garde++ < 80) touche('ArrowLeft', {}, vue.svg);
  }
  function pieceEn(vp, cle) { var c = AT.plateau.cases(vp.plateau())[cle]; return c ? vp.plateau().pieces.filter(function (p) { return p.id === c.piece; })[0] : null; }
  function plateauDeReference() {
    var vp = AT.app.vues.plateau;
    AT.app.montrer('plateau');
    mode('generer');
    vp.ouvrirTexte(AT.plateau.serialiser(AT.generateur.generer(1, vp.reglages()).plateau));
  }

  scenario('Lot E : modes de l’onglet Plateau et création guidée', async function () {
    var vp = AT.app.vues.plateau, P = AT.plateau, vue = vp.vue;
    plateauDeReference();
    verifier('six modes en tête de la colonne de gauche (dont « Villes »), « Générer » au démarrage', $$('#pl-modes button').length === 6 && !!$('#pl-mode-villes') && vp.mode() === 'generer'
      && $('#pl-mode-generer').getAttribute('aria-pressed') === 'true' && visible($('#pl-generer')) && !visible($('#pl-stock')) && !visible($('#cr-reste')));
    verifier('mode « Générer » : aucune grille vide, 93 cases', casesGrilleDessinees(vue) === 0 && casesDessinees(vue) === 93, casesGrilleDessinees(vue));
    mode('creer');
    var attendu = AT.rendu.casesGrille(vp.plateau(), 7).length;
    verifier('mode « Créer à la main » : palette et « reste à faire » visibles, « Générer » masqué', vp.mode() === 'creer' && visible($('#pl-stock')) && visible($('#cr-reste')) && !visible($('#pl-generer'))
      && $('#pl-mode-creer').getAttribute('aria-pressed') === 'true');
    verifier('grille vide jusqu’au rayon 7 : cases fantômes dessinées hors de la scène (les 93 cases restent 93)', casesGrilleDessinees(vue) === attendu && attendu > 60 && casesDessinees(vue) === 93, casesGrilleDessinees(vue) + ' / ' + attendu);
    verifier('plateau généré complet : « Plateau terminé », terrain construit, villes posées, remplissages facultatifs en réserve', !!$('#cr-termine') && /toutes les pièces de terrain sont posées/.test(reste('pieces'))
      && /Villes : 7 \/ 7/.test(reste('villes')) && /Villes neutres \(une par flanc\) : 2 \/ 2/.test(reste('neutres')) && /facultatives\) : 2 × Remplissage/.test(reste('facultatives')), $('#cr-reste').textContent);
    // 93 cases, plus les tuiles dessinées par-dessus : 2 polygones par ville de déploiement (4) et par ville neutre (2).
    verifier('l’export ne contient pas la grille vide', (vp.imageExport().texte.match(/<polygon/g) || []).length === 93 + 8 + 4, (vp.imageExport().texte.match(/<polygon/g) || []).length);

    var rangAvant = vp.etat().rang;
    clic($('#cr-vierge'));
    verifier('« Nouveau plateau vierge » : le seul noyau au centre (7 cases)', vp.plateau().pieces.length === 1 && vp.plateau().pieces[0].modele === 'N1' && casesDessinees(vue) === 7 && vp.etat().rang === rangAvant + 1);
    verifier('grille vide : 169 − 7 = 162 cases fantômes cliquables', casesGrilleDessinees(vue) === 162, casesGrilleDessinees(vue));
    verifier('palette du catalogue 2 : 25 pièces par rôle et par taille, remplissages « facultatif », villes absentes (étape « Villes »), noyau épuisé', $$('#pl-stock [data-modele]').length === 25 && $$('#pl-stock [data-modele] svg').length === 25
      && $('#pl-stock [data-modele="N1"]').disabled && /Pré en losange × 1/.test($('#pl-stock [data-modele="P4A"]').textContent) && !$('#pl-stock [data-modele="VN"]') && !!$('#cr-note-villes')
      && $$('#pl-stock h3[data-groupe]').map(function (h) { return h.getAttribute('data-groupe'); }).join() === 'socle,quatre,trois,remplissage' && /facultatif/.test($('#pl-stock [data-modele="R"]').textContent)
      && /Remplissage × 2/.test($('#pl-stock [data-modele="R"]').textContent) && !$('#pl-stock [data-modele="P"]') && !$('#pl-stock [data-modele="V"]'), $$('#pl-stock [data-modele]').length);
    verifier('reste à faire : 23 pièces de terrain, 6 villes, 2 villes de déploiement en haut et 2 en bas, 2 villes neutres, erreurs en cours',
      /à poser : 23/.test(reste('pieces')) && /1 × Pré en losange/.test(reste('pieces')) && /Villes : 1 \/ 7 — il en manque 6/.test(reste('villes')) && /Villes neutres \(une par flanc\) : 0 \/ 2 — il en manque 2/.test(reste('neutres'))
      && /en haut \(Vert\) : 0 \/ 2 — il en manque 2/.test(reste('haut')) && /en bas \(Rouge\) : 0 \/ 2 — il en manque 2/.test(reste('bas'))
      && /Erreurs en cours : [1-9]/.test(reste('erreurs')) && !$('#cr-termine'), $('#cr-reste').textContent);
    clic($('#pl-annuler'));
    verifier('le plateau vierge s’annule : retour au plateau généré', vp.plateau().pieces.length === 26);
    clic($('#pl-retablir'));

    // Pose par clic, sur une case vide de la grille.
    clic($('#pl-stock [data-modele="R"]'));
    survolCase(vue, '1,-4');
    var fantome = $('.at-interface .at-fantome', vue.svg);
    verifier('aperçu fantôme vert, en attributs SVG, sur une case libre', !!fantome && fantome.getAttribute('fill') === '#00965A' && getComputedStyle(fantome).fill === 'rgb(0, 150, 90)' && marques(vue, 'at-fantome-refus') === 0,
      fantome && fantome.getAttribute('fill') + ' / ' + getComputedStyle(fantome).fill);
    survolCase(vue, '0,0');
    fantome = $('.at-interface .at-fantome', vue.svg);
    verifier('aperçu fantôme rouge sur une case occupée', !!fantome && fantome.getAttribute('fill') === '#D8321C' && getComputedStyle(fantome).fill === 'rgb(216, 50, 28)' && marques(vue, 'at-fantome-refus') === 1);
    clicCase(vue, '1,-4');
    verifier('pose par clic sur une case vide de la grille', !!pieceEn(vp, '1,-4') && pieceEn(vp, '1,-4').modele === 'R' && /Remplissage × 1/.test($('#pl-stock [data-modele="R"]').textContent));
    verifier('reste à faire mis à jour, par étape : 1 tuile de remplissage en réserve ; construction en cours, villes ensuite', /1 × Remplissage/.test(reste('facultatives'))
      && $('#cr-reste [data-etape="construction"]').getAttribute('data-etat') === 'en-cours' && $('#cr-reste [data-etape="villes"]').getAttribute('data-etat') === 'ensuite', $('#cr-reste').textContent);
    touche('Escape');

    // Glisser-déposer depuis la palette, avec rotation par R pendant le glisser.
    var rang = vp.etat().rang, pendant = null;
    glisserPalette('M4', vue.pointEcran('3,1'), function () {
      touche('r');
      var f = $('.at-interface .at-fantome', vue.svg);
      pendant = { cases: marques(vue, 'at-fantome'), vert: !!f && f.getAttribute('fill') === '#00965A', rotation: vp.etat().aPoser && vp.etat().aPoser.rotation, rang: vp.etat().rang };
    });
    var m4 = vp.plateau().pieces.filter(function (p) { return p.modele === 'M4'; })[0];
    verifier('glisser-déposer : aperçu de 4 cases, vert, tourné par R pendant le glisser, rien de posé avant le relâchement',
      !!pendant && pendant.cases === 4 && pendant.vert && pendant.rotation === 1 && pendant.rang === rang, JSON.stringify(pendant));
    verifier('glisser-déposer : pièce posée à la case visée, tournée, en une étape d’annulation', !!m4 && m4.q === 3 && m4.r === 1 && m4.rotation === 1 && vp.etat().rang === rang + 1 && vp.etat().aPoser === null, JSON.stringify(m4));
    verifier('glisser-déposer : plus d’aperçu, pièce épuisée dans la palette', marques(vue, 'at-fantome') === 0 && $('#pl-stock [data-modele="M4"]').disabled);
    rang = vp.etat().rang;
    glisserPalette('M5', vue.pointEcran('0,0'), function () { pendant = { refus: marques(vue, 'at-fantome-refus') }; });
    verifier('glisser-déposer sur des cases occupées : aperçu rouge, pose refusée et expliquée', pendant.refus === 5 && vp.etat().rang === rang && /at-etat-erreur/.test(etatBarre()) && /Chevauchement/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    glisserPalette('M5', { x: 5, y: 5 });
    verifier('glisser-déposer relâché hors du plateau : rien n’est posé', vp.etat().rang === rang && vp.etat().aPoser === null && /hors du plateau/.test($('#barre-etat').textContent));
    clic($('#pl-stock [data-modele="M5"]'));
    verifier('après un glisser, un clic simple sur la palette choisit de nouveau la pièce', vp.etat().aPoser && vp.etat().aPoser.modele === 'M5');
    touche('Escape');

    // Déplacer une pièce posée en la glissant.
    rang = vp.etat().rang;
    glisserCases(vue, ['3,1', '4,1', '-4,2'], null, function () {
      var f = $('.at-interface .at-fantome', vue.svg);
      pendant = { cases: marques(vue, 'at-fantome'), vert: !!f && f.getAttribute('fill') === '#00965A', rang: vp.etat().rang };
    });
    m4 = vp.plateau().pieces.filter(function (p) { return p.modele === 'M4'; })[0];
    verifier('pièce posée glissée : aperçu vert de 4 cases pendant le geste', pendant.cases === 4 && pendant.vert && pendant.rang === rang, JSON.stringify(pendant));
    verifier('pièce posée glissée : déplacée, rotation gardée, une étape d’annulation, sélection conservée', m4.q === -4 && m4.r === 2 && m4.rotation === 1 && vp.etat().rang === rang + 1 && vp.etat().selection === m4.id, JSON.stringify(m4));
    rang = vp.etat().rang;
    glisserCases(vue, ['-4,2', '-3,2', '0,0']);
    verifier('pièce glissée sur des cases occupées : refus expliqué, rien ne bouge', vp.etat().rang === rang && /Déplacement refusé/.test($('#barre-etat').textContent) && pieceEn(vp, '-4,2').modele === 'M4');
    touche('Escape');
    glisserCases(vue, ['-4,2']);
    verifier('appui et relâchement sans bouger sur une pièce : elle est sélectionnée (une seule fois)', vp.etat().selection === pieceEn(vp, '-4,2').id && vp.etat().rang === rang && marques(vue, 'at-selection') === 4);
    touche('Escape');
    var avantVue = vue.svg.getAttribute('viewBox');
    glisserCases(vue, ['-4,2', '-2,2'], { shiftKey: true });
    verifier('Maj + glisser déplace la vue, pas la pièce', vue.svg.getAttribute('viewBox') !== avantVue && pieceEn(vp, '-4,2').modele === 'M4' && vp.etat().rang === rang);
    clic($$('.at-vue-barre button', vp.element)[2]);
    avantVue = vue.svg.getAttribute('viewBox');
    var vide1 = vue.pointEcran('5,-5');
    pointeur(vue.svg, 'pointerdown', vide1); pointeur(vue.svg, 'pointermove', { x: vide1.x + 40, y: vide1.y + 20 }); pointeur(vue.svg, 'pointerup', { x: vide1.x + 40, y: vide1.y + 20 });
    vue.svg.dispatchEvent(new MouseEvent('click', { clientX: vide1.x + 40, clientY: vide1.y + 20, bubbles: true }));
    verifier('glisser depuis une case vide : la vue se déplace', vue.svg.getAttribute('viewBox') !== avantVue && vp.etat().rang === rang);
    clic($$('.at-vue-barre button', vp.element)[2]);

    // Correction : « Déplacer » d'une tuile posée hors stock (montagne d'une case du pinceau).
    var doc = P.avecCamps(P.peindre(vp.plateau(), '5,0', 'montagne').plateau);
    vp.ouvrirTexte(P.serialiser(doc));
    clicCase(vue, '5,0');
    clic($('#pl-deplacer'));
    survolCase(vue, '5,1');
    verifier('« Déplacer » une tuile hors stock : aperçu vert', marques(vue, 'at-fantome') === 1 && marques(vue, 'at-fantome-refus') === 0);
    clicCase(vue, '5,1');
    verifier('« Déplacer » une tuile hors stock (montagne d’une case) : acceptée', !pieceEn(vp, '5,0') && !!pieceEn(vp, '5,1') && pieceEn(vp, '5,1').modele === 'M1' && !/at-etat-erreur/.test(etatBarre()), $('#barre-etat').textContent);
    glisserCases(vue, ['5,1', '5,2']);
    verifier('tuile hors stock glissée : déplacée aussi', !!pieceEn(vp, '5,2') && pieceEn(vp, '5,2').modele === 'M1');
    touche('Escape');

    // Clavier : choisir une pièce, flèches, Entrée.
    clic($('#pl-stock [data-modele="R"]'));
    vue.svg.focus();
    allerCurseur(vue, '2,-2');
    touche('Enter', {}, vue.svg);
    verifier('clavier : pièce choisie, flèches puis Entrée posent la pièce', vue.curseur() === '2,-2' && !!pieceEn(vp, '2,-2') && pieceEn(vp, '2,-2').modele === 'R', vue.curseur());
    touche('Escape');
    plateauDeReference();
    AT.app.montrer('partie');
  });

  scenario('Lot E : pinceau libre', async function () {
    var vp = AT.app.vues.plateau, P = AT.plateau, K = AT.controles, vue = vp.vue;
    plateauDeReference();
    mode('creer');
    clic($('#cr-vierge'));
    mode('pinceau');
    verifier('mode « Pinceau » : 4 terrains et la gomme (plus de ville : elles se posent à l’étape « Villes »), grille vide affichée', vp.mode() === 'pinceau' && $$('#pi-outils button').length === 5 && !$('#pi-terrain-ville') && visible($('#pi-gomme')) && casesGrilleDessinees(vue) === 162
      && $('#pi-terrain-plaine').getAttribute('aria-pressed') === 'true' && !visible($('#pl-outil')));
    await attendre(600);

    // Un trait en glissant : de vrais événements pointeur, contrôles et sauvegarde comptés.
    var vraiTout = K.tout, appels = 0;
    K.tout = function () { appels += 1; return vraiTout.apply(K, arguments); };
    clic($('#pi-terrain-foret'));
    var rang = vp.etat().rang, ecrituresAvant = ecritures.length, trait = ['2,-2', '3,-2', '4,-2', '5,-2'];
    var points = trait.map(function (k) { return vue.pointEcran(k); });
    appels = 0;
    pointeur(vue.svg, 'pointerdown', points[0]);
    pointeur(vue.svg, 'pointermove', points[1]);
    pointeur(vue.svg, 'pointermove', points[2]);
    pointeur(vue.svg, 'pointermove', points[3]);
    var pendant = { dessinees: casesDessinees(vue), rang: vp.etat().rang, appels: appels, ecritures: ecritures.length - ecrituresAvant, pieces: vp.plateau().pieces.length };
    pointeur(vue.svg, 'pointerup', points[3]);
    vue.svg.dispatchEvent(new MouseEvent('click', { clientX: points[3].x, clientY: points[3].y, bubbles: true, cancelable: true }));
    verifier('trait en cours : les 4 cases sont déjà dessinées, sans contrôle, sans étape d’historique, sans écriture',
      pendant.dessinees === 11 && pendant.rang === rang && pendant.appels === 0 && pendant.ecritures === 0 && pendant.pieces === 1, JSON.stringify(pendant));
    verifier('fin du trait : 4 forêts posées, UNE étape d’annulation, contrôles recalculés UNE fois',
      vp.plateau().pieces.length === 5 && trait.every(function (k) { return pieceEn(vp, k) && pieceEn(vp, k).modele === 'F'; }) && vp.etat().rang === rang + 1 && appels === 1, 'appels : ' + appels + ', rang : ' + (vp.etat().rang - rang));
    verifier('fin du trait : message clair', /4 cases peintes en forêt/.test($('#pi-message').textContent) && /4 cases peintes en forêt/.test($('#barre-etat').textContent), $('#pi-message').textContent);
    verifier('le clic qui suit le relâchement ne repeint pas (toujours une seule étape)', vp.etat().rang === rang + 1);
    await attendre(600);
    verifier('sauvegarde automatique : UNE écriture du travail en cours, après le trait',
      ecritures.length - ecrituresAvant === 1 && ecritures[ecritures.length - 1] === AT.bibliotheque.cleTravail()
      && JSON.stringify(AT.bibliotheque.chargerTravail(stockageRecette).plateau) === JSON.stringify(vp.plateau()), ecritures.slice(ecrituresAvant).join());
    verifier('sauvegarde automatique : indiquée dans la barre du haut, pas dans la barre d’état', /sauvegardé automatiquement à \d\d:\d\d/.test($('#at-sauvegarde').textContent) && !/sauvegard/.test($('#barre-etat').textContent), $('#at-sauvegarde').textContent);
    touche('z', { ctrlKey: true });
    verifier('Ctrl+Z annule tout le trait d’un coup', vp.plateau().pieces.length === 1 && vp.etat().rang === rang);
    touche('y', { ctrlKey: true });
    K.tout = vraiTout;

    // Noyau et monobloc : refus expliqué.
    clic($('#pi-terrain-marais'));
    rang = vp.etat().rang;
    glisserCases(vue, ['-2,0', '-1,0', '0,0', '1,0', '2,0']);
    verifier('trait à travers le noyau : les cases libres sont peintes, le noyau est laissé, le message le dit',
      pieceEn(vp, '-2,0').modele === 'S' && pieceEn(vp, '2,0').modele === 'S' && pieceEn(vp, '0,0').modele === 'N1' && vp.etat().rang === rang + 1
      && /2 cases peintes en marais/.test($('#pi-message').textContent) && /ne modifie pas le noyau \(3 cases laissées\)/.test($('#pi-message').textContent) && /at-etat-alerte/.test(etatBarre()), $('#pi-message').textContent);
    rang = vp.etat().rang;
    clicCase(vue, '0,0');
    verifier('clic sur le noyau : refus expliqué, rien ne change', vp.etat().rang === rang && /ne modifie pas le noyau/.test($('#barre-etat').textContent) && /at-etat-erreur/.test(etatBarre()));
    clicCase(vue, '2,0');
    verifier('case déjà de ce terrain : rien ne change, dit clairement', vp.etat().rang === rang && /déjà ce terrain/.test($('#pi-message').textContent));

    // Catalogue 2 : toute tuile peinte est hors catalogue (forêts, montagne d'une case) et annoncée ; seule une Plaine
    // vient d'abord des tuiles de remplissage du catalogue.
    clic($('#pi-terrain-foret'));
    clicCase(vue, '2,2');
    verifier('5e forêt : hors catalogue comme les autres, annoncée', /1 tuile posée hors stock/.test($('#pi-message').textContent) && P.stock(vp.plateau()).F.restant === -5, $('#pi-message').textContent);
    clicCase(vue, '3,2');
    verifier('6e forêt : posée hors stock, annoncée', pieceEn(vp, '3,2').modele === 'F' && /1 tuile posée hors stock : à prévoir en plus du catalogue/.test($('#pi-message').textContent) && /at-etat-alerte/.test(etatBarre()), $('#pi-message').textContent);
    clic($('#pi-terrain-montagne'));
    clicCase(vue, '-3,2');
    verifier('montagne : tuile d’une case hors catalogue, annoncée ; le contrôle 1 la liste', pieceEn(vp, '-3,2').modele === 'M1' && /hors stock/.test($('#pi-message').textContent)
      && /Tuiles à prévoir en plus du catalogue \(9\)/.test($('#pl-controles').textContent) && /1 montagne d’une case/.test($('#pl-controles').textContent), $('#pl-controles').textContent.slice(0, 400));
    verifier('le pinceau ne désigne aucune ville de déploiement : camps vides, étape « construction »', vp.plateau().camps.vert.length === 0 && vp.plateau().camps.rouge.length === 0 && vp.bilan().etape === 'construction'
      && /en haut \(Vert\) : 0 \/ 2/.test(reste('haut')), JSON.stringify(vp.plateau().camps));
    clic($('#pi-terrain-plaine'));
    clicCase(vue, '3,2');
    verifier('repeindre une case : la tuile est remplacée (forêt hors catalogue → plaine prise dans les remplissages du stock)', pieceEn(vp, '3,2').modele === 'R'
      && /Tuiles à prévoir en plus du catalogue \(8\)/.test($('#pl-controles').textContent) && !/hors stock/.test($('#pi-message').textContent), $('#pi-message').textContent);

    // Gomme.
    clic($('#pi-gomme'));
    rang = vp.etat().rang;
    var avantGomme = vp.plateau().pieces.length;
    glisserCases(vue, ['2,2', '3,2', '4,2']);
    verifier('gomme en glissant : 2 tuiles retirées en une étape, la case vide est ignorée', vp.plateau().pieces.length === avantGomme - 2 && vp.etat().rang === rang + 1 && /2 tuiles gommées/.test($('#pi-message').textContent), $('#pi-message').textContent);
    clicCase(vue, '4,2');
    verifier('gomme sur une case vide : dit clairement', vp.etat().rang === rang + 1 && /rien à gommer/.test($('#pi-message').textContent));
    mode('creer');
    clic($('#pl-stock [data-modele="F3"]'));
    clicCase(vue, '3,3');
    touche('Escape');
    mode('pinceau');
    var bois = pieceEn(vp, '3,3');
    clic($('#pi-terrain-plaine'));
    rang = vp.etat().rang;
    clicCase(vue, '3,3');
    verifier('pinceau sur un monobloc : refus expliqué, le monobloc est nommé', vp.etat().rang === rang && /monobloc « Bois »/.test($('#barre-etat').textContent) && /at-etat-erreur/.test(etatBarre()), $('#barre-etat').textContent);
    clic($('#pi-gomme'));
    clicCase(vue, '3,3');
    var dialogue = $('#at-confirmation');
    verifier('gomme sur un monobloc : fenêtre de confirmation de la page, rien n’est encore retiré', dialogue.open === true && /Retirer le monobloc « Bois » en entier \(3 cases\)/.test(dialogue.textContent) && !!pieceEn(vp, '3,3') && vp.etat().rang === rang, dialogue.textContent);
    verifier('fenêtre de confirmation : le bouton « Renoncer » a le focus', document.activeElement === $('#at-confirmer-non'));
    clic($('#at-confirmer-non'));
    verifier('renoncer : le monobloc reste', dialogue.open === false && !!pieceEn(vp, '3,3') && pieceEn(vp, '3,3').id === bois.id);
    clicCase(vue, '3,3');
    clic($('#at-confirmer-oui'));
    verifier('confirmer : le monobloc est retiré en entier, en une étape', dialogue.open === false && !pieceEn(vp, '3,3') && !pieceEn(vp, '4,3') && vp.etat().rang === rang + 1 && /Monobloc « Bois » retiré/.test($('#pi-message').textContent), $('#pi-message').textContent);
    rang = vp.etat().rang;
    glisserCases(vue, ['-2,0', '-1,0', '0,0']);
    verifier('gomme en glissant sur le noyau : il n’est pas retiré, pas de fenêtre, le message dit comment faire',
      !dialogue.open && pieceEn(vp, '0,0').modele === 'N1' && !pieceEn(vp, '-2,0') && vp.etat().rang === rang + 1 && /Le noyau est fixe : la gomme ne le retire jamais \(2 cases laissées\)/.test($('#pi-message').textContent), $('#pi-message').textContent);

    // Clavier.
    clic($('#pi-terrain-foret'));
    vue.svg.focus();
    allerCurseur(vue, '-3,0');
    touche('Enter', {}, vue.svg);
    verifier('clavier : flèches puis Entrée peignent la case du curseur', vue.curseur() === '-3,0' && !!pieceEn(vp, '-3,0') && pieceEn(vp, '-3,0').modele === 'F', vue.curseur());
    verifier('pinceau : aucune sélection ni pose en cours (le clic peint)', vp.etat().selection === null && vp.etat().aPoser === null);
    plateauDeReference();
    AT.app.montrer('partie');
  });

  scenario('Lot E : mes monoblocs', async function () {
    var vp = AT.app.vues.plateau, P = AT.plateau, vue = vp.vue;
    plateauDeReference();
    mode('creer');
    clic($('#cr-vierge'));
    mode('monoblocs');
    var caseGrille = function (k) { $('#mo-grille [data-case="' + k + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); };
    verifier('mode « Mes monoblocs » : grille de 37 cases, 4 terrains, jamais de ville', vp.mode() === 'monoblocs' && $$('#mo-grille [data-case]').length === 37
      && $$('#mo-terrains button').length === 4 && !$('#mo-terrain-ville') && $('#mo-valider').disabled && /Aucune pièce personnelle/.test($('#mo-liste').textContent));
    verifier('éditeur vide : consigne claire', /cliquez 2 à 6 cases voisines/.test($('#mo-avis').textContent), $('#mo-avis').textContent);
    caseGrille('1,1');
    verifier('une case : la consigne demande une case voisine', /Ajoutez au moins une case voisine/.test($('#mo-avis').textContent) && vp.monoblocs.etat().cases.length === 1);
    caseGrille('2,1'); caseGrille('1,2');
    clic($('#mo-terrain-montagne'));
    caseGrille('1,2');
    verifier('clic sur une case d’un autre terrain : elle change de terrain', vp.monoblocs.etat().cases.length === 3 && vp.monoblocs.etat().cases[2].terrain === 'montagne');
    caseGrille('-2,-1');
    saisir($('#mo-nom'), 'Crête <img src=x onerror=alert(1)>');
    saisir($('#mo-quantite'), '2');
    verifier('forme en plusieurs morceaux : message clair, validation impossible', /doivent se toucher/.test($('#mo-avis').textContent) && $('#mo-valider').disabled, $('#mo-avis').textContent);
    caseGrille('-2,-1');
    verifier('case retirée par un second clic : pièce valide, aperçu dessiné', vp.monoblocs.etat().cases.length === 3 && /Pièce valide : 3 cases : 2 × forêt, 1 × montagne/.test($('#mo-avis').textContent)
      && !$('#mo-valider').disabled && $$('#mo-apercu svg polygon').length === 3, $('#mo-avis').textContent);
    saisir($('#mo-quantite'), '12');
    verifier('quantité hors bornes : message clair', /Quantité : un nombre entier de 1 à 9/.test($('#mo-avis').textContent) && $('#mo-valider').disabled);
    saisir($('#mo-quantite'), '2');
    var rang = vp.etat().rang;
    clic($('#mo-valider'));
    var x1 = (vp.plateau().modeles || [])[0];
    verifier('pièce ajoutée au document : X1, forme recentrée pour contenir (0,0), une étape d’annulation',
      !!x1 && x1.id === 'X1' && x1.quantite === 2 && x1.cases.length === 3 && x1.cases.some(function (c) { return c.q === 0 && c.r === 0; }) && P.validerModele(x1).ok && vp.etat().rang === rang + 1, JSON.stringify(x1));
    verifier('liste : la pièce avec son dessin ; le nom saisi est affiché comme du texte', $$('#mo-liste [data-modele="X1"]').length === 1 && $$('#mo-liste svg').length === 1 && $$('img').length === 0
      && /<img src=x/.test($('#mo-liste').textContent) && /2 exemplaires, 0 posé/.test($('#mo-liste').textContent), $('#mo-liste').textContent);
    verifier('éditeur remis à zéro après l’ajout', vp.monoblocs.etat().cases.length === 0 && $('#mo-nom').value === '');

    // Clavier sur la grille.
    // Le curseur du clavier part de la dernière case cliquée (-2,-1).
    $('#mo-grille').focus();
    touche('ArrowRight', {}, $('#mo-grille'));
    touche('Enter', {}, $('#mo-grille'));
    touche('ArrowRight', {}, $('#mo-grille'));
    touche(' ', {}, $('#mo-grille'));
    verifier('clavier : flèches, Entrée et Espace ajoutent des cases', vp.monoblocs.etat().cases.length === 2 && vp.monoblocs.etat().cases[0].q === -1 && vp.monoblocs.etat().cases[1].q === 0
      && vp.monoblocs.etat().curseur === '0,-1' && $$('#mo-grille .at-curseur').length === 1, JSON.stringify(vp.monoblocs.etat().cases));
    clic($('#mo-terrain-plaine'));
    saisir($('#mo-nom'), 'Duo');
    clic($('#mo-valider'));
    verifier('seconde pièce : X2, recentrée', vp.plateau().modeles.length === 2 && vp.plateau().modeles[1].id === 'X2' && vp.plateau().modeles[1].cases[0].q === 0 && vp.plateau().modeles[1].cases[0].r === 0, JSON.stringify(vp.plateau().modeles[1]));

    // La pièce est dans la palette ; posée, elle ne se supprime plus et sa forme est verrouillée.
    mode('creer');
    verifier('palette : les pièces personnelles avec leur stock', $$('#cr-persos [data-modele]').length === 2 && /× 2/.test($('#pl-stock [data-modele="X1"]').textContent) && $$('#pl-stock [data-modele="X1"] svg polygon').length === 3
      && /Monoblocs personnels à poser : 3/.test(reste('persos')), reste('persos'));
    clic($('#pl-stock [data-modele="X1"]'));
    clicCase(vue, '3,0');
    clicCase(vue, '-4,0');
    verifier('pièce personnelle posée deux fois par clic, puis épuisée', vp.plateau().pieces.filter(function (p) { return p.modele === 'X1'; }).length === 2 && $('#pl-stock [data-modele="X1"]').disabled && vp.etat().aPoser === null);
    mode('monoblocs');
    rang = vp.etat().rang;
    clic($('#mo-liste [data-supprimer="X1"]'));
    verifier('supprimer une pièce posée : refus expliqué', vp.plateau().modeles.length === 2 && vp.etat().rang === rang && /Suppression refusée : 2 exemplaires de/.test($('#barre-etat').textContent) && /Retirez-les d’abord/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    clic($('#mo-liste [data-modifier="X1"]'));
    verifier('modifier une pièce posée : forme verrouillée, expliquée', vp.monoblocs.etat().verrou === true && $('#mo-terrain-foret').disabled && /seuls son nom et sa quantité se changent/.test($('#mo-avis').textContent));
    var avantClic = vp.monoblocs.etat().cases.length;
    caseGrille('0,2');
    verifier('forme verrouillée : un clic sur la grille ne change rien', vp.monoblocs.etat().cases.length === avantClic);
    saisir($('#mo-nom'), 'Grande crête');
    saisir($('#mo-quantite'), '1');
    clic($('#mo-valider'));
    verifier('quantité sous le nombre d’exemplaires posés : refus expliqué', vp.plateau().modeles[0].quantite === 2 && /Quantité refusée : 2 exemplaires/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    saisir($('#mo-quantite'), '3');
    clic($('#mo-valider'));
    verifier('renommer et augmenter la quantité d’une pièce posée : accepté, forme intacte', vp.plateau().modeles[0].nom === 'Grande crête' && vp.plateau().modeles[0].quantite === 3
      && JSON.stringify(vp.plateau().modeles[0].cases) === JSON.stringify(x1.cases) && vp.plateau().pieces.filter(function (p) { return p.modele === 'X1'; }).length === 2);
    clic($('#mo-liste [data-modifier="X2"]'));
    verifier('modifier une pièce non posée : forme chargée dans la grille, modifiable', vp.monoblocs.etat().verrou === false && vp.monoblocs.etat().cases.length === 2 && vp.monoblocs.etat().edite === 'X2');
    var libre = H_voisineLibre(vp.monoblocs.etat().cases);
    caseGrille(libre);
    clic($('#mo-valider'));
    verifier('forme d’une pièce non posée modifiée : 3 cases', vp.plateau().modeles[1].cases.length === 3 && P.validerModele(vp.plateau().modeles[1]).ok, JSON.stringify(vp.plateau().modeles[1]));
    clic($('#mo-liste [data-supprimer="X2"]'));
    verifier('supprimer une pièce non posée : acceptée, annulable', vp.plateau().modeles.length === 1 && vp.plateau().modeles[0].id === 'X1');
    clic($('#pl-annuler'));
    verifier('annuler : la pièce supprimée revient', vp.plateau().modeles.length === 2);

    // Copier depuis un plateau de la bibliothèque.
    var bib = vp.bibliotheque;
    verifier('enregistrer ce plateau dans la bibliothèque', bib.enregistrerSous('Avec monoblocs') === true && bib.liste().length === 1);
    vp.ouvrirTexte(P.serialiser(P.vierge('sans monobloc')));
    mode('monoblocs');
    verifier('document sans pièce personnelle : la bibliothèque propose le plateau qui en porte', !vp.plateau().modeles && $$('#mo-source option').length === 1 && /Avec monoblocs \(2\)/.test($('#mo-source').textContent), $('#mo-copie').textContent);
    clic($('#mo-copier'));
    verifier('copier depuis la bibliothèque : 2 pièces personnelles ajoutées au document', (vp.plateau().modeles || []).length === 2 && $$('#mo-liste [data-modele]').length === 2 && /2 pièces copiées/.test($('#barre-etat').textContent), $('#barre-etat').textContent);

    // Inventaire : à part du catalogue imprimé.
    vp.ouvrirTexte(P.serialiser(bib.liste()[0].plateau));
    var avecMontagne = P.avecCamps(P.peindre(vp.plateau(), '0,3', 'montagne').plateau);
    for (var i = 0; i < 6; i++) avecMontagne = P.peindre(avecMontagne, (i - 3) + ',-3', 'foret').plateau;
    vp.ouvrirTexte(P.serialiser(P.avecCamps(avecMontagne)));
    AT.app.montrer('inventaire');
    verifier('inventaire : le catalogue imprimé garde 26 lignes et ses totaux (28 pièces, 95 cases)', $$('#inv-pieces tbody tr[data-modele]').length === 26 && /Catalogue : 28 pièces, 95 cases/.test($('#inv-totaux').textContent)
      && !$('#inv-pieces [data-modele="X1"]') && !$('#inv-pieces [data-modele="M1"]'), $('#inv-totaux').textContent);
    verifier('inventaire : les tuiles d’une case du premier catalogue (plaine, forêt, marais, ville) ne sont plus des lignes du catalogue imprimé',
      !$('#inv-pieces [data-modele="F"]') && !$('#inv-pieces [data-modele="P"]') && !$('#inv-pieces [data-modele="S"]') && !$('#inv-pieces [data-modele="V"]'));
    verifier('inventaire : total des pièces posées et restantes sans les tuiles hors catalogue', /Sur le plateau courant : 1 pièces posées \(7 cases\), 27 restantes/.test($('#inv-totaux').textContent), $('#inv-totaux').textContent);
    verifier('inventaire : ligne « Tuiles hors catalogue posées », forêts peintes et montagne d’une case comprises', /Tuiles hors catalogue posées : 7 \(1 × Montagne d’une case, 6 × Forêt\)/.test($('#inv-hors-catalogue').textContent), $('#inv-hors-catalogue').textContent);
    verifier('inventaire : section « Mes monoblocs » séparée, avec dessin, total, posées, restantes', $$('#inv-monoblocs tbody tr').length === 2 && $$('#inv-monoblocs svg').length === 2
      && (function () { var c = $('#inv-monoblocs [data-modele="X1"]').querySelectorAll('td.at-nombre'); return c[0].textContent === '3' && c[1].textContent === '2' && c[2].textContent === '1'; })()
      && /Grande crête/.test($('#inv-monoblocs').textContent), $('#inv-monoblocs').textContent);
    AT.app.montrer('plateau');
    mode('bibliotheque');
    clic($('#bi-liste [data-supprimer-entree]'));
    clic($('#at-confirmer-oui'));
    verifier('bibliothèque de nouveau vide', bib.liste().length === 0);
    plateauDeReference();
    AT.app.montrer('partie');
  });

  /** Case de la grille de l'éditeur voisine de la forme et libre (pour l'agrandir d'une case). */
  function H_voisineLibre(cases) {
    var prises = {};
    cases.forEach(function (c) { prises[AT.hex.cle(c.q, c.r)] = true; });
    var res = null;
    cases.forEach(function (c) {
      AT.hex.voisines(AT.hex.cle(c.q, c.r)).forEach(function (k) { if (!res && !prises[k] && AT.hex.distance(k, '0,0') <= 3) res = k; });
    });
    return res;
  }

  scenario('Lot E : bibliothèque et sauvegarde automatique', async function () {
    var vp = AT.app.vues.plateau, P = AT.plateau, B = AT.bibliotheque, bib = vp.bibliotheque, vue = vp.vue;
    plateauDeReference();
    mode('bibliotheque');
    verifier('mode « Bibliothèque » : vide au départ, aucun avis de stockage, plateau « sans nom » dans la barre', vp.mode() === 'bibliotheque' && bib.liste().length === 0 && $('#bi-avis').hidden
      && /bibliothèque est vide/.test($('#bi-liste').textContent) && $('#at-nom-plateau').textContent === 'Plateau : sans nom' && !$('#bi-mettre-a-jour'), $('#at-nom-plateau').textContent);
    verifier('nom proposé', $('#bi-nom').placeholder === 'Plateau 1');
    var avant = ecritures.length;
    saisir($('#bi-nom'), 'Essai <b>gras</b>');
    clic($('#bi-enregistrer'));
    verifier('enregistrer sous un nom : une fiche, écrite dans le stockage', bib.liste().length === 1 && $$('#bi-liste .at-bib-fiche').length === 1 && ecritures.slice(avant).indexOf(B.cleListe()) !== -1
      && B.charger(stockageRecette).liste.length === 1 && JSON.stringify(B.charger(stockageRecette).liste[0].plateau) === JSON.stringify(vp.plateau()));
    var id1 = bib.liste()[0].id, id2 = null;
    verifier('fiche : vignette SVG, résumé (cases, pièces, erreurs / alertes), date', $$('#bi-liste .at-bib-fiche svg.at-vignette').length === 1 && $$('#bi-liste .at-vignette polygon').length >= 91
      && /93 cases, 26 pièces, 7 villes ; aucune erreur, aucune alerte/.test($('#bi-liste').textContent) && /Modifié le \d\d\/\d\d\/\d{4} à \d\d:\d\d/.test($('#bi-liste').textContent), $('#bi-liste').textContent);
    verifier('nom saisi affiché comme du texte, dans la fiche et dans la barre', $$('#atelier b').length === 0 && /Essai <b>gras<\/b>/.test($('#bi-liste .at-bib-nom').textContent)
      && $('#at-nom-plateau').textContent === 'Plateau : « Essai <b>gras</b> »', $('#at-nom-plateau').textContent);
    verifier('plateau ouvert : « à jour », bouton de mise à jour désactivé', /à jour dans la bibliothèque/.test($('#bi-etat').textContent) && $('#bi-mettre-a-jour').disabled && bib.ouvert() === id1);
    saisir($('#bi-nom'), '   ');
    $('#bi-nom').placeholder = '';
    clic($('#bi-enregistrer'));
    verifier('nom vide : refus expliqué', bib.liste().length === 1 && /Enregistrement refusé : Nom invalide/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    saisir($('#bi-nom'), '');

    // Modifier le plateau, puis mettre à jour l'entrée ouverte.
    mode('pinceau');
    clic($('#pi-terrain-marais'));
    clicCase(vue, '7,-7');
    verifier('plateau modifié : la barre l’indique', $('#at-nom-plateau').textContent === 'Plateau : « Essai <b>gras</b> » (modifié)', $('#at-nom-plateau').textContent);
    mode('bibliotheque');
    verifier('bibliothèque : « modifié depuis son enregistrement », mise à jour proposée', /modifié depuis son enregistrement/.test($('#bi-etat').textContent) && !$('#bi-mettre-a-jour').disabled);
    clic($('#bi-mettre-a-jour'));
    verifier('mettre à jour l’entrée ouverte : toujours une seule fiche, plateau enregistré = plateau affiché', bib.liste().length === 1 && JSON.stringify(bib.liste()[0].plateau) === JSON.stringify(vp.plateau())
      && /94 cases, 27 pièces/.test($('#bi-liste').textContent) && $('#at-nom-plateau').textContent === 'Plateau : « Essai <b>gras</b> »', $('#bi-liste').textContent);

    // Dupliquer, renommer, ouvrir, supprimer.
    clic($('#bi-liste [data-dupliquer="' + id1 + '"]'));
    id2 = bib.liste()[1].id;
    verifier('dupliquer : seconde fiche « (copie) »', bib.liste().length === 2 && /\(copie\)$/.test(bib.liste()[1].nom) && $$('#bi-liste .at-bib-fiche').length === 2);
    clic($('#bi-liste [data-renommer="' + id2 + '"]'));
    var champ = $('#bi-liste [data-nouveau-nom="' + id2 + '"]');
    verifier('renommer : champ de saisie dans la fiche, avec le focus', !!champ && document.activeElement === champ && /\(copie\)$/.test(champ.value));
    champ.value = 'Variante marais';
    clic($('#bi-liste [data-valider-nom="' + id2 + '"]'));
    verifier('renommer : nom changé et enregistré', bib.liste()[1].nom === 'Variante marais' && B.charger(stockageRecette).liste[1].nom === 'Variante marais' && !$('#bi-liste [data-nouveau-nom]'));
    plateauDeReference();
    mode('bibliotheque');
    verifier('générer ou ouvrir un fichier détache le plateau de l’entrée ouverte', bib.ouvert() === null && $('#at-nom-plateau').textContent === 'Plateau : sans nom');
    var rang = vp.etat().rang;
    clic($('#bi-liste [data-ouvrir="' + id2 + '"]'));
    verifier('ouvrir : le plateau de la fiche est affiché, la barre porte son nom', JSON.stringify(vp.plateau()) === JSON.stringify(bib.liste()[1].plateau) && vp.plateau().pieces.length === 27
      && $('#at-nom-plateau').textContent === 'Plateau : « Variante marais »' && $('#bi-liste [data-entree="' + id2 + '"]').classList.contains('at-bib-ouverte'), $('#at-nom-plateau').textContent);
    verifier('ouvrir est annulable', vp.etat().rang === rang + 1);
    clic($('#pl-annuler'));
    verifier('annuler : retour au plateau précédent, détaché de la fiche ouverte (« Mettre à jour » ne peut pas écraser une autre fiche)', vp.plateau().pieces.length === 26 && bib.ouvert() === null
      && $('#at-nom-plateau').textContent === 'Plateau : sans nom' && !$('#bi-mettre-a-jour'), $('#at-nom-plateau').textContent);
    clic($('#pl-retablir'));
    verifier('rétablir : le plateau ouvert revient avec son attache', vp.plateau().pieces.length === 27 && bib.ouvert() === id2 && $('#at-nom-plateau').textContent === 'Plateau : « Variante marais »', $('#at-nom-plateau').textContent);
    clic($('#bi-liste [data-supprimer-entree="' + id1 + '"]'));
    verifier('supprimer : confirmation demandée', $('#at-confirmation').open === true && /Supprimer « Essai <b>gras<\/b> » de la bibliothèque/.test($('#at-confirmation').textContent) && bib.liste().length === 2);
    clic($('#at-confirmer-non'));
    verifier('supprimer, renoncer : rien ne change', bib.liste().length === 2 && $('#at-confirmation').open === false);
    clic($('#bi-liste [data-supprimer-entree="' + id1 + '"]'));
    clic($('#at-confirmer-oui'));
    verifier('supprimer, confirmer : la fiche disparaît, du stockage aussi', bib.liste().length === 1 && bib.liste()[0].id === id2 && B.charger(stockageRecette).liste.length === 1 && $$('#bi-liste .at-bib-fiche').length === 1);

    // Exporter tout, importer.
    telecharges.length = 0;
    clic($('#bi-exporter'));
    verifier('exporter toute la bibliothèque : un fichier JSON', telecharges.length === 1 && telecharges[0].nom === 'bibliotheque-plateaux.json' && telecharges[0].taille > 1000);
    var exportTexte = B.exporter(bib.liste());
    verifier('importer : fusion sans rien écraser (2 fiches, identifiants distincts)', bib.importerTexte(exportTexte) === true && bib.liste().length === 2 && bib.liste()[0].id !== bib.liste()[1].id
      && /1 plateau importé/.test($('#barre-etat').textContent) && $$('#bi-liste .at-bib-fiche').length === 2, $('#barre-etat').textContent);
    verifier('importer un fichier qui n’est pas une bibliothèque : refus expliqué, rien ne change', bib.importerTexte('{"format":"autre"}') === false && bib.liste().length === 2 && /Import refusé/.test($('#barre-etat').textContent)
      && bib.importerTexte('pas du JSON') === false && /JSON/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    var hostile = JSON.parse(exportTexte);
    hostile.plateaux[0].nom = '<img src=x onerror=alert(1)>';
    verifier('importer un nom contenant du HTML : affiché comme du texte', bib.importerTexte(JSON.stringify(hostile)) === true && $$('img').length === 0 && /<img src=x/.test($('#bi-liste').textContent));

    // Sauvegarde automatique et reprise.
    mode('pinceau');
    clic($('#pi-terrain-foret'));
    clicCase(vue, '7,-6');
    await attendre(600);
    var travail = B.chargerTravail(stockageRecette);
    verifier('sauvegarde automatique après un changement : le travail en cours du stockage = le plateau affiché', travail.ok && JSON.stringify(travail.plateau) === JSON.stringify(vp.plateau()));
    avant = ecritures.length;
    choisir($('#pl-affichage'), 'coordonnees');
    choisir($('#pl-affichage'), 'rien');
    await attendre(600);
    verifier('sans changement du plateau : aucune écriture', ecritures.length === avant, ecritures.slice(avant).join());
    var autre = P.avecCamps(P.peindre(P.vierge('reprise'), '2,2', 'marais').plateau);
    B.enregistrerTravail(stockageRecette, autre);
    var reprise = vp.reprendreTravail();
    verifier('reprise : le travail en cours du stockage redevient le plateau affiché, historique neuf', reprise.repris === true && JSON.stringify(vp.plateau()) === JSON.stringify(autre) && vp.etat().rang === 0 && vp.etat().longueur === 1 && casesDessinees(vue) === 8);

    // Stockage absent, plein, corrompu : l'outil reste utilisable et le dit.
    var messages = [], indications = [];
    var acces = {
      plateau: vp.plateau, reglages: vp.reglages, ouvrirDocument: function () {}, message: function (t, n) { messages.push(n + ' : ' + t); },
      confirmer: function (t, l, f) { f(); }, telecharger: function () {}, ouvrirFichier: function () {}, indiquer: function (i) { indications.push(i); }
    };
    var absent = AT.vueBibliotheque.creer(acces, { stockage: null });
    absent.montrer(true);
    verifier('stockage absent : avis permanent, la bibliothèque marche en mémoire le temps de la session', /Stockage du navigateur indisponible/.test(absent.avis()) && !absent.element.querySelector('#bi-avis').hidden
      && absent.enregistrerSous('En mémoire') === true && absent.liste().length === 1, absent.avis());
    var plein = AT.vueBibliotheque.creer(acces, { stockage: B.stockageMemoire({ quota: 50 }) });
    plein.montrer(true);
    plein.activer();
    messages.length = 0;
    var refuse = plein.enregistrerSous('Trop gros');
    verifier('stockage plein : la fiche est gardée en mémoire pour la session, avec un message clair', refuse === true && plein.liste().length === 1 && plein.enMemoire() === true
      && /alerte : .*gardé en mémoire seulement/.test(messages.join(' | ')) && /plein/.test(plein.avis()), messages.join(' | '));
    indications.length = 0;
    var sauvegarde = plein.sauverTravail();
    verifier('stockage plein : sauvegarde automatique impossible, indiquée sans exception', sauvegarde.ok === false && indications.length > 0 && indications[indications.length - 1].niveau === 'erreur'
      && /impossible/.test(indications[indications.length - 1].sauvegarde), JSON.stringify(indications[indications.length - 1]));
    var abime = B.stockageMemoire();
    abime.setItem(B.cleListe(), '{"format":"atelier-bibliotheque","version":1,"plateaux":"<script>"}');
    abime.setItem(B.cleTravail(), '{ceci est abîmé');
    var corrompu = AT.vueBibliotheque.creer(acces, { stockage: abime });
    verifier('bibliothèque enregistrée illisible : ignorée avec un avis, l’outil continue', corrompu.liste().length === 0 && /illisible/.test(corrompu.avis()) && corrompu.enregistrerSous('Après') === true && B.charger(abime).liste.length === 1, corrompu.avis());
    var repriseAbimee = corrompu.reprendre();
    verifier('travail en cours illisible : ignoré, signalé', repriseAbimee.ok === false && repriseAbimee.corrompu === true && repriseAbimee.plateau === null && /Travail en cours illisible/.test(corrompu.avis()), corrompu.avis());

    // Remise en état : bibliothèque vide, plateau de référence.
    mode('bibliotheque');
    while (bib.liste().length) { clic($('#bi-liste [data-supprimer-entree]')); clic($('#at-confirmer-oui')); }
    verifier('bibliothèque vidée fiche par fiche', bib.liste().length === 0 && B.charger(stockageRecette).liste.length === 0);
    plateauDeReference();
    AT.app.montrer('partie');
  });

  scenario('Lot E : partie fictive sur un plateau fait à la main', function () {
    var vp = AT.app.vues.plateau, vq = AT.app.vues.partie, P = AT.plateau, vue = vp.vue;
    plateauDeReference();
    mode('creer');
    clic($('#cr-vierge'));
    // Une pièce personnelle, posée ; des tuiles au pinceau (dont hors stock et montagne d'une case) ; 4 villes de déploiement.
    mode('monoblocs');
    ['0,0', '1,0', '1,1'].forEach(function (k) { $('#mo-grille [data-case="' + k + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    saisir($('#mo-nom'), 'Bosquet maison');
    clic($('#mo-valider'));
    mode('creer');
    clic($('#pl-stock [data-modele="X1"]'));
    clicCase(vue, '2,0');
    mode('pinceau');
    clic($('#pi-terrain-plaine'));
    glisserCases(vue, ['-1,-1', '-1,-2', '0,-2', '1,-2', '1,-3', '0,2', '-1,2', '-1,3', '0,3', '1,2']);
    clic($('#pi-terrain-foret'));
    glisserCases(vue, ['-2,0', '-2,1', '-3,1', '-3,2', '-2,2', '-2,-1']);
    clic($('#pi-terrain-montagne'));
    clicCase(vue, '3,-2');
    // Les villes ne se peignent plus : les 4 villes de déploiement sont des tuiles posées par-dessus une Plaine, par les
    // fonctions de la phase « villes » (leur interface est le lot suivant). Ici en pose libre, sur des Plaines peintes.
    var avecVilles = vp.plateau(), posesVilles = [];
    [['vert', '-1,-2'], ['vert', '1,-3'], ['rouge', '-1,3'], ['rouge', '1,2']].forEach(function (x) {
      var r = P.poserVilleDeploiement(avecVilles, x[0], x[1], { libre: true });
      posesVilles.push(r.ok);
      if (r.ok) avecVilles = r.plateau;
    });
    verifier('villes de déploiement posées par-dessus des Plaines peintes (pose libre), plateau rouvert avec elles', posesVilles.every(Boolean) && vp.ouvrirTexte(P.serialiser(avecVilles)) === true
      && P.deploiements(vp.plateau()).length === 4, posesVilles.join());
    var pl = vp.plateau();
    verifier('plateau fait à la main : pièce personnelle, tuiles hors stock, montagne d’une case, 2 villes de déploiement par camp',
      pl.modeles.length === 1 && pl.pieces.some(function (p) { return p.modele === 'X1'; }) && pl.pieces.some(function (p) { return p.modele === 'M1'; })
      && P.stock(pl).F.restant < 0 && pl.camps.vert.length === 2 && pl.camps.rouge.length === 2, JSON.stringify(pl.camps));
    AT.app.montrer('partie');
    $('#pa-graine').value = '9';
    clic($('#pa-nouvelle'));
    var e = vq.etat(), j = e ? e.actif : 'vert';
    verifier('partie créée sur ce plateau, dessinée avec ses pièces personnelles', !!e && e.plateau.modeles[0].id === 'X1' && casesDessinees(vq.vue) === Object.keys(P.cases(pl)).length, casesDessinees(vq.vue));
    clic($$('[data-main="' + j + '"] .at-carte')[0]);
    verifier('villes de déploiement du joueur actif proposées', marques(vq.vue, 'at-admissible') === 2);
    clic($('[data-former="' + e.plateau.camps[j][0] + '"]'));
    e = vq.etat();
    verifier('former un bataillon sur une ville de déploiement posée sur une Plaine', e.bataillons[j][0].case === e.plateau.camps[j][0]);
    clicCase(vq.vue, e.plateau.camps[j][0]);
    var cases = P.cases(e.plateau);
    var voisine = AT.hex.voisines(e.plateau.camps[j][0]).filter(function (k) { return cases[k] && P.cout(e.plateau, k) !== Infinity; })[0];
    clicCase(vq.vue, voisine);
    verifier('déplacer le bataillon sur une case voisine du plateau fait à la main', vq.etat().bataillons[j][0].case === voisine, voisine);
    touche('Escape');
    verifier('la partie s’enregistre et se rouvre avec le plateau fait à la main', vq.ouvrirTexte(vq.texteEnregistrement()) === true && vq.etat().plateau.modeles[0].nom === 'Bosquet maison'
      && vq.etat().plateau.pieces.some(function (p) { return p.modele === 'M1'; }));
    clic($('#pa-piocher-evenement'));
    var id = vq.ui().evenement;
    verifier('carte Événement piochée sur ce plateau : cases admissibles calculées sans erreur', !!id && marques(vq.vue, 'at-admissible') >= 0);
    clic($('[data-defausser-evenement="' + id + '"]'));
    plateauDeReference();
    AT.app.montrer('partie');
    clic($('#pa-nouvelle'));
  });

  // ================================================================== corrections après la revue (docs/06-revue-creation.md)
  /**
   * Une « autre fenêtre » de l'atelier : une vraie vue Bibliothèque de plus, sur le stockage donné, avec son propre
   * plateau courant. Sert à rejouer les scénarios à deux fenêtres sans ouvrir de fenêtre.
   */
  function fenetre(stockage, plateauInitial) {
    var vp = AT.app.vues.plateau;
    var etat = { plateau: plateauInitial, messages: [], indications: [], fichiers: [] };
    var acces = {
      plateau: function () { return etat.plateau; }, reglages: vp.reglages, ouvrirDocument: function (p) { etat.plateau = p; },
      message: function (t, n) { etat.messages.push(n + ' : ' + t); }, confirmer: function (t, l, f) { f(); },
      telecharger: function (nom, contenu) { etat.fichiers.push({ nom: nom, contenu: String(contenu) }); }, ouvrirFichier: function () {},
      indiquer: function (i) { etat.indications.push(i); }
    };
    etat.vue = AT.vueBibliotheque.creer(acces, { stockage: stockage, ecouter: false });
    etat.vue.montrer(true);
    etat.dernier = function () { return etat.messages[etat.messages.length - 1] || ''; };
    return etat;
  }

  scenario('Revue : bibliothèque à plusieurs fenêtres, attache, identifiants, copies de secours (I1 à I4)', async function () {
    var vp = AT.app.vues.plateau, P = AT.plateau, B = AT.bibliotheque, bib = vp.bibliotheque;
    var pl = function (graine, cle) { return P.avecCamps(P.peindre(P.vierge(graine), cle || '3,0', 'foret').plateau); };
    plateauDeReference();

    // I1 : deux fenêtres sur le même stockage ; chacune enregistre ; rien n'est effacé.
    var s = B.stockageMemoire(), a = fenetre(s, pl('A')), b = fenetre(s, pl('B'));
    a.vue.enregistrerSous('Fait dans A');
    b.vue.enregistrerSous('Fait dans B');
    var dansStockage = function () { return B.charger(s).liste.map(function (e) { return e.nom; }).join(' | '); };
    verifier('I1 : deux fenêtres enregistrent chacune une fiche : le stockage garde les deux, sous deux identifiants', dansStockage() === 'Fait dans A | Fait dans B'
      && B.charger(s).liste[0].id !== B.charger(s).liste[1].id && b.vue.liste().length === 2, dansStockage());
    a.plateau = pl('A', '4,0');
    var majA = a.vue.mettreAJour();
    verifier('I1 : « Mettre à jour » dans la première fenêtre ne perd pas la fiche de la seconde', majA === true && dansStockage() === 'Fait dans A | Fait dans B' && a.vue.liste().length === 2
      && JSON.stringify(B.charger(s).liste[0].plateau) === JSON.stringify(a.plateau) && JSON.stringify(B.charger(s).liste[1].plateau) === JSON.stringify(b.plateau), dansStockage() + ' / ' + a.dernier());
    b.vue.renommer(b.vue.ouvert(), 'Renommé dans B');
    a.vue.dupliquer(a.vue.ouvert());
    verifier('I1 : renommer dans l’une, dupliquer dans l’autre : les deux changements sont gardés', dansStockage() === 'Fait dans A | Renommé dans B | Fait dans A (copie)', dansStockage());
    // Conflit sur la même fiche : la plus récente gagne, et on le dit.
    var idA = a.vue.ouvert();
    b.vue.ouvrir(idA);
    await attendre(5);
    b.plateau = pl('A', '5,0');
    b.vue.mettreAJour();
    await attendre(5);
    a.plateau = pl('A', '6,0');
    var conflit = a.vue.mettreAJour();
    verifier('I1 : même fiche modifiée dans les deux fenêtres : la plus récente gagne et le message le dit', conflit === true && /alerte : .*aussi été modifiée dans une autre fenêtre : votre version, la plus récente, la remplace/.test(a.dernier())
      && JSON.stringify(B.trouver(B.charger(s).liste, idA).plateau) === JSON.stringify(a.plateau) && B.charger(s).liste.length === 3, a.dernier());
    b.plateau = pl('A', '5,1');
    await attendre(5);
    b.vue.mettreAJour();                       // B modifie encore la fiche…
    a.vue.dupliquer(B.charger(s).liste[1].id); // … A écrit une AUTRE fiche entre-temps…
    await attendre(5);
    a.plateau = pl('A', '6,1');
    a.vue.mettreAJour();                       // … puis met à jour la fiche : le conflit doit quand même être dit
    verifier('I1 : le conflit reste annoncé même si la fenêtre a écrit une autre fiche entre-temps', /aussi été modifiée dans une autre fenêtre/.test(a.dernier())
      && JSON.stringify(B.trouver(B.charger(s).liste, idA).plateau) === JSON.stringify(a.plateau) && B.charger(s).liste.length === 4, a.dernier());
    a.plateau = pl('A', '6,2');
    a.vue.mettreAJour();
    verifier('I1 : sans modification ailleurs, une mise à jour ordinaire n’annonce aucun conflit', /^info : /.test(a.dernier()) && !/autre fenêtre/.test(a.dernier()), a.dernier());
    b.vue.supprimer(idA);
    a.plateau = pl('A', '7,0');
    var apresSuppression = a.vue.mettreAJour();
    verifier('I3 : « Mettre à jour » vérifie que la fiche existe encore : supprimée ailleurs, la mise à jour est refusée et expliquée', apresSuppression === false && /n’existe plus dans la bibliothèque/.test(a.dernier())
      && B.charger(s).liste.length === 3 && a.vue.ouvert() === null, a.dernier());

    // I1 : l'événement « storage » d'une autre fenêtre met à jour la liste affichée.
    mode('bibliotheque');
    var avantEvenement = bib.liste().length;
    var ailleurs = B.ajouter(bib.liste(), 'Venu d’une autre fenêtre', pl('ailleurs'), undefined, { minimum: B.charger(stockageRecette).suivant });
    B.enregistrer(stockageRecette, ailleurs.liste, B.numero(ailleurs.id) + 1);
    window.dispatchEvent(new StorageEvent('storage', { key: B.cleListe() }));
    verifier('I1 : événement « storage » : la liste affichée se met à jour toute seule, avec un avis', bib.liste().length === avantEvenement + 1 && $$('#bi-liste .at-bib-fiche').length === avantEvenement + 1
      && /Venu d’une autre fenêtre/.test($('#bi-liste').textContent) && !$('#bi-avis').hidden && /modifiée dans une autre fenêtre/.test($('#bi-avis').textContent), $('#bi-avis').textContent);
    window.dispatchEvent(new StorageEvent('storage', { key: 'autre-application:cle' }));
    verifier('I1 : un événement « storage » d’une autre clé est ignoré', bib.liste().length === avantEvenement + 1);
    clic($('#bi-liste [data-supprimer-entree="' + ailleurs.id + '"]')); clic($('#at-confirmer-oui'));

    // I2 : l'attache est écrite avec le travail en cours, en une écriture.
    var s2 = B.stockageMemoire(), x = fenetre(s2, pl('X'));
    x.vue.enregistrerSous('Fiche X');
    var idX = x.vue.ouvert();
    x.plateau = pl('Y');
    x.vue.enregistrerSous('Fiche Y');
    var idY = x.vue.ouvert();
    x.vue.activer();
    x.vue.ouvrir(idX);
    x.plateau = P.avecCamps(P.peindre(x.plateau, '0,3', 'marais').plateau);
    x.vue.planifier();
    x.vue.sauverTravail();
    var ecrit = JSON.parse(s2.getItem(B.cleTravail()));
    verifier('I2 : le travail en cours porte le plateau ET sa fiche ; plus de clé « ouvert » à part', ecrit.ouvert === idX && JSON.stringify(ecrit.plateau) === JSON.stringify(x.plateau) && s2.getItem('atelier-plateau:ouvert') === null, JSON.stringify(Object.keys(ecrit)));
    x.vue.ouvrir(idY);          // … et la page se recharge avant la sauvegarde suivante : rien n'est écrit
    var apres = fenetre(s2, null), reprise = apres.vue.reprendre();
    verifier('I2 : rechargement juste après « Ouvrir » une autre fiche : le plateau repris garde SA fiche (jamais le plateau de X sous le nom de Y)',
      reprise.ok && JSON.stringify(reprise.plateau) === JSON.stringify(ecrit.plateau) && reprise.ouvert === idX && apres.vue.ouvert() === idX, reprise.ouvert + ' / ' + apres.vue.ouvert());
    var s3 = B.stockageMemoire();
    s3.setItem(B.cleTravail(), JSON.stringify({ format: 'atelier-travail', version: 1, modifie: '2026-11-19T10:00:00.000Z', plateau: pl('ancien') }));
    s3.setItem('atelier-plateau:ouvert', 'b1');
    var ancien = fenetre(s3, null), repriseAncienne = ancien.vue.reprendre();
    ancien.plateau = repriseAncienne.plateau;
    verifier('I2 : ancien stockage (travail sans attache, clé « ouvert » à part) : relu sans erreur, sans attache', repriseAncienne.ok && !!repriseAncienne.plateau && ancien.vue.ouvert() === null && ancien.vue.avis() === null, String(ancien.vue.avis()));
    ancien.vue.activer();
    ancien.plateau = pl('ancien', '4,0');
    ancien.vue.planifier(); ancien.vue.sauverTravail();
    verifier('I2 : à la première sauvegarde, l’ancienne clé « ouvert » disparaît', s3.getItem('atelier-plateau:ouvert') === null && B.chargerTravail(s3).ok);

    // I3 : scénario de la revue, dans la vraie page. Un identifiant de fiche supprimée n'est pas redonné.
    mode('pinceau');
    clic($('#pi-terrain-foret'));
    verifier('I3 : bibliothèque vide au départ', bib.liste().length === 0, bib.liste().length);
    bib.enregistrerSous('Plateau A');
    var idPlateauA = bib.ouvert();
    clicCase(vp.vue, '7,-7');
    mode('creer');
    clic($('#cr-vierge'));
    mode('bibliotheque');
    clic($('#bi-liste [data-supprimer-entree="' + idPlateauA + '"]')); clic($('#at-confirmer-oui'));
    bib.enregistrerSous('Plateau Z');
    var idZ = bib.ouvert(), contenuZ = JSON.stringify(bib.liste()[0].plateau);
    verifier('I3 : la fiche suivante ne reprend pas l’identifiant de la fiche supprimée', bib.liste().length === 1 && idZ !== idPlateauA && B.numero(idZ) > B.numero(idPlateauA), idPlateauA + ' → ' + idZ);
    verifier('I3 : le compteur des fiches a sa propre clé ; l’enveloppe de la bibliothèque reste à trois champs (une copie plus ancienne de l’atelier la relit)',
      stockageRecette.getItem(B.cleCompteur()) === String(B.numero(idZ) + 1) && Object.keys(JSON.parse(stockageRecette.getItem(B.cleListe()))).join() === 'format,version,plateaux', stockageRecette.getItem(B.cleCompteur()));
    clic($('#pl-annuler'));
    verifier('I3 : Annuler ramène l’ancien plateau A, qui n’est PAS rattaché à la fiche Z', vp.plateau().pieces.length === 27 && bib.ouvert() === null && $('#at-nom-plateau').textContent === 'Plateau : sans nom' && !$('#bi-mettre-a-jour'),
      $('#at-nom-plateau').textContent);
    verifier('I3 : « Mettre à jour » est alors refusé ; la fiche Z garde son contenu', bib.mettreAJour() === false && JSON.stringify(bib.liste()[0].plateau) === contenuZ && JSON.stringify(B.charger(stockageRecette).liste[0].plateau) === contenuZ);
    clic($('#pl-retablir'));
    verifier('I3 : Rétablir : le plateau vierge revient avec sa fiche Z', bib.ouvert() === idZ && vp.plateau().pieces.length === 1 && $('#at-nom-plateau').textContent === 'Plateau : « Plateau Z »', $('#at-nom-plateau').textContent);

    // M5 : annuler en deçà de « Enregistrer sous » garde l'attache.
    mode('pinceau');
    clicCase(vp.vue, '3,0');
    clicCase(vp.vue, '4,0');
    mode('bibliotheque');
    bib.enregistrerSous('Mon plateau');
    var idMon = bib.ouvert();
    clic($('#pl-annuler'));
    verifier('M5 : annuler en deçà de l’enregistrement : le plateau reste attaché à sa fiche, marquée « modifié »', bib.ouvert() === idMon && $('#at-nom-plateau').textContent === 'Plateau : « Mon plateau » (modifié)'
      && !!$('#bi-mettre-a-jour') && !$('#bi-mettre-a-jour').disabled, $('#at-nom-plateau').textContent);
    clic($('#pl-annuler'));
    verifier('M5 : un pas plus loin (avant la retouche) : même document, toujours attaché à « Mon plateau »', bib.ouvert() === idMon);
    clic($('#pl-retablir')); clic($('#pl-retablir'));

    // M6 : nom déjà pris.
    saisir($('#bi-nom'), 'mon PLATEAU');
    clic($('#bi-enregistrer'));
    var noms = bib.liste().map(function (e) { return e.nom; });
    verifier('M6 : nom déjà pris : numéroté automatiquement et annoncé', noms.indexOf('mon PLATEAU (2)') !== -1 && /Le nom « mon PLATEAU » est déjà pris : plateau enregistré dans la bibliothèque sous le nom « mon PLATEAU \(2\) »/.test($('#barre-etat').textContent)
      && /at-etat-alerte/.test(etatBarre()) && $('#at-nom-plateau').textContent === 'Plateau : « mon PLATEAU (2) »', noms.join(' | ') + ' / ' + $('#barre-etat').textContent);
    bib.renommer(bib.ouvert(), 'Plateau Z');
    verifier('M6 : renommer vers un nom pris : numéroté aussi', bib.liste().filter(function (e) { return e.nom === 'Plateau Z (2)'; }).length === 1 && /déjà pris : plateau renommé « Plateau Z \(2\) »/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    var tousNoms = bib.liste().map(function (e) { return e.nom.toLowerCase(); });
    verifier('M6 : aucun nom en double dans la bibliothèque', tousNoms.filter(function (n, i) { return tousNoms.indexOf(n) !== i; }).length === 0, tousNoms.join(' | '));

    // I4 : contenu illisible ou d'une version inconnue : jamais écrasé sans copie de secours ; les avis se cumulent.
    var s4 = B.stockageMemoire();
    var futur = JSON.stringify({ format: 'atelier-bibliotheque', version: 2, plateaux: [{ id: 'b1', nouveau: 'champ d’une version future' }] });
    s4.setItem(B.cleListe(), futur);
    s4.setItem(B.cleTravail(), '{travail abîmé');
    var w = fenetre(s4, pl('W'));
    var repriseW = w.vue.reprendre();
    w.vue.rafraichir();
    var avisW = w.vue.avis() || '';
    verifier('I4 : bibliothèque d’une version inconnue ET travail illisible : les deux avis sont affichés ensemble', repriseW.ok === false && /Version de bibliothèque non reconnue/.test(avisW) && /Travail en cours illisible/.test(avisW)
      && w.vue.element.querySelectorAll('#bi-avis p').length === 2 && s4.getItem(B.cleListe()) === futur, avisW);
    var enregistreW = w.vue.enregistrerSous('Après');
    var copies = B.listerSecours(s4);
    verifier('I4 : premier enregistrement : le contenu d’origine est d’abord copié sous une clé de secours datée', enregistreW === true && copies.length === 1 && copies[0].texte === futur && copies[0].origine === 'bibliotheque'
      && /^atelier-plateau:secours:bibliotheque:\d{4}-\d\d-\d\dT/.test(copies[0].cle) && B.charger(s4).liste.length === 1, copies.map(function (c) { return c.cle; }).join());
    verifier('I4 : la copie de secours est annoncée à l’écran et le bouton d’export apparaît', /copie de secours/.test(w.vue.avis()) && /Travail en cours illisible/.test(w.vue.avis()) && !w.vue.element.querySelector('#bi-exporter-secours').hidden, w.vue.avis());
    w.vue.activer();
    w.plateau = pl('W', '5,0');
    w.vue.planifier(); w.vue.sauverTravail();
    copies = B.listerSecours(s4);
    verifier('I4 : le travail illisible est copié lui aussi avant d’être remplacé', copies.length === 2 && copies[1].origine === 'travail' && copies[1].texte === '{travail abîmé' && B.chargerTravail(s4).ok === true, copies.length);
    clic(w.vue.element.querySelector('#bi-exporter-secours'));
    verifier('I4 : « Exporter les copies de secours » : un fichier qui contient les textes d’origine', w.fichiers.length === 1 && w.fichiers[0].nom === 'copies-de-secours-atelier.json'
      && JSON.parse(w.fichiers[0].contenu).copies.length === 2 && JSON.parse(w.fichiers[0].contenu).copies[0].texte === futur);
    // Fiches écartées (réglage changé, autre copie de l'atelier) : la fiche écartée n'est pas perdue à l'écriture suivante.
    var s5 = B.stockageMemoire(), deuxFiches = B.ajouter(B.ajouter(B.vide(), 'Ordinaire', pl('o')).liste, 'Sept cases', pl('s')).liste;
    var brut = JSON.parse(B.exporter(deuxFiches));
    brut.plateaux[1].plateau.modeles = [{ id: 'X1', nom: 'Sept', quantite: 1, cases: [0, 1, 2, 3, 4, 5, 6].map(function (q) { return { q: q, r: 0, terrain: 'plaine' }; }) }];
    s5.setItem(B.cleListe(), JSON.stringify(brut));
    var e5 = fenetre(s5, pl('e'));
    verifier('I4 : une fiche illisible est écartée avec un avis, sans rien effacer', e5.vue.liste().length === 1 && /1 plateau illisible a été écarté/.test(e5.vue.avis()) && s5.getItem(B.cleListe()) === JSON.stringify(brut), e5.vue.avis());
    e5.vue.renommer(e5.vue.liste()[0].id, 'Renommée');
    copies = B.listerSecours(s5);
    verifier('I4 : renommer la fiche ordinaire : le contenu d’origine (avec la fiche écartée) est gardé en copie de secours', copies.length === 1 && JSON.parse(copies[0].texte).plateaux.length === 2
      && JSON.parse(copies[0].texte).plateaux[1].nom === 'Sept cases' && B.charger(s5).liste[0].nom === 'Renommée', copies.length);
    var suivante = e5.vue.enregistrerSous('Nouvelle');
    verifier('I3 : le numéro de la fiche écartée n’est pas redonné à une nouvelle fiche', suivante === true && B.numero(e5.vue.ouvert()) > 2, e5.vue.ouvert());

    // M1 : un plateau généré par « #graine= » ne remplace pas le travail sauvegardé tant que rien n'est modifié.
    var s6 = B.stockageMemoire(), fait = pl('fait main');
    B.enregistrerTravail(s6, fait);
    var texteTravail = s6.getItem(B.cleTravail());
    var g = fenetre(s6, AT.generateur.generer(12, vp.reglages()).plateau);
    g.vue.activer();                       // démarrage avec « #graine= » : pas de reprise, sauvegarde armée
    var fermeture = g.vue.sauverTravail(); // fermeture de la page (pagehide)
    verifier('M1 : page ouverte avec « #graine= » puis fermée sans rien modifier : le travail sauvegardé est intact', fermeture.ok === true && s6.getItem(B.cleTravail()) === texteTravail);
    g.plateau = P.avecCamps(P.peindre(g.plateau, '9,-9', 'plaine').plateau);
    g.vue.planifier(); g.vue.sauverTravail();
    verifier('M1 : après une modification, le travail en cours devient le plateau modifié', JSON.stringify(B.chargerTravail(s6).plateau) === JSON.stringify(g.plateau));

    // M7 : stockage plein : la bibliothèque continue en mémoire, avec la consigne d'exporter.
    var plein = fenetre(B.stockageMemoire({ quota: 50 }), pl('plein'));
    var memoire = plein.vue.enregistrerSous('Gardé en mémoire');
    verifier('M7 : stockage plein : la fiche est gardée en mémoire pour la session', memoire === true && plein.vue.liste().length === 1 && plein.vue.enMemoire() === true && plein.vue.ouvert() === plein.vue.liste()[0].id
      && plein.vue.element.querySelectorAll('.at-bib-fiche').length === 1);
    verifier('M7 : message et avis clairs, qui invitent à « Exporter toute la bibliothèque »', /alerte : .*gardé en mémoire seulement.*« Exporter toute la bibliothèque »/.test(plein.dernier())
      && /continue en mémoire pour cette session/.test(plein.vue.avis()) && /Exporter toute la bibliothèque/.test(plein.vue.avis()), plein.dernier());
    plein.vue.activer();
    plein.plateau = pl('plein', '4,0');
    plein.vue.planifier();
    var sauvegardePleine = plein.vue.sauverTravail();
    verifier('M7 / I4 : stockage plein, sauvegarde automatique impossible : l’avis du travail s’AJOUTE à celui de la bibliothèque, aucun ne remplace l’autre',
      sauvegardePleine.ok === false && /la bibliothèque continue en mémoire pour cette session/.test(plein.vue.avis()) && /le travail en cours n’est plus sauvegardé automatiquement/.test(plein.vue.avis())
      && plein.vue.element.querySelectorAll('#bi-avis p').length === 2 && plein.indications[plein.indications.length - 1].niveau === 'erreur', plein.vue.avis());
    plein.vue.enregistrerSous('Seconde');
    verifier('M7 / I4 : un nouvel enregistrement en mémoire ne fait pas disparaître l’avis du travail', /le travail en cours n’est plus sauvegardé automatiquement/.test(plein.vue.avis()) && /continue en mémoire/.test(plein.vue.avis()), plein.vue.avis());
    plein.vue.exporter();
    verifier('M7 : la bibliothèque en mémoire continue de servir et s’exporte', plein.vue.liste().length === 2 && plein.fichiers.length === 1 && JSON.parse(plein.fichiers[0].contenu).plateaux.length === 2);

    // Remise en état.
    mode('bibliotheque');
    while (bib.liste().length) { clic($('#bi-liste [data-supprimer-entree]')); clic($('#at-confirmer-oui')); }
    verifier('bibliothèque remise à vide', bib.liste().length === 0 && B.charger(stockageRecette).liste.length === 0);
    plateauDeReference();
    AT.app.montrer('partie');
  });

  scenario('Revue : gestes en cours, noyau fixe, montagne hors bloc (M2, questions 1 et 3)', async function () {
    var vp = AT.app.vues.plateau, vue = vp.vue;
    plateauDeReference();
    mode('creer');
    clic($('#cr-vierge'));
    mode('pinceau');
    clic($('#pi-terrain-foret'));
    clicCase(vue, '3,0');
    var rang = vp.etat().rang;

    // M2 : Annuler / Rétablir pendant un trait sont ignorés.
    var p4 = vue.pointEcran('4,0'), p5 = vue.pointEcran('5,0');
    pointeur(vue.svg, 'pointerdown', p4);
    touche('z', { ctrlKey: true });
    var pendant = { rang: vp.etat().rang, barre: $('#barre-etat').textContent };
    clic($('#pl-annuler'));
    touche('y', { ctrlKey: true });
    pointeur(vue.svg, 'pointermove', p5);
    pointeur(vue.svg, 'pointerup', p5);
    vue.svg.dispatchEvent(new MouseEvent('click', { clientX: p5.x, clientY: p5.y, bubbles: true, cancelable: true }));
    verifier('M2 : Ctrl+Z et le bouton Annuler pendant un trait de pinceau : ignorés, avec un message', pendant.rang === rang && /Geste en cours/.test(pendant.barre), JSON.stringify(pendant));
    verifier('M2 : le trait se termine normalement : une étape, les trois forêts sont là', vp.etat().rang === rang + 1 && ['3,0', '4,0', '5,0'].every(function (k) { return pieceEn(vp, k) && pieceEn(vp, k).modele === 'F'; }));
    touche('z', { ctrlKey: true });
    verifier('M2 : après le relâchement, Ctrl+Z annule le trait entier et seulement lui', vp.etat().rang === rang && !!pieceEn(vp, '3,0') && !pieceEn(vp, '4,0') && !pieceEn(vp, '5,0'));
    mode('creer');
    rang = vp.etat().rang;
    var pendantGlisse = null;
    glisserPalette('M4', vue.pointEcran('3,2'), function () {
      touche('z', { ctrlKey: true });
      pendantGlisse = { rang: vp.etat().rang, piece: !!pieceEn(vp, '3,0') };
    });
    verifier('M2 : Ctrl+Z pendant un glisser depuis la palette : ignoré, la pièce est posée au relâchement', pendantGlisse.rang === rang && pendantGlisse.piece && vp.etat().rang === rang + 1 && !!pieceEn(vp, '3,2'), JSON.stringify(pendantGlisse));
    var avantDeplacement = vp.etat().rang;
    glisserCases(vue, ['3,2', '4,2', '-4,3'], null, function () { touche('z', { ctrlKey: true }); pendantGlisse = { rang: vp.etat().rang }; });
    verifier('M2 : Ctrl+Z pendant le glisser d’une pièce posée : ignoré', pendantGlisse.rang === avantDeplacement && vp.etat().rang === avantDeplacement + 1 && !!pieceEn(vp, '-4,3'));

    // Question 3 : la gomme ne retire jamais le noyau.
    mode('pinceau');
    clic($('#pi-gomme'));
    rang = vp.etat().rang;
    clicCase(vue, '1,0');
    verifier('noyau fixe : la gomme cliquée sur le noyau ne propose pas de le retirer (aucune fenêtre), et dit pourquoi', $('#at-confirmation').open !== true && pieceEn(vp, '0,0').modele === 'N1' && vp.etat().rang === rang
      && /Le noyau est fixe : la gomme ne le retire jamais/.test($('#pi-message').textContent) && /« Vider le plateau » et « Nouveau plateau vierge »/.test($('#pi-message').textContent) && /at-etat-erreur/.test(etatBarre()), $('#pi-message').textContent);
    verifier('noyau fixe : l’aide du pinceau le dit', /elle ne retire jamais le noyau, qui est fixe/.test($('#pi-panneau').textContent));
    mode('creer');
    rang = vp.etat().rang;
    clicCase(vue, '0,0');
    clic($('#pl-retirer'));
    var apresBouton = { rang: vp.etat().rang, barre: $('#barre-etat').textContent };
    touche('Delete');
    verifier('noyau fixe : « Retirer » et la touche Suppr ne le retirent pas non plus, et disent pourquoi', apresBouton.rang === rang && vp.etat().rang === rang && pieceEn(vp, '0,0').modele === 'N1'
      && /Le noyau est fixe : il ne se retire pas/.test(apresBouton.barre) && /at-etat-erreur/.test(etatBarre()), apresBouton.barre);
    touche('Escape');
    clic($('#pl-vider'));
    verifier('noyau fixe : « Vider le plateau » reste le moyen de le retirer', vp.plateau().pieces.length === 0);
    clic($('#pl-annuler'));

    // Question 1 : monobloc personnel avec de la montagne hors bloc de 4 ou 5 cases.
    mode('monoblocs');
    clic($('#mo-effacer'));
    clic($('#mo-terrain-montagne'));
    ['0,0', '1,0', '1,1'].forEach(function (k) { $('#mo-grille [data-case="' + k + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    saisir($('#mo-nom'), 'Trois pics');
    verifier('montagne hors bloc : l’éditeur le rappelle sans bloquer', !!$('#mo-rappel-montagne') && /bloc de 4 ou 5 cases/.test($('#mo-rappel-montagne').textContent) && !$('#mo-valider').disabled, $('#mo-avis').textContent);
    $('#mo-grille [data-case="0,1"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    verifier('bloc de 4 cases tout en montagne : plus de rappel', !$('#mo-rappel-montagne') && !$('#mo-valider').disabled);
    $('#mo-grille [data-case="0,1"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    clic($('#mo-valider'));
    var idPics = vp.plateau().modeles[vp.plateau().modeles.length - 1].id;
    mode('creer');
    verifier('montagne hors bloc : pièce non posée, pas d’alerte sur le plateau', !/hors bloc de 4 ou 5 cases/.test($('#pl-controles').textContent));
    clic($('#pl-stock [data-modele="' + idPics + '"]'));
    clicCase(vue, '4,-3');
    touche('Escape');
    var constat = $$('#pl-controles [data-regle="inventaire"]').filter(function (e) { return /hors bloc de 4 ou 5 cases/.test(e.textContent); })[0];
    verifier('montagne hors bloc : une fois posée, le contrôle 1 la signale en alerte (pas en erreur), comme la montagne d’une case', !!constat && constat.getAttribute('data-niveau') === 'alerte'
      && /1 monobloc personnel avec de la montagne hors bloc de 4 ou 5 cases \(Trois pics\) : la décision en vigueur est « montagnes en blocs de 4 ou 5 cases »/.test(constat.textContent), constat && constat.textContent);
    verifier('aide de l’éditeur : bornes lues dans les réglages', new RegExp(AT.catalogue.REGLAGES.perso.casesMin + ' à ' + AT.catalogue.REGLAGES.perso.casesMax + ' cases qui se touchent').test($('#mo-panneau').textContent));
    plateauDeReference();
    AT.app.montrer('partie');
  });

  // ================================================================== lot G : catalogue 2 et étape « Villes »
  function compteur(nom) { var e = $('#vi-outils [data-compteur="' + nom + '"]'); return e ? e.textContent : ''; }
  function reglagesParDefaut() {
    var vp = AT.app.vues.plateau, C = AT.catalogue;
    if ($('#vi-libre').checked) clic($('#vi-libre'));
    choisir($('#vi-profondeur'), C.REGLAGES.villes.profondeurExtremite);
    choisir($('#pl-remplissages'), C.REGLAGES.generateur.remplissages);
    return vp.reglages().profondeurExtremite === C.REGLAGES.villes.profondeurExtremite && vp.reglages().remplissages === C.REGLAGES.generateur.remplissages && !vp.villes.libre();
  }

  scenario('Lot G : étape « Villes » (pose par clic, refus, compteurs, annulation, pose libre, profondeur, automatique)', async function () {
    var vp = AT.app.vues.plateau, P = AT.plateau, C = AT.catalogue, V = AT.vueVilles, vue = vp.vue;
    plateauDeReference();
    var complet = JSON.stringify(vp.plateau());
    mode('villes');
    verifier('mode « Villes » sur un plateau complet : compteurs 2 / 2, aucune place en surbrillance, « Plateau complet »', vp.mode() === 'villes' && visible($('#vi-panneau'))
      && compteur('vert') === '2 / 2' && compteur('rouge') === '2 / 2' && compteur('neutre') === '2 / 2' && marques(vue, 'at-admissible') === 0
      && /Plateau complet/.test($('#vi-etape').textContent) && $('#vi-diagnostic').hidden && !visible($('#pl-outil')) && visible($('#cr-reste')), $('#vi-etape').textContent);
    verifier('trois villes à choisir, chacune dessinée ; réglages : profondeur des extrémités (1, 2, 3) et pose libre', $$('#vi-outils button').length === 3 && $$('#vi-outils svg').length === 3
      && $$('#vi-profondeur option').length === 3 && $('#vi-profondeur').value === String(C.REGLAGES.villes.profondeurExtremite) && $('#vi-libre').checked === false);

    // Retirer toutes les villes : un plateau construit sans villes n'est pas en erreur.
    var rang = vp.etat().rang;
    clic($('#vi-retirer'));
    var nu = JSON.stringify(vp.plateau());
    verifier('« Retirer toutes les villes » : 6 villes retirées en une étape, terrain intact', vp.etat().rang === rang + 1 && vp.plateau().pieces.length === 24 && P.deploiements(vp.plateau()).length === 0
      && compteur('vert') === '0 / 2' && compteur('neutre') === '0 / 2' && /6 villes retirées/.test($('#vi-message').textContent), $('#vi-message').textContent);
    verifier('plateau sans villes : pas en erreur ; ligne d’étape en tête « Construction terminée : posez les villes »', vp.bilan().erreurs === 0 && vp.bilan().etape === 'villes'
      && !/at-niveau-erreur/.test($('#pl-bilan').className) && $('#pl-controles').firstElementChild.id === 'pl-etape' && $('#pl-etape-titre').textContent === 'Construction terminée : posez les villes'
      && /2 villes de déploiement pour Vert, 2 villes de déploiement pour Rouge, 2 villes neutres/.test($('#pl-etape').textContent), $('#pl-etape').textContent + ' / ' + $('#pl-bilan').textContent);
    verifier('contrôles en deux groupes titrés « Construction » et « Villes » (7 contrôles en tout)', $$('#pl-controles .at-groupe').length === 3 && /^Construction/.test($('#pl-groupe-construction').textContent)
      && /^Villes/.test($('#pl-groupe-villes').textContent) && /à poser/.test($('#pl-groupe-villes').textContent) && /conforme/.test($('#pl-groupe-construction').textContent) && $$('#pl-controles .at-regle').length === 7
      && $$('#pl-controles [data-groupe="construction"].at-constat').length >= 4 && $$('#pl-controles [data-groupe="villes"].at-constat').length >= 2
      && !$('#pl-controles [data-groupe="villes"][data-niveau="erreur"]'), $('#pl-groupe-villes').textContent);
    touche('z', { ctrlKey: true });
    verifier('Ctrl+Z : les 6 villes reviennent', JSON.stringify(vp.plateau()) === complet && compteur('rouge') === '2 / 2');
    touche('y', { ctrlKey: true });

    // Pose par clic : la Plaine reste dessous, la ville est une tuile posée par-dessus.
    clic($('#vi-outil-vert'));
    var places = V.places(vp.plateau(), 'vert'), plainesAvant = $$('svg > g:first-of-type > g:first-child > polygon[fill*="plaine"]', vue.svg.parentNode).length;
    verifier('outil « déploiement de Vert » : les places admissibles du modèle sont en surbrillance', places.length > 1 && marques(vue, 'at-admissible') === places.length
      && JSON.stringify(places) === JSON.stringify(P.placesDeploiement(vp.plateau(), 'vert', { profondeurExtremite: 2 })), marques(vue, 'at-admissible') + ' / ' + places.length);
    rang = vp.etat().rang;
    clicCase(vue, places[0]);
    verifier('clic sur une place : ville de déploiement de Vert posée, une étape, compteur 1 / 2', vp.etat().rang === rang + 1 && vp.plateau().camps.vert.join() === places[0] && compteur('vert') === '1 / 2'
      && /Ville de déploiement de Vert posée sur la Plaine/.test($('#barre-etat').textContent) && /at-etat-info/.test(etatBarre()), $('#barre-etat').textContent);
    verifier('rendu : la ville est une tuile bordée de vert posée PAR-DESSUS, la Plaine reste dessinée dessous', $$('polygon[stroke="#007A4D"]', vue.svg).length === 1
      && $$('svg > g:first-of-type > g:first-child > polygon[fill*="plaine"]', vue.svg.parentNode).length === plainesAvant && P.cases(vp.plateau())[places[0]].origine === 'plaine'
      && $$('circle[fill="#007A4D"]', vue.svg).length === 1, $$('polygon[stroke="#007A4D"]', vue.svg).length);
    // Refus expliqués, avec la raison du modèle.
    rang = vp.etat().rang;
    clicCase(vue, '1,0');
    verifier('refus sur le noyau : la raison du modèle, rien ne change', vp.etat().rang === rang && $('#barre-etat').textContent === 'Pose refusée : Une ville de déploiement ne se pose pas sur le noyau.'
      && /at-etat-erreur/.test(etatBarre()) && /noyau/.test($('#vi-message').textContent), $('#barre-etat').textContent);
    var tropPres = P.placesDeploiementSurCases(P.cases(vp.plateau()), 'vert', { profondeurExtremite: 2, sansEcart: true }).filter(function (k) { return V.places(vp.plateau(), 'vert').indexOf(k) === -1; })[0];
    clicCase(vue, tropPres);
    verifier('refus pour l’écart : « Trop près d’une autre ville : n pas, il en faut 4 »', !!tropPres && vp.etat().rang === rang && /Pose refusée : Trop près d’une autre ville : \d pas, il en faut 4 \(soit 3 cases entre elles\)/.test($('#barre-etat').textContent),
      tropPres + ' : ' + $('#barre-etat').textContent);
    var enBas = V.places(vp.plateau(), 'rouge')[0];
    clicCase(vue, enBas);
    verifier('refus hors de l’extrémité du camp : expliqué', vp.etat().rang === rang && /n’est pas à l’extrémité du haut/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    // Cliquer une ville posée la retire ; tout s'annule.
    clicCase(vue, places[0]);
    verifier('clic sur la ville posée : elle est retirée (une étape), la Plaine est libre', vp.etat().rang === rang + 1 && vp.plateau().camps.vert.length === 0 && compteur('vert') === '0 / 2'
      && /retirée de/.test($('#barre-etat').textContent) && $$('polygon[stroke="#007A4D"]', vue.svg).length === 0, $('#barre-etat').textContent);
    clic($('#pl-annuler'));
    verifier('Annuler : la ville retirée revient', vp.plateau().camps.vert.join() === places[0] && compteur('vert') === '1 / 2');
    var seconde = V.places(vp.plateau(), 'vert')[0];
    clicCase(vue, seconde);
    verifier('seconde ville de Vert : compteur 2 / 2, et l’outil passe de lui-même à Rouge', compteur('vert') === '2 / 2' && vp.villes.outil() === 'rouge' && $('#vi-outil-rouge').getAttribute('aria-pressed') === 'true'
      && marques(vue, 'at-admissible') === V.places(vp.plateau(), 'rouge').length, vp.villes.outil());
    clic($('#vi-outil-vert'));
    rang = vp.etat().rang;
    clicCase(vue, V.places(nuPlateau(), 'vert').filter(function (k) { return vp.plateau().camps.vert.indexOf(k) === -1; })[0]);
    verifier('troisième ville de Vert : refusée (« a déjà ses 2 villes »)', vp.etat().rang === rang && /Vert a déjà ses 2 villes de déploiement/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    function nuPlateau() { return JSON.parse(nu); }

    // Pose libre : hors règles, acceptée, signalée par les contrôles.
    clic($('#vi-outil-rouge'));
    var horsRegle = P.placesDeploiementSurCases(P.cases(vp.plateau()), 'vert', { profondeurExtremite: 2 })[0];
    clicCase(vue, horsRegle);
    var refusStrict = vp.etat().rang === rang && /Pose refusée/.test($('#barre-etat').textContent);
    clic($('#vi-libre'));
    verifier('pose libre cochée : bien plus de places en surbrillance', vp.villes.libre() === true && marques(vue, 'at-admissible') > V.places(vp.plateau(), 'rouge').length && marques(vue, 'at-admissible') === V.places(vp.plateau(), 'rouge', { libre: true }).length,
      marques(vue, 'at-admissible'));
    clicCase(vue, horsRegle);
    verifier('pose libre : la ville de Rouge refusée en pose stricte est acceptée en haut du plateau, et c’est annoncé', refusStrict && vp.etat().rang === rang + 1 && vp.plateau().camps.rouge.join() === horsRegle
      && /Pose libre : les contrôles disent si elle respecte les règles/.test($('#barre-etat').textContent) && /at-etat-alerte/.test(etatBarre()), $('#barre-etat').textContent);
    var erreurVille = $$('#pl-controles [data-groupe="villes"][data-niveau="erreur"]')[0];
    verifier('pose libre : les contrôles la signalent (« mal placée »), groupe Villes en erreur', !!erreurVille && /Ville de déploiement de Rouge en \(.*\) mal placée/.test(erreurVille.textContent)
      && /erreur/.test($('#pl-groupe-villes').textContent) && vp.bilan().villes.erreurs > 0, erreurVille && erreurVille.textContent);
    clic($('#vi-libre'));
    clicCase(vue, horsRegle);
    verifier('pose libre décochée ; la ville mal placée se retire d’un clic', vp.villes.libre() === false && vp.plateau().camps.rouge.length === 0 && vp.bilan().villes.erreurs === 0);

    // Profondeur des extrémités : un seul réglage pour la surbrillance, la pose et les contrôles ; le catalogue n'est pas modifié.
    var parProfondeur = {};
    [1, 3, 2].forEach(function (p) { choisir($('#vi-profondeur'), p); parProfondeur[p] = marques(vue, 'at-admissible'); });
    verifier('profondeur des extrémités 1, 2, 3 rangées : de plus en plus de places ; le réglage du catalogue n’est pas touché', parProfondeur[1] <= parProfondeur[2] && parProfondeur[2] <= parProfondeur[3] && parProfondeur[1] < parProfondeur[3]
      && vp.reglages().profondeurExtremite === 2 && C.REGLAGES.villes.profondeurExtremite === 2 && parProfondeur[2] === V.places(vp.plateau(), 'rouge').length, JSON.stringify(parProfondeur));

    // Poser automatiquement, au meilleur équilibre.
    rang = vp.etat().rang;
    clic($('#vi-auto'));
    verifier('« Poser les villes automatiquement » : plateau complet, aucune erreur, en UNE étape, score annoncé', vp.etat().rang === rang + 1 && vp.bilan().etape === 'complet' && vp.bilan().erreurs === 0
      && compteur('vert') === '2 / 2' && compteur('rouge') === '2 / 2' && compteur('neutre') === '2 / 2' && /au meilleur équilibre \(score \d+/.test($('#vi-message').textContent)
      && $('#pl-etape-titre').textContent === 'Plateau complet' && relisible(vp), $('#vi-message').textContent + ' ' + $('#pl-bilan').textContent);
    verifier('pose automatique : au moins aussi équilibrée que les villes du générateur sur ce terrain', vp.bilan().equilibre.score <= AT.controles.equilibre(JSON.parse(complet)).score, vp.bilan().equilibre.score);
    verifier('tableau d’équilibre selon les écarts entre camps : centre, 2 neutres, villes de déploiement, ligne « villes adverses », score', $$('#pl-equilibre tbody tr').length === 7
      && $$('#pl-equilibre tbody tr[data-type="centre"]').length === 1 && $$('#pl-equilibre tbody tr[data-type="neutre"]').length === 2 && $$('#pl-equilibre tbody tr[data-type="vert"]').length === 2
      && /Villes de déploiement adverses/.test($('#pl-adverses').textContent) && /\d+ et \d+/.test($('#pl-adverses').textContent)
      && new RegExp('Score d’équilibre : ' + vp.bilan().equilibre.score + ' ').test($('#pl-score').textContent), $('#pl-adverses').textContent + ' / ' + $('#pl-score').textContent);
    clic($('#pl-annuler'));
    verifier('la pose automatique s’annule d’un coup', vp.etat().rang === rang && vp.bilan().etape === 'villes' && compteur('vert') === '2 / 2' && compteur('neutre') === '0 / 2');
    clic($('#pl-retablir'));

    // Aucune place : dit clairement, avec la cause, et le réglage de profondeur proposé.
    var cas = null;
    for (var g = 1; g <= 12 && !cas; g++) {
      var terrain = V.retirerToutes(AT.generateur.generer(g).plateau).plateau;
      ['vert', 'rouge'].forEach(function (camp) {
        V.places(terrain, camp, { profondeurExtremite: 1 }).forEach(function (k) {
          if (cas) return;
          var un = V.cliquer(terrain, camp, k, { profondeurExtremite: 1 }).plateau, d = V.diagnostic(un, camp, { profondeurExtremite: 1 });
          if (d && d.cause === 'ecart' && d.profondeurConseillee) cas = { plateau: un, camp: camp, conseil: d.profondeurConseillee };
        });
      });
    }
    verifier('recherche d’un plateau où un camp n’a plus aucune place à cause de l’écart', !!cas);
    if (cas) {
      vp.ouvrirTexte(P.serialiser(cas.plateau));
      choisir($('#vi-profondeur'), 1);
      clic($('#vi-outil-' + cas.camp));
      verifier('aucune place : dit clairement, avec la cause (écart de 4 pas), aucune surbrillance', !$('#vi-diagnostic').hidden && $('#vi-diagnostic').getAttribute('data-cause') === 'ecart' && marques(vue, 'at-admissible') === 0
        && /Aucune place pour (Vert|Rouge)/.test($('#vi-diagnostic').textContent) && /il faut 4 pas entre deux villes \(soit 3 cases entre elles\)/.test($('#vi-diagnostic').textContent), $('#vi-diagnostic').textContent);
      verifier('aucune place : le réglage de profondeur des extrémités est proposé', new RegExp('élargissez l’extrémité à ' + cas.conseil + ' rangées \\(réglage « Profondeur des extrémités »').test($('#vi-diagnostic').textContent), $('#vi-diagnostic').textContent);
      choisir($('#vi-profondeur'), cas.conseil);
      verifier('profondeur conseillée choisie : des places apparaissent, l’avis disparaît, et la pose réussit', $('#vi-diagnostic').hidden && marques(vue, 'at-admissible') > 0);
      clicCase(vue, V.places(vp.plateau(), cas.camp, { profondeurExtremite: cas.conseil })[0]);
      verifier('ville posée à la profondeur choisie : acceptée par les contrôles sous ce même réglage', compteur(cas.camp) === '2 / 2' && vp.bilan().villes.erreurs === 0, $('#barre-etat').textContent);
    }
    verifier('réglages remis à leur valeur par défaut', reglagesParDefaut());

    // Pose automatique impossible : dit pourquoi.
    mode('creer');
    clic($('#cr-vierge'));
    mode('villes');
    rang = vp.etat().rang;
    clic($('#vi-auto'));
    verifier('pose automatique sur le noyau seul : impossible, avec la cause et le nombre de places trouvées', vp.etat().rang === rang && /Pose automatique impossible : Pas assez de places/.test($('#vi-message').textContent)
      && /Places trouvées : 0 pour Vert/.test($('#vi-message').textContent) && /at-etat-erreur/.test(etatBarre()), $('#vi-message').textContent);
    verifier('terrain non fini : l’étape le dit, sans interdire d’essayer', /Le terrain n’est pas fini \(23 pièces de terrain à poser\)/.test($('#vi-etape').textContent) && !$('#vi-diagnostic').hidden
      && $('#pl-etape-titre').textContent === 'Construction en cours' && /après la construction/.test($('#pl-groupe-villes').textContent), $('#vi-etape').textContent + ' / ' + $('#pl-groupe-villes').textContent);

    // Une retouche du terrain qui enlève une ville : annoncé à l'écran.
    plateauDeReference();
    var vd = vp.plateau().camps.vert[0];
    clicCase(vue, vd);
    clic($('#pl-retirer'));
    verifier('retirer la pièce qui porte une ville de déploiement : annoncé (« retirée avec la Plaine qui la portait »), en alerte', vp.plateau().camps.vert.length === 1
      && /La ville de déploiement de Vert a été retirée avec la Plaine qui la portait : à reposer à l’étape « Villes »/.test($('#barre-etat').textContent) && /at-etat-alerte/.test(etatBarre()), $('#barre-etat').textContent);
    clic($('#pl-annuler'));
    clicCase(vue, vd);
    var avantRotation = vp.plateau().camps.vert.length;
    touche('r');
    verifier('tourner la pièce qui porte une ville : la ville part et c’est dit (ou elle reste, ou la rotation est refusée)', /at-etat-erreur/.test(etatBarre()) || vp.plateau().camps.vert.length === avantRotation
      || /ville de déploiement de Vert a été retirée/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    touche('Escape');
    // « Déplacer » la pièce qui porte une ville : la ville ne suit pas, et c'est dit.
    plateauDeReference();
    var vdRouge = vp.plateau().camps.rouge[0], porteuse = pieceEn(vp, vdRouge);
    clicCase(vue, vdRouge);
    clic($('#pl-deplacer'));
    clicCase(vue, '12,0');
    verifier('déplacer la pièce qui porte une ville de déploiement : la pièce part, la ville est retirée et c’est annoncé', !pieceEn(vp, vdRouge) && !!pieceEn(vp, '12,0') && pieceEn(vp, '12,0').modele === porteuse.modele
      && vp.plateau().camps.rouge.length === 1 && /Pièce déplacée en \(12,0\)\. La ville de déploiement de Rouge a été retirée avec la Plaine qui la portait/.test($('#barre-etat').textContent) && /at-etat-alerte/.test(etatBarre()),
      $('#barre-etat').textContent);
    touche('Escape');
    plateauDeReference();
    mode('pinceau');
    clic($('#pi-gomme'));
    clicCase(vue, vp.plateau().camps.rouge[0]);
    verifier('gomme sur une ville de déploiement : elle est retirée, et le message du pinceau le dit', vp.plateau().camps.rouge.length === 1 && /ville de déploiement de Rouge a été retirée/.test($('#pi-message').textContent), $('#pi-message').textContent);
    verifier('pinceau : plus de terrain « ville » (les villes se posent à l’étape « Villes »)', !$('#pi-terrain-ville') && $$('#pi-outils button').length === 5);

    // Correction 5 : une ville de déploiement enregistrée hors du plateau, ou sur une case qui n'est pas une Plaine,
    // est refusée à la lecture du fichier (l'outil n'en écrit jamais).
    var fautif = JSON.parse(P.serialiser(V.retirerToutes(AT.generateur.generer(1).plateau).plateau)), avantFautif = JSON.stringify(vp.plateau());
    fautif.deploiements = [{ cle: '20,20', camp: 'vert' }];
    verifier('ville de déploiement hors du plateau (fichier retouché) : fichier refusé, avec la case en cause', vp.ouvrirTexte(JSON.stringify(fautif)) === false
      && /Fichier refusé : Ville de déploiement n° 1 : aucune case du plateau en \(20,20\)/.test($('#barre-etat').textContent) && JSON.stringify(vp.plateau()) === avantFautif, $('#barre-etat').textContent);
    var casesFautif = P.cases(fautif), foretFautif = Object.keys(casesFautif).filter(function (k) { return casesFautif[k].origine === 'foret'; })[0];
    fautif.deploiements = [{ cle: foretFautif, camp: 'rouge' }];
    verifier('ville de déploiement sur une forêt (fichier retouché) : fichier refusé (« n’est pas une Plaine »)', vp.ouvrirTexte(JSON.stringify(fautif)) === false
      && /Fichier refusé : Ville de déploiement n° 1 : la case \(.*\) n’est pas une Plaine \(foret\)/.test($('#barre-etat').textContent) && JSON.stringify(vp.plateau()) === avantFautif, $('#barre-etat').textContent);
    plateauDeReference();
    AT.app.montrer('partie');
  });

  scenario('Lot G : catalogue 2 (palette, reste à faire, générer avec remplissages, inventaire, ancien catalogue, partie fictive)', async function () {
    var vp = AT.app.vues.plateau, vq = AT.app.vues.partie, P = AT.plateau, C = AT.catalogue, vue = vp.vue;
    plateauDeReference();
    // Rendu et légende.
    verifier('rendu d’un plateau généré : 4 villes de déploiement posées par-dessus (liseré du camp), 2 villes neutres à liseré doré, pastilles des camps',
      $$('polygon[stroke="#007A4D"]', vue.svg).length === 2 && $$('polygon[stroke="#D8321C"]', vue.svg).length === 2 && $$('polygon[stroke="#8A6400"]', vue.svg).length === 4
      && $$('circle[fill="#007A4D"]', vue.svg).length === 2 && $$('circle[fill="#D8321C"]', vue.svg).length === 2 && $$('circle[stroke="#8A6400"]', vue.svg).length === 2, $$('polygon[stroke="#8A6400"]', vue.svg).length);
    verifier('légende : ville de déploiement posée sur une Plaine (Vert, Rouge), ville neutre, tuile de remplissage', /posée sur une Plaine \(haut\)/.test($('#pl-legende').textContent)
      && /ville neutre \(tuile ajoutée sur un flanc\)/.test($('#pl-legende').textContent) && /tuile de remplissage \(facultative\)/.test($('#pl-legende').textContent));
    var image = vp.imageExport().texte;
    verifier('export SVG : les tuiles de ville y sont, toujours sans classe ni style', /stroke="#007A4D"/.test(image) && /stroke="#8A6400"/.test(image) && !/ class=| style=|at-/.test(image));

    // Générer avec des tuiles de remplissage permises.
    verifier('réglage « tuiles de remplissage permises » : 0 par défaut, jusqu’au stock', $$('#pl-remplissages option').length === C.MODELES.R.nombre + 1 && $('#pl-remplissages').value === '0' && vp.reglages().remplissages === 0);
    var avecRemplissage = null;
    choisir($('#pl-remplissages'), C.MODELES.R.nombre);
    for (var g = 1; g <= 40 && !avecRemplissage; g++) {
      $('#pl-graine').value = String(g);
      clic($('#pl-generer'));
      if (vp.plateau().pieces.some(function (p) { return p.modele === 'R'; })) avecRemplissage = g;
    }
    var nbR = vp.plateau().pieces.filter(function (p) { return p.modele === 'R'; }).length;
    verifier('générer avec ' + C.MODELES.R.nombre + ' tuiles de remplissage permises : un plateau en pose (graine ' + avecRemplissage + '), jamais plus que le stock, sans erreur ; le message le dit',
      !!avecRemplissage && nbR >= 1 && nbR <= C.MODELES.R.nombre && vp.bilan().erreurs === 0 && vp.bilan().etape === 'complet' && /tuiles? de remplissage/.test($('#barre-etat').textContent), nbR + ' / ' + $('#barre-etat').textContent);
    verifier('tuile de remplissage reconnaissable sur le plateau (liseré pointillé et point central)', $$('polygon[stroke="#5E4A12"]', vue.svg).length === nbR && $$('circle[fill="#5E4A12"]', vue.svg).length === nbR, $$('polygon[stroke="#5E4A12"]', vue.svg).length);
    choisir($('#pl-remplissages'), 0);
    $('#pl-graine').value = String(avecRemplissage || 1);
    clic($('#pl-generer'));
    verifier('la même graine avec 0 remplissage permis : aucune tuile de remplissage posée', !vp.plateau().pieces.some(function (p) { return p.modele === 'R'; }) && vp.bilan().erreurs === 0);

    // Création à la main : reste à faire par étape, proposition de l'étape « Villes ».
    plateauDeReference();
    mode('villes');
    clic($('#vi-retirer'));
    mode('creer');
    verifier('création à la main, terrain construit sans villes : étape 1 faite, étape 2 en cours, « Passer à l’étape Villes » proposé', $('#cr-reste [data-etape="construction"]').getAttribute('data-etat') === 'faite'
      && $('#cr-reste [data-etape="villes"]').getAttribute('data-etat') === 'en-cours' && visible($('#cr-vers-villes')) && $('#pl-mode-villes').getAttribute('data-propose') === 'oui'
      && /Villes neutres \(une par flanc\) : 0 \/ 2 — il en manque 2/.test(reste('neutres')) && !$('#cr-termine'), $('#cr-reste').textContent);
    clic($('#pl-annuler'));
    verifier('plateau complet : les deux étapes faites, « Plateau terminé », plus de proposition', $('#cr-reste [data-etape="villes"]').getAttribute('data-etat') === 'faite' && !!$('#cr-termine') && !$('#cr-vers-villes')
      && $('#pl-mode-villes').getAttribute('data-propose') === 'non');

    // Inventaire du catalogue 2, par rôle.
    AT.app.montrer('inventaire');
    verifier('inventaire par rôle : noyau, montagnes, monoblocs de 4, de 3, remplissage facultatif, villes neutres, villes de déploiement', $$('#inv-pieces tr.at-role').map(function (tr) { return tr.getAttribute('data-role'); }).join()
      === 'noyau,montagne,quatre,trois,remplissage,ville,deploiement' && /Monoblocs de 4 cases : 12 pièces, 48 cases/.test($('#inv-pieces').textContent) && /Monoblocs de 3 cases : 9 pièces, 27 cases/.test($('#inv-pieces').textContent)
      && /Tuiles de remplissage : 2 pièces, 2 cases — facultatives/.test($('#inv-pieces').textContent), $$('#inv-pieces tr.at-role').map(function (tr) { return tr.textContent; }).join(' | '));
    var vdLigne = $('#inv-pieces [data-deploiement="VD"]').querySelectorAll('td.at-nombre');
    verifier('inventaire : villes de déploiement « posées par-dessus une Plaine », 4 tuiles, 4 posées, 0 restante', vdLigne[0].textContent === '4' && vdLigne[1].textContent === '4' && vdLigne[2].textContent === '0'
      && /PAR-DESSUS une Plaine/.test($('#inv-pieces [data-role="deploiement"]').textContent) && $$('#inv-pieces [data-deploiement="VD"] svg').length === 2);
    verifier('inventaire : totaux du catalogue 2 et répartition justes ; pas de section « ancien catalogue » sur un plateau du catalogue 2', /Catalogue : 28 pièces, 95 cases/.test($('#inv-totaux').textContent)
      && /26 pièces posées \(93 cases\), 2 restantes/.test($('#inv-totaux').textContent) && /53 plaines \(70,7 %\)/.test($('#inv-repartition').textContent) && /7 villes sur un plateau complet/.test($('#inv-repartition').textContent)
      && !$('#inv-ancien') && !$('#inv-titre-ancien'), $('#inv-totaux').textContent);

    // Anciens plateaux (premier catalogue) : bandeau discret, contrôles adaptés, section d'inventaire.
    AT.app.montrer('plateau');
    mode('generer');
    verifier('plateau du catalogue 2 : pas de bandeau « ancien catalogue »', $('#pl-ancien').hidden);
    mode('pinceau');
    clic($('#pi-terrain-foret'));
    clicCase(vue, AT.vueVilles.anneau(vp.plateau())[0]);
    verifier('une forêt peinte au pinceau sur un plateau du catalogue 2 n’en fait pas un « ancien plateau » (ni bandeau, ni mention dans la ligne d’étape)', $('#pl-ancien').hidden
      && vp.plateau().pieces.some(function (p) { return p.modele === 'F'; }) && !/ancien catalogue/.test($('#pl-etape').textContent) && $('#pl-etape-titre').textContent === 'Plateau complet', $('#pl-etape').textContent);
    mode('generer');
    var ouvert = vp.ouvrirTexte(RECETTE_ANCIEN_PLATEAU) === true;
    verifier('ancien plateau (version 1) ouvert depuis un fichier : bandeau discret, contrôles de l’ancien catalogue, aucune erreur JavaScript', ouvert && !$('#pl-ancien').hidden && visible($('#pl-ancien'))
      && /Plateau de l’ancien catalogue/.test($('#pl-ancien').textContent) && /ancien catalogue/.test($('#pl-etape').textContent) && $$('#pl-controles .at-regle').length === 7 && P.villes(vp.plateau()).length === 7
      && vp.plateau().camps.vert.length === 2, $('#pl-etape').textContent);
    verifier('ancien plateau : la ligne d’étape ne parle pas de « construction en cours » ni de pièces à poser ; groupe Villes jugé sur ses seules erreurs', $('#pl-etape-titre').textContent === 'Plateau de l’ancien catalogue'
      && $('#pl-etape').getAttribute('data-etape') === 'ancien' && !/Construction en cours|pièces de terrain à poser/.test($('#pl-etape').textContent) && !/à poser|après la construction/.test($('#pl-groupe-villes').textContent)
      && /conforme/.test($('#pl-groupe-villes').textContent) && $('#pl-mode-villes').getAttribute('data-propose') === 'non', $('#pl-etape').textContent + ' / ' + $('#pl-groupe-villes').textContent);
    mode('creer');
    verifier('ancien plateau, « reste à faire » : ni étapes du catalogue 2 ni pièces de terrain à poser ; ses 7 villes et ses 2 + 2 villes de déploiement sont suivies', !!$('#cr-reste-ancien')
      && !$('#cr-reste [data-etape]') && !$('#cr-reste [data-reste="pieces"]') && /Villes : 7 \/ 7/.test(reste('villes')) && /en haut \(Vert\) : 2 \/ 2/.test(reste('haut')) && !$('#cr-vers-villes'), $('#cr-reste').textContent);
    mode('villes');
    verifier('ancien plateau, étape « Villes » : dit qu’elle est faite pour le catalogue 2, sans « terrain non fini »', /Plateau de l’ancien catalogue/.test($('#vi-etape').textContent) && !/Le terrain n’est pas fini/.test($('#vi-etape').textContent));
    mode('generer');
    AT.app.montrer('inventaire');
    verifier('inventaire d’un ancien plateau : ses tuiles ne sont pas listées « à prévoir en plus », elles sont comptées à part', /Tuiles hors catalogue posées : aucune\. Les 55 tuiles de l’ancien catalogue de ce plateau sont comptées à part/.test($('#inv-hors-catalogue').textContent),
      $('#inv-hors-catalogue').textContent);
    verifier('inventaire d’un ancien plateau : section « Ancien catalogue (sur ce plateau) » avec ses tuiles d’une case', !!$('#inv-ancien') && $$('#inv-ancien tbody tr').length === 4
      && $('#inv-ancien [data-modele="V"] td.at-nombre').textContent === '6' && /Catalogue : 28 pièces, 95 cases/.test($('#inv-totaux').textContent), $('#inv-ancien') && $('#inv-ancien').textContent);
    AT.app.montrer('plateau');
    var bib = vp.bibliotheque;
    bib.enregistrerSous('Ancien plateau');
    plateauDeReference();
    verifier('retour à un plateau du catalogue 2 : le bandeau disparaît', $('#pl-ancien').hidden);
    mode('bibliotheque');
    clic($('#bi-liste [data-ouvrir]'));
    verifier('ancien plateau rouvert depuis la bibliothèque : bandeau de nouveau affiché', !$('#pl-ancien').hidden && P.villes(vp.plateau()).length === 7);
    clic($('#bi-liste [data-supprimer-entree]')); clic($('#at-confirmer-oui'));

    // Partie fictive sur un plateau du catalogue 2.
    plateauDeReference();
    AT.app.montrer('partie');
    $('#pa-graine').value = '4';
    clic($('#pa-nouvelle'));
    var e = vq.etat(), j = e.actif;
    verifier('partie créée sur un plateau du catalogue 2 : 93 cases dessinées, villes de déploiement = tuiles posées', !!e && casesDessinees(vq.vue) === 93 && e.plateau.deploiements.length === 4
      && JSON.stringify(e.plateau.camps) === JSON.stringify(vp.plateau().camps) && $$('polygon[stroke="#007A4D"]', vq.vue.svg).length === 2, casesDessinees(vq.vue));
    clic($$('[data-main="' + j + '"] .at-carte')[0]);
    verifier('carte choisie : les 2 villes de déploiement du joueur actif sont proposées', marques(vq.vue, 'at-admissible') === 2);
    clicCase(vq.vue, e.plateau.camps[j][0]);
    e = vq.etat();
    verifier('former un bataillon sur une ville de déploiement posée par-dessus une Plaine', e.bataillons[j][0].case === e.plateau.camps[j][0] && $$('text', vq.vue.svg).some(function (t) { return t.textContent === (j === 'vert' ? 'V1' : 'R1'); }));
    var refusModele = P.peutPoserEvenement(e.plateau, 'E2', e.plateau.camps[j][1]);
    verifier('modèle : un événement ne se pose jamais sur une ville de déploiement', refusModele.ok === false && /jamais sur une ville de déploiement/.test(refusModele.raison), refusModele.raison);
    clic($('#pa-piocher-evenement'));
    var idEvenement = vq.ui().evenement, autre = e.plateau.camps[j === 'vert' ? 'rouge' : 'vert'][0];
    clicCase(vq.vue, autre);
    e = vq.etat();
    var textesPartie = $('#barre-etat').textContent + ' / ' + (($('#pa-avertissement') || {}).textContent || '');
    verifier('partie : la tuile d’événement piochée est refusée sur une ville de déploiement, avec la raison du modèle ; aucune ville de déploiement parmi les cases proposées', !!idEvenement && e.plateau.recouvrements.length === 0
      && /jamais sur une ville de déploiement/.test(textesPartie) && e.plateau.camps.vert.concat(e.plateau.camps.rouge).every(function (k) { return AT.vuePlateau.casesAdmissibles(e.plateau, idEvenement, []).indexOf(k) === -1; }), textesPartie);
    if ($('#pa-renoncer')) clic($('#pa-renoncer'));
    if ($('[data-defausser-evenement="' + idEvenement + '"]')) clic($('[data-defausser-evenement="' + idEvenement + '"]'));
    verifier('la partie sur un plateau du catalogue 2 s’enregistre et se rouvre', vq.ouvrirTexte(vq.texteEnregistrement()) === true && vq.etat().plateau.deploiements.length === 4);
    AT.app.montrer('plateau');
    verifier('réglages remis à leur valeur par défaut', reglagesParDefaut());
    plateauDeReference();
    AT.app.montrer('partie');
    clic($('#pa-nouvelle'));
  });

  // ================================================================== états de démonstration du lot E (captures d'écran)
  // ================================================================== J. recette du testeur : création à la main
  function terrainsDe(plateau) {
    var cases = AT.plateau.cases(plateau, { sansRecouvrements: true }), res = {};
    Object.keys(cases).sort().forEach(function (k) { res[k] = cases[k].terrain + '/' + cases[k].modele; });
    return JSON.stringify(res);
  }

  scenario('Testeur : plateau complet construit à la main, annuler / rétablir', async function () {
    var vp = AT.app.vues.plateau, P = AT.plateau, C = AT.catalogue, vue = vp.vue;
    plateauDeReference();
    verifier('mesure de contact : la recette tourne sous le réglage livré', vp.reglages().mesureContact === C.REGLAGES.mesureContact && $('#pl-mesure').value === C.REGLAGES.mesureContact
      && new RegExp('« ' + (C.REGLAGES.mesureContact === 'pieces' ? 'pièces' : 'côtés') + ' » \\(retenue\\)').test($('#pl-controles').textContent), $('#pl-mesure').value);
    var patron = AT.generateur.generer(5, vp.reglages()).plateau;
    mode('creer');
    verifier('grille vide de la création : dans son propre groupe « at-grille-vide », masqué à l’impression par styles/base.css (vérifié à part sur un PDF)', !!$('.at-grille-vide', vue.svg) && $$('.at-grille-vide polygon', vue.svg).length === casesGrilleDessinees(vue) && casesGrilleDessinees(vue) > 0);
    verifier('mode « Créer à la main » : le contrôle 5 garde la mesure choisie', new RegExp('« ' + (C.REGLAGES.mesureContact === 'pieces' ? 'pièces' : 'côtés') + ' » \\(retenue\\)').test($('#pl-controles').textContent));
    clic($('#cr-vierge'));
    var depart = JSON.stringify(vp.plateau()), rangDepart = vp.etat().rang;

    // Les 23 monoblocs du patron sont posés par la palette (glisser-déposer, rotations par R) ; puis, à l'étape
    // « Villes », les 4 villes de déploiement et les 2 villes neutres sont posées par clic ou au clavier, en pose stricte.
    var refus = [], manieres = { clic: 0, glisser: 0, clavier: 0 }, n = 0;
    patron.pieces.filter(function (p) { return p.modele !== 'N1' && p.modele !== 'VN'; }).forEach(function (p) {
      var cle = AT.hex.cle(p.q, p.r), avant = vp.plateau().pieces.length;
      glisserPalette(p.modele, vue.pointEcran(cle), function () { for (var i = 0; i < p.rotation; i++) touche('r'); });
      manieres.glisser += 1;
      touche('Escape');
      var posee = pieceEn(vp, cle);
      if (vp.plateau().pieces.length !== avant + 1 || !posee || posee.modele !== p.modele || posee.rotation !== p.rotation) refus.push(p.modele + ' en ' + cle + ' : ' + $('#barre-etat').textContent);
    });
    verifier('23 monoblocs posés un à un par glisser-déposer, aucune pose refusée', refus.length === 0 && vp.plateau().pieces.length === 24 && manieres.glisser === 23, JSON.stringify(manieres) + ' ' + refus.slice(0, 3).join(' | '));
    verifier('terrain construit, aucune ville : étape « villes », aucune erreur, et l’étape « Villes » se propose d’elle-même', vp.bilan().etape === 'villes' && vp.bilan().erreurs === 0
      && /Construction terminée, villes à poser : 2 villes de déploiement pour Vert, 2 villes de déploiement pour Rouge, 2 villes neutres\./.test($('#pl-etape').textContent) && !$('#cr-termine')
      && $('#pl-etape-titre').textContent === 'Construction terminée : posez les villes' && !!$('#cr-vers-villes') && $('#pl-mode-villes').getAttribute('data-propose') === 'oui', $('#pl-etape').textContent);
    clic($('#cr-vers-villes'));
    verifier('« Passer à l’étape Villes » : mode Villes, outil « déploiement de Vert », places en surbrillance ; la proposition disparaît', vp.mode() === 'villes' && !$('#cr-vers-villes') && visible($('#vi-panneau')) && $('#vi-outil-vert').getAttribute('aria-pressed') === 'true'
      && marques(vue, 'at-admissible') === AT.vueVilles.places(vp.plateau(), 'vert').length && marques(vue, 'at-admissible') > 0 && $('#pl-mode-villes').getAttribute('data-propose') === 'non', marques(vue, 'at-admissible'));
    var posesVilles = [];
    P.deploiements(patron).forEach(function (d) {
      clic($('#vi-outil-' + d.camp));
      var proposee = AT.vueVilles.places(vp.plateau(), d.camp).indexOf(d.cle) !== -1, avant = P.deploiements(vp.plateau()).length;
      n += 1;
      if (n % 2 === 0) { vue.svg.focus(); allerCurseur(vue, d.cle); touche('Enter', {}, vue.svg); manieres.clavier += 1; } else { clicCase(vue, d.cle); manieres.clic += 1; }
      posesVilles.push(proposee && P.deploiements(vp.plateau()).length === avant + 1 && P.cases(vp.plateau())[d.cle].camp === d.camp);
    });
    verifier('4 villes de déploiement posées aux places du patron (clic et clavier) : chacune était une place proposée, aucune pose stricte refusée', posesVilles.length === 4 && posesVilles.every(Boolean)
      && $('#vi-outils [data-compteur="vert"]').textContent === '2 / 2' && $('#vi-outils [data-compteur="rouge"]').textContent === '2 / 2', posesVilles.join() + ' ' + $('#barre-etat').textContent);
    verifier('l’outil passe de lui-même à la ville suivante : « ville neutre »', vp.villes.outil() === 'neutre' && $('#vi-outil-neutre').getAttribute('aria-pressed') === 'true');
    posesVilles = [];
    patron.pieces.filter(function (p) { return p.modele === 'VN'; }).forEach(function (p) {
      var cle = AT.hex.cle(p.q, p.r), proposee = AT.vueVilles.places(vp.plateau(), 'neutre').indexOf(cle) !== -1, avant = vp.plateau().pieces.length;
      n += 1;
      if (n % 2 === 0) { vue.svg.focus(); allerCurseur(vue, cle); touche('Enter', {}, vue.svg); manieres.clavier += 1; } else { clicCase(vue, cle); manieres.clic += 1; }
      posesVilles.push(proposee && vp.plateau().pieces.length === avant + 1 && pieceEn(vp, cle).modele === 'VN');
    });
    verifier('2 villes neutres posées aux places du patron, une par flanc : « Toutes les villes sont posées »', posesVilles.length === 2 && posesVilles.every(Boolean) && $('#vi-outils [data-compteur="neutre"]').textContent === '2 / 2'
      && /Toutes les villes sont posées/.test($('#vi-message').textContent) && manieres.clavier > 0 && manieres.clic > 0 && marques(vue, 'at-admissible') === 0, posesVilles.join() + ' ' + $('#vi-message').textContent);
    mode('creer');
    verifier('plateau construit à la main = plateau du patron, case pour case', terrainsDe(vp.plateau()) === terrainsDe(patron) && JSON.stringify(vp.plateau().camps) === JSON.stringify(patron.camps));
    verifier('« Plateau terminé », aucune erreur, aucune alerte, étape « complet », palette épuisée hors remplissages facultatifs', !!$('#cr-termine') && vp.bilan().erreurs === 0 && vp.bilan().alertes === 0
      && vp.bilan().etape === 'complet' && /Plateau conforme/.test($('#pl-bilan').textContent)
      && $$('#pl-stock [data-modele]').every(function (b) { return b.disabled || b.getAttribute('data-modele') === 'R'; }), $('#pl-bilan').textContent + ' ' + $('#cr-reste').textContent);
    verifier('une étape d’annulation par pièce et par ville posée (23 + 4 + 2)', vp.etat().rang === rangDepart + 29, vp.etat().rang - rangDepart);
    verifier('le plateau fait à la main s’enregistre et se relit', relisible(vp));

    // Stock épuisé : ni clic ni glisser ne posent une pièce de plus.
    var complet = JSON.stringify(vp.plateau()), rang = vp.etat().rang;
    var epuise = $('#pl-stock [data-modele="M5"]');
    epuise.click();
    clicCase(vue, '7,-7');
    glisserPalette('M5', vue.pointEcran('7,-7'));
    glisserPalette('M4', vue.pointEcran('6,-7'));
    verifier('stock épuisé : bouton désactivé, clic et glisser sans effet', epuise.disabled && JSON.stringify(vp.plateau()) === complet && vp.etat().rang === rang && vp.etat().aPoser === null && marques(vue, 'at-fantome') === 0, vp.etat().rang - rang);
    var horsStock = AT.vueCreation.essaiPose(vp.plateau(), 'M5', 7, -7, 0);
    verifier('pose au-delà du stock refusée par le modèle, avec la raison', horsStock.ok === false && /Stock épuisé/.test(horsStock.raison), horsStock.raison);

    // Annuler tout, rétablir tout.
    var pas = 0;
    while (vp.etat().rang > rangDepart && pas < 200) { touche('z', { ctrlKey: true }); pas += 1; }
    verifier('29 annulations : retour au plateau vierge, « reste à faire » revenu à 23 pièces de terrain', pas === 29 && JSON.stringify(vp.plateau()) === depart && /à poser : 23/.test(reste('pieces')) && !$('#cr-termine'), pas);
    pas = 0;
    while (!$('#pl-retablir').disabled && pas < 200) { clic($('#pl-retablir')); pas += 1; }
    verifier('29 rétablissements : plateau complet retrouvé à l’identique, « Plateau terminé »', pas === 29 && JSON.stringify(vp.plateau()) === complet && !!$('#cr-termine'), pas);

    // Chaque modèle du catalogue se pose aussi par glisser-déposer ; une pièce personnelle par clic et par glisser.
    clic($('#cr-vierge'));
    clic($('#pl-vider'));
    var rates = [];
    var dansPalette = C.ORDRE_MODELES.filter(function (id) { return C.MODELES[id].role !== 'ville'; });
    dansPalette.forEach(function (id) {
      clic($('#pl-vider'));
      glisserPalette(id, vue.pointEcran('1,1'));
      if (vp.plateau().pieces.length !== 1 || !pieceEn(vp, '1,1') || pieceEn(vp, '1,1').modele !== id) rates.push(id + ' : ' + $('#barre-etat').textContent);
    });
    verifier('les 25 modèles de la palette posés par glisser-déposer, chacun sur un plateau vidé (noyau et remplissage compris ; la ville neutre se pose à l’étape « Villes »)', rates.length === 0 && dansPalette.length === 25, rates.join(' | '));
    var avecPerso = P.ajouterModele(vp.plateau(), { nom: 'Crête', quantite: 2, cases: [{ q: 0, r: 0, terrain: 'montagne' }, { q: 1, r: 0, terrain: 'foret' }, { q: 2, r: 0, terrain: 'foret' }] });
    vp.ouvrirTexte(P.serialiser(P.avecCamps(avecPerso.plateau)));
    mode('creer');
    clic($('#pl-stock [data-modele="' + avecPerso.id + '"]'));
    touche('r'); touche('r');
    clicCase(vue, '-3,6');
    touche('Escape');
    glisserPalette(avecPerso.id, vue.pointEcran('2,5'), function () { touche('r'); });
    var persos = vp.plateau().pieces.filter(function (p) { return p.modele === avecPerso.id; });
    verifier('pièce personnelle posée par clic (2 rotations) puis par glisser (1 rotation), puis épuisée', persos.length === 2 && persos[0].rotation === 2 && persos[1].rotation === 1 && persos[1].q === 2 && persos[1].r === 5
      && $('#pl-stock [data-modele="' + avecPerso.id + '"]').disabled && /Crête × 0/.test($('#pl-stock [data-modele="' + avecPerso.id + '"]').textContent), JSON.stringify(persos));
    verifier('contrôle 1 : aucune tuile hors catalogue pour des pièces personnelles dans leur quantité', !/à prévoir en plus du catalogue/.test($('#pl-controles').textContent));
    plateauDeReference();
    AT.app.montrer('partie');
  });

  scenario('Testeur : pinceau, cas limites', async function () {
    var vp = AT.app.vues.plateau, P = AT.plateau, vue = vp.vue;
    plateauDeReference();
    mode('creer');
    clic($('#cr-vierge'));
    mode('pinceau');

    // Plaines : les deux tuiles de remplissage du stock d'abord, la troisième hors catalogue (plus de ville au pinceau).
    clic($('#pi-terrain-plaine'));
    var cases = ['-4,-3', '0,-4'];
    cases.forEach(function (k) { clicCase(vue, k); });
    verifier('2 plaines peintes : prises dans les remplissages du stock, sans annonce', vp.plateau().pieces.filter(function (p) { return p.modele === 'R'; }).length === 2 && !/hors stock/.test($('#pi-message').textContent)
      && P.stock(vp.plateau()).R.restant === 0, $('#pi-message').textContent);
    clicCase(vue, '4,-4');
    verifier('3e plaine : hors catalogue, annoncée ; le contrôle 1 la liste ; aucun outil « ville » au pinceau', pieceEn(vp, '4,-4').modele === 'P' && /1 tuile posée hors stock/.test($('#pi-message').textContent)
      && /Tuiles à prévoir en plus du catalogue \(1\) : 1 × Plaine/.test($('#pl-controles').textContent) && !$('#pi-terrain-ville') && AT.plateau.villes(vp.plateau()).length === 1,
      $('#pi-message').textContent);
    verifier('plateau peint : toujours enregistrable et relisible', relisible(vp));

    // Trait entièrement refusé : aucune étape d'annulation.
    clic($('#pi-terrain-foret'));
    var rang = vp.etat().rang, avant = JSON.stringify(vp.plateau());
    glisserCases(vue, ['0,0', '1,0', '0,1']);
    verifier('trait entièrement sur le noyau : rien ne change, aucune étape d’annulation, refus expliqué', vp.etat().rang === rang && JSON.stringify(vp.plateau()) === avant && /ne modifie pas le noyau \(3 cases laissées\)/.test($('#pi-message').textContent)
      && /at-etat-erreur/.test(etatBarre()) && casesDessinees(vue) === Object.keys(P.cases(vp.plateau())).length, $('#pi-message').textContent);

    // Trait interrompu par le système (pointercancel) : rien n'est gardé.
    var a = vue.pointEcran('3,1'), b = vue.pointEcran('4,1');
    pointeur(vue.svg, 'pointerdown', a);
    pointeur(vue.svg, 'pointermove', b);
    var pendant = casesDessinees(vue);
    pointeur(vue.svg, 'pointercancel', b);
    verifier('trait interrompu (pointercancel) : aperçu effacé, plateau et historique inchangés', pendant === Object.keys(P.cases(vp.plateau())).length + 2 && JSON.stringify(vp.plateau()) === avant && vp.etat().rang === rang
      && casesDessinees(vue) === Object.keys(P.cases(vp.plateau())).length, pendant + ' / ' + casesDessinees(vue) + ' ' + $('#pi-message').textContent);
    clicCase(vue, '3,1');
    verifier('après un trait interrompu, le pinceau marche de nouveau (une case, une étape)', vp.etat().rang === rang + 1 && pieceEn(vp, '3,1') && pieceEn(vp, '3,1').modele === 'F');

    // Tuile d'événement sous le pinceau et sous la gomme.
    var avecEvenement = P.poserEvenement(vp.plateau(), 'E4', '3,1');
    vp.ouvrirTexte(P.serialiser(avecEvenement.plateau));
    mode('pinceau');
    clic($('#pi-terrain-marais'));
    clicCase(vue, '3,1');
    verifier('repeindre une case qui porte une tuile d’événement : la tuile retourne en réserve, et c’est dit', avecEvenement.ok && vp.plateau().recouvrements.length === 0 && pieceEn(vp, '3,1').modele === 'S'
      && /1 tuile d’événement retourne en réserve/.test($('#pi-message').textContent), $('#pi-message').textContent);

    // Gomme sur le noyau : il est fixe (règle de l'utilisateur après la revue), la gomme ne le retire jamais.
    // (Les contrôles « noyau retiré après confirmation », « ville peinte au centre sans noyau » et « deux annulations »
    // de la recette d'origine ne s'appliquent plus : ce chemin n'existe plus.)
    clic($('#pi-gomme'));
    rang = vp.etat().rang;
    clicCase(vue, '1,0');
    var dialogue = $('#at-confirmation');
    verifier('gomme sur le noyau : aucune confirmation proposée, noyau encore là, rien ne change', dialogue.open !== true && !!pieceEn(vp, '0,0') && pieceEn(vp, '0,0').modele === 'N1' && vp.etat().rang === rang
      && /Le noyau est fixe : la gomme ne le retire jamais/.test($('#pi-message').textContent) && relisible(vp), $('#pi-message').textContent);

    // Clic hors de la grille affichée (au-delà du rayon 7) et aux bornes du format.
    clic($('#pi-terrain-plaine'));
    rang = vp.etat().rang;
    clicCase(vue, '12,-3');
    var loin = !!pieceEn(vp, '12,-3');
    clicCase(vue, '40,0');
    verifier('peindre très loin : jamais de case hors des bornes du format, plateau toujours relisible', !pieceEn(vp, '40,0') && relisible(vp) && vp.etat().rang === rang + (loin ? 1 : 0), 'case (12,-3) peinte : ' + loin + ' ; ' + $('#pi-message').textContent);
    plateauDeReference();
    AT.app.montrer('partie');
  });

  scenario('Testeur : mes monoblocs, cas limites', async function () {
    var vp = AT.app.vues.plateau, P = AT.plateau, C = AT.catalogue, vue = vp.vue;
    plateauDeReference();
    mode('monoblocs');
    function caseGrille(k) { $('#mo-grille [data-case="' + k + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    function avisTexte() { return $('#mo-avis').textContent; }
    var sans = JSON.stringify(vp.plateau()), rang = vp.etat().rang;

    // Formes limites.
    caseGrille('2,0');
    saisir($('#mo-nom'), 'Limite');
    verifier('1 case : refus (2 à 6 cases), bouton désactivé', $('#mo-valider').disabled && /au moins une case voisine/.test(avisTexte()), avisTexte());
    ['3,0', '2,1', '1,1', '1,2', '0,2'].forEach(caseGrille);
    verifier('6 cases sans la case (0,0) : pièce valide', !$('#mo-valider').disabled && /Pièce valide : 6 cases/.test(avisTexte()), avisTexte());
    caseGrille('0,3');
    verifier('7 cases : refus « trop de cases », bouton désactivé', $('#mo-valider').disabled && /Trop de cases : 7 pour 6 au plus/.test(avisTexte()), avisTexte());
    $('#mo-valider').click();
    verifier('7 cases : rien n’est ajouté même en cliquant le bouton', JSON.stringify(vp.plateau()) === sans);
    caseGrille('0,3');
    clic($('#mo-valider'));
    var limite = P.modeles(vp.plateau())[0];
    verifier('6 cases dessinées loin du centre : pièce ajoutée, recentrée sur (0,0), d’un seul tenant', !!limite && limite.cases.length === 6 && limite.cases.some(function (c) { return c.q === 0 && c.r === 0; })
      && P.validerModele(limite).ok && relisible(vp), JSON.stringify(limite));
    caseGrille('-3,0'); caseGrille('3,0');
    saisir($('#mo-nom'), 'Deux morceaux');
    verifier('forme non connexe : refus, bouton désactivé', $('#mo-valider').disabled && /plusieurs morceaux/.test(avisTexte()), avisTexte());
    clic($('#mo-effacer'));

    // Noms hostiles ou limites.
    caseGrille('0,0'); caseGrille('1,0');
    saisir($('#mo-nom'), '   ');
    verifier('nom vide ou fait d’espaces : refus', $('#mo-valider').disabled && /Donnez un nom/.test(avisTexte()));
    saisir($('#mo-nom'), new Array(1001).join('n'));
    var long = { desactive: $('#mo-valider').disabled, avis: avisTexte() };
    $('#mo-valider').click();
    var apresLong = P.modeles(vp.plateau());
    verifier('nom de 1000 caractères (collé malgré la limite du champ) : refusé avec un message, ou jamais enregistré au-delà de ' + C.REGLAGES.perso.longueurNom + ' caractères',
      apresLong.every(function (m) { return m.nom.length <= C.REGLAGES.perso.longueurNom; }) && relisible(vp) && (apresLong.length === 2 || (long.desactive && /nom/i.test(long.avis))), JSON.stringify(long).slice(0, 200) + ' → ' + apresLong.length);
    if (apresLong.length === 1) { saisir($('#mo-nom'), 'x'); } else { caseGrille('0,0'); caseGrille('1,0'); }
    saisir($('#mo-nom'), '<img src=x onerror=alert(1)><b>x</b>');
    clic($('#mo-valider'));
    var hostile = P.modeles(vp.plateau()).filter(function (m) { return /<img/.test(m.nom); })[0];
    verifier('nom contenant du HTML : accepté comme du texte, rien n’est injecté (liste, palette, inventaire)', !!hostile && $$('#atelier img, #atelier b').length === 0 && /<img src=x/.test($('#mo-liste').textContent), $('#barre-etat').textContent + ' / ' + $('#mo-avis').textContent);
    mode('creer');
    verifier('palette : le nom hostile est du texte', /<img src=x/.test($('#pl-stock').textContent) && $$('#pl-stock img').length === 0);
    AT.app.montrer('inventaire');
    verifier('inventaire : le nom hostile est du texte', /<img src=x/.test($('#panneau-inventaire').textContent) && $$('#panneau-inventaire img').length === 0);
    AT.app.montrer('plateau');
    mode('monoblocs');

    // Quantités.
    caseGrille('0,0'); caseGrille('0,1');
    saisir($('#mo-nom'), 'Quantité');
    var refusQuantite = [];
    ['0', '10', '-1', '', '2.5', '1e1'].forEach(function (v) {
      $('#mo-quantite').value = v;
      $('#mo-quantite').dispatchEvent(new Event('input', { bubbles: true }));
      if (!$('#mo-valider').disabled) refusQuantite.push('« ' + v + ' » lu « ' + $('#mo-quantite').value + ' »');
    });
    verifier('quantités invalides (0, 10, −1, vide, 2.5, 1e1) : toutes refusées avec le message, jamais tronquées en silence', refusQuantite.length === 0 && /Quantité : un nombre entier de 1 à 9/.test(avisTexte()), refusQuantite.join(', '));
    saisir($('#mo-quantite'), '9');
    clic($('#mo-valider'));
    var neuf = P.modeles(vp.plateau()).filter(function (m) { return m.nom === 'Quantité'; })[0];
    verifier('quantité 9 : acceptée', !!neuf && neuf.quantite === 9);

    // Verrou périmé : la pièce chargée dans l'éditeur est posée entre-temps.
    clic($('#mo-liste [data-modifier="' + neuf.id + '"]'));
    mode('creer');
    clic($('#pl-stock [data-modele="' + neuf.id + '"]'));
    clicCase(vue, '7,-7');
    touche('Escape');
    mode('monoblocs');
    var avantModif = JSON.stringify(vp.plateau());
    caseGrille('1,1');
    if (!$('#mo-valider').disabled) $('#mo-valider').click();
    var apresModif = P.modeles(vp.plateau()).filter(function (m) { return m.id === neuf.id; })[0];
    verifier('pièce chargée dans l’éditeur puis posée entre-temps : sa forme ne change pas (verrou ou refus expliqué)', JSON.stringify(apresModif.cases) === JSON.stringify(neuf.cases)
      && P.cases(vp.plateau())['7,-7'] && Object.keys(P.cases(vp.plateau())).length === 95 && (JSON.stringify(vp.plateau()) === avantModif || apresModif.cases.length === 2), $('#barre-etat').textContent + ' / ' + $('#mo-avis').textContent);
    clic($('#mo-liste [data-supprimer="' + neuf.id + '"]'));
    verifier('supprimer la pièce posée : refus expliqué', P.modeles(vp.plateau()).some(function (m) { return m.id === neuf.id; }) && /at-etat-erreur/.test(etatBarre()), $('#barre-etat').textContent);

    // 25e pièce.
    var plein = vp.plateau(), garde = 0;
    while (P.modeles(plein).length < C.REGLAGES.perso.modelesMax && garde++ < 30) {
      plein = P.ajouterModele(plein, { nom: 'Série ' + garde, quantite: 1, cases: [{ q: 0, r: 0, terrain: 'plaine' }, { q: 1, r: 0, terrain: 'marais' }] }).plateau;
    }
    vp.ouvrirTexte(P.serialiser(plein));
    mode('monoblocs');
    clic($('#mo-effacer'));
    caseGrille('0,0'); caseGrille('1,0');
    saisir($('#mo-nom'), 'De trop');
    if (!$('#mo-valider').disabled) clic($('#mo-valider'));
    verifier('24 pièces personnelles : la 25e est refusée avec explication, le fichier reste relisible', P.modeles(vp.plateau()).length === 24 && $$('#mo-liste .at-mono-carte').length === 24 && relisible(vp)
      && (/24/.test($('#barre-etat').textContent) || /24/.test(avisTexte())), $('#barre-etat').textContent + ' / ' + avisTexte());
    mode('creer');
    verifier('palette avec 24 pièces personnelles : 25 + 24 boutons dessinés', $$('#pl-stock [data-modele]').length === 49 && $$('#pl-stock [data-modele] svg').length === 49);

    // Enregistrer / rouvrir : plateau, partie, bibliothèque.
    var texte = vp.texteEnregistrement(), document1 = JSON.stringify(vp.plateau());
    plateauDeReference();
    verifier('plateau à 24 pièces personnelles (dont une posée) : fichier rouvert à l’identique', vp.ouvrirTexte(texte) === true && JSON.stringify(vp.plateau()) === document1);
    var vq = AT.app.vues.partie;
    AT.app.montrer('partie');
    $('#pa-graine').value = '77';
    clic($('#pa-nouvelle'));
    var partie = vq.texteEnregistrement();
    clic($('#pa-nouvelle'));
    verifier('partie sur ce plateau : enregistrée puis rouverte avec les pièces personnelles', !!partie && vq.ouvrirTexte(partie) === true && vq.etat().plateau.modeles.length === 24
      && JSON.stringify(vq.etat().plateau.pieces) === JSON.stringify(JSON.parse(document1).pieces) && casesDessinees(vq.vue) === 95, $('#barre-etat').textContent);
    AT.app.montrer('plateau');
    plateauDeReference();
    AT.app.montrer('partie');
  });

  scenario('Testeur : pièces personnelles hostiles par les quatre entrées, bibliothèque aux limites', async function () {
    var vp = AT.app.vues.plateau, vq = AT.app.vues.partie, P = AT.plateau, B = AT.bibliotheque, C = AT.catalogue, bib = vp.bibliotheque;
    plateauDeReference();
    var base = P.ajouterModele(vp.plateau(), { nom: 'Témoin', quantite: 2, cases: [{ q: 0, r: 0, terrain: 'foret' }, { q: 1, r: 0, terrain: 'plaine' }] }).plateau;
    var bon = P.serialiser(base);
    function mute(f) { var o = JSON.parse(bon); f(o, o.modeles[0]); return o; }
    var mutations = {
      'ville dans un monobloc': mute(function (o, m) { m.cases[1].terrain = 'ville'; }),
      'terrain inconnu': mute(function (o, m) { m.cases[1].terrain = 'lave'; }),
      'terrain d’événement': mute(function (o, m) { m.cases[1].terrain = 'crevasse'; }),
      '1 case': mute(function (o, m) { m.cases.pop(); }),
      '7 cases': mute(function (o, m) { m.cases = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return { q: i, r: 0, terrain: 'plaine' }; }); }),
      'non connexe': mute(function (o, m) { m.cases[1].q = 3; }),
      'sans la case (0,0)': mute(function (o, m) { m.cases = [{ q: 1, r: 0, terrain: 'plaine' }, { q: 2, r: 0, terrain: 'plaine' }]; }),
      'case en double': mute(function (o, m) { m.cases.push({ q: 1, r: 0, terrain: 'marais' }); }),
      'coordonnée décimale': mute(function (o, m) { m.cases[1].q = 0.5; m.cases[1].r = 0.5; }),
      'coordonnée en texte': mute(function (o, m) { m.cases[1].q = '1'; }),
      'champ en trop dans une case': mute(function (o, m) { m.cases[1].onclick = 'alert(1)'; }),
      'identifiant de base « P »': mute(function (o, m) { m.id = 'P'; }),
      'identifiant « constructor »': mute(function (o, m) { m.id = 'constructor'; }),
      'identifiant « __proto__ »': mute(function (o, m) { m.id = '__proto__'; }),
      'identifiant « X »': mute(function (o, m) { m.id = 'X'; }),
      'identifiant « X1<b> »': mute(function (o, m) { m.id = 'X1<b>'; }),
      'identifiant en double': mute(function (o, m) { o.modeles.push(JSON.parse(JSON.stringify(m))); }),
      'quantité 0': mute(function (o, m) { m.quantite = 0; }),
      'quantité 10': mute(function (o, m) { m.quantite = 10; }),
      'quantité 1,5': mute(function (o, m) { m.quantite = 1.5; }),
      'quantité en texte': mute(function (o, m) { m.quantite = '2'; }),
      'nom vide': mute(function (o, m) { m.nom = ''; }),
      'nom de 41 caractères': mute(function (o, m) { m.nom = new Array(42).join('n'); }),
      'nom avec caractère de contrôle': mute(function (o, m) { m.nom = 'a\u0000b'; }),
      'nom objet': mute(function (o, m) { m.nom = { toString: 'x' }; }),
      'champ en trop dans la pièce': mute(function (o, m) { m.noyau = true; }),
      'champ « horsCatalogue »': mute(function (o, m) { m.horsCatalogue = true; }),
      '25 pièces': mute(function (o, m) { for (var i = 2; i <= 25; i++) { var c = JSON.parse(JSON.stringify(m)); c.id = 'X' + i; o.modeles.push(c); } }),
      'liste en objet': mute(function (o) { o.modeles = { length: 1 }; }),
      'liste nulle': mute(function (o) { o.modeles = null; })
    };
    var noms = Object.keys(mutations);
    verifier('plateau témoin à pièce personnelle : accepté par les quatre entrées', P.lire(bon).ok && P.lire(JSON.stringify(mute(function () {}))).ok);

    // 1. Fichier de plateau.
    var avant = JSON.stringify(vp.plateau()), passes = [];
    noms.forEach(function (nom) {
      var r; try { r = vp.ouvrirTexte(JSON.stringify(mutations[nom])); } catch (e) { r = 'exception ' + e.message; }
      if (r !== false || JSON.stringify(vp.plateau()) !== avant) passes.push(nom + ' → ' + r);
    });
    verifier(noms.length + ' pièces personnelles hostiles dans un fichier de plateau : toutes refusées, plateau inchangé', passes.length === 0, passes.join(' | '));

    // 2. Fichier de partie.
    vp.ouvrirTexte(bon);
    AT.app.montrer('partie');
    $('#pa-graine').value = '88';
    clic($('#pa-nouvelle'));
    var partie = JSON.parse(vq.texteEnregistrement()), etatAvant = JSON.stringify(vq.etat());
    passes = [];
    noms.forEach(function (nom) {
      var o = JSON.parse(JSON.stringify(partie));
      o.plateau = mutations[nom];
      var r; try { r = vq.ouvrirTexte(JSON.stringify(o)); } catch (e) { r = 'exception ' + e.message; }
      if (r !== false || JSON.stringify(vq.etat()) !== etatAvant) passes.push(nom + ' → ' + r);
    });
    verifier('partie témoin : son plateau porte la pièce personnelle', Array.isArray(partie.plateau.modeles) && partie.plateau.modeles.length === 1);
    verifier('les mêmes dans un fichier de partie : toutes refusées, partie inchangée', passes.length === 0, passes.join(' | '));
    AT.app.montrer('plateau');
    plateauDeReference();

    // 3. Import de bibliothèque : l'entrée fautive est écartée ou le fichier refusé ; jamais de plateau fautif dans la liste.
    mode('bibliotheque');
    var modele = JSON.parse(B.exporter(B.ajouter(B.vide(), 'Témoin', base).liste));
    passes = [];
    noms.forEach(function (nom) {
      var o = JSON.parse(JSON.stringify(modele));
      o.plateaux[0].plateau = mutations[nom];
      var n = bib.liste().length, r;
      try { r = bib.importerTexte(JSON.stringify(o)); } catch (e) { r = 'exception ' + e.message; }
      if (bib.liste().length !== n || (r !== false && r !== true)) passes.push(nom + ' → ' + r + ' (' + bib.liste().length + ')');
    });
    verifier('les mêmes dans un fichier de bibliothèque importé : aucune n’entre dans la bibliothèque', passes.length === 0 && bib.liste().length === 0, passes.join(' | '));

    // 4. Contenu du stockage (liste et travail en cours).
    var sain = B.stockageMemoire();
    B.enregistrer(sain, B.ajouter(B.vide(), 'Témoin', base).liste);
    B.enregistrerTravail(sain, base);
    var travailSain = JSON.parse(sain.getItem(B.cleTravail()));
    passes = [];
    noms.forEach(function (nom) {
      var s = B.stockageMemoire(), o = JSON.parse(JSON.stringify(modele));
      o.plateaux[0].plateau = mutations[nom];
      s.setItem(B.cleListe(), JSON.stringify(o));
      var travail = JSON.parse(JSON.stringify(travailSain));
      travail.plateau = mutations[nom];
      s.setItem(B.cleTravail(), JSON.stringify(travail));
      var liste, t;
      try { liste = B.charger(s); t = B.chargerTravail(s); } catch (e) { passes.push(nom + ' → exception ' + e.message); return; }
      if (liste.liste.length !== 0 || t.plateau) passes.push(nom + ' → liste ' + liste.liste.length + ', travail ' + !!t.plateau);
    });
    verifier('stockage sain : la liste et le travail en cours à pièce personnelle sont relus', B.charger(sain).liste.length === 1 && B.chargerTravail(sain).ok && !!B.chargerTravail(sain).plateau && P.modeles(B.chargerTravail(sain).plateau).length === 1);
    verifier('les mêmes dans le stockage du navigateur (liste et travail en cours) : jamais relues comme valides', passes.length === 0, passes.join(' | '));
    verifier('aucune pollution de Object.prototype, aucun élément injecté', ({}).pollue === undefined && ({}).noyau === undefined && $$('#atelier img, #atelier script').length === 0);

    // Bibliothèque aux limites : 40 plateaux, le 41e, imports répétés et trop gros.
    var max = C.REGLAGES.bibliotheque.plateauxMax, refusNoms = [];
    saisir($('#bi-nom'), new Array(62).join('n'));
    clic($('#bi-enregistrer'));
    if (bib.liste().length !== 0) refusNoms.push('61 caractères');
    for (var i = bib.liste().length; i < max; i++) bib.enregistrerSous('Plateau n° ' + (i + 1));
    verifier('nom de 61 caractères : refusé ; 40 plateaux enregistrés', refusNoms.length === 0 && bib.liste().length === max && B.charger(stockageRecette).liste.length === max && $$('#bi-liste .at-bib-fiche').length === max, bib.liste().length);
    saisir($('#bi-nom'), 'Le 41e');
    clic($('#bi-enregistrer'));
    verifier('41e plateau : refus expliqué (40 au plus), rien n’est perdu', bib.liste().length === max && /at-etat-erreur/.test(etatBarre()) && new RegExp(String(max)).test($('#barre-etat').textContent), $('#barre-etat').textContent);
    clic($('#bi-liste [data-dupliquer]'));
    verifier('dupliquer dans une bibliothèque pleine : refus expliqué', bib.liste().length === max && /at-etat-erreur/.test(etatBarre()), $('#barre-etat').textContent);
    var tout = B.exporter(bib.liste()), idsAvant = JSON.stringify(bib.liste().map(function (e) { return e.id; }));
    var importPlein = bib.importerTexte(tout);
    verifier('importer dans une bibliothèque pleine : refus expliqué, les 40 fiches intactes', importPlein === false && bib.liste().length === max && JSON.stringify(bib.liste().map(function (e) { return e.id; })) === idsAvant, $('#barre-etat').textContent);
    while (bib.liste().length > 2) { clic($$('#bi-liste [data-supprimer-entree]').pop()); clic($('#at-confirmer-oui')); }
    var deux = B.exporter(bib.liste());
    bib.importerTexte(deux); bib.importerTexte(deux);
    var ids = bib.liste().map(function (e) { return e.id; });
    verifier('même fichier importé deux fois : 2 + 2 + 2 fiches, identifiants tous distincts, rien d’écrasé', bib.liste().length === 6 && ids.filter(function (id, i) { return ids.indexOf(id) !== i; }).length === 0
      && B.charger(stockageRecette).liste.length === 6, ids.join());
    var grosse = JSON.parse(tout);
    var importTropGros = bib.importerTexte(JSON.stringify(grosse));
    verifier('import de 40 plateaux dans une bibliothèque qui en a 6 : refus net ou import partiel annoncé, jamais plus de 40', bib.liste().length <= max && (importTropGros === false ? bib.liste().length === 6 : /import/i.test($('#barre-etat').textContent)),
      importTropGros + ' → ' + bib.liste().length + ' ; ' + $('#barre-etat').textContent);

    // Stockage qui lève une exception quelconque (ni absent, ni plein).
    var messages = [], indications = [];
    var acces = {
      plateau: vp.plateau, reglages: vp.reglages, ouvrirDocument: function () {}, message: function (t, n) { messages.push(n + ' : ' + t); },
      confirmer: function (t, l, f) { f(); }, telecharger: function () {}, ouvrirFichier: function () {}, indiquer: function (i) { indications.push(i); }
    };
    var casse = { getItem: function () { throw new Error('SecurityError simulée'); }, setItem: function () { throw new Error('écriture interdite'); }, removeItem: function () { throw new Error('non'); } };
    var vueCassee = null, exception = null, enregistre = null, sauve = null, reprise = null;
    try {
      vueCassee = AT.vueBibliotheque.creer(acces, { stockage: casse });
      vueCassee.montrer(true); vueCassee.activer();
      enregistre = vueCassee.enregistrerSous('Malgré tout');
      sauve = vueCassee.sauverTravail();
      reprise = vueCassee.reprendre();
    } catch (e) { exception = e.message; }
    verifier('stockage qui lève une exception à la lecture et à l’écriture : aucune exception ne sort, un avis est affiché', exception === null && !!vueCassee && !!vueCassee.avis() && sauve && sauve.ok === false && reprise && !reprise.plateau,
      exception + ' / ' + (vueCassee && vueCassee.avis()) + ' / ' + messages.join(' | '));
    while (bib.liste().length) { clic($('#bi-liste [data-supprimer-entree]')); clic($('#at-confirmer-oui')); }
    verifier('bibliothèque remise à vide', bib.liste().length === 0 && B.charger(stockageRecette).liste.length === 0);
    plateauDeReference();
    AT.app.montrer('partie');
  });

  // ================================================================== K. recette du testeur : catalogue 2 et étape « Villes »
  /**
   * Villes de déploiement d'un plateau qui sortent des `p` rangées extrêmes du terrain construit. Calcul refait ici,
   * sans passer par les contrôles de l'outil.
   */
  function villesHorsExtremite(plateau, p) {
    var terrain = AT.plateau.cases(plateau, { sansRecouvrements: true, sansVilles: true });
    var rs = Object.keys(terrain).map(function (k) { return AT.hex.decle(k).r; });
    var haut = Math.min.apply(null, rs), bas = Math.max.apply(null, rs);
    return AT.plateau.deploiements(plateau).filter(function (d) { var r = AT.hex.decle(d.cle).r; return d.camp === 'vert' ? r > haut + p - 1 : r < bas - p + 1; });
  }
  function nombreDe(plateau, modele) { return plateau.pieces.filter(function (p) { return p.modele === modele; }).length; }
  function signatureVilles(plateau) {
    return JSON.stringify([AT.plateau.deploiements(plateau).map(function (d) { return d.camp + ' ' + d.cle; }).sort(), AT.plateau.etatVilles(plateau).neutres.map(function (n) { return n.cle; }).sort()]);
  }
  function terrainSeul(plateau) { return JSON.stringify(plateau.pieces.filter(function (p) { return p.modele !== 'VN'; }).map(function (p) { return [p.modele, p.q, p.r, p.rotation]; })); }
  /** Vide la bibliothèque de la recette par l'interface (bouton « Supprimer » puis confirmation). */
  function viderBibliotheque() {
    var bib = AT.app.vues.plateau.bibliotheque, garde = 0;
    mode('bibliotheque');
    while (bib.liste().length && garde++ < 60) { clic($('#bi-liste [data-supprimer-entree]')); clic($('#at-confirmer-oui')); }
    mode('generer');
    return bib.liste().length === 0;
  }

  /** Repart d'un historique neuf, comme à l'ouverture de la page (reprise du travail en cours sauvegardé) : l'historique est borné à 200 pas. */
  async function historiqueNeuf() {
    await attendre(700);
    var r = AT.app.vues.plateau.reprendreTravail();
    return r.repris === true && AT.app.vues.plateau.etat().rang === 0;
  }

  scenario('Testeur C2 : générer 20 graines × profondeur 1 / 2 / 3 × remplissages 0 / 2', async function () {
    var vp = AT.app.vues.plateau, P = AT.plateau, C = AT.catalogue, vue = vp.vue;
    plateauDeReference();
    var fautes = [], sansExplication = [], bilans = [], total = 0, echecsParProfondeur = { 1: 0, 2: 0, 3: 0 }, profondeurDite = 0, plateauLoin = null;
    [1, 2, 3].forEach(function (prof) {
      [0, 2].forEach(function (remp) {
        var reussis = 0, echecs = 0, dites = 0, posees = 0, loin = 0;
        for (var g = 1; g <= 20; g++) {
          var ou = 'profondeur ' + prof + ', remplissages ' + remp + ', graine ' + g + ' : ';
          // Les réglages sont remis avant chaque graine : après un échec, le plateau affiché (et sa profondeur) n'a pas changé.
          choisir($('#vi-profondeur'), prof);
          choisir($('#pl-remplissages'), remp);
          var avant = JSON.stringify(vp.plateau());
          $('#pl-graine').value = String(g);
          clic($('#pl-generer'));
          total += 1;
          if (!$('#pl-avis').hidden) {
            echecs += 1;
            var avis = $('#pl-avis').textContent, enCause = /La profondeur des extrémités \(\d rangées? en haut et en bas\) est en cause/.test(avis);
            if (JSON.stringify(vp.plateau()) !== avant) fautes.push(ou + 'échec, mais le plateau a changé');
            if (avis.indexOf('Échec de la génération avec la graine « ' + g + ' »') !== 0 || !/at-etat-erreur/.test(etatBarre())) fautes.push(ou + 'échec mal annoncé : ' + avis.slice(0, 80));
            if (enCause) {
              dites += 1;
              if (prof === 3 || /seuil de contact 2/.test(avis) || !/Changez le réglage « Profondeur des extrémités »/.test(avis)) fautes.push(ou + 'cause « profondeur » incohérente : ' + avis.slice(-160));
            } else if (!/Essayez la graine suivante, ou le seuil de contact 2\./.test(avis)) sansExplication.push(ou + avis.slice(-120));
            continue;
          }
          reussis += 1;
          var pl = vp.plateau(), nbR = nombreDe(pl, 'R'), b = vp.bilan(), detail = [];
          posees += nbR;
          if (b.erreurs !== 0) detail.push(b.erreurs + ' erreur(s)');
          if (b.etape !== 'complet') detail.push('étape ' + b.etape);
          if (P.profondeurExtremite(pl) !== prof || (prof === C.REGLAGES.villes.profondeurExtremite) !== !('profondeurExtremite' in pl)) detail.push('profondeur enregistrée : ' + pl.profondeurExtremite);
          if ($('#vi-profondeur').value !== String(prof) || vp.reglages().profondeurExtremite !== prof) detail.push('réglage affiché : ' + $('#vi-profondeur').value);
          if (villesHorsExtremite(pl, prof).length) detail.push('ville hors des ' + prof + ' rangées');
          if (nbR > remp) detail.push(nbR + ' remplissages');
          if (pl.pieces.length !== 26 + nbR || casesDessinees(vue) !== 93 + nbR || P.villes(pl).length !== 7 || P.deploiements(pl).length !== 4) detail.push(pl.pieces.length + ' pièces, ' + casesDessinees(vue) + ' cases dessinées');
          if (String(pl.graine) !== String(g)) detail.push('graine ' + pl.graine);
          // Enregistrer puis rouvrir : identique, toujours sans erreur, le réglage suit le fichier.
          var texte = vp.texteEnregistrement();
          if (!(vp.ouvrirTexte(texte) === true && JSON.stringify(vp.plateau()) === JSON.stringify(pl) && vp.bilan().erreurs === 0 && $('#vi-profondeur').value === String(prof))) detail.push('réouverture');
          if (villesHorsExtremite(pl, 2).length) { loin += 1; if (prof === 3 && !plateauLoin) plateauLoin = texte; }
          if (detail.length) fautes.push(ou + detail.join(', '));
        }
        echecsParProfondeur[prof] += echecs;
        profondeurDite += dites;
        bilans.push('profondeur ' + prof + ', ' + remp + ' remplissage(s) permis : ' + reussis + ' générés, ' + echecs + ' échec(s) dont ' + dites + ' dus à la profondeur ; ' + posees + ' remplissage(s) posé(s) ; '
          + loin + ' plateau(x) avec une ville hors des 2 rangées');
      });
    });
    bilans.forEach(function (x) { lignes.push('INFO  ' + x); });
    verifier(total + ' générations par l’interface (20 graines × profondeur 1, 2, 3 × remplissages 0, 2) : tout plateau rendu est complet, sans erreur, à 7 villes, villes dans les rangées de sa profondeur (calcul refait), profondeur enregistrée, rouvert à l’identique',
      total === 120 && fautes.length === 0, fautes.slice(0, 6).join(' | '));
    verifier('aucun échec de génération à 2 et à 3 rangées', echecsParProfondeur[2] === 0 && echecsParProfondeur[3] === 0, JSON.stringify(echecsParProfondeur));
    verifier('à 1 rangée, des générations échouent et le message dit que la profondeur des extrémités est en cause (avec le réglage à changer, sans conseiller autre chose)', echecsParProfondeur[1] > 0 && profondeurDite > 0
      && profondeurDite === echecsParProfondeur[1] - sansExplication.length, echecsParProfondeur[1] + ' échec(s), ' + profondeurDite + ' dit(s) ; ' + sansExplication.slice(0, 2).join(' | '));
    verifier('à 3 rangées, un plateau a une ville hors des 2 rangées extrêmes', !!plateauLoin);
    if (plateauLoin) {
      var sans = JSON.parse(plateauLoin);
      sans.profondeurExtremite = undefined;                 // JSON.stringify n'écrit pas un champ indéfini : fichier d'avant la correction
      verifier('ce plateau privé de son champ (fichier d’avant la correction) : ouvert au réglage par défaut, donc « mal placée » ; avec son champ : aucune erreur', vp.ouvrirTexte(JSON.stringify(sans)) === true
        && $('#vi-profondeur').value === '2' && vp.bilan().villes.erreurs > 0 && /mal placée : Cette case n’est pas à l’extrémité/.test($('#pl-controles').textContent)
        && vp.ouvrirTexte(plateauLoin) === true && vp.bilan().erreurs === 0 && $('#vi-profondeur').value === '3', $('#pl-bilan').textContent);
    }
    verifier('réglages remis à leur valeur par défaut', reglagesParDefaut());
    plateauDeReference();
    AT.app.montrer('partie');
  });

  scenario('Testeur C2 : plateau construit à la main, puis villes (clic, clavier, refus, pose libre, automatique, autre proposition), retouches, annuler / rétablir', async function () {
    var vp = AT.app.vues.plateau, P = AT.plateau, V = AT.vueVilles, VC = AT.vueCreation, vue = vp.vue;
    plateauDeReference();
    verifier('historique remis à neuf par la reprise du travail en cours', await historiqueNeuf());
    var patron = AT.generateur.generer(7).plateau, aPoser = patron.pieces.filter(function (p) { return p.modele !== 'N1' && p.modele !== 'VN'; });
    mode('creer');
    clic($('#cr-vierge'));
    var rangDepart = vp.etat().rang, illisibles = [];
    aPoser.forEach(function (p, i) {
      clic($('#pl-stock [data-modele="' + p.modele + '"]'));
      for (var t = 0; t < p.rotation; t++) touche('r');
      if (i % 3 === 2) { vue.svg.focus(); allerCurseur(vue, AT.hex.cle(p.q, p.r)); touche('Enter', {}, vue.svg); }     // une pièce sur trois au clavier
      else clicCase(vue, AT.hex.cle(p.q, p.r));
      touche('Escape');
      if (!relisible(vp)) illisibles.push(p.modele);
    });
    var construit = JSON.stringify(vp.plateau());
    verifier('terrain entier posé à la main (' + aPoser.length + ' pièces, clic et clavier) : le même terrain que le patron, une étape par pièce, toujours relisible', terrainSeul(vp.plateau()) === terrainSeul(patron)
      && vp.etat().rang === rangDepart + aPoser.length && illisibles.length === 0 && casesDessinees(vue) === 91, vp.plateau().pieces.length + ' pièces ; ' + illisibles.join());
    verifier('terrain construit sans villes : aucune erreur, étape « villes », le bouton « Passer à l’étape Villes » et le mode « Villes » sont proposés', vp.bilan().erreurs === 0 && vp.bilan().etape === 'villes'
      && visible($('#cr-vers-villes')) && $('#pl-mode-villes').getAttribute('data-propose') === 'oui' && !$('#cr-termine'), $('#pl-bilan').textContent);
    clic($('#cr-vers-villes'));
    verifier('« Passer à l’étape Villes » : mode « Villes », outil Vert, compteurs à 0', vp.mode() === 'villes' && vp.villes.outil() === 'vert' && compteur('vert') === '0 / 2' && compteur('rouge') === '0 / 2' && compteur('neutre') === '0 / 2'
      && marques(vue, 'at-admissible') === V.places(vp.plateau(), 'vert').length && marques(vue, 'at-admissible') > 0);

    /** Une place de l'outil qui en laisse au moins une autre au même camp (l'écart de 4 pas en retire). */
    function placeQuiEnLaisse(outil) {
      var places = V.places(vp.plateau(), outil);
      return places.filter(function (k) { var r = V.cliquer(vp.plateau(), outil, k, {}); return r.ok && V.places(r.plateau, outil).length > 0; })[0] || places[0];
    }
    // Clic, puis clavier.
    var rang = vp.etat().rang, v1 = placeQuiEnLaisse('vert');
    clicCase(vue, v1);
    verifier('ville de déploiement de Vert posée par un clic : une étape, compteur 1 / 2, aucune erreur de villes', vp.etat().rang === rang + 1 && compteur('vert') === '1 / 2' && vp.plateau().camps.vert.join() === v1 && vp.bilan().villes.erreurs === 0);
    var v2 = V.places(vp.plateau(), 'vert')[0];
    vue.svg.focus();
    allerCurseur(vue, v2);
    touche('Enter', {}, vue.svg);
    verifier('seconde ville de Vert posée au clavier (flèches puis Entrée) : compteur 2 / 2, l’outil passe à Rouge', !!v2 && compteur('vert') === '2 / 2' && vp.plateau().camps.vert.indexOf(v2) !== -1 && vp.villes.outil() === 'rouge'
      && vp.bilan().villes.erreurs === 0, v2 + ' / ' + $('#barre-etat').textContent);
    // Refus expliqués.
    var toutes = P.cases(vp.plateau()), refus = [];
    function refuse(nom, cle, motif) {
      if (!cle) { refus.push(nom + ' : aucune case à essayer'); return; }
      var avantRefus = JSON.stringify(vp.plateau()), rangRefus = vp.etat().rang;
      ctxMessageEfface();
      clicCase(vue, cle);
      if (!(cle && JSON.stringify(vp.plateau()) === avantRefus && vp.etat().rang === rangRefus && motif.test($('#barre-etat').textContent) && /at-etat-erreur/.test(etatBarre()))) refus.push(nom + ' (' + cle + ') → ' + $('#barre-etat').textContent);
    }
    var foret = Object.keys(toutes).filter(function (k) { return toutes[k].terrain === 'foret'; })[0], montagne = Object.keys(toutes).filter(function (k) { return toutes[k].terrain === 'montagne'; })[0];
    var enHaut = P.placesDeploiementSurCases(toutes, 'vert', { profondeurExtremite: 2, sansEcart: true })[0];
    refuse('forêt', foret, /^Pose refusée : Une ville de déploiement se pose sur une case de Plaine \(ici : foret\)\.$/);
    refuse('montagne', montagne, /^Pose refusée : Une ville de déploiement se pose sur une case de Plaine \(ici : montagne\)\.$/);
    refuse('noyau', '0,1', /^Pose refusée : Une ville de déploiement ne se pose pas sur le noyau\.$/);
    refuse('case vide', V.anneau(vp.plateau())[0], /^Pose refusée : Cette case n’est pas sur le plateau\.$/);
    refuse('extrémité de l’autre camp', enHaut, /^Pose refusée : Cette case n’est pas à l’extrémité du bas : la ville de déploiement de Rouge se pose dans les 2 rangées du bas\.$/);
    verifier('5 refus de pose d’une ville de déploiement de Rouge (forêt, montagne, noyau, case vide, extrémité de Vert) : chacun expliqué, rien ne change', refus.length === 0, refus.join(' | '));
    var r1 = placeQuiEnLaisse('rouge');
    clicCase(vue, r1);
    // Pose libre : une Plaine hors de l'extrémité.
    var strictes = V.places(vp.plateau(), 'rouge'), libreSeule = V.places(vp.plateau(), 'rouge', { libre: true }).filter(function (k) { return strictes.indexOf(k) === -1 && enHautOuMilieu(k); })[0];
    function enHautOuMilieu(k) { return villesHorsExtremite({ pieces: vp.plateau().pieces, deploiements: [{ cle: k, camp: 'rouge' }] }, 2).length === 1; }
    refuse('pose stricte hors de l’extrémité', libreSeule, /^Pose refusée : /);
    clic($('#vi-libre'));
    rang = vp.etat().rang;
    clicCase(vue, libreSeule);
    var enLibre = vp.texteEnregistrement();
    verifier('pose libre : la même Plaine est acceptée (une étape, annoncé en alerte), les contrôles disent « mal placée », et le plateau reste relisible', refus.length === 0 && vp.etat().rang === rang + 1 && compteur('rouge') === '2 / 2'
      && /Pose libre : les contrôles disent si elle respecte les règles/.test($('#barre-etat').textContent) && /at-etat-alerte/.test(etatBarre()) && vp.bilan().villes.erreurs > 0
      && /Ville de déploiement de Rouge en \(.*\) mal placée/.test($('#pl-controles').textContent) && relisible(vp), refus.join(' | ') + $('#barre-etat').textContent);
    verifier('plateau en pose libre enregistré puis rouvert : accepté, la ville mal placée est toujours signalée', vp.ouvrirTexte(enLibre) === true && vp.texteEnregistrement() === enLibre && vp.bilan().villes.erreurs > 0);
    clic($('#pl-annuler'));
    clicCase(vue, libreSeule);
    clic($('#vi-libre'));
    verifier('la ville mal placée se retire d’un clic ; pose libre décochée', compteur('rouge') === '1 / 2' && vp.bilan().villes.erreurs === 0 && vp.villes.libre() === false && $('#vi-libre').checked === false);
    clic($('#vi-outil-rouge'));
    var r2 = V.places(vp.plateau(), 'rouge')[0];
    clicCase(vue, r2);
    verifier('seconde ville de Rouge : compteur 2 / 2, l’outil passe à la ville neutre', !!r2 && compteur('rouge') === '2 / 2' && vp.villes.outil() === 'neutre' && marques(vue, 'at-admissible') === V.places(vp.plateau(), 'neutre').length, r2);
    // Villes neutres : refus, puis une par flanc.
    refus = [];
    toutes = P.cases(vp.plateau());
    var horsFlanc = V.anneau(vp.plateau()).filter(function (k) { return /sur un côté du plateau/.test(P.peutPoserVilleNeutre(vp.plateau(), k).raison || ''); })[0];
    refuse('ville neutre sur une case occupée', '1,0', /^Pose refusée : Une ville neutre est une tuile ajoutée contre le bord : cette case est déjà occupée\.$/);
    refuse('ville neutre en haut ou en bas', horsFlanc, /^Pose refusée : Une ville neutre se pose sur un côté du plateau \(flanc gauche ou droit\), pas en haut, en bas ni dans un creux\.$/);
    var n1 = V.places(vp.plateau(), 'neutre')[0], flanc1 = n1 ? P.peutPoserVilleNeutre(vp.plateau(), n1).flanc : null;
    if (n1) clicCase(vue, n1);
    var memeFlanc = P.placesNeutresSurCases(P.cases(vp.plateau()), { sansEcart: true }).filter(function (x) { return x.flanc === flanc1; })[0];
    if (memeFlanc) refuse('seconde ville neutre sur le même flanc', memeFlanc.cle, /^Pose refusée : Le flanc (gauche|droite) a déjà sa ville neutre : l’autre se pose sur le flanc (droit|gauche)\.$/);
    verifier('villes neutres : refus expliqués (case occupée, hors des flancs' + (memeFlanc ? ', flanc déjà pourvu' : '') + ') ; la première est posée', !!n1 && !!horsFlanc && refus.length === 0 && compteur('neutre') === '1 / 2', refus.join(' | '));
    var n2 = V.places(vp.plateau(), 'neutre')[0];
    if (n2) {
      clicCase(vue, n2);
      verifier('toutes les villes posées à la main : « Toutes les villes sont posées », plateau complet, aucune erreur, « Plateau terminé »', /Toutes les villes sont posées\./.test($('#barre-etat').textContent) && vp.bilan().etape === 'complet'
        && vp.bilan().erreurs === 0 && compteur('neutre') === '2 / 2' && marques(vue, 'at-admissible') === 0 && $('#pl-etape-titre').textContent === 'Plateau complet' && !!$('#cr-termine') && relisible(vp), $('#barre-etat').textContent + ' / ' + $('#pl-bilan').textContent);
    } else {
      lignes.push('INFO  après les 5 premières villes posées à la main, aucune place ne reste pour la seconde ville neutre (écart de 4 pas) : ' + ($('#vi-diagnostic').textContent || 'pas d’avis'));
      verifier('aucune place pour la dernière ville neutre : l’avis le dit avec sa cause', !$('#vi-diagnostic').hidden && /Aucune place pour une ville neutre/.test($('#vi-diagnostic').textContent), $('#vi-diagnostic').textContent);
    }

    // Poser automatiquement, puis « Autre proposition ».
    var attendu = V.poserAuto(vp.plateau(), vp.plateau().graine, {});
    rang = vp.etat().rang;
    clic($('#vi-auto'));
    var auto = JSON.stringify(vp.plateau());
    verifier('« Poser les villes automatiquement » sur le plateau fait main : une étape, complet, aucune erreur, le résultat du calcul pur', vp.etat().rang === rang + 1 && attendu.ok && auto === JSON.stringify(attendu.plateau)
      && vp.bilan().etape === 'complet' && vp.bilan().erreurs === 0 && terrainSeul(vp.plateau()) === terrainSeul(patron), $('#vi-message').textContent);
    verifier('bouton « Autre proposition » à côté de « Poser les villes automatiquement »', visible($('#vi-autre')) && $('#vi-autre').parentNode === $('#vi-auto').parentNode && $('#vi-autre').previousElementSibling === $('#vi-auto')
      && $('#vi-autre').textContent === 'Autre proposition');
    var propositions = [], fautesP = [], nombre = null;
    for (var i = 0; i < 5; i++) {
      var avantP = signatureVilles(vp.plateau());
      rang = vp.etat().rang;
      clic($('#vi-autre'));
      var lu = /^Autre proposition : n° (\d+) sur (\d+), de la mieux équilibrée à la moins équilibrée \(score (\d+) ; 0 = équilibré\)\. Annuler pour revenir à la précédente\.$/.exec($('#vi-message').textContent);
      var s = signatureVilles(vp.plateau());
      if (!lu || vp.etat().rang !== rang + 1 || s === avantP || propositions.indexOf(s) !== -1 || s === signatureVilles(JSON.parse(auto)) || vp.bilan().etape !== 'complet' || vp.bilan().erreurs !== 0
        || parseInt(lu[3], 10) !== vp.bilan().equilibre.score || !relisible(vp) || terrainSeul(vp.plateau()) !== terrainSeul(patron) || !/at-etat-info/.test(etatBarre())) fautesP.push('n° ' + (i + 1) + ' : ' + $('#vi-message').textContent);
      if (lu) nombre = parseInt(lu[2], 10);
      propositions.push(s);
    }
    verifier('« Autre proposition » 5 fois : chaque fois d’autres villes, jamais deux fois les mêmes, une étape chacune, plateau complet sans erreur, rang et score annoncés (' + nombre + ' combinaisons)', fautesP.length === 0 && nombre > 5,
      fautesP.join(' | '));
    clic($('#pl-annuler'));
    verifier('Annuler : la proposition précédente revient', signatureVilles(vp.plateau()) === propositions[3]);
    clic($('#vi-autre'));
    verifier('« Autre proposition » de nouveau : la même cinquième (suite déterministe, aucun tirage)', signatureVilles(vp.plateau()) === propositions[4]);
    for (var a = 0; a < 5; a++) touche('z', { ctrlKey: true });
    verifier('5 annulations : retour à la pose automatique', JSON.stringify(vp.plateau()) === auto);
    clic($('#vi-autre'));
    verifier('depuis la pose automatique, la première « autre proposition » est la même qu’au premier passage', signatureVilles(vp.plateau()) === propositions[0]);
    clic($('#pl-annuler'));

    // Retirer, tourner, déplacer la pièce qui porte une ville de déploiement.
    var complet = JSON.stringify(vp.plateau()), rangComplet = vp.etat().rang;
    mode('generer');
    var vd = vp.plateau().camps.vert[0], porteuse = pieceEn(vp, vd);
    clicCase(vue, vd);
    touche('Delete');
    verifier('retirer (Suppr) la pièce qui porte une ville de déploiement : la ville part avec elle, annoncé en alerte ; ni erreur de villes ni fichier illisible', !pieceEn(vp, vd) && P.deploiements(vp.plateau()).length === 3
      && vp.plateau().camps.vert.length === 1 && /Pièce retirée : elle retourne au stock\. La ville de déploiement de Vert a été retirée avec la Plaine qui la portait : à reposer à l’étape « Villes »\./.test($('#barre-etat').textContent)
      && /at-etat-alerte/.test(etatBarre()) && vp.bilan().etape === 'construction' && relisible(vp), $('#barre-etat').textContent);
    clic($('#pl-annuler'));
    clicCase(vue, vd);
    var avantTour = P.deploiements(vp.plateau()).length;
    touche('r');
    var apresTour = P.deploiements(vp.plateau()).length, dessousTour = P.cases(vp.plateau(), { sansVilles: true });
    verifier('tourner la pièce qui porte une ville : refus expliqué, ou ville gardée sur sa Plaine, ou ville retirée et annoncée ; jamais de ville hors d’une Plaine, fichier relisible',
      (/at-etat-erreur/.test(etatBarre()) ? JSON.stringify(vp.plateau()) === complet : (apresTour === avantTour || (apresTour === avantTour - 1 && /ville de déploiement de Vert a été retirée/.test($('#barre-etat').textContent))))
      && P.deploiements(vp.plateau()).every(function (d) { return dessousTour[d.cle] && dessousTour[d.cle].origine === 'plaine'; }) && relisible(vp), $('#barre-etat').textContent);
    if (JSON.stringify(vp.plateau()) !== complet) clic($('#pl-annuler'));
    touche('Escape');
    // Déplacer en la glissant (mode « Créer à la main ») vers une place libre.
    mode('creer');
    var decalage = null;
    for (var dq = -9; dq <= 9 && !decalage; dq++) for (var dr = -9; dr <= 9 && !decalage; dr++) {
      var but = AT.hex.decle(vd);
      if (AT.hex.distance(AT.hex.cle(but.q + dq, but.r + dr), '0,0') > 7) continue;
      if (VC.essaiPose(vp.plateau(), porteuse.modele, porteuse.q + dq, porteuse.r + dr, porteuse.rotation, porteuse.id).ok && !P.cases(vp.plateau())[AT.hex.cle(but.q + dq, but.r + dr)]) decalage = { q: dq, r: dr };
    }
    var arrivee = decalage ? AT.hex.cle(AT.hex.decle(vd).q + decalage.q, AT.hex.decle(vd).r + decalage.r) : null;
    if (arrivee) glisserCases(vue, [vd, arrivee]);
    verifier('déplacer en la glissant la pièce qui porte une ville : la pièce part, la ville est retirée et c’est annoncé', !!arrivee && !pieceEn(vp, vd) && !!pieceEn(vp, arrivee) && pieceEn(vp, arrivee).modele === porteuse.modele
      && P.deploiements(vp.plateau()).length === 3 && /Pièce déplacée\. La ville de déploiement de Vert a été retirée avec la Plaine qui la portait/.test($('#barre-etat').textContent) && /at-etat-alerte/.test(etatBarre()) && relisible(vp),
      arrivee + ' : ' + $('#barre-etat').textContent);
    clic($('#pl-annuler'));
    touche('Escape');
    verifier('après annulation : le plateau complet, à l’identique', JSON.stringify(vp.plateau()) === complet && vp.etat().rang === rangComplet);
    // Correction 2, dans les autres modes : glisser, gomme et pinceau sur une ville neutre.
    var vn = P.etatVilles(vp.plateau()).neutres[0].cle, voisineLibre = V.anneau(vp.plateau()).filter(function (k) { return AT.hex.distance(k, vn) === 1; })[0] || V.anneau(vp.plateau())[0];
    ctxMessageEfface();
    glisserCases(vue, [vn, voisineLibre]);
    verifier('mode « Créer à la main », glisser une ville neutre : refusé, renvoi à l’étape « Villes », rien ne bouge', JSON.stringify(vp.plateau()) === complet && vp.etat().rang === rangComplet
      && /Une ville neutre ne se déplace, ne se tourne et ne se retire qu’à l’étape « Villes »/.test($('#barre-etat').textContent) && /at-etat-erreur/.test(etatBarre()) && marques(vue, 'at-fantome') === 0, $('#barre-etat').textContent);
    touche('Escape');
    mode('pinceau');
    clic($('#pi-gomme'));
    clicCase(vue, vn);
    var messageGomme = $('#pi-message').textContent;
    clic($('#pi-terrain-foret'));
    clicCase(vue, vn);
    verifier('mode « Pinceau », gomme puis forêt sur une ville neutre : refusées, le message renvoie à l’étape « Villes », rien ne change', JSON.stringify(vp.plateau()) === complet && vp.etat().rang === rangComplet
      && /étape « Villes »/.test(messageGomme) && /étape « Villes »/.test($('#pi-message').textContent), messageGomme + ' / ' + $('#pi-message').textContent);
    mode('villes');
    clicCase(vue, vn);
    verifier('étape « Villes » : la même ville neutre se retire d’un clic', P.etatVilles(vp.plateau()).neutres.length === 1 && /Ville neutre retirée/.test($('#barre-etat').textContent));
    clic($('#pl-annuler'));

    // Annuler / rétablir à travers les deux étapes : du plateau complet au noyau seul, et retour.
    mode('generer');
    var pas = vp.etat().rang - rangDepart, etapes = [vp.bilan().etape], ordre = { complet: 2, villes: 1, construction: 0 }, mauvais = [];
    for (var z = 0; z < pas; z++) {
      touche('z', { ctrlKey: true });
      etapes.push(vp.bilan().etape);
      if (!relisible(vp)) mauvais.push('annulation ' + z);
    }
    var vuConstruit = etapes.indexOf('villes') !== -1 && etapes.indexOf('complet') !== -1 && etapes[etapes.length - 1] === 'construction';
    verifier(pas + ' annulations (Ctrl+Z), des propositions de villes jusqu’au noyau seul : chaque état relisible, les étapes « complet », « villes » puis « construction » sont traversées', vp.etat().rang === rangDepart
      && vp.plateau().pieces.length === 1 && vuConstruit && mauvais.length === 0 && etapes.lastIndexOf('complet') < etapes.lastIndexOf('construction'), etapes.join(' ').slice(0, 300));
    var retour = [];
    for (var y = 0; y < pas; y++) { touche('y', { ctrlKey: true }); retour.push(ordre[vp.bilan().etape]); if (JSON.stringify(vp.plateau()) === construit) retour.push('construit'); }
    verifier(pas + ' rétablissements (Ctrl+Y) : le terrain construit est retrouvé en chemin, puis le plateau complet, à l’identique', JSON.stringify(vp.plateau()) === complet && retour.indexOf('construit') !== -1 && vp.etat().rang === rangComplet
      && vp.bilan().etape === 'complet' && vp.bilan().erreurs === 0);

    // « Autre proposition » sans terrain : impossible, et c'est dit.
    mode('creer');
    clic($('#cr-vierge'));
    mode('villes');
    rang = vp.etat().rang;
    clic($('#vi-autre'));
    verifier('« Autre proposition » sur le noyau seul : impossible, avec la cause, rien ne change', vp.etat().rang === rang && /Autre proposition impossible : Pas assez de places/.test($('#vi-message').textContent) && /at-etat-erreur/.test(etatBarre()),
      $('#vi-message').textContent);
    verifier('réglages remis à leur valeur par défaut', reglagesParDefaut());
    plateauDeReference();
    AT.app.montrer('partie');
  });

  scenario('Testeur C2 : profondeur enregistrée (fichier, bibliothèque, partie), anciens fichiers, fichiers hostiles', async function () {
    var vp = AT.app.vues.plateau, vq = AT.app.vues.partie, P = AT.plateau, B = AT.bibliotheque, bib = vp.bibliotheque, vue = vp.vue;
    plateauDeReference();
    verifier('historique remis à neuf par la reprise du travail en cours', await historiqueNeuf());
    var reference = P.serialiser(AT.generateur.generer(1).plateau), rang = vp.etat().rang;
    choisir($('#vi-profondeur'), 3);
    verifier('profondeur des extrémités réglée à 3 : écrite dans le plateau (une étape d’annulation), le message le dit', vp.plateau().profondeurExtremite === 3 && vp.etat().rang === rang + 1 && vp.reglages().profondeurExtremite === 3
      && /Extrémités : 3 rangées en haut et en bas\. .* enregistré avec le plateau/.test($('#barre-etat').textContent) && /"profondeurExtremite": 3/.test(vp.texteEnregistrement()), $('#barre-etat').textContent);
    choisir($('#vi-profondeur'), 3);
    verifier('choisir de nouveau la même valeur : aucune étape de plus', vp.etat().rang === rang + 1);
    touche('z', { ctrlKey: true });
    verifier('Ctrl+Z : le réglage revient à 2 (champ absent), la liste le montre', !('profondeurExtremite' in vp.plateau()) && $('#vi-profondeur').value === '2' && vp.reglages().profondeurExtremite === 2);
    touche('y', { ctrlKey: true });
    var graineProfonde = null;
    for (var g = 1; g <= 40 && !graineProfonde; g++) {
      $('#pl-graine').value = String(g);
      clic($('#pl-generer'));
      if ($('#pl-avis').hidden && villesHorsExtremite(vp.plateau(), 2).length) graineProfonde = g;
    }
    var profond = JSON.stringify(vp.plateau()), texteProfond = vp.texteEnregistrement();
    verifier('plateau généré à 3 rangées avec une ville en troisième rangée (graine ' + graineProfonde + ') : aucune erreur, profondeur 3 dans le fichier', !!graineProfonde && vp.bilan().erreurs === 0 && vp.bilan().etape === 'complet'
      && /"profondeurExtremite": 3/.test(texteProfond) && villesHorsExtremite(vp.plateau(), 3).length === 0);
    telecharges.length = 0;
    clic($('#pl-enregistrer'));
    verifier('« Enregistrer » : fichier produit', telecharges.length === 1 && /\.json$/.test(telecharges[0].nom) && telecharges[0].taille > 1000);
    // Rouvrir : d'abord un plateau sans le champ, puis le fichier à 3 rangées.
    verifier('ouvrir un plateau sans le champ : la profondeur revient au réglage par défaut (2)', vp.ouvrirTexte(reference) === true && $('#vi-profondeur').value === '2' && vp.reglages().profondeurExtremite === 2 && vp.bilan().erreurs === 0);
    verifier('rouvrir le fichier à 3 rangées : identique, le réglage est relu (3), AUCUNE erreur aux contrôles', vp.ouvrirTexte(texteProfond) === true && JSON.stringify(vp.plateau()) === profond && $('#vi-profondeur').value === '3'
      && vp.reglages().profondeurExtremite === 3 && vp.bilan().erreurs === 0 && vp.bilan().etape === 'complet', $('#pl-bilan').textContent);
    mode('villes');
    clic($('#vi-retirer'));
    clic($('#vi-outil-vert'));
    var nbPlaces = function (p) { return ['vert', 'rouge'].reduce(function (n, camp) { return n + P.placesDeploiementSurCases(P.cases(vp.plateau()), camp, { profondeurExtremite: p }).length; }, 0); };
    verifier('étape « Villes » sur ce plateau : les places en surbrillance sont celles des 3 rangées (plus nombreuses qu’à 2 rangées)', marques(vue, 'at-admissible') === P.placesDeploiementSurCases(P.cases(vp.plateau()), 'vert', { profondeurExtremite: 3 }).length
      && marques(vue, 'at-admissible') > 0 && nbPlaces(3) > nbPlaces(2), marques(vue, 'at-admissible') + ' ; ' + nbPlaces(3) + ' / ' + nbPlaces(2));
    clic($('#pl-annuler'));
    rang = vp.etat().rang;
    choisir($('#vi-profondeur'), 2);
    verifier('ramener le réglage à 2 sur ce plateau : une étape, la ville de troisième rangée devient « mal placée »', vp.etat().rang === rang + 1 && !('profondeurExtremite' in vp.plateau()) && vp.bilan().villes.erreurs > 0
      && /mal placée : Cette case n’est pas à l’extrémité du (haut|bas)/.test($('#pl-controles').textContent), $('#pl-bilan').textContent);
    clic($('#pl-annuler'));
    verifier('Annuler : 3 rangées de nouveau, plus d’erreur', JSON.stringify(vp.plateau()) === profond && vp.bilan().erreurs === 0 && $('#vi-profondeur').value === '3');
    mode('generer');

    // Bibliothèque.
    verifier('enregistré dans la bibliothèque', bib.enregistrerSous('Extrémités de 3 rangées') === true && bib.liste().length === 1 && bib.liste()[0].plateau.profondeurExtremite === 3);
    vp.ouvrirTexte(reference);
    mode('bibliotheque');
    verifier('fiche de la bibliothèque, vue depuis un plateau à 2 rangées : « aucune erreur » (la fiche est jugée avec sa propre profondeur)', /7 villes ; aucune erreur/.test($('#bi-liste').textContent), $('#bi-liste').textContent.slice(0, 200));
    clic($('#bi-liste [data-ouvrir]'));
    verifier('fiche rouverte : identique, réglage à 3, aucune erreur, pas « (modifié) »', JSON.stringify(vp.plateau()) === profond && $('#vi-profondeur').value === '3' && vp.bilan().erreurs === 0
      && /Extrémités de 3 rangées/.test($('#at-nom-plateau').textContent) && !/modifié/.test($('#at-nom-plateau').textContent), $('#at-nom-plateau').textContent);
    var exporte = B.exporter(bib.liste());
    verifier('bibliothèque exportée puis importée : la profondeur suit', /"profondeurExtremite":3/.test(exporte) && bib.importerTexte(exporte) === true && bib.liste().length === 2
      && bib.liste().every(function (e) { return e.plateau.profondeurExtremite === 3; }));
    await attendre(700);
    var travail = B.chargerTravail(stockageRecette);
    verifier('travail en cours sauvegardé : la profondeur y est', travail.ok && !!travail.plateau && travail.plateau.profondeurExtremite === 3 && JSON.stringify(travail.plateau) === profond, travail.raison);
    mode('generer');

    // Un AUTRE document (fiche, partie) n'est jamais jugé avec la profondeur du plateau affiché.
    vp.ouvrirTexte(reference);
    verifier('plateau de référence (2 rangées) enregistré dans la bibliothèque', bib.enregistrerSous('Deux rangées') === true);
    AT.app.montrer('partie');
    $('#pa-graine').value = '9';
    clic($('#pa-nouvelle'));
    var partieDeuxRangees = vq.texteEnregistrement();
    AT.app.montrer('plateau');
    choisir($('#vi-profondeur'), 1);
    var ficheDeux = bib.liste().filter(function (x) { return x.nom === 'Deux rangées'; }), avantCopie = bib.liste().length;
    verifier('plateau affiché ramené à 1 rangée : lui-même a des villes « mal placées »', vp.plateau().profondeurExtremite === 1 && vp.bilan().villes.erreurs > 0 && ficheDeux.length === 1, $('#pl-bilan').textContent);
    mode('bibliotheque');
    var importe = bib.importerTexte(B.exporter(ficheDeux));
    var resumes = $('#bi-liste').textContent.match(/7 villes ; aucune erreur/g) || [];
    verifier('fiches à 2 et à 3 rangées vues depuis un plateau affiché à 1 rangée (dont une fiche importée à l’instant) : toutes « aucune erreur »', importe === true && bib.liste().length === avantCopie + 1
      && resumes.length === bib.liste().length, resumes.length + ' / ' + bib.liste().length + ' : ' + $('#bi-liste').textContent.slice(0, 300));
    mode('generer');
    AT.app.montrer('partie');
    verifier('partie à 2 rangées ouverte pendant que le plateau affiché est à 1 rangée : aucune erreur de plateau annoncée', vq.ouvrirTexte(partieDeuxRangees) === true
      && !/erreur\(s\) aux contrôles/.test($('#barre-etat').textContent) && /Partie ouverte/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    AT.app.montrer('plateau');
    vp.ouvrirTexte(texteProfond);

    // Partie fictive sur ce plateau.
    AT.app.montrer('partie');
    $('#pa-graine').value = '8';
    clic($('#pa-nouvelle'));
    var e = vq.etat();
    verifier('partie créée sur le plateau à 3 rangées : la profondeur est dans la partie, aucune erreur de plateau annoncée', !!e && e.plateau.profondeurExtremite === 3 && !/erreur\(s\) aux contrôles/.test($('#barre-etat').textContent)
      && /Nouvelle partie/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    var textePartie = vq.texteEnregistrement();
    verifier('partie enregistrée puis rouverte : profondeur gardée, toujours aucune erreur de plateau', /"profondeurExtremite":\s*3/.test(textePartie) && vq.ouvrirTexte(textePartie) === true && vq.etat().plateau.profondeurExtremite === 3
      && !/erreur\(s\) aux contrôles/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    AT.app.montrer('plateau');

    // Fichiers hostiles : champ `deploiements` et champ `profondeurExtremite`, par les quatre entrées.
    var casesP = P.cases(JSON.parse(profond), { sansVilles: true });
    var une = function (terrain) { return Object.keys(casesP).filter(function (k) { return casesP[k].origine === terrain; })[0]; };
    var html = '<img src=x onerror=alert(1)>';
    var hostiles = {
      'profondeur 0': function (o) { o.profondeurExtremite = 0; }, 'profondeur 4': function (o) { o.profondeurExtremite = 4; }, 'profondeur -1': function (o) { o.profondeurExtremite = -1; },
      'profondeur 2,5': function (o) { o.profondeurExtremite = 2.5; }, 'profondeur 1e9': function (o) { o.profondeurExtremite = 1e9; }, 'profondeur en texte': function (o) { o.profondeurExtremite = '3'; },
      'profondeur nulle': function (o) { o.profondeurExtremite = null; }, 'profondeur booléenne': function (o) { o.profondeurExtremite = true; }, 'profondeur en liste': function (o) { o.profondeurExtremite = [3]; },
      'profondeur en objet': function (o) { o.profondeurExtremite = { valeur: 3 }; }, 'profondeur en HTML': function (o) { o.profondeurExtremite = html; },
      'champ voisin': function (o) { o.profondeurExtremites = 3; }, 'champ pollue': function (o) { o.pollue = true; },
      'ville hors du plateau': function (o) { o.deploiements[0].cle = '20,20'; }, 'ville au bout des bornes': function (o) { o.deploiements[0].cle = '-30,30'; },
      'ville hors bornes': function (o) { o.deploiements[0].cle = '31,0'; }, 'ville sur une forêt': function (o) { o.deploiements[0].cle = une('foret'); },
      'ville sur un marais': function (o) { o.deploiements[0].cle = une('marais'); }, 'ville sur une montagne': function (o) { o.deploiements[0].cle = une('montagne'); },
      'ville sur la ville du noyau': function (o) { o.deploiements[0].cle = '0,0'; },
      'ville sur une ville neutre': function (o) { var n = o.pieces.filter(function (p) { return p.modele === 'VN'; })[0]; o.deploiements[0].cle = n.q + ',' + n.r; },
      'clé __proto__': function (o) { o.deploiements[0].cle = '__proto__'; }, 'clé constructor': function (o) { o.deploiements[0].cle = 'constructor'; }, 'clé en HTML': function (o) { o.deploiements[0].cle = html; },
      'clé numérique': function (o) { o.deploiements[0].cle = 12; }, 'clé à espace': function (o) { o.deploiements[0].cle = ' ' + o.deploiements[0].cle; }, 'clé à exposant': function (o) { o.deploiements[0].cle = '1e1,2'; },
      'clé décimale': function (o) { o.deploiements[0].cle = '1.0,2'; }, 'camp inconnu': function (o) { o.deploiements[0].camp = 'bleu'; }, 'camp __proto__': function (o) { o.deploiements[0].camp = '__proto__'; },
      'camp en HTML': function (o) { o.deploiements[0].camp = html; }, 'champ en trop': function (o) { o.deploiements[0].pollue = true; }, 'camp manquant': function (o) { o.deploiements[0] = { cle: o.deploiements[0].cle }; },
      'entrée nulle': function (o) { o.deploiements[0] = null; }, 'entrée en texte': function (o) { o.deploiements[0] = 'vert'; }, 'entrée en liste': function (o) { o.deploiements[0] = [o.deploiements[0].cle, 'vert']; },
      'liste en objet': function (o) { o.deploiements = { 0: o.deploiements[0], length: 1 }; }, 'liste en texte': function (o) { o.deploiements = 'vert'; }, 'liste nulle': function (o) { o.deploiements = null; },
      '9 villes': function (o) { o.deploiements = new Array(9).fill(o.deploiements[0]); }, 'deux villes sur la même case': function (o) { o.deploiements[1].cle = o.deploiements[0].cle; },
      '3 villes pour Vert': function (o) { o.deploiements[2].camp = 'vert'; }, 'ville sous une tuile d’événement': function (o) { o.recouvrements = [{ evenement: 'E1', cle: o.deploiements[0].cle }]; }
    };
    var acceptes = [], cleTravail = B.cleTravail(), travailBrut = JSON.parse(stockageRecette.getItem(cleTravail));
    vp.ouvrirTexte(texteProfond);
    var plateauAvant = JSON.stringify(vp.plateau()), partieAvant = JSON.stringify(vq.etat()), fichesAvant = bib.liste().length, tailleListe = Object.keys(hostiles).length;
    Object.keys(hostiles).forEach(function (nom) {
      var o = JSON.parse(texteProfond);
      hostiles[nom](o);
      // 1. fichier de plateau
      if (vp.ouvrirTexte(JSON.stringify(o)) !== false || JSON.stringify(vp.plateau()) !== plateauAvant || !/^Fichier refusé : /.test($('#barre-etat').textContent)) acceptes.push('plateau : ' + nom);
      // 2. fichier de partie
      var partie = JSON.parse(textePartie);
      hostiles[nom](partie.plateau);
      if (vq.ouvrirTexte(JSON.stringify(partie)) !== false || JSON.stringify(vq.etat()) !== partieAvant) acceptes.push('partie : ' + nom);
      // 3. import de bibliothèque : la fiche fautive n'entre jamais
      var lot = JSON.parse(exporte);
      lot.plateaux = [lot.plateaux[0]];
      lot.plateaux[0].plateau = o;
      bib.importerTexte(JSON.stringify(lot));
      if (bib.liste().length !== fichesAvant) acceptes.push('bibliothèque : ' + nom);
      // 4. contenu du stockage (travail en cours) : jamais repris
      var memoire = B.stockageMemoire(), brut = JSON.parse(JSON.stringify(travailBrut));
      brut.plateau = o;
      memoire.setItem(cleTravail, JSON.stringify(brut));
      var repris = B.chargerTravail(memoire);
      if (repris.ok || repris.plateau) acceptes.push('travail en cours : ' + nom);
    });
    verifier(tailleListe + ' fichiers hostiles sur « deploiements » et sur la profondeur, par les quatre entrées (plateau, partie, bibliothèque, travail en cours) : jamais acceptés, états inchangés', tailleListe >= 40 && acceptes.length === 0,
      acceptes.slice(0, 8).join(' | '));
    verifier('aucune pollution de Object.prototype, aucun élément injecté', ({}).pollue === undefined && ({}).profondeurExtremite === undefined && ({}).deploiements === undefined && $$('#atelier img, #atelier script').length === 0);
    // Valeurs permises : 1, 2 et 3, y compris écrites en clair à la valeur par défaut.
    var permises = [1, 2, 3].map(function (v) { var o = JSON.parse(reference); o.profondeurExtremite = v; return vp.ouvrirTexte(JSON.stringify(o)) === true && $('#vi-profondeur').value === String(v) && vp.reglages().profondeurExtremite === v; });
    verifier('profondeurs 1, 2 et 3 écrites dans un fichier : acceptées, le réglage affiché suit', permises.every(Boolean), permises.join());

    // Anciens fichiers (premier catalogue) : plateau retouché, bibliothèque, partie.
    verifier('ancien plateau retouché (fixtures-v1/plateau-retouche.json) : ouvert, 67 pièces, bandeau « ancien catalogue », réglage par défaut, relisible', vp.ouvrirTexte(RECETTE_ANCIEN_RETOUCHE) === true && vp.plateau().pieces.length === 67
      && !$('#pl-ancien').hidden && $('#vi-profondeur').value === '2' && !('profondeurExtremite' in vp.plateau()) && !('deploiements' in vp.plateau()) && relisible(vp) && P.modeles(vp.plateau()).length === 1, vp.plateau().pieces.length);
    var texteControles = $('#pl-controles').textContent;
    verifier('ancien plateau retouché, contrôle 1 : « Plateau de l’ancien catalogue : 56 tuiles d’une case… » ; seule la montagne d’une case reste « à prévoir en plus » ; rien sur des pièces de terrain à poser',
      /Plateau de l’ancien catalogue : 56 tuiles d’une case de ce catalogue \(40 × Plaine, 5 × Forêt, 5 × Marais, 6 × Ville \(ancien catalogue\)\)/.test(texteControles)
      && /Tuiles à prévoir en plus du catalogue \(1\) : 1 × Montagne d’une case\./.test(texteControles) && !/Pièces de terrain restantes|pièces? de terrain à poser/.test(texteControles)
      && $('#pl-etape-titre').textContent === 'Plateau de l’ancien catalogue', texteControles.slice(0, 500));
    mode('bibliotheque');
    var avantImport = bib.liste().length;
    verifier('ancienne bibliothèque (fixtures-v1/bibliotheque.json) importée : ses 2 fiches entrent, avec leur résumé', bib.importerTexte(RECETTE_ANCIENNE_BIBLIOTHEQUE) === true && bib.liste().length === avantImport + 2
      && /Plateau retouché/.test($('#bi-liste').textContent) && /Plateau généré/.test($('#bi-liste').textContent), $('#barre-etat').textContent);
    var ficheRetouche = bib.liste().filter(function (x) { return /Plateau retouché/.test(x.nom); })[0];
    clic($('#bi-liste [data-ouvrir="' + ficheRetouche.id + '"]'));
    verifier('fiche « Plateau retouché » de l’ancienne bibliothèque : ouverte, 67 pièces, 7 villes, bandeau affiché', vp.plateau().pieces.length === 67 && P.villes(vp.plateau()).length === 7 && !$('#pl-ancien').hidden
      && vp.plateau().camps.vert.length === 2);
    mode('generer');
    AT.app.montrer('partie');
    verifier('ancienne partie (fixtures-v1/partie.json) : ouverte, 91 cases dessinées, villes de déploiement des rangées extrêmes', vq.ouvrirTexte(RECETTE_ANCIENNE_PARTIE) === true && casesDessinees(vq.vue) === 91
      && vq.etat().plateau.camps.vert.length === 2 && vq.etat().plateau.camps.rouge.length === 2, $('#barre-etat').textContent);
    var ancienne = vq.etat(), joueur = ancienne.actif, libreV = ancienne.plateau.camps[joueur].filter(function (k) { return !ancienne.bataillons[joueur].some(function (b) { return b.case === k; }); })[0];
    if (libreV && $$('[data-main="' + joueur + '"] .at-carte').length) {
      clic($$('[data-main="' + joueur + '"] .at-carte')[0]);
      clicCase(vq.vue, libreV);
      verifier('ancienne partie : on y forme encore un bataillon sur une ville de déploiement', vq.etat().bataillons[joueur].some(function (b) { return b.case === libreV; }), $('#barre-etat').textContent);
    } else lignes.push('INFO  ancienne partie : aucune ville de déploiement libre ou aucune carte en main pour ' + joueur + ' ; formation non essayée');
    AT.app.montrer('plateau');
    verifier('bibliothèque remise à vide', viderBibliotheque());
    vp.ouvrirTexte(reference);
    verifier('réglages remis à leur valeur par défaut', reglagesParDefaut());
    plateauDeReference();
    AT.app.montrer('partie');
  });

  scenario('Testeur C2 : partie fictive (former sur une ville de déploiement, déplacer, événement refusé, capture), exports avec les villes', async function () {
    var vp = AT.app.vues.plateau, vq = AT.app.vues.partie, P = AT.plateau, vue = vq.vue;
    plateauDeReference();
    AT.app.montrer('partie');
    $('#pa-graine').value = '21';
    clic($('#pa-nouvelle'));
    var e = vq.etat(), j = e.actif, autre = j === 'vert' ? 'rouge' : 'vert', camps = e.plateau.camps, NOMS = { vert: 'Vert', rouge: 'Rouge' };
    clic($$('[data-main="' + j + '"] .at-carte')[0]);
    verifier('carte choisie : les 2 villes de déploiement du joueur sont proposées, pas celles de l’adversaire', marques(vue, 'at-admissible') === 2);
    clicCase(vue, camps[j][0]);
    e = vq.etat();
    verifier('bataillon formé sur une ville de déploiement (tuile posée par-dessus une Plaine)', e.bataillons[j][0].case === camps[j][0] && P.cases(e.plateau)[camps[j][0]].ville === 'VD' && P.cases(e.plateau)[camps[j][0]].origine === 'plaine');
    clic($$('[data-main="' + j + '"] .at-carte')[0]);
    clicCase(vue, camps[autre][0]);
    verifier('former sur une ville de déploiement adverse : avertissement, rien n’est fait', !!$('#pa-avertissement') && new RegExp('ville de déploiement de ' + NOMS[j]).test($('#pa-avertissement').textContent)
      && vq.etat().bataillons[j][1].case === null, $('#pa-avertissement') && $('#pa-avertissement').textContent);
    if ($('#pa-renoncer')) clic($('#pa-renoncer'));
    touche('Escape');
    // Marche vers la ville neutre la plus proche, case par case.
    var neutres = P.etatVilles(e.plateau).neutres.map(function (n) { return n.cle; });
    var trajet = neutres.map(function (k) { return P.chemin(e.plateau, camps[j][0], k); }).filter(function (c) { return c.ok; }).sort(function (a, b) { return a.cout - b.cout; })[0];
    var rations = 0, ecarts = [];
    clicCase(vue, camps[j][0]);
    for (var i = 1; i < trajet.cases.length; i++) {
      clicCase(vue, trajet.cases[i]);
      e = vq.etat();
      var lu = /\((\d+) ration\(s\)\)/.exec(e.journal[e.journal.length - 1].texte);
      if (!lu || parseInt(lu[1], 10) !== P.cout(e.plateau, trajet.cases[i]) || e.bataillons[j][0].case !== trajet.cases[i]) ecarts.push(trajet.cases[i]);
      rations += lu ? parseInt(lu[1], 10) : 0;
    }
    var cible = trajet.cases[trajet.cases.length - 1];
    verifier('marche de ' + trajet.pas + ' cases de la ville de déploiement à une ville neutre : pion arrivé, coût de chaque case au journal, total = chemin le moins cher (' + trajet.cout + ' rations)', e.bataillons[j][0].case === cible
      && ecarts.length === 0 && rations === trajet.cout && neutres.indexOf(cible) !== -1, rations + ' / ' + trajet.cout + ' ' + ecarts.join(' '));
    clic($('[data-capture="' + j + '"]'));
    e = vq.etat();
    verifier('capture de la ville neutre : elle est à ' + NOMS[j], e.villes[cible] === j && $('[data-capture="' + j + '"]').disabled);
    touche('Escape');
    clicCase(vue, camps[autre][1]);
    var boutonCapture = $('[data-capture="' + j + '"]');
    if (boutonCapture) clic(boutonCapture);
    e = vq.etat();
    verifier('capture d’une ville de déploiement adverse (table libre) : marquée à ' + NOMS[j] + ', les camps du plateau ne changent pas', !!boutonCapture && e.villes[camps[autre][1]] === j && JSON.stringify(e.plateau.camps) === JSON.stringify(camps));
    touche('Escape');
    // Événement : refusé sur une ville de déploiement, et aucune ville parmi les cases proposées.
    clic($('#pa-piocher-evenement'));
    var id = vq.ui().evenement;
    clicCase(vue, camps[autre][0]);
    e = vq.etat();
    var textes = $('#barre-etat').textContent + ' / ' + (($('#pa-avertissement') || {}).textContent || '');
    var proposees = AT.vuePlateau.casesAdmissibles(e.plateau, id, []);
    verifier('tuile d’événement ' + id + ' refusée sur une ville de déploiement, avec la raison ; aucune ville (déploiement, neutre, centre) parmi les cases proposées', !!id && e.plateau.recouvrements.length === 0
      && /jamais sur une ville de déploiement/.test(textes) && P.villes(e.plateau).every(function (k) { return proposees.indexOf(k) === -1; }), textes);
    if ($('#pa-renoncer')) clic($('#pa-renoncer'));
    if (proposees.length) {
      clicCase(vue, proposees[0]);
      e = vq.etat();
      verifier('la même tuile se pose sur une case permise', e.plateau.recouvrements.length === 1 && e.plateau.recouvrements[0].cle === proposees[0] && e.plateau.deploiements.length === 4, $('#barre-etat').textContent);
    } else if ($('[data-defausser-evenement="' + id + '"]')) clic($('[data-defausser-evenement="' + id + '"]'));
    var textePartie = vq.texteEnregistrement(), etatAvant = JSON.stringify(vq.etat());
    verifier('partie enregistrée puis rouverte : état identique (pions, captures, tuile d’événement, villes de déploiement)', vq.ouvrirTexte(textePartie) === true && JSON.stringify(vq.etat()) === etatAvant && vq.etat().villes[cible] === j);
    AT.app.montrer('plateau');

    // Exports avec les villes posées.
    var image = vp.imageExport(), doc = new DOMParser().parseFromString(image.texte, 'image/svg+xml');
    verifier('export SVG d’un plateau complet : document bien formé, 2 villes de déploiement de Vert et 2 de Rouge (liseré du camp), 2 villes neutres (liseré doré), ni classe ni style',
      !doc.querySelector('parsererror') && doc.querySelectorAll('polygon[stroke="#007A4D"]').length === 2 && doc.querySelectorAll('polygon[stroke="#D8321C"]').length === 2
      && doc.querySelectorAll('circle[stroke="#8A6400"]').length === 2 && !/ class=| style=|at-/.test(image.texte), doc.querySelectorAll('polygon[stroke="#007A4D"]').length);
    telecharges.length = 0;
    clic($('#pl-svg'));
    verifier('« Image SVG » : fichier produit', telecharges.length === 1 && telecharges[0].type === 'image/svg+xml' && telecharges[0].taille === new Blob([image.texte]).size, telecharges.length && telecharges[0].taille);
    var png = await Promise.race([new Promise(function (resoudre) { vp.exporterPng(resoudre); }), attendre(8000).then(function () { return null; })]);
    var couleurs = null;
    if (png) {
      try {
        var adresse = URL.createObjectURL(png);
        var bitmap = await Promise.race([new Promise(function (resoudre, rejeter) {
          var img = new Image();
          img.onload = function () { resoudre(img); };
          img.onerror = function () { rejeter(new Error('image PNG illisible')); };
          img.src = adresse;
        }), attendre(8000).then(function () { throw new Error('délai dépassé'); })]);
        var toile = document.createElement('canvas');
        toile.width = bitmap.naturalWidth; toile.height = bitmap.naturalHeight;
        var contexte = toile.getContext('2d');
        contexte.drawImage(bitmap, 0, 0);
        URL.revokeObjectURL(adresse);
        var points = contexte.getImageData(0, 0, toile.width, toile.height).data, vert = 0, rouge = 0, dore = 0;
        for (var x = 0; x < points.length; x += 4) {
          if (Math.abs(points[x] - 0) < 6 && Math.abs(points[x + 1] - 122) < 6 && Math.abs(points[x + 2] - 77) < 6) vert += 1;
          else if (Math.abs(points[x] - 216) < 6 && Math.abs(points[x + 1] - 50) < 6 && Math.abs(points[x + 2] - 28) < 6) rouge += 1;
          else if (Math.abs(points[x] - 138) < 6 && Math.abs(points[x + 1] - 100) < 6 && Math.abs(points[x + 2] - 0) < 6) dore += 1;
        }
        couleurs = { largeur: toile.width, hauteur: toile.height, vert: vert, rouge: rouge, dore: dore };
      } catch (x2) { couleurs = { erreur: String(x2 && x2.message) }; }
    }
    verifier('« Image PNG » d’un plateau complet : image décodée, et les couleurs des villes y sont (liserés vert, rouge et doré)', !!png && png.size > 5000 && !!couleurs && couleurs.largeur > 400 && couleurs.vert > 50 && couleurs.rouge > 50 && couleurs.dore > 50,
      JSON.stringify(couleurs) + ' ' + (png && png.size));
    verifier('réglages remis à leur valeur par défaut', reglagesParDefaut());
    plateauDeReference();
    AT.app.montrer('partie');
    clic($('#pa-nouvelle'));
  });

  var demonstrationsLotE = {
    creation: function () {
      var vp = AT.app.vues.plateau, vue = vp.vue, C = AT.catalogue;
      plateauDeReference();
      var patron = AT.generateur.generer(12, vp.reglages()).plateau;
      mode('creer');
      clic($('#cr-vierge'));
      // Catalogue 2 : les 15 premiers monoblocs d'un plateau généré, posés par la palette avec leurs rotations.
      var monoblocs = patron.pieces.filter(function (p) { return p.modele !== 'N1' && p.modele !== 'VN'; });
      monoblocs.slice(0, 15).forEach(function (p) {
        clic($('#pl-stock [data-modele="' + p.modele + '"]'));
        for (var i = 0; i < p.rotation; i++) touche('r');
        clicCase(vue, AT.hex.cle(p.q, p.r));
        touche('Escape');
      });
      // La pièce suivante est choisie et survolée à sa place : aperçu vert.
      var suivante = monoblocs[15];
      clic($('#pl-stock [data-modele="' + suivante.modele + '"]'));
      for (var i = 0; i < suivante.rotation; i++) touche('r');
      survolCase(vue, AT.hex.cle(suivante.q, suivante.r));
    },
    villes: function () {
      var vp = AT.app.vues.plateau, vue = vp.vue, V = AT.vueVilles;
      plateauDeReference();
      vp.generer(12);
      var patron = vp.plateau();
      mode('villes');
      clic($('#vi-retirer'));
      // Les deux villes de Vert et une ville neutre sont posées ; Rouge choisit : ses places sont en surbrillance.
      clic($('#vi-outil-vert'));
      patron.camps.vert.forEach(function (k) { clicCase(vue, k); });
      clic($('#vi-outil-neutre'));
      var neutre = patron.pieces.filter(function (p) { return p.modele === 'VN'; })[0];
      clicCase(vue, AT.hex.cle(neutre.q, neutre.r));
      clic($('#vi-outil-rouge'));
      clicCase(vue, patron.camps.rouge[0]);
      vp.vue.svg.blur();
    },
    pinceau: function () {
      var vp = AT.app.vues.plateau, vue = vp.vue;
      demonstrationsLotE.creation();
      touche('Escape');
      mode('pinceau');
      // Quelques tuiles d'une case peintes contre le terrain : hors catalogue, annoncées par le message du pinceau.
      var libres = AT.vueVilles.anneau(vp.plateau());
      clic($('#pi-terrain-marais'));
      glisserCases(vue, libres.slice(0, 3));
      clic($('#pi-terrain-foret'));
      glisserCases(vue, libres.slice(-4));
    },
    monoblocs: function () {
      var vp = AT.app.vues.plateau;
      demonstrationsLotE.creation();
      touche('Escape');
      mode('monoblocs');
      var dessiner = function (cles, terrain, nom, quantite) {
        cles.forEach(function (x) { clic($('#mo-terrain-' + (x[1] || terrain))); $('#mo-grille [data-case="' + x[0] + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
        saisir($('#mo-nom'), nom);
        saisir($('#mo-quantite'), String(quantite));
      };
      dessiner([['0,0'], ['1,0'], ['1,1', 'plaine']], 'foret', 'Orée du bois', 2);
      clic($('#mo-valider'));
      dessiner([['-1,0'], ['0,0'], ['1,0', 'montagne'], ['1,-1', 'montagne']], 'marais', 'Gué de montagne', 1);
      clic($('#mo-valider'));
      dessiner([['-1,1'], ['0,0'], ['1,-1'], ['1,0', 'foret']], 'plaine', 'Clairière', 3);
      vp.vue.svg.blur();
    },
    bibliotheque: function () {
      var vp = AT.app.vues.plateau, bib = vp.bibliotheque;
      plateauDeReference();
      bib.enregistrerSous('Plateau généré, graine 1');
      vp.generer(12);
      bib.enregistrerSous('Plateau généré, graine 12');
      demonstrationsLotE.pinceau();
      bib.enregistrerSous('Mon plateau fait à la main');
      mode('pinceau');
      clic($('#pi-terrain-plaine'));
      clicCase(vp.vue, AT.vueVilles.anneau(vp.plateau())[5]);
      mode('bibliotheque');
    }
  };

  // ================================================================== persistance réelle (recette.html#persistance=ecrire|lire)
  // Deux lancements successifs du navigateur sur le même dossier de profil : le second doit retrouver la
  // bibliothèque et le travail en cours que le premier a enregistrés dans le vrai stockage du navigateur.
  async function persistanceEcrire() {
    var vp = AT.app.vues.plateau, B = AT.bibliotheque, vue = vp.vue;
    var reel = B.stockageNavigateur();
    verifier('stockage réel du navigateur disponible', reel !== null && vp.bibliotheque.stockage() === reel && !vp.bibliotheque.avis(), String(vp.bibliotheque.avis()));
    mode('creer');
    clic($('#cr-vierge'));
    mode('pinceau');
    clic($('#pi-terrain-foret'));
    glisserCases(vue, ['2,-2', '3,-2', '4,-2']);
    verifier('enregistré dans la bibliothèque', vp.bibliotheque.enregistrerSous('Persistance ' + vp.bibliotheque.liste().length) === true);
    clic($('#pi-terrain-marais'));
    glisserCases(vue, ['-2,2', '-3,2']);
    await attendre(1000);
    var travail = B.chargerTravail(reel);
    verifier('travail en cours écrit dans le stockage réel (6 pièces)', travail.ok && !!travail.plateau && travail.plateau.pieces.length === 6, travail.raison);
    lignes.push('PERSISTANCE écriture : adresse ' + window.location.protocol + '//' + window.location.host + ', bibliothèque = ' + B.charger(reel).liste.length + ' fiche(s), travail en cours = '
      + (travail.plateau ? travail.plateau.pieces.length + ' pièces' : 'aucun'));
  }

  function persistanceLire() {
    var vp = AT.app.vues.plateau, B = AT.bibliotheque, reel = B.stockageNavigateur();
    var liste = reel ? B.charger(reel).liste : [];
    lignes.push('PERSISTANCE lecture : adresse ' + window.location.protocol + '//' + window.location.host + ', bibliothèque = ' + liste.length + ' fiche(s) [' + liste.map(function (e) { return e.nom; }).join(' ; ')
      + '], plateau affiché = ' + vp.plateau().pieces.length + ' pièces, barre d’état = « ' + $('#barre-etat').textContent + ' », barre du haut = « ' + $('#at-nom-plateau').textContent + ' »');
    verifier('second lancement : la bibliothèque du premier est retrouvée', liste.length >= 1 && /^Persistance \d+$/.test(liste[0].nom) && liste[0].plateau.pieces.length === 4, liste.length);
    verifier('second lancement : le travail en cours est repris à l’ouverture (6 pièces), avec un message discret', vp.plateau().pieces.length === 6 && /Travail en cours repris \(sauvegardé le \d\d\/\d\d\/\d{4} à \d\d:\d\d\)/.test($('#barre-etat').textContent)
      && /at-etat-info/.test(etatBarre()), $('#barre-etat').textContent);
    verifier('second lancement : l’entrée ouverte est retrouvée, marquée « modifié »', /^Plateau : « Persistance \d+ » \(modifié\)$/.test($('#at-nom-plateau').textContent), $('#at-nom-plateau').textContent);
    verifier('second lancement : plateau repris dessiné (7 + 5 cases)', casesDessinees(vp.vue) === 12, casesDessinees(vp.vue));
  }

  // Catalogue 2 : un plateau généré à 3 rangées (une ville de déploiement en troisième rangée), gardé en fiche de la
  // bibliothèque puis retouché (une ville neutre retirée) : le second lancement doit le reprendre SANS erreur.
  async function persistanceEcrireVilles() {
    var vp = AT.app.vues.plateau, B = AT.bibliotheque, P = AT.plateau, vue = vp.vue;
    var reel = B.stockageNavigateur();
    verifier('stockage réel du navigateur disponible', reel !== null && vp.bibliotheque.stockage() === reel && !vp.bibliotheque.avis(), String(vp.bibliotheque.avis()));
    choisir($('#vi-profondeur'), 3);
    var graine = null;
    for (var g = 1; g <= 40 && !graine; g++) {
      $('#pl-graine').value = String(g);
      clic($('#pl-generer'));
      if ($('#pl-avis').hidden && villesHorsExtremite(vp.plateau(), 2).length) graine = g;
    }
    verifier('plateau généré à 3 rangées, une ville en troisième rangée (graine ' + graine + ') : aucune erreur', !!graine && vp.bilan().erreurs === 0 && vp.plateau().profondeurExtremite === 3);
    verifier('enregistré dans la bibliothèque', vp.bibliotheque.enregistrerSous('Villes profondes ' + vp.bibliotheque.liste().length) === true);
    mode('villes');
    clicCase(vue, P.etatVilles(vp.plateau()).neutres[0].cle);
    await attendre(1000);
    var travail = B.chargerTravail(reel);
    verifier('travail en cours écrit dans le stockage réel : 25 pièces, 4 villes de déploiement, profondeur 3', travail.ok && !!travail.plateau && travail.plateau.pieces.length === 25 && travail.plateau.deploiements.length === 4
      && travail.plateau.profondeurExtremite === 3, travail.raison);
    lignes.push('PERSISTANCE écriture (villes) : adresse ' + window.location.protocol + '//' + window.location.host + ', graine ' + graine + ', bibliothèque = ' + B.charger(reel).liste.length + ' fiche(s), travail en cours = '
      + (travail.plateau ? travail.plateau.pieces.length + ' pièces, profondeur ' + travail.plateau.profondeurExtremite : 'aucun'));
  }

  function persistanceLireVilles() {
    var vp = AT.app.vues.plateau, B = AT.bibliotheque, P = AT.plateau, reel = B.stockageNavigateur();
    var liste = reel ? B.charger(reel).liste : [], fiche = liste.filter(function (x) { return /^Villes profondes \d+$/.test(x.nom); })[0];
    lignes.push('PERSISTANCE lecture (villes) : bibliothèque = ' + liste.length + ' fiche(s) [' + liste.map(function (x) { return x.nom; }).join(' ; ') + '], plateau affiché = ' + vp.plateau().pieces.length + ' pièces, profondeur '
      + vp.plateau().profondeurExtremite + ', ' + vp.bilan().erreurs + ' erreur(s), étape ' + vp.bilan().etape + ', barre d’état = « ' + $('#barre-etat').textContent + ' », barre du haut = « ' + $('#at-nom-plateau').textContent + ' »');
    verifier('second lancement : la fiche à 3 rangées est retrouvée avec sa profondeur et ses 4 villes de déploiement', !!fiche && fiche.plateau.profondeurExtremite === 3 && fiche.plateau.deploiements.length === 4
      && fiche.plateau.pieces.length === 26, liste.length);
    verifier('second lancement : le travail en cours est repris (25 pièces, 6 villes), avec un message discret', vp.plateau().pieces.length === 25 && P.villes(vp.plateau()).length === 6
      && /Travail en cours repris \(sauvegardé le \d\d\/\d\d\/\d{4} à \d\d:\d\d\)/.test($('#barre-etat').textContent), $('#barre-etat').textContent);
    verifier('second lancement : la profondeur de 3 rangées est relue (réglage affiché à 3), la ville de troisième rangée n’est PAS en erreur, il reste une ville neutre à poser',
      vp.plateau().profondeurExtremite === 3 && $('#vi-profondeur').value === '3' && vp.reglages().profondeurExtremite === 3 && villesHorsExtremite(vp.plateau(), 2).length > 0 && vp.bilan().erreurs === 0
      && vp.bilan().etape === 'villes' && /1 ville neutre/.test($('#pl-etape').textContent), $('#pl-bilan').textContent + ' / ' + $('#pl-etape').textContent);
    verifier('second lancement : l’entrée ouverte est retrouvée, marquée « modifié »', /^Plateau : « Villes profondes \d+ » \(modifié\)$/.test($('#at-nom-plateau').textContent), $('#at-nom-plateau').textContent);
    verifier('second lancement : plateau repris dessiné avec ses villes (92 cases, 2 + 2 villes de déploiement au liseré du camp)', casesDessinees(vp.vue) === 92 && $$('polygon[stroke="#007A4D"]', vp.vue.svg).length === 2
      && $$('polygon[stroke="#D8321C"]', vp.vue.svg).length === 2, casesDessinees(vp.vue));
  }

  // ================================================================== G. état de démonstration (pour les captures d'écran)
  function demonstration() {
    var vq = AT.app.vues.partie, vue = vq.vue;
    $('#pa-graine').value = '12';
    clic($('#pa-nouvelle'));
    var e = vq.etat();
    ['vert', 'rouge'].forEach(function (j, rang) {
      if (rang === 1) clic($('#pa-fin-tour'));
      clic($$('[data-main="' + j + '"] .at-carte')[0]);
      clic($('[data-former="' + e.plateau.camps[j][0] + '"]'));
      clic($$('[data-main="' + j + '"] .at-carte')[0]);
      clic($('[data-former="' + e.plateau.camps[j][1] + '"]'));
    });
    clic($('[data-campement="rouge"]'));
    $('#pa-nb-des').value = '3';
    clic($('#pa-lancer'));
    clicCase(vue, vq.etat().plateau.camps.rouge[0]);
  }

  // ================================================================== lancement
  window.addEventListener('load', async function () {
    var rapport = document.getElementById('rapport');
    if (window.AT && AT.app) AT.app.telechargement = function (nom, blob) { telecharges.push({ nom: nom, type: blob.type, taille: blob.size }); };
    if (persistance) {
      // Vérification du vrai stockage du navigateur : ce seul scénario, rien d'autre.
      scenarios = [{ nom: 'Persistance réelle (' + persistance[1] + ')', f: { ecrire: persistanceEcrire, lire: persistanceLire, 'ecrire-villes': persistanceEcrireVilles, 'lire-villes': persistanceLireVilles }[persistance[1]] }];
    }
    // recette.html#seul=<texte> : seulement « Démarrage » et les scénarios dont le nom contient ce texte (mise au point).
    var seul = /seul=([^&]+)/.exec(window.location.hash);
    if (seul && !persistance) {
      var motif = decodeURIComponent(seul[1]).toLowerCase();
      scenarios = scenarios.filter(function (s, rangScenario) { return rangScenario === 0 || s.nom.toLowerCase().indexOf(motif) !== -1; });
      lignes.push('INFO  scénarios limités à « ' + motif + ' » : ' + scenarios.length + ' sur le total ; le TOTAL ci-dessous n’est pas celui de la recette complète');
    }
    for (var i = 0; i < scenarios.length; i++) {
      var debutScenario = Date.now();
      lignes.push('— ' + scenarios[i].nom);
      try { await scenarios[i].f(); } catch (e) { verifier(scenarios[i].nom + ' : exception', false, (e && e.stack) || e); }
      durees.push(Math.round((Date.now() - debutScenario) / 100) / 10 + ' s : ' + scenarios[i].nom.slice(0, 60));
    }
    lignes.push('— Sécurité et erreurs');
    verifier('aucun attribut style dans la page', $$('#atelier [style]').length === 0, $$('#atelier [style]').length);
    verifier('aucune violation de la politique de sécurité (CSP)', violations.length === 0, violations.join(' | '));
    verifier('aucune erreur JavaScript', erreursJs.length === 0, erreursJs.join(' | '));
    var arret = /arret=(plateau|inventaire|partie|creation|pinceau|villes|monoblocs|bibliotheque)/.exec(window.location.hash);
    if (arret) {
      try {
        if (arret[1] === 'partie') demonstration();
        if (demonstrationsLotE[arret[1]]) { demonstrationsLotE[arret[1]](); arret[1] = 'plateau'; }
        AT.app.montrer(arret[1]);
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();      // capture sans curseur du clavier
        document.getElementById('recette').hidden = true;
      } catch (e) { lignes.push('Démonstration impossible : ' + e.message); }
    }
    if (/durees/.test(window.location.hash)) durees.forEach(function (d) { lignes.push('DURÉE ' + d); });      // recette.html#durees : temps réel de chaque scénario
    lignes.push('TOTAL : ' + ok + ' OK, ' + echecs + ' ÉCHEC');
    rapport.textContent = lignes.join('\n');
  });
})();
