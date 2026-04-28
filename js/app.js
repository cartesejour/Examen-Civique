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
        // 1. On mémorise que la personne est abonnée
        localStorage.setItem('est_abonne', 'true');
        
        // 2. On cache le footer
        const footerNews = document.getElementById('footer-newsletter');
        if (footerNews) {
            footerNews.classList.add('hidden');
        }

        // 3. On cache le pop-up (si c'est par là qu'il s'est abonné)
        const popup = document.getElementById('modal-newsletter-popup');
        if (popup) {
            popup.classList.add('hidden');
        }

        // 4. Message de succès après une petite demi-seconde
        setTimeout(() => {
            alert("🎉 Félicitations ! Votre inscription est validée. Vous recevrez très vite nos astuces pour la préfecture !");
        }, 500);
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
// GESTION DE LA NEWSLETTER (Pop-up & Footer)
// ==========================================

// Fonction qui se lance quand on clique sur "S'abonner"
window.validerAbonnement = function() {
    // 1. On mémorise dans le navigateur que c'est fait
    localStorage.setItem('est_abonne', 'true');
    
    // 2. On fait disparaître le footer instantanément
    const footerNews = document.getElementById('footer-newsletter');
    if (footerNews) {
        footerNews.classList.add('hidden');
    }

    // 3. On fait disparaître le pop-up d'inscription (s'il était ouvert)
    const popup = document.getElementById('modal-newsletter-popup');
    if (popup) {
        popup.classList.add('hidden');
    }

    // 4. On affiche la MAGNIFIQUE fenêtre de succès après une petite demi-seconde !
    setTimeout(() => {
        const successModal = document.getElementById('modal-newsletter-success');
        if (successModal) {
            successModal.classList.remove('hidden');
        }
    }, 500);
};

// Logique qui s'exécute à chaque fois qu'on ouvre le site
window.addEventListener('DOMContentLoaded', () => {
    
    // SI la personne est DÉJÀ abonnée
    if (localStorage.getItem('est_abonne') === 'true') {
        // On cache le footer pour toujours
        const footerNews = document.getElementById('footer-newsletter');
        if (footerNews) footerNews.classList.add('hidden');
    } 
    // SINON (elle n'est pas abonnée)
    else {
        // Est-ce qu'on lui a déjà montré le pop-up ?
        if (!localStorage.getItem('newsletter_deja_vue')) {
            // Si non, on attend 5 secondes et on l'affiche
            setTimeout(() => {
                const popup = document.getElementById('modal-newsletter-popup');
                if (popup) {
                    popup.classList.remove('hidden');
                    // On note qu'on lui a montré pour ne pas la harceler demain
                    localStorage.setItem('newsletter_deja_vue', 'true');
                }
            }, 5000); 
        }
    }
});


// ==========================================
// BOÎTE À OUTILS : PDF
// ==========================================
const OutilsPDF = {
    
    // 1. Quand l'utilisateur choisit ses fichiers
    afficherFichiers: function() {
        const input = document.getElementById('pdf-input');
        const liste = document.getElementById('pdf-list');
        const btn = document.getElementById('btn-fusionner');
        
        liste.innerHTML = ''; // On vide la liste
        
        if (input.files.length === 0) {
            btn.classList.add('hidden');
            return;
        }

        // On affiche le nom des fichiers sélectionnés
        Array.from(input.files).forEach((file, index) => {
            const p = document.createElement('p');
            p.className = "truncate border-b border-gray-100 pb-1";
            p.innerText = `${index + 1}. ${file.name}`;
            liste.appendChild(p);
        });

        // Si on a au moins 2 fichiers, on affiche le bouton "Fusionner"
        if (input.files.length >= 2) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
            liste.innerHTML += '<p class="text-rouge-marianne font-bold mt-1">⚠️ Choisissez au moins 2 fichiers pour fusionner.</p>';
        }
    },

    // 2. Quand on clique sur "Fusionner"
    fusionner: async function() {
        const input = document.getElementById('pdf-input');
        const btn = document.getElementById('btn-fusionner');
        
        if (input.files.length < 2) return;

        try {
            // On change l'état du bouton pour faire patienter
            btn.innerText = "⏳ Fusion en cours...";
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.disabled = true;

            // On crée un nouveau PDF vide
            const { PDFDocument } = PDFLib;
            const pdfFinal = await PDFDocument.create();

            // On boucle sur chaque fichier choisi par l'utilisateur
            for (let file of input.files) {
                // On lit le fichier
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFDocument.load(arrayBuffer);
                
                // On copie toutes ses pages
                const pages = await pdfFinal.copyPages(pdf, pdf.getPageIndices());
                
                // On les colle dans le nouveau PDF
                pages.forEach((page) => pdfFinal.addPage(page));
            }

            // On sauvegarde le résultat
            const pdfBytes = await pdfFinal.save();

            // On déclenche le téléchargement du fichier final !
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Dossier_ANEF_Fusionne.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // On remet le bouton à zéro
            btn.innerText = "✅ Fusion réussie ! Téléchargement en cours...";
            setTimeout(() => {
                btn.innerText = "Fusionner et Télécharger";
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                btn.disabled = false;
            }, 3000);

        } catch (erreur) {
            console.error("Erreur lors de la fusion :", erreur);
            alert("Une erreur s'est produite lors de la fusion. Vérifiez que vos fichiers sont bien des PDF valides et non protégés par mot de passe.");
            btn.innerText = "Fusionner et Télécharger";
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
};
