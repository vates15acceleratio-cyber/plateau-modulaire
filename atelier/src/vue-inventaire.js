/*
 * vue-inventaire.js : onglet « Inventaire » (lot C). Toutes les pièces du catalogue dessinées, avec leur
 * quantité totale / posée / restante sur le plateau courant, les totaux, et la réserve des tuiles d'événement.
 * Dépend de AT.catalogue, AT.plateau, AT.cartes, AT.rendu.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

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
      var plateau = ctx.plateau(), stock = P.stock(plateau), totaux = C.totaux();
      var poses = 0, casesPosees = 0;
      var lignes = C.ORDRE_MODELES.map(function (id) {
        var m = C.MODELES[id], s = stock[id];
        poses += s.poses;
        casesPosees += s.poses * m.cases.length;
        return el('tr', { 'data-modele': id }, [
          el('td', { classe: 'at-cellule-dessin' }, R.dessinModele(id, { echelle: 0.3, titre: m.nom })),
          el('th', { scope: 'row' }, [m.nom, el('span', { classe: 'at-identifiant', texte: ' ' + id })]),
          el('td', { texte: m.cases.length + (m.cases.length > 1 ? ' cases : ' : ' case : ') + contenuCases(m) }),
          el('td', { classe: 'at-nombre', texte: s.total }),
          el('td', { classe: 'at-nombre', texte: s.poses }),
          el('td', { classe: 'at-nombre' + (s.restant < 0 ? ' at-niveau-erreur' : ''), texte: s.restant })
        ]);
      });
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
        el('p', { id: 'inv-totaux', texte: 'Catalogue : ' + totaux.pieces + ' pièces, ' + totaux.cases + ' cases. Sur le plateau courant : ' + poses + ' pièces posées (' + casesPosees + ' cases), ' + (totaux.pieces - poses) + ' restantes.' }),
        el('p', { id: 'inv-repartition', texte: 'Répartition : ' + (t.ville || 0) + ' villes, ' + (t.montagne || 0) + ' cases de montagne, ' + (t.plaine || 0) + ' plaines (' + part(t.plaine || 0) + '), '
          + (t.foret || 0) + ' forêts (' + part(t.foret || 0) + '), ' + (t.marais || 0) + ' marais (' + part(t.marais || 0) + ') ; les pourcentages sont calculés hors villes et montagnes.' }),
        el('table', { classe: 'at-table at-table-large', id: 'inv-pieces' }, [
          entetes(['Dessin', 'Pièce', 'Contenu', 'Total', 'Posées', 'Restantes']),
          el('tbody', null, lignes)
        ]),
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

  AT.vueInventaire = { creer: creer };
})();
