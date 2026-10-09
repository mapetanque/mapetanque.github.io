# Charte graphique de Mapetanque

Référence pour tout nouveau développement (pages, composants, visuels). Résumé du guide visuel,
version 1.0, octobre 2026 : `charte/guide-visuel-mapetanque.pdf` (21 diapositives).

## Logo

- Deux parties toujours ensemble : le symbole (une boule de pétanque, ses stries et le cochonnet
  posé devant elle, dessinés en négatif) et le logotype « Mapetanque ».
- « Map » prend la couleur de la boule, « etanque » celle du texte.
- Toujours dans la même orientation, logo complet comme symbole seul : ni rotation, ni miroir.
- Sans ombre, transparence, contour ni déformation. Toujours à partir des fichiers SVG,
  jamais redessiné ni recomposé.

### Grille

Module m = diamètre de la boule / 6.

| Élément | Valeur |
|---|---|
| Boule | 6 m |
| Espace boule-texte | 2 m |
| Capitales (« M ») | 4 m, centrées sur la boule (1 m au-dessus, 1 m en dessous) |
| Minuscules (« a ») | 3 m |
| Largeur du mot | 32 m (logo complet : 40 × 6 m) |
| Zone de protection | 3 m tout autour (½ diamètre de boule) |

Fichiers SVG actuels : boule de 117,88 unités (m = 19,647). Pour passer le texte sur la grille,
ses deux tracés reçoivent `transform="translate(1.478 -4.784) scale(1.01928)"`, et le viewBox
devient `0 0 799.7 137`.

### Agencements

- Horizontal : premier choix. Taille minimale : 24 px de haut.
- Vertical : boule centrée au-dessus du mot, 2 m entre la boule et le haut des capitales (formats
  carrés ou centrés, image de partage).
- Symbole seul : quand la place manque (en-tête mobile, favicon, icône d'application, avatar).
  Taille minimale : 16 px. Rien ne s'écrit à côté. Zone de protection : 3 m.

### Versions de couleur

| Version | Boule et « Map » | « etanque » | Fond |
|---|---|---|---|
| Principale | Vert Mapetanque | Vert nuit | Clair |
| Principale négative | Vert Mapetanque | Blanc | Foncé |
| Monochrome | Vert nuit | Vert nuit | Clair, vert Mapetanque |
| Monochrome négative | Blanc | Blanc | Foncé, vert feuillage, terre battue |

Symbole seul : vert (principal), blanc sur fond foncé ou sur vert Mapetanque, vert nuit
(monochrome).

## Typographie

Trois polices sous licence SIL OFL, hébergées sur le site (`polices/`, `polices.css`).

- **Manrope** (600, 700, 800) : titres, chiffres mis en avant (scores, nombre de terrains),
  boutons. Pas pour les textes longs.
- **Figtree** (400, 400 italique, 600, 700) : tout le texte courant. Secours : Arial.
- **Caveat** (700) : écriture manuscrite, avec parcimonie. Une fois par écran au plus, 22 px au
  minimum, vert feuillage sur fond clair, blanc sur fond foncé. Usages : accroche et annotation
  de l'accueil, annonce du vainqueur au compteur (« {équipe} gagne »), nom des badges.

| Niveau | Police | Ordinateur | Téléphone |
|---|---|---|---|
| Grand titre | Manrope 800 | 44 px | 30 px |
| Titre de page | Manrope 800 | 32 px | 22 px |
| Titre de bande | Manrope 700 | 26 px | 22 px |
| Titre de fiche | Manrope 700 | 19 px | 18 px |
| Texte | Figtree 400 | 16 px | 16 px |
| Petit texte | Figtree 400 | 13 px | 13 px |

## Couleurs

| Nom | Hex | Rôle |
|---|---|---|
| Vert Mapetanque | `#74C15A` | Logo, boutons principaux (texte blanc), marqueurs de la carte |
| Survol | `#56A03D` | Survol des boutons verts |
| Vert feuillage | `#3D7A2A` | Liens, texte vert, écriture manuscrite, messages de réussite |
| Vert nuit | `#1D2619` | Texte principal, fonds foncés, pied de page |
| Vert tendre | `#E7F4E1` | Pastilles, encadrés |
| Terre battue | `#B5502E` | Accent seulement (compteur, badges), jamais un bouton principal |
| Blanc | `#FFFFFF` | Fond de page |
| Brume | `#F7F9F6` | Fond de bande ou de bloc |
| Ligne | `#E2E6DE` | Bordures, séparateurs (1 px) |
| Gris mousse | `#56604F` | Texte secondaire |
| Rouge erreur | `#C62828` | Messages d'erreur |
| Bleu position | `#1976D2` | Position de l'utilisateur sur la carte |

Correspondance avec les couleurs encore présentes dans le code :

| Actuelles | Deviennent |
|---|---|
| `#63a84c`, `#68b34f`, `#5ea845` | Survol `#56A03D` |
| `#4a8f36`, `#2f6b1f`, `#2e7d32` | Vert feuillage `#3D7A2A` |
| `#1f2a1c`, `#1b2218`, `#333`, `#444` | Vert nuit `#1D2619` |
| `#555` | Gris mousse `#56604F` |
| `#eef5e9`, `#f2f8ee`, `#d9e8d2` | Vert tendre `#E7F4E1` |
| `#b04a3a` | Rouge erreur `#C62828` |

## Illustrations et pictos

- Deux registres, formes simples et aplats francs, sans texture ni effet :
  - **Plein** : formes de la marque (boule, marqueur de carte), en vert Mapetanque ou en blanc,
    avec des découpes en négatif comme la boule.
  - **Trait** : pictos et informations.
- Pas de dessin au crayon (la boule crayonnée et la flèche crayon de l'accueil sont à retirer).
- Pictos : grille de 24 px, zone utile de 20 px, trait de 2 px, extrémités et angles arrondis,
  couleur héritée du texte (`currentColor`), affichage entre 20 et 24 px. Référence : Lucide
  (licence ISC) ; à défaut, dessiner dans le même style (comme le banc et les jeux).
