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

  /** Rôles du catalogue 2, dans l'ordre d'affichage de l'inventaire. */
  var ROLES = [
    { id: 'noyau', titre: 'Noyau', note: 'fixe, au centre' },
    { id: 'montagne', titre: 'Montagnes', note: 'blocs de 4 et 5 cases, infranchissables' },
    { id: 'quatre', titre: 'Monoblocs de 4 cases', note: 'terrain' },
    { id: 'trois', titre: 'Monoblocs de 3 cases', note: 'terrain' },
    { id: 'remplissage', titre: 'Tuiles de remplissage', note: 'facultatives : elles peuvent rester dans la boîte' }
  ];

  /**
   * Inventaire du catalogue 2 PAR RÔLE (fonction pure), à partir de bilan(). Renvoie {
   *   roles: [{id, titre, note, lignes: [lignes de bilan()], pieces, cases, poses}]   (dans l'ordre de ROLES),
   *   deploiements: {total, parCamp, poses, restantes, vert, rouge}   (villes de déploiement, posées PAR-DESSUS une Plaine),
   *   tuilesVilles: {total, neutres, poses, restantes}   (les 6 tuiles de ville posées par-dessus : 2 neutres, 2 par camp),
   *   terrain: {cases, plaine, foret, marais}   (monoblocs de terrain seuls : la répartition visée 65 / 17,5 / 17,5),
   *   remplissage: {pieces, plaine}, montagne: cases, villes: nombre total de villes d'un plateau complet,
   *   ancien: {present, lignes: [{id, nom, cases, poses}], pieces}   (tuiles du premier catalogue sur CE plateau ;
   *            present = le plateau est du premier catalogue, selon AT.plateau.catalogueDuPlateau) }.
   */
  function parRole(plateau) {
    var C = AT.catalogue, P = AT.plateau, b = bilan(plateau), parId = {};
    b.lignes.forEach(function (x) { parId[x.id] = x; });
    var roleDe = function (id) {
      var m = C.MODELES[id];
      if (m.role === 'terrain') return m.cases.length === 4 ? 'quatre' : 'trois';
      return m.role;
    };
    var roles = ROLES.map(function (r) {
      var lignes = C.ORDRE_MODELES.filter(function (id) { return roleDe(id) === r.id; }).map(function (id) { return parId[id]; });
      var pieces = 0, cases = 0, poses = 0;
      lignes.forEach(function (x) { pieces += x.total; cases += x.total * x.cases; poses += x.poses; });
      return { id: r.id, titre: r.titre, note: r.note, lignes: lignes, pieces: pieces, cases: cases, poses: poses };
    });
    var terrain = { cases: 0, plaine: 0, foret: 0, marais: 0 }, remplissage = { pieces: 0, plaine: 0 }, montagne = 0;
    C.ORDRE_MODELES.forEach(function (id) {
      var m = C.MODELES[id];
      if (m.role === 'terrain') m.cases.forEach(function (c) { terrain.cases += m.nombre; if (terrain[c.terrain] !== undefined) terrain[c.terrain] += m.nombre; });
      if (m.role === 'remplissage') { remplissage.pieces += m.nombre; remplissage.plaine += m.nombre * m.cases.length; }
      if (m.role === 'montagne') montagne += m.nombre * m.cases.length;
    });
    var etat = P.etatVilles(plateau), VD = C.VILLE_DEPLOIEMENT, VNE = C.VILLE_NEUTRE, posees = etat.vert.length + etat.rouge.length;
    var neutresPosees = etat.neutres.filter(function (x) { return !x.ancienne; }).length, totalTuiles = VD.nombre + VNE.nombre;
    var stock = P.stock(plateau), anciennes = [], nbAnciennes = 0, aUneVille = P.catalogueDuPlateau(plateau).premier;
    C.ORDRE_HORS_CATALOGUE.forEach(function (id) {
      var m = C.MODELES_HORS_CATALOGUE[id];
      if (!m.ancien || !stock[id] || !stock[id].poses) return;
      anciennes.push({ id: id, nom: m.nom, cases: m.cases.length, poses: stock[id].poses });
      nbAnciennes += stock[id].poses;
    });
    return {
      roles: roles,
      deploiements: { total: VD.nombre, parCamp: VD.parCamp, poses: posees, restantes: Math.max(0, VD.nombre - posees), vert: etat.vert.length, rouge: etat.rouge.length },
      terrain: terrain, remplissage: remplissage, montagne: montagne,
      tuilesVilles: { total: totalTuiles, neutres: VNE.nombre, poses: posees + neutresPosees, restantes: Math.max(0, totalTuiles - posees - neutresPosees) },
      villes: 1 + totalTuiles,
      ancien: { present: aUneVille, lignes: aUneVille ? anciennes : [], pieces: aUneVille ? nbAnciennes : 0 }
    };
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
      // Catalogue 2 par rôle : un titre par rôle dans le même tableau, puis les villes de déploiement posées par-dessus.
      var roles = parRole(plateau), lignes = [];
      var titreRole = function (id, titre, note, compte) {
        return el('tr', { classe: 'at-role', 'data-role': id }, el('th', { colspan: 6, scope: 'colgroup' }, [titre + ' : ' + compte, el('span', { classe: 'at-role-note', texte: ' — ' + note })]));
      };
      roles.roles.forEach(function (r) {
        if (!r.lignes.length) return;
        lignes.push(titreRole(r.id, r.titre, r.note, r.pieces + (r.pieces > 1 ? ' pièces' : ' pièce') + ', ' + r.cases + (r.cases > 1 ? ' cases' : ' case')));
        r.lignes.forEach(function (x) { lignes.push(ligneModele(x)); });
      });
      var vd = roles.deploiements, VD = C.VILLE_DEPLOIEMENT;
      var tv = roles.tuilesVilles, VNE = C.VILLE_NEUTRE, neutresPosees = tv.poses - vd.poses;
      lignes.push(titreRole('deploiement', 'Villes', 'tuiles posées PAR-DESSUS une Plaine, à l’étape « Villes » : ' + tv.neutres + ' neutres, ' + vd.parCamp + ' par joueur ; elles n’ajoutent aucune case', tv.total + ' tuiles'));
      lignes.push(el('tr', { 'data-ville-neutre': VNE.id }, [
        el('td', { classe: 'at-cellule-dessin' }, [R.pastilleTuile('vn-plaine', 0.42)]),
        el('th', { scope: 'row' }, [VNE.nom]),
        el('td', { texte: '1 case : posée sur une plaine' }),
        el('td', { classe: 'at-nombre', texte: VNE.nombre }),
        el('td', { classe: 'at-nombre', texte: neutresPosees }),
        el('td', { classe: 'at-nombre', texte: Math.max(0, VNE.nombre - neutresPosees) })
      ]));
      lignes.push(el('tr', { 'data-deploiement': VD.id }, [
        el('td', { classe: 'at-cellule-dessin' }, [R.pastilleTuile('vd-vert', 0.42), R.pastilleTuile('vd-rouge', 0.42)]),
        el('th', { scope: 'row' }, [VD.nom, el('span', { classe: 'at-identifiant', texte: ' ' + VD.id })]),
        el('td', { texte: '1 case : posée sur une plaine (Vert : ' + vd.vert + ' posée' + (vd.vert > 1 ? 's' : '') + ' ; Rouge : ' + vd.rouge + ' posée' + (vd.rouge > 1 ? 's' : '') + ')' }),
        el('td', { classe: 'at-nombre', texte: vd.total }),
        el('td', { classe: 'at-nombre', texte: vd.poses }),
        el('td', { classe: 'at-nombre', texte: vd.restantes })
      ]));
      var tr = roles.terrain;
      var partTerrain = function (n) { return tr.cases ? (100 * n / tr.cases).toFixed(1).replace('.', ',') + ' %' : '–'; };
      // Ancien catalogue : seulement si le plateau ouvert en porte (tuile de ville d'une case).
      var blocAncien = roles.ancien.present ? [
        el('h2', { id: 'inv-titre-ancien', texte: 'Ancien catalogue (sur ce plateau)' }),
        el('p', { classe: 'at-aide', texte: 'Ce plateau a été fait avec le premier catalogue : ses tuiles d’une case restent lisibles, mais ne font plus partie du catalogue imprimé.' }),
        el('table', { classe: 'at-table at-table-large', id: 'inv-ancien' }, [
          entetes(['Dessin', 'Pièce', 'Contenu', 'Posées']),
          el('tbody', null, roles.ancien.lignes.map(function (x) {
            return el('tr', { 'data-modele': x.id }, [
              el('td', { classe: 'at-cellule-dessin' }, R.dessinModele(x.id, { echelle: 0.3, titre: x.nom })),
              el('th', { scope: 'row' }, [x.nom, el('span', { classe: 'at-identifiant', texte: ' ' + x.id })]),
              el('td', { texte: C.MODELES_HORS_CATALOGUE[x.id].cases.length + (C.MODELES_HORS_CATALOGUE[x.id].cases.length > 1 ? ' cases : ' : ' case : ') + contenuCases(C.MODELES_HORS_CATALOGUE[x.id]) }),
              el('td', { classe: 'at-nombre', texte: x.poses })
            ]);
          }))
        ])
      ] : [];
      var hors = b.horsCatalogue;
      if (roles.ancien.present) {
        // Les tuiles de l'ancien catalogue ont leur propre section : elles ne sont pas « à prévoir en plus ».
        var autres = hors.detail.filter(function (d) { return !roles.ancien.lignes.some(function (x) { return x.id === d.id; }); }), nbAutres = 0;
        autres.forEach(function (d) { nbAutres += d.nombre; });
        hors = { pieces: nbAutres, cases: nbAutres, detail: autres, ancien: roles.ancien.pieces };
      }
      var texteHors = hors.pieces
        ? 'Tuiles hors catalogue posées : ' + hors.pieces + ' (' + hors.detail.map(function (d) { return d.nombre + ' × ' + d.nom; }).join(', ')
          + '). Elles sont à prévoir en plus du catalogue imprimé et ne changent pas ses totaux.'
        : 'Tuiles hors catalogue posées : aucune.';
      if (hors.ancien) texteHors += ' Les ' + hors.ancien + ' tuiles de l’ancien catalogue de ce plateau sont comptées à part, plus bas.';
      if (b.inconnues) texteHors += ' ' + b.inconnues + (b.inconnues > 1 ? ' pièces' : ' pièce') + ' d’un modèle inconnu (voir le mode « Créer à la main »).';
      var blocPersos = b.persos.length
        ? el('table', { classe: 'at-table at-table-large', id: 'inv-monoblocs' }, [
          entetes(['Dessin', 'Pièce', 'Contenu', 'Total', 'Posées', 'Restantes']),
          el('tbody', null, b.persos.map(ligneModele))
        ])
        : el('p', { classe: 'at-aide', id: 'inv-monoblocs-vide', texte: 'Aucune pièce personnelle dans ce plateau (onglet Plateau, mode « Mes monoblocs »).' });

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
        el('p', { id: 'inv-planches', classe: 'at-lien-planches' }, [
          el('a', { href: 'planches.html', texte: 'Planches d’impression (A3)' }),
          ' : toutes les pièces à l’échelle réelle, prêtes à imprimer et à découper.'
        ]),
        el('h2', { texte: 'Pièces du catalogue' }),
        el('p', { id: 'inv-totaux', texte: 'Catalogue : ' + totaux.pieces + ' pièces, ' + totaux.cases + ' cases (dont ' + totaux.construction.pieces + ' pièces de terrain pour ' + totaux.construction.cases + ' cases, et ' + totaux.facultatives + ' tuiles de remplissage facultatives). Sur le plateau courant : ' + poses + ' pièces posées (' + casesPosees + ' cases), ' + b.restantes + ' restantes.' }),
        el('p', { id: 'inv-repartition', texte: 'Répartition du terrain (les ' + tr.cases + ' cases des monoblocs de 3 et 4 cases) : ' + tr.plaine + ' plaines (' + partTerrain(tr.plaine) + '), '
          + tr.foret + ' forêts (' + partTerrain(tr.foret) + '), ' + tr.marais + ' marais (' + partTerrain(tr.marais) + ') ; visé : ' + ['plaine', 'foret', 'marais'].map(function (t) { return String(C.REGLAGES.repartitionVisee[t]).replace('.', ','); }).join(' / ')
          + '. En plus : ' + roles.montagne + ' cases de montagne, les 6 plaines du noyau, ' + roles.remplissage.plaine + ' plaines de remplissage facultatives, et ' + roles.villes
          + ' villes sur un plateau complet (celle du noyau, ' + C.VILLE_NEUTRE.nombre + ' neutres, ' + C.VILLE_DEPLOIEMENT.nombre + ' de déploiement).' }),
        el('table', { classe: 'at-table at-table-large', id: 'inv-pieces' }, [
          entetes(['Dessin', 'Pièce', 'Contenu', 'Total', 'Posées', 'Restantes']),
          el('tbody', null, lignes)
        ]),
        el('p', { id: 'inv-villes', texte: 'Villes : la ville du noyau, et ' + roles.tuilesVilles.total + ' tuiles de ville posées par-dessus une Plaine après la construction (' + C.VILLE_NEUTRE.nombre
          + ' villes neutres, ' + C.VILLE_DEPLOIEMENT.parCamp + ' villes de déploiement par joueur) : elles n’ajoutent aucune case ; ' + roles.tuilesVilles.poses + ' posée(s) sur le plateau courant, ' + roles.tuilesVilles.restantes + ' restante(s).' }),
        el('p', { id: 'inv-hors-catalogue', classe: hors.pieces ? 'at-niveau-alerte' : 'at-aide', texte: texteHors }),
        blocAncien,
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

  AT.vueInventaire = { creer: creer, bilan: bilan, parRole: parRole, ROLES: ROLES };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.vueInventaire;
})();
