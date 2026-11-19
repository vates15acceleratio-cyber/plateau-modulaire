/*
 * vue-inventaire.js : onglet « Inventaire » (lot C). Toutes les pièces du catalogue dessinées, avec leur
 * quantité totale / posée / restante sur le plateau courant, les totaux, et la réserve des tuiles d'événement.
 * À part du catalogue imprimé (lot E) : la section « Mes monoblocs » (pièces personnelles du document) et la
 * ligne « Tuiles hors catalogue posées » (tuiles posées au-delà du stock par le pinceau, dont la montagne d'une case).
 * Dépend de AT.catalogue, AT.plateau, AT.cartes, AT.rendu.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.plateau) require('./plateau.js');
  }

  /**
   * Comptes de l'inventaire pour un plateau (fonction pure). Les totaux du catalogue imprimé ne bougent jamais ;
   * une tuile posée au-delà du stock est comptée « hors catalogue », pas en négatif dans « restantes ».
   * Renvoie {
   *   lignes: [{id, nom, cases, total, poses (dans la limite du stock), restantes, enPlus}]  (catalogue imprimé),
   *   poses, casesPosees, restantes                       (catalogue imprimé seulement),
   *   horsCatalogue: {pieces, cases, detail: [{id, nom, nombre}]}   (surplus du catalogue + modèles hors catalogue),
   *   persos: [{id, nom, cases, total, poses, restantes, enPlus}], inconnues }.
   */
  function bilan(plateau) {
    var C = AT.catalogue, P = AT.plateau, stock = P.stock(plateau);
    var res = { lignes: [], poses: 0, casesPosees: 0, restantes: 0, horsCatalogue: { pieces: 0, cases: 0, detail: [] }, persos: [], inconnues: 0 };
    var ligne = function (id) {
      var m = P.modele(plateau, id), s = stock[id];
      var dansStock = Math.min(s.poses, s.total);
      return { id: id, nom: m.nom, cases: m.cases.length, total: s.total, poses: dansStock, restantes: s.total - dansStock, enPlus: s.poses - dansStock };
    };
    var horsCatalogue = function (x) {
      if (!x.enPlus) return;
      res.horsCatalogue.pieces += x.enPlus;
      res.horsCatalogue.cases += x.enPlus * x.cases;
      res.horsCatalogue.detail.push({ id: x.id, nom: x.nom, nombre: x.enPlus });
    };
    C.ORDRE_MODELES.forEach(function (id) {
      var x = ligne(id);
      res.lignes.push(x);
      res.poses += x.poses;
      res.casesPosees += x.poses * x.cases;
      res.restantes += x.restantes;
      horsCatalogue(x);
    });
    C.ORDRE_HORS_CATALOGUE.forEach(function (id) { horsCatalogue(ligne(id)); });
    P.modeles(plateau).forEach(function (m) { res.persos.push(ligne(m.id)); });
    (plateau.pieces || []).forEach(function (p) { if (!P.modele(plateau, p.modele)) res.inconnues += 1; });
    return res;
  }

  function creer(ctx) {
    var R = AT.rendu, el = R.el, C = AT.catalogue, P = AT.plateau;
    var zone = el('div', { classe: 'at-inventaire-contenu' });

    function entetes(noms) {
      return el('thead', null, el('tr', null, noms.map(function (t) { return el('th', { scope: 'col', texte: t }); })));
    }

    function contenuCases(m) {
      var n = {};
      m.cases.forEach(function (c) { n[c.terrain] = (n[c.terrain] || 0) + 1; });
      return Object.keys(n).map(function (t) { return n[t] + ' × ' + R.nomTerrain(t).toLowerCase(); }).join(', ');
    }

    function montrer() {
      var plateau = ctx.plateau(), totaux = C.totaux(), b = bilan(plateau);
      var poses = b.poses, casesPosees = b.casesPosees;
      var ligneModele = function (x) {
        var m = P.modele(plateau, x.id), nom = el('th', { scope: 'row' });
        nom.appendChild(document.createTextNode(x.nom));            // nom d'une pièce personnelle : texte seulement
        nom.appendChild(el('span', { classe: 'at-identifiant', texte: ' ' + x.id }));
        return el('tr', { 'data-modele': x.id }, [
          el('td', { classe: 'at-cellule-dessin' }, R.dessinModele(x.id, { echelle: 0.3, titre: x.nom, plateau: plateau })),
          nom,
          el('td', { texte: m.cases.length + (m.cases.length > 1 ? ' cases : ' : ' case : ') + contenuCases(m) }),
          el('td', { classe: 'at-nombre', texte: x.total }),
          el('td', { classe: 'at-nombre', texte: x.poses + (x.enPlus ? ' (+ ' + x.enPlus + ' hors stock)' : '') }),
          el('td', { classe: 'at-nombre', texte: x.restantes })
        ]);
      };
      var lignes = b.lignes.map(ligneModele);
      var hors = b.horsCatalogue;
      var texteHors = hors.pieces
        ? 'Tuiles hors catalogue posées : ' + hors.pieces + ' (' + hors.detail.map(function (d) { return d.nombre + ' × ' + d.nom; }).join(', ')
          + '). Elles sont à prévoir en plus du catalogue imprimé et ne changent pas ses totaux.'
        : 'Tuiles hors catalogue posées : aucune.';
      if (b.inconnues) texteHors += ' ' + b.inconnues + (b.inconnues > 1 ? ' pièces' : ' pièce') + ' d’un modèle inconnu (voir le mode « Créer à la main »).';
      var blocPersos = b.persos.length
        ? el('table', { classe: 'at-table at-table-large', id: 'inv-monoblocs' }, [
          entetes(['Dessin', 'Pièce', 'Contenu', 'Total', 'Posées', 'Restantes']),
          el('tbody', null, b.persos.map(ligneModele))
        ])
        : el('p', { classe: 'at-aide', id: 'inv-monoblocs-vide', texte: 'Aucune pièce personnelle dans ce plateau (onglet Plateau, mode « Mes monoblocs »).' });
      var t = totaux.parTerrain, libres = (t.plaine || 0) + (t.foret || 0) + (t.marais || 0);
      var part = function (n) { return (100 * n / libres).toFixed(1).replace('.', ',') + ' %'; };

      var recouvrements = {};
      plateau.recouvrements.forEach(function (x) { recouvrements[x.evenement] = x.cle; });
      var poseParId = {};
      AT.cartes.evenements().forEach(function (carte) { poseParId[carte.id] = carte.pose; });
      var evenements = C.ORDRE_EVENEMENTS.map(function (id) {
        var ev = C.EVENEMENTS[id];
        return el('tr', { 'data-evenement': id }, [
          el('td', { classe: 'at-cellule-dessin' }, R.pastilleTerrain(ev.terrain, true)),
          el('th', { scope: 'row' }, [ev.nom, el('span', { classe: 'at-identifiant', texte: ' ' + id })]),
          el('td', { texte: poseParId[id] || '' }),
          el('td', { texte: ev.effet }),
          el('td', { texte: recouvrements[id] ? 'posée en (' + recouvrements[id] + ')' : 'en réserve' })
        ]);
      });

      R.remplacer(zone, [
        el('p', { classe: 'at-bandeau-provisoire', id: 'inv-provisoire', texte: 'Proposition provisoire, à valider : les pièces, leurs quantités, les tuiles d’événement et leurs effets ne sont pas arrêtés.' }),
        el('h2', { texte: 'Pièces du catalogue' }),
        el('p', { id: 'inv-totaux', texte: 'Catalogue : ' + totaux.pieces + ' pièces, ' + totaux.cases + ' cases. Sur le plateau courant : ' + poses + ' pièces posées (' + casesPosees + ' cases), ' + b.restantes + ' restantes.' }),
        el('p', { id: 'inv-repartition', texte: 'Répartition : ' + (t.ville || 0) + ' villes, ' + (t.montagne || 0) + ' cases de montagne, ' + (t.plaine || 0) + ' plaines (' + part(t.plaine || 0) + '), '
          + (t.foret || 0) + ' forêts (' + part(t.foret || 0) + '), ' + (t.marais || 0) + ' marais (' + part(t.marais || 0) + ') ; les pourcentages sont calculés hors villes et montagnes.' }),
        el('table', { classe: 'at-table at-table-large', id: 'inv-pieces' }, [
          entetes(['Dessin', 'Pièce', 'Contenu', 'Total', 'Posées', 'Restantes']),
          el('tbody', null, lignes)
        ]),
        el('p', { id: 'inv-hors-catalogue', classe: hors.pieces ? 'at-niveau-alerte' : 'at-aide', texte: texteHors }),
        el('h2', { texte: 'Mes monoblocs' }),
        el('p', { classe: 'at-aide', texte: 'Pièces personnelles de ce plateau, à part du catalogue imprimé : elles ne comptent pas dans ses totaux.' }),
        blocPersos,
        el('h2', { texte: 'Réserve des tuiles d’événement' }),
        el('p', { texte: '8 tuiles uniques d’une case, posées par-dessus une case quand un joueur pioche l’événement ; elles ne servent pas à construire le plateau. ' + AT.cartes.RESTRICTIONS_EVENEMENTS }),
        el('table', { classe: 'at-table at-table-large', id: 'inv-evenements' }, [
          entetes(['Dessin', 'Tuile', 'Se pose sur', 'Effet sur la case', 'État']),
          el('tbody', null, evenements)
        ])
      ]);
    }

    return { element: el('div', { classe: 'at-ecran at-ecran-inventaire' }, zone), montrer: montrer };
  }

  AT.vueInventaire = { creer: creer, bilan: bilan };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.vueInventaire;
})();
