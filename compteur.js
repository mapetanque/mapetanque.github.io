// Compteur de points (compteur.html et ses versions nl/de/en) : construit tout le widget dans
// #compteurWidget. Seul endroit où se trouve sa logique, pour les quatre langues : les textes sont
// dans translations.js (clés compteur_*), les styles dans style-compteur.css.
// Indépendant de script.js (aucune variable/fonction en commun, tout est dans sa propre portée).
// Utilise compte.js (window.mapetanqueCompte) quand il est chargé : connecté, la partie terminée
// est enregistrée dans « Mes parties » (Worker des comptes, routes /compte/parties et
// /compte/joueurs). Voir NOTES_comptes_utilisateurs.md, « Étape 2 — enregistrement des parties ».
// « Partager » montre un QR code « Rejoindre cette partie » (routes /compte/partage) : les autres
// joueurs l'ouvrent sur partie.html et la partie arrive aussi dans leurs parties. Voir « Étapes B
// et C fusionnées : la partie partagée ».
(function(){
  const widget = document.getElementById('compteurWidget');
  if (!widget) return;

  const CLE_STOCKAGE = 'mapetanque_compteur_partie';
  const CLE_FILE = 'mapetanque_parties_a_envoyer';     // parties à envoyer au Worker (hors ligne)
  const CLE_JOUEURS = 'mapetanque_compteur_joueurs';    // noms récents, du plus récent au plus ancien
  const compte = window.mapetanqueCompte || null;

  // Enregistrement automatique : en dessous, c'est un essai du compteur (même règle dans le Worker)
  const MENES_MIN = 3;
  const DUREE_MIN = 5 * 60;          // secondes entre le premier et le dernier point
  const RAYON_PROPOSE = 500;         // m : terrain proposé d'office à la fin de la partie
  const RAYON_LISTE = 5000;          // m : terrains proposés par « Ajouter le terrain »

  // Langue de la page d'après son adresse (/nl/, /de/, /en/), comme le reste de son contenu, et
  // non la langue préférée enregistrée par script.js, qui peut être différente.
  const langueURL = location.pathname.match(/^\/(nl|de|en)\//);
  const langue = langueURL ? langueURL[1] : 'fr';
  const textes = translations[langue];

  // libelle('compteur_gagne', {equipe: 'Les Boulistes'}) → « Les Boulistes gagne »
  function libelle(cle, valeurs){
    let texte = textes[cle] || translations.fr[cle] || cle;
    for (const nom in valeurs) texte = texte.replace('{' + nom + '}', valeurs[nom]);
    return texte;
  }

  function echapper(texte){
    return String(texte).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  // « Julie », « Julie et Marc », « Julie, Marc et Paul »
  function listeEt(noms){
    if (noms.length < 2) return noms.join('');
    return noms.slice(0, -1).join(', ') + ' ' + libelle('compteur_et') + ' ' + noms[noms.length - 1];
  }

  // Sans accents ni majuscules : « Julie » et « julie » sont le même joueur (comme le Worker)
  function cleNom(nom){
    return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function session(){ return compte ? compte.session() : null; }

  const ICON_MAXIMIZE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
  const ICON_MINIMIZE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';

  // Pictos au trait (Lucide), couleur héritée du texte
  function picto(chemins){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + chemins + '</svg>';
  }
  const PICTOS = {
    vous: picto('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    equipes: picto('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    ok: picto('<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>'),
    info: picto('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
    horloge: picto('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    lieu: picto('<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
    echange: picto('<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>'),
    plus: picto('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    croix: picto('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    crayon: picto('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
    entrer: picto('<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>'),
    qr: picto('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v.01M14 21h.01M17 21h4v-4"/>'),
    envoyer: picto('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>')
  };

  // ---------- Construction du widget ----------

  // Moitié d'une équipe ('a' ou 'b'). Toucher la moitié donne +1 ; le bouton +1 caché ne sert
  // qu'au clavier (voir .chip-un dans style-compteur.css). Toucher le nom ouvre « Équipes ».
  // Les pastilles sont dessinées par render() : +4 à +6 n'existent pas en tête-à-tête.
  function moitie(equipe){
    const E = equipe.toUpperCase();
    return `
    <div class="team ${equipe}" id="team${E}" role="group" aria-labelledby="name${E}">
      <button type="button" class="name" id="name${E}"></button>
      <div class="score" id="score${E}">0</div>
      <div class="boules" id="boules${E}" aria-hidden="true"></div>
      <div class="controls" id="controls${E}"></div>
      <div class="hint" aria-hidden="true">${libelle('compteur_toucher')}</div>
    </div>`;
  }

  function enteteFeuille(id, titre){
    return `<div class="feuille-tete"><span class="feuille-titre" id="${id}">${titre}</span>
      <button type="button" class="fermer-feuille" data-fermer aria-label="${echapper(libelle('close_panel'))}">✕</button></div>`;
  }

  widget.innerHTML = `
<div class="app">
  <div class="topbar">
    <div class="target-toggle" id="targetToggle" role="group" aria-label="${libelle('compteur_cible')}">
      <button type="button" data-t="11">11</button>
      <button type="button" data-t="13">13</button>
    </div>
    <button type="button" id="resetBtn">${libelle('compteur_nouvelle_partie')}</button>
    <button type="button" class="fullscreen-toggle-btn" id="fullscreenToggleBtn"></button>
  </div>

  <div class="halves">${moitie('a')}
    <div class="divider"></div>${moitie('b')}
  </div>

  <div class="bottombar">
    <button type="button" id="undoBtn" disabled><span aria-hidden="true">↺</span> ${libelle('compteur_annuler')}</button>
    <button type="button" id="menesBtn"><span aria-hidden="true">☰</span> ${libelle('compteur_menes')}</button>
    <button type="button" id="equipesBtn">${PICTOS.equipes} ${libelle('compteur_equipes')}</button>
    <button type="button" id="partagerBtn">${PICTOS.qr} ${libelle('compteur_partager')}</button>
  </div>

  <div class="win" id="winOverlay" role="dialog" aria-modal="true" aria-labelledby="winnerName">
    <div class="confetti-field" id="confettiField"></div>
    <div class="trophy-line">${libelle('compteur_partie_terminee')}</div>
    <div class="winner-name" id="winnerName"></div>
    <div class="final-score" id="finalScore"></div>
    <div class="carte-partie" id="cartePartie" hidden></div>
    <button type="button" id="playAgainBtn">${libelle('compteur_nouvelle_partie')}</button>
    <button type="button" id="undoWinBtn" class="secondary"><span aria-hidden="true">↺</span> ${libelle('compteur_annuler_point')}</button>
  </div>

  <div class="win" id="menesModal" role="dialog" aria-modal="true" aria-labelledby="menesTitre">
    <div class="trophy-line" id="menesTitre">${libelle('compteur_detail_titre')}</div>
    <ol class="detail-menes" id="detailMenes"></ol>
    <p class="detail-vide" id="detailVide">${libelle('compteur_detail_vide')}</p>
    <button type="button" id="closeMenes" class="secondary">${libelle('close_panel')}</button>
  </div>

  <div class="feuille" id="equipesModal" role="dialog" aria-modal="true" aria-labelledby="equipesTitre">
    <div class="feuille-corps">
      ${enteteFeuille('equipesTitre', libelle('compteur_equipes'))}
      <div class="formats" id="formats" role="group" aria-label="${echapper(libelle('compteur_format'))}">
        ${[1, 2, 3].map(f => `<button type="button" data-f="${f}"><b>${libelle('compteur_format_' + f)}</b><span>${libelle('compteur_format_' + f + '_nom')}</span></button>`).join('')}
      </div>
      <div class="blocs-equipes" id="blocsEquipes"></div>
      <label class="case-garder" id="caseGarder">
        <input type="checkbox" id="chkGarder">
        <span>${libelle('compteur_garder')}<small>${libelle('compteur_garder_aide')}</small></span>
      </label>
      <p class="note-feuille" id="noteInvite">${libelle('compteur_noms_invite')}</p>
      <button type="button" class="bouton-plein" data-fermer>${libelle('compteur_ok')}</button>
    </div>
  </div>

  <div class="feuille" id="joueurModal" role="dialog" aria-modal="true" aria-labelledby="joueurTitre">
    <div class="feuille-corps">
      ${enteteFeuille('joueurTitre', '')}
      <div class="recents-zone" id="recentsZone">
        <span class="note-feuille">${libelle('compteur_joueurs_recents')}</span>
        <div class="recents" id="recents"></div>
      </div>
      <div class="saisie-joueur">
        <input type="text" class="champ" id="champJoueur" maxlength="20" autocomplete="off" placeholder="${echapper(libelle('compteur_prenom'))}" aria-label="${echapper(libelle('compteur_prenom'))}">
        <button type="button" class="bouton-plein" id="ajouterJoueur">${libelle('compteur_ajouter')}</button>
      </div>
      <p class="note-feuille" id="noteNoms"></p>
    </div>
  </div>

  <div class="feuille" id="partageModal" role="dialog" aria-modal="true" aria-labelledby="partageTitre">
    <div class="feuille-corps">
      ${enteteFeuille('partageTitre', libelle('compteur_partager_titre'))}
      <div class="partage-corps" id="partageCorps"></div>
    </div>
  </div>

  <div class="feuille" id="terrainModal" role="dialog" aria-modal="true" aria-labelledby="terrainTitre">
    <div class="feuille-corps">
      ${enteteFeuille('terrainTitre', libelle('compteur_terrains_proches'))}
      <div class="liste-terrains" id="listeTerrains"></div>
    </div>
  </div>

  <div class="sr-only" id="annonce" aria-live="polite"></div>
</div>`;

  const $ = id => document.getElementById(id);
  const el = {
    teamA: $('teamA'), teamB: $('teamB'),
    scoreA: $('scoreA'), scoreB: $('scoreB'),
    boulesA: $('boulesA'), boulesB: $('boulesB'),
    nameA: $('nameA'), nameB: $('nameB'),
    controlsA: $('controlsA'), controlsB: $('controlsB'),
    undoBtn: $('undoBtn'),
    resetBtn: $('resetBtn'),
    win: $('winOverlay'),
    winnerName: $('winnerName'),
    finalScore: $('finalScore'),
    cartePartie: $('cartePartie'),
    playAgainBtn: $('playAgainBtn'),
    targetToggle: $('targetToggle'),
    menesModal: $('menesModal'),
    detailMenes: $('detailMenes'),
    detailVide: $('detailVide'),
    equipesModal: $('equipesModal'),
    blocsEquipes: $('blocsEquipes'),
    joueurModal: $('joueurModal'),
    terrainModal: $('terrainModal'),
    partageModal: $('partageModal'),
    partageCorps: $('partageCorps'),
    annonce: $('annonce'),
    fullscreenToggleBtn: $('fullscreenToggleBtn'),
  };
  const PANNEAUX = [el.terrainModal, el.partageModal, el.joueurModal, el.equipesModal, el.menesModal];   // du plus haut au plus bas

  // ---------- État de la partie ----------

  // menes : une entrée par mène, { equipe: 'a'|'b', points, a, b, t } (a et b : score après la
  // mène ; t : secondes depuis le premier point). nameA/nameB vides = nom par défaut, affiché dans
  // la langue de la page. joueurs : les AUTRES joueurs nommés de chaque équipe (le titulaire du
  // compte n'y figure pas : sa place est « moi »). Joueurs, format, place et terrain restent pour
  // la partie suivante (revanche).
  const state = {
    target: 13,
    scoreA: 0,
    scoreB: 0,
    menes: [],
    finished: false,
    nameA: '',
    nameB: '',
    id: null,            // identifiant de la partie (tiré au premier point), clé de l'enregistrement
    debut: null,         // heure du premier point (ms)
    format: 2,           // joueurs par équipe : 1 tête-à-tête, 2 doublette, 3 triplette
    moi: 'a',            // équipe du titulaire du compte (pastille « Vous »)
    joueurs: { a: [], b: [] },
    garder: true,        // case « Garder cette partie dans Mes parties »
    moiVu: false,        // pastille « Vous » affichée pendant la partie (sinon on demande l'équipe à la fin)
    pasJoue: false,      // « Je n'ai pas joué », à la question de fin de partie
    quiEstMoi: null,     // équipe choisie à la question, quand il faut encore dire quel joueur on est
    retiree: false,      // « Retirer » sur l'écran de fin
    envoi: '',           // '', 'en_cours', 'ok', 'attente' (hors ligne), 'echec'
    terrain: null,       // { o: identifiant OSM, nom, d: distance en m }
    terrainJour: '',     // jour où le terrain a été choisi : une revanche le même jour le reprend
    partage: null,       // { code, rejoints: [{ equipe, nom, pseudo }] } une fois la partie partagée
  };
  const history = [];

  function places(equipe){
    return state.format - (session() && state.moi === equipe ? 1 : 0);
  }

  // Nom affiché d'une équipe (sans la pastille « Vous ») : nom saisi, sinon ses joueurs, sinon
  // « Équipe A ».
  function nom(equipe){
    const saisi = state['name' + equipe.toUpperCase()];
    if (saisi) return saisi;
    if (state.joueurs[equipe].length) return state.joueurs[equipe].join(' · ');
    return libelle('compteur_equipe_' + equipe);
  }

  // Persistance de la partie en cours (localStorage), pour survivre à une fermeture d'onglet
  // accidentelle — même mécanisme que les préférences de carte ailleurs sur le site. Ne
  // sauvegarde/restaure jamais l'historique Annuler (pas essentiel, et sérialiser une pile
  // d'états à chaque action serait plus coûteux pour un bénéfice marginal).
  function sauvegarderPartie(){
    try {
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify(state));
    } catch (e) { /* stockage indisponible (navigation privée, quota...) : tant pis, pas bloquant */ }
  }

  function restaurerPartie(){
    try {
      const brut = localStorage.getItem(CLE_STOCKAGE);
      if (!brut) return;
      Object.assign(state, JSON.parse(brut));
    } catch (e) { /* sauvegarde absente ou corrompue : on repart d'une partie neuve */ }

    // Sauvegardes d'avant le détail des mènes : un simple compteur « mene », et les noms par
    // défaut enregistrés en toutes lettres (« Équipe A », « Team A »…).
    if (!Array.isArray(state.menes)) state.menes = [];
    delete state.mene;
    const nomsParDefaut = Object.keys(translations).flatMap(l =>
      [translations[l].compteur_equipe_a, translations[l].compteur_equipe_b]);
    if (nomsParDefaut.includes(state.nameA)) state.nameA = '';
    if (nomsParDefaut.includes(state.nameB)) state.nameB = '';
    // Sauvegardes d'avant l'enregistrement des parties
    if (![1, 2, 3].includes(state.format)) state.format = 2;
    if (state.moi !== 'a' && state.moi !== 'b') state.moi = 'a';
    if (!state.joueurs || typeof state.joueurs !== 'object') state.joueurs = { a: [], b: [] };
    ['a', 'b'].forEach(e => {
      if (!Array.isArray(state.joueurs[e])) state.joueurs[e] = [];
      state.joueurs[e] = state.joueurs[e].filter(n => typeof n === 'string' && n);
    });
    if (state.menes.length && !state.debut) state.debut = Date.now();
    state.menes.forEach(m => { if (typeof m.t !== 'number') m.t = 0; });
    if (state.envoi === 'en_cours') state.envoi = 'attente';
    if (!state.partage || typeof state.partage.code !== 'string') state.partage = null;
    else if (!Array.isArray(state.partage.rejoints)) state.partage.rejoints = [];
  }

  function snapshot(){
    history.push(JSON.stringify(state));
    if(history.length > 60) history.shift();
    el.undoBtn.disabled = false;
  }

  function nouvelIdentifiant(){
    if (crypto.randomUUID) return crypto.randomUUID();
    const o = crypto.getRandomValues(new Uint8Array(16));
    o[6] = (o[6] & 15) | 64; o[8] = (o[8] & 63) | 128;
    const h = [...o].map(x => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  // ---------- Affichage ----------

  function renderBoules(container, score){
    container.innerHTML = '';
    for(let i=0;i<state.target;i++){
      const d = document.createElement('div');
      d.className = 'boule' + (i < score ? ' filled' : '');
      container.appendChild(d);
    }
  }

  // En tête-à-tête, chaque joueur n'a que 3 boules : une mène rapporte 3 points au plus
  function renderPastilles(container){
    const max = state.format === 1 ? 3 : 6;
    if (container.children.length === max) return;
    let html = '';
    for (let n = 1; n <= max; n++) html += '<button type="button" class="chip' + (n === 1 ? ' chip-un' : '') + '" data-pts="' + n + '">+' + n + '</button>';
    container.innerHTML = html;
  }

  function renderNom(equipe, bouton){
    const connecte = !!session();
    const moi = connecte && state.moi === equipe;
    let texte = nom(equipe);
    if (moi && !state['name' + equipe.toUpperCase()] && state.joueurs[equipe].length) texte = '& ' + texte;
    bouton.innerHTML = (moi ? '<span class="pastille-vous">' + PICTOS.vous + echapper(libelle('compteur_vous')) + '</span>' : '') +
      '<span class="texte-nom">' + echapper(texte) + '</span>';
    bouton.setAttribute('aria-label', (moi ? libelle('compteur_vous') + ', ' : '') + nom(equipe) + ' — ' + libelle('compteur_equipes'));
  }

  function render(){
    el.scoreA.textContent = state.scoreA;
    el.scoreB.textContent = state.scoreB;
    renderBoules(el.boulesA, state.scoreA);
    renderBoules(el.boulesB, state.scoreB);
    renderPastilles(el.controlsA);
    renderPastilles(el.controlsB);
    renderNom('a', el.nameA);
    renderNom('b', el.nameB);
    // La pastille « Vous » vue pendant la partie vaut réponse à « dans quelle équipe jouiez-vous ? »
    if (session() && !state.finished) state.moiVu = true;

    [...el.targetToggle.children].forEach(btn=>{
      const actif = Number(btn.dataset.t) === state.target;
      btn.classList.toggle('active', actif);
      btn.setAttribute('aria-pressed', actif);
    });

    if (el.win.classList.contains('show')) renderCarte();
    sauvegarderPartie();
  }

  // Score lu par les lecteurs d'écran après chaque action (zone aria-live)
  function annoncerScore(){
    el.annonce.textContent = nom('a') + ' ' + state.scoreA + ', ' + nom('b') + ' ' + state.scoreB;
  }

  // « +3 » qui s'envole au-dessus du score, et courte vibration (Android ; ignorée ailleurs) :
  // avec toute une moitié d'écran sensible au toucher, un point marqué par erreur doit se voir.
  function signalerGain(team, pts){
    const gain = document.createElement('div');
    gain.className = 'gain';
    gain.textContent = '+' + pts;
    gain.setAttribute('aria-hidden', 'true');
    (team === 'a' ? el.teamA : el.teamB).appendChild(gain);
    setTimeout(()=> gain.remove(), 1000);
    try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) { /* pas bloquant */ }
  }

  function launchConfetti(colors){
    const field = $('confettiField');
    field.innerHTML = '';
    const count = 46;
    for(let i=0;i<count;i++){
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      const left = Math.random()*100;
      const delay = Math.random()*0.5;
      const duration = 2.2 + Math.random()*1.3;
      const color = colors[Math.floor(Math.random()*colors.length)];
      const rotateStart = Math.random()*360;
      p.style.left = left + '%';
      p.style.background = color;
      p.style.animationDelay = delay + 's';
      p.style.animationDuration = duration + 's';
      p.style.transform = 'rotate(' + rotateStart + 'deg)';
      field.appendChild(p);
    }
  }

  // « Vous gagnez ! », sinon « Les Boulistes gagne », « Marc et Paul gagnent », « Équipe B gagne »
  function titreVainqueur(equipe){
    if (session() && state.moiVu && !state.pasJoue && state.moi === equipe) return libelle('compteur_vous_gagnez');
    if (!state['name' + equipe.toUpperCase()] && state.joueurs[equipe].length > 1) return libelle('compteur_gagnent', { equipe: listeEt(state.joueurs[equipe]) });
    return libelle('compteur_gagne', { equipe: nom(equipe) });
  }

  // Écran de victoire. Sans confettis quand on y revient par Annuler (ex. « Nouvelle partie »
  // touchée par erreur juste après une victoire) ou au rechargement de la page.
  function afficherVictoire(avecConfettis){
    const aWon = state.scoreA >= state.target;
    el.winnerName.textContent = titreVainqueur(aWon ? 'a' : 'b');
    el.finalScore.textContent = state.scoreA + ' – ' + state.scoreB;
    el.win.classList.remove('win-a', 'win-b');
    el.win.classList.add(aWon ? 'win-a' : 'win-b');
    const palette = aWon
      ? ['#4c7a3d', '#f2ece0', '#c9c2b4', '#7ea968']
      : ['#b5502e', '#f2ece0', '#c9c2b4', '#d97c53'];
    if(avecConfettis) launchConfetti(palette);
    else $('confettiField').innerHTML = '';
    el.win.classList.add('show');
    renderCarte();
    // Au clavier, le focus passe sur l'écran de victoire (au toucher, rien ne change)
    if(widget.contains(document.activeElement)) el.playAgainBtn.focus({ preventScroll: true });
  }

  function cacherVictoire(){
    const focusDedans = el.win.contains(document.activeElement);
    el.win.classList.remove('show', 'win-a', 'win-b');
    if(focusDedans) (el.undoBtn.disabled ? el.resetBtn : el.undoBtn).focus({ preventScroll: true });
  }

  function checkWin(){
    if(state.scoreA >= state.target || state.scoreB >= state.target){
      state.finished = true;
      sauvegarderPartie(); // le dernier render() a eu lieu AVANT ce passage à finished=true
      afficherVictoire(true);
      el.annonce.textContent = el.winnerName.textContent + ', ' + el.finalScore.textContent;
      finDePartie();
    }
  }

  // ---------- Enregistrement dans « Mes parties » ----------

  function dureePartie(){
    const m = state.menes;
    return m.length ? m[m.length - 1].t - m[0].t : 0;
  }

  function assezLongue(){
    return state.menes.length >= MENES_MIN && dureePartie() >= DUREE_MIN;
  }

  // Ce que montre l'écran de fin, dans l'ordre des questions à régler
  function etatFin(){
    if (!state.finished) return 'rien';
    if (!session()) return assezLongue() ? 'invite' : 'rien';
    if (!assezLongue()) return 'courte';
    if (state.pasJoue) return 'pasjoue';
    if (!state.moiVu) return 'question';
    if (!state.garder) return 'desactive';
    if (state.retiree) return 'retiree';
    return 'enregistree';
  }

  function donneesPartie(){
    return {
      id: state.id,
      debut: state.debut,
      objectif: state.target,
      format: state.format,
      mon_equipe: state.moi,
      nom_a: state.nameA || null,
      nom_b: state.nameB || null,
      joueurs: { a: state.joueurs.a.slice(), b: state.joueurs.b.slice() },
      menes: state.menes.map(m => ({ e: m.equipe, p: m.points, t: m.t })),
      terrain: state.terrain ? state.terrain.o : null
    };
  }

  // File d'attente gardée sur le téléphone : { id: { action, donnees, email, quand } }. Une partie
  // jouée sans réseau part au retour de la connexion ; la dernière action sur une partie gagne
  // (enregistrer puis retirer = retirer). Chaque partie reste liée au compte qui l'a jouée.
  function lireFile(){
    try { return JSON.parse(localStorage.getItem(CLE_FILE) || '{}') || {}; } catch (e) { return {}; }
  }
  function ecrireFile(file){
    try { localStorage.setItem(CLE_FILE, JSON.stringify(file)); } catch (e) { }
  }

  function mettreEnFile(action){
    const s = session();
    if (!s || !state.id) return;
    const file = lireFile();
    file[state.id] = { action, donnees: action === 'enregistrer' ? donneesPartie() : { id: state.id }, email: s.email, quand: Date.now() };
    ecrireFile(file);
    if (action === 'enregistrer') state.envoi = 'en_cours';
    else state.envoi = '';
    render();
    envoyerFile();
  }

  function enregistrerSiPossible(){
    if (etatFin() === 'enregistree') mettreEnFile('enregistrer');
  }

  let envoiEnCours = false;
  async function envoyerFile(){
    const s = session();
    if (envoiEnCours || !compte || !s) return;
    envoiEnCours = true;
    const debutEnvoi = Date.now();
    try {
      const file = lireFile();
      Object.keys(file).forEach(id => { if (!file[id] || debutEnvoi - file[id].quand > 30 * 86400000) delete file[id]; });
      ecrireFile(file);
      for (const id of Object.keys(file)) {
        const item = file[id];
        if (item.email !== s.email) continue;
        const reponse = item.action === 'retirer'
          ? await compte.appel('POST', '/compte/parties/retirer', { id })
          : await compte.appel('POST', '/compte/parties', item.donnees);
        if (reponse.statut === 0 || reponse.statut === 401 || reponse.statut >= 500) {
          // Pas de réseau, session expirée ou Worker en panne : on réessaiera plus tard
          if (state.id === id && item.action === 'enregistrer') state.envoi = 'attente';
          if (reponse.statut === 401 && compte.verifier) compte.verifier();
          break;
        }
        // La partie a pu changer pendant l'envoi (équipes, terrain) : ne retirer de la file que
        // ce qui vient d'être envoyé ; la nouvelle version part au tour suivant.
        const actuelle = lireFile();
        if (actuelle[id] && actuelle[id].quand === item.quand) { delete actuelle[id]; ecrireFile(actuelle); }
        if (state.id === id && item.action === 'enregistrer' && !actuelle[id]) state.envoi = reponse.statut === 200 ? 'ok' : 'echec';
      }
    } finally {
      envoiEnCours = false;
      render();
      if (Object.values(lireFile()).some(i => i && i.email === s.email && i.quand >= debutEnvoi)) setTimeout(envoyerFile, 300);
    }
  }

  // Partie gagnée : terrain proposé, puis enregistrement (le terrain arrivé après repart avec
  // la même partie, qui est remplacée)
  function finDePartie(){
    if (!session() || !assezLongue()) return;
    proposerTerrain();
    enregistrerSiPossible();
  }

  // Partie annulée après sa fin (Annuler le dernier point) : elle n'est plus terminée, donc plus
  // enregistrée. Une nouvelle victoire la renverra sous le même identifiant.
  function annulerEnregistrement(){
    mettreEnFile('retirer');
  }

  // ---------- Terrain de la partie ----------
  // Proposé d'office à la fin seulement si la position est déjà autorisée pour le site (par
  // exemple par « Me localiser » sur la carte) ; sinon bouton « Ajouter le terrain », et la
  // demande du navigateur n'apparaît que si on le touche. Une revanche le même jour reprend le
  // terrain de la partie précédente.

  let terrains = null;   // promesse : lieux de data/recherche.json avec leur nom affiché
  let messageTerrain = '';

  function chargerTerrains(){
    if (!terrains) {
      terrains = fetch('/data/recherche.json')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(d => {
          const communes = {};
          d.communes.forEach(c => { communes[c.s] = typeof c.n === 'string' ? c.n : (c.n[langue] || c.n.fr); });
          return d.lieux.map(l => ({
            o: l.o, lat: l.lat, lon: l.lon,
            nom: (l.r ? libelle('popup_terrain_prefix') + ' ' + l.r : libelle('popup_terrain_default')) + ' · ' + (l.l || communes[l.c] || '')
          }));
        })
        .catch(e => { terrains = null; throw e; });
    }
    return terrains;
  }

  function distance(lat1, lon1, lat2, lon2){
    const r = Math.PI / 180;
    const x = (lon2 - lon1) * r * Math.cos((lat1 + lat2) / 2 * r);
    const y = (lat2 - lat1) * r;
    return 6371000 * Math.sqrt(x * x + y * y);
  }

  function position(){
    return new Promise((ok, refus) => {
      if (!navigator.geolocation) { refus(new Error('geo')); return; }
      navigator.geolocation.getCurrentPosition(p => ok(p.coords), refus, { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 });
    });
  }

  function terrainsProches(coords, rayon){
    return chargerTerrains().then(liste => liste
      .map(t => Object.assign({}, t, { d: distance(coords.latitude, coords.longitude, t.lat, t.lon) }))
      .filter(t => t.d <= rayon)
      .sort((x, y) => x.d - y.d));
  }

  function aujourdhui(){ return new Date().toDateString(); }

  function choisirTerrain(t){
    state.terrain = t ? { o: t.o, nom: t.nom, d: Math.round(t.d) } : null;
    state.terrainJour = t ? aujourdhui() : '';
    messageTerrain = '';
    if (etatFin() === 'enregistree') mettreEnFile('enregistrer'); else render();
  }

  async function proposerTerrain(){
    messageTerrain = '';
    if (state.terrain && state.terrainJour === aujourdhui()) return;   // revanche
    state.terrain = null;
    try {
      if (!navigator.permissions || !navigator.geolocation) return;
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (permission.state !== 'granted') return;
      const proches = await terrainsProches(await position(), RAYON_PROPOSE);
      if (proches.length && state.finished && !state.terrain) choisirTerrain(proches[0]);
    } catch (e) { /* position ou liste des terrains indisponible : le bouton reste */ }
  }

  function formatDistance(d){
    return d < 1000 ? Math.round(d / 10) * 10 + ' m' : (Math.round(d / 100) / 10).toLocaleString(langue) + ' km';
  }

  async function ouvrirTerrains(){
    messageTerrain = libelle('compteur_recherche_position');
    render();
    let proches;
    try {
      proches = await terrainsProches(await position(), RAYON_LISTE);
    } catch (e) {
      messageTerrain = libelle('compteur_position_refusee');
      render();
      return;
    }
    messageTerrain = '';
    render();
    const liste = $('listeTerrains');
    liste.innerHTML = proches.length
      ? proches.slice(0, 8).map((t, i) => '<button type="button" class="terrain-choix" data-i="' + i + '">' + PICTOS.lieu +
          '<span>' + echapper(t.nom) + '</span><small>' + formatDistance(t.d) + '</small></button>').join('')
      : '<p class="note-feuille">' + echapper(libelle('compteur_aucun_terrain')) + '</p>';
    liste.onclick = (ev) => {
      const b = ev.target.closest('.terrain-choix');
      if (!b) return;
      fermerPanneau(el.terrainModal);
      choisirTerrain(proches[Number(b.dataset.i)]);
    };
    ouvrirPanneau(el.terrainModal, el.terrainModal.querySelector('[data-fermer]'));
  }

  // ---------- Partager la partie ----------
  // Un seul QR code « Rejoindre cette partie » : pendant la partie, les autres joueurs suivent le
  // score sur partie.html (« Actualiser ») ; à la fin, la partie arrive aussi dans leurs parties.
  // Partager demande d'être connecté (le Worker sait ainsi qui marque) et du réseau. Une fois la
  // partie partagée, chaque mène part au Worker (/compte/partage/etat), qui répond qui a rejoint.

  const QR_LIB = '/lib/qrcode-generator-1.4.4/qrcode.js';
  let qrCharge = null;          // promesse : bibliothèque du QR code, chargée au premier partage
  let etatPartageUi = '';       // '', 'chargement', 'reseau', 'erreur', 'connexion'
  let messagePartage = '';      // « Lien copié »

  function prefixeLangue(){ return langue === 'fr' ? '/' : '/' + langue + '/'; }
  function lienPartage(){ return location.origin + prefixeLangue() + 'partie.html?code=' + state.partage.code; }

  function chargerQr(){
    if (!qrCharge) {
      qrCharge = new Promise((ok, refus) => {
        const script = document.createElement('script');
        script.src = QR_LIB;
        script.onload = () => (window.qrcode ? ok(window.qrcode) : refus(new Error('qr')));
        script.onerror = () => { qrCharge = null; refus(new Error('qr')); };
        document.head.appendChild(script);
      });
    }
    return qrCharge;
  }

  // Ce que voient les autres joueurs : la forme de la partie et ses mènes (le Worker recalcule le score)
  function etatPartage(){
    return {
      objectif: state.target, format: state.format, mon_equipe: state.moi,
      nom_a: state.nameA || null, nom_b: state.nameB || null,
      joueurs: { a: state.joueurs.a.slice(), b: state.joueurs.b.slice() },
      menes: state.menes.map(m => ({ e: m.equipe, p: m.points, t: m.t })),
      debut: state.debut
    };
  }

  function rejoints(){ return state.partage ? state.partage.rejoints : []; }
  // Nom d'un joueur qui a rejoint : celui qu'il a choisi parmi les noms saisis, sinon son pseudo
  function nomRejoint(r){ return r.nom || r.pseudo || ''; }
  // Places des autres joueurs : « Partager la partie » reste sur l'écran de fin tant qu'il en reste
  function placesRestantes(){ return 2 * state.format - 1 - rejoints().length; }

  // Un joueur venu sur une place libre entre dans son équipe sous son pseudo (s'il reste de la
  // place) : le compteur affiche ainsi « Vous & Jolie », et la partie enregistrée le compte
  function majRejoints(liste){
    if (!state.partage || !Array.isArray(liste)) return;
    state.partage.rejoints = liste;
    let ajout = false;
    liste.forEach(r => {
      if (r.nom || !r.pseudo || (r.equipe !== 'a' && r.equipe !== 'b')) return;
      const dejaLa = state.joueurs.a.concat(state.joueurs.b).some(n => cleNom(n) === cleNom(r.pseudo));
      if (!dejaLa && state.joueurs[r.equipe].length < places(r.equipe)) { state.joueurs[r.equipe].push(r.pseudo); ajout = true; }
    });
    if (ajout) {
      render();
      if (state.finished && etatFin() === 'enregistree') mettreEnFile('enregistrer');
      else envoyerEtatPartage();
    }
    sauvegarderPartie();
    if (el.partageModal.classList.contains('show')) renderPartage();
    if (el.win.classList.contains('show')) renderCarte();
  }

  // Score envoyé après chaque mène (regroupé si plusieurs actions se suivent) ; sans réseau, le
  // suivant part au retour de la connexion
  let minuteurEtat = null;
  function envoyerEtatPartage(){
    if (!state.partage || !session() || !compte) return;
    clearTimeout(minuteurEtat);
    minuteurEtat = setTimeout(async () => {
      const code = state.partage && state.partage.code;
      if (!code) return;
      const r = await compte.appel('POST', '/compte/partage/etat', { code, etat: etatPartage() });
      if (!state.partage || state.partage.code !== code) return;
      if (r.statut === 200) majRejoints(r.donnees.rejoints);
      else if (r.statut === 404) { state.partage = null; sauvegarderPartie(); }   // code expiré : un autre sera tiré
    }, 400);
  }

  // Crée le partage, ou retrouve le même code (le Worker dit aussi qui a rejoint entre-temps)
  async function demanderPartage(){
    if (!session() || !compte) { etatPartageUi = 'connexion'; renderPartage(); return; }
    if (!state.id) { state.id = nouvelIdentifiant(); sauvegarderPartie(); }
    etatPartageUi = state.partage ? '' : 'chargement';
    renderPartage();
    const r = await compte.appel('POST', '/compte/partage', { partie_id: state.id, etat: etatPartage() });
    if (r.statut === 200) {
      state.partage = { code: r.donnees.code, rejoints: Array.isArray(r.donnees.rejoints) ? r.donnees.rejoints : [] };
      etatPartageUi = '';
      sauvegarderPartie();
    } else if (!state.partage) {
      etatPartageUi = r.statut === 0 ? 'reseau' : r.statut === 401 ? 'connexion' : 'erreur';
      if (r.statut === 401 && compte.verifier) compte.verifier();
    }
    if (el.partageModal.classList.contains('show')) renderPartage();
    if (el.win.classList.contains('show')) renderCarte();
  }

  function ouvrirPartage(){
    messagePartage = '';
    ouvrirPanneau(el.partageModal, el.partageModal.querySelector('[data-fermer]'));
    demanderPartage();
  }

  function renderPartage(){
    const c = el.partageCorps;
    if (etatPartageUi === 'connexion') {
      c.innerHTML = '<p class="note-feuille">' + echapper(libelle('compteur_partage_connexion')) + '</p>' +
        '<button type="button" class="bouton-plein" data-action="connexion">' + echapper(libelle('menu_se_connecter')) + '</button>';
      return;
    }
    if (!state.partage) {
      const cle = { reseau: 'compteur_partage_reseau', erreur: 'compte_err_generique' }[etatPartageUi] || 'compteur_partage_chargement';
      c.innerHTML = '<p class="note-feuille">' + echapper(libelle(cle)) + '</p>' +
        (etatPartageUi === 'reseau' || etatPartageUi === 'erreur' ? '<button type="button" class="bouton-plein" data-action="reessayer">' + echapper(libelle('compteur_reessayer')) + '</button>' : '');
      return;
    }
    // Places de chaque équipe : le marqueur, les noms saisis (rejoint ou pas encore), les joueurs
    // venus sur une place libre, puis les places encore libres
    const s = session();
    let places = '';
    ['a', 'b'].forEach(e => {
      const lignePlace = (n, etat, ok, libre) => '<div class="place-partage ' + e + (libre ? ' libre' : '') + '"><span class="n">' + echapper(n) + '</span>' +
        (etat ? '<span class="etat-place' + (ok ? ' ok' : '') + '">' + echapper(etat) + '</span>' : '') + '</div>';
      const venus = rejoints().filter(r => r.equipe === e);
      if (state.moi === e) places += lignePlace((s && (s.pseudo || s.email)) || libelle('compteur_vous'), libelle('compteur_marqueur'), true);
      const surNom = r => state.joueurs[e].some(n => cleNom(n) === cleNom(nomRejoint(r)));
      state.joueurs[e].forEach(n => {
        const venu = venus.some(r => cleNom(nomRejoint(r)) === cleNom(n));
        places += lignePlace(n, libelle(venu ? 'compteur_a_rejoint' : 'compteur_pas_encore'), venu);
      });
      // Venus sur une place libre, sans place dans l'équipe du compteur (équipe déjà pleine)
      const enPlus = venus.filter(r => !r.nom && !surNom(r));
      enPlus.forEach(r => { places += lignePlace(r.pseudo || '', libelle('compteur_a_rejoint'), true); });
      const libres = state.format - (state.moi === e ? 1 : 0) - state.joueurs[e].length - enPlus.length;
      for (let k = 0; k < libres; k++) places += lignePlace(libelle('compteur_place_libre'), '', false, true);
    });
    c.innerHTML =
      '<p class="note-feuille">' + echapper(libelle(state.finished ? 'compteur_partager_explication_fin' : 'compteur_partager_explication')) + '</p>' +
      '<div class="qr-partage"><div class="qr-image" id="qrImage"></div>' +
      '<div class="code-partage">' + echapper(state.partage.code) + '<small>' + echapper(libelle('compteur_code_aide')) + '</small></div></div>' +
      '<div class="places-partage">' + places + '</div>' +
      '<div class="actions-partage">' +
      '<button type="button" class="bouton-ligne" data-action="envoyerLien">' + PICTOS.envoyer + ' ' + echapper(libelle('compteur_envoyer_lien')) + '</button>' +
      '<button type="button" class="bouton-ligne" data-action="actualiser">' + echapper(libelle('compteur_actualiser')) + '</button></div>' +
      '<p class="note-feuille" role="status">' + echapper(messagePartage) + '</p>' +
      '<button type="button" class="bouton-plein" data-fermer>' + echapper(libelle('compteur_ok')) + '</button>';
    const lien = lienPartage();
    chargerQr().then(qrcode => {
      const zone = $('qrImage');
      if (!zone) return;
      const qr = qrcode(0, 'M');
      qr.addData(lien);
      qr.make();
      zone.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: libelle('compteur_qr_alt') });
    }).catch(() => { const zone = $('qrImage'); if (zone) zone.hidden = true; });   // le code et le lien suffisent
  }

  el.partageCorps.addEventListener('click', async (ev)=>{
    const b = ev.target.closest('[data-action]');
    if (!b) return;
    const action = b.dataset.action;
    if (action === 'connexion') { location.href = prefixeLangue() + 'connexion.html?retour=' + encodeURIComponent(location.pathname); return; }
    if (action === 'reessayer' || action === 'actualiser') { messagePartage = ''; demanderPartage(); return; }
    if (action === 'envoyerLien' && state.partage) {
      const lien = lienPartage();
      // Partage du téléphone (WhatsApp, SMS…) s'il existe, sinon le lien est copié
      if (navigator.share) {
        try { await navigator.share({ title: libelle('compteur_partage_message'), url: lien }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(lien); messagePartage = libelle('compteur_lien_copie'); }
      catch (e) { messagePartage = lien; }
      renderPartage();
    }
  });

  $('partagerBtn').addEventListener('click', ouvrirPartage);

  // ---------- Carte de l'écran de fin ----------

  function ligne(pictoHtml, contenu){
    return '<div class="ligne-carte">' + pictoHtml + '<span>' + contenu + '</span></div>';
  }
  function bouton(action, texte, classe, attributs){
    return '<button type="button" class="lien-carte' + (classe ? ' ' + classe : '') + '" data-action="' + action + '"' + (attributs || '') + '>' + texte + '</button>';
  }

  function texteJoueurs(){
    const autre = state.moi === 'a' ? 'b' : 'a';
    const avec = state.joueurs[state.moi], contre = state.joueurs[autre];
    if (!avec.length && !contre.length) return libelle('compteur_non_precises', { format: libelle('compteur_format_' + state.format + '_nom') });
    if (!avec.length) return libelle('compteur_contre_seul', { noms: listeEt(contre) });
    return libelle('compteur_avec', { noms: listeEt(avec) }) + (contre.length ? ', ' + libelle('compteur_contre', { noms: listeEt(contre) }) : '');
  }

  function renderCarte(){
    const etat = etatFin();
    const carte = el.cartePartie;
    carte.hidden = etat === 'rien';
    if (etat === 'rien') { carte.innerHTML = ''; return; }
    let h = '';
    if (etat === 'invite') {
      h = bouton('connexion', PICTOS.entrer + echapper(libelle('compteur_garder_historique')), 'plein') +
        '<div class="discret">' + echapper(libelle('compteur_gratuit')) + '</div>';
    } else if (etat === 'courte') {
      h = '<div class="tete-carte neutre">' + PICTOS.info + echapper(libelle('compteur_trop_courte')) + '</div>';
    } else if (etat === 'pasjoue') {
      h = '<div class="tete-carte neutre">' + PICTOS.info + echapper(libelle('compteur_pas_joue_msg')) + '</div>' +
        '<div class="liens-carte">' + bouton('trompe', echapper(libelle('compteur_trompe'))) + '</div>';
    } else if (etat === 'question' && state.quiEstMoi) {
      h = '<div class="tete-carte neutre">' + PICTOS.equipes + echapper(libelle('compteur_lequel')) + '</div>' +
        '<div class="liens-carte">' + state.joueurs[state.quiEstMoi].map((n, i) => bouton('cestmoi', echapper(n), '', ' data-i="' + i + '"')).join('') + '</div>';
    } else if (etat === 'question') {
      h = '<div class="tete-carte neutre">' + PICTOS.equipes + echapper(libelle('compteur_quelle_equipe')) + '</div>' +
        '<div class="choix-equipe">' + bouton('moi', echapper(nom('a')), 'equipe-a', ' data-e="a"') + bouton('moi', echapper(nom('b')), 'equipe-b', ' data-e="b"') +
        bouton('pasjoue', echapper(libelle('compteur_pas_joue')), 'aucune') + '</div>';
    } else if (etat === 'desactive') {
      h = '<div class="tete-carte neutre">' + PICTOS.info + echapper(libelle('compteur_desactive')) + '</div>' +
        '<div class="liens-carte">' + bouton('garder', echapper(libelle('compteur_lenregistrer')), 'plein') + '</div>';
    } else if (etat === 'retiree') {
      h = '<div class="tete-carte neutre">' + PICTOS.info + echapper(libelle('compteur_retiree')) + '</div>' +
        '<div class="liens-carte">' + bouton('remettre', echapper(libelle('compteur_annuler_retrait'))) + '</div>';
    } else {
      const titres = { ok: 'compteur_enregistree', en_cours: 'compteur_enregistrement', attente: 'compteur_attente', echec: 'compteur_echec' };
      const statut = state.envoi || 'en_cours';
      const moiScore = state.moi === 'a' ? state.scoreA : state.scoreB;
      const leurScore = state.moi === 'a' ? state.scoreB : state.scoreA;
      const gagne = moiScore >= state.target;
      const fanny = (state.scoreA === 0 || state.scoreB === 0) ? ' <span class="fanny">' + echapper(libelle('compteur_fanny')) + '</span>' : '';
      const minutes = Math.max(1, Math.round(dureePartie() / 60));
      let terrain;
      if (state.terrain) {
        terrain = ligne(PICTOS.lieu, echapper(state.terrain.nom) + ' ' + bouton('terrain', echapper(libelle('compteur_changer')), 'petit') + bouton('sansTerrain', echapper(libelle('compteur_retirer')), 'petit'));
      } else if (messageTerrain) {
        terrain = ligne(PICTOS.lieu, '<span class="discret">' + echapper(messageTerrain) + '</span>');
      } else {
        terrain = '<div class="liens-carte">' + bouton('terrain', PICTOS.lieu + echapper(libelle('compteur_ajouter_terrain'))) + '</div>';
      }
      // Partie partagée : elle arrive aussi chez les joueurs qui l'ont rejointe
      const venus = rejoints().map(nomRejoint).filter(Boolean);
      const aussi = venus.length ? ligne(PICTOS.ok, echapper(libelle('compteur_aussi_chez', { noms: listeEt(venus) }))) : '';
      // Une fois enregistrée, le titre mène à la page « Mes parties »
      const titre = statut === 'ok'
        ? '<a href="' + (langue === 'fr' ? '/' : '/' + langue + '/') + 'mes-parties.html">' + echapper(libelle(titres[statut])) + '</a>'
        : echapper(libelle(titres[statut]));
      h = '<div class="tete-carte' + (statut === 'ok' ? '' : ' neutre') + '">' + (statut === 'ok' ? PICTOS.ok : PICTOS.info) + titre + '</div>' +
        '<div class="ligne-carte"><span class="resultat ' + (gagne ? 'v' : 'd') + '">' + echapper(libelle(gagne ? 'compteur_victoire' : 'compteur_defaite')) + ' ' + moiScore + ' – ' + leurScore + '</span>' + fanny + '</div>' +
        ligne(PICTOS.horloge, echapper(libelle('compteur_duree', { menes: state.menes.length, minutes }))) +
        ligne(PICTOS.equipes, echapper(texteJoueurs())) +
        aussi +
        terrain +
        '<div class="liens-carte">' + (placesRestantes() > 0 ? bouton('partager', PICTOS.qr + echapper(libelle('compteur_partager_titre'))) : '') +
        bouton('equipes', PICTOS.crayon + echapper(libelle('compteur_modifier_equipes'))) +
        bouton('retirer', PICTOS.croix + echapper(libelle('compteur_retirer_partie'))) + '</div>';
    }
    carte.innerHTML = h;
  }

  el.cartePartie.addEventListener('click', (ev)=>{
    const b = ev.target.closest('[data-action]');
    if (!b) return;
    const action = b.dataset.action;
    if (action === 'connexion') {
      const prefixe = langue === 'fr' ? '/' : '/' + langue + '/';
      location.href = prefixe + 'connexion.html?retour=' + encodeURIComponent(location.pathname);
      return;
    }
    if (action === 'moi') {
      const e = b.dataset.e;
      if (state.joueurs[e].length >= state.format) { state.quiEstMoi = e; render(); return; }
      state.moi = e; state.moiVu = true; state.quiEstMoi = null;
      finDePartie();
    }
    if (action === 'cestmoi') {
      const e = state.quiEstMoi;
      state.joueurs[e].splice(Number(b.dataset.i), 1);
      state.moi = e; state.moiVu = true; state.quiEstMoi = null;
      finDePartie();
    }
    if (action === 'pasjoue') { state.pasJoue = true; state.quiEstMoi = null; }
    if (action === 'trompe') { state.pasJoue = false; }
    if (action === 'garder') { state.garder = true; finDePartie(); }
    if (action === 'retirer') { state.retiree = true; mettreEnFile('retirer'); }
    if (action === 'remettre') { state.retiree = false; enregistrerSiPossible(); }
    if (action === 'terrain') { ouvrirTerrains(); return; }
    if (action === 'sansTerrain') { choisirTerrain(null); return; }
    if (action === 'equipes') { ouvrirEquipes(); return; }
    if (action === 'partager') { ouvrirPartage(); return; }
    render();
    afficherVictoire(false);
  });

  // ---------- Actions ----------

  // Écran allumé pendant la partie (API Wake Lock) : sans ça, le téléphone se met en veille
  // entre deux mènes. Demandé au premier point marqué ; le navigateur le relâche quand l'onglet
  // passe en arrière-plan, on le redemande au retour. Sans l'API (vieux navigateurs) : rien.
  let verrouEcran = null;
  let verrouSouhaite = false;

  async function garderEcranAllume(){
    verrouSouhaite = true;
    if(!('wakeLock' in navigator) || verrouEcran || document.visibilityState !== 'visible') return;
    try {
      verrouEcran = await navigator.wakeLock.request('screen');
      verrouEcran.addEventListener('release', ()=>{ verrouEcran = null; });
    } catch (e) { /* refusé (mode économie d'énergie...) : pas bloquant */ }
  }

  document.addEventListener('visibilitychange', ()=>{
    if(verrouSouhaite && document.visibilityState === 'visible') garderEcranAllume();
    if(document.visibilityState === 'visible') envoyerFile();
  });

  // Un appel = une mène gagnée par cette équipe (1 à 6 points)
  function addPoints(team, pts){
    if(state.finished) return;
    garderEcranAllume();
    snapshot();
    if (!state.menes.length) { if (!state.id || !state.partage) state.id = nouvelIdentifiant(); state.debut = Date.now(); }
    if(team === 'a') state.scoreA = Math.min(state.scoreA + pts, state.target);
    else state.scoreB = Math.min(state.scoreB + pts, state.target);
    const t = Math.max(0, Math.round((Date.now() - state.debut) / 1000));
    state.menes.push({ equipe: team, points: pts, a: state.scoreA, b: state.scoreB, t });
    render();
    signalerGain(team, pts);
    annoncerScore();
    checkWin();
    envoyerEtatPartage();
  }

  function undo(){
    const prev = history.pop();
    if(!prev) return;
    const etaitFinie = state.finished, idAvant = state.id, envoyee = !!state.envoi;
    Object.assign(state, JSON.parse(prev));
    // Victoire annulée : la partie n'est plus terminée, elle sort de « Mes parties »
    if (etaitFinie && envoyee && !state.finished && state.id === idAvant) annulerEnregistrement();
    el.undoBtn.disabled = history.length === 0;
    cacherVictoire();
    render();
    annoncerScore();
    if(state.finished) afficherVictoire(false);
    envoyerEtatPartage();
  }

  // Remise à zéro annulable (on ne vide pas l'historique) : un toucher malheureux sur
  // « Nouvelle partie » ou sur 11/13 ne fait pas perdre la partie en cours. Équipes, joueurs,
  // format et terrain restent : la revanche ne demande rien.
  function newGame(nouvelleCible){
    if(state.scoreA || state.scoreB || state.menes.length) snapshot();
    if(nouvelleCible) state.target = nouvelleCible;
    state.scoreA = 0;
    state.scoreB = 0;
    state.menes = [];
    state.finished = false;
    Object.assign(state, { id: null, debut: null, garder: true, moiVu: false, pasJoue: false, quiEstMoi: null, retiree: false, envoi: '', partage: null });
    messageTerrain = '';
    cacherVictoire();
    render();
    annoncerScore();
  }

  // Toucher la moitié d'une équipe = +1, sauf sur une pastille (+2 à +6, ou +1 au clavier) ou
  // sur son nom (panneau « Équipes »)
  [['a', el.teamA], ['b', el.teamB]].forEach(([team, teamEl])=>{
    teamEl.addEventListener('click', (e)=>{
      if (e.target.closest('.name')) { ouvrirEquipes(); return; }
      const chip = e.target.closest('.chip');
      addPoints(team, chip ? Number(chip.dataset.pts) : 1);
    });
  });

  el.undoBtn.addEventListener('click', undo);
  $('undoWinBtn').addEventListener('click', undo);
  el.resetBtn.addEventListener('click', ()=> newGame());
  el.playAgainBtn.addEventListener('click', ()=> newGame());

  el.targetToggle.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn || Number(btn.dataset.t) === state.target) return;
    newGame(Number(btn.dataset.t));
  });

  // ---------- Panneaux ----------

  // Le focus revient au bouton d'ouverture à la fermeture (navigation au clavier). Une pile, car
  // « Ajouter un joueur » s'ouvre par-dessus « Équipes ».
  const focusAvantPanneau = [];

  function ouvrirPanneau(panneau, cibleFocus){
    focusAvantPanneau.push(document.activeElement);
    panneau.classList.add('show');
    setTimeout(()=> cibleFocus.focus({ preventScroll: true }), 50);
  }

  function fermerPanneau(panneau){
    if (!panneau.classList.contains('show')) return;
    panneau.classList.remove('show');
    const avant = focusAvantPanneau.pop();
    if(avant && widget.contains(avant)) avant.focus({ preventScroll: true });
    if (panneau === el.equipesModal) apresEquipes();
  }

  widget.addEventListener('click', (ev)=>{
    const fermer = ev.target.closest('[data-fermer]');
    if (fermer) { fermerPanneau(fermer.closest('.feuille')); return; }
    // Toucher le voile autour d'une feuille la ferme
    if (ev.target.classList && ev.target.classList.contains('feuille')) fermerPanneau(ev.target);
  });

  // ---------- Panneau « Équipes » ----------

  let equipesAvant = '';   // pour ne renvoyer la partie terminée que si quelque chose a changé

  function ouvrirEquipes(){
    equipesAvant = JSON.stringify([state.format, state.moi, state.joueurs, state.nameA, state.nameB, state.garder]);
    renderEquipes();
    ouvrirPanneau(el.equipesModal, el.equipesModal.querySelector('[data-fermer]'));
  }

  function apresEquipes(){
    const apres = JSON.stringify([state.format, state.moi, state.joueurs, state.nameA, state.nameB, state.garder]);
    if (apres === equipesAvant) return;
    envoyerEtatPartage();
    if (state.finished) {
      if (etatFin() === 'enregistree') mettreEnFile('enregistrer');
      else if (!state.garder && state.envoi) mettreEnFile('retirer');
      afficherVictoire(false);
    }
    render();
  }

  function renderEquipes(){
    const s = session();
    [...$('formats').children].forEach(b => {
      const actif = Number(b.dataset.f) === state.format;
      b.classList.toggle('actif', actif);
      b.setAttribute('aria-pressed', actif);
    });
    let h = '';
    ['a', 'b'].forEach(e => {
      const E = e.toUpperCase();
      let lignes = '';
      if (s && state.moi === e) {
        lignes += '<div class="joueur"><span class="n">' + echapper(s.pseudo || s.email || '') + ' <span class="vous">' + echapper(libelle('compteur_vous_parenthese')) + '</span></span>' +
          '<button type="button" data-action="echanger">' + PICTOS.echange + echapper(libelle('compteur_changer_equipe')) + '</button></div>';
      }
      state.joueurs[e].forEach((j, i) => {
        lignes += '<div class="joueur"><span class="n">' + echapper(j) + '</span><button type="button" data-action="retirerJoueur" data-e="' + e + '" data-i="' + i +
          '" aria-label="' + echapper(libelle('compteur_retirer_joueur', { nom: j })) + '">' + PICTOS.croix + '</button></div>';
      });
      const mot = !s ? 'compteur_ajouter_joueur' : (state.moi === e ? 'compteur_ajouter_partenaire' : 'compteur_ajouter_adversaire');
      for (let k = state.joueurs[e].length; k < places(e); k++) {
        lignes += '<button type="button" class="place-libre" data-action="ajouter" data-e="' + e + '">' + PICTOS.plus + echapper(libelle(mot)) + '</button>';
      }
      h += '<div class="bloc-equipe ' + e + '"><span class="titre-equipe">' + echapper(libelle('compteur_equipe_' + e)) + '</span>' +
        '<input type="text" class="champ" id="nomEquipe' + E + '" maxlength="20" autocomplete="off" placeholder="' + echapper(libelle('compteur_nom_equipe')) +
        '" aria-label="' + echapper(libelle('compteur_equipe_' + e) + ' — ' + libelle('compteur_nom_equipe')) + '" value="' + echapper(state['name' + E]) + '">' + lignes + '</div>';
    });
    el.blocsEquipes.innerHTML = h;
    $('caseGarder').hidden = !s;
    $('chkGarder').checked = state.garder;
    $('noteInvite').hidden = !!s;
  }

  // Un format plus petit libère des places : les derniers joueurs nommés sont retirés
  function ajusterJoueurs(){
    ['a', 'b'].forEach(e => { state.joueurs[e] = state.joueurs[e].slice(0, Math.max(0, places(e))); });
  }

  $('formats').addEventListener('click', (ev)=>{
    const b = ev.target.closest('button');
    if (!b) return;
    state.format = Number(b.dataset.f);
    ajusterJoueurs();
    renderEquipes();
    render();
  });

  el.blocsEquipes.addEventListener('click', (ev)=>{
    const b = ev.target.closest('[data-action]');
    if (!b) return;
    const action = b.dataset.action;
    if (action === 'echanger') {
      const de = state.moi, vers = de === 'a' ? 'b' : 'a';
      if (state.joueurs[vers].length >= state.format) state.joueurs[de].push(state.joueurs[vers].pop());
      state.moi = vers;
      ajusterJoueurs();
    }
    if (action === 'retirerJoueur') state.joueurs[b.dataset.e].splice(Number(b.dataset.i), 1);
    if (action === 'ajouter') { ouvrirJoueur(b.dataset.e); return; }
    renderEquipes();
    render();
  });

  el.blocsEquipes.addEventListener('input', (ev)=>{
    const m = ev.target.id && ev.target.id.match(/^nomEquipe([AB])$/);
    if (!m) return;
    const v = ev.target.value.trim();
    state['name' + m[1]] = v !== libelle('compteur_equipe_' + m[1].toLowerCase()) ? v : '';
    render();
  });

  $('chkGarder').addEventListener('change', ()=>{ state.garder = $('chkGarder').checked; render(); });

  // ---------- Ajouter un joueur ----------

  let equipeAjout = 'a';
  let joueursCompte = null;   // promesse : carnet du compte (/compte/joueurs), une fois par page

  function lireRecents(){
    try { const l = JSON.parse(localStorage.getItem(CLE_JOUEURS) || '[]'); return Array.isArray(l) ? l.filter(n => typeof n === 'string') : []; } catch (e) { return []; }
  }

  function retenirNom(n){
    const l = [n].concat(lireRecents().filter(x => cleNom(x) !== cleNom(n))).slice(0, 30);
    try { localStorage.setItem(CLE_JOUEURS, JSON.stringify(l)); } catch (e) { }
  }

  function carnetCompte(){
    if (!session() || !compte) return Promise.resolve([]);
    if (!joueursCompte) {
      joueursCompte = compte.appel('GET', '/compte/joueurs')
        .then(r => r.statut === 200 && Array.isArray(r.donnees.joueurs) ? r.donnees.joueurs.map(j => j.nom).filter(Boolean) : [])
        .catch(() => []);
    }
    return joueursCompte;
  }

  function renderRecents(noms){
    const pris = state.joueurs.a.concat(state.joueurs.b).map(cleNom);
    const vus = new Set(pris);
    const liste = [];
    noms.forEach(n => { const c = cleNom(n); if (!vus.has(c)) { vus.add(c); liste.push(n); } });
    $('recents').innerHTML = liste.slice(0, 12).map(n => '<button type="button">' + echapper(n) + '</button>').join('');
    $('recentsZone').hidden = !liste.length;
  }

  function ouvrirJoueur(e){
    equipeAjout = e;
    const s = session();
    const mot = !s ? 'compteur_ajouter_joueur' : (state.moi === e ? 'compteur_ajouter_partenaire' : 'compteur_ajouter_adversaire');
    $('joueurTitre').textContent = libelle(mot);
    $('noteNoms').textContent = libelle(s ? 'compteur_noms_prives' : 'compteur_noms_locaux');
    $('champJoueur').value = '';
    renderRecents(lireRecents());
    carnetCompte().then(noms => { if (el.joueurModal.classList.contains('show')) renderRecents(lireRecents().concat(noms)); });
    ouvrirPanneau(el.joueurModal, $('champJoueur'));
  }

  function ajouterJoueur(n){
    n = n.replace(/\s+/g, ' ').trim().slice(0, 20);
    if (!n) return;
    const dejaLa = state.joueurs.a.concat(state.joueurs.b).some(x => cleNom(x) === cleNom(n));
    if (!dejaLa && state.joueurs[equipeAjout].length < places(equipeAjout)) state.joueurs[equipeAjout].push(n);
    retenirNom(n);
    fermerPanneau(el.joueurModal);
    renderEquipes();
    render();
  }

  $('recents').addEventListener('click', (ev)=>{ const b = ev.target.closest('button'); if (b) ajouterJoueur(b.textContent); });
  $('ajouterJoueur').addEventListener('click', ()=> ajouterJoueur($('champJoueur').value));
  $('champJoueur').addEventListener('keydown', (ev)=>{ if (ev.key === 'Enter') ajouterJoueur($('champJoueur').value); });

  $('equipesBtn').addEventListener('click', ouvrirEquipes);

  // ---------- Panneau « Mènes » ----------

  function cellule(classe, texte){
    const span = document.createElement('span');
    span.className = classe;
    span.textContent = texte;
    return span;
  }

  // Détail des mènes, la plus récente en haut, avec le score après chacune
  function afficherDetail(){
    el.detailMenes.innerHTML = '';
    for(let i = state.menes.length - 1; i >= 0; i--){
      const m = state.menes[i];
      const li = document.createElement('li');
      li.className = m.equipe;
      li.append(
        cellule('numero', libelle('compteur_mene', { n: i + 1 })),
        cellule('equipe', nom(m.equipe)),
        cellule('points', '+' + m.points),
        cellule('apres', m.a + ' – ' + m.b)
      );
      el.detailMenes.appendChild(li);
    }
    el.detailMenes.hidden = state.menes.length === 0;
    el.detailVide.hidden = state.menes.length > 0;
    el.detailMenes.scrollTop = 0;
  }

  $('menesBtn').addEventListener('click', ()=>{
    afficherDetail();
    ouvrirPanneau(el.menesModal, $('closeMenes'));
  });
  $('closeMenes').addEventListener('click', ()=> fermerPanneau(el.menesModal));

  // ---------- Plein écran ----------

  // Bascule de classe CSS plutôt que l'API plein écran native du navigateur — même choix que
  // definirModePleinEcran() dans script.js pour le reste du site, pour la même raison (l'API
  // native n'est pas fiable sur Safari iOS, une part importante des visiteurs).
  function definirPleinEcran(actif) {
    widget.classList.toggle('fullscreen-active', actif);
    document.body.classList.toggle('fullscreen-lock', actif);
    el.fullscreenToggleBtn.innerHTML = actif ? ICON_MINIMIZE : ICON_MAXIMIZE;
    el.fullscreenToggleBtn.setAttribute('aria-label', libelle(actif ? 'fullscreen_exit' : 'fullscreen_enter'));
  }

  el.fullscreenToggleBtn.addEventListener('click', () => {
    definirPleinEcran(!widget.classList.contains('fullscreen-active'));
  });

  // Échap ferme d'abord un panneau ouvert, sinon quitte le plein écran
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const panneau = PANNEAUX.find(p => p.classList.contains('show'));
    if (panneau) fermerPanneau(panneau);
    else if (widget.classList.contains('fullscreen-active')) definirPleinEcran(false);
  });

  // ---------- Démarrage ----------

  // Connexion ou déconnexion (ici, dans un autre onglet, ou au retour de la page Connexion)
  window.addEventListener('mapetanque:compte', ()=>{
    joueursCompte = null;
    // Partie jouée sans être connecté : ses joueurs restent tels quels, la fin demandera lequel
    // on était
    if (!state.finished || state.moiVu) ajusterJoueurs();
    render();
    if (state.finished) afficherVictoire(false);
    envoyerFile();
  });
  window.addEventListener('online', ()=>{ envoyerFile(); envoyerEtatPartage(); });

  definirPleinEcran(false);
  restaurerPartie();
  // Envoi terminé pendant que la page était fermée : la partie n'attend plus dans la file
  if (state.finished && (state.envoi === 'attente' || state.envoi === 'en_cours') && !lireFile()[state.id]) state.envoi = 'ok';
  render();
  if (state.finished) afficherVictoire(false);
  envoyerFile();
  envoyerEtatPartage();   // partie partagée : qui a rejoint pendant que la page était fermée
})();
