// ==========================================
// 1. GLOBALS & SUPABASE (Available to all files)
// ==========================================
var SUPABASE_URL = "https://cavkoylkbcyhsifrsjyd.supabase.co";   
var SUPABASE_KEY = "sb_publishable_wklRlSZbzArKFCq31Ugnrw_JWAJkS4K"; 
var supabaseClient = (typeof window.supabase !== 'undefined') ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Global Helpers
function el(id) { return document.getElementById(id); }
function getBatTeam() { return state.teams[state.battingKey]; }
function getBowlTeam() { return state.teams[state.bowlingKey]; }
function formatOver(balls) { return Math.floor(balls/6) + "." + (balls%6); }
function getBadgeHtml(b) { return b.type === 'divider' ? `<span class="over-divider">/</span>` : `<div class="ball-badge ball-${b.type}">${b.label}</div>`; }

var activeMatch = null;
var setupSquads = { A: { bench: [], xi: [], subs: [], roles: { c: null, vc: null, wk: null } }, B: { bench: [], xi: [], subs: [], roles: { c: null, vc: null, wk: null } } };
var modalContext = {}, stateHistory = [], remarkLog = [];
var state = { matchId: "", inningsNum: 1, battingKey: 'A', bowlingKey: 'B', matchResult: "", matchSettings: { matchType: 't20', category: 'men', maxOvers: 20, originalMaxOvers: 20, customTarget: null, customTargetOvers: null, targetMethod: "", bowlerQuota: 4, matchSelectors: [], venue: "", officials: {} }, teams: { A: { name: "", players: [], pendingPenalties: 0 }, B: { name: "", players: [], pendingPenalties: 0 } }, current: { runs:0, wkts:0, balls:0, sIdx:null, nsIdx:null, bIdx:null, isFreeHit: false, penalties: 0, lastOverBowlers: new Set(), extras: {w:0, nb:0, b:0, lb:0}, recentBalls: [], currentOverLog: [], runsInThisOver: 0, bowlersInCurrentOver: new Set(), overHistory: [], currPartnership: { runs: 0, balls: 0 }, fow: [], activeBreak: null, activeBreakStartTime: null, activeBreakInsp: null, pendingBreakMins: 0, inningsStartTime: null, inningsEndTime: null, allowances: 0 }, inningsSummaries: [], matchBreaks: [] };

// ==========================================
// 2. TIME & MODAL HELPERS
// ==========================================
function getTimeDropdownsHtml(prefix, allowNA = false) {
    let d = new Date(); let curH = d.getHours(); let curM = d.getMinutes(); let ampm = curH >= 12 ? 'PM' : 'AM'; curH = curH % 12; if(curH === 0) curH = 12;
    let h = allowNA ? '<option value="">--</option>' : ''; let m = allowNA ? '<option value="">--</option>' : '';
    for(let i=1; i<=12; i++) { let val = i.toString().padStart(2,'0'); let sel = (!allowNA && i === curH) ? 'selected' : ''; h += `<option value="${val}" ${sel}>${val}</option>`; }
    for(let i=0; i<60; i++) { let val = i.toString().padStart(2,'0'); let sel = (!allowNA && i === curM) ? 'selected' : ''; m += `<option value="${val}" ${sel}>${val}</option>`; }
    let amSel = (!allowNA && ampm === 'AM') ? 'selected' : ''; let pmSel = (!allowNA && ampm === 'PM') ? 'selected' : '';
    return `<div class="flex-row gap-5"><select id="${prefix}Hr" class="modal-input" style="width:33%; margin-bottom:0;">${h}</select><select id="${prefix}Min" class="modal-input" style="width:33%; margin-bottom:0;">${m}</select><select id="${prefix}AmPm" class="modal-input" style="width:33%; margin-bottom:0;">${allowNA ? '<option value="">--</option>' : ''}<option value="AM" ${amSel}>AM</option><option value="PM" ${pmSel}>PM</option></select></div>`;
}

function parseTimeDropdowns(prefix) {
    let hrVal = el(`${prefix}Hr`).value; if(!hrVal) return null; 
    let hr = parseInt(hrVal), min = el(`${prefix}Min`).value || "00", ampm = el(`${prefix}AmPm`).value || "AM";
    if(ampm === 'PM' && hr !== 12) hr += 12; if(ampm === 'AM' && hr === 12) hr = 0;
    return `${hr.toString().padStart(2,'0')}:${min}`;
}

function calculateDurationMins(startStr, endStr) {
    if(!startStr || !endStr) return 0;
    let [sh, sm] = startStr.split(':').map(Number), [eh, em] = endStr.split(':').map(Number);
    let startMins = sh * 60 + sm, endMins = eh * 60 + em;
    if (endMins < startMins) endMins += 24 * 60; return endMins - startMins;
}

function showModal(title, html, cb, hideCancel = false, customWidth = "360px", confirmBtnText = "Confirm", requiresDownload = false) { 
    el('modalHeading').innerText = title; el('modalBody').innerHTML = html; 
    let cBtn = el('modalConfirmBtn'); cBtn.style.display = ''; cBtn.onclick = cb; 
    el('modalBoxElement').style.maxWidth = customWidth; 
    let cancelBtn = el('modalCancelBtn'); cancelBtn.innerText = "Cancel"; cancelBtn.onclick = closeModal;
    if (requiresDownload) { cBtn.disabled = true; cBtn.style.opacity = '0.5'; cBtn.style.cursor = 'not-allowed'; cBtn.dataset.origText = confirmBtnText; cBtn.innerText = "🔒 Download Report First"; cancelBtn.style.display = ''; cancelBtn.innerText = "🔙 Go Back & Edit"; } else { cBtn.disabled = false; cBtn.style.opacity = '1'; cBtn.style.cursor = 'pointer'; cBtn.innerText = confirmBtnText; cancelBtn.style.display = hideCancel ? 'none' : ''; } 
    el('dynamicModal').classList.remove('hidden'); 
}

function closeModal() { 
    el('dynamicModal').classList.add('hidden'); 
    let scoringBox = el('scoringEventsBox');
    if (scoringBox) { scoringBox.style.pointerEvents = 'auto'; scoringBox.style.opacity = '1'; }
}

// ==========================================
// 3. BOOTSTRAP & RESUME
// ==========================================
window.onload = async function() {
    if (typeof Chart !== 'undefined') { Chart.defaults.color = '#cbd5e1'; Chart.defaults.borderColor = '#334155'; }
    window.matchChart = null; 
    await fetchRegistry();
    
    let activeMatchStr = localStorage.getItem('cricStat_activeMatch');
    if (activeMatchStr) {
        showModal("Resume Match?", "An unfinished match was found in your browser. Would you like to resume it instantly without entering the PIN?", function() {
            try {
                let parsedState = JSON.parse(activeMatchStr); 
                parsedState.current.lastOverBowlers = new Set(parsedState.current.lastOverBowlers); 
                parsedState.current.bowlersInCurrentOver = new Set(parsedState.current.bowlersInCurrentOver); 
                state = parsedState;
                el('login-screen').classList.add('hidden'); 
                el('top-title').classList.add('hidden');
                el('scoringView').classList.remove('hidden'); 
                if (state.matchSettings.matchType === 'multiday') el('breakBtn').classList.remove('hidden');
                activeMatch = JSON.parse(localStorage.getItem('cricStat_activeMatchMetadata')) || null;
                let savedHistory = localStorage.getItem('cricStat_stateHistory');
                if (savedHistory) stateHistory = JSON.parse(savedHistory);
                if (typeof updateUI === 'function') updateUI(); 
                closeModal();
            } catch(e) { localStorage.removeItem('cricStat_activeMatch'); location.reload(); }
        }, false, "360px", "Resume Match");
        el('modalCancelBtn').innerText = "Start Fresh (Enter PIN)"; 
        el('modalCancelBtn').onclick = function() { localStorage.removeItem('cricStat_activeMatch'); closeModal(); };
    }
};

async function fetchRegistry() {
    if(!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient.from('match_registry').select('*');
        if(!error && data) {
            let vHtml = '', oHtml = '';
            data.forEach(item => { if(item.category === 'venue') vHtml += `<option value="${item.name}">`; if(item.category === 'official') oHtml += `<option value="${item.name}">`; });
            if(el('db-venues')) el('db-venues').innerHTML = vHtml;
            if(el('db-officials')) el('db-officials').innerHTML = oHtml;
        }
    } catch(e) {}
}

async function saveToRegistry(venue, officials) {
    if(!supabaseClient) return;
    let payload = [];
    if(venue) payload.push({ category: 'venue', name: venue });
    Object.values(officials).forEach(o => { if(o) payload.push({ category: 'official', name: o }); });
    if(payload.length === 0) return;
    try { await supabaseClient.from('match_registry').upsert(payload, {onConflict: 'name'}); } catch(e) {}
}

async function authenticateMatch() {
    try {
        const matchId = el('login-match-id').value.trim().toUpperCase(); const pin = el('login-pin').value.trim(); const errBox = el('login-error');
        if(!matchId || !pin) { errBox.innerText = "Please enter both Match ID and PIN."; return; }
        errBox.style.color = "#38bdf8"; errBox.innerText = "⏳ Authenticating with Cloud...";
        if (!supabaseClient) throw new Error("Database connection failed.");
        
        const { data, error } = await supabaseClient.from('matches').select('*, tournaments(name)').eq('match_id', matchId).eq('scorer_pin', pin).single();
        if (error || !data) { errBox.style.color = "#ef4444"; errBox.innerText = "❌ Invalid Match ID or PIN."; return; }
        
        let fullState = data.full_state || {};
        if (fullState.match_status === 'completed') { errBox.style.color = "#f59e0b"; errBox.innerHTML = "🏁 <b>Match Locked</b><br><span style='font-size:0.85rem; color:#94a3b8;'>This match has already been completed.</span>"; return; }
        
        activeMatch = data; localStorage.setItem('cricStat_activeMatchMetadata', JSON.stringify(activeMatch));
        if (fullState.match_status === 'live') {
            showModal("☁️ Cloud Sync Found", "<div class='text-center mt-10 text-success font-bold'>Match is already in progress!</div><div class='text-center text-muted mt-5' style='font-size:0.85rem;'>Resuming from the latest cloud save...</div>", function() {
                try {
                    let parsedState = fullState; parsedState.current.lastOverBowlers = new Set(parsedState.current.lastOverBowlers || []); parsedState.current.bowlersInCurrentOver = new Set(parsedState.current.bowlersInCurrentOver || []); state = parsedState;
                    el('login-screen').classList.add('hidden'); el('top-title').classList.add('hidden'); el('scoringView').classList.remove('hidden'); 
                    if (state.matchSettings.matchType === 'multiday') { if(el('breakBtn')) el('breakBtn').classList.remove('hidden'); }
                    if(typeof updateUI === 'function') updateUI(); 
                    closeModal();
                } catch(e) { alert("Error loading cloud state."); }
            }, true, "360px", "Resume Match"); return;
        }
        
        setupSquads = { A: { bench: [], xi: [], subs: [], roles: { c: null, vc: null, wk: null } }, B: { bench: [], xi: [], subs: [], roles: { c: null, vc: null, wk: null } } };
        el('login-screen').classList.add('hidden'); el('toss-screen').classList.remove('hidden');
        let t1 = fullState.team1 || (fullState.teams && fullState.teams.A ? fullState.teams.A.name : 'Team A'); let t2 = fullState.team2 || (fullState.teams && fullState.teams.B ? fullState.teams.B.name : 'Team B');
        el('tossWinner').innerHTML = `<option value="A">${t1}</option><option value="B">${t2}</option>`; el('team-a-name').innerText = t1; el('team-b-name').innerText = t2; errBox.innerText = ""; 
        
        await loadTournamentSquads(activeMatch.team_a_id, 'A', t1); await loadTournamentSquads(activeMatch.team_b_id, 'B', t2);
    } catch(e) { let errBox = el('login-error'); if(errBox) { errBox.style.color = "#ef4444"; errBox.innerText = "❌ System Error: " + e.message; } }
}

// ==========================================
// 4. TAP-AND-FLY SQUAD LOGIC
// ==========================================
async function loadTournamentSquads(teamId, teamKey, fallbackTeamName) {
    let savedPlayers = activeMatch.full_state?.teams?.[teamKey]?.players;
    if (savedPlayers && savedPlayers.length > 0) {
        savedPlayers.forEach(p => setupSquads[teamKey].bench.push({ id: p.id || p.regNo, name: p.name }));
        renderTapAndFly(teamKey); return;
    }
    if (!activeMatch.tournament_id || !teamId) {
        for(let i=1; i<=18; i++) setupSquads[teamKey].bench.push({ id: `dummy_${teamKey}_${i}`, name: `${fallbackTeamName} Player ${i}` });
        renderTapAndFly(teamKey); return; 
    }
    const { data, error } = await supabaseClient.from('tournament_squads').select('player_id, players(full_name)').eq('tournament_id', activeMatch.tournament_id).eq('team_id', teamId);
    if(error || !data || data.length === 0) { 
        for(let i=1; i<=18; i++) setupSquads[teamKey].bench.push({ id: `dummy_${teamKey}_${i}`, name: `${fallbackTeamName} Player ${i}` });
        renderTapAndFly(teamKey); return; 
    }
    data.forEach((row, index) => { 
        let pName = (row.players && row.players.full_name) ? row.players.full_name : `${fallbackTeamName} Player ${index + 1}`;
        let pId = row.player_id || `dummy_${teamKey}_${index + 1}`;
        setupSquads[teamKey].bench.push({ id: pId, name: pName }); 
    });
    renderTapAndFly(teamKey);
}

function renderTapAndFly(tKey) {
    let sq = setupSquads[tKey];
    el(`bench-${tKey}`).innerHTML = sq.bench.map(p => `<div class="tf-player tf-bench" onclick="tapPlayer('${tKey}', '${p.id}', 'bench')"><span>${p.name}</span> <span>➡</span></div>`).join('');
    el(`xi-${tKey}`).innerHTML = sq.xi.map(p => {
        let isC = sq.roles.c === p.id ? 'active c' : ''; let isVC = sq.roles.vc === p.id ? 'active vc' : ''; let isWK = sq.roles.wk === p.id ? 'active wk' : '';
        return `<div class="tf-player tf-xi" onclick="tapPlayer('${tKey}', '${p.id}', 'xi')"><span>${p.name}</span><div class="role-badges" onclick="event.stopPropagation()"><span class="r-badge ${isC}" onclick="setRole(event, '${tKey}', '${p.id}', 'c')">C</span><span class="r-badge ${isVC}" onclick="setRole(event, '${tKey}', '${p.id}', 'vc')">VC</span><span class="r-badge ${isWK}" onclick="setRole(event, '${tKey}', '${p.id}', 'wk')">WK</span></div></div>`;
    }).join('');
    el(`subs-${tKey}`).innerHTML = sq.subs.map(p => `<div class="tf-player tf-sub" onclick="tapPlayer('${tKey}', '${p.id}', 'subs')"><span>${p.name}</span> <span>⬅</span></div>`).join('');
    el(`count-${tKey}-xi`).innerText = `${sq.xi.length}/11`; el(`count-${tKey}-subs`).innerText = `${sq.subs.length}/7`; el(`count-${tKey}-xi`).style.color = sq.xi.length > 11 ? '#ef4444' : '#10b981';
}

function tapPlayer(tKey, pId, fromPane) {
    let sq = setupSquads[tKey];
    if (fromPane === 'bench') {
        let pIdx = sq.bench.findIndex(x => String(x.id) === String(pId)); let p = sq.bench.splice(pIdx, 1)[0];
        if (sq.xi.length < 11) sq.xi.push(p); else if (sq.subs.length < 7) sq.subs.push(p); else { sq.bench.push(p); alert("Squad is full! Maximum 11 XI and 7 Subs."); }
    } else if (fromPane === 'xi') {
        let pIdx = sq.xi.findIndex(x => String(x.id) === String(pId)); let p = sq.xi.splice(pIdx, 1)[0]; sq.bench.push(p);
        if(sq.roles.c === pId) sq.roles.c = null; if(sq.roles.vc === pId) sq.roles.vc = null; if(sq.roles.wk === pId) sq.roles.wk = null;
    } else if (fromPane === 'subs') {
        let pIdx = sq.subs.findIndex(x => String(x.id) === String(pId)); let p = sq.subs.splice(pIdx, 1)[0]; sq.bench.push(p);
    }
    renderTapAndFly(tKey);
}

function setRole(e, tKey, pId, role) {
    e.stopPropagation();
    if (setupSquads[tKey].roles[role] === pId) setupSquads[tKey].roles[role] = null; else setupSquads[tKey].roles[role] = pId;
    renderTapAndFly(tKey);
}

function buildPlayerFromSetup(p, isXi, tKey) {
    let roles = setupSquads[tKey].roles; let desig = [];
    if(roles.c === p.id) desig.push('C'); if(roles.vc === p.id) desig.push('VC');
    let skill = "Batter / Bowler"; if(roles.wk === p.id) { skill = "WK"; if(desig.includes('C')) desig = ['C/WK']; }
    return { id: p.id, regNo: "", name: p.name, desig: desig.join('/'), r:0, b:0, f:0, s:0, out:false, outOnDuck:0, hasBatted: false, dismissalInfo: "", o:0, rc:0, w:0, m:0, ex:0, wd:0, nb:0, byes:0, legbyes:0, cw:0, catches:0, stumpings:0, runouts:0, quotaOvers: 0, inTime: null, outTime: null, isPlayingXI: isXi, skill: skill, breakMins: 0 };
}

async function lockPlayingXI() {
    if(setupSquads.A.xi.length === 0 || setupSquads.B.xi.length === 0) { alert("Select at least 1 player in the Playing XI for both teams!"); return; }
    state.matchId = activeMatch.match_id; state.teams.A.name = el('team-a-name').innerText; state.teams.B.name = el('team-b-name').innerText;
    state.teams.A.players = [...setupSquads.A.xi.map(p => buildPlayerFromSetup(p, true, 'A')), ...setupSquads.A.subs.map(p => buildPlayerFromSetup(p, false, 'A'))];
    state.teams.B.players = [...setupSquads.B.xi.map(p => buildPlayerFromSetup(p, true, 'B')), ...setupSquads.B.subs.map(p => buildPlayerFromSetup(p, false, 'B'))];

    state.matchSettings.venue = el('match-venue') ? el('match-venue').value.trim() : "";
    state.matchSettings.officials = { referee: el('match-referee')?el('match-referee').value.trim():"", coach: el('match-coach')?el('match-coach').value.trim():"", manager: el('match-manager')?el('match-manager').value.trim():"", umpire1: el('umpire-1')?el('umpire-1').value.trim():"", umpire2: el('umpire-2')?el('umpire-2').value.trim():"", umpire3: el('umpire-3')?el('umpire-3').value.trim():"", umpire4: el('umpire-4')?el('umpire-4').value.trim():"", scorer1: el('scorer-1')?el('scorer-1').value.trim():"", scorer2: el('scorer-2')?el('scorer-2').value.trim():"" };
    saveToRegistry(state.matchSettings.venue, state.matchSettings.officials);

    let win = el('tossWinner').value, dec = el('tossDecision').value; 
    state.battingKey = ((win === 'A' && dec === 'bat') || (win === 'B' && dec === 'bowl')) ? 'A' : 'B'; 
    state.bowlingKey = state.battingKey === 'A' ? 'B' : 'A';
    
    // 🔥 NEW: Save the exact toss text for the Fan Portal
    let tossWinName = win === 'A' ? state.teams.A.name : state.teams.B.name;
    let tossDecText = dec === 'bat' ? 'bat' : 'bowl';
    state.matchSettings.tossStr = `${tossWinName} won the toss and elected to ${tossDecText}`;

    let updatedFullState = activeMatch.full_state || {}; 
    updatedFullState.match_status = 'live';
    const { error } = await supabaseClient.from('matches').update({ full_state: updatedFullState }).eq('match_id', activeMatch.match_id);
    if(error) { alert("Error connecting to cloud: " + error.message); return; }

    el('toss-screen').classList.add('hidden'); el('initialization-screen').classList.remove('hidden');
    el('init-bat-title').innerText = `${state.teams[state.battingKey].name} Openers`; el('init-bowl-title').innerText = `${state.teams[state.bowlingKey].name} Bowler`;
    let batOpts = '<option value="">-- Select Batter --</option>'; state.teams[state.battingKey].players.forEach((p, index) => { if(p.isPlayingXI) batOpts += `<option value="${index}">${p.name}</option>`; });
    let bowlOpts = '<option value="">-- Select Bowler --</option>'; state.teams[state.bowlingKey].players.forEach((p, index) => { if(p.isPlayingXI) bowlOpts += `<option value="${index}">${p.name}</option>`; });
    el('sel-striker').innerHTML = batOpts; el('sel-nonstriker').innerHTML = batOpts; el('sel-bowler').innerHTML = bowlOpts;
}

function startInnings() {
    try {
        const s = el('sel-striker').value, ns = el('sel-nonstriker').value, b = el('sel-bowler').value;
        if(!s || !ns || !b) { alert("You must select the Striker, Non-Striker, and Opening Bowler to begin."); return; }
        if(s === ns) { alert("Striker and Non-Striker cannot be the same person!"); return; }

        state.current.sIdx = parseInt(s); state.current.nsIdx = parseInt(ns); state.current.bIdx = parseInt(b);
        
        let batTeam = getBatTeam();
        batTeam.players[state.current.sIdx].hasBatted = true; 
        batTeam.players[state.current.nsIdx].hasBatted = true;
        
        if (!(state.current.bowlersInCurrentOver instanceof Set)) {
            state.current.bowlersInCurrentOver = new Set(state.current.bowlersInCurrentOver || []);
        }
        state.current.bowlersInCurrentOver.add(state.current.bIdx);
        state.current.inningsStartTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        if (activeMatch && activeMatch.full_state) {
            let format = activeMatch.full_state.format || 'T20';
            if (format.includes('Multi-Day') || format === 'Test') {
                state.matchSettings.matchType = 'multiday'; state.matchSettings.maxOvers = 999; state.matchSettings.bowlerQuota = 999; state.matchSettings.maxInnings = 4;
                if(el('breakBtn')) el('breakBtn').classList.remove('hidden');
            } else if (format === 'One Day') {
                state.matchSettings.matchType = 'oneday'; state.matchSettings.maxOvers = 50; state.matchSettings.bowlerQuota = 10; state.matchSettings.maxInnings = 2;
            } else {
                state.matchSettings.matchType = 't20'; state.matchSettings.maxOvers = 20; state.matchSettings.bowlerQuota = 4; state.matchSettings.maxInnings = 2;
            }
            state.matchSettings.originalMaxOvers = state.matchSettings.maxOvers;
        }

        if(activeMatch && activeMatch.full_state) { el('displayTournament').innerText = activeMatch.full_state.tournament || "MATCH IN PROGRESS"; }
        el('dispGroundName').innerText = state.matchSettings.venue || "Live Ground"; 
        
        el('initialization-screen').classList.add('hidden'); el('top-title').classList.add('hidden'); el('scoringView').classList.remove('hidden');
        
        if (typeof updateUI === 'function') {
            updateUI();
        } else {
            alert("Critical Error: The scoring engine (scorer.js) did not load properly. Check your script tags or syntax.");
        }
    } catch(e) {
        console.error("Match Initialization Failed:", e);
        alert("Initialization Failed: " + e.message);
    }
}
