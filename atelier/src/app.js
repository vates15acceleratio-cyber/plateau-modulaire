/*
 * app.js : coquille de l'atelier (lot C). Construit la page dans un conteneur vide, gère les trois onglets,
 * la barre d'état, les fichiers (enregistrer / ouvrir) et les raccourcis du clavier.
 * Chargé en dernier : dépend de AT.rendu et des vues (AT.vuePlateau, AT.vueInventaire, AT.vuePartie).
 *
 * La page comprend des paramètres d'adresse, utiles pour les captures d'écran et la recette :
 *   index.html#onglet=plateau|inventaire|partie&graine=12&partie=5&mode=creer
 *   (graine : génère ce plateau au démarrage ; partie : ouvre une partie fictive avec cette graine ;
 *    mode : generer | creer | pinceau | villes | monoblocs | bibliotheque, mode de l'onglet Plateau).
 *
 * Au démarrage, sans paramètre « graine », le travail en cours sauvegardé dans le navigateur est repris
 * (vue-bibliotheque.js) ; sinon, ou avec « graine », un plateau est généré.
 * Avec « graine », le travail sauvegardé n'est PAS remplacé tant que l'utilisateur n'a rien modifié : la sauvegarde
 * automatique n'écrit qu'après un changement (revue, M1).
 * AT.app.stockage (facultatif, à poser avant le démarrage) remplace le stockage du navigateur : la recette
 * automatique y met un stockage en mémoire pour ne jamais toucher à la bibliothèque du poste.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  var ONGLETS = [
    { id: 'plateau', nom: 'Plateau' },
    { id: 'inventaire', nom: 'Inventaire' },
    { id: 'partie', nom: 'Partie fictive' }
  ];

  // ------------------------------------------------------------------ logique pure (testée sous Node)

  /**
   * Graine saisie dans un champ : un texte fait de chiffres seuls devient un entier (« 12 » et 12 donnent
   * ainsi le même plateau) ; tout autre texte reste une chaîne (64 caractères au plus) ; vide = null.
   */
  function graineSaisie(texte) {
    var t = String(texte === undefined || texte === null ? '' : texte).trim();
    if (!t) return null;
    if (/^[0-9]{1,9}$/.test(t)) return parseInt(t, 10);
    return t.slice(0, 64);
  }

  /** Graine suivante : l'entier suivant, ou 1 si la graine n'est pas un entier. */
  function graineSuivante(graine) {
    return (typeof graine === 'number' && graine < 999999999) ? graine + 1 : 1;
  }

  var MODES_PLATEAU = ['generer', 'creer', 'pinceau', 'villes', 'monoblocs', 'bibliotheque'];

  /** Paramètres de l'adresse (« #onglet=partie&graine=12 ») : {onglet, graine, partie, mode}, null si absent ou invalide. */
  function lireParametres(hash) {
    var res = { onglet: null, graine: null, partie: null, mode: null };
    String(hash || '').replace(/^#/, '').split('&').forEach(function (morceau) {
      var i = morceau.indexOf('=');
      if (i < 1) return;
      var nom = morceau.slice(0, i), valeur;
      try { valeur = decodeURIComponent(morceau.slice(i + 1)); } catch (e) { return; }
      if (nom === 'onglet' && ONGLETS.some(function (o) { return o.id === valeur; })) res.onglet = valeur;
      if (nom === 'graine') res.graine = graineSaisie(valeur);
      if (nom === 'partie') res.partie = graineSaisie(valeur);
      if (nom === 'mode' && MODES_PLATEAU.indexOf(valeur) !== -1) res.mode = valeur;
    });
    return res;
  }

  /** Morceau de nom de fichier sans caractère gênant. */
  function nomSur(texte) {
    return String(texte).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40) || 'sans-nom';
  }

  AT.app = { ONGLETS: ONGLETS, graineSaisie: graineSaisie, graineSuivante: graineSuivante, lireParametres: lireParametres, nomSur: nomSur };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.app;
  if (typeof document === 'undefined') return;

  // ------------------------------------------------------------------ interface

  var el = AT.rendu.el;
  var vues = {}, boutons = {}, panneaux = {}, actif = null, barreEtat = null;
  var nomPlateau = null, etatSauvegarde = null, dialogueConfirmation = null;

  /** Message dans la barre d'état (lue par les lecteurs d'écran). niveau : 'info' | 'alerte' | 'erreur'. */
  function message(texte, niveau) {
    if (!barreEtat) return;
    barreEtat.textContent = texte || '';
    barreEtat.className = 'at-etat at-etat-' + (niveau || 'info');
  }

  /**
   * Enregistre un fichier sur le poste (lien de téléchargement sur une adresse blob:).
   * La recette automatique remplace AT.app.telechargement pour ne rien écrire sur le disque.
   */
  function telechargement(nom, blob) {
    var url = URL.createObjectURL(blob), a = el('a', { href: url, download: nom });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function telecharger(nom, contenu, type) {
    var blob = (typeof Blob !== 'undefined' && contenu instanceof Blob) ? contenu : new Blob([contenu], { type: type || 'application/octet-stream' });
    AT.app.telechargement(nom, blob);
    message('Fichier enregistré : ' + nom, 'info');
  }

  /** Demande un fichier à l'utilisateur et passe son texte à rappel(texte, nom). */
  function ouvrirFichier(rappel) {
    var champ = el('input', { type: 'file', accept: '.json,application/json' });
    champ.addEventListener('change', function () {
      var fichier = champ.files && champ.files[0];
      if (!fichier) return;
      if (fichier.size > 6000000) { message('Fichier trop volumineux.', 'erreur'); return; }
      var lecteur = new FileReader();
      lecteur.onload = function () { rappel(String(lecteur.result), fichier.name); };
      lecteur.onerror = function () { message('Fichier illisible.', 'erreur'); };
      lecteur.readAsText(fichier);
    });
    champ.click();
  }

  /**
   * Nom du plateau courant et état de la sauvegarde automatique, dans la barre du haut (jamais dans la barre
   * d'état, réservée aux messages des actions). info : {nom (null = pas dans la bibliothèque), modifie, sauvegarde, niveau}.
   */
  function indiquerPlateau(info) {
    if (!nomPlateau) return;
    nomPlateau.textContent = info.nom ? 'Plateau : « ' + info.nom + ' »' + (info.modifie ? ' (modifié)' : '') : 'Plateau : sans nom';
    nomPlateau.title = info.nom ? 'Plateau de la bibliothèque ouvert' + (info.modifie ? ', modifié depuis son enregistrement' : '') : 'Ce plateau n’est pas enregistré dans la bibliothèque (mode « Bibliothèque »)';
    etatSauvegarde.textContent = info.sauvegarde || '';
    etatSauvegarde.className = 'at-sauvegarde' + (info.niveau === 'erreur' ? ' at-sauvegarde-erreur' : '');
  }

  /**
   * Fenêtre de confirmation de la page (jamais confirm(), qui bloque). rappel() n'est appelé que sur « oui ».
   * Au clavier : Tab entre les deux boutons, Entrée valide le bouton actif, Échap renonce.
   */
  function confirmer(texte, libelle, rappel) {
    var d = dialogueConfirmation;
    if (!d) return;
    var fermer = function () { if (typeof d.close === 'function' && d.open) d.close(); else d.removeAttribute('open'); };
    var non = el('button', { type: 'button', id: 'at-confirmer-non', texte: 'Renoncer', sur: { click: fermer } });
    var oui = el('button', { type: 'button', id: 'at-confirmer-oui', classe: 'at-principal-bouton', texte: libelle || 'Confirmer', sur: { click: function () { fermer(); rappel(); } } });
    var question = el('p', { id: 'at-confirmation-texte' });
    question.textContent = texte;
    AT.rendu.vider(d);
    d.appendChild(question);
    d.appendChild(el('div', { classe: 'at-ligne at-confirmation-boutons' }, [non, oui]));
    if (d.open) fermer();
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    non.focus();
  }

  function montrer(id) {
    if (!panneaux[id]) return;
    actif = id;
    ONGLETS.forEach(function (o) {
      var oui = o.id === id;
      panneaux[o.id].hidden = !oui;
      boutons[o.id].setAttribute('aria-selected', oui ? 'true' : 'false');
      boutons[o.id].tabIndex = oui ? 0 : -1;
    });
    document.body.setAttribute('data-onglet', id);
    if (vues[id] && vues[id].montrer) vues[id].montrer();
  }

  function dansUnChamp(cible) {
    if (!cible || !cible.tagName) return false;
    var nom = cible.tagName.toLowerCase();
    return nom === 'input' || nom === 'textarea' || nom === 'select' || cible.isContentEditable === true;
  }

  function surTouche(ev) {
    if (dansUnChamp(ev.target) || document.querySelector('dialog[open]')) return;
    var vue = vues[actif];
    if (!vue) return;
    var touche = ev.key.toLowerCase(), ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && !ev.shiftKey && touche === 'z') { if (vue.annuler) vue.annuler(); ev.preventDefault(); return; }
    if (ctrl && (touche === 'y' || (ev.shiftKey && touche === 'z'))) { if (vue.retablir) vue.retablir(); ev.preventDefault(); return; }
    if (ctrl || ev.altKey) return;
    if (vue.touche && vue.touche(ev)) ev.preventDefault();
  }

  /** Construit l'atelier dans `racine` (élément vide). */
  function demarrer(racine) {
    var contexte = {
      message: message, telecharger: telecharger, ouvrirFichier: ouvrirFichier,
      confirmer: confirmer, indiquerPlateau: indiquerPlateau, stockage: AT.app.stockage,
      plateau: function () { return vues.plateau.plateau(); },
      // Réglages des contrôles pour un AUTRE document que le plateau affiché (le plateau d'une partie) : une copie.
      reglagesControles: function () {
        var source = vues.plateau.reglages(), copie = {};
        Object.keys(source).forEach(function (k) { copie[k] = source[k]; });
        return copie;
      },
      montrer: montrer
    };
    var liste = el('nav', { classe: 'at-onglets', role: 'tablist', 'aria-label': 'Parties de l’atelier' });
    var principal = el('main', { classe: 'at-principal' });
    ONGLETS.forEach(function (o, i) {
      boutons[o.id] = el('button', {
        type: 'button', role: 'tab', id: 'onglet-' + o.id, 'aria-controls': 'panneau-' + o.id, texte: o.nom,
        sur: {
          click: function () { montrer(o.id); },
          keydown: function (ev) {
            if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
            var suivant = ONGLETS[(i + (ev.key === 'ArrowRight' ? 1 : ONGLETS.length - 1)) % ONGLETS.length];
            montrer(suivant.id);
            boutons[suivant.id].focus();
            ev.preventDefault();
          }
        }
      });
      liste.appendChild(boutons[o.id]);
      panneaux[o.id] = el('section', { classe: 'at-panneau at-panneau-' + o.id, id: 'panneau-' + o.id, role: 'tabpanel', 'aria-labelledby': 'onglet-' + o.id, hidden: true });
      principal.appendChild(panneaux[o.id]);
    });
    barreEtat = el('footer', { classe: 'at-etat', id: 'barre-etat', role: 'status', 'aria-live': 'polite' });
    nomPlateau = el('span', { classe: 'at-nom-plateau', id: 'at-nom-plateau', texte: 'Plateau : sans nom' });
    etatSauvegarde = el('span', { classe: 'at-sauvegarde', id: 'at-sauvegarde' });
    dialogueConfirmation = el('dialog', { classe: 'at-dialogue at-confirmation', id: 'at-confirmation', 'aria-labelledby': 'at-confirmation-texte' });
    racine.appendChild(el('header', { classe: 'at-barre' }, [
      el('strong', { classe: 'at-titre', texte: 'Atelier du plateau' }),
      liste,
      nomPlateau,
      etatSauvegarde,
      el('span', { classe: 'at-provisoire', texte: 'Catalogue, événements et Troupes : propositions provisoires, à valider' })
    ]));
    racine.appendChild(principal);
    racine.appendChild(barreEtat);
    racine.appendChild(dialogueConfirmation);

    vues.plateau = AT.vuePlateau.creer(contexte);
    vues.inventaire = AT.vueInventaire.creer(contexte);
    vues.partie = AT.vuePartie.creer(contexte);
    ONGLETS.forEach(function (o) { panneaux[o.id].appendChild(vues[o.id].element); });
    AT.app.vues = vues;

    document.addEventListener('keydown', surTouche);

    // Reprise du travail en cours (sauf si l'adresse demande une graine), sinon plateau généré.
    var params = lireParametres(window.location.hash);
    var reprise = params.graine === null ? vues.plateau.reprendreTravail() : { repris: false };
    if (!reprise.repris) vues.plateau.generer(params.graine === null ? 1 : params.graine);
    if (params.mode !== null) vues.plateau.choisirMode(params.mode);
    if (params.partie !== null) vues.partie.nouvelle(params.partie);
    montrer(params.onglet || 'plateau');
    if (reprise.repris) {
      var quand = AT.vueBibliotheque.dateLisible(reprise.modifie);
      message('Travail en cours repris' + (quand ? ' (sauvegardé le ' + quand + ')' : '') + '. « Générer » ou « Nouveau plateau vierge » pour repartir d’autre chose.', 'info');
    } else if (reprise.corrompu) {
      message(reprise.raison + ' Il est ignoré : un plateau a été généré à la place.', 'alerte');
    }
    // La sauvegarde automatique ne commence qu'ici : le plateau généré au démarrage n'écrase rien.
    vues.plateau.activerSauvegarde();
    window.addEventListener('pagehide', function () { vues.plateau.sauverTravail(); });
  }

  AT.app.demarrer = demarrer;
  AT.app.montrer = montrer;
  AT.app.message = message;
  AT.app.confirmer = confirmer;
  AT.app.telechargement = telechargement;
  AT.app.ongletActif = function () { return actif; };

  document.addEventListener('DOMContentLoaded', function () {
    var racine = document.getElementById('atelier');
    if (racine) demarrer(racine);
  });
})();
