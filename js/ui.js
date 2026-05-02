const UI = {
    openModal(id) { document.getElementById(id).classList.remove('hidden'); },
    closeModal(id) { document.getElementById(id).classList.add('hidden'); },
    
    showCustomAlert(title, message) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-message').innerText = message;
        this.openModal('modal-alert');
    },

switchScreen(screenId) {
        // 1. On cache TOUS les écrans
        ['screen-home', 'screen-quiz-setup', 'screen-quiz', 'screen-results', 'screen-revisions', 'screen-demarches', 'screen-legal', 'screen-privacy'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('hidden');
        });
        
        // 2. On affiche uniquement l'écran demandé
        const targetScreen = document.getElementById(screenId);
        if(targetScreen) targetScreen.classList.remove('hidden');

        const siteHeader = document.querySelector('header'); 
        const mainNav = document.getElementById('main-nav');
        const mainContainer = document.querySelector('main'); // On récupère le conteneur principal

        // 3. Gestion de l'espace pour que tout rentre à l'écran !
        if (screenId === 'screen-quiz') {
            if (siteHeader) siteHeader.classList.add('hidden'); // Cache le logo
            if (mainNav) mainNav.classList.add('hidden'); // Cache le menu
            
            // LA MAGIE ICI : On enlève l'énorme espace vide en haut
            if (mainContainer) {
                mainContainer.classList.remove('pt-28');
                mainContainer.classList.add('pt-4');
            }
        } else {
            if (siteHeader) siteHeader.classList.remove('hidden'); // Remet le logo
            if (mainNav) {
                if (screenId === 'screen-results') mainNav.classList.add('hidden');
                else mainNav.classList.remove('hidden');
            }
            
            // On remet l'espace pour les autres pages
            if (mainContainer) {
                mainContainer.classList.remove('pt-4');
                mainContainer.classList.add('pt-28');
            }
        }

        // 4. On remet TOUS les boutons en gris normal
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('bg-bleu-france', 'text-white');
            btn.classList.add('bg-gray-200', 'text-gray-800');
        });

        // 5. On met en bleu SEULEMENT le bouton actif
        const cleanId = screenId.replace('screen-', '');
        const activeBtn = document.getElementById('btn-nav-' + cleanId);
        if(activeBtn) {
            activeBtn.classList.remove('bg-gray-200', 'text-gray-800');
            activeBtn.classList.add('bg-bleu-france', 'text-white');
        }
        
        window.scrollTo(0, 0);
    },
    
    
    renderQuestion(state) {
        const q = state.questions[state.index];

        if (!q) {
            console.error("Question introuvable ! Liste des questions :", state.questions);
            this.showCustomAlert("Erreur d'affichage", "La question n'a pas pu être chargée.");
            return;
        }
        
        const h = state.allHelp.find(x => x.id === q.id);
        const isRTL = ["ar", "ur", "fa"].includes(state.selectedLang);
        
        // Met à jour la question actuelle ET le nombre total dynamiquement !
        document.getElementById('current-q-num').parentElement.innerHTML = `<span id="current-q-num">${state.index + 1}</span>/${state.questions.length}`;
        document.getElementById('category-display').innerText = q.categorie || "EXAMEN";
        document.getElementById('question-text').innerText = q.question;
        
        const hQ = document.getElementById('helper-question');
        if(h) {
            hQ.innerText = h.question; hQ.classList.remove('hidden');
            hQ.style.textAlign = isRTL ? 'right' : 'left'; hQ.dir = isRTL ? 'rtl' : 'ltr';
        } else hQ.classList.add('hidden');

        const container = document.getElementById('options-container');
        container.innerHTML = '';
        
        // On récupère la liste des boutons cachés par le joker pour CETTE question
        const hiddenOptions = (state.hiddenOptions && state.hiddenOptions[state.index]) ? state.hiddenOptions[state.index] : [];

        q.options.forEach((opt, i) => {
            const btn = document.createElement('button');
            
            // Si le bouton fait partie de ceux éliminés par le joker, on lui ajoute la classe 'hidden' !
            const isHiddenClass = hiddenOptions.includes(i) ? 'hidden' : 'flex';
            
            btn.className = `option-item w-full text-left p-4 md:p-5 border border-gray-300 text-base md:text-lg font-bold transition flex-col rounded-lg ${state.userAnswers[state.index] === i ? 'selected-opt bg-blue-50 border-blue-500' : 'bg-white text-gray-900'} ${isHiddenClass}`;
            
            // ✨ CORRECTION : On a ajouté "font-normal" pour annuler le gras du bouton !
            let translate = (h && h.options) ? `<span class="text-sm text-gray-600 font-normal italic mt-1 block" dir="${isRTL?'rtl':'ltr'}">${h.options[i]}</span>` : "";
            
            btn.innerHTML = `<span>${opt}</span>${translate}`;
            btn.onclick = () => App.handleAnswer(i);
            container.appendChild(btn);
        }); 


        document.getElementById('btn-prev').disabled = (state.index === 0);
        document.getElementById('btn-prev').style.opacity = (state.index === 0) ? "0.2" : "1";
        document.getElementById('btn-next').innerText = (state.index === state.questions.length - 1) ? "Valider" : "Suivant";
    },

    hideJokerOptions(wrongIndexes) {
        const items = document.querySelectorAll('.option-item');
        wrongIndexes.forEach(idx => { if(items[idx]) items[idx].classList.add('hidden'); });
        document.getElementById('btn-joker').classList.add('hidden');
    },

    triggerAd(type, callback) {
        document.getElementById('ad-overlay').classList.remove('hidden');
        document.getElementById('ad-text').innerText = (type === 'joker') ? "Calcul du Joker..." : "Préparation de la vidéo...";
        setTimeout(() => {
            document.getElementById('ad-overlay').classList.add('hidden');
            callback();
        }, 3000);
    },

    updateTimer(timeLeft) {
        let m = Math.floor(timeLeft/60), s = timeLeft%60;
        document.getElementById('timer-display').innerText = `${m}:${s<10?'0':''}${s}`;
    },

showResults(score, state) {
        this.switchScreen('screen-results');
        document.getElementById('q-counter').classList.add('hidden');
        document.getElementById('timer-zone').classList.add('hidden');
        
        const total = state.questions.length;
        document.getElementById('final-score').innerText = `${score}/${total}`;
        
        // ✨ CORRECTION : Calcul automatique de 80% (le minimum pour réussir)
        const minimumRequis = Math.ceil(total * 0.8);
        const msg = document.getElementById('result-msg');
        
        if(score >= minimumRequis) { 
            msg.innerText = "ADMIS ✅"; 
            msg.className = "p-4 mb-6 bg-green-100 text-green-800 font-black uppercase text-sm rounded"; 
        } else { 
            msg.innerText = `ÉCHEC ❌ (Min. ${minimumRequis})`; 
            msg.className = "p-4 mb-6 bg-red-100 text-red-800 font-black uppercase text-sm rounded"; 
        }
    },
renderCorrection(state) {
        // 🔓 ON DÉVERROUILLE LE BOUTON D'IMPRESSION PRINCIPAL (EN HAUT)
        document.getElementById('btn-print-main').classList.remove('hidden');
        document.getElementById('btn-corr-unlock').classList.add('hidden');
        
        const list = document.getElementById('full-correction');
        list.classList.remove('hidden');
        list.innerHTML = '<h3 class="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-6 text-center">Correction Détaillée</h3>';
        
        state.questions.forEach((q, i) => {
            const ok = state.userAnswers[i] === q.bonne_reponse;
            const h = state.allHelp.find(x => x.id === q.id);
            const isRTL = ["ar", "ur", "fa"].includes(state.selectedLang);
            
            const div = document.createElement('div');
            div.className = `p-4 border-l-4 shadow-sm mb-4 bg-white ${ok ? 'border-green-500' : 'border-rouge-marianne'}`;
            
            let hQ = (h && state.selectedLang !== "none") ? `<p translate="no" class="notranslate text-[11px] text-gray-400 italic mt-1 border-t border-gray-50 pt-2" dir="${isRTL?'rtl':'ltr'}">${h.question}</p>` : "";
            let hRight = (h && h.options) ? ` <span translate="no" class="notranslate opacity-60" dir="${isRTL?'rtl':'ltr'}">(${h.options[q.bonne_reponse]})</span>` : "";
            let hExp = (h && h.explication) ? `<p translate="no" class="notranslate mt-2 font-normal opacity-70 border-t pt-2" dir="${isRTL?'rtl':'ltr'}">${h.explication}</p>` : "";
            
            // On ajoute translate="no" sur toutes les balises qui doivent rester en français
            div.innerHTML = `
                <div class="flex justify-between mb-2 text-[9px] font-black uppercase ${ok?'text-green-600':'text-red-600'}">
                    <span>${ok?'Correct':'Erreur'}</span>
                    <span>Question ${i+1}</span>
                </div>
                
                <p class="text-sm font-bold text-gray-900 leading-tight">
                    <span translate="no" class="notranslate inline-block text-left" dir="ltr">${q.question}</span>
                </p>
                ${hQ}
                
                <div class="text-xs space-y-1 my-3">
                    <p class="${ok?'text-green-700 font-bold':'text-red-600 line-through'}">
                        Votre choix : <span translate="no" class="notranslate inline-block" dir="ltr">${q.options[state.userAnswers[i]]}</span>
                    </p>
                    ${!ok ? `<p class="text-green-700 font-bold">Réponse : <span translate="no" class="notranslate inline-block" dir="ltr">${q.options[q.bonne_reponse]}</span>${hRight}</p>` : ''}
                </div>
                
                <div class="bg-fond-gris p-3 text-[11px] text-gray-600 italic">
                    <strong>Explication :</strong> <span translate="no" class="notranslate inline-block text-left" dir="ltr">${q.explication}</span>
                    ${hExp}
                </div>
            `;
            list.appendChild(div);
        });

        // Création d'un bloc en bas pour mettre les deux boutons
        const btnContainer = document.createElement('div');
        btnContainer.className = "flex flex-col gap-3 mt-6";

        // 1. Bouton Impression (Gris foncé)
        const btnPrint = document.createElement('button');
        btnPrint.className = "w-full py-4 bg-gray-900 text-white font-black text-xs uppercase tracking-widest shadow-lg rounded";
        btnPrint.innerHTML = "🖨️ Imprimer mon bilan (PDF)";
        btnPrint.onclick = () => window.print();
        btnContainer.appendChild(btnPrint);

        // 2. Bouton Retour à l'accueil (Bleu France)
        const btnHome = document.createElement('button');
        btnHome.className = "w-full py-4 bg-bleu-france text-white font-black text-xs uppercase tracking-widest shadow-lg rounded";
        btnHome.innerHTML = "🏠 Retour à l'accueil";
        btnHome.onclick = () => location.reload(); 
        btnContainer.appendChild(btnHome);

        list.appendChild(btnContainer);

        window.scrollTo({top: list.offsetTop - 100, behavior: 'smooth'});
    }
};
