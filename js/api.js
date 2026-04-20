const API = {
    async loadBaseFR() {
        try {
            const res = await fetch('data/questions_fr.json');
            return await res.json();
        } catch (e) {
            console.error("Erreur Base FR", e);
            return [];
        }
    },
    async loadHelp(lang) {
        if (lang === "none") return [];
        try {
            const res = await fetch(`data/questions_${lang}.json`);
            return await res.json();
        } catch (e) {
            console.warn("Traduction indisponible", e);
            return [];
        }
    }
};