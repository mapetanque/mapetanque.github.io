const translations = {

    fr: {
        html_lang: "fr",

        meta_title: "Mapetanque.be",
        meta_description: "Carte interactive des terrains de pétanque accessibles au public en Belgique : recherche par ville, géolocalisation et liste par région sur Mapetanque.be.",

        locate_btn: "Me localiser",
        search_placeholder: "Adresse, ville, région...",
        hero_headline: "Trouvez un terrain de pétanque",
        browse_list_btn: "Parcourir",
        add_terrain_link: "Ajouter un terrain de pétanque",
        search_no_result: "Aucun résultat trouvé pour cette recherche.",
        search_failed: "La recherche a échoué, réessayez dans un instant.",

        open_menu: "Ouvrir le menu",
        close_menu: "Fermer le menu",
        fullscreen_enter: "Plein écran",
        fullscreen_exit: "Quitter le plein écran",
        close_panel: "Fermer",

        share_site_btn: "📤 Partager",
        share_site_title: "Partager Mapetanque.be",
        share_terrain_title: "Partager ce terrain",
        share_whatsapp: "WhatsApp",
        share_facebook: "Facebook",
        share_twitter: "X (Twitter)",
        share_email: "E-mail",
        share_copy: "Copier le lien",
        share_copied: "Lien copié !",
        popup_share: "Partager ce terrain",

        menu_about: "À propos",
        menu_contact: "Me contacter",
        menu_faq: "FAQ",

        stats_page_title: "Liste des terrains",
        stats_headline_label: "terrains de pétanque recensés en Belgique",
        stats_terrains_unit: "terrains",
        stats_geo_loading: "Chargement du détail par région…",
        stats_geo_error: "Impossible de charger le détail par région pour le moment.",
        stats_search_commune_placeholder: "Rechercher une commune…",
        provinces_section_title: "Parcourir par province",
        regions_section_title: "Parcourir par région",
        province_accueil_breadcrumb: "Accueil",
        province_terrains_recenses: "terrains recensés",
        province_communes_couvertes: "communes couvertes",
        province_terrains_100km2: "terrains pour 100 km²",
        province_communes_de_la_province: "Communes de la province",
        province_communes_de_la_region_bruxelles: "Communes de la région",
        province_autres_provinces: "Autres provinces",
        province_terrain_singulier: "terrain",
        province_h1_template: "Terrains de pétanque en province {prefixe}{nom}",
        province_h1_bruxelles_template: "Terrains de pétanque à {nom}",
        province_meta_description: "Terrains de pétanque publics en province {nom} : carte interactive, liste par commune, recherche par ville sur Mapetanque.be.",
        region_h1_template: "Terrains de pétanque en {nom}",
        region_meta_description: "Terrains de pétanque publics en {nom} : carte interactive, liste par province, recherche par ville sur Mapetanque.be.",
        region_provinces_couvertes: "provinces couvertes",
        region_provinces_de_la_region: "Provinces de {nom}",
        stats_no_results: "Aucune commune trouvée.",
        stats_show_terrains: "Afficher les terrains",

        geo_region_wallonie: "Wallonie",
        geo_region_flandre: "Flandre",
        geo_region_bruxelles: "Bruxelles",
        geo_province_brabant_wallon: "Brabant wallon",
        geo_province_hainaut: "Hainaut",
        geo_province_liege: "Liège",
        geo_province_luxembourg: "Luxembourg",
        geo_province_namur: "Namur",
        geo_province_anvers: "Anvers",
        geo_province_brabant_flamand: "Brabant flamand",
        geo_province_limbourg: "Limbourg",
        geo_province_flandre_orientale: "Flandre orientale",
        geo_province_flandre_occidentale: "Flandre occidentale",

        about_title: "À propos",
        about_text: "Mapetanque.be est né de la constatation qu'il n'existait aucun site permettant de trouver " +
            "de façon pratique et rapide des terrains de pétanque librement accessibles en Belgique. Le projet " +
            "est toujours en développement. Le site est gratuit, sans publicité et son code est open-source.",

        contact_title: "Me contacter",
        contact_text: "Vous avez une suggestion, vous souhaitez signaler une erreur ou participer au projet ? " +
            "N'hésitez pas à me contacter.",
        contact_email: "mapetanque@outlook.be",

        faq_title: "FAQ",
        faq_items: [
            {
                q: "D'où viennent les informations affichées sur la carte ?",
                a: "Les terrains affichés proviennent des données libres d'OpenStreetMap. Mapetanque.be récupère " +
                   "chaque lundi ces informations afin de proposer une carte actualisée des terrains de pétanque " +
                   "en Belgique."
            },
            {
                q: "Comment trouver un terrain près de moi ?",
                a: "Cliquez sur le bouton \"📍 Me localiser\" pour afficher votre position et consulter les " +
                   "terrains proches de vous."
            },
            {
                q: "Puis-je ajouter une photo, un avis ou des informations pratiques ?",
                a: "Cette fonctionnalité est envisagée pour une prochaine évolution de Mapetanque.be."
            },
            {
                q: "Comment ajouter un terrain manquant ?",
                a: "Les terrains affichés sur Mapetanque.be proviennent des données libres d'OpenStreetMap (OSM). " +
                   "Si vous connaissez un terrain de pétanque accessible au public qui n'apparaît pas sur la " +
                   "carte, vous pouvez : l'ajouter directement dans OSM grâce à leur outil d'édition ; " +
                   "ou m'envoyer les informations nécessaires par e-mail 📧 mapetanque@outlook.be " +
                   "(localisation précise, nombre de pistes si connu, etc.). Après mise à jour des données " +
                   "OSM, le terrain apparaîtra automatiquement sur Mapetanque.be lors de la prochaine " +
                   "synchronisation."
            },
            {
                q: "Comment retirer un terrain qui n'existe plus ou n'est plus praticable ?",
                a: "Les terrains affichés sur Mapetanque.be proviennent des données libres d'OpenStreetMap (OSM). " +
                   "Si un terrain n'existe plus ou n'est plus accessible au public, vous pouvez : " +
                   "modifier directement l'information dans OSM via leur outil d'édition ; ou me " +
                   "signaler l'erreur par e-mail 📧 mapetanque@outlook.be en précisant l'emplacement du terrain " +
                   "et les informations utiles. Si le terrain existe toujours mais est simplement mal entretenu " +
                   "ou dégradé, le mieux est de contacter la commune concernée (service des sports, travaux ou " +
                   "espaces verts), qui est généralement responsable de l'entretien des équipements publics."
            }
        ],

        popup_terrain_default: "Terrain de pétanque",
        popup_terrain_prefix: "Terrain",
        popup_access_label: "Accès",
        popup_access_public: "public",
        popup_access_probable: "probablement public",
        popup_distance_label: "Distance",
        popup_distance_hint: "Cliquez sur \"Me localiser\" pour voir la distance",
        popup_photo_credit_wikimedia: "Photo : Wikimedia Commons",
        popup_photo_credit_mapillary: "Photo : Mapillary",
        popup_itinerary: "Afficher l'itinéraire",
        popup_here: "Vous êtes ici",
        nearest_terrain_label: "Terrain le plus proche",

        stats_loading: "Chargement des statistiques…",
        stats_unavailable: "Statistiques indisponibles",
        stats_count: (n) => `${n} terrain${n > 1 ? "s" : ""} recensé${n > 1 ? "s" : ""}`,
        stats_last_update: "Mise à jour",
    },

    nl: {
        html_lang: "nl",

        meta_title: "Mapetanque.be",
        meta_description: "Mapetanque.be toont op een interactieve kaart alle openbare petanquebanen in België, met geolocatie en zoeken op stad of regio.",

        locate_btn: "Localiseer mij",
        search_placeholder: "Adres, stad, regio...",
        hero_headline: "Vind een petanquebaan",
        browse_list_btn: "Bekijken",
        add_terrain_link: "Een petanquebaan toevoegen",
        search_no_result: "Geen resultaat gevonden voor deze zoekopdracht.",
        search_failed: "De zoekopdracht is mislukt, probeer het straks opnieuw.",

        open_menu: "Menu openen",
        close_menu: "Menu sluiten",
        fullscreen_enter: "Volledig scherm",
        fullscreen_exit: "Volledig scherm afsluiten",
        close_panel: "Sluiten",

        share_site_btn: "📤 Delen",
        share_site_title: "Mapetanque.be delen",
        share_terrain_title: "Dit terrein delen",
        share_whatsapp: "WhatsApp",
        share_facebook: "Facebook",
        share_twitter: "X (Twitter)",
        share_email: "E-mail",
        share_copy: "Link kopiëren",
        share_copied: "Link gekopieerd!",
        popup_share: "Dit terrein delen",

        menu_about: "Over ons",
        menu_contact: "Contacteer ons",
        menu_faq: "FAQ",

        stats_page_title: "Lijst met terreinen",
        stats_headline_label: "petanquevelden geregistreerd in België",
        stats_terrains_unit: "terreinen",
        stats_geo_loading: "Details per regio laden…",
        stats_geo_error: "De details per regio konden niet worden geladen.",
        stats_search_commune_placeholder: "Gemeente zoeken…",
        provinces_section_title: "Blader per provincie",
        regions_section_title: "Blader per regio",
        province_accueil_breadcrumb: "Home",
        province_terrains_recenses: "geregistreerde terreinen",
        province_communes_couvertes: "gemeenten met terreinen",
        province_terrains_100km2: "terreinen per 100 km²",
        province_communes_de_la_province: "Gemeenten van de provincie",
        province_communes_de_la_region_bruxelles: "Gemeenten van het gewest",
        province_autres_provinces: "Andere provincies",
        province_terrain_singulier: "terrein",
        province_h1_template: "Petanqueterreinen in provincie {nom}",
        province_h1_bruxelles_template: "Petanqueterreinen in {nom}",
        province_meta_description: "Openbare petanqueterreinen in provincie {nom}: interactieve kaart, lijst per gemeente, zoeken op stad op Mapetanque.be.",
        region_h1_template: "Petanqueterreinen in {nom}",
        region_meta_description: "Openbare petanqueterreinen in {nom}: interactieve kaart, lijst per provincie, zoeken op stad op Mapetanque.be.",
        region_provinces_couvertes: "provincies",
        region_provinces_de_la_region: "Provincies in {nom}",
        stats_no_results: "Geen gemeente gevonden.",
        stats_show_terrains: "Terreinen weergeven",

        geo_region_wallonie: "Wallonië",
        geo_region_flandre: "Vlaanderen",
        geo_region_bruxelles: "Brussel",
        geo_province_brabant_wallon: "Waals-Brabant",
        geo_province_hainaut: "Henegouwen",
        geo_province_liege: "Luik",
        geo_province_luxembourg: "Luxemburg",
        geo_province_namur: "Namen",
        geo_province_anvers: "Antwerpen",
        geo_province_brabant_flamand: "Vlaams-Brabant",
        geo_province_limbourg: "Limburg",
        geo_province_flandre_orientale: "Oost-Vlaanderen",
        geo_province_flandre_occidentale: "West-Vlaanderen",

        about_title: "Over ons",
        about_text: "Mapetanque.be is ontstaan uit de vaststelling dat er geen enkele website bestond waarmee " +
            "je op een praktische en snelle manier vrij toegankelijke petanquebanen in België kon vinden. Het " +
            "project is nog steeds in ontwikkeling. De site is gratis, zonder advertenties, en de broncode is " +
            "open-source.",

        contact_title: "Contacteer ons",
        contact_text: "Heb je een suggestie, wil je een fout melden of wil je meewerken aan het project? " +
            "Aarzel niet om contact met mij op te nemen.",
        contact_email: "mapetanque@outlook.be",

        faq_title: "FAQ",
        faq_items: [
            {
                q: "Waar komt de informatie op de kaart vandaan?",
                a: "De weergegeven terreinen zijn afkomstig van de vrije gegevens van OpenStreetMap. Mapetanque.be " +
                   "haalt deze informatie elke maandag op om een bijgewerkte kaart van de petanquebanen in " +
                   "België aan te bieden."
            },
            {
                q: "Hoe vind ik een terrein in mijn buurt?",
                a: "Klik op de knop \"📍 Localiseer mij\" om je positie weer te geven en de terreinen in jouw " +
                   "buurt te bekijken."
            },
            {
                q: "Kan ik een foto, beoordeling of praktische informatie toevoegen?",
                a: "Deze functie is gepland voor een toekomstige update van Mapetanque.be."
            },
            {
                q: "Hoe voeg ik een ontbrekend terrein toe?",
                a: "De terreinen die op Mapetanque.be worden weergegeven, zijn afkomstig van de vrije gegevens van " +
                   "OpenStreetMap. Als je een openbaar toegankelijke petanquebaan kent die niet op de " +
                   "kaart verschijnt, kun je: het rechtstreeks toevoegen aan OpenStreetMap via hun " +
                   "bewerkingstool; of ons de nodige informatie per e-mail bezorgen 📧 mapetanque@outlook.be " +
                   "(precieze locatie, aantal banen indien bekend, enz.). Na bijwerking van de " +
                   "OpenStreetMap-gegevens verschijnt het terrein automatisch op Mapetanque.be bij de volgende " +
                   "synchronisatie."
            },
            {
                q: "Een terrein op de kaart bestaat niet meer of is niet meer bruikbaar, wat kan ik doen?",
                a: "De terreinen die op Mapetanque.be worden weergegeven, zijn afkomstig van de vrije gegevens van " +
                   "OpenStreetMap. Aangezien deze database collaboratief is, kan sommige informatie onvolledig " +
                   "of verouderd zijn. Als een terrein niet meer bestaat of niet meer openbaar toegankelijk is, " +
                   "kun je: de informatie rechtstreeks aanpassen in OpenStreetMap via hun bewerkingstool; of de " +
                   "fout aan ons melden per e-mail 📧 mapetanque@outlook.be met vermelding van de locatie van " +
                   "het terrein en nuttige informatie. Als het terrein nog wel bestaat maar gewoon slecht " +
                   "onderhouden of beschadigd is, neem je best contact op met de betrokken gemeente (dienst " +
                   "sport, werken of groenvoorziening), die doorgaans verantwoordelijk is voor het onderhoud " +
                   "van openbare voorzieningen."
            }
        ],

        popup_terrain_default: "Petanquebaan",
        popup_terrain_prefix: "Baan",
        popup_access_label: "Toegang",
        popup_access_public: "openbaar",
        popup_access_probable: "waarschijnlijk openbaar",
        popup_distance_label: "Afstand",
        popup_distance_hint: "Klik op \"Localiseer mij\" om de afstand te zien",
        popup_photo_credit_wikimedia: "Foto: Wikimedia Commons",
        popup_photo_credit_mapillary: "Foto: Mapillary",
        popup_itinerary: "Route weergeven",
        popup_here: "Je bent hier",
        nearest_terrain_label: "Dichtstbijzijnde terrein",

        stats_loading: "Statistieken laden…",
        stats_unavailable: "Statistieken niet beschikbaar",
        stats_count: (n) => `${n} terrein${n > 1 ? "en" : ""} geregistreerd`,
        stats_last_update: "Update",
    },

    de: {
        html_lang: "de",

        meta_title: "Mapetanque.be",
        meta_description: "Mapetanque.be zeigt auf einer interaktiven Karte alle öffentlich zugänglichen Pétanque-Plätze in Belgien, mit Standortsuche nach Stadt oder Region.",

        locate_btn: "Meinen Standort finden",
        search_placeholder: "Adresse, Stadt, Region...",
        hero_headline: "Finden Sie einen Pétanque-Platz",
        browse_list_btn: "Durchsuchen",
        add_terrain_link: "Einen Platz hinzufügen",
        search_no_result: "Keine Ergebnisse für diese Suche gefunden.",
        search_failed: "Die Suche ist fehlgeschlagen, bitte versuchen Sie es gleich noch einmal.",

        open_menu: "Menü öffnen",
        close_menu: "Menü schließen",
        fullscreen_enter: "Vollbild",
        fullscreen_exit: "Vollbild beenden",
        close_panel: "Schließen",

        share_site_btn: "📤 Teilen",
        share_site_title: "Mapetanque.be teilen",
        share_terrain_title: "Diesen Platz teilen",
        share_whatsapp: "WhatsApp",
        share_facebook: "Facebook",
        share_twitter: "X (Twitter)",
        share_email: "E-Mail",
        share_copy: "Link kopieren",
        share_copied: "Link kopiert!",
        popup_share: "Diesen Platz teilen",

        menu_about: "Über uns",
        menu_contact: "Kontakt",
        menu_faq: "FAQ",

        stats_page_title: "Liste der Plätze",
        stats_headline_label: "erfasste Boule-/Pétanque-Plätze in Belgien",
        stats_terrains_unit: "Plätze",
        stats_geo_loading: "Details nach Region werden geladen…",
        stats_geo_error: "Die Details nach Region konnten nicht geladen werden.",
        stats_search_commune_placeholder: "Gemeinde suchen…",
        provinces_section_title: "Nach Provinz durchsuchen",
        regions_section_title: "Nach Region durchsuchen",
        province_accueil_breadcrumb: "Startseite",
        province_terrains_recenses: "erfasste Plätze",
        province_communes_couvertes: "Gemeinden mit Plätzen",
        province_terrains_100km2: "Plätze pro 100 km²",
        province_communes_de_la_province: "Gemeinden der Provinz",
        province_communes_de_la_region_bruxelles: "Gemeinden der Region",
        province_autres_provinces: "Andere Provinzen",
        province_terrain_singulier: "Platz",
        province_h1_template: "Pétanque-Plätze in der Provinz {nom}",
        province_h1_bruxelles_template: "Pétanque-Plätze in {nom}",
        province_meta_description: "Öffentliche Pétanque-Plätze in der Provinz {nom}: interaktive Karte, Liste nach Gemeinde, Suche nach Stadt auf Mapetanque.be.",
        region_h1_template: "Pétanque-Plätze in {nom}",
        region_meta_description: "Öffentliche Pétanque-Plätze in {nom}: interaktive Karte, Liste nach Provinz, Suche nach Stadt auf Mapetanque.be.",
        region_provinces_couvertes: "Provinzen",
        region_provinces_de_la_region: "Provinzen in {nom}",
        stats_no_results: "Keine Gemeinde gefunden.",
        stats_show_terrains: "Plätze anzeigen",

        geo_region_wallonie: "Wallonien",
        geo_region_flandre: "Flandern",
        geo_region_bruxelles: "Brüssel",
        geo_province_brabant_wallon: "Wallonisch-Brabant",
        geo_province_hainaut: "Hennegau",
        geo_province_liege: "Lüttich",
        geo_province_luxembourg: "Luxemburg",
        geo_province_namur: "Namur",
        geo_province_anvers: "Antwerpen",
        geo_province_brabant_flamand: "Flämisch-Brabant",
        geo_province_limbourg: "Limburg",
        geo_province_flandre_orientale: "Ostflandern",
        geo_province_flandre_occidentale: "Westflandern",

        about_title: "Über uns",
        about_text: "Mapetanque.be entstand aus der Feststellung, dass es keine Website gab, mit der man " +
            "schnell und unkompliziert öffentlich zugängliche Pétanque-Plätze in Belgien finden konnte. Das " +
            "Projekt befindet sich weiterhin in der Entwicklung. Die Seite ist kostenlos, werbefrei, und der " +
            "Quellcode ist Open Source.",

        contact_title: "Kontakt",
        contact_text: "Haben Sie einen Vorschlag, einen Fehler entdeckt oder möchten Sie am Projekt " +
            "mitwirken? Zögern Sie nicht, mich zu kontaktieren.",
        contact_email: "mapetanque@outlook.be",

        faq_title: "FAQ",
        faq_items: [
            {
                q: "Woher stammen die auf der Karte angezeigten Informationen?",
                a: "Die angezeigten Plätze stammen aus den freien Daten von OpenStreetMap. Mapetanque.be ruft " +
                   "diese Informationen jeden Montag ab, um eine aktualisierte Karte der Pétanque-Plätze in " +
                   "Belgien anzubieten."
            },
            {
                q: "Wie finde ich einen Platz in meiner Nähe?",
                a: "Klicken Sie auf die Schaltfläche \"📍 Meinen Standort finden\", um Ihre Position " +
                   "anzuzeigen und die Plätze in Ihrer Nähe zu sehen."
            },
            {
                q: "Kann ich ein Foto, eine Bewertung oder praktische Informationen hinzufügen?",
                a: "Diese Funktion ist für eine zukünftige Aktualisierung von Mapetanque.be geplant."
            },
            {
                q: "Wie füge ich einen fehlenden Platz hinzu?",
                a: "Die auf Mapetanque.be angezeigten Plätze stammen aus den freien Daten von OpenStreetMap. " +
                   "Wenn Sie einen öffentlich zugänglichen Pétanque-Platz kennen, der nicht auf der Karte " +
                   "erscheint, können Sie: ihn direkt über das Bearbeitungswerkzeug zu OpenStreetMap " +
                   "hinzufügen; oder uns die notwendigen Informationen per E-Mail zusenden " +
                   "📧 mapetanque@outlook.be (genauer Standort, Anzahl der Bahnen, falls bekannt, usw.). " +
                   "Nach der Aktualisierung der OpenStreetMap-Daten erscheint der Platz bei der nächsten " +
                   "Synchronisierung automatisch auf Mapetanque.be."
            },
            {
                q: "Ein auf der Karte angezeigter Platz existiert nicht mehr oder ist nicht mehr nutzbar, was kann ich tun?",
                a: "Die auf Mapetanque.be angezeigten Plätze stammen aus den freien Daten von OpenStreetMap. Da " +
                   "diese Datenbank kollaborativ ist, können manche Informationen unvollständig oder veraltet " +
                   "sein. Wenn ein Platz nicht mehr existiert oder nicht mehr öffentlich zugänglich ist, " +
                   "können Sie: die Information direkt über das Bearbeitungswerkzeug in OpenStreetMap ändern; " +
                   "oder uns den Fehler per E-Mail melden 📧 mapetanque@outlook.be, mit Angabe des Standorts " +
                   "des Platzes und nützlicher Informationen. Wenn der Platz noch existiert, aber lediglich " +
                   "schlecht gepflegt oder beschädigt ist, wenden Sie sich am besten an die zuständige " +
                   "Gemeinde (Sport-, Bau- oder Grünflächenamt), die in der Regel für die Instandhaltung " +
                   "öffentlicher Einrichtungen zuständig ist."
            }
        ],

        popup_terrain_default: "Pétanque-Platz",
        popup_terrain_prefix: "Platz",
        popup_access_label: "Zugang",
        popup_access_public: "öffentlich",
        popup_access_probable: "wahrscheinlich öffentlich",
        popup_distance_label: "Entfernung",
        popup_distance_hint: "Klicken Sie auf \"Meinen Standort finden\", um die Entfernung zu sehen",
        popup_photo_credit_wikimedia: "Foto: Wikimedia Commons",
        popup_photo_credit_mapillary: "Foto: Mapillary",
        popup_itinerary: "Route anzeigen",
        popup_here: "Sie sind hier",
        nearest_terrain_label: "Nächstgelegener Platz",

        stats_loading: "Statistiken werden geladen…",
        stats_unavailable: "Statistiken nicht verfügbar",
        stats_count: (n) => `${n} ${n > 1 ? "Plätze" : "Platz"} erfasst`,
        stats_last_update: "Aktualisiert",
    }

};