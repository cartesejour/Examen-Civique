const QuizEngine = {
    state: {
        allFR: [], allHelp: [], questions: [], userAnswers: [],
        index: 0, selectedLang: "none", timer: null, timeLeft: 45 * 60
    },

    init(dataFR) { this.state.allFR = dataFR; },


 start(lvl, lang, helpData, nbQuestions = 40) {
        this.state.selectedLang = lang;
        this.state.allHelp = helpData || []; // Sécurité si helpData est vide
        this.state.index = 0;
        this.state.timeLeft = nbQuestions * 60; // 1 minute par question
        
        // 1. On mélange directement TOUTE la base (plus besoin de "filter" !)
        let selectedFR = this.state.allFR.sort(() => 0.5 - Math.random()).slice(0, nbQuestions);
        
        // 2. ✨ FUSION AVEC LA TRADUCTION ✨
        // Pour chaque question FR, on cherche sa petite soeur traduite grâce à l'ID
        this.state.questions = selectedFR.map(qFR => {
            let qTrad = this.state.allHelp.find(trad => trad.id === qFR.id);
            return {
                ...qFR, // On garde toutes les infos de la question en français
                traduction: qTrad ? qTrad : null // On ajoute un objet "traduction" (ou null si français uniquement)
            };
        });

        this.state.userAnswers = new Array(this.state.questions.length).fill(null);
    },   

    setAnswer(ansIndex) { this.state.userAnswers[this.state.index] = ansIndex; },

    next() {
        if (this.state.userAnswers[this.state.index] === null) return false;
        if (this.state.index < this.state.questions.length - 1) {
            this.state.index++; return true;
        }
        return 'finish';
    },

    prev() {
        if (this.state.index > 0) { this.state.index--; return true; }
        return false;
    },

    getScore() {
        return this.state.questions.reduce((acc, q, i) => acc + (this.state.userAnswers[i] === q.bonne_reponse ? 1 : 0), 0);
    },

useJoker() {
        const q = this.state.questions[this.state.index];
        let wrongs = [];
        q.options.forEach((_, i) => { if(i !== q.bonne_reponse) wrongs.push(i); });
        
        const eliminated = wrongs.sort(() => 0.5 - Math.random()).slice(0, 2);
        
        // ✨ CORRECTION : On sauvegarde les boutons éliminés dans la mémoire de l'application
        if (!this.state.hiddenOptions) this.state.hiddenOptions = {};
        this.state.hiddenOptions[this.state.index] = eliminated;
        
        return eliminated;
    }
};
