/*
 * recette.js : recette automatique de l'atelier dans un vrai navigateur (outils/recette.html).
 * Charge l'atelier tel quel (même CSP), exerce les parcours principaux par de vrais événements
 * (clics, touches, survols) et écrit une dernière ligne « TOTAL : N OK, M ÉCHEC ».
 * Une erreur JavaScript ou une violation de la politique de sécurité compte comme un échec.
 * Rien n'est écrit sur le disque : les téléchargements sont interceptés.
 *
 * Paramètre d'adresse : recette.html#arret=plateau|inventaire|partie laisse cet onglet affiché à la fin
 * et masque le rapport (pour une capture d'écran d'un état « en cours d'usage »).
 */
(function () {
  'use strict';

  var ok = 0, echecs = 0, lignes = [], erreursJs = [], violations = [], telecharges = [];

  window.addEventListener('error', function (ev) { erreursJs.push((ev.message || 'erreur') + ' (' + String(ev.filename || '').split('/').pop() + ':' + ev.lineno + ')'); });
  window.addEventListener('unhandledrejection', function (ev) { erreursJs.push('promesse rejetée : ' + (ev.reason && ev.reason.message || ev.reason)); });
  document.addEventListener('securitypolicyviolation', function (ev) { violations.push(ev.violatedDirective + ' ' + (ev.blockedURI || '') + ' ' + String(ev.sourceFile || '').split('/').pop() + ':' + ev.lineNumber); });

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

  var scenarios = [];
  function scenario(nom, f) { scenarios.push({ nom: nom, f: f }); }

  // ================================================================== A. démarrage
  scenario('Démarrage', function () {
    var vp = AT.app.vues.plateau;
    verifier('trois onglets', $$('[role="tab"]').length === 3);
    verifier('onglet Plateau affiché', AT.app.ongletActif() === 'plateau' && !$('#panneau-plateau').hidden && $('#panneau-partie').hidden);
    verifier('plateau généré au démarrage : 64 pièces', vp.plateau().pieces.length === 64, vp.plateau().pieces.length);
    verifier('91 cases dessinées', $$('svg > g:first-of-type > g:first-child > polygon', vp.vue.parentSvg || vp.vue.svg.parentNode).length === 91, $$('svg > g:first-of-type > g:first-child > polygon', vp.vue.parentSvg || vp.vue.svg.parentNode).length);
    verifier('12 motifs de terrain définis', $$('pattern', vp.vue.svg).length === 12, $$('pattern', vp.vue.svg).length);
    verifier('aucune erreur aux contrôles', vp.bilan().erreurs === 0 && /aucune erreur/i.test($('#pl-bilan').textContent), $('#pl-bilan').textContent);
    verifier('les 7 contrôles sont listés', $$('#pl-controles .at-regle').length === 7);
    verifier('seuil et mesure de contact initialisés depuis les réglages du catalogue', $('#pl-seuil').value === String(AT.catalogue.REGLAGES.seuilContact) && $('#pl-mesure').value === AT.catalogue.REGLAGES.mesureContact
      && vp.reglages().seuilContact === AT.catalogue.REGLAGES.seuilContact && vp.reglages().mesureContact === AT.catalogue.REGLAGES.mesureContact, $('#pl-seuil').value + ' / ' + $('#pl-mesure').value);
    verifier('au moins un constat par contrôle', $$('#pl-controles .at-constat').length >= 7);
    verifier('tableau d’équilibre : 7 villes', $$('#pl-equilibre tbody tr').length === 7);
    verifier('score d’équilibre affiché', /Score d’équilibre : 0/.test($('#pl-score').textContent), $('#pl-score').textContent);
    verifier('répartition des terrains : 3 lignes', $$('#pl-terrains tbody tr').length === 3);
    verifier('légende : 5 terrains, 8 événements, 4 repères', $$('#pl-legende .at-legende-item').length === 17, $$('#pl-legende .at-legende-item').length);
    verifier('7 villes numérotées sur le plateau', [1, 2, 3, 4, 5, 6, 7].every(function (n) {
      return $$('text', vp.vue.svg).some(function (t) { return t.textContent === String(n); });
    }));
    verifier('villes de déploiement aux couleurs des camps', $$('circle[fill="#007A4D"]', vp.vue.svg).length === 2 && $$('circle[fill="#D8321C"]', vp.vue.svg).length === 2);
    verifier('contours épais : 8 monoblocs et le noyau', $$('path[stroke-width="4"]', vp.vue.svg).length === 8 && $$('path[stroke-width="6"]', vp.vue.svg).length === 1,
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
    choisir($('#pl-seuil'), 3);
    choisir($('#pl-mesure'), 'cotes');
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
    var plaine = vp.plateau().pieces.filter(function (p) { return p.modele === 'P'; })[0];
    var cle = AT.hex.cle(plaine.q, plaine.r);
    clicCase(vue, cle);
    verifier('clic sur une case : la pièce est sélectionnée', vp.etat().selection === plaine.id && marques(vue, 'at-selection') === 1, vp.etat().selection);
    clic($('#pl-retirer'));
    verifier('retirer : 63 pièces', vp.plateau().pieces.length === 63);
    verifier('retirer : la plaine revient au stock', /Plaine × 1/.test($('#pl-stock [data-modele="P"]').textContent));
    verifier('retirer : les contrôles signalent le changement en direct', /Pièces restantes \(1\)/.test($('#pl-controles').textContent) && vp.bilan().alertes + vp.bilan().erreurs > 0);
    clic($('#pl-stock [data-modele="P"]'));
    verifier('choix d’une pièce du stock', vp.etat().aPoser && vp.etat().aPoser.modele === 'P' && $('#pl-stock [data-modele="P"]').getAttribute('aria-pressed') === 'true');
    survolCase(vue, cle);
    verifier('aperçu fantôme sous la souris', marques(vue, 'at-fantome') === 1 && marques(vue, 'at-fantome-refus') === 0);
    survolCase(vue, '0,0');
    verifier('aperçu fantôme rouge sur une case occupée', marques(vue, 'at-fantome-refus') === 1);
    clicCase(vue, '0,0');
    verifier('pose refusée sur une case occupée, avec explication', vp.plateau().pieces.length === 63 && /at-etat-erreur/.test(etatBarre()) && /Chevauchement/.test($('#barre-etat').textContent));
    clicCase(vue, cle);
    verifier('pose : 64 pièces, plus d’erreur', vp.plateau().pieces.length === 64 && vp.bilan().erreurs === 0);
    touche('z', { ctrlKey: true });
    verifier('Ctrl+Z annule la pose', vp.plateau().pieces.length === 63);
    touche('y', { ctrlKey: true });
    verifier('Ctrl+Y la rétablit', vp.plateau().pieces.length === 64);
    clic($('#pl-annuler'));
    clic($('#pl-retablir'));
    verifier('boutons Annuler / Rétablir', vp.plateau().pieces.length === 64 && $('#pl-retablir').disabled);

    // Vider, puis reconstruire à la main : noyau, montagne tournée, déplacement.
    clic($('#pl-vider'));
    verifier('vider le plateau : 0 pièce, 13 modèles au stock', vp.plateau().pieces.length === 0 && $$('#pl-stock [data-modele]').length === 13);
    clic($('#pl-stock [data-modele="N1"]'));
    survolCase(vue, '0,0');
    verifier('fantôme du noyau : 7 cases', marques(vue, 'at-fantome') === 7);
    clicCase(vue, '0,0');
    verifier('noyau posé (7 cases) et retiré du stock', Object.keys(P.cases(vp.plateau())).length === 7 && !$('#pl-stock [data-modele="N1"]'));
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
    clicCase(vue, cle); clic($('#pl-retirer'));
    var villeEpinglee = vp.plateau().pieces.filter(function (p) { return p.modele === 'V'; })[0];
    clicCase(vue, AT.hex.cle(villeEpinglee.q, villeEpinglee.r)); clic($('#pl-retirer'));
    clic($$('#pl-controles button.at-constat[data-niveau="erreur"]')[0]);
    var epinglees = marques(vue, 'at-surbrillance');
    clic($('#pl-stock [data-modele="P"]')); clicCase(vue, cle);
    verifier('surbrillance épinglée effacée dès que le plateau change', epinglees > 0 && marques(vue, 'at-surbrillance') === 0, epinglees);
    touche('Escape');
    $('#pl-graine').value = '1';
    clic($('#pl-generer'));

    var ville = vp.plateau().pieces.filter(function (p) { return p.modele === 'V'; })[0];
    clicCase(vue, AT.hex.cle(ville.q, ville.r));
    clic($('#pl-retirer'));
    var constat = $$('#pl-controles button.at-constat[data-niveau="erreur"]')[0];
    verifier('ville retirée : erreur avec cases à montrer', !!constat && vp.bilan().erreurs > 0);
    constat.dispatchEvent(new MouseEvent('mouseenter'));
    var surlignees = marques(vue, 'at-surbrillance');
    constat.dispatchEvent(new MouseEvent('mouseleave'));
    verifier('survol d’un constat : cases en surbrillance, puis effacées', surlignees > 0 && marques(vue, 'at-surbrillance') === 0, surlignees);
    clic(constat);
    verifier('clic sur un constat : surbrillance épinglée', marques(vue, 'at-surbrillance') === surlignees && !!$('#pl-controles button.at-constat[aria-pressed="true"]'));
    clic($('#pl-annuler'));
    verifier('annuler : plateau de nouveau conforme', vp.bilan().erreurs === 0 && vp.plateau().pieces.length === 64);

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
    verifier('export SVG : 91 cases, 12 motifs', doc.querySelectorAll('svg > g:first-of-type > g:first-child > polygon').length === 91 && doc.querySelectorAll('pattern').length === 12);
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
    var P = AT.plateau, pl = vp.plateau(), cases = P.cases(pl);
    var rangeeHaut = Math.min.apply(null, Object.keys(cases).map(function (k) { return AT.hex.decle(k).r; }));
    var haut = Object.keys(cases).filter(function (k) { return AT.hex.decle(k).r === rangeeHaut && cases[k].modele === 'P'; })[0];
    var neutre = P.villes(pl).filter(function (k) { return k !== '0,0' && pl.camps.vert.indexOf(k) === -1 && pl.camps.rouge.indexOf(k) === -1; })[0];
    verifier('plateau de référence : une plaine sur la rangée du haut et une ville neutre', !!haut && !!neutre, haut + ' / ' + neutre);
    clicCase(vp.vue, haut); clic($('#pl-retirer'));
    clicCase(vp.vue, neutre); clic($('#pl-retirer'));
    clic($('#pl-stock [data-modele="V"]')); clicCase(vp.vue, haut);
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
    verifier('13 modèles de pièces, tous dessinés', $$('#inv-pieces tbody tr').length === 13 && $$('#inv-pieces tbody svg').length === 13);
    verifier('totaux : 64 pièces, 91 cases', /64 pièces, 91 cases/.test($('#inv-totaux').textContent), $('#inv-totaux').textContent);
    verifier('quantités posées sur le plateau courant', /64 pièces posées \(91 cases\), 0 restantes/.test($('#inv-totaux').textContent));
    verifier('répartition affichée', /53 plaines \(70,7 %\)/.test($('#inv-repartition').textContent) && /11 forêts \(14,7 %\)/.test($('#inv-repartition').textContent), $('#inv-repartition').textContent);
    var plaines = $('#inv-pieces [data-modele="P"]').querySelectorAll('td.at-nombre');
    verifier('plaine : 39 au total, 39 posées, 0 restante', plaines[0].textContent === '39' && plaines[1].textContent === '39' && plaines[2].textContent === '0');
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
    verifier('plateau de la partie dessiné', $$('svg > g:first-of-type > g:first-child > polygon', vue.svg.parentNode).length === 91);

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
        var bon = String(pl.graine) === g && vp.bilan().erreurs === 0 && pl.pieces.length === 64 && casesDessinees(vp.vue) === 91
          && pl.camps.vert.length === 2 && pl.camps.rouge.length === 2 && $('#pl-avis').hidden && relisible(vp)
          && JSON.stringify(vp.plateau()) === premier && P.villes(pl).length === 7;
        if (!bon) mauvais.push(g + ' (seuil ' + seuil + ') : ' + $('#barre-etat').textContent + ' ' + $('#pl-bilan').textContent);
        differents[premier.replace(/"graine":[^,]*,/, '')] = true;
      });
    });
    verifier('6 graines × 2 seuils : 64 pièces, 91 cases, 7 villes, 2 + 2 villes de déploiement, aucune erreur, fichier relisible, même graine = même plateau', mauvais.length === 0, mauvais.join(' | '));
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
    verifier('deux villes sur la rangée du haut : ce sont les villes de déploiement de Vert', poser('V', '-1,-3') && poser('V', '3,-3')
      && JSON.stringify(vp.plateau().camps.vert) === JSON.stringify(['-1,-3', '3,-3']), JSON.stringify(vp.plateau().camps));
    verifier('troisième ville sur la même rangée : aucune désignée, erreur « à égalité » affichée', poser('V', '1,-3') && vp.plateau().camps.vert.length === 0
      && /3 villes à égalité sur la rangée du haut/.test($('#pl-controles').textContent), JSON.stringify(vp.plateau().camps));
    telecharges.length = 0;
    clic($('#pl-enregistrer'));
    var ambigu = vp.texteEnregistrement();
    verifier('plateau en cours de retouche avec 3 villes en haut : enregistré et rouvert', telecharges.length === 1 && vp.ouvrirTexte(ambigu) === true && vp.plateau().pieces.length === 4);
    clicCase(vue, '1,-3');
    touche('Delete');
    verifier('ville en trop retirée : les deux villes de déploiement reviennent', JSON.stringify(vp.plateau().camps.vert) === JSON.stringify(['-1,-3', '3,-3']) && !/à égalité/.test($('#pl-controles').textContent));
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
    verifier('plaine posée contre le bois', poser('P', '2,0'));
    bois = vp.plateau().pieces.filter(function (p) { return p.modele === 'F3'; })[0];
    clicCase(vue, P.casesPiece(bois)[0].cle);
    clic($('#pl-deplacer'));
    clicCase(vue, '0,0');
    verifier('déplacement d’un monobloc sur le noyau : refusé, la pièce ne bouge pas', /Déplacement refusé/.test($('#barre-etat').textContent)
      && JSON.stringify(vp.plateau().pieces.filter(function (p) { return p.modele === 'F3'; })[0]) === JSON.stringify(bois), $('#barre-etat').textContent);
    clicCase(vue, '-2,4');
    var boisApres = vp.plateau().pieces.filter(function (p) { return p.modele === 'F3'; })[0];
    verifier('déplacement d’un monobloc vers une place libre : 3 cases déplacées, rotation gardée', boisApres.q === -2 && boisApres.r === 4 && boisApres.rotation === bois.rotation && vp.plateau().pieces.length === 8, JSON.stringify(boisApres) + ' ' + $('#barre-etat').textContent);
    touche('Delete');
    verifier('retrait d’un monobloc : il revient au stock', vp.plateau().pieces.length === 7 && !!$('#pl-stock [data-modele="F3"]'), vp.plateau().pieces.length);
    // Épuisement du stock : les 6 villes.
    var villesPosees = [poser('V', '-3,4'), poser('V', '0,5'), poser('V', '6,0'), poser('V', '-6,0')];
    verifier('6 villes posées : le modèle « Ville » disparaît du stock', villesPosees.every(Boolean) && !$('#pl-stock [data-modele="V"]') && P.stock(vp.plateau()).V.restant === 0, villesPosees.join());
    verifier('contrôles en direct sur un plateau partiel : inventaire en alerte, villes trop proches ou contact signalés', /Pièces restantes/.test($('#pl-controles').textContent) && vp.bilan().erreurs > 0);
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
      'version inconnue': mute(function (o) { o.version = 2; }),
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
    verifier('identifiants de pièce « constructor », « toString »… : plateau ouvert et dessiné en entier', ouvert === true && casesDessinees(vp.vue) === 91 && vp.bilan().erreurs === 0, casesDessinees(vp.vue));
    AT.app.montrer('partie');
    clic($('#pa-nouvelle'));
    verifier('partie sur ce plateau : créée et dessinée', casesDessinees(vq.vue) === 91 && vq.etat().plateau.pieces[0].id === 'constructor', casesDessinees(vq.vue));
    AT.app.montrer('plateau');
    vp.ouvrirTexte(bon);
    // Fichiers au bon format mais au contenu fautif : ouverts, dessinés, et les contrôles disent ce qui ne va pas.
    var chevauche = mute(function (o) { o.pieces[1].q = o.pieces[0].q; o.pieces[1].r = o.pieces[0].r; o.pieces[1].modele = 'N1'; });
    verifier('fichier valide avec chevauchement et stock dépassé : ouvert, erreurs affichées', vp.ouvrirTexte(chevauche) === true && /Chevauchement/.test($('#pl-controles').textContent) && /Stock dépassé/.test($('#pl-controles').textContent));
    var disperse = mute(function (o) { o.pieces = o.pieces.slice(0, 3); o.pieces[2].q = 30; o.pieces[2].r = -30; o.camps = { vert: ['30,-30'], rouge: [] }; o.recouvrements = [{ evenement: 'E3', cle: '-30,30' }]; });
    verifier('fichier valide très dispersé, tuile d’événement hors plateau : ouvert sans erreur JavaScript, signalé', vp.ouvrirTexte(disperse) === true && vp.bilan().erreurs > 0 && /mal posé/.test($('#pl-controles').textContent), $('#barre-etat').textContent);
    AT.app.montrer('partie');
    var partieAvant = JSON.stringify(vq.etat());
    clic($('#pa-nouvelle'));
    verifier('partie sur ce plateau fautif : créée sans la tuile d’essai, erreurs du plateau rappelées', /erreur\(s\) aux contrôles/.test($('#barre-etat').textContent) && JSON.stringify(vq.etat()) !== partieAvant && vq.etat().plateau.recouvrements.length === 0, $('#barre-etat').textContent);
    AT.app.montrer('plateau');
    var videTexte = mute(function (o) { o.pieces = []; o.camps = { vert: [], rouge: [] }; });
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

    // Trou : une plaine entourée retirée puis reposée au bord (toutes les pièces posées, aucune erreur, une alerte).
    var cases = P.cases(vp.plateau());
    var entouree = Object.keys(cases).filter(function (k) { return cases[k].modele === 'P' && AT.hex.voisines(k).every(function (v) { return !!cases[v]; }); })[0];
    verifier('plateau généré : le contrôle 2 annonce « aucun trou »', /aucun trou/.test($('#pl-controles').textContent) && !!entouree);
    clicCase(vue, entouree);
    touche('Delete');
    var constatTrou = $$('#pl-controles button.at-constat[data-regle="continuite"]').filter(function (b) { return /trou/i.test(b.textContent); })[0];
    verifier('plaine entourée retirée : le contrôle 2 signale un trou, en alerte et non en erreur', !!constatTrou && constatTrou.getAttribute('data-niveau') === 'alerte'
      && /Un trou dans le plateau : 1 case vide entourée/.test(constatTrou.textContent), constatTrou && constatTrou.textContent);
    constatTrou.dispatchEvent(new MouseEvent('mouseenter'));
    verifier('survol du constat : la case du trou est en surbrillance (une case vide)', marques(vue, 'at-surbrillance') === 1);
    constatTrou.dispatchEvent(new MouseEvent('mouseleave'));
    choisir($('#pl-seuil'), 2);       // au seuil 2, une tuile peut tenir au bord avec deux voisines
    var libres = [];
    Object.keys(P.cases(vp.plateau())).forEach(function (k) { AT.hex.voisines(k).forEach(function (v) { if (!P.cases(vp.plateau())[v] && v !== entouree && libres.indexOf(v) === -1) libres.push(v); }); });
    var place = libres.filter(function (v) { var c = AT.hex.decle(v), r = P.poser(vp.plateau(), 'P', c.q, c.r, 0); return r.ok && AT.controles.tout(P.avecCamps(r.plateau), vp.reglages()).ok; })[0];
    clic($('#pl-stock [data-modele="P"]'));
    clicCase(vue, place);
    verifier('plaine reposée au bord : 64 pièces, aucune erreur, mais le trou reste signalé en alerte', vp.plateau().pieces.length === 64 && vp.bilan().erreurs === 0 && vp.bilan().alertes >= 1
      && /Aucune erreur, \d+ alerte/.test($('#pl-bilan').textContent) && /Un trou dans le plateau/.test($('#pl-controles').textContent), place + ' ' + $('#pl-bilan').textContent);
    var ids = vp.plateau().pieces.map(function (p) { return p.id; });
    verifier('aucun identifiant de pièce en double après retrait et pose', ids.filter(function (id, i) { return ids.indexOf(id) !== i; }).length === 0);
    var niveau = C.REGLAGES.trous;
    C.REGLAGES.trous = 'erreur';
    choisir($('#pl-affichage'), 'rien');
    var enErreur = vp.bilan().erreurs;
    C.REGLAGES.trous = 'ignore';
    choisir($('#pl-affichage'), 'rien');
    var ignore = !/trou/i.test($('#pl-controles').textContent) && vp.bilan().erreurs === 0;
    C.REGLAGES.trous = niveau;
    choisir($('#pl-affichage'), 'rien');
    verifier('réglage « trous » : erreur, puis ignoré, puis de nouveau alerte', enErreur === 1 && ignore && /Un trou dans le plateau/.test($('#pl-controles').textContent), enErreur);
    choisir($('#pl-seuil'), 3);
    while (vp.etat().rang > rang) touche('z', { ctrlKey: true });
    verifier('retour au plateau généré', JSON.stringify(vp.plateau()) === depart && vp.bilan().erreurs === 0);

    // Générateur : catalogue hors de ce qu'il sait poser → échec immédiat, cause nommée, pas de conseil trompeur.
    var villes = C.MODELES.V.nombre, plaines = C.MODELES.P.nombre;
    C.MODELES.V.nombre = 8; C.MODELES.P.nombre = plaines - 2;
    try { clic($('#pl-generer')); } finally { C.MODELES.V.nombre = villes; C.MODELES.P.nombre = plaines; }
    verifier('catalogue à 8 villes : la génération échoue tout de suite en nommant la cause', !$('#pl-avis').hidden && /8 villes d’une case, or le générateur en pose 6/.test($('#pl-avis').textContent)
      && !/Essayez la graine suivante/.test($('#pl-avis').textContent) && JSON.stringify(vp.plateau()) === depart, $('#pl-avis').textContent);
    clic($('#pl-generer'));
    verifier('catalogue rétabli : la génération reprend', $('#pl-avis').hidden && vp.bilan().erreurs === 0 && vp.plateau().pieces.length === 64);

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
    for (var i = 0; i < scenarios.length; i++) {
      lignes.push('— ' + scenarios[i].nom);
      try { await scenarios[i].f(); } catch (e) { verifier(scenarios[i].nom + ' : exception', false, (e && e.stack) || e); }
    }
    lignes.push('— Sécurité et erreurs');
    verifier('aucun attribut style dans la page', $$('#atelier [style]').length === 0, $$('#atelier [style]').length);
    verifier('aucune violation de la politique de sécurité (CSP)', violations.length === 0, violations.join(' | '));
    verifier('aucune erreur JavaScript', erreursJs.length === 0, erreursJs.join(' | '));
    var arret = /arret=(plateau|inventaire|partie)/.exec(window.location.hash);
    if (arret) {
      try {
        if (arret[1] === 'partie') demonstration();
        AT.app.montrer(arret[1]);
        document.getElementById('recette').hidden = true;
      } catch (e) { lignes.push('Démonstration impossible : ' + e.message); }
    }
    lignes.push('TOTAL : ' + ok + ' OK, ' + echecs + ' ÉCHEC');
    rapport.textContent = lignes.join('\n');
  });
})();
