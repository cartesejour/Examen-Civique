const App = {
    async init() {
        // 1. Lancement de l'anti-AdBlock
        this.checkAdBlock(); 

        // 2. Gestion du score précédent
        const savedScore = localStorage.getItem('lastScoreCivique');
        if(savedScore) {
            const data = JSON.parse(savedScore);
            document.getElementById('last-score-container').classList.remove('hidden');
            document.getElementById('last-score-val').innerText = data.score + "/" + data.total;
            const b = document.getElementById('last-score-status');
            // Le ratio de réussite officiel est de 80%
            if(data.score >= (data.total * 0.8)) { 
                b.innerText = "Admis"; 
                b.className = "px-3 py-1 rounded-full text-[10px] font-black bg-green-100 text-green-700"; 
            } else { 
                b.innerText = "Échec"; 
                b.className = "px-3 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-700"; 
            }
        }

        // 3. Chargement de la base de données
        const dataFR = await API.loadBaseFR();
        if(!dataFR || dataFR.length === 0) {
            UI.showCustomAlert("Problème de données", "Impossible de charger les questions.");
            return;
        }
        QuizEngine.init(dataFR);
        
        // 4. 💾 RESTAURATION AVEC JOLIE MODAL (Remplace le vieux confirm)
        const inProgress = localStorage.getItem('quizInProgress');
        if (inProgress) {
            UI.openModal('modal-resume'); 
        }
        
        // Au chargement de la page :
window.addEventListener('DOMContentLoaded', () => {
    
    // Si la personne est DÉJÀ abonnée, on cache le footer direct !
    if (localStorage.getItem('est_abonne') === 'true') {
        const footerNews = document.getElementById('footer-newsletter');
        if (footerNews) footerNews.classList.add('hidden');
    }

    // (Gardez ici votre code qui affiche le pop-up au bout de 5 secondes s'il ne l'a pas déjà vu)
    if (!localStorage.getItem('newsletter_deja_vue')) {
        setTimeout(() => {
            // On affiche le pop-up QUE s'il n'est pas déjà abonné
            if(localStorage.getItem('est_abonne') !== 'true') {
                const popup = document.getElementById('modal-newsletter-popup');
                if (popup) {
                    popup.classList.remove('hidden');
                    localStorage.setItem('newsletter_deja_vue', 'true');
                }
            }
        }, 5000); 
    }
    
});
    },

    // 💾 Fonction pour sauvegarder la progression
    saveProgress() {
        const stateToSave = { ...QuizEngine.state, timer: null }; 
        localStorage.setItem('quizInProgress', JSON.stringify(stateToSave));
    },

    // 🆕 Fonction appelée quand on clique sur "Oui" dans le modal de reprise
    resumeQuiz() {
        const savedState = JSON.parse(localStorage.getItem('quizInProgress'));
        QuizEngine.state = savedState;
        UI.closeModal('modal-resume');
        UI.switchScreen('screen-quiz');
        document.getElementById('q-counter').classList.remove('hidden');
        document.getElementById('timer-zone').classList.remove('hidden');
        this.startTimer();
        UI.renderQuestion(QuizEngine.state);
    },

    // 🆕 Fonction appelée quand on clique sur "Non" dans le modal de reprise
    discardQuiz() {
        localStorage.removeItem('quizInProgress');
        UI.closeModal('modal-resume');
    },

    async startQuiz(lvl) {
        if (!QuizEngine.state.allFR || QuizEngine.state.allFR.length === 0) return;

        // On lit le nombre de questions choisi dans la liste déroulante !
        const selector = document.getElementById('questions-selector');
        const nbQuestions = selector ? parseInt(selector.value) : 40;
        
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

    validerAbonnement() {
        // 1. On mémorise dans le téléphone que la personne est abonnée !
        localStorage.setItem('est_abonne', 'true');
        
        // 2. On fait disparaître le bloc du footer immédiatement sous ses yeux
        const footerNews = document.getElementById('footer-newsletter');
        if (footerNews) {
            footerNews.classList.add('hidden');
        }
    },
    
checkAdBlock() {
        const detecter = async () => {
            let isBlocked = false;

            // TEST 1 : Le test visuel
            const bait = document.createElement('div');
            bait.className = 'pub_300x250 pub_300x250m pub_728x90 text-ad textAd adSense ad-unit ad-zone ad-space adsbox';
            bait.style.position = 'absolute';
            bait.style.top = '-9999px';
            bait.style.height = '1px';
            bait.style.width = '1px';
            document.body.appendChild(bait);
            
            // CALIBRAGE : On laisse 100 millisecondes à l'écran pour dessiner la boîte
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (bait.offsetHeight === 0 || window.getComputedStyle(bait).display === 'none') {
                isBlocked = true;
            }
            bait.remove();

            // TEST 2 : Le test réseau (Assoupli)
            if (!isBlocked) {
                try {
                    await fetch("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", {
                        method: 'HEAD',
                        mode: 'no-cors',
                        cache: 'no-store'
                    });
                } catch (e) {
                    // CALIBRAGE : On sanctionne SEULEMENT si l'utilisateur a internet. 
                    // Si navigator.onLine est false, c'est juste une perte de connexion !
                    if (navigator.onLine) {
                        isBlocked = true;
                    }
                }
            }

            // SANCTION 
            if (isBlocked) {
                const modal = document.getElementById('modal-adblock');
                if (modal) {
                    modal.classList.remove('hidden');
                    document.body.style.overflow = 'hidden'; // Bloque le défilement
                }
            }
        };

        // CALIBRAGE : On attend 2.5 secondes au démarrage. Le site a le temps de respirer et de charger.
        setTimeout(() => {
            detecter();
            
            // CALIBRAGE : On revérifie toutes les 15 secondes (au lieu de 3s). 
            // C'est amplement suffisant et ça ne vide pas la batterie du téléphone !
            setInterval(detecter, 15000);
        }, 2500);
   }
    
};

// Connexion HTML / JS
window.App = App;
window.UI = UI;

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// ==========================================
// POP-UP NEWSLETTER INTELLIGENTE
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    // On vérifie si la personne a déjà vu la newsletter
    if (!localStorage.getItem('newsletter_deja_vue')) {
        
        // On attend 5 secondes pour le laisser lire un peu le site
        setTimeout(() => {
            const popup = document.getElementById('modal-newsletter-popup');
            if (popup) {
                popup.classList.remove('hidden');
                // On enregistre dans son téléphone qu'il l'a vue !
                localStorage.setItem('newsletter_deja_vue', 'true');
            }
        }, 5000); 
    }
});
