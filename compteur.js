// Compteur de points (compteur.html et ses versions nl/de/en) : construit tout le widget dans
// #compteurWidget. Seul endroit où se trouve sa logique, pour les quatre langues : les textes sont
// dans translations.js (clés compteur_*), les styles dans style-compteur.css.
// Indépendant de script.js (aucune variable/fonction en commun, tout est dans sa propre portée).
(function(){
  const widget = document.getElementById('compteurWidget');
  if (!widget) return;

  const CLE_STOCKAGE = 'mapetanque_compteur_partie';

  // Langue de la page d'après son adresse (/nl/, /de/, /en/), comme le reste de son contenu, et
  // non la langue préférée enregistrée par script.js, qui peut être différente.
  const langueURL = location.pathname.match(/^\/(nl|de|en)\//);
  const textes = translations[langueURL ? langueURL[1] : 'fr'];

  // libelle('compteur_gagne', {equipe: 'Les Boulistes'}) → « Les Boulistes gagne »
  function libelle(cle, valeurs){
    let texte = textes[cle] || translations.fr[cle] || cle;
    for (const nom in valeurs) texte = texte.replace('{' + nom + '}', valeurs[nom]);
    return texte;
  }

  const ICON_MAXIMIZE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
  const ICON_MINIMIZE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';

  // ---------- Construction du widget ----------

  // Moitié d'une équipe ('a' ou 'b'). Toucher la moitié donne +1 ; le bouton +1 caché ne sert
  // qu'au clavier (voir .chip-un dans style-compteur.css).
  function moitie(equipe){
    const E = equipe.toUpperCase();
    const pastilles = [1, 2, 3, 4, 5, 6].map(n =>
      '<button type="button" class="chip' + (n === 1 ? ' chip-un' : '') + '" data-pts="' + n + '">+' + n + '</button>'
    ).join('');
    return `
    <div class="team ${equipe}" id="team${E}" role="group" aria-labelledby="name${E}">
      <div class="name" id="name${E}"></div>
      <div class="score" id="score${E}">0</div>
      <div class="boules" id="boules${E}" aria-hidden="true"></div>
      <div class="controls">${pastilles}</div>
      <div class="hint" aria-hidden="true">${libelle('compteur_toucher')}</div>
    </div>`;
  }

  widget.innerHTML = `
<div class="app">
  <div class="topbar">
    <div class="target-toggle" id="targetToggle" role="group" aria-label="${libelle('compteur_cible')}">
      <button type="button" data-t="11">11</button>
      <button type="button" data-t="13">13</button>
    </div>
    <div class="mene-count" id="meneLabel"></div>
    <button type="button" id="resetBtn">${libelle('compteur_nouvelle_partie')}</button>
    <button type="button" class="fullscreen-toggle-btn" id="fullscreenToggleBtn"></button>
  </div>

  <div class="halves">${moitie('a')}
    <div class="divider"></div>${moitie('b')}
  </div>

  <div class="bottombar">
    <button type="button" id="undoBtn" disabled><span aria-hidden="true">↺</span> ${libelle('compteur_annuler')}</button>
    <button type="button" id="menesBtn"><span aria-hidden="true">☰</span> ${libelle('compteur_menes')}</button>
    <button type="button" id="editBtn"><span aria-hidden="true">✎</span> ${libelle('compteur_renommer')}</button>
  </div>

  <div class="win" id="winOverlay" role="dialog" aria-modal="true" aria-labelledby="winnerName">
    <div class="confetti-field" id="confettiField"></div>
    <div class="trophy-line">${libelle('compteur_partie_terminee')}</div>
    <div class="winner-name" id="winnerName"></div>
    <div class="final-score" id="finalScore"></div>
    <button type="button" id="playAgainBtn">${libelle('compteur_nouvelle_partie')}</button>
    <button type="button" id="undoWinBtn" class="secondary"><span aria-hidden="true">↺</span> ${libelle('compteur_annuler_point')}</button>
  </div>

  <div class="win" id="renameModal" role="dialog" aria-modal="true" aria-labelledby="renameTitre">
    <div class="trophy-line" id="renameTitre">${libelle('compteur_renommer_titre')}</div>
    <label class="modal-field">
      <span>${libelle('compteur_equipe_a')}</span>
      <input type="text" id="inputA" maxlength="20">
    </label>
    <label class="modal-field">
      <span>${libelle('compteur_equipe_b')}</span>
      <input type="text" id="inputB" maxlength="20">
    </label>
    <div style="display:flex; gap:12px; margin-top:6px;">
      <button type="button" id="cancelRename" class="secondary">${libelle('compteur_renommer_annuler')}</button>
      <button type="button" id="saveRename">${libelle('compteur_enregistrer')}</button>
    </div>
  </div>

  <div class="win" id="menesModal" role="dialog" aria-modal="true" aria-labelledby="menesTitre">
    <div class="trophy-line" id="menesTitre">${libelle('compteur_detail_titre')}</div>
    <ol class="detail-menes" id="detailMenes"></ol>
    <p class="detail-vide" id="detailVide">${libelle('compteur_detail_vide')}</p>
    <button type="button" id="closeMenes" class="secondary">${libelle('close_panel')}</button>
  </div>

  <div class="sr-only" id="annonce" aria-live="polite"></div>
</div>`;

  const $ = id => document.getElementById(id);
  const el = {
    teamA: $('teamA'), teamB: $('teamB'),
    scoreA: $('scoreA'), scoreB: $('scoreB'),
    boulesA: $('boulesA'), boulesB: $('boulesB'),
    nameA: $('nameA'), nameB: $('nameB'),
    meneLabel: $('meneLabel'),
    undoBtn: $('undoBtn'),
    resetBtn: $('resetBtn'),
    win: $('winOverlay'),
    winnerName: $('winnerName'),
    finalScore: $('finalScore'),
    playAgainBtn: $('playAgainBtn'),
    targetToggle: $('targetToggle'),
    renameModal: $('renameModal'),
    inputA: $('inputA'), inputB: $('inputB'),
    menesModal: $('menesModal'),
    detailMenes: $('detailMenes'),
    detailVide: $('detailVide'),
    annonce: $('annonce'),
    fullscreenToggleBtn: $('fullscreenToggleBtn'),
  };

  // ---------- État de la partie ----------

  // menes : une entrée par mène, { equipe: 'a'|'b', points, a, b } (a et b : score après la mène).
  // nameA/nameB vides = nom par défaut, affiché dans la langue de la page.
  const state = {
    target: 13,
    scoreA: 0,
    scoreB: 0,
    menes: [],
    finished: false,
    nameA: '',
    nameB: '',
  };
  const history = [];

  function nom(equipe){
    return state['name' + equipe.toUpperCase()] || libelle('compteur_equipe_' + equipe);
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
  }

  function snapshot(){
    history.push(JSON.stringify(state));
    if(history.length > 60) history.shift();
    el.undoBtn.disabled = false;
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

  function render(){
    el.scoreA.textContent = state.scoreA;
    el.scoreB.textContent = state.scoreB;
    renderBoules(el.boulesA, state.scoreA);
    renderBoules(el.boulesB, state.scoreB);
    el.meneLabel.textContent = libelle('compteur_mene', { n: state.menes.length });
    el.nameA.textContent = nom('a');
    el.nameB.textContent = nom('b');

    [...el.targetToggle.children].forEach(btn=>{
      const actif = Number(btn.dataset.t) === state.target;
      btn.classList.toggle('active', actif);
      btn.setAttribute('aria-pressed', actif);
    });

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

  // Écran de victoire. Sans confettis quand on y revient par Annuler (ex. « Nouvelle partie »
  // touchée par erreur juste après une victoire) ou au rechargement de la page.
  function afficherVictoire(avecConfettis){
    const aWon = state.scoreA >= state.target;
    el.winnerName.textContent = libelle('compteur_gagne', { equipe: nom(aWon ? 'a' : 'b') });
    el.finalScore.textContent = state.scoreA + ' – ' + state.scoreB;
    el.win.classList.remove('win-a', 'win-b');
    el.win.classList.add(aWon ? 'win-a' : 'win-b');
    const palette = aWon
      ? ['#4c7a3d', '#f2ece0', '#c9c2b4', '#7ea968']
      : ['#b5502e', '#f2ece0', '#c9c2b4', '#d97c53'];
    if(avecConfettis) launchConfetti(palette);
    else $('confettiField').innerHTML = '';
    el.win.classList.add('show');
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
  });

  // Un appel = une mène gagnée par cette équipe (1 à 6 points)
  function addPoints(team, pts){
    if(state.finished) return;
    garderEcranAllume();
    snapshot();
    if(team === 'a') state.scoreA = Math.min(state.scoreA + pts, state.target);
    else state.scoreB = Math.min(state.scoreB + pts, state.target);
    state.menes.push({ equipe: team, points: pts, a: state.scoreA, b: state.scoreB });
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

  // Remise à zéro annulable (on ne vide pas l'historique) : un toucher malheureux sur
  // « Nouvelle partie » ou sur 11/13 ne fait pas perdre la partie en cours.
  function newGame(nouvelleCible){
    if(state.scoreA || state.scoreB || state.menes.length) snapshot();
    if(nouvelleCible) state.target = nouvelleCible;
    state.scoreA = 0;
    state.scoreB = 0;
    state.menes = [];
    state.finished = false;
    cacherVictoire();
    render();
    annoncerScore();
  }

  // Toucher la moitié d'une équipe = +1, sauf sur une pastille (+2 à +6, ou +1 au clavier)
  [['a', el.teamA], ['b', el.teamB]].forEach(([team, teamEl])=>{
    teamEl.addEventListener('click', (e)=>{
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

  // ---------- Panneaux « Renommer » et « Mènes » ----------

  // Le focus revient au bouton d'ouverture à la fermeture (navigation au clavier)
  let focusAvantPanneau = null;

  function ouvrirPanneau(panneau, cibleFocus){
    focusAvantPanneau = document.activeElement;
    panneau.classList.add('show');
    setTimeout(()=> cibleFocus.focus({ preventScroll: true }), 50);
  }

  function fermerPanneau(panneau){
    panneau.classList.remove('show');
    if(focusAvantPanneau && widget.contains(focusAvantPanneau)) focusAvantPanneau.focus({ preventScroll: true });
    focusAvantPanneau = null;
  }

  $('editBtn').addEventListener('click', ()=>{
    el.inputA.value = nom('a');
    el.inputB.value = nom('b');
    ouvrirPanneau(el.renameModal, el.inputA);
  });

  // Un nom vidé (ou laissé au nom par défaut) revient au nom par défaut
  function enregistrerNoms(){
    const a = el.inputA.value.trim();
    const b = el.inputB.value.trim();
    state.nameA = a !== libelle('compteur_equipe_a') ? a : '';
    state.nameB = b !== libelle('compteur_equipe_b') ? b : '';
    fermerPanneau(el.renameModal);
    render();
  }

  $('cancelRename').addEventListener('click', ()=> fermerPanneau(el.renameModal));
  $('saveRename').addEventListener('click', enregistrerNoms);
  [el.inputA, el.inputB].forEach(input => input.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') enregistrerNoms();
  }));

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
    const panneau = [el.renameModal, el.menesModal].find(p => p.classList.contains('show'));
    if (panneau) fermerPanneau(panneau);
    else if (widget.classList.contains('fullscreen-active')) definirPleinEcran(false);
  });

  // ---------- Démarrage ----------

  definirPleinEcran(false);
  restaurerPartie();
  render();
  if (state.finished) afficherVictoire(false);
})();
