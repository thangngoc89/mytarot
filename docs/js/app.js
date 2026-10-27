// MyTarot - Metallic Winter SPA Logic (100% Client-Side Static Engine)
document.addEventListener('DOMContentLoaded', () => {
  // Ensure dataset is loaded from window.TAROT_DATASET or fallback fetch
  let tarotDataset = window.TAROT_DATASET || [];

  async function ensureDatasetLoaded() {
    if (tarotDataset && tarotDataset.length > 0) return tarotDataset;
    if (window.TAROT_DATASET && window.TAROT_DATASET.length > 0) {
      tarotDataset = window.TAROT_DATASET;
      return tarotDataset;
    }
    try {
      const res = await fetch('data/tarot_dataset.json');
      tarotDataset = await res.json();
      window.TAROT_DATASET = tarotDataset;
    } catch (err) {
      console.warn('Fallback fetch for tarot_dataset.json failed:', err);
    }
    return tarotDataset;
  }

  // Preload dataset immediately
  ensureDatasetLoaded();

  // App State: supports Primary Spread, Secondary Spread (Clue Deep Dive), and Selected Tarot Deck
  const state = {
    // Current view mode: 'primary' | 'secondary'
    activeMode: 'primary',

    // Selected Tarot Deck Illustration Style
    selectedDeck: 'rws',
    selectedDeckName: 'Rider-Waite-Smith (1909)',

    // Primary Spread Data
    primary: {
      userQuery: '',
      spreadSize: 3,
      slotMeanings: ['Past', 'Present', 'Future'],
      deckPool: 'full',
      drawnCards: [],
      assignedCards: [], // { card, slotLabel, isRevealed, clueSpread?: object }
    },

    // Secondary Spread Data (Clue)
    secondary: {
      parentCardIndex: null,
      parentCard: null,  // { name, orientation, is_reversed, active_meaning, image_path, slotLabel }
      userQuery: '',     // Previous card & its meaning as the question
      spreadSize: 1,     // Default 1 card for clue
      slotMeanings: ['Direct Clue'],
      deckPool: 'full',
      drawnCards: [],
      assignedCards: [], // { card, slotLabel, isRevealed }
    },

    nextAssignIndex: 0,
    modalActiveCardItem: null,
    modalActiveIndex: null,
  };

  // Helper to resolve card image path for the active tarot deck
  function normalizeImagePath(path) {
    if (!path) return '';
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    if (!filename) return path.replace(/^\/?(static\/)?/, '');
    if (!state.selectedDeck || state.selectedDeck === 'rws') {
      return `images/cleaned-deck/${filename}`;
    }
    return `images/decks/${state.selectedDeck}/${filename}`;
  }

  // Helper to get active spread
  function getCurrentSpread() {
    return state.activeMode === 'primary' ? state.primary : state.secondary;
  }

  // Client-Side Tarot Card Drawing Engine
  function drawCardsClientSide(poolType, count) {
    if (!tarotDataset || !tarotDataset.length) {
      throw new Error('Tarot dataset is not loaded yet');
    }

    let pool = [];
    const pt = (poolType || 'full').toLowerCase();
    if (pt === 'major') {
      pool = tarotDataset.filter(c => c.type === 'major');
    } else if (pt === 'minor') {
      pool = tarotDataset.filter(c => c.type === 'minor');
    } else if (pt === 'royal') {
      pool = tarotDataset.filter(c => c.is_royal === true);
    } else {
      pool = [...tarotDataset];
    }

    if (count <= 0 || count > pool.length) {
      count = Math.min(Math.max(1, count), pool.length);
    }

    // Fisher-Yates shuffle
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selected = shuffled.slice(0, count);

    // Dynamic random probability for Reversed orientation (2% - 10%)
    const reversalProbability = Math.random() * 0.08 + 0.02;

    const drawnCards = selected.map(card => {
      const isReversed = Math.random() < reversalProbability;
      return {
        ...card,
        is_reversed: isReversed,
        orientation: isReversed ? 'Reversed' : 'Upright',
        active_meaning: isReversed ? card.meaning_reversed : card.meaning_upright,
        image_path: normalizeImagePath(card.image_path)
      };
    });

    return {
      deck_pool: pt,
      pool_size: pool.length,
      count: count,
      reversal_probability_pct: Math.round(reversalProbability * 1000) / 10,
      drawn_cards: drawnCards
    };
  }

  // DOM Elements - Steps
  const step1 = document.getElementById('step-1');
  const step2 = document.getElementById('step-2');
  const step3 = document.getElementById('step-3');
  const step4 = document.getElementById('step-4');
  const step5 = document.getElementById('step-5');

  // Step 1 Elements
  const userQueryInput = document.getElementById('user-query');
  const btnStep1Next = document.getElementById('btn-step1-next');
  const queryError = document.getElementById('query-error');
  const deckVibeCards = document.querySelectorAll('.deck-vibe-card');
  const step1ActiveDeckLabel = document.getElementById('step1-active-deck-label');
  const headerActiveDeckBadge = document.getElementById('header-active-deck-badge');
  const step3FullDeckSubtitle = document.getElementById('step3-full-deck-subtitle');

  // Deck Vibe Selection Handler (Step 1)
  deckVibeCards.forEach(cardBtn => {
    cardBtn.addEventListener('click', () => {
      const deckId = cardBtn.dataset.deckId || 'rws';
      const deckName = cardBtn.dataset.deckName || 'Rider-Waite-Smith (1909)';
      state.selectedDeck = deckId;
      state.selectedDeckName = deckName;

      deckVibeCards.forEach(btn => {
        const badge = btn.querySelector('.deck-vibe-badge');
        if (btn === cardBtn) {
          btn.classList.add('active', 'border-2', 'border-cyan-400', 'bg-slate-800/80', 'shadow-lg', 'shadow-cyan-500/10');
          btn.classList.remove('border', 'border-slate-700', 'bg-slate-900/60');
          if (badge) badge.classList.remove('hidden');
        } else {
          btn.classList.remove('active', 'border-2', 'border-cyan-400', 'bg-slate-800/80', 'shadow-lg', 'shadow-cyan-500/10');
          btn.classList.add('border', 'border-slate-700', 'bg-slate-900/60');
          if (badge) badge.classList.add('hidden');
        }
      });

      if (step1ActiveDeckLabel) step1ActiveDeckLabel.textContent = deckName;
      if (headerActiveDeckBadge) headerActiveDeckBadge.textContent = deckName;
      if (step3FullDeckSubtitle) step3FullDeckSubtitle.textContent = `All 78 ${deckName} Cards`;
    });
  });

  // Step 2 Elements
  const spreadSizeSelect = document.getElementById('spread-size');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const slotInputsContainer = document.getElementById('slot-inputs-container');
  const btnStep2Next = document.getElementById('btn-step2-next');

  // Step 3 Elements
  const btnShuffle = document.getElementById('btn-shuffle');
  const shuffleContainer = document.getElementById('shuffle-animation-container');
  const shuffleDeckStack = document.getElementById('shuffle-deck-stack');
  const step3SecondaryBanner = document.getElementById('step3-secondary-banner');
  const btnCancelSecondary = document.getElementById('btn-cancel-secondary');
  const step3ParentImg = document.getElementById('step3-parent-img');
  const step3ParentName = document.getElementById('step3-parent-name');
  const step3ParentOrientation = document.getElementById('step3-parent-orientation');
  const step3ParentSlot = document.getElementById('step3-parent-slot');
  const step3ParentMeaning = document.getElementById('step3-parent-meaning');
  const clueSizeBtns = document.querySelectorAll('.clue-size-btn');

  // Step 4 Elements
  const faceDownStack = document.getElementById('face-down-stack');
  const assignProgress = document.getElementById('assign-progress');

  // Step 5 Elements
  const spreadGrid = document.getElementById('spread-grid');
  const step5Badge = document.getElementById('step5-badge');
  const step5Heading = document.getElementById('step5-heading');
  const step5Subheading = document.getElementById('step5-subheading');
  const step5QuestionLabel = document.getElementById('step5-question-label');
  const step5UserQuestion = document.getElementById('step5-user-question');
  const step5SecondaryParentInfo = document.getElementById('step5-secondary-parent-info');
  const step5ParentThumb = document.getElementById('step5-parent-thumb');
  const step5ParentNameText = document.getElementById('step5-parent-name-text');
  const step5ParentOrientationBadge = document.getElementById('step5-parent-orientation-badge');
  const step5ParentMeaningText = document.getElementById('step5-parent-meaning-text');
  const step5OriginalQueryText = document.getElementById('step5-original-query-text');
  const spreadNavBar = document.getElementById('spread-nav-bar');
  const spreadNavTabs = document.getElementById('spread-nav-tabs');
  const btnBackToPrimary = document.getElementById('btn-back-to-primary');
  const btnNewReading = document.getElementById('btn-new-reading');
  const llmPromptTextarea = document.getElementById('llm-prompt-textarea');
  const llmPromptStatus = document.getElementById('llm-prompt-status');
  const btnCopyLlmPrompt = document.getElementById('btn-copy-llm-prompt');
  const btnCopyLlmText = document.getElementById('btn-copy-llm-text');
  const btnCopyLlmTop = document.getElementById('btn-copy-llm-top');
  const btnCopyLlmTopText = document.getElementById('btn-copy-llm-top-text');

  // Modal Elements
  const cardDetailModal = document.getElementById('card-detail-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCardImg = document.getElementById('modal-card-img');
  const modalCardSlot = document.getElementById('modal-card-slot');
  const modalCardName = document.getElementById('modal-card-name');
  const modalCardOrientation = document.getElementById('modal-card-orientation');
  const modalCardMeaning = document.getElementById('modal-card-meaning');
  const modalBtnGetClue = document.getElementById('modal-btn-get-clue');

  // ==========================================
  // STEP 1: Query Input
  // ==========================================
  btnStep1Next.addEventListener('click', () => {
    const query = userQueryInput.value.trim();
    if (!query) {
      queryError.classList.remove('hidden');
      userQueryInput.classList.add('border-rose-500');
      userQueryInput.focus();
      return;
    }
    queryError.classList.add('hidden');
    userQueryInput.classList.remove('border-rose-500');
    state.primary.userQuery = query;

    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    renderSlotInputs(true);
  });

  userQueryInput.addEventListener('input', () => {
    if (userQueryInput.value.trim()) {
      queryError.classList.add('hidden');
      userQueryInput.classList.remove('border-rose-500');
    }
  });

  // ==========================================
  // STEP 2: Spread Selection & Slot Labeling
  // ==========================================
  spreadSizeSelect.addEventListener('change', () => {
    const size = parseInt(spreadSizeSelect.value, 10);
    state.primary.spreadSize = size;
    presetBtns.forEach(b => b.classList.remove('border-cyan-400', 'bg-slate-700/50'));
    renderSlotInputs(false);
  });

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('border-cyan-400', 'bg-slate-700/50'));
      btn.classList.add('border-cyan-400', 'bg-slate-700/50');

      const size = parseInt(btn.dataset.size, 10);
      const labels = btn.dataset.labels ? btn.dataset.labels.split(',') : [];

      spreadSizeSelect.value = size;
      state.primary.spreadSize = size;
      state.primary.slotMeanings = labels.length ? labels : Array.from({ length: size }, (_, i) => `Card ${i + 1}`);
      renderSlotInputs(true);
    });
  });

  function renderSlotInputs(usePresetLabels = false) {
    slotInputsContainer.innerHTML = '';
    const size = state.primary.spreadSize;

    for (let i = 0; i < size; i++) {
      const defaultLabel = usePresetLabels && state.primary.slotMeanings[i] ? state.primary.slotMeanings[i] : `Position ${i + 1}`;
      const div = document.createElement('div');
      div.className = 'flex flex-col gap-1';
      div.innerHTML = `
        <label class="text-xs font-semibold text-slate-300">Position ${i + 1} Label (Optional):</label>
        <input type="text" class="slot-meaning-input metallic-input text-sm" data-index="${i}" value="${defaultLabel}" placeholder="e.g. Past, Challenge, Outcome">
      `;
      slotInputsContainer.appendChild(div);
    }
  }

  btnStep2Next.addEventListener('click', () => {
    const inputs = document.querySelectorAll('.slot-meaning-input');
    state.primary.slotMeanings = [];
    inputs.forEach((input, i) => {
      const val = input.value.trim();
      state.primary.slotMeanings.push(val || `Card ${i + 1}`);
    });

    step2.classList.add('hidden');
    step3.classList.remove('hidden');
    updateStep3UI();
  });

  // ==========================================
  // STEP 3: Deck Selection & Animated Shuffling Engine
  // ==========================================
  function updateStep3UI() {
    if (state.activeMode === 'secondary' && state.secondary.parentCard) {
      const p = state.secondary.parentCard;
      step3SecondaryBanner.classList.remove('hidden');
      step3ParentImg.src = normalizeImagePath(p.image_path);
      step3ParentImg.style.transform = p.is_reversed ? 'rotate(180deg)' : 'none';
      step3ParentName.textContent = p.name;

      step3ParentOrientation.textContent = p.orientation;
      if (p.is_reversed) {
        step3ParentOrientation.className = 'text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-950 text-amber-200 border border-amber-600';
      } else {
        step3ParentOrientation.className = 'text-[11px] px-2 py-0.5 rounded-full font-semibold bg-cyan-950 text-cyan-200 border border-cyan-500';
      }

      step3ParentSlot.textContent = `from position: '${p.slotLabel}'`;
      step3ParentMeaning.textContent = `"${p.active_meaning}"`;

      // Reset clue size buttons to current spread size
      resetClueSizeButtons(state.secondary.spreadSize || 1);

      btnShuffle.innerText = '⚡ Initiate Metallic Shuffle for Clue';
    } else {
      step3SecondaryBanner.classList.add('hidden');
      btnShuffle.innerText = '⚡ Initiate Metallic Shuffle';
    }
  }

  function resetClueSizeButtons(selectedSize) {
    clueSizeBtns.forEach(btn => {
      const s = parseInt(btn.dataset.size, 10);
      if (s === selectedSize) {
        btn.classList.add('border-cyan-400', 'bg-slate-700/60');
        btn.classList.remove('border-slate-700', 'bg-slate-900/60');
      } else {
        btn.classList.remove('border-cyan-400', 'bg-slate-700/60');
        btn.classList.add('border-slate-700', 'bg-slate-900/60');
      }
    });
  }

  clueSizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const size = parseInt(btn.dataset.size, 10);
      state.secondary.spreadSize = size;
      resetClueSizeButtons(size);

      const parentName = state.secondary.parentCard ? state.secondary.parentCard.name : 'Card';
      if (size === 1) {
        state.secondary.slotMeanings = [`Clue for ${parentName}`];
      } else if (size === 2) {
        state.secondary.slotMeanings = ['Underlying Cause', 'Actionable Guidance'];
      } else {
        state.secondary.slotMeanings = ['Root Influence', 'Present Dynamic', 'Outcome / Advice'];
      }
    });
  });

  if (btnCancelSecondary) {
    btnCancelSecondary.addEventListener('click', () => {
      state.activeMode = 'primary';
      step3.classList.add('hidden');
      step5.classList.remove('hidden');
      renderStep5SpreadLayout();
    });
  }

  btnShuffle.addEventListener('click', async () => {
    await ensureDatasetLoaded();
    const selectedPool = document.querySelector('input[name="deck_pool"]:checked').value;
    const currentSpread = getCurrentSpread();
    currentSpread.deckPool = selectedPool;

    btnShuffle.disabled = true;
    btnShuffle.innerText = 'Shuffling Universe...';

    try {
      const data = drawCardsClientSide(selectedPool, currentSpread.spreadSize);
      currentSpread.drawnCards = data.drawn_cards;

      // Start 2.0 Second Visual Shuffle Animation
      shuffleContainer.classList.remove('hidden');
      renderShuffleStackAnimation();

      setTimeout(() => {
        shuffleContainer.classList.add('hidden');
        step3.classList.add('hidden');
        step4.classList.remove('hidden');
        btnShuffle.disabled = false;
        btnShuffle.innerText = state.activeMode === 'secondary'
          ? '⚡ Initiate Metallic Shuffle for Clue'
          : '⚡ Initiate Metallic Shuffle';
        initStep4FaceDownStack();
      }, 2000);

    } catch (err) {
      console.error('Error drawing cards locally:', err);
      alert('Error drawing cards. Please retry.');
      btnShuffle.disabled = false;
      btnShuffle.innerText = state.activeMode === 'secondary'
        ? '⚡ Initiate Metallic Shuffle for Clue'
        : '⚡ Initiate Metallic Shuffle';
    }
  });

  function renderShuffleStackAnimation() {
    shuffleDeckStack.innerHTML = '';
    const numVisualCards = 8;
    for (let i = 0; i < numVisualCards; i++) {
      const card = document.createElement('div');
      card.className = 'absolute w-36 h-56 rounded-xl border-2 border-slate-300 shadow-2xl tarot-card-back animating-shuffle';
      card.style.backgroundImage = 'url("images/card_back.jpg")';
      card.style.top = `${i * 3}px`;
      card.style.left = `${i * 2}px`;
      card.style.animationDelay = `${i * 0.08}s`;
      shuffleDeckStack.appendChild(card);
    }
  }

  // ==========================================
  // STEP 4: Card Selection Interaction (Sequential Face-Down Stack)
  // ==========================================
  function initStep4FaceDownStack() {
    const currentSpread = getCurrentSpread();
    currentSpread.assignedCards = [];
    state.nextAssignIndex = 0;
    renderFaceDownStack();
    updateAssignProgress();
  }

  function renderFaceDownStack() {
    faceDownStack.innerHTML = '';
    const currentSpread = getCurrentSpread();
    const remaining = currentSpread.spreadSize - state.nextAssignIndex;

    if (remaining <= 0) {
      setTimeout(() => {
        step4.classList.add('hidden');
        step5.classList.remove('hidden');

        // If secondary spread, save it onto the parent card in primary
        if (state.activeMode === 'secondary' && state.secondary.parentCardIndex !== null) {
          const parentItem = state.primary.assignedCards[state.secondary.parentCardIndex];
          if (parentItem) {
            parentItem.clueSpread = JSON.parse(JSON.stringify(state.secondary));
          }
        }

        renderStep5SpreadLayout();
      }, 400);
      return;
    }

    // Render clickable stack of face-down cards
    for (let i = 0; i < Math.min(remaining, 5); i++) {
      const card = document.createElement('div');
      card.className = 'absolute w-40 h-64 rounded-xl border-2 border-slate-200/60 shadow-2xl tarot-card-back cursor-pointer transition-transform hover:-translate-y-2 hover:shadow-cyan-400/50';
      card.style.backgroundImage = 'url("images/card_back.jpg")';
      card.style.top = `${i * -6}px`;
      card.style.left = `${i * 4}px`;
      card.style.zIndex = `${10 - i}`;

      if (i === 0) {
        card.addEventListener('click', handleFaceDownCardClick);
      }
      faceDownStack.appendChild(card);
    }
  }

  function handleFaceDownCardClick() {
    const currentSpread = getCurrentSpread();
    if (state.nextAssignIndex >= currentSpread.spreadSize) return;

    const drawnCard = currentSpread.drawnCards[state.nextAssignIndex];
    const slotLabel = currentSpread.slotMeanings[state.nextAssignIndex];

    currentSpread.assignedCards.push({
      card: drawnCard,
      slotLabel: slotLabel,
      isRevealed: false
    });

    state.nextAssignIndex++;
    renderFaceDownStack();
    updateAssignProgress();
  }

  function updateAssignProgress() {
    const currentSpread = getCurrentSpread();
    const total = currentSpread.spreadSize;
    const current = state.nextAssignIndex;

    if (current < total) {
      const nextLabel = currentSpread.slotMeanings[current] || `Position ${current + 1}`;
      assignProgress.innerHTML = `
        Drawing card <strong class="text-cyan-300 font-bold">${current + 1} of ${total}</strong>
        to slot: <strong class="text-white font-cinzel font-bold">'${nextLabel}'</strong>
      `;
    } else {
      assignProgress.innerHTML = `<span class="text-emerald-400 font-bold">✓ All ${currentSpread.spreadSize} cards placed into spread! Transitioning...</span>`;
    }
  }

  // ==========================================
  // STEP 5: Layout & Flip-to-Reveal Mechanism
  // ==========================================
  function renderStep5SpreadLayout() {
    const isSec = state.activeMode === 'secondary';
    const currentSpread = getCurrentSpread();

    // Update Header and Question Banner
    if (isSec && state.secondary.parentCard) {
      const p = state.secondary.parentCard;
      step5Badge.textContent = '❄️ Secondary Spread — Clue Deep Dive';
      step5Heading.textContent = `Clue for: ${p.name}`;
      step5Subheading.textContent = `Delving deeper into ${p.name} (${p.orientation}). Flip cards below to reveal insights.`;

      step5QuestionLabel.textContent = 'Clue Question (Previous Card & Meaning):';
      step5UserQuestion.textContent = `"${state.secondary.userQuery}"`;

      step5SecondaryParentInfo.classList.remove('hidden');
      step5ParentThumb.src = normalizeImagePath(p.image_path);
      step5ParentThumb.style.transform = p.is_reversed ? 'rotate(180deg)' : 'none';
      step5ParentNameText.textContent = `${p.name} (${p.orientation})`;

      if (p.is_reversed) {
        step5ParentOrientationBadge.textContent = 'Reversed';
        step5ParentOrientationBadge.className = 'ml-1 text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-950 text-amber-200 border border-amber-600';
      } else {
        step5ParentOrientationBadge.textContent = 'Upright';
        step5ParentOrientationBadge.className = 'ml-1 text-[10px] px-1.5 py-0.5 rounded font-bold bg-cyan-950 text-cyan-200 border border-cyan-500';
      }

      step5ParentMeaningText.textContent = `Position '${p.slotLabel}': ${p.active_meaning}`;
      step5OriginalQueryText.textContent = `Original Reading Query: "${state.primary.userQuery}"`;

      btnBackToPrimary.classList.remove('hidden');
    } else {
      step5Badge.textContent = 'Step 5 of 5 — Interactive Layout';
      step5Heading.textContent = 'Flip Cards to Reveal Meanings';
      step5Subheading.textContent = 'Click each card to flip and inspect. Click "Get Clue" to draw a secondary spread.';

      step5QuestionLabel.textContent = 'Your Question (Step 1):';
      step5UserQuestion.textContent = `"${state.primary.userQuery}"`;

      step5SecondaryParentInfo.classList.add('hidden');
      btnBackToPrimary.classList.add('hidden');
    }

    // Render Spread Navigation Tabs
    renderSpreadNavTabs();

    // Responsive Grid setup
    spreadGrid.innerHTML = '';
    const cols = currentSpread.spreadSize === 1 ? 'grid-cols-1 max-w-sm' :
                 currentSpread.spreadSize === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-2xl' :
                 currentSpread.spreadSize === 3 ? 'grid-cols-1 md:grid-cols-3 max-w-4xl' :
                 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-6xl';
    spreadGrid.className = `grid ${cols} gap-6 mx-auto`;

    // Reveal All Cards Button
    const btnRevealAll = document.getElementById('btn-reveal-all');
    if (btnRevealAll) {
      btnRevealAll.onclick = () => {
        currentSpread.assignedCards.forEach((_, i) => {
          setTimeout(() => revealCard(i), i * 150);
        });
      };
    }

    // Render Card Slots
    currentSpread.assignedCards.forEach((item, index) => {
      const cardSlot = document.createElement('div');
      cardSlot.className = 'metallic-card p-4 flex flex-col items-center gap-3 relative';

      const hasClue = !!item.clueSpread;
      const clueBtnHtml = `
        <button type="button" class="btn-get-clue w-full py-2.5 px-3 text-xs flex items-center justify-center gap-2 cursor-pointer font-bold shadow-md" data-slot-index="${index}">
          <span class="text-sm">🔍</span>
          <span>Get More Clue</span>
        </button>
        ${hasClue ? `
          <button type="button" class="btn-view-clue w-full py-1.5 px-3 text-xs rounded-lg border border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer mt-1" data-slot-index="${index}">
            <span>❄️</span>
            <span>View Clue Spread (${item.clueSpread.assignedCards.length} Card${item.clueSpread.assignedCards.length > 1 ? 's' : ''}) →</span>
          </button>
        ` : ''}
      `;

      cardSlot.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-700/80 pb-2 w-full">
          <span class="font-cinzel font-bold text-xs tracking-wide text-cyan-200">
            Position ${index + 1}: ${item.slotLabel}
          </span>
          <button type="button" class="btn-quick-clue text-xs font-cinzel font-bold px-2.5 py-0.5 rounded transition-all flex items-center gap-1 cursor-pointer" data-slot-index="${index}" title="Get secondary clue spread for this card">
            <span>🔍</span>
            <span>Get Clue</span>
          </button>
        </div>

        <div class="tarot-card-container cursor-pointer" id="card-container-${index}" title="${item.isRevealed ? 'Click to inspect card in detail' : 'Click to flip & reveal'}">
          <div class="tarot-card-inner ${item.isRevealed ? 'is-flipped' : ''} ${item.isRevealed && item.card.is_reversed ? 'is-reversed' : ''}" id="card-inner-${index}">
            <div class="tarot-card-face tarot-card-back" style="background-image: url('images/card_back.jpg');"></div>
            <div class="tarot-card-face tarot-card-front metallic-frame">
              <img src="${normalizeImagePath(item.card.image_path)}" alt="${item.card.name}" class="rounded-lg shadow-inner">
            </div>
          </div>
        </div>

        <div class="w-full flex flex-col gap-2 mt-2">
          <!-- Card Title Area -->
          <div id="card-title-box-${index}" class="text-center min-h-[36px] flex flex-col items-center justify-center">
            ${item.isRevealed ? `
              <h4 class="font-cinzel font-bold text-base text-white leading-tight">${item.card.name}</h4>
              <span class="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 ${item.card.is_reversed ? 'bg-amber-950 text-amber-200 border border-amber-600' : 'bg-cyan-950 text-cyan-200 border border-cyan-500'}">
                ${item.card.orientation} (0°/180°)
              </span>
            ` : `
              <span class="text-xs text-cyan-300/80 font-medium">Click card to flip</span>
            `}
          </div>

          <!-- Get More Clue Button (Immediately visible right below card) -->
          ${clueBtnHtml}

          <!-- Meaning Box (Revealed when card is flipped) -->
          <div id="card-meaning-box-${index}" class="${item.isRevealed ? '' : 'hidden'} meaning-box text-xs mt-1">
            <p class="font-medium text-slate-800">${item.card.active_meaning}</p>
          </div>
        </div>
      `;

      spreadGrid.appendChild(cardSlot);

      // Card Container Click: flip if unrevealed, open inspector modal if already revealed
      const container = cardSlot.querySelector(`#card-container-${index}`);
      container.addEventListener('click', () => {
        if (!item.isRevealed) {
          revealCard(index);
        } else {
          openCardModal(item, index);
        }
      });

      // Quick Clue button in header
      const btnQuick = cardSlot.querySelector(`.btn-quick-clue[data-slot-index="${index}"]`);
      if (btnQuick) {
        btnQuick.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!item.isRevealed) {
            revealCard(index);
          }
          startSecondarySpread(item, index);
        });
      }

      // Primary "Get More Clue" button click
      const btnGetClue = cardSlot.querySelector(`.btn-get-clue[data-slot-index="${index}"]`);
      if (btnGetClue) {
        btnGetClue.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!item.isRevealed) {
            revealCard(index);
          }
          startSecondarySpread(item, index);
        });
      }

      // "View Clue Spread" button click
      const btnViewClue = cardSlot.querySelector(`.btn-view-clue[data-slot-index="${index}"]`);
      if (btnViewClue) {
        btnViewClue.addEventListener('click', (e) => {
          e.stopPropagation();
          if (item.clueSpread) {
            state.activeMode = 'secondary';
            state.secondary = item.clueSpread;
            renderStep5SpreadLayout();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      }
    });

    // Update Auto-Generated LLM Reading Description
    updateLLMPromptText();
  }

  function revealCard(index) {
    const currentSpread = getCurrentSpread();
    const item = currentSpread.assignedCards[index];
    if (!item || item.isRevealed) return;

    item.isRevealed = true;

    // Keep parent card's clueSpread in sync when revealing secondary cards
    if (state.activeMode === 'secondary' && state.secondary.parentCardIndex !== null) {
      const parentItem = state.primary.assignedCards[state.secondary.parentCardIndex];
      if (parentItem) {
        parentItem.clueSpread = JSON.parse(JSON.stringify(state.secondary));
      }
    }

    const cardInner = document.getElementById(`card-inner-${index}`);
    const titleBox = document.getElementById(`card-title-box-${index}`);
    const meaningBox = document.getElementById(`card-meaning-box-${index}`);

    if (cardInner) {
      cardInner.classList.add('is-flipped');
      if (item.card.is_reversed) {
        cardInner.classList.add('is-reversed');
      }
    }

    if (titleBox) {
      titleBox.innerHTML = `
        <h4 class="font-cinzel font-bold text-base text-white leading-tight">${item.card.name}</h4>
        <span class="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 ${item.card.is_reversed ? 'bg-amber-950 text-amber-200 border border-amber-600' : 'bg-cyan-950 text-cyan-200 border border-cyan-500'}">
          ${item.card.orientation} (0°/180°)
        </span>
      `;
    }

    if (meaningBox) {
      meaningBox.classList.remove('hidden');
    }

    // Auto-update LLM reading description text when card is revealed
    updateLLMPromptText();
  }

  // Deck aesthetic descriptions for richer LLM context
  const DECK_DESCRIPTIONS = {
    'rws': 'Rider-Waite-Smith (1909) — Classic esoteric tradition illustrated by Pamela Colman Smith, rich in Golden Dawn, astrological, and archetypal symbolism.',
    'celestial-gold': 'Celestial Gold Tarot — Modern astral & painterly fantasy deck framed by ornate gold celestial filigree arches, sun/moon motifs, and deep starlight imagery.',
    'soimoi': 'Soimoi Urban Tarot — Contemporary cinematic Neo-Tokyo & moody urban-fantasy aesthetic blending traditional archetypes with atmospheric modern storytelling.',
    'woodland-animal': 'Storybook Woodland Animal Tarot — Whimsical storybook fable deck depicting woodland animals, dogs, and nature companions enacting classic Tarot archetypes under starry skies.'
  };

  const POOL_LABELS = {
    'full': 'Full 78-Card Tarot Deck (Major & Minor Arcana)',
    'major': 'Only Major Arcana (22 Archetypal Cards)',
    'minor': 'Only Minor Arcana (56 Elemental Cards)',
    'royal': 'Only Royal / Court Cards (16 Kings, Queens, Knights, Pages)'
  };

  function updateLLMPromptText() {
    if (!llmPromptTextarea) return;

    const primaryCards = state.primary.assignedCards || [];
    const revealedPrimary = primaryCards.filter(c => c.isRevealed);
    const totalPrimary = primaryCards.length;

    const deckDesc = DECK_DESCRIPTIONS[state.selectedDeck] || state.selectedDeckName;
    const poolDesc = POOL_LABELS[state.primary.deckPool] || state.primary.deckPool;

    const lines = [];
    lines.push('=== TAROT READING FOR INTERPRETATION ===');
    lines.push('');
    lines.push(`Querent's Question: "${state.primary.userQuery || 'General Guidance'}"`);
    lines.push(`Tarot Deck Style: ${deckDesc}`);
    lines.push(`Deck Partition Used: ${poolDesc}`);
    lines.push(`Primary Spread Size: ${totalPrimary} Card${totalPrimary === 1 ? '' : 's'}`);
    lines.push('');
    lines.push('--- DRAWN CARDS & POSITIONS ---');

    if (revealedPrimary.length === 0) {
      lines.push('[No cards revealed yet. Click on the cards above or click "Reveal All Cards" to populate the reading.]');
    } else {
      primaryCards.forEach((item, idx) => {
        const posNum = idx + 1;
        if (!item.isRevealed) {
          lines.push(`${posNum}. Position "${item.slotLabel}": [Card Not Yet Revealed]`);
        } else {
          lines.push(`${posNum}. Position "${item.slotLabel}": ${item.card.name} (${item.card.orientation})`);
          lines.push(`   - Core Meaning (${item.card.orientation}): ${item.card.active_meaning}`);

          // Include Secondary Clue Spread if drawn for this card
          if (item.clueSpread && item.clueSpread.assignedCards && item.clueSpread.assignedCards.length > 0) {
            const cluePoolDesc = POOL_LABELS[item.clueSpread.deckPool] || item.clueSpread.deckPool;
            lines.push(`   - Secondary Clue Spread for ${item.card.name} (${item.clueSpread.assignedCards.length} Card${item.clueSpread.assignedCards.length === 1 ? '' : 's'}, ${cluePoolDesc}):`);
            item.clueSpread.assignedCards.forEach((clueItem, cIdx) => {
              if (clueItem.isRevealed) {
                lines.push(`     * Clue ${cIdx + 1} [${clueItem.slotLabel}]: ${clueItem.card.name} (${clueItem.card.orientation}) — ${clueItem.card.active_meaning}`);
              } else {
                lines.push(`     * Clue ${cIdx + 1} [${clueItem.slotLabel}]: [Clue Card Not Yet Revealed]`);
              }
            });
          }
        }
      });
    }

    lines.push('');
    lines.push('--- INTERPRETATION REQUEST ---');
    lines.push('Please provide a comprehensive, insightful Tarot reading based on the question, deck vibe, and cards above:');
    lines.push('1. Analyze each card in the context of its specific position/question and orientation (Upright vs. Reversed).');
    if (primaryCards.some(c => c.clueSpread && c.clueSpread.assignedCards && c.clueSpread.assignedCards.some(cl => cl.isRevealed))) {
      lines.push('2. Integrate the Secondary Clue Card(s) to deepen and clarify the message of their parent card(s).');
      lines.push('3. Synthesize how the cards interact across the spread (elemental dignities, archetypes, and narrative flow) to directly answer the querent\'s question with actionable guidance.');
    } else {
      lines.push('2. Synthesize how the cards interact across the spread (elemental dignities, archetypes, and narrative flow).');
      lines.push('3. Conclude with clear, grounded, and actionable guidance that directly answers the querent\'s question.');
    }

    llmPromptTextarea.value = lines.join('\n');

    // Update status badge & top copy button visibility
    if (llmPromptStatus) {
      if (revealedPrimary.length === 0) {
        llmPromptStatus.textContent = `0 of ${totalPrimary} primary cards revealed. Flip cards above to populate the text.`;
        llmPromptStatus.className = 'text-xs text-slate-400 mt-0.5';
      } else if (revealedPrimary.length < totalPrimary) {
        llmPromptStatus.textContent = `${revealedPrimary.length} of ${totalPrimary} primary cards revealed — auto-updating as you flip.`;
        llmPromptStatus.className = 'text-xs text-cyan-300 mt-0.5';
      } else {
        llmPromptStatus.textContent = `✓ All ${totalPrimary} primary cards revealed! Ready to copy and paste into your LLM.`;
        llmPromptStatus.className = 'text-xs text-emerald-300 font-semibold mt-0.5';
      }
    }

    if (btnCopyLlmTop) {
      if (revealedPrimary.length > 0) {
        btnCopyLlmTop.classList.remove('hidden');
      } else {
        btnCopyLlmTop.classList.add('hidden');
      }
    }
  }

  async function copyLLMPromptToClipboard() {
    if (!llmPromptTextarea) return;
    updateLLMPromptText();
    const text = llmPromptTextarea.value;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      llmPromptTextarea.select();
      document.execCommand('copy');
    }

    if (btnCopyLlmText) {
      const orig = btnCopyLlmText.textContent;
      btnCopyLlmText.textContent = '✓ Copied to Clipboard!';
      setTimeout(() => { btnCopyLlmText.textContent = orig; }, 2000);
    }
    if (btnCopyLlmTopText) {
      const origTop = btnCopyLlmTopText.textContent;
      btnCopyLlmTopText.textContent = '✓ Copied!';
      setTimeout(() => { btnCopyLlmTopText.textContent = origTop; }, 2000);
    }
  }

  if (btnCopyLlmPrompt) {
    btnCopyLlmPrompt.addEventListener('click', copyLLMPromptToClipboard);
  }
  if (btnCopyLlmTop) {
    btnCopyLlmTop.addEventListener('click', copyLLMPromptToClipboard);
  }

  // Spread Navigation Tabs (Primary & Secondary Spreads)
  function renderSpreadNavTabs() {
    const hasAnyClues = state.primary.assignedCards.some(c => c.clueSpread);
    if (!hasAnyClues && state.activeMode === 'primary') {
      spreadNavBar.classList.add('hidden');
      return;
    }

    spreadNavBar.classList.remove('hidden');
    spreadNavTabs.innerHTML = '';

    // Primary Spread Tab
    const primaryTab = document.createElement('button');
    primaryTab.type = 'button';
    primaryTab.className = `spread-tab ${state.activeMode === 'primary' ? 'active' : ''}`;
    primaryTab.innerHTML = `🎴 Primary Spread (${state.primary.assignedCards.length} Cards)`;
    primaryTab.addEventListener('click', () => {
      state.activeMode = 'primary';
      renderStep5SpreadLayout();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    spreadNavTabs.appendChild(primaryTab);

    // Clue Spread Tabs for each card that has one
    state.primary.assignedCards.forEach((cItem, i) => {
      if (cItem.clueSpread) {
        const clueTab = document.createElement('button');
        clueTab.type = 'button';
        const isCurrentClue = state.activeMode === 'secondary' && state.secondary.parentCardIndex === i;
        clueTab.className = `spread-tab ${isCurrentClue ? 'active' : ''}`;
        clueTab.innerHTML = `❄️ Clue: ${cItem.card.name} (${cItem.clueSpread.assignedCards.length})`;
        clueTab.addEventListener('click', () => {
          state.activeMode = 'secondary';
          state.secondary = cItem.clueSpread;
          renderStep5SpreadLayout();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        spreadNavTabs.appendChild(clueTab);
      }
    });
  }

  btnBackToPrimary.addEventListener('click', () => {
    state.activeMode = 'primary';
    renderStep5SpreadLayout();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ==========================================
  // SECONDARY SPREAD (CLUE) INITIATION
  // ==========================================
  function startSecondarySpread(cardItem, index) {
    const parentCard = cardItem.card;

    // Build the question from previous card and its meaning
    const clueQuestion = `${parentCard.name} (${parentCard.orientation}): ${parentCard.active_meaning}`;

    state.activeMode = 'secondary';
    state.secondary = {
      parentCardIndex: index,
      parentCard: {
        name: parentCard.name,
        orientation: parentCard.orientation,
        is_reversed: parentCard.is_reversed,
        active_meaning: parentCard.active_meaning,
        image_path: normalizeImagePath(parentCard.image_path),
        slotLabel: cardItem.slotLabel,
      },
      userQuery: clueQuestion,
      spreadSize: 1, // default 1 card for a focused clue
      slotMeanings: [`Clue for ${parentCard.name}`],
      deckPool: state.primary.deckPool || 'full',
      drawnCards: [],
      assignedCards: [],
    };

    // Close inspector modal if open
    closeCardModal();

    // Transition directly to Step 3 (Choose Deck & Initiate Shuffle)
    step5.classList.add('hidden');
    step3.classList.remove('hidden');
    updateStep3UI();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================
  // CARD INSPECTOR MODAL
  // ==========================================
  function openCardModal(cardItem, index) {
    state.modalActiveCardItem = cardItem;
    state.modalActiveIndex = index;

    modalCardImg.src = normalizeImagePath(cardItem.card.image_path);
    modalCardImg.style.transform = cardItem.card.is_reversed ? 'rotate(180deg)' : 'none';
    modalCardSlot.textContent = `Position ${index + 1}: ${cardItem.slotLabel}`;
    modalCardName.textContent = cardItem.card.name;

    modalCardOrientation.textContent = `${cardItem.card.orientation} (0°/180°)`;
    if (cardItem.card.is_reversed) {
      modalCardOrientation.className = 'inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-200 border border-amber-600';
    } else {
      modalCardOrientation.className = 'inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-200 border border-cyan-500';
    }

    modalCardMeaning.textContent = cardItem.card.active_meaning;

    // Update button text
    modalBtnGetClue.innerHTML = `<span>🔍</span><span>Get More Clue on "${cardItem.card.name}" →</span>`;

    cardDetailModal.classList.remove('hidden');
  }

  function closeCardModal() {
    cardDetailModal.classList.add('hidden');
    state.modalActiveCardItem = null;
    state.modalActiveIndex = null;
  }

  modalCloseBtn.addEventListener('click', closeCardModal);

  cardDetailModal.addEventListener('click', (e) => {
    if (e.target === cardDetailModal) {
      closeCardModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !cardDetailModal.classList.contains('hidden')) {
      closeCardModal();
    }
  });

  modalBtnGetClue.addEventListener('click', () => {
    if (state.modalActiveCardItem) {
      startSecondarySpread(state.modalActiveCardItem, state.modalActiveIndex);
    }
  });

  // ==========================================
  // RESET / NEW READING
  // ==========================================
  btnNewReading.addEventListener('click', () => {
    location.reload();
  });

  // ==========================================
  // 4-DECK CARD COMPARISON VIEWER
  // (Independent from reading & card drawing)
  // ==========================================
  function setupDeckCompareFeature() {
    const btnOpenDeckCompare = document.getElementById('btn-open-deck-compare');
    const btnHeaderDeckCompare = document.getElementById('btn-header-deck-compare');
    const deckCompareModal = document.getElementById('deck-compare-modal');
    const compareModalCloseBtn = document.getElementById('compare-modal-close-btn');

    const compareSearchInput = document.getElementById('compare-search-input');
    const compareSearchClear = document.getElementById('compare-search-clear');
    const compareSearchSuggestions = document.getElementById('compare-search-suggestions');
    const compareCardSelect = document.getElementById('compare-card-select');

    const comparePrevBtn = document.getElementById('compare-prev-btn');
    const compareNextBtn = document.getElementById('compare-next-btn');
    const compareRandomBtn = document.getElementById('compare-random-btn');

    const compareOrientationToggle = document.getElementById('compare-orientation-toggle');
    const compareOrientationLabel = document.getElementById('compare-orientation-label');
    const compareCardTitle = document.getElementById('compare-card-title');
    const compareCardTypeBadge = document.getElementById('compare-card-type-badge');
    const compareUprightMeaning = document.getElementById('compare-upright-meaning');
    const compareReversedMeaning = document.getElementById('compare-reversed-meaning');
    const compareUprightBox = document.getElementById('compare-upright-box');
    const compareReversedBox = document.getElementById('compare-reversed-box');

    const compareImgRws = document.getElementById('compare-img-rws');
    const compareImgCelestial = document.getElementById('compare-img-celestial-gold');
    const compareImgSoimoi = document.getElementById('compare-img-soimoi');
    const compareImgWoodland = document.getElementById('compare-img-woodland-animal');

    // Lightbox modal elements
    const compareLightboxModal = document.getElementById('compare-lightbox-modal');
    const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
    const lightboxDeckBadge = document.getElementById('lightbox-deck-badge');
    const lightboxCardName = document.getElementById('lightbox-card-name');
    const lightboxDeckName = document.getElementById('lightbox-deck-name');
    const lightboxImg = document.getElementById('lightbox-img');

    if (!deckCompareModal) return;

    let compareActiveIndex = 0;
    let compareIsReversed = false;
    let highlightedSuggestionIndex = -1;

    // Capitalize helper
    function capitalize(str) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Populate Grouped Card Select Dropdown
    function populateCardSelect() {
      if (!compareCardSelect || !tarotDataset.length) return;
      compareCardSelect.innerHTML = '';

      const groups = [
        { label: 'Major Arcana', cards: tarotDataset.filter(c => c.type === 'major') },
        { label: 'Suit of Cups', cards: tarotDataset.filter(c => c.suit === 'cups') },
        { label: 'Suit of Pentacles', cards: tarotDataset.filter(c => c.suit === 'pentacles') },
        { label: 'Suit of Swords', cards: tarotDataset.filter(c => c.suit === 'swords') },
        { label: 'Suit of Wands', cards: tarotDataset.filter(c => c.suit === 'wands') }
      ];

      groups.forEach(grp => {
        if (!grp.cards.length) return;
        const optgroup = document.createElement('optgroup');
        optgroup.label = `${grp.label} (${grp.cards.length})`;
        grp.cards.forEach(card => {
          const opt = document.createElement('option');
          opt.value = card.id;
          opt.textContent = card.name;
          optgroup.appendChild(opt);
        });
        compareCardSelect.appendChild(optgroup);
      });
    }

    // Render comparison view for card at index
    function renderCompareCard(index, updateSearchText = true) {
      if (!tarotDataset || !tarotDataset.length) return;

      // Wrap around bounds
      compareActiveIndex = ((index % tarotDataset.length) + tarotDataset.length) % tarotDataset.length;
      const card = tarotDataset[compareActiveIndex];
      if (!card) return;

      const filename = card.image_path.split('/').pop();

      // Card titles & badges
      if (compareCardTitle) compareCardTitle.textContent = card.name;
      if (compareCardTypeBadge) {
        if (card.type === 'major') {
          compareCardTypeBadge.textContent = `Major Arcana • Rank ${card.rank}`;
          compareCardTypeBadge.className = 'text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40';
        } else {
          compareCardTypeBadge.textContent = `Suit of ${capitalize(card.suit)} • ${capitalize(card.rank)}`;
          compareCardTypeBadge.className = 'text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/40';
        }
      }

      // Meanings
      if (compareUprightMeaning) compareUprightMeaning.textContent = card.meaning_upright;
      if (compareReversedMeaning) compareReversedMeaning.textContent = card.meaning_reversed;

      // Highlight active orientation meaning box
      if (compareUprightBox && compareReversedBox) {
        if (compareIsReversed) {
          compareUprightBox.classList.remove('ring-2', 'ring-emerald-400');
          compareReversedBox.classList.add('ring-2', 'ring-amber-400');
        } else {
          compareReversedBox.classList.remove('ring-2', 'ring-amber-400');
          compareUprightBox.classList.add('ring-2', 'ring-emerald-400');
        }
      }

      // 4 Deck Card Images
      const rotStyle = compareIsReversed ? 'rotate(180deg)' : 'none';
      if (compareImgRws) {
        compareImgRws.src = `images/cleaned-deck/${filename}`;
        compareImgRws.style.transform = rotStyle;
      }
      if (compareImgCelestial) {
        compareImgCelestial.src = `images/decks/celestial-gold/${filename}`;
        compareImgCelestial.style.transform = rotStyle;
      }
      if (compareImgSoimoi) {
        compareImgSoimoi.src = `images/decks/soimoi/${filename}`;
        compareImgSoimoi.style.transform = rotStyle;
      }
      if (compareImgWoodland) {
        compareImgWoodland.src = `images/decks/woodland-animal/${filename}`;
        compareImgWoodland.style.transform = rotStyle;
      }

      // Sync Dropdown Select
      if (compareCardSelect) {
        compareCardSelect.value = card.id;
      }

      // Sync Search Input Text
      if (updateSearchText && compareSearchInput && document.activeElement !== compareSearchInput) {
        compareSearchInput.value = card.name;
        if (compareSearchClear) compareSearchClear.classList.remove('hidden');
      }

      hideSuggestions();
    }

    // Number aliases mapping for flexible card search (e.g., "3 cups" -> "Three of Cups")
    const NUM_ALIASES = {
      '1': ['ace', 'one', '1st'],
      '2': ['two', '2nd'],
      '3': ['three', '3rd'],
      '4': ['four', '4th'],
      '5': ['five', '5th'],
      '6': ['six', '6th'],
      '7': ['seven', '7th'],
      '8': ['eight', '8th'],
      '9': ['nine', '9th'],
      '10': ['ten', '10th']
    };

    function searchCards(query) {
      if (!query || !query.trim()) return [];
      const clean = query.toLowerCase().trim();

      return tarotDataset.filter(card => {
        const name = card.name.toLowerCase();
        const suit = (card.suit || '').toLowerCase();
        const rank = (card.rank || '').toLowerCase();

        if (name.includes(clean)) return true;
        if (suit.includes(clean)) return true;
        if (rank.includes(clean)) return true;

        // Check numeric substitutions
        for (const [digit, aliases] of Object.entries(NUM_ALIASES)) {
          if (clean.includes(digit)) {
            for (const alias of aliases) {
              const testQuery = clean.replace(digit, alias);
              if (name.includes(testQuery)) return true;
            }
          }
        }
        return false;
      });
    }

    function showSuggestions(matches) {
      if (!compareSearchSuggestions) return;
      if (!matches || !matches.length) {
        compareSearchSuggestions.innerHTML = `
          <div class="p-3 text-xs text-slate-400 text-center">
            No matching tarot cards found. Try searching e.g. "Fool", "3 of Cups", "Death", "Queen".
          </div>
        `;
        compareSearchSuggestions.classList.remove('hidden');
        highlightedSuggestionIndex = -1;
        return;
      }

      highlightedSuggestionIndex = -1;
      const html = matches.slice(0, 12).map((c, i) => {
        const filename = c.image_path.split('/').pop();
        const tag = c.type === 'major' ? `Major Arcana ${c.rank}` : `Suit of ${capitalize(c.suit)}`;
        return `
          <div class="suggestion-item p-2.5 hover:bg-slate-800/90 cursor-pointer flex items-center justify-between gap-3 transition-colors ${i === 0 ? 'bg-slate-800/40' : ''}" data-card-id="${c.id}" data-index="${i}">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-10 rounded overflow-hidden bg-slate-950 border border-slate-700 flex-shrink-0">
                <img src="images/cleaned-deck/${filename}" alt="${c.name}" class="w-full h-full object-cover">
              </div>
              <div class="flex flex-col">
                <span class="text-xs font-bold text-white leading-tight">${c.name}</span>
                <span class="text-[10px] text-cyan-300 font-medium">${tag}</span>
              </div>
            </div>
            <span class="text-[10px] text-slate-400 font-mono">View 4 Vibes →</span>
          </div>
        `;
      }).join('');

      compareSearchSuggestions.innerHTML = html;
      compareSearchSuggestions.classList.remove('hidden');

      // Click on suggestion
      compareSearchSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          const cardId = item.dataset.cardId;
          const idx = tarotDataset.findIndex(c => c.id === cardId);
          if (idx !== -1) {
            renderCompareCard(idx, true);
          }
        });
      });
    }

    function hideSuggestions() {
      if (compareSearchSuggestions) {
        compareSearchSuggestions.classList.add('hidden');
        highlightedSuggestionIndex = -1;
      }
    }

    // Search Input Events
    if (compareSearchInput) {
      compareSearchInput.addEventListener('input', () => {
        const q = compareSearchInput.value.trim();
        if (compareSearchClear) {
          if (q.length > 0) compareSearchClear.classList.remove('hidden');
          else compareSearchClear.classList.add('hidden');
        }

        if (!q) {
          hideSuggestions();
          return;
        }

        const matches = searchCards(q);
        showSuggestions(matches);
      });

      compareSearchInput.addEventListener('keydown', (e) => {
        const items = compareSearchSuggestions ? compareSearchSuggestions.querySelectorAll('.suggestion-item') : [];

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!items.length) return;
          highlightedSuggestionIndex = (highlightedSuggestionIndex + 1) % items.length;
          items.forEach((it, i) => it.classList.toggle('bg-slate-700/80', i === highlightedSuggestionIndex));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (!items.length) return;
          highlightedSuggestionIndex = (highlightedSuggestionIndex - 1 + items.length) % items.length;
          items.forEach((it, i) => it.classList.toggle('bg-slate-700/80', i === highlightedSuggestionIndex));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (items.length > 0) {
            const targetItem = highlightedSuggestionIndex >= 0 ? items[highlightedSuggestionIndex] : items[0];
            const cardId = targetItem.dataset.cardId;
            const idx = tarotDataset.findIndex(c => c.id === cardId);
            if (idx !== -1) {
              renderCompareCard(idx, true);
            }
          }
          compareSearchInput.blur();
          hideSuggestions();
        } else if (e.key === 'Escape') {
          hideSuggestions();
        }
      });
    }

    // Clear Search Input Button
    if (compareSearchClear) {
      compareSearchClear.addEventListener('click', () => {
        if (compareSearchInput) {
          compareSearchInput.value = '';
          compareSearchInput.focus();
        }
        compareSearchClear.classList.add('hidden');
        hideSuggestions();
      });
    }

    // Select Dropdown Change
    if (compareCardSelect) {
      compareCardSelect.addEventListener('change', () => {
        const cardId = compareCardSelect.value;
        const idx = tarotDataset.findIndex(c => c.id === cardId);
        if (idx !== -1) {
          renderCompareCard(idx, true);
        }
      });
    }

    // Navigation Buttons (Prev, Next, Random)
    if (comparePrevBtn) {
      comparePrevBtn.addEventListener('click', () => {
        renderCompareCard(compareActiveIndex - 1, true);
      });
    }

    if (compareNextBtn) {
      compareNextBtn.addEventListener('click', () => {
        renderCompareCard(compareActiveIndex + 1, true);
      });
    }

    if (compareRandomBtn) {
      compareRandomBtn.addEventListener('click', () => {
        const rand = Math.floor(Math.random() * tarotDataset.length);
        renderCompareCard(rand, true);
      });
    }

    // Orientation Toggle (Upright / Reversed)
    if (compareOrientationToggle) {
      compareOrientationToggle.addEventListener('click', () => {
        compareIsReversed = !compareIsReversed;
        if (compareOrientationLabel) {
          compareOrientationLabel.textContent = compareIsReversed
            ? 'Orientation: Reversed (180°)'
            : 'Orientation: Upright (0°)';
        }
        renderCompareCard(compareActiveIndex, false);
      });
    }

    // Lightbox modal for enlarged artwork view
    function openLightbox(deckName, deckBadge, badgeClass, imgSrc) {
      if (!compareLightboxModal) return;
      const card = tarotDataset[compareActiveIndex];
      if (lightboxDeckBadge) {
        lightboxDeckBadge.textContent = deckBadge;
        lightboxDeckBadge.className = `text-[10px] font-extrabold px-2 py-0.5 rounded-full self-start ${badgeClass}`;
      }
      if (lightboxCardName) lightboxCardName.textContent = card ? card.name : '';
      if (lightboxDeckName) lightboxDeckName.textContent = deckName;
      if (lightboxImg) {
        lightboxImg.src = imgSrc;
        lightboxImg.style.transform = compareIsReversed ? 'rotate(180deg)' : 'none';
      }
      compareLightboxModal.classList.remove('hidden');
    }

    function closeLightbox() {
      if (compareLightboxModal) compareLightboxModal.classList.add('hidden');
    }

    if (lightboxCloseBtn) {
      lightboxCloseBtn.addEventListener('click', closeLightbox);
    }
    if (compareLightboxModal) {
      compareLightboxModal.addEventListener('click', (e) => {
        if (e.target === compareLightboxModal) closeLightbox();
      });
    }

    // Clicking on any deck card opens the lightbox
    document.querySelectorAll('.compare-card-frame').forEach(frame => {
      frame.addEventListener('click', () => {
        const deckName = frame.dataset.deckName || 'Tarot Deck';
        const deckBadge = frame.dataset.deckBadge || 'Tarot Vibe';
        const badgeClass = frame.dataset.badgeClass || 'bg-cyan-950 text-cyan-300 border border-cyan-500/40';
        const img = frame.querySelector('img');
        if (img) openLightbox(deckName, deckBadge, badgeClass, img.src);
      });
    });

    // Modal Open & Close Functions
    function openDeckCompare() {
      populateCardSelect();
      renderCompareCard(compareActiveIndex, true);
      deckCompareModal.classList.remove('hidden');
    }

    function closeDeckCompare() {
      deckCompareModal.classList.add('hidden');
      hideSuggestions();
      closeLightbox();
    }

    if (btnOpenDeckCompare) {
      btnOpenDeckCompare.addEventListener('click', openDeckCompare);
    }
    if (btnHeaderDeckCompare) {
      btnHeaderDeckCompare.addEventListener('click', openDeckCompare);
    }
    if (compareModalCloseBtn) {
      compareModalCloseBtn.addEventListener('click', closeDeckCompare);
    }

    // Close on backdrop click
    deckCompareModal.addEventListener('click', (e) => {
      if (e.target === deckCompareModal) {
        closeDeckCompare();
      }
    });

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
      if (compareSearchSuggestions && !compareSearchSuggestions.contains(e.target) && e.target !== compareSearchInput) {
        hideSuggestions();
      }
    });

    // Keyboard Shortcuts (Esc to close, Left/Right arrows for Prev/Next)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (compareLightboxModal && !compareLightboxModal.classList.contains('hidden')) {
          closeLightbox();
          e.stopPropagation();
          return;
        }
        if (deckCompareModal && !deckCompareModal.classList.contains('hidden')) {
          closeDeckCompare();
          e.stopPropagation();
          return;
        }
      }

      // Arrow navigation when compare modal is open and input not focused
      if (deckCompareModal && !deckCompareModal.classList.contains('hidden')) {
        const isInputFocused = document.activeElement === compareSearchInput;
        if (!isInputFocused) {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            renderCompareCard(compareActiveIndex - 1, true);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            renderCompareCard(compareActiveIndex + 1, true);
          }
        }
      }
    });

    // Initial population
    populateCardSelect();
  }

  // Initialize deck comparison feature
  setupDeckCompareFeature();
});
