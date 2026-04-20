const UI = {
    openModal(id) { document.getElementById(id).classList.remove('hidden'); },
    closeModal(id) { document.getElementById(id).classList.add('hidden'); },
    
    showCustomAlert(title, message) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-message').innerText = message;
        this.openModal('modal-alert');
    },

    switchScreen(screenId) {
        ['screen-home', 'screen-quiz', 'screen-results'].forEach(id => document.getElementById(id).classList.add('hidden'));
        document.getElementById(screenId).classList.remove('hidden');
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
        
        document.getElementById('current-q-num').innerText = state.index + 1;
        document.getElementById('category-display').innerText = q.categorie || "EXAMEN";
        document.getElementById('question-text').innerText = q.question;
        
        const hQ = document.getElementById('helper-question');
        if(h) {
            hQ.innerText = h.question; hQ.classList.remove('hidden');
            hQ.style.textAlign = isRTL ? 'right' : 'left'; hQ.dir = isRTL ? 'rtl' : 'ltr';
        } else hQ.classList.add('hidden');

        const container = document.getElementById('options-container');
        container.innerHTML = '';
        
        q.options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = `option-item w-full text-left p-4 border border-gray-300 text-sm font-bold transition flex flex-col ${state.userAnswers[state.index] === i ? 'selected-opt' : 'bg-white text-gray-700'}`;
            let translate = (h && h.options) ? `<span class="text-[11px] italic opacity-60 font-medium mt-1" dir="${isRTL?'rtl':'ltr'}">${h.options[i]}</span>` : "";
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
        
        const msg = document.getElementById('result-msg');
        if(score >= 32) { 
            msg.innerText = "ADMIS ✅"; msg.className = "p-4 mb-6 bg-green-100 text-green-700 font-black uppercase text-xs"; 
        } else { 
            msg.innerText = "ÉCHEC ❌ (Min. 32)"; msg.className = "p-4 mb-6 bg-red-100 text-red-700 font-black uppercase text-xs"; 
        }
    },

    renderCorrection(state) {
        // 🔓 ON DÉVERROUILLE LE BOUTON D'IMPRESSION
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
            let hQ = (h && state.selectedLang !== "none") ? `<p class="text-[11px] text-gray-400 italic mt-1 border-t border-gray-50 pt-2" dir="${isRTL?'rtl':'ltr'}">${h.question}</p>` : "";
            let hRight = (h && h.options) ? ` <span class="opacity-60" dir="${isRTL?'rtl':'ltr'}">(${h.options[q.bonne_reponse]})</span>` : "";
            let hExp = (h && h.explication) ? `<p class="mt-2 font-normal opacity-70 border-t pt-2" dir="${isRTL?'rtl':'ltr'}">${h.explication}</p>` : "";
            
            // 👉 NOUVEAUTÉ : On prépare le lien officiel si la réponse est fausse
            let linkHtml = (!ok && q.link) ? `<div class="mt-3 pt-3 border-t border-gray-100"><a href="${q.link}" target="_blank" class="text-bleu-france hover:underline text-[11px] font-bold uppercase tracking-wide">🔗 Réviser sur le site officiel</a></div>` : "";

            // On injecte tout (y compris le lien à la fin)
            div.innerHTML = `<div class="flex justify-between mb-2 text-[9px] font-black uppercase ${ok?'text-green-600':'text-red-600'}"><span>${ok?'Correct':'Erreur'}</span><span>Question ${i+1}</span></div><p class="text-sm font-bold text-gray-900 leading-tight">${q.question}</p>${hQ}<div class="text-xs space-y-1 my-3"><p class="${ok?'text-green-700 font-bold':'text-red-600 line-through'}">Votre choix : ${q.options[state.userAnswers[i]]}</p>${!ok ? `<p class="text-green-700 font-bold">Réponse : ${q.options[q.bonne_reponse]}${hRight}</p>` : ''}</div><div class="bg-fond-gris p-3 text-[11px] text-gray-600 italic"><strong>Explication :</strong> ${q.explication}${hExp}</div>${linkHtml}`;
            list.appendChild(div);
        });

        // 👉 NOUVEAUTÉ : On ajoute le bouton d'impression TOUT EN BAS de la correction
        const btnPrint = document.createElement('button');
        btnPrint.className = "w-full mt-6 py-4 bg-gray-900 text-white font-black text-xs uppercase tracking-widest shadow-lg";
        btnPrint.innerHTML = "🖨️ Imprimer mon bilan (PDF)";
        btnPrint.onclick = () => window.print();
        list.appendChild(btnPrint);

        window.scrollTo({top: list.offsetTop - 100, behavior: 'smooth'});
    }
};
