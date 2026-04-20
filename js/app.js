const App = {
    async init() {
        this.checkAdBlock(); // Lancement de la vérification AdBlock
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
