const App = {
    async init() {
        this.checkAdBlock(); 

        const savedScore = localStorage.getItem('lastScoreCivique');
        if(savedScore) {
            const data = JSON.parse(savedScore);
            document.getElementById('last-score-container').classList.remove('hidden');
            document.getElementById('last-score-val').innerText = data.score; // Score dynamique
            const b = document.getElementById('last-score-status');
            // Le ratio de réussite officiel est de 80% (ex: 32/40 ou 8/10)
            if(data.score >= (data.total * 0.8)) { b.innerText = "Admis"; b.className = "px-3 py-1 rounded-full text-[10px] font-black bg-green-100 text-green-700"; }
            else { b.innerText = "Échec"; b.className = "px-3 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-700"; }
        }

        const dataFR = await API.loadBaseFR();
        if(!dataFR || dataFR.length === 0) {
            UI.showCustomAlert("Problème de données", "Impossible de charger les questions.");
            return;
        }
        QuizEngine.init(dataFR);
        
        // 💾 RESTAURATION ANTI-CRASH
        const inProgress = localStorage.getItem('quizInProgress');
        if (inProgress) {
            if (confirm("Vous avez un quiz en cours ! Voulez-vous le reprendre là où vous vous étiez arrêté ?")) {
                const savedState = JSON.parse(inProgress);
                QuizEngine.state = savedState;
                UI.switchScreen('screen-quiz');
                document.getElementById('q-counter').classList.remove('hidden');
                document.getElementById('timer-zone').classList.remove('hidden');
                this.startTimer();
                UI.renderQuestion(QuizEngine.state);
            } else {
                localStorage.removeItem('quizInProgress');
            }
        }
    },

    // 💾 Fonction pour sauvegarder la progression
    saveProgress() {
        const stateToSave = { ...QuizEngine.state, timer: null }; 
        localStorage.setItem('quizInProgress', JSON.stringify(stateToSave));
    },

    async startQuiz(lvl, nbQuestions = 40) { // <-- Ajout du paramètre
        if (!QuizEngine.state.allFR || QuizEngine.state.allFR.length === 0) return;

        const lang = document.getElementById('lang-selector').value;
        const helpData = await API.loadHelp(lang);
        
        QuizEngine.start(lvl, lang, helpData, nbQuestions);
        this.saveProgress(); // 💾 On sauvegarde dès le début

        UI.switchScreen('screen-quiz');
        document.getElementById('q-counter').classList.remove('hidden');
        document.getElementById('timer-zone').classList.remove('hidden');
        
        this.startTimer();
        UI.renderQuestion(QuizEngine.state);
    },

    handleAnswer(index) {
        QuizEngine.setAnswer(index);
        this.saveProgress(); // 💾 Sauvegarde à chaque réponse
        UI.renderQuestion(QuizEngine.state);
    },

    handleNext() {
        const res = QuizEngine.next();
        if (res === false) UI.showCustomAlert("Action requise", "Veuillez sélectionner une réponse.");
        else if (res === 'finish') this.finishQuiz();
        else { 
            this.saveProgress(); // 💾 Sauvegarde au changement de question
            UI.renderQuestion(QuizEngine.state); 
            window.scrollTo(0,0); 
        }
    },

    handlePrev() {
        if (QuizEngine.prev()) {
            this.saveProgress();
            UI.renderQuestion(QuizEngine.state);
        }
    },

    // 🛑 ABANDON UTILE : On génère le bilan avec ce qui a été fait
    abandonQuiz() {
        clearInterval(QuizEngine.state.timer);
        UI.closeModal('modal-quit');

        const qRepondues = QuizEngine.state.index; // Nombre de questions vues
        
        if (qRepondues === 0) {
            // S'il n'a rien répondu, on quitte juste
            localStorage.removeItem('quizInProgress');
            location.reload();
            return;
        }

        // On coupe les tableaux pour ne garder que ce qu'il a fait
        QuizEngine.state.questions = QuizEngine.state.questions.slice(0, qRepondues);
        QuizEngine.state.userAnswers = QuizEngine.state.userAnswers.slice(0, qRepondues);
        
        this.finishQuiz();
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
        localStorage.removeItem('quizInProgress'); // 💾 On supprime la sauvegarde puisqu'il a fini
        
        const score = QuizEngine.getScore();
        const total = QuizEngine.state.questions.length;
        
        localStorage.setItem('lastScoreCivique', JSON.stringify({ score: score, total: total }));
        UI.showResults(score, QuizEngine.state);
    },
    
    checkAdBlock() {
        const detecter = () => {
            // On crée "l'appât ultime" avec les mots-clés les plus bloqués au monde
            const bait = document.createElement('div');
            bait.id = 'ad-banner'; 
            bait.className = 'ads ad adsbox doubleclick sponsor advertisement'; 
            
            // On le rend minuscule mais "visible" sur la page pour piéger le bloqueur
            bait.style.width = '1px';
            bait.style.height = '1px';
            bait.style.position = 'absolute';
            bait.style.left = '-9999px'; // On le cache sur le côté gauche, pas en haut
            
            document.body.appendChild(bait);

            // On laisse 500ms au bloqueur pour faire son travail
            setTimeout(() => {
                // Si l'élément a été écrasé (hauteur/largeur à 0) ou caché (display none)
                const style = window.getComputedStyle(bait);
                const isBlocked = bait.offsetHeight === 0 || bait.clientWidth === 0 || style.display === 'none';

                if (isBlocked) {
                    // BAM ! Bloqueur détecté, on lève le bouclier
                    const modal = document.getElementById('modal-adblock');
                    if (modal) modal.classList.remove('hidden');
                }
                
                // On nettoie la page pour ne pas l'alourdir
                bait.remove();
            }, 500); 
        };

        // 1. On lance la détection au chargement
        detecter();

        // 2. On harcèle le tricheur toutes les 3 secondes s'il essaie d'enlever le message
        setInterval(detecter, 3000);
    }
};

// Connexion HTML / JS
window.App = App;
window.UI = UI;

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
