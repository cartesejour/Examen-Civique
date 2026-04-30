const QuizEngine = {
    state: {
        allFR: [], allHelp: [], questions: [], userAnswers: [],
        index: 0, selectedLang: "none", timer: null, timeLeft: 45 * 60
    },

    init(dataFR) { this.state.allFR = dataFR; },

start(lvl, lang, helpData, nbQuestions = 40) {
    this.state.selectedLang = lang;
    this.state.allHelp = helpData;
    this.state.index = 0;
    this.state.timeLeft = nbQuestions * 60; // 1 minute par question
    
    // Plus besoin du "filter" ! allFR contient déjà exactement les bonnes questions
    this.state.questions = this.state.allFR.sort(() => 0.5 - Math.random()).slice(0, nbQuestions);
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
        return wrongs.sort(() => 0.5 - Math.random()).slice(0, 2);
    }
};
