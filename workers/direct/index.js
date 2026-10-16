// Worker mapetanque-direct : score en direct des parties partagées (étape 2 de la partie partagée,
// voir NOTES_comptes_utilisateurs.md, « Étapes B et C fusionnées : la partie partagée »).
//
// Un Durable Object par partie (PartieDirect, retrouvé par le code de la partie). Les téléphones
// qui suivent la partie (partie.html) s'y connectent en WebSocket ; le Worker mapetanque-comptes
// lui relaie chaque mène reçue du compteur du marqueur (liaison de service DIRECT, méthode
// relayer), et l'objet la pousse aussitôt à tous les téléphones connectés.
//
// Mis en ligne avec Wrangler depuis ce dossier : npx wrangler deploy (configuration dans
// wrangler.toml). Ne jamais modifier ce Worker dans le tableau de bord Cloudflare : la prochaine
// mise en ligne depuis le dépôt écraserait la modification.
//
// Rien n'est enregistré ici durablement : l'objet garde le dernier état de la partie pour les
// téléphones qui se connectent en cours de route, et s'efface 24 heures après la dernière mène.
// Les parties et les places prises restent dans D1, gérées par mapetanque-comptes.
//
// Quota : une connexion = une requête ; les messages envoyés aux téléphones ne comptent pas, ceux
// reçus comptent pour 1 requête les 20 (le « ping » d'entretien reçoit sa réponse sans réveiller
// l'objet, API d'hibernation des WebSockets).

import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";

const ORIGINES_AUTORISEES = [
  "https://mapetanque.be",
  "http://127.0.0.1:5500",
  "http://localhost:5500", "http://127.0.0.1:5501", "http://localhost:5501",
];
// Aperçus des branches claude/* publiés par Cloudflare Pages (projet mapetanque), pour tester un
// changement sur téléphone avant de le fusionner dans main
const ORIGINE_APERCU = /^https:\/\/[a-z0-9-]+\.mapetanque\.pages\.dev$/;

function origineAutorisee(origine) {
  return ORIGINES_AUTORISEES.includes(origine) || ORIGINE_APERCU.test(origine);
}

const CODE_PARTIE = /^[A-Z0-9]{4,8}$/;
const MAX_CONNEXIONS = 40;             // par partie : bien au-delà de 6 joueurs et leurs proches
const DUREE_VIE = 24 * 3600 * 1000;    // l'objet s'efface 24 heures après la dernière mène

export class PartieDirect extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Le téléphone envoie « ping » toutes les 30 secondes pour garder la connexion ouverte :
    // la réponse part sans réveiller l'objet
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  // Un téléphone se connecte : il reçoit tout de suite le dernier état connu de la partie
  async fetch(request) {
    if (this.ctx.getWebSockets().length >= MAX_CONNEXIONS) return new Response("complet", { status: 429 });
    const [client, serveur] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(serveur);
    const dernier = await this.ctx.storage.get("dernier");
    if (dernier) serveur.send(dernier);
    return new Response(null, { status: 101, webSocket: client });
  }

  // Appelée par le Worker (méthode relayer ci-dessous) : { type: "etat", etat, rejoints } après
  // chaque mène ou place prise, { type: "enregistree" } quand le marqueur a enregistré la partie
  async relayer(donnees) {
    const message = JSON.stringify(donnees);
    if (donnees && donnees.type === "etat") await this.ctx.storage.put("dernier", message);
    const connexions = this.ctx.getWebSockets();
    for (const ws of connexions) {
      try { ws.send(message); } catch (e) { /* connexion en train de se fermer */ }
    }
    await this.ctx.storage.setAlarm(Date.now() + DUREE_VIE);
    return connexions.length;
  }

  // Partie abandonnée ou finie depuis 24 heures : connexions fermées, objet vidé
  async alarm() {
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.close(1000, "fin"); } catch (e) { }
    }
    await this.ctx.storage.deleteAll();
  }

  // Les téléphones n'envoient rien d'autre que « ping » (servi sans réveil) : rien à faire ici
  async webSocketMessage(ws, message) { }

  async webSocketClose(ws, code, raison) {
    try { ws.close(code, raison); } catch (e) { /* déjà fermée */ }
  }
}

export default class extends WorkerEntrypoint {
  // GET /partie/K7P2 en WebSocket, depuis le site seulement
  async fetch(request) {
    const m = new URL(request.url).pathname.match(/^\/partie\/([A-Za-z0-9]{4,8})$/);
    if (!m) return new Response("introuvable", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("websocket attendu", { status: 426 });
    if (!origineAutorisee(request.headers.get("Origin") || "")) return new Response("origine refusée", { status: 403 });
    return this.env.PARTIES.get(this.env.PARTIES.idFromName(m[1].toUpperCase())).fetch(request);
  }

  // Appelée par mapetanque-comptes par sa liaison de service, jamais depuis Internet (une méthode
  // d'un WorkerEntrypoint n'est pas joignable par une adresse web). Rend le nombre de téléphones
  // connectés à la partie.
  async relayer(code, donnees) {
    const c = String(code || "").toUpperCase();
    if (!CODE_PARTIE.test(c)) return 0;
    return await this.env.PARTIES.get(this.env.PARTIES.idFromName(c)).relayer(donnees);
  }
}
