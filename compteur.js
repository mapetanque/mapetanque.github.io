// Compteur de points simple (compteur.html et ses versions nl/de/en), sans compte : construit tout
// le widget dans #compteurWidget. Le score reste dans le téléphone, rien n'est envoyé ni partagé :
// le compteur d'avant les comptes (NOTES_parties_communes.md du dépôt privé des Workers, « Deux
// pages, un rôle chacune » ; maquette maquettes/parties-communes/, onglet « Compteur simple »).
// Score, 11 ou 13, Annuler, détail des mènes ; « Nous » et « Eux » se renomment pour le plaisir
// (« Noms », gardés dans le téléphone). À 0-0, la pièce (à la place d'Annuler) tire au sort
// l'équipe qui lance le but, ici dans le téléphone ; ensuite un petit cochonnet suit l'équipe qui a
// marqué la dernière mène (comme la partie en ligne, partie.js). Un bandeau invite à se créer un compte pour enregistrer ses
// parties et jouer à plusieurs : c'est partie.html, la partie en ligne.
// Connecté, « Compter les points » mène à partie.html : la page y renvoie d'office, sauf pendant
// une partie déjà commencée ici (elle se finit ici) ou avec ?simple=1.
// Seul endroit où se trouve sa logique, pour les quatre langues : textes dans translations.js (clés
// compteur_*), styles dans style-compteur.css. Indépendant de script.js. Utilise compte.js
// (window.mapetanqueCompte) seulement pour savoir si l'on est connecté.
(function(){
  const widget = document.getElementById('compteurWidget');
  if (!widget) return;

  const CLE_STOCKAGE = 'mapetanque_compteur_partie';
  const compte = window.mapetanqueCompte || null;

  // Partie non terminée sans aucun point pendant ce temps : elle s'arrête, une nouvelle commence
  const PAUSE_MAX = 12 * 3600 * 1000;

  // Langue de la page d'après son adresse (/nl/, /de/, /en/), comme le reste de son contenu, et
  // non la langue préférée enregistrée par script.js, qui peut être différente.
  const langueURL = location.pathname.match(/^\/(nl|de|en)\//);
  const langue = langueURL ? langueURL[1] : 'fr';
  const textes = translations[langue];
  const prefixe = langue === 'fr' ? '/' : '/' + langue + '/';

  // libelle('compteur_gagne', {equipe: 'Les Boulistes'}) → « Les Boulistes gagne »
  function libelle(cle, valeurs){
    let texte = textes[cle] || translations.fr[cle] || cle;
    for (const nom in valeurs) texte = texte.replace('{' + nom + '}', valeurs[nom]);
    return texte;
  }

  function echapper(texte){
    return String(texte).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function session(){ return compte ? compte.session() : null; }

  const ICON_MAXIMIZE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
  const ICON_MINIMIZE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';

  // Pictos au trait (Lucide), couleur héritée du texte
  function picto(chemins){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + chemins + '</svg>';
  }
  const PICTOS = {
    personne: picto('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    info: picto('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
    horloge: picto('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    plus: picto('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    crayon: picto('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
    ok: picto('<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>'),
    aide: picto('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    // Mêmes pictos que la partie en ligne (partie.js) pour la barre du bas
    annuler: picto('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'),
    liste: picto('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    piece: picto('<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>')
  };

  // Tirage au sort du but : la boule du site sur la pièce ; durée de la pose du petit cochonnet
  // (style-compteur.css, cochonnet-pose)
  const IMAGE_BOULE = '/images/mapetanque-boule-pleine.svg';
  const DUREE_POSE = 450;

  // Feuille « Comment ça marche ? » : les gestes du compteur. Les noms des boutons sont repris de
  // leurs propres libellés.
  function aideHtml(){
    const noms = {
      annuler: libelle('compteur_annuler'), menes: libelle('compteur_menes'),
      noms: libelle('compteur_noms'), mesparties: libelle('moncompte_parties_titre')
    };
    return [
      [PICTOS.plus, 'compteur_aide_marquer'],
      [PICTOS.piece, 'compteur_aide_but'],
      [PICTOS.crayon, 'compteur_aide_noms'],
      [PICTOS.personne, 'compteur_aide_compte'],
      [ICON_MAXIMIZE, 'compteur_aide_plein_ecran']
    ].map(([p, cle]) => '<li>' + p + '<span><b>' + echapper(libelle(cle)) + '</b>' + echapper(libelle(cle + '_texte', noms)) + '</span></li>').join('');
  }

  // ---------- Construction du widget ----------

  // Moitié d'une équipe ('a' ou 'b'), comme la partie en ligne : nom, score, pastilles +2 à +6,
  // « Touchez pour +1 ». Toucher la moitié donne +1 ; le bouton +1 caché ne sert qu'au clavier
  // (voir .chip-un dans style-compteur.css). Toucher le nom ouvre « Noms ».
  function moitie(equipe){
    const E = equipe.toUpperCase();
    let pastilles = '';
    for (let n = 1; n <= 6; n++) pastilles += '<button type="button" class="chip' + (n === 1 ? ' chip-un' : '') + '" data-pts="' + n + '">+' + n + '</button>';
    return `
    <div class="team ${equipe}" id="team${E}" role="group" aria-labelledby="name${E}">
      <button type="button" class="name" id="name${E}"></button>
      <div class="score" id="score${E}">0</div>
      <div class="controls">${pastilles}</div>
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
    <span class="topbar-icones">
      <button type="button" class="icone-topbar" id="aideBtn" aria-label="${echapper(libelle('compteur_aide'))}" title="${echapper(libelle('compteur_aide'))}">${PICTOS.aide}</button>
      <button type="button" class="fullscreen-toggle-btn" id="fullscreenToggleBtn"></button>
    </span>
  </div>

  <div class="halves">${moitie('a')}
    <div class="divider"></div>${moitie('b')}
    <div class="bandeau-main" id="bandeauMain" role="status" hidden></div>
  </div>

  <!-- En bas, comme la partie en ligne : « Mènes », le bouton rond Annuler, « Noms » -->
  <div class="bottombar">
    <button type="button" class="bouton-cote" id="menesBtn">${PICTOS.liste}<span>${libelle('compteur_menes')}</span></button>
    <button type="button" class="bouton-rond" id="undoBtn" disabled aria-label="${echapper(libelle('compteur_annuler'))}" title="${echapper(libelle('compteur_annuler'))}">${PICTOS.annuler}</button>
    <button type="button" class="bouton-piece" id="pieceBtn" hidden aria-label="${echapper(libelle('pc_tirer_but'))}" title="${echapper(libelle('pc_tirer_but'))}"><img src="${IMAGE_BOULE}" alt=""></button>
    <button type="button" class="bouton-cote" id="nomsBtn">${PICTOS.crayon}<span>${libelle('compteur_noms')}</span></button>
  </div>

  <a class="invite-compte" id="inviteCompte"></a>

  <div class="win" id="winOverlay" role="dialog" aria-modal="true" aria-labelledby="winnerName">
    <div class="confetti-field" id="confettiField"></div>
    <div class="trophy-line">${libelle('compteur_partie_terminee')}</div>
    <div class="winner-name" id="winnerName"></div>
    <div class="final-score" id="finalScore"></div>
    <div class="carte-partie" id="cartePartie"></div>
    <div class="boutons-fin">
      <button type="button" id="playAgainBtn">${libelle('compteur_nouvelle_partie')}</button>
    </div>
    <button type="button" id="undoWinBtn" class="secondary"><span aria-hidden="true">↺</span> ${libelle('compteur_annuler_point')}</button>
  </div>

  <div class="win" id="menesModal" role="dialog" aria-modal="true" aria-labelledby="menesTitre">
    <div class="trophy-line" id="menesTitre">${libelle('compteur_detail_titre')}</div>
    <ol class="detail-menes" id="detailMenes"></ol>
    <p class="detail-vide" id="detailVide">${libelle('compteur_detail_vide')}</p>
    <button type="button" id="closeMenes" class="secondary">${libelle('close_panel')}</button>
  </div>

  <div class="feuille" id="nomsModal" role="dialog" aria-modal="true" aria-labelledby="nomsTitre">
    <div class="feuille-corps">
      ${enteteFeuille('nomsTitre', libelle('compteur_noms_titre'))}
      <div class="bloc-equipe a"><span class="titre-equipe">${libelle('compteur_equipe_a')}</span>
        <input type="text" class="champ" id="nomEquipeA" maxlength="20" autocomplete="off" placeholder="${echapper(libelle('compteur_nous'))}" aria-label="${echapper(libelle('compteur_equipe_a'))}"></div>
      <div class="bloc-equipe b"><span class="titre-equipe">${libelle('compteur_equipe_b')}</span>
        <input type="text" class="champ" id="nomEquipeB" maxlength="20" autocomplete="off" placeholder="${echapper(libelle('compteur_eux'))}" aria-label="${echapper(libelle('compteur_equipe_b'))}"></div>
      <button type="button" class="bouton-plein" data-fermer>${libelle('compteur_ok')}</button>
    </div>
  </div>

  <div class="feuille" id="aideModal" role="dialog" aria-modal="true" aria-labelledby="aideTitre">
    <div class="feuille-corps">
      ${enteteFeuille('aideTitre', libelle('compteur_aide'))}
      <ul class="aide-liste">${aideHtml()}</ul>
      <div class="aide-pied"><button type="button" class="bouton-plein" data-fermer>${libelle('compteur_ok')}</button></div>
    </div>
  </div>

  <div class="sr-only" id="annonce" aria-live="polite"></div>
</div>`;

  const $ = id => document.getElementById(id);
  const el = {
    teamA: $('teamA'), teamB: $('teamB'),
    scoreA: $('scoreA'), scoreB: $('scoreB'),
    nameA: $('nameA'), nameB: $('nameB'),
    undoBtn: $('undoBtn'),
    pieceBtn: $('pieceBtn'),
    bandeauMain: $('bandeauMain'),
    inviteCompte: $('inviteCompte'),
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
    nomsModal: $('nomsModal'),
    annonce: $('annonce'),
    fullscreenToggleBtn: $('fullscreenToggleBtn'),
  };
  const PANNEAUX = [$('aideModal'), el.nomsModal, el.menesModal];   // du plus haut au plus bas

  // ---------- État de la partie ----------

  // menes : une entrée par mène, { equipe: 'a'|'b', points, a, b, t } (a et b : score après la
  // mène ; t : secondes depuis le premier point). nameA/nameB vides = « Nous » et « Eux », dans la
  // langue de la page ; ils restent pour la partie suivante. but : l'équipe tirée au sort pour lancer
  // le but à la 1re mène ('a', 'b', ou null sans tirage).
  const state = {
    target: 13,
    scoreA: 0,
    scoreB: 0,
    menes: [],
    finished: false,
    nameA: '',
    nameB: '',
    debut: null,         // heure du premier point (ms)
    but: null,
  };
  const history = [];
  // Équipe au petit cochonnet, et depuis quand (il se pose quand il change d'équipe)
  let lanceVu = null;
  let messageBandeau = '';
  let minuteurBandeau = null;

  // Nom affiché d'une équipe : nom saisi, sinon « Nous » (en haut) ou « Eux » (en bas)
  function nom(equipe){
    return state['name' + equipe.toUpperCase()] || libelle(equipe === 'a' ? 'compteur_nous' : 'compteur_eux');
  }

  // Persistance de la partie en cours (localStorage), pour survivre à une fermeture d'onglet
  // accidentelle. Ne sauvegarde jamais l'historique Annuler.
  function sauvegarderPartie(){
    try {
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify(state));
    } catch (e) { /* stockage indisponible (navigation privée, quota...) : pas bloquant */ }
  }

  // Sauvegarde du compteur d'avant (joueurs, format, partage…) : seul le score et les noms
  // saisis sont repris ; les noms par défaut d'alors (« Équipe A »…) redeviennent « Nous » et « Eux ».
  function restaurerPartie(){
    let brut = null;
    try { brut = JSON.parse(localStorage.getItem(CLE_STOCKAGE) || 'null'); } catch (e) { }
    if (!brut || typeof brut !== 'object') return;
    if (brut.target === 11 || brut.target === 13) state.target = brut.target;
    state.menes = Array.isArray(brut.menes) ? brut.menes.filter(m => m && (m.equipe === 'a' || m.equipe === 'b') && Number.isInteger(m.points)) : [];
    state.menes.forEach(m => { if (typeof m.t !== 'number') m.t = 0; });
    const der = state.menes[state.menes.length - 1];
    state.scoreA = der ? Math.min(state.target, der.a) : 0;
    state.scoreB = der ? Math.min(state.target, der.b) : 0;
    state.finished = state.scoreA >= state.target || state.scoreB >= state.target;
    state.debut = state.menes.length ? (Number(brut.debut) || Date.now()) : null;
    state.but = brut.but === 'a' || brut.but === 'b' ? brut.but : null;
    const nomsParDefaut = Object.keys(translations).flatMap(l =>
      [translations[l].compteur_equipe_a, translations[l].compteur_equipe_b, translations[l].compteur_nous, translations[l].compteur_eux]);
    ['nameA', 'nameB'].forEach(k => {
      const v = typeof brut[k] === 'string' ? brut[k].trim().slice(0, 20) : '';
      state[k] = nomsParDefaut.includes(v) ? '' : v;
    });
  }

  function snapshot(){
    history.push(JSON.stringify(state));
    if(history.length > 60) history.shift();
    el.undoBtn.disabled = false;
  }

  // ---------- Affichage ----------

  // Petit cochonnet : l'équipe tirée au sort avant la 1re mène (personne sans tirage), puis celle
  // qui a marqué la dernière mène. Il se pose quand il change d'équipe ; chaque render() redessine
  // le nom, un render() pendant la pose la reprend où elle en est (délai négatif), sans la couper.
  // Au chargement de la page, il est déjà posé.
  function equipeAuBut(){
    const der = state.menes[state.menes.length - 1];
    const lance = der ? der.equipe : state.but;
    if (!lanceVu) lanceVu = { lance, depuis: 0 };
    else if (lanceVu.lance !== lance) lanceVu = { lance, depuis: Date.now() };
    return lance;
  }

  function cochonnet(){
    const ecoule = Date.now() - lanceVu.depuis;
    return '<span class="cochonnet' + (ecoule < DUREE_POSE ? ' arrive" style="animation-delay:-' + ecoule + 'ms' : '') + '" aria-hidden="true"></span>';
  }

  function renderNom(equipe, bouton, lance){
    bouton.innerHTML = '<span class="texte-nom">' + echapper(nom(equipe)) + '</span>' + (lance === equipe ? cochonnet() : '');
    bouton.setAttribute('aria-label', nom(equipe) + (lance === equipe ? ', ' + libelle('pc_lance_but').toLowerCase() : '') + ' — ' + libelle('compteur_noms'));
  }

  // Bandeau sous le score : sans compte, l'invitation à s'en créer un (connexion, puis la partie
  // en ligne) ; connecté (partie commencée ici avant de se connecter), le chemin vers partie.html
  function renderInvite(){
    const connecte = !!session();
    el.inviteCompte.href = connecte
      ? prefixe + 'partie.html?nouvelle=1'
      : prefixe + 'connexion.html?retour=' + encodeURIComponent(prefixe + 'partie.html');
    el.inviteCompte.innerHTML = (connecte ? PICTOS.ok : PICTOS.personne) + '<span><b>'
      + echapper(libelle(connecte ? 'compteur_connecte_titre' : 'compteur_invite_titre')) + '</b><u>'
      + echapper(libelle(connecte ? 'compteur_connecte_lien' : 'compteur_creer_compte')) + '</u></span>';
  }

  function render(){
    el.scoreA.textContent = state.scoreA;
    el.scoreB.textContent = state.scoreB;
    const lance = equipeAuBut();
    renderNom('a', el.nameA, lance);
    renderNom('b', el.nameB, lance);
    // À 0-0, avant le tirage : la pièce à la place d'Annuler. Le tirage n'entre pas dans Annuler
    // (comme la partie en ligne) : après lui, Annuler ramène encore une partie remise à zéro.
    const avantTirage = !state.menes.length && !state.but;
    el.pieceBtn.hidden = !avantTirage;
    el.undoBtn.hidden = avantTirage;
    renderInvite();
    [...el.targetToggle.children].forEach(btn=>{
      const actif = Number(btn.dataset.t) === state.target;
      btn.classList.toggle('active', actif);
      btn.setAttribute('aria-pressed', actif);
    });
    el.bandeauMain.innerHTML = messageBandeau ? PICTOS.horloge + '<span>' + echapper(messageBandeau) + '</span>' : '';
    el.bandeauMain.hidden = !messageBandeau;
    el.bandeauMain.classList.toggle('bandeau-message', !!messageBandeau);
    if (el.win.classList.contains('show')) renderCarte();
    sauvegarderPartie();
  }

  // Message de quelques secondes dans le bandeau (partie oubliée arrêtée)
  function annoncer(texte, duree){
    messageBandeau = texte;
    clearTimeout(minuteurBandeau);
    minuteurBandeau = setTimeout(()=>{ messageBandeau = ''; render(); }, duree);
    render();
  }

  // Score lu par les lecteurs d'écran après chaque action (zone aria-live)
  function annoncerScore(){
    el.annonce.textContent = nom('a') + ' ' + state.scoreA + ', ' + nom('b') + ' ' + state.scoreB;
  }

  // « +3 » qui s'envole au-dessus du score (sans vibration, pas souhaitée) :
  // avec toute une moitié d'écran sensible au toucher, un point marqué par erreur doit se voir.
  function signalerGain(team, pts){
    const gain = document.createElement('div');
    gain.className = 'gain';
    gain.textContent = '+' + pts;
    gain.setAttribute('aria-hidden', 'true');
    (team === 'a' ? el.teamA : el.teamB).appendChild(gain);
    setTimeout(()=> gain.remove(), 1000);
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

  // « Nous gagnons ! », « Eux gagnent », sinon « Les Boulistes gagne »
  function titreVainqueur(equipe){
    if (!state['name' + equipe.toUpperCase()]) return libelle(equipe === 'a' ? 'compteur_nous_gagnons' : 'compteur_eux_gagnent');
    return libelle('compteur_gagne', { equipe: nom(equipe) });
  }

  // Écran de victoire. Sans confettis quand on y revient par Annuler ou au rechargement de la page.
  function afficherVictoire(avecConfettis){
    const aWon = state.scoreA >= state.target;
    el.winnerName.textContent = titreVainqueur(aWon ? 'a' : 'b');
    el.finalScore.textContent = state.scoreA + ' – ' + state.scoreB;
    el.win.classList.remove('win-a', 'win-b');
    el.win.classList.add(aWon ? 'win-a' : 'win-b');
    // Couleurs de la charte, visibles sur le fond clair de l'écran de fin
    const palette = aWon
      ? ['#74C15A', '#3D7A2A', '#9FD585', '#CDB98A']
      : ['#B5502E', '#D97C53', '#CDB98A', '#3D7A2A'];
    if(avecConfettis) launchConfetti(palette);
    else $('confettiField').innerHTML = '';
    el.win.classList.add('show');
    renderCarte();
    // Au clavier, le focus passe sur l'écran de victoire (au toucher, rien ne change)
    if(widget.contains(document.activeElement)) el.playAgainBtn.focus({ preventScroll: true });
  }

  // Carte de l'écran de fin : la partie n'est pas enregistrée ; avec un compte, elle le serait
  function renderCarte(){
    const connecte = !!session();
    el.cartePartie.innerHTML = '<div class="tete-carte neutre">' + PICTOS.info + echapper(libelle('compteur_non_enregistree')) + '</div>'
      + '<div class="discret">' + echapper(libelle(connecte ? 'compteur_non_enregistree_connecte' : 'compteur_non_enregistree_aide')) + '</div>'
      + '<div class="liens-carte"><a class="lien-carte" href="' + echapper(el.inviteCompte.href) + '">'
      + echapper(libelle(connecte ? 'compteur_connecte_lien' : 'compteur_creer_compte')) + '</a></div>';
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
    }
  }

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
    if(document.visibilityState === 'visible') arreterPartieOubliee();
  });

  // Un appel = une mène gagnée par cette équipe (1 à 6 points)
  function addPoints(team, pts){
    if(state.finished) return;
    garderEcranAllume();
    snapshot();
    if (!state.menes.length) state.debut = Date.now();
    if(team === 'a') state.scoreA = Math.min(state.scoreA + pts, state.target);
    else state.scoreB = Math.min(state.scoreB + pts, state.target);
    const t = Math.max(0, Math.round((Date.now() - state.debut) / 1000));
    state.menes.push({ equipe: team, points: pts, a: state.scoreA, b: state.scoreB, t });
    render();
    signalerGain(team, pts);
    annoncerScore();
    checkWin();
  }

  function undo(){
    const prev = history.pop();
    if(!prev) return;
    Object.assign(state, JSON.parse(prev));
    el.undoBtn.disabled = history.length === 0;
    cacherVictoire();
    render();
    annoncerScore();
    if(state.finished) afficherVictoire(false);
  }

  // ---------- Tirage au sort du but ----------

  // La pièce : tire au sort l'équipe qui lance le but, dans le téléphone (rien n'est envoyé)
  function tirerBut(){
    if (state.finished || state.menes.length || state.but) return;
    const focusPiece = document.activeElement === el.pieceBtn;
    state.but = Math.random() < 0.5 ? 'a' : 'b';
    render();
    if (focusPiece) el.undoBtn.focus({ preventScroll: true });
    montrerTirage();
  }

  // Le tirage, comme montrerTirage() de partie.js (garder les deux pareils) : un voile par-dessus
  // le compteur, la pièce saute, tourne et retombe sur l'équipe tirée (face « Nous » devant au
  // départ), puis le résultat ; il se referme seul, ou en touchant. Le voile est ajouté au body,
  // au-dessus du plein écran.
  function montrerTirage(){
    document.querySelectorAll('.compteur-tirage').forEach(v => v.remove());
    const but = state.but;
    const face = (e, dos) => '<div class="compteur-tirage-face ' + e + (dos ? ' dos' : '') + (state['name' + e.toUpperCase()] ? ' nom' : '') + '">'
      + '<img src="' + IMAGE_BOULE + '" alt=""><span>' + echapper(nom(e)) + '</span></div>';
    const resultat = state['name' + but.toUpperCase()] ? libelle('pc_tirage_equipe', { equipe: nom(but) })
      : libelle(but === 'a' ? 'pc_tirage_nous' : 'pc_tirage_eux');
    let tranches = '';
    // Épaisseur de la pièce : des disques empilés entre les deux faces
    for (let i = 0; i < 13; i++) tranches += '<div class="compteur-tirage-tranche" style="transform:translateZ(' + (i - 6) + 'px)"></div>';
    const voile = document.createElement('div');
    voile.className = 'compteur-tirage';
    voile.innerHTML = '<p class="compteur-tirage-titre">' + echapper(libelle('pc_tirage_titre')) + '</p>'
      + '<div class="compteur-tirage-scene" aria-hidden="true"><div class="compteur-tirage-ombre"></div><div class="compteur-tirage-saut"><div class="compteur-tirage-piece">'
      + tranches + face('a', false) + face('b', true) + '</div></div></div>'
      + '<p class="compteur-tirage-resultat" role="status"></p>';
    document.body.appendChild(voile);

    const sansMouvement = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duree = sansMouvement ? 10 : 1900;
    // Dix demi-tours retombent sur la face de départ (« Nous ») ; un de plus, sur l'autre
    const angle = (sansMouvement ? 0 : 1800) + (but === 'a' ? 0 : 180);
    let fini = false, minuterie = null;
    const fermer = () => {
      if (!fini) return;   // pas avant que la pièce soit retombée
      fini = false;
      clearTimeout(minuterie);
      voile.classList.add('ferme');
      setTimeout(() => voile.remove(), sansMouvement ? 0 : 300);
      // Le petit cochonnet se pose une fois le voile parti, là où on le voit
      if (lanceVu && lanceVu.lance && state.but === but && !state.menes.length) { lanceVu.depuis = Date.now(); render(); }
    };
    const afficherResultat = () => {
      const r = voile.querySelector('.compteur-tirage-resultat');
      r.className = 'compteur-tirage-resultat ' + but;
      r.textContent = resultat;
      fini = true;
      minuterie = setTimeout(fermer, 1800);
    };
    voile.addEventListener('click', fermer);
    const piece = voile.querySelector('.compteur-tirage-piece');
    if (!piece.animate) {
      // Sans Web Animations (très vieux navigateur) : la bonne face, puis le résultat
      piece.style.transform = 'rotateX(' + angle + 'deg)';
      afficherResultat();
      return;
    }
    const tour = piece.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(' + angle + 'deg)' }],
      { duration: duree, easing: 'cubic-bezier(.15,.6,.3,1)', fill: 'forwards' });
    voile.querySelector('.compteur-tirage-saut').animate([
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(-150px) scale(1.12)', offset: .42, easing: 'ease-in' },
      { transform: 'translateY(0) scale(1)', offset: .78, easing: 'ease-out' },
      { transform: 'translateY(-20px) scale(1.02)', offset: .88, easing: 'ease-in' },
      { transform: 'translateY(0) scale(1)' }
    ], { duration: duree, fill: 'forwards' });
    voile.querySelector('.compteur-tirage-ombre').animate([
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(.45)', opacity: .4, offset: .42 },
      { transform: 'scale(1)', opacity: 1, offset: .78 },
      { transform: 'scale(.9)', opacity: .9, offset: .88 },
      { transform: 'scale(1)', opacity: 1 }
    ], { duration: duree });
    tour.finished.then(afficherResultat, () => voile.remove());
  }

  // Remise à zéro annulable (on ne vide pas l'historique) : un toucher malheureux sur
  // « Nouvelle partie » ou sur 11/13 ne fait pas perdre la partie en cours. Les noms restent.
  // Passer de 13 à 11 (ou l'inverse) avant la 1re mène garde le tirage au sort du but.
  function newGame(nouvelleCible){
    const garderTirage = nouvelleCible && !state.menes.length;
    if(state.scoreA || state.scoreB || state.menes.length) snapshot();
    if(nouvelleCible) state.target = nouvelleCible;
    state.scoreA = 0;
    state.scoreB = 0;
    state.menes = [];
    state.finished = false;
    state.debut = null;
    if (!garderTirage) state.but = null;
    cacherVictoire();
    render();
    annoncerScore();
  }

  // Partie oubliée : non terminée, sans aucun point depuis PAUSE_MAX. Une nouvelle commence, comme
  // avec « Nouvelle partie » (Annuler la ramène tant que la page reste ouverte).
  function arreterPartieOubliee(){
    if (state.finished || !state.menes.length || !state.debut) return;
    const derniere = state.debut + state.menes[state.menes.length - 1].t * 1000;
    if (Date.now() - derniere < PAUSE_MAX) return;
    const jour = new Date(state.debut).toLocaleDateString(langue === 'en' ? 'en-GB' : langue + '-BE', { day: '2-digit', month: '2-digit' });
    newGame();
    annoncer(libelle('compteur_partie_arretee', { jour }), 15000);
  }

  // Toucher la moitié d'une équipe = +1, sauf sur une pastille (+2 à +6, ou +1 au clavier) ou
  // sur son nom (« Noms »)
  [['a', el.teamA], ['b', el.teamB]].forEach(([team, teamEl])=>{
    teamEl.addEventListener('click', (e)=>{
      if (e.target.closest('.name')) { ouvrirNoms(team); return; }
      const chip = e.target.closest('.chip');
      addPoints(team, chip ? Number(chip.dataset.pts) : 1);
    });
  });

  el.undoBtn.addEventListener('click', undo);
  el.pieceBtn.addEventListener('click', tirerBut);
  $('undoWinBtn').addEventListener('click', undo);
  el.resetBtn.addEventListener('click', ()=> newGame());
  el.playAgainBtn.addEventListener('click', ()=> newGame());

  el.targetToggle.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if(!btn || Number(btn.dataset.t) === state.target) return;
    newGame(Number(btn.dataset.t));
  });

  // ---------- Panneaux ----------

  // Le focus revient au bouton d'ouverture à la fermeture (navigation au clavier)
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
  }

  widget.addEventListener('click', (ev)=>{
    const fermer = ev.target.closest('[data-fermer]');
    if (fermer) { fermerPanneau(fermer.closest('.feuille')); return; }
    // Toucher le voile autour d'une feuille la ferme
    if (ev.target.classList && ev.target.classList.contains('feuille')) fermerPanneau(ev.target);
  });

  // ---------- Noms des équipes ----------
  // Pour le plaisir : gardés dans le téléphone, sans conséquence. Un nom effacé redevient
  // « Nous » ou « Eux ».

  function ouvrirNoms(equipe){
    $('nomEquipeA').value = state.nameA;
    $('nomEquipeB').value = state.nameB;
    ouvrirPanneau(el.nomsModal, $(equipe === 'b' ? 'nomEquipeB' : 'nomEquipeA'));
  }

  el.nomsModal.addEventListener('input', (ev)=>{
    const m = ev.target.id && ev.target.id.match(/^nomEquipe([AB])$/);
    if (!m) return;
    state['name' + m[1]] = ev.target.value.replace(/\s+/g, ' ').trim();
    render();
    if (state.finished) afficherVictoire(false);
  });

  el.nomsModal.addEventListener('keydown', (ev)=>{
    if (ev.key === 'Enter' && ev.target.classList.contains('champ')) fermerPanneau(el.nomsModal);
  });

  $('nomsBtn').addEventListener('click', ()=> ouvrirNoms('a'));

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

  // ---------- Aide ----------

  const aideModal = $('aideModal');
  $('aideBtn').addEventListener('click', () => {
    ouvrirPanneau(aideModal, aideModal.querySelector('[data-fermer]'));
  });
  // Lien « Comment ça marche ? » du texte sous le compteur : la feuille vit dans le compteur,
  // on remonte d'abord jusqu'à lui.
  document.querySelectorAll('[data-ouvrir-aide]').forEach((bouton) => {
    bouton.addEventListener('click', () => {
      widget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('aideBtn').click();
    });
  });

  // ---------- Démarrage ----------

  restaurerPartie();
  // Connecté : « Compter les points » mène à la partie en ligne, sauf si une partie est en cours
  // ici (elle se finit ici) ou avec ?simple=1
  const enCours = state.menes.length > 0 && !state.finished;
  if (session() && !enCours && !new URLSearchParams(location.search).has('simple')) {
    location.replace(prefixe + 'partie.html');
    return;
  }

  // Connexion ou déconnexion (ici, dans un autre onglet, ou au retour de la page Connexion)
  window.addEventListener('mapetanque:compte', ()=>{
    render();
    if (state.finished) afficherVictoire(false);
  });

  definirPleinEcran(false);
  render();
  arreterPartieOubliee();
  if (state.finished) afficherVictoire(false);
})();
