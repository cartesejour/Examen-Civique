const API = {
    async loadBaseFR(lvl) {
        try {
            // lvl.toLowerCase() donnera 'csp' ou 'cr'
            const res = await fetch(`data/questions_${lvl.toLowerCase()}_fr.json`);
            return await res.json();
        } catch (e) {
            console.error("Erreur Base FR", e);
            return [];
        }
    },
    async loadHelp(lvl, lang) {
        if (lang === "none") return [];
        try {
            const res = await fetch(`data/questions_${lvl.toLowerCase()}_${lang}.json`);
            return await res.json();
        } catch (e) {
            console.warn(`Traduction ${lang} indisponible pour le niveau ${lvl}`, e);
            return [];
        }
    }
};
