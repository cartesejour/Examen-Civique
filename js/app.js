const App = {
    async init() {
        // 1. Lancement de l'anti-AdBlock
        this.checkAdBlock(); 

        // 2. Gestion du score précédent
        const savedScore = localStorage.getItem('lastScoreCivique');
        if(savedScore) {
            const data = JSON.parse(savedScore);
            const container = document.getElementById('last-score-container');
            if(container) {
                container.classList.remove('hidden');
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
        }

        // 3. Chargement de la base de données
        const dataFR = await API.loadBaseFR();
        if(!dataFR || dataFR.length === 0) {
            UI.showCustomAlert("Problème de données", "Impossible de charger les questions.");
            return;
        }
        QuizEngine.init(dataFR);
        
        // 4. Restauration avec modal de reprise
        const inProgress = localStorage.getItem('quizInProgress');
        if (inProgress) {
            UI.openModal('modal-resume'); 
        }
    },

    // 💾 Sauvegarde de la progression
    saveProgress() {
        const stateToSave = { ...QuizEngine.state, timer: null }; 
        localStorage.setItem('quizInProgress', JSON.stringify(stateToSave));
    },

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

    discardQuiz() {
        localStorage.removeItem('quizInProgress');
        UI.closeModal('modal-resume');
    },

    async startQuiz(lvl) {
        if (!QuizEngine.state.allFR || QuizEngine.state.allFR.length === 0) return;

        const selector = document.getElementById('questions-selector');
        const nbQuestions = selector ? parseInt(selector.value) : 40;
        
        const lang = document.getElementById('lang-selector').value;
        const helpData = await API.loadHelp(lang);
        
        QuizEngine.start(lvl, lang, helpData, nbQuestions);
        this.saveProgress(); 

        UI.switchScreen('screen-quiz');
        document.getElementById('q-counter').classList.remove('hidden');
        document.getElementById('timer-zone').classList.remove('hidden');
        
        this.startTimer();
        UI.renderQuestion(QuizEngine.state);
    },

    handleAnswer(index) {
        QuizEngine.setAnswer(index);
        this.saveProgress();
        UI.renderQuestion(QuizEngine.state);
    },

    handleNext() {
        const res = QuizEngine.next();
        if (res === false) UI.showCustomAlert("Action requise", "Veuillez sélectionner une réponse.");
        else if (res === 'finish') this.finishQuiz();
        else { 
            this.saveProgress();
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

    abandonQuiz() {
        clearInterval(QuizEngine.state.timer);
        UI.closeModal('modal-quit');

        const qRepondues = QuizEngine.state.index; 
        if (qRepondues === 0) {
            localStorage.removeItem('quizInProgress');
            location.reload();
            return;
        }

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
        localStorage.removeItem('quizInProgress'); 
        
        const score = QuizEngine.getScore();
        const total = QuizEngine.state.questions.length;
        
        localStorage.setItem('lastScoreCivique', JSON.stringify({ score: score, total: total }));
        UI.showResults(score, QuizEngine.state);
    },

    checkAdBlock() {
        const detecter = async () => {
            let isBlocked = false;
            const bait = document.createElement('div');
            bait.className = 'pub_300x250 pub_300x250m pub_728x90 text-ad textAd adSense ad-unit ad-zone ad-space adsbox';
            bait.style.position = 'absolute';
            bait.style.top = '-9999px';
            bait.style.height = '1px';
            bait.style.width = '1px';
            document.body.appendChild(bait);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (bait.offsetHeight === 0 || window.getComputedStyle(bait).display === 'none') {
                isBlocked = true;
            }
            bait.remove();

            if (!isBlocked) {
                try {
                    await fetch("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", {
                        method: 'HEAD', mode: 'no-cors', cache: 'no-store'
                    });
                } catch (e) {
                    if (navigator.onLine) isBlocked = true;
                }
            }

            if (isBlocked) {
                const modal = document.getElementById('modal-adblock');
                if (modal) {
                    modal.classList.remove('hidden');
                    document.body.style.overflow = 'hidden'; 
                }
            }
        };

        setTimeout(() => {
            detecter();
            setInterval(detecter, 15000);
        }, 2500);
    }
};

// ==========================================
// BOÎTE À OUTILS : PDF
// ==========================================
const OutilsPDF = {
    afficherFichiers: function() {
        const input = document.getElementById('pdf-input');
        const liste = document.getElementById('pdf-list');
        const btn = document.getElementById('btn-fusionner');
        
        liste.innerHTML = ''; 
        
        if (input.files.length === 0) {
            btn.classList.add('hidden');
            return;
        }

        Array.from(input.files).forEach((file, index) => {
            const p = document.createElement('p');
            p.className = "truncate border-b border-gray-100 pb-1";
            p.innerText = `${index + 1}. ${file.name}`;
            liste.appendChild(p);
        });

        if (input.files.length >= 2) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
            liste.innerHTML += '<p class="text-rouge-marianne font-bold mt-1">⚠️ Choisissez au moins 2 fichiers pour fusionner.</p>';
        }
    },

    fusionner: async function() {
        const input = document.getElementById('pdf-input');
        const btn = document.getElementById('btn-fusionner');
        
        if (input.files.length < 2) return;

        try {
            btn.innerText = "⏳ Fusion en cours...";
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.disabled = true;

            const { PDFDocument } = PDFLib;
            const pdfFinal = await PDFDocument.create();

            for (let file of input.files) {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFDocument.load(arrayBuffer);
                const pages = await pdfFinal.copyPages(pdf, pdf.getPageIndices());
                pages.forEach((page) => pdfFinal.addPage(page));
            }

            const pdfBytes = await pdfFinal.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Dossier_ANEF_Fusionne.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            btn.innerText = "✅ Fusion réussie !";
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
    },

    // ==========================================
    // 3. Afficher le fichier à compresser
    // ==========================================
    afficherFichierCompression: function() {
        const input = document.getElementById('compress-input');
        const liste = document.getElementById('compress-list');
        const btn = document.getElementById('btn-compresser');
        
        liste.innerHTML = ''; 
        
        if (input.files.length === 0) {
            btn.classList.add('hidden');
            return;
        }

        const file = input.files[0];
        // On calcule le poids en Mo pour l'afficher
        const tailleMo = (file.size / (1024 * 1024)).toFixed(2);
        
        liste.innerHTML = `<p class="font-bold text-bleu-france border-b border-gray-100 pb-1">📄 ${file.name}</p>
                           <p class="mt-1">Poids actuel : <strong class="${tailleMo > 5 ? 'text-rouge-marianne' : 'text-gray-700'}">${tailleMo} Mo</strong></p>`;
        
        btn.classList.remove('hidden');
    },

    // ==========================================
    // 4. Compresser (Reconstruire) le PDF
    // ==========================================
    compresser: async function() {
        const input = document.getElementById('compress-input');
        const btn = document.getElementById('btn-compresser');
        
        if (input.files.length === 0) return;

        try {
            btn.innerText = "⏳ Optimisation en cours...";
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.disabled = true;

            const file = input.files[0];
            const arrayBuffer = await file.arrayBuffer();
            
            const { PDFDocument } = PDFLib;
            
            // On charge le lourd PDF d'origine
            const pdfLourd = await PDFDocument.load(arrayBuffer);
            
            // On crée un tout nouveau PDF vierge
            const pdfOptimise = await PDFDocument.create();
            
            // On copie uniquement les pages (ça laisse de côté le code inutile du scanner)
            const pages = await pdfOptimise.copyPages(pdfLourd, pdfLourd.getPageIndices());
            pages.forEach((page) => pdfOptimise.addPage(page));

            // On sauvegarde avec l'option "useObjectStreams" qui aide à compresser la structure
            const pdfBytes = await pdfOptimise.save({ useObjectStreams: true });
            
            // On télécharge le résultat
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Dossier_ANEF_Optimise.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            btn.innerText = "✅ Fichier allégé !";
            setTimeout(() => {
                btn.innerText = "Optimiser et Télécharger";
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                btn.disabled = false;
            }, 3000);

        } catch (erreur) {
            console.error("Erreur lors de l'optimisation :", erreur);
            alert("Une erreur s'est produite. Le fichier est peut-être corrompu ou protégé par un mot de passe.");
            btn.innerText = "Optimiser et Télécharger";
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
};

// ==========================================
// GESTION DE LA NEWSLETTER 
// ==========================================
window.validerAbonnement = function() {
    localStorage.setItem('est_abonne', 'true');
    
    const footerNews = document.getElementById('footer-newsletter');
    if (footerNews) footerNews.classList.add('hidden');

    const popup = document.getElementById('modal-newsletter-popup');
    if (popup) popup.classList.add('hidden');

    setTimeout(() => {
        const successModal = document.getElementById('modal-newsletter-success');
        if (successModal) successModal.classList.remove('hidden');
    }, 500);
};

// ==========================================
// INITIALISATION GLOBALE (Lancement du site)
// ==========================================
// On attache tout à "window" pour que le HTML puisse les appeler
window.App = App;
window.UI = UI;
window.OutilsPDF = OutilsPDF;


// ==========================================
// OUTIL : SIMULATEUR CIVIQUE (VERSION ULTIME)
// ==========================================
const Simulateur = {
    calculer: function() {
        const demarche = document.getElementById('sim-demarche').value;
        const dateDepot = document.getElementById('sim-date').value;
        const nat = document.getElementById('sim-nat').value;
        const age = document.getElementById('sim-age').value;
        const sante = document.getElementById('sim-sante').value;
        const statut = document.getElementById('sim-statut').value;

        // Vérification que les champs obligatoires sont remplis
        if (!demarche || !dateDepot || !nat || !age) {
            alert("Veuillez répondre aux 4 premières questions au minimum.");
            return;
        }

        const questionsDiv = document.getElementById('simulateur-questions');
        const resultatDiv = document.getElementById('simulateur-resultat');
        const badge = document.getElementById('sim-badge');
        const titre = document.getElementById('sim-titre');
        const texte = document.getElementById('sim-texte');

        let estConcerne = true;
        let explication = "";

        // =========================================
        // ARBRE DE DÉCISION JURIDIQUE (Ordre de priorité)
        // =========================================

        // 1. La dispense médicale absolue (vaut pour tout, même la naturalisation)
        if (sante === 'inapte') {
            estConcerne = false;
            explication = "Dispense accordée : Votre état de santé ou votre handicap vous exempte de l'examen civique, sous réserve de fournir le certificat médical réglementaire dûment rempli par un médecin.";
        }
        // 2. La règle de la date butoir
        else if (dateDepot === 'avant_2026') {
            estConcerne = false;
            explication = "La loi n'est pas rétroactive ! Les demandes déposées avant le 1er janvier 2026 ne sont pas soumises au nouvel examen civique. Vous serez évalué(e) selon l'ancienne formule (entretien oral).";
        }
        // 3. Le renouvellement de titre
        else if (demarche === 'renouvellement') {
            estConcerne = false;
            explication = "Dispense accordée : L'examen civique ne s'applique qu'aux premières demandes de cartes pluriannuelles ou de résident. Le simple renouvellement d'un droit déjà acquis n'exige pas de repasser l'examen.";
        }
        // 4. Les citoyens européens
        else if (nat === 'ue') {
            estConcerne = false;
            explication = "Dispense totale : Les citoyens de l'Union Européenne, de l'EEE et de la Suisse ne sont pas soumis au Contrat d'Intégration Républicaine (CIR) ni à ses examens.";
        }
        // 5. Les statuts hors CIR
        else if (demarche === 'etudiant') {
            estConcerne = false;
            explication = "Dispense accordée : Les cartes de séjour Étudiant, Visiteur et Passeport Talent sont exclues du champ d'application de l'examen civique.";
        }
        // 6. La Naturalisation (Si on arrive ici, les dispenses 1 à 5 ne s'appliquent pas)
        else if (demarche === 'naturalisation') {
            estConcerne = true;
            explication = "Examen obligatoire : Pour obtenir la nationalité française, l'examen civique est requis, peu importe votre âge (la dispense des 65 ans n'existe plus pour la naturalisation) ou votre statut (réfugié, etc.).";
        }
        // 7. L'Accord Franco-Algérien (Cartes de séjour)
        else if (nat === 'algerien') {
            estConcerne = false;
            explication = "Dispense liée à l'Accord de 1968 : En tant que ressortissant(e) algérien(ne) demandant un certificat de résidence, vous êtes exempté(e) du Contrat d'Intégration Républicaine et de cet examen.";
        }
        // 8. Dispense liée à l'âge (Cartes de séjour)
        else if (age === 'plus_65') {
            estConcerne = false;
            explication = "Dispense accordée : Les étrangers âgés de 65 ans ou plus sont dispensés de l'examen civique pour l'obtention d'une carte de séjour pluriannuelle ou d'une carte de résident.";
        }
        // 9. Dispense pour l'Asile (Cartes de séjour)
        else if (statut === 'refugie') {
            estConcerne = false;
            explication = "Dispense accordée : Les bénéficiaires d'une protection internationale (réfugiés, apatrides, protection subsidiaire) sont exemptés de l'examen civique pour la délivrance de leur titre de séjour.";
        }
        // 10. Le cas classique (Défaut)
        else {
            estConcerne = true;
            explication = "Examen obligatoire : Pour obtenir une carte de séjour pluriannuelle ou de résident (10 ans) à partir de 2026, vous devez valider vos connaissances via le nouvel examen civique.";
        }

        // =========================================
        // AFFICHAGE DU RÉSULTAT
        // =========================================
        questionsDiv.classList.add('hidden');
        resultatDiv.classList.remove('hidden');

        if (estConcerne) {
            badge.className = "mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 text-red-600 text-3xl";
            badge.innerHTML = "📝";
            titre.className = "text-lg font-black uppercase mb-2 text-red-600";
            titre.innerText = "Examen Obligatoire";
        } else {
            badge.className = "mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 text-green-600 text-3xl";
            badge.innerHTML = "✅";
            titre.className = "text-lg font-black uppercase mb-2 text-green-600";
            titre.innerText = "Vous êtes dispensé(e)";
        }
        
        texte.innerText = explication;
    },

    recommencer: function() {
        // On remet toutes les listes déroulantes à zéro
        document.getElementById('sim-demarche').value = "";
        document.getElementById('sim-date').value = "";
        document.getElementById('sim-nat').value = "";
        document.getElementById('sim-age').value = "";
        document.getElementById('sim-sante').value = "aucune";
        document.getElementById('sim-statut').value = "aucun";
        
        // On inverse l'affichage
        document.getElementById('simulateur-resultat').classList.add('hidden');
        document.getElementById('simulateur-questions').classList.remove('hidden');
    }
};

window.Simulateur = Simulateur;


document.addEventListener('DOMContentLoaded', () => {
    // 1. On lance le quiz et l'anti-adblock
    App.init();

    // 2. On gère l'affichage de la Newsletter au démarrage
    if (localStorage.getItem('est_abonne') === 'true') {
        const footerNews = document.getElementById('footer-newsletter');
        if (footerNews) footerNews.classList.add('hidden');
    } else {
        if (!localStorage.getItem('newsletter_deja_vue')) {
            setTimeout(() => {
                // CORRECTION : On vérifie si la punition AdBlock est à l'écran !
                const adblockModal = document.getElementById('modal-adblock');
                const isAdblockVisible = adblockModal && !adblockModal.classList.contains('hidden');

                // On n'affiche la newsletter QUE si l'écran est libre
                if (!isAdblockVisible) {
                    const popup = document.getElementById('modal-newsletter-popup');
                    if (popup) {
                        popup.classList.remove('hidden');
                        localStorage.setItem('newsletter_deja_vue', 'true');
                    }
                }
            }, 5000); 
        }
    }
});
