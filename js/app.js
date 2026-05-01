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
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
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
    const selector = document.getElementById('questions-selector');
    const nbQuestions = selector ? parseInt(selector.value) : 40;
    const lang = document.getElementById('lang-selector').value;

    // 1. On charge la BONNE base française (CSP ou CR)
    const dataFR = await API.loadBaseFR(lvl);
    if (!dataFR || dataFR.length === 0) {
        UI.showCustomAlert("Erreur réseau", "Impossible de charger les questions.");
        return;
    }
    // On met à jour le moteur avec la bonne base
    QuizEngine.init(dataFR); 

    // 2. On charge la traduction associée
    const helpData = await API.loadHelp(lvl, lang);
    
    // 3. On lance le quiz
    QuizEngine.start(lvl, lang, helpData, nbQuestions);
    this.saveProgress(); 

    UI.switchScreen('screen-quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
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
    promptQuit() {
        const questionsRepondues = QuizEngine.state.userAnswers.filter(r => r !== null).length;
        
        const title = document.getElementById('quit-title');
        const desc = document.getElementById('quit-desc');
        const btnConfirm = document.getElementById('btn-confirm-quit');

        if (questionsRepondues === 0) {
            title.innerText = "Quitter le test";
            title.className = "text-lg font-bold text-gray-900 mb-2 font-black uppercase";
            desc.innerText = "Vous n'avez répondu à aucune question. Le test va être annulé.";
            btnConfirm.innerText = "Oui, quitter";
        } else {
            title.innerText = "Abandonner ?";
            title.className = "text-lg font-bold text-rouge-marianne mb-2 font-black uppercase";
            desc.innerText = `Vous avez répondu à ${questionsRepondues} question(s). Voulez-vous arrêter ici et calculer votre score ?`;
            btnConfirm.innerText = "Voir mon score";
        }
        
        UI.openModal('modal-quit');
    },

abandonQuiz() {
        clearInterval(QuizEngine.state.timer);
        UI.closeModal('modal-quit');

        const questionsRepondues = QuizEngine.state.userAnswers.filter(reponse => reponse !== null).length;

        // Si l'utilisateur n'a cliqué sur AUCUNE réponse, on le renvoie à l'accueil proprement
        if (questionsRepondues === 0) {
            localStorage.removeItem('quizInProgress');
            // ✨ CORRECTION ICI : On ramène à l'accueil sans recharger la page
            UI.switchScreen('screen-home');
            window.scrollTo(0,0);
            return;
        }

        // S'il y a des réponses, on calcule le bilan
        QuizEngine.state.questions = QuizEngine.state.questions.slice(0, questionsRepondues);
        QuizEngine.state.userAnswers = QuizEngine.state.userAnswers.slice(0, questionsRepondues);
        
        this.finishQuiz();
    },
reportQuestion() {
        document.getElementById('report-message').value = ""; // On vide le champ texte
        UI.openModal('modal-report');
    },
    
sendReport() {
        const motif = document.getElementById('report-message').value;
        if (!motif || motif.trim().length < 5) {
            alert("Veuillez décrire le problème (minimum 5 caractères).");
            return;
        }

        const currentQ = QuizEngine.state.questions[QuizEngine.state.currentQuestion];
        
        // Construction du lien mailto
        const email = "contact@cartesejour.fr";
        const subject = `Signalement : Question ${QuizEngine.state.currentQuestion + 1} (${QuizEngine.state.level})`;
        const body = `Bonjour,\n\nJe signale un problème sur la question :\n"${currentQ.question}"\n\nProblème constaté :\n${motif}\n\n--\nEnvoyé depuis CarteSejour.fr`;

        const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        // Tentative d'ouverture
        const link = document.createElement('a');
        link.href = mailtoLink;
        link.click(); // Plus fiable que window.location
        
        UI.closeModal('modal-report');
        
        // Petit message de confirmation visuelle
        setTimeout(() => {
            UI.showCustomAlert("Merci !", "Si votre application mail ne s'est pas ouverte, vous pouvez nous écrire directement à contact@cartesejour.fr");
        }, 500);
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

        if (!demarche || !dateDepot || !nat || !age) {
            alert("Veuillez remplir les champs obligatoires.");
            return;
        }

        const questionsDiv = document.getElementById('simulateur-questions');
        const resultatDiv = document.getElementById('simulateur-resultat');
        const badge = document.getElementById('sim-badge');
        const titre = document.getElementById('sim-titre');
        const texte = document.getElementById('sim-texte');

        let estConcerne = true;
        let explication = "";

        // ----- ANALYSE JURIDIQUE PAR PRIORITÉ -----

        // 1. Santé (Inaptitude) - Dispense Absolue
        if (sante === 'inapte') {
            estConcerne = false;
            explication = "Dispense accordée : Votre état de santé vous exempte de l'examen, sous réserve de fournir le certificat médical officiel d'inaptitude.";
        }
        // 2. Date avant 2026 - Dispense Absolue
        else if (dateDepot === 'avant_2026') {
            estConcerne = false;
            explication = "Règle de non-rétroactivité : Votre dossier ayant été déposé avant 2026, vous n'êtes pas soumis(e) au nouvel examen numérique.";
        }
        // 3. Simple renouvellement - Dispense Absolue
        else if (demarche === 'renouvellement') {
            estConcerne = false;
            explication = "Dispense : L'examen ne concerne que les premières demandes de cartes pluriannuelles. Un renouvellement de titre déjà acquis ne demande pas de nouveau test.";
        }
        // 4. Étranger Malade (Le titre spécifique)
        else if (demarche === 'malade') {
            estConcerne = false;
            explication = "Dispense : Le titre de séjour 'Étranger Malade' est temporaire et n'est pas soumis aux obligations du Contrat d'Intégration Républicaine.";
        }
        // 5. Citoyens Européens
        else if (nat === 'ue') {
            estConcerne = false;
            explication = "Dispense totale : En tant que citoyen(ne) de l'UE, de l'EEE ou de la Suisse, vous êtes dispensé(e) de tout examen d'intégration.";
        }
        // 6. Étudiants / Talents / Visiteurs
        else if (demarche === 'etudiant') {
            estConcerne = false;
            explication = "Dispense : Ces catégories de titres de séjour ne sont pas soumises au Contrat d'Intégration Républicaine (CIR).";
        }
        // 7. CAS PARTICULIER : Naturalisation (Presque tout devient obligatoire)
        else if (demarche === 'naturalisation') {
            estConcerne = true;
            explication = "Examen OBLIGATOIRE : Pour la nationalité française, il n'y a pas de dispense pour l'âge (65 ans) ou l'origine. L'examen civique est requis pour tous à partir de 2026.";
        }
        // 8. Cas "Arrivé avant 13 ans" (Pour cartes de séjour)
        else if (statut === 'enfant_13') {
            estConcerne = false;
            explication = "Dispense accordée : Votre scolarité en France (entrée avant 13 ans) vous exempte du parcours d'intégration et de l'examen pour votre titre de séjour.";
        }
        // 9. Accord Algérien (Pour cartes de séjour)
        else if (nat === 'algerien') {
            estConcerne = false;
            explication = "Dispense Accord de 1968 : Les ressortissants algériens demandant un certificat de résidence sont dispensés du test civique.";
        }
        // 10. Plus de 65 ans (Pour cartes de séjour)
        else if (age === 'plus_65') {
            estConcerne = false;
            explication = "Dispense liée à l'âge : À partir de 65 ans, vous êtes dispensé(e) de l'examen civique pour obtenir votre titre de séjour.";
        }
        // 11. Réfugiés (Pour cartes de séjour)
        else if (statut === 'refugie') {
            estConcerne = false;
            explication = "Dispense humanitaire : Les bénéficiaires d'une protection internationale sont dispensés de l'examen pour leur demande de carte de résident.";
        }
        // 12. CAS CONJOINT DE FRANÇAIS (Mise au point)
        else if (demarche === 'conjoint_fr') {
            estConcerne = true;
            explication = "Attention : Être marié(e) à un(e) Français(e) ne dispense PAS de l'examen civique pour obtenir une carte pluriannuelle ou de 10 ans.";
        }
        // 13. Le reste (Cas général)
        else {
            estConcerne = true;
            explication = "Examen obligatoire : Votre situation nécessite la réussite à l'examen civique pour l'obtention de votre titre de séjour à partir de 2026.";
        }

        // --- AFFICHAGE ---
        questionsDiv.classList.add('hidden');
        resultatDiv.classList.remove('hidden');

        if (estConcerne) {
            badge.className = "mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 text-red-600 text-3xl";
            badge.innerHTML = "📝";
            titre.className = "text-lg font-black uppercase mb-2 text-red-600 text-center";
            titre.innerText = "Examen Obligatoire";
        } else {
            badge.className = "mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 text-green-600 text-3xl";
            badge.innerHTML = "✅";
            titre.className = "text-lg font-black uppercase mb-2 text-green-600 text-center";
            titre.innerText = "Vous êtes dispensé(e)";
        }
        texte.innerText = explication;
    },

    recommencer: function() {
        document.getElementById('sim-demarche').value = "";
        document.getElementById('sim-date').value = "";
        document.getElementById('sim-nat').value = "";
        document.getElementById('sim-age').value = "";
        document.getElementById('sim-sante').value = "aucune";
        document.getElementById('sim-statut').value = "aucun";
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
