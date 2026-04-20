const App = {
    async init() {
        // 1. Restaurer le dernier score
        const saved = localStorage.getItem('lastScoreCivique');
        if(saved) {
            const data = JSON.parse(saved);
            document.getElementById('last-score-container').classList.remove('hidden');
            document.getElementById('last-score-val').innerText = data.score + "/40";
            const b = document.getElementById('last-score-status');
            if(data.score >= 32) { b.innerText = "Admis"; b.className = "px-3 py-1 rounded-full text-[10px] font-black bg-green-100 text-green-700"; }
            else { b.innerText = "Échec"; b.className = "px-3 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-700"; }
        }

        // 2. Charger la base de données
        const dataFR = await API.loadBaseFR();
        
        // SÉCURITÉ : On vérifie que les données sont bien là
        if(!dataFR || dataFR.length === 0) {
            UI.showCustomAlert("Problème de données", "Impossible de charger les questions. Vérifiez que 'questions_fr.json' est bien dans le dossier 'data/'.");
            return;
        }
        
        QuizEngine.init(dataFR);
        console.log("Base de données chargée avec succès :", dataFR.length, "questions.");
    },

    async startQuiz(lvl) {
        // SÉCURITÉ : Empêche de lancer un quiz vide
        if (!QuizEngine.state.allFR || QuizEngine.state.allFR.length === 0) {
            return UI.showCustomAlert("Erreur", "Les questions ne sont pas encore prêtes.");
        }

        const lang = document.getElementById('lang-selector').value;
        const helpData = await API.loadHelp(lang);
        
        QuizEngine.start(lvl, lang, helpData);
        UI.switchScreen('screen-quiz');
        document.getElementById('q-counter').classList.remove('hidden');
        document.getElementById('timer-zone').classList.remove('hidden');
        
        this.startTimer();
        UI.renderQuestion(QuizEngine.state);
    },

    handleAnswer(index) {
        QuizEngine.setAnswer(index);
        UI.renderQuestion(QuizEngine.state);
    },

    handleNext() {
        const res = QuizEngine.next();
        if (res === false) UI.showCustomAlert("Action requise", "Veuillez sélectionner une réponse.");
        else if (res === 'finish') this.finishQuiz();
        else { UI.renderQuestion(QuizEngine.state); window.scrollTo(0,0); }
    },

    handlePrev() {
        if (QuizEngine.prev()) UI.renderQuestion(QuizEngine.state);
    },

    handleJoker() {
        UI.triggerAd('joker', () => {
            const wrongIndexes = QuizEngine.useJoker();
            UI.hideJokerOptions(wrongIndexes);
        });
    },

    handleCorrection() {
        UI.triggerAd('correction', () => UI.renderCorrection(QuizEngine.state));
    },

    startTimer() {
        QuizEngine.state.timer = setInterval(() => {
            QuizEngine.state.timeLeft--;
            UI.updateTimer(QuizEngine.state.timeLeft);
            if(QuizEngine.state.timeLeft <= 0) this.finishQuiz();
        }, 1000);
    },

    finishQuiz() {
        clearInterval(QuizEngine.state.timer);
        const score = QuizEngine.getScore();
        localStorage.setItem('lastScoreCivique', JSON.stringify({ score: score }));
        //UI.showResults(score, QuizEngine.state.questions.length);
        UI.showResults(score, QuizEngine.state);
    }
};

// Connexion HTML / JS
window.App = App;
window.UI = UI;

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
