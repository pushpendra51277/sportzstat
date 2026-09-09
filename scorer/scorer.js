// ==========================================
// SUPABASE CLOUD DATABASE CONFIGURATION
// ==========================================
const SUPABASE_URL = "https://cavkoylkbcyhsifrsjyd.supabase.co";   // We will get this from your dashboard
const SUPABASE_KEY = "sb_publishable_wklRlSZbzArKFCq31Ugnrw_JWAJkS4K"; // We will get this from your dashboard

// FIX 2: Added window. prefix for proper initialization
const supabaseClient = (typeof window.supabase !== 'undefined' && SUPABASE_URL.includes("supabase.co")) 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) 
    : null;

// FIX 1: Removed hardcoded file:/// path, using relative path for deployment
const LIVE_VIEWER_URL = "./2.html";

if (typeof window.Chart !== 'undefined') { Chart.defaults.color = '#cbd5e1'; Chart.defaults.borderColor = '#334155'; } window.matchChart = null; 
const el = id => document.getElementById(id); const getBatTeam = () => state.teams[state.battingKey]; const getBowlTeam = () => state.teams[state.bowlingKey]; const formatOver = balls => Math.floor(balls/6) + "." + (balls%6); const getBadgeHtml = b => b.type === 'divider' ? `<span class="over-divider">/</span>` : `<div class="ball-badge ball-${b.type}">${b.label}</div>`;
const calcMins = (inT, outT, brk = 0) => { if(!inT) return "-"; try { let endT = outT || new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); let d1 = new Date("01/01/2000 " + inT), d2 = new Date("01/01/2000 " + endT); if(d2 < d1) d2.setDate(d2.getDate() + 1); let mins = Math.round((d2 - d1) / 60000) - brk; if (mins < 0) mins = 0; return isNaN(mins) ? "-" : mins + "m"; } catch(e) { return "-"; } };
const skillPermutations = ["Right Hand Batter", "Left Hand Batter", "Right Hand Batter / WK", "Left Hand Batter / WK", "RHB / Right Arm Medium Pacer", "RHB / Right Arm Off Break", "RHB / Right Arm Leg Break", "LHB / Right Arm Medium Pacer", "LHB / Right Arm Off Break", "LHB / Right Arm Leg Break", "RHB / Left Arm Medium Pacer", "RHB / Slow Left Arm Orthodox", "RHB / Left Arm Unorthodox", "LHB / Left Arm Medium Pacer", "LHB / Slow Left Orthodox", "LHB / Left Arm Unorthodox", "Right Arm Medium Pacer", "Right Arm Off Break", "Right Arm Leg Break", "Left Arm Medium Pacer", "Slow Left Arm Orthodox", "Left Arm Unorthodox"];

function getEffectiveBalls(cur) {
    let effective = 0; let prevActual = 0;
    for (let i = 0; i < cur.overHistory.length; i++) {
        let actualBallsInOver = cur.overHistory[i].totalBallsAtEnd - prevActual;
        if (cur.overHistory[i].isPartialTerminal) { effective += actualBallsInOver; } else { effective += 6; }
        prevActual = cur.overHistory[i].totalBallsAtEnd;
    }
    let currentOverBalls = Math.max(0, cur.balls - prevActual);
    effective += currentOverBalls; return effective;
}

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

let state = { matchId: "", inningsNum: 1, battingKey: 'A', bowlingKey: 'B', matchResult: "", matchSettings: { matchType: 't20', category: 'men', maxOvers: 20, originalMaxOvers: 20, customTarget: null, customTargetOvers: null, targetMethod: "", bowlerQuota: 4, matchSelectors: [] }, teams: { A: { name: "", players: [], pendingPenalties: 0 }, B: { name: "", players: [], pendingPenalties: 0 } }, current: { runs:0, wkts:0, balls:0, sIdx:null, nsIdx:null, bIdx:null, isFreeHit: false, penalties: 0, lastOverBowlers: new Set(), extras: {w:0, nb:0, b:0, lb:0}, recentBalls: [], currentOverLog: [], runsInThisOver: 0, bowlersInCurrentOver: new Set(), overHistory: [], currPartnership: { runs: 0, balls: 0 }, fow: [], activeBreak: null, activeBreakStartTime: null, activeBreakInsp: null, pendingBreakMins: 0, inningsStartTime: null, inningsEndTime: null, allowances: 0 }, inningsSummaries: [], matchBreaks: [] };
let modalContext = {}, stateHistory = [], remarkLog = [];
let playerRegistry = JSON.parse(localStorage.getItem('cricStatRegistry')) || {}; let teamRegistry = JSON.parse(localStorage.getItem('cricStatTeamRegistry')) || {};

window.onload = function() {
    initTeamDatalist();
    let savedMatch = localStorage.getItem('cricStat_activeMatch');
    if(savedMatch) {
        showModal("Resume Match?", "An unfinished match was found. Would you like to resume it from where you left off?", function() {
            try {
                let parsedState = JSON.parse(savedMatch); parsedState.current.lastOverBowlers = new Set(parsedState.current.lastOverBowlers); parsedState.current.bowlersInCurrentOver = new Set(parsedState.current.bowlersInCurrentOver); state = parsedState;
                el('setupView').classList.add('hidden'); el('scoringView').classList.remove('hidden'); el('displayTournament').innerText = el('setupTournament').value || "MATCH IN PROGRESS"; el('dispGroundName').innerText = el('setupVenue').value || "Unknown Ground"; 
                if (state.matchSettings.matchType === 'multiday') { el('breakBtn').classList.remove('hidden'); }
                updateUI(); closeModal();
            } catch(e) { console.error("Corrupted local state.", e); hardResetSystem(); }
        }, false, "360px", "Resume");
        el('modalCancelBtn').innerText = "Start Fresh"; el('modalCancelBtn').onclick = function() { localStorage.removeItem('cricStat_activeMatch'); closeModal(); };
    }
};

function hardResetSystem() { if(confirm("WARNING: This will wipe ongoing match data from memory. Continue?")) { localStorage.removeItem('cricStat_activeMatch'); location.reload(); } }
function generateMatchId() { let d = el('setupDate').value; if (!d) { el('setupMatchId').value = ''; return; } let dateStr = d.replace(/-/g, ''), randStr = Math.random().toString(36).substring(2, 7).toUpperCase(); el('setupMatchId').value = dateStr + "-" + randStr; }
function toggleFullScreen() { let fsBtn = el('fsBtn'); if (!document.fullscreenElement) { document.documentElement.requestFullscreen().then(() => { fsBtn.innerText = '🔳 EXIT FULL SCREEN'; }).catch(err => alert("Fullscreen not supported.")); } else { if (document.exitFullscreen) { document.exitFullscreen().then(() => { fsBtn.innerText = '🔲 FULL'; }); } } }
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { el('fsBtn').innerText = '🔲 FULL'; } });

function initTeamDatalist() { let opts = ''; for (let teamName in teamRegistry) { opts += `<option value="${teamName}">`; } el('savedTeamsList').innerHTML = opts; }
function updMatchSel() { let c = parseInt(el('selCount').value) || 0; for(let i=1; i<=8; i++) { let grp = el(`sel-grp-${i}`); if(grp) grp.classList.toggle('hidden', i > c); } }

function renderRoster(targetId, prefix) { 
    let html = `<tr><th>#</th><th>Reg No</th><th>Name</th><th>Role</th><th>Designation</th></tr><tr style="background:rgba(59,130,246,0.1)"><td colspan="5"><div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;"><div class="input-group"><label style="color:var(--primary); font-size:0.6rem;">HEAD COACH</label><input id="${prefix}-HEAD COACH" class="w-100"></div><div class="input-group"><label style="color:var(--primary); font-size:0.6rem;">MANAGER</label><input id="${prefix}-MANAGER" class="w-100"></div><div class="input-group"><label style="color:var(--primary); font-size:0.6rem;">TRAINER</label><input id="${prefix}-TRAINER" class="w-100"></div></div></td></tr>`;
    let sOpt = skillPermutations.map(o => `<option>${o}</option>`).join(''); 
    for(let i=1; i<=19; i++) { if(i===12) html += `<tr><td colspan="5" class="sub-divider">RESERVES (12-19)</td></tr>`; html += `<tr><td class="text-muted font-bold" style="font-size:0.7rem;">P${i}</td><td><input id="${prefix}-reg-${i}" placeholder="Reg No" onchange="autoFillPlayer(this, '${prefix}', ${i}, 'reg')"></td><td><input id="${prefix}-n-${i}" placeholder="Name" onchange="autoFillPlayer(this, '${prefix}', ${i}, 'name')"></td><td><select id="${prefix}-skill-${i}">${sOpt}</select></td><td><select id="${prefix}-d-${i}"><option value="">-</option><option>C</option><option>VC</option></select></td></tr>`; } 
    el(targetId).innerHTML = html; 
}
renderRoster('rosterA', 'ta'); renderRoster('rosterB', 'tb'); 

function loadTeamRoster(tKey, tName) { 
    tName = tName.trim(); if (teamRegistry[tName]) { let pfx = tKey === 'A' ? 'ta' : 'tb', tData = teamRegistry[tName]; el(`${pfx}-HEAD COACH`).value = tData.coach || ''; el(`${pfx}-MANAGER`).value = tData.manager || ''; el(`${pfx}-TRAINER`).value = tData.trainer || ''; for(let i=0; i<19; i++) { if(tData.players[i]) { el(`${pfx}-reg-${i+1}`).value = tData.players[i].reg || ''; el(`${pfx}-n-${i+1}`).value = tData.players[i].n || ''; el(`${pfx}-skill-${i+1}`).value = tData.players[i].s || skillPermutations[0]; el(`${pfx}-d-${i+1}`).value = tData.players[i].d || ''; } } } 
}

function autoFillPlayer(elem, prefix, index, type) { 
    let val = elem.value.trim(); if (!val) return; let regInput = el(`${prefix}-reg-${index}`), nameInput = el(`${prefix}-n-${index}`); 
    if (type === 'reg') { let foundName = playerRegistry["REG_" + val]; if (foundName && !nameInput.value) nameInput.value = foundName; else if (nameInput.value) { playerRegistry["REG_" + val] = nameInput.value.trim(); playerRegistry["NAME_" + nameInput.value.trim()] = val; localStorage.setItem('cricStatRegistry', JSON.stringify(playerRegistry)); } } else if (type === 'name') { let foundReg = playerRegistry["NAME_" + val]; if (foundReg && !regInput.value) regInput.value = foundReg; else if (regInput.value) { playerRegistry["NAME_" + val] = regInput.value.trim(); playerRegistry["REG_" + regInput.value.trim()] = val; localStorage.setItem('cricStatRegistry', JSON.stringify(playerRegistry)); } } 
}

// --- MANUAL DATA ENTRY SYSTEM ---
function openManualEntryView() { el('setupView').classList.add('hidden'); el('manualEntryView').classList.remove('hidden'); let md = el('setupDate').value; if(md) el('meDate').value = md; el('meTourn').value = el('setupTournament').value; let mT = el('nameTeamA').value; if(mT) el('meTeamA').value = mT; let mB = el('nameTeamB').value; if(mB) el('meTeamB').value = mB; }
function closeManualEntryView() { el('manualEntryView').classList.add('hidden'); el('setupView').classList.remove('hidden'); }
function fixOversInput(inp) { let v = parseFloat(inp.value); if(isNaN(v)) return; let f = Math.floor(v); let d = Math.round((v - f) * 10); if (d >= 6) { f += Math.floor(d / 6); d = d % 6; inp.value = f + (d > 0 ? d / 10 : 0); } }

function generateManualGrids() {
    let tA = el('meTeamA').value.trim() || "Team A"; let tB = el('meTeamB').value.trim() || "Team B"; el('meTitleA').innerText = tA + " Stats"; el('meTitleB').innerText = tB + " Stats";
    function buildGridRows(teamName) { let tData = teamRegistry[teamName]; let rows = `<tr><th>Player Name</th><th>Reg No</th><th title="Not Out">NO*</th><th title="Runs">R</th><th title="Balls">B</th><th>4s</th><th>6s</th><th title="Overs (e.g. 2.3)">Ov</th><th title="Maidens">M</th><th title="Runs Conceded">R(Bwl)</th><th title="Wickets">W</th><th title="Wides Bowled">Wd</th><th title="No Balls Bowled">NB</th><th title="Catches Taken">Ct</th><th title="Stumpings Made">St</th><th title="Run Outs Effected">RO</th></tr>`; for(let i=0; i<15; i++) { let pName = "", pReg = ""; if(tData && tData.players[i]) { pName = tData.players[i].n || ""; pReg = tData.players[i].reg || ""; } let pfx = (teamName===tA ? "mea" : "meb") + "-" + i; rows += `<tr><td><input type="text" id="${pfx}-name" value="${pName}" placeholder="Player ${i+1}" style="width:120px;"></td><td><input type="text" id="${pfx}-reg" value="${pReg}" placeholder="Reg No" style="width:60px;"></td><td style="text-align:center;"><input type="checkbox" id="${pfx}-no" style="width:16px;height:16px; cursor:pointer;" title="Check if Not Out"></td><td><input type="number" id="${pfx}-r" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-b" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-4s" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-6s" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-o" class="m-input-num" min="0" step="0.1" onblur="fixOversInput(this)"></td><td><input type="number" id="${pfx}-m" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-br" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-w" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-wd" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-nb" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-ct" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-st" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-ro" class="m-input-num" min="0"></td></tr>`; } return rows; }
    el('meGridA').innerHTML = buildGridRows(tA); el('meGridB').innerHTML = buildGridRows(tB); el('meNoGridsBtn').classList.add('hidden'); el('meGridsContainer').classList.remove('hidden');
}

// FIX 3: Fully wired up the Manual Sync Function to log to your completed_matches table
async function syncManualMatchData() { 
    if (!supabaseClient) {
        alert("Supabase is not connected! Please verify your keys.");
        return;
    }
    
    let manualMatchId = el('meId').value || "MANUAL-" + Date.now();
    let manualDataStr = JSON.stringify({
        isManualSync: true,
        date: el('meDate').value,
        tournament: el('meTourn').value,
        teamA: el('meTeamA').value,
        teamB: el('meTeamB').value
    });

    try {
        const { error } = await supabaseClient.from('completed_matches').upsert(
            { match_id: manualMatchId, final_data: manualDataStr }, 
            { onConflict: 'match_id' }
        );
        if (error) throw error;
        alert("Success! Manual match data has been synced to Supabase.");
    } catch(e) {
        alert("Failed to sync: " + e.message);
    }
}

function saveState() { try { stateHistory.push(JSON.stringify(state, (key, value) => value instanceof Set ? [...value] : value)); if (stateHistory.length > 300) stateHistory.shift(); } catch(e) { console.warn("State save failed"); } }
function undoLastAction() { if (stateHistory.length > 0) { let prevState = JSON.parse(stateHistory.pop()); prevState.current.lastOverBowlers = new Set(prevState.current.lastOverBowlers); prevState.current.bowlersInCurrentOver = new Set(prevState.current.bowlersInCurrentOver); state = prevState; updateUI(); } else { alert("Nothing to undo!"); } }
function syncMetadataToHistory(syncPlayingXI) { stateHistory = stateHistory.map(hStr => { let h = JSON.parse(hStr); ['A', 'B'].forEach(t => { for(let i=0; i<19; i++) { h.teams[t].players[i].name = state.teams[t].players[i].name; h.teams[t].players[i].regNo = state.teams[t].players[i].regNo; h.teams[t].players[i].skill = state.teams[t].players[i].skill; if (syncPlayingXI) { h.teams[t].players[i].isPlayingXI = state.teams[t].players[i].isPlayingXI; } } }); return JSON.stringify(h, (k, v) => v instanceof Set ? [...v] : v); }); }

function openRemarkModal() { 
    let cur = state.current, s = cur.sIdx !== null ? getBatTeam().players[cur.sIdx].name : "N/A", ns = cur.nsIdx !== null ? getBatTeam().players[cur.nsIdx].name : "N/A", b = cur.bIdx !== null ? getBowlTeam().players[cur.bIdx].name : "N/A";
    let fOpts = `<option value="">-- No Fielder / N/A --</option>`; getBowlTeam().players.forEach(p => { if(p.name) fOpts += `<option value="${p.name}">${p.name}</option>`; }); 
    let remarkHtml = `<div class="mb-10 text-muted" style="font-size:0.8rem;">Over: <b class="text-accent">${formatOver(cur.balls)}</b> | Local Time: <b class="text-accent">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</b></div><div class="mb-10" style="font-size:0.85rem; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px;"><span class="text-primary font-bold">Striker:</span> ${s}<br><span class="text-primary font-bold">Non-Striker:</span> ${ns}<br><span class="text-primary font-bold">Bowler:</span> ${b}</div><label class="text-primary mt-10">Fielder Involved (Optional)</label><select id="remFielder" class="modal-input w-100">${fOpts}</select><label class="text-primary mt-10">Remark / Incident</label><input type="text" id="remText" class="modal-input w-100" placeholder="e.g., Warning...">`;
    showModal("📝 Match Remark", remarkHtml, () => { let txt = el('remText').value.trim(); if(!txt) return; remarkLog.push({ over: formatOver(cur.balls), time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), batters: `${s} / ${ns}`, bowler: b, fielder: el('remFielder').value || "-", remark: txt }); closeModal(); }); 
}

function updateTeamNames() { el('tossWinner').options[0].text = el('nameTeamA').value || "Team A"; el('tossWinner').options[1].text = el('nameTeamB').value || "Team B"; }
function toggleTeam(t) { el('boxA').classList.toggle('hidden', t === 'B'); el('boxB').classList.toggle('hidden', t === 'A'); el('nameTeamA').classList.toggle('active', t === 'A'); el('nameTeamB').classList.toggle('active', t === 'B'); }

function openEditTarget() {
    if (state.inningsNum === 1) { alert("Target can only be edited in the 2nd innings!"); return; }
    let curT = state.matchSettings.customTarget || (state.inningsSummaries[state.inningsNum - 2].runs + 1), curO = state.matchSettings.customTargetOvers || state.matchSettings.originalMaxOvers, curM = state.matchSettings.targetMethod || "";
    let html = `<label class="text-primary">Revised Target Runs</label><input type="number" id="modTargetRuns" class="modal-input w-100" value="${curT}"><label class="text-primary mt-10">Revised Max Overs</label><input type="number" id="modTargetOvers" class="modal-input w-100" value="${curO}" step="0.1"><label class="text-primary mt-10">Method (e.g. VJD, DLS, or leave blank)</label><input type="text" id="modTargetMethod" class="modal-input w-100" value="${curM}" placeholder="VJD"><button type="button" class="btn-action w-100 mt-15" style="background:#475569;" onclick="clearCustomTarget()">Reset to Original Target</button>`;
    showModal("🎯 Edit Match Target", html, () => { saveState(); state.matchSettings.customTarget = parseInt(el('modTargetRuns').value) || null; state.matchSettings.customTargetOvers = parseFloat(el('modTargetOvers').value) || null; state.matchSettings.targetMethod = el('modTargetMethod').value.trim().toUpperCase(); if (state.matchSettings.customTargetOvers) { state.matchSettings.maxOvers = state.matchSettings.customTargetOvers; } closeModal(); updateUI(); });
}

function clearCustomTarget() { saveState(); state.matchSettings.customTarget = null; state.matchSettings.customTargetOvers = null; state.matchSettings.targetMethod = ""; state.matchSettings.maxOvers = state.matchSettings.originalMaxOvers; closeModal(); updateUI(); }
function getTargetBalls() { let ov = state.matchSettings.maxOvers; let f = Math.floor(ov); let r = Math.round((ov - f) * 10); return f * 6 + r; }

function confirmStart() { showModal("🏏 Ready to call 'Play'?", `<div class="text-center mt-10"><p style="font-size:1.1rem; color:var(--text); font-weight:bold;">Bowler ready? Batter ready? Umpires ready?</p></div>`, () => { closeModal(); setTimeout(() => { executeLockAndStart(); }, 150); }, false, "400px", "✅ Let's play"); }

function executeLockAndStart() {
    let mT = el('setupMatchType').value; state.matchSettings.matchType = mT; state.matchSettings.category = el('setupCategory').value;
    if(mT === 't20') { state.matchSettings.maxOvers = 20; state.matchSettings.bowlerQuota = 4; state.matchSettings.maxInnings = 2; } else if(mT === 'oneday') { state.matchSettings.maxOvers = 50; state.matchSettings.bowlerQuota = 10; state.matchSettings.maxInnings = 2; } else { state.matchSettings.maxOvers = 999; state.matchSettings.bowlerQuota = 999; state.matchSettings.maxInnings = 4; }
    state.matchSettings.originalMaxOvers = state.matchSettings.maxOvers; if (mT === 'multiday') { el('breakBtn').classList.remove('hidden'); }
    let setupDateVal = el('setupDate').value; if(!el('setupMatchId').value) { let dateStr = setupDateVal ? setupDateVal.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, ''); let randStr = Math.random().toString(36).substring(2, 7).toUpperCase(); el('setupMatchId').value = dateStr + "-" + randStr; }
    state.matchId = el('setupMatchId').value;
    
    let mSelCount = parseInt(el('selCount').value) || 0; let matchSelectors = []; for(let i=1; i<=mSelCount; i++) { let sN = el(`msel-${i}`).value.trim(); if(sN) matchSelectors.push(sN); } state.matchSettings.matchSelectors = matchSelectors;
    state.teams.A.name = el('nameTeamA').value || "Team A"; state.teams.B.name = el('nameTeamB').value || "Team B";
    
    ['A', 'B'].forEach(tKey => { 
        let teamObj = tKey === 'A' ? state.teams.A : state.teams.B; teamObj.players = []; teamObj.pendingPenalties = 0; let pfx = tKey === 'A' ? 'ta' : 'tb'; let teamNameStr = teamObj.name.trim(); 
        let tData = { manager: el(`${pfx}-MANAGER`).value, coach: el(`${pfx}-HEAD COACH`).value, trainer: el(`${pfx}-TRAINER`).value, players: [] };
        for(let i=1; i<=19; i++) { let pReg = el(`${pfx}-reg-${i}`).value.trim(), pName = el(`${pfx}-n-${i}`).value.trim() || (pReg ? "" : `Player ${i}`), pSkill = el(`${pfx}-skill-${i}`).value, pDesig = el(`${pfx}-d-${i}`).value; teamObj.players.push({ regNo: pReg, name: pName, desig: pDesig, r:0, b:0, f:0, s:0, out:false, outOnDuck:0, hasBatted: false, dismissalInfo: "", o:0, rc:0, w:0, m:0, ex:0, wd:0, nb:0, byes:0, legbyes:0, cw:0, catches:0, stumpings:0, runouts:0, quotaOvers: 0, inTime: null, outTime: null, isPlayingXI: i <= 11, skill: pSkill, breakMins: 0 }); tData.players.push({ reg: pReg, n: pName, s: pSkill, d: pDesig }); }
        if(teamNameStr) { teamRegistry[teamNameStr] = tData; localStorage.setItem('cricStatTeamRegistry', JSON.stringify(teamRegistry)); }
    });

    let win = el('tossWinner').value, dec = el('tossDecision').value; state.battingKey = ((win === 'A' && dec === 'bat') || (win === 'B' && dec === 'bowl')) ? 'A' : 'B'; state.bowlingKey = state.battingKey === 'A' ? 'B' : 'A';
    el('displayTournament').innerText = el('setupTournament').value || "MATCH IN PROGRESS"; el('dispGroundName').innerText = el('setupVenue').value || "Unknown Ground"; 
    el('setupView').classList.add('hidden'); el('scoringView').classList.remove('hidden'); updateUI(); setTimeout(() => { openMatchStartModal(); }, 200);
}

function openMatchStartModal() {
    let bI = []; getBatTeam().players.forEach((p, i) => { if(p.isPlayingXI) bI.push(i); });
    
    // FIX 4: Safety check to prevent app crash if no playing 11 are selected
    if (bI.length < 2) {
        alert("Please ensure at least 2 players are selected in the Playing XI via the Edit Squad menu before starting.");
        return;
    }

    let sO = getBatTeam().players.map((p, i) => p.isPlayingXI ? `<option value="${i}" ${i===bI[0]?'selected':''}>${p.name}</option>` : '').join('');
    let nsO = getBatTeam().players.map((p, i) => p.isPlayingXI ? `<option value="${i}" ${i===bI[1]?'selected':''}>${p.name}</option>` : '').join('');
    let bowlOpts = getBowlTeam().players.map((p, i) => p.isPlayingXI ? `<option value="${i}">${p.name}</option>` : '').join('');
    let html = `<div class="modal-grid-3 mt-10"><div class="modal-player-card"><label class="text-success mb-5">🏏 STRIKER</label><select id="sStr">${sO}</select></div><div class="modal-player-card"><label class="text-success mb-5">🏃 NON-STRIKER</label><select id="sNStr">${nsO}</select></div><div class="modal-player-card"><label class="text-danger mb-5">⚾ BOWLER</label><select id="sBwl">${bowlOpts}</select></div></div><div id="startError" class="text-danger font-bold text-center mt-15"></div>`;
    showModal(`INNINGS ${state.inningsNum} SETUP`, html, () => { let s1 = parseInt(el('sStr').value), s2 = parseInt(el('sNStr').value), b1 = parseInt(el('sBwl').value); if (s1 === s2) { el('startError').innerText = "🚨 Striker and Non-Striker must be different players!"; return; } saveState(); state.current.sIdx = s1; state.current.nsIdx = s2; state.current.bIdx = b1; getBatTeam().players[s1].hasBatted = true; getBatTeam().players[s2].hasBatted = true; state.current.bowlersInCurrentOver.add(b1); state.current.currPartnership = { runs: 0, balls: 0 }; state.current.inningsStartTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); closeModal(); updateUI(); }, false, "750px", "Start Innings"); 
}

function openBreakModal() {
    let html = `<label class="text-primary">Select Interval Type</label><select id="brkType" class="modal-input w-100"><option value="Luncheon Break">Luncheon Break</option><option value="Tea Break">Tea Break</option><option value="Day End / Stumps">Day End / Stumps</option><option value="Innings Break">Innings Break</option><option value="Drinks Break">Drinks Break</option><option value="Other Scheduled Interval">Other Scheduled Interval</option></select><label class="text-primary mt-10">Start Time</label>${getTimeDropdownsHtml('brkStart')}`;
    showModal("Scheduled Break", html, startScheduledBreak, false, "360px", "Log Break");
}

function startScheduledBreak() { saveState(); let type = el('brkType').value, sT = parseTimeDropdowns('brkStart'); state.current.activeBreak = type; state.current.activeBreakStartTime = sT; state.current.activeBreakInsp = null; closeModal(); updateUI(); }
function openInterruptionModal() { let html = `<label class="text-primary">Select Reason for Delay</label><select id="intType" class="modal-input w-100"><option value="Bad Weather / Rain">Bad Weather / Rain</option><option value="Bad Light">Bad Light</option><option value="Unfit Ground Conditions">Unfit Ground Conditions</option><option value="Medical Emergency">Medical Emergency</option><option value="Other Interruption">Other Interruption</option></select><label class="text-primary mt-10">Start Time</label>${getTimeDropdownsHtml('intStart')}<label class="text-primary mt-10">Next Inspection At (Optional)</label>${getTimeDropdownsHtml('intInsp', true)}`; showModal("Match Interruption", html, startInterruption, false); }
function startInterruption() { saveState(); let type = el('intType').value, sT = parseTimeDropdowns('intStart'), nI = parseTimeDropdowns('intInsp'); state.current.activeBreak = type; state.current.activeBreakStartTime = sT; state.current.activeBreakInsp = nI; closeModal(); updateUI(); }
function openResumeModal() { let html = `<label class="text-primary">Interruption Started At</label><input type="text" class="modal-input w-100" value="${state.current.activeBreakStartTime}" disabled><label class="text-primary mt-10">Select Resume Time</label>${getTimeDropdownsHtml('intEnd')}`; showModal("End Interruption", html, endInterruption, false, "360px", "Resume Play"); }

function endInterruption() {
    let eT = parseTimeDropdowns('intEnd'), sT = state.current.activeBreakStartTime, dur = calculateDurationMins(sT, eT);
    if(state.current.sIdx !== null) getBatTeam().players[state.current.sIdx].breakMins += dur; if(state.current.nsIdx !== null) getBatTeam().players[state.current.nsIdx].breakMins += dur;
    state.matchBreaks.push({ inn: state.inningsNum, type: state.current.activeBreak, start: sT, end: eT, dur: dur });
    let remarkStr = `${state.current.activeBreak}: ${sT} to ${eT} (Lost: ${dur}m)`; if(state.current.activeBreakInsp) remarkStr += ` [Insp: ${state.current.activeBreakInsp}]`;
    remarkLog.push({ over: formatOver(state.current.balls), time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), batters: "-", bowler: "-", fielder: "-", remark: remarkStr });
    state.current.activeBreak = null; state.current.activeBreakStartTime = null; state.current.activeBreakInsp = null; closeModal(); updateUI();
}

function markOpenerTimes() { if (state.current.sIdx !== null && state.current.nsIdx !== null) { let now = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); if (!getBatTeam().players[state.current.sIdx].inTime) getBatTeam().players[state.current.sIdx].inTime = now; if (!getBatTeam().players[state.current.nsIdx].inTime) getBatTeam().players[state.current.nsIdx].inTime = now; } }

function checkTargetReached() { 
    if (state.matchSettings.customTarget && state.current.runs >= state.matchSettings.customTarget) return true;
    if (state.matchSettings.matchType === 'multiday') { let bowlTeamInns = state.inningsSummaries.filter(i => i.batTeam === getBowlTeam().name).length; if(bowlTeamInns === 2) { let batTotal = state.current.runs + state.inningsSummaries.filter(i=>i.batTeam===getBatTeam().name).reduce((a,b)=>a+b.runs,0); let bowlTotal = state.inningsSummaries.filter(i=>i.batTeam===getBowlTeam().name).reduce((a,b)=>a+b.runs,0); if(batTotal > bowlTotal) return true; } return false; } 
    else { if (state.inningsNum % 2 === 0) { let targetToWin = state.matchSettings.customTarget || (state.inningsSummaries[state.inningsNum - 2].runs + 1); if (state.current.runs >= targetToWin) return true; } return false; }
}

function finalizeOver(isPartialTerminal = false) { 
    let cur = state.current; let prevBalls = cur.overHistory.length > 0 ? cur.overHistory[cur.overHistory.length - 1].totalBallsAtEnd : 0; let ballsThisOver = cur.balls - prevBalls; let isPartial = isPartialTerminal && ballsThisOver > 0 && ballsThisOver < 6;
    cur.bowlersInCurrentOver.forEach(i => { getBowlTeam().players[i].quotaOvers += 1; if(cur.runsInThisOver === 0 && i === cur.bIdx && !isPartial) getBowlTeam().players[i].m++; }); 
    cur.overHistory.push({ over: cur.overHistory.length + 1, runs: cur.runs, wkts: cur.wkts, totalBallsAtEnd: cur.balls, isPartialTerminal: isPartial }); 
    cur.lastOverBowlers = new Set(cur.bowlersInCurrentOver); cur.runsInThisOver = 0; cur.bowlersInCurrentOver.clear(); cur.recentBalls.push(...cur.currentOverLog, {label: '/', type: 'divider'}); if(cur.recentBalls.length > 14) cur.recentBalls = cur.recentBalls.slice(-14); cur.currentOverLog = []; 
}


// ==========================================
// SUPABASE: CLOUD SYNC & BALL LOGGING ENGINE
// ==========================================

async function triggerCloudSync() {
    if (!supabaseClient || !state.matchId) return;
    let cur = state.current; let effBalls = getEffectiveBalls(cur); let crrVal = effBalls > 0 ? ((cur.runs / effBalls) * 6).toFixed(2) : "0.00";
    let lightWeightLiveData = { matchId: state.matchId, batTeam: getBatTeam() ? getBatTeam().name : "", bowlTeam: getBowlTeam() ? getBowlTeam().name : "", runs: cur.runs, wkts: cur.wkts, overs: formatOver(cur.balls), crr: crrVal, target: el('dispTargetText') ? el('dispTargetText').innerText : "", batters: [ cur.sIdx !== null ? { name: getBatTeam().players[cur.sIdx].name, r: getBatTeam().players[cur.sIdx].r, b: getBatTeam().players[cur.sIdx].b, isStriker: true } : null, cur.nsIdx !== null ? { name: getBatTeam().players[cur.nsIdx].name, r: getBatTeam().players[cur.nsIdx].r, b: getBatTeam().players[cur.nsIdx].b, isStriker: false } : null ], bowler: cur.bIdx !== null ? { name: getBowlTeam().players[cur.bIdx].name, o: formatOver(getBowlTeam().players[cur.bIdx].o), r: getBowlTeam().players[cur.bIdx].rc, w: getBowlTeam().players[cur.bIdx].w } : null, recentBalls: cur.recentBalls };
    
    try {
        const { error } = await supabaseClient.from('live_matches').upsert({ match_id: state.matchId, live_data: lightWeightLiveData }, { onConflict: 'match_id' });
        if (error) console.error("Cloud sync error: ", error);
    } catch(e) {}
}

async function logBallEvent(batterObj, bowlerObj, runsBat, runsExtra, extraType, isWicket, wicketType, dismissedObj) {
    if (!supabaseClient || !state.matchId) return;
    
    // We are temporarily logging Names and Reg numbers until the backend Team tables are built
    let ballData = {
        match_id: state.matchId,
        innings_no: state.inningsNum,
        over_no: Math.floor(state.current.balls / 6),
        ball_no: (state.current.balls % 6) + 1,
        batter_name: batterObj ? batterObj.name : "Unknown",
        bowler_name: bowlerObj ? bowlerObj.name : "Unknown",
        runs_batter: runsBat,
        runs_extra: runsExtra,
        is_valid_ball: (extraType !== 'Wide' && extraType !== 'No-Ball'),
        extra_type: extraType,
        is_wicket: isWicket,
        wicket_type: wicketType || null,
        dismissed_player_name: dismissedObj ? dismissedObj.name : null
    };

    try {
        // Fire and forget (does not block the UI)
        supabaseClient.from('ball_by_ball').insert([ballData]).then(({error}) => {
            if(error) console.warn("Supabase Ball log error:", error);
        });
    } catch(e) {}
}

async function logCareerStats() {
    if (!supabaseClient || !state.matchId) return;
    let payloadStr = JSON.stringify(state.inningsSummaries);
    try {
        await supabaseClient.from('completed_matches').upsert({ match_id: state.matchId, final_data: payloadStr }, { onConflict: 'match_id' });
    } catch (e) {}
}

// ==========================================


function ballScored(runs, isB) {
    saveState(); markOpenerTimes(); let cur = state.current; if(cur.bIdx === null) return openSelector('bowler', "Select Bowler");
    cur.bowlersInCurrentOver.add(cur.bIdx); let s = getBatTeam().players[cur.sIdx], b = getBowlTeam().players[cur.bIdx];
    b.cw = 0; s.r += runs; s.b++; if(isB) { runs === 4 ? s.f++ : s.s++; } 
    b.rc += runs; b.o++; cur.runs += runs; cur.runsInThisOver += runs; cur.balls++; cur.currPartnership.runs += runs; cur.currPartnership.balls++; 
    cur.currentOverLog.push({label: runs.toString(), type: isB ? (runs === 4 ? 'four' : 'six') : 'normal'}); cur.isFreeHit = false;
    
    logBallEvent(s, b, runs, 0, 'None', false, null, null); // Supabase Hook

    if(runs % 2 !== 0) manualRotate(); 
    if (checkTargetReached()) { finalizeOver(true); setTimeout(endInnings, 100); return; }
    updateUI(); checkAutoOverPrompt();
}

function openManualRun() { showModal("Manual Runs", `<label class="text-primary">Enter Runs Scored</label><input type="number" id="mRunVal" value="5" min="0" class="modal-input w-100">`, () => { let r = parseInt(el('mRunVal').value) || 0; closeModal(); ballScored(r, false); }); }

function openExtra(type) { 
    if(state.current.bIdx === null) return openSelector('bowler', "Select Bowler"); 
    modalContext = { action: 'extra', type: type }; let defVal = (type === 'B' || type === 'LB') ? 1 : 0; 
    let html = `<label class="text-primary">Extra Runs:</label><input type="number" id="exR" value="${defVal}" class="modal-input w-100">`; if(type === 'NB') { html += `<select id="nbT" class="modal-input w-100 mt-5"><option value="bat">Off the Bat</option><option value="bye">Byes</option><option value="legbye">Leg Byes</option></select>`; }
    showModal(`${type === 'W' ? 'WIDE' : (type === 'NB' ? 'NO BALL' : type)} Entry`, html, processExtraSubmit); 
}

function processExtraSubmit() {
    saveState(); markOpenerTimes(); let cur = state.current, ex = parseInt(el('exR').value) || 0, b = getBowlTeam().players[cur.bIdx], s = getBatTeam().players[cur.sIdx], typ = modalContext.type, lbl = ''; cur.bowlersInCurrentOver.add(cur.bIdx); 
    let runsBat = 0; let runsExt = 0; let exLabel = '';

    if(typ === 'W') { 
        let t = ex + 1; cur.runs += t; cur.runsInThisOver += t; cur.currPartnership.runs += t; b.rc += t; b.wd += t; cur.extras.w += t; lbl = t + 'wd'; 
        runsExt = t; exLabel = 'Wide';
    } 
    else if (typ === 'NB') { 
        let nt = el('nbT').value; cur.runs += 1; cur.extras.nb += 1; b.rc += 1; b.nb += 1; cur.runsInThisOver += 1; cur.currPartnership.runs += (1 + ex); 
        runsExt = 1; exLabel = 'No-Ball';
        if(nt === 'bat' && ex > 0) { s.r += ex; b.rc += ex; cur.runs += ex; cur.runsInThisOver += ex; runsBat = ex; } 
        else if (ex > 0) { cur.runs += ex; runsExt += ex; if (nt === 'bye') { cur.extras.b += ex; b.byes += ex; } else { cur.extras.lb += ex; b.legbyes += ex; } } 
        lbl = (ex + 1) + 'nb'; if (state.matchSettings.matchType !== 'multiday') cur.isFreeHit = true; s.b++; cur.currPartnership.balls++; 
    } 
    else { 
        lbl = ex + (typ === 'B' ? 'b' : 'lb'); cur.runs += ex; cur.balls++; b.o++; s.b++; cur.currPartnership.runs += ex; cur.currPartnership.balls++; runsExt = ex; exLabel = (typ === 'B' ? 'Bye' : 'Leg-Bye');
        if (typ === 'B') { cur.extras.b += ex; b.byes += ex; } else { cur.extras.lb += ex; b.legbyes += ex; } cur.isFreeHit = false; 
    }
    
    cur.currentOverLog.push({label: lbl, type: 'extra'}); 
    logBallEvent(s, b, runsBat, runsExt, exLabel, false, null, null); // Supabase Hook
    
    if(ex % 2 !== 0) manualRotate(); 
    if (checkTargetReached()) { finalizeOver(true); closeModal(); setTimeout(endInnings, 100); return; }
    closeModal(); updateUI(); checkAutoOverPrompt();
}

function openRetire() { if(state.current.bIdx === null) return openSelector('bowler', "Select Bowler"); showModal("🏃 Process Retire", `<label class="text-primary">Batter Out</label><select id="wWho" class="modal-input w-100"><option value="striker">Striker</option><option value="nonstriker">Non-Striker</option></select><label class="text-primary mt-5">Dismissal Type</label><select id="wType" class="modal-input w-100"><option value="RetiredHurt">Retired - Not Out</option><option value="RetiredOut">Retired - Out</option></select>`, processWicketSubmit); }

function openWicket() { 
    if(state.current.bIdx === null) return openSelector('bowler', "Select Bowler"); 
    let fOpts = `<option value="">-- Select Fielder (Sub) --</option>`; getBowlTeam().players.forEach(p => { if(p.name) fOpts += `<option value="${p.name}">${p.name}</option>`; });
    let html = `<label class="text-danger">Batter Out</label><select id="wWho" class="modal-input w-100" onchange="updWktOpts()"><option value="striker">Striker</option><option value="nonstriker">Non-Striker</option></select><label class="text-primary mt-5">Type of Delivery</label><select id="wExtra" class="modal-input w-100" onchange="updWktOpts()"><option value="none">Legal</option><option value="wide">Wide</option><option value="noball">No-ball</option></select><label class="text-danger mt-5">Dismissal Type</label><select id="wType" class="modal-input w-100" onchange="updWktFlds()"></select><select id="wFldr" class="modal-input w-100 hidden mt-5">${fOpts}</select><div id="wRunsBox" class="hidden mt-10" style="background:rgba(0,0,0,0.3); padding:10px; border-radius:6px; border:1px dashed var(--primary);"><label class="text-primary">Runs Completed Before Dismissal</label><input type="number" id="wRuns" class="modal-input w-100" value="0" min="0"><div id="wRunTypeWrap"><label class="text-primary mt-5">Runs Scored Via</label><select id="wRunType" class="modal-input w-100" style="margin-bottom:0;"><option value="bat">Off the Bat</option><option value="bye">Byes</option><option value="legbye">Leg Byes</option></select></div></div>`;
    showModal("🚨 Process Wicket", html, processWicketSubmit); setTimeout(() => { updWktOpts(); }, 10); 
}

function updWktOpts() { 
    if(!el('wWho') || !el('wType')) return;
    let who = el('wWho').value, wT = el('wType'), wEx = el('wExtra') ? el('wExtra').value : 'none', o = ''; if (wT.options.length > 0 && wT.options[0].value === 'RetiredHurt') return;
    let isFreeHitActive = state.current.isFreeHit || wEx === 'noball';
    if (isFreeHitActive) { if (who === 'striker') o = `<option value="RunOut">Run Out</option><option value="HitBallTwice">Hit the ball twice</option><option value="ObstructingField">Obstructing the field</option>`; else o = `<option value="RunOut">Run Out</option><option value="ObstructingField">Obstructing the field</option>`; } 
    else if (wEx === 'wide') { if (who === 'striker') o = `<option value="Stumped">Stumped</option><option value="RunOut">Run Out</option><option value="HitWicket">Hit Wicket</option><option value="TimedOut">Timed Out</option><option value="ObstructingField">Obstructing the field</option><option value="HitBallTwice">Hit the ball twice</option>`; else o = `<option value="RunOut">Run Out</option><option value="TimedOut">Timed Out</option><option value="ObstructingField">Obstructing the field</option>`; } 
    else { if (who === 'striker') o = `<option value="Bowled">Bowled</option><option value="Caught">Caught</option><option value="LBW">LBW</option><option value="RunOut">Run Out</option><option value="Stumped">Stumped</option><option value="HitWicket">Hit Wicket</option><option value="TimedOut">Timed Out</option><option value="ObstructingField">Obstructing the field</option><option value="HitBallTwice">Hit the ball twice</option>`; else o = `<option value="RunOut">Run Out</option><option value="TimedOut">Timed Out</option><option value="ObstructingField">Obstructing the field</option>`; }
    wT.innerHTML = o; updWktFlds(); 
}

function updWktFlds() { 
    if(!el('wType')) return; let t = el('wType').value, fldr = el('wFldr'), rBox = el('wRunsBox'), wEx = el('wExtra') ? el('wExtra').value : 'none';
    if (fldr) { if (['Caught', 'RunOut'].includes(t)) fldr.classList.remove('hidden'); else fldr.classList.add('hidden'); }
    if (rBox) { if (['RunOut', 'ObstructingField'].includes(t)) { rBox.classList.remove('hidden'); if (el('wRunTypeWrap')) el('wRunTypeWrap').classList.toggle('hidden', wEx === 'wide'); } else { rBox.classList.add('hidden'); } }
}

function processWicketSubmit() {
    saveState(); markOpenerTimes(); let cur = state.current, wWho = el('wWho').value, wType = el('wType').value, wFldr = el('wFldr') ? el('wFldr').value : "", extraType = el('wExtra') ? el('wExtra').value : 'none';
    let b = getBowlTeam().players[cur.bIdx], s = getBatTeam().players[cur.sIdx]; cur.bowlersInCurrentOver.add(cur.bIdx);
    let isSO = (wWho === 'striker'), outIdx = isSO ? cur.sIdx : cur.nsIdx, oB = getBatTeam().players[outIdx];

    if (wType === 'RetiredHurt' || wType === 'RetiredOut') { 
        if (wType === 'RetiredHurt') { oB.out = 'retiredHurt'; oB.dismissalInfo = "Retired Hurt (Not Out)"; } else { cur.wkts++; oB.out = true; oB.dismissalInfo = "Retired Out"; } 
        cur.currentOverLog.push({label: 'Ret', type: 'wicket'}); 
        logBallEvent(s, b, 0, 0, 'None', true, wType, oB); // Supabase Hook
    } 
    else {
        cur.wkts++; oB.out = true; 
        let runsScored = 0, runType = 'bat'; let runsExt = 0; let exLabel = 'None';
        
        // FIX 5: Safely parse Wicket Runs and handle NaN defaults
        if (['RunOut', 'ObstructingField'].includes(wType)) { 
            let runsInput = el('wRuns') ? el('wRuns').value : "0";
            runsScored = parseInt(runsInput, 10);
            if (isNaN(runsScored)) runsScored = 0; 
            runType = extraType === 'wide' ? 'wide' : (el('wRunType') ? el('wRunType').value : 'bat'); 
        }
        
        if (extraType === 'wide') { cur.runs += 1; cur.runsInThisOver += 1; cur.extras.w += 1; b.rc += 1; b.wd += 1; runsExt += 1; exLabel = 'Wide'; } else if (extraType === 'noball') { cur.runs += 1; cur.runsInThisOver += 1; cur.extras.nb += 1; b.rc += 1; b.nb += 1; s.b++; cur.currPartnership.balls++; if (state.matchSettings.matchType !== 'multiday') cur.isFreeHit = true; runsExt += 1; exLabel = 'No-Ball'; } else if (wType !== 'TimedOut') { s.b++; cur.balls++; b.o++; cur.currPartnership.balls++; cur.isFreeHit = false; }
        
        let runsBat = 0;
        if (runsScored > 0) { cur.runs += runsScored; cur.runsInThisOver += runsScored; cur.currPartnership.runs += runsScored; if (extraType === 'wide') { cur.extras.w += runsScored; b.rc += runsScored; b.wd += runsScored; runsExt += runsScored; } else if (runType === 'bat') { s.r += runsScored; b.rc += runsScored; if (runsScored === 4) s.f++; if (runsScored === 6) s.s++; runsBat = runsScored; } else if (runType === 'bye') { cur.extras.b += runsScored; b.byes += runsScored; runsExt += runsScored; } else if (runType === 'legbye') { cur.extras.lb += runsScored; b.legbyes += runsScored; runsExt += runsScored; } }
        
        if(['Bowled', 'Caught', 'LBW', 'Stumped', 'HitWicket'].includes(wType)) { b.w++; b.cw = (b.cw || 0) + 1; } else { b.cw = 0; }
        if (wType === 'Stumped') { let wk = getBowlTeam().players.find(p => p.skill && p.skill.includes('WK') && p.isPlayingXI); if (wk) { wk.stumpings++; wFldr = wk.name; } else { wFldr = "WK"; } } else if (wFldr) { let fObj = getBowlTeam().players.find(p => p.name === wFldr); if (fObj) { if (wType === 'Caught') fObj.catches++; else if (wType === 'RunOut') fObj.runouts++; } }
        
        let logLabel = (runsScored > 0 ? runsScored : '') + 'W'; if (extraType === 'wide') logLabel = (runsScored + 1) + 'wd+W'; else if (extraType === 'noball') logLabel = (runsScored + 1) + 'nb+W';
        cur.currentOverLog.push({label: logLabel, type: 'wicket'}); oB.outOnDuck = (oB.r === 0) ? 1 : 0;
        
        let dT = ""; if (wType === 'Bowled') dT = `b ${b.name}`; else if (wType === 'Caught') dT = `c ${wFldr || 'Sub'} b ${b.name}`; else if (wType === 'LBW') dT = `lbw b ${b.name}`; else if (wType === 'Stumped') dT = `st ${wFldr} b ${b.name}`; else if (wType === 'RunOut') dT = `run out (${wFldr || 'Sub'})`; else if (wType === 'HitWicket') dT = `hit wicket b ${b.name}`; else if (wType === 'ObstructingField') dT = `obstructing the field`; else if (wType === 'HitBallTwice') dT = `hit the ball twice`; else if (wType === 'TimedOut') dT = `timed out`;
        if (extraType === 'wide') dT += ' (wd)'; else if (extraType === 'noball') dT += ' (nb)'; oB.dismissalInfo = dT;
        
        logBallEvent(s, b, runsBat, runsExt, exLabel, true, wType, oB); // Supabase Hook
    }

    oB.outTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    cur.fow.push({ wktNum: cur.wkts, runs: cur.runs, overs: formatOver(cur.balls), outBatter: oB.name, partner: getBatTeam().players[isSO ? cur.nsIdx : cur.sIdx].name, pRuns: cur.currPartnership.runs, pBalls: cur.currPartnership.balls }); cur.currPartnership = { runs: 0, balls: 0 };
    
    // FIX 5: Safely parse Rotate runs 
    let runsScoredRotate = 0;
    if (['RunOut', 'ObstructingField'].includes(wType)) {
        let rotInput = el('wRuns') ? el('wRuns').value : "0";
        runsScoredRotate = parseInt(rotInput, 10);
        if (isNaN(runsScoredRotate)) runsScoredRotate = 0;
    }

    if (['RunOut', 'ObstructingField'].includes(wType)) { if (runsScoredRotate % 2 === 0) manualRotate(); } else { if (runsScoredRotate % 2 !== 0 && !['Caught', 'Bowled', 'LBW', 'Stumped', 'HitWicket', 'TimedOut'].includes(wType)) { manualRotate(); } }
    
    if (checkTargetReached()) { if(cur.bIdx !== null) finalizeOver(true); closeModal(); setTimeout(endInnings, 100); return; }
    
    closeModal(); updateUI();
    let promptDelay = 800;
    if(cur.wkts < 10) { let slot = getBatTeam().players[cur.sIdx].out ? 'striker' : 'nonstriker'; setTimeout(() => openSelector(slot, "Next Batter"), promptDelay); } else { setTimeout(() => endInnings(), promptDelay); }
}

function openPenalty() { showModal("Award Penalty Runs", `<select id="penT" class="modal-input w-100"><option value="bat">Batting Team</option><option value="bowl">Bowling Team</option></select><input type="number" id="penR" class="modal-input w-100" placeholder="Runs" value="5">`, () => { saveState(); let t = el('penT').value, r = parseInt(el('penR').value) || 0; if (r === 0) { closeModal(); return; } if (t === 'bat') { state.current.runs += r; state.current.penalties += r; state.current.currentOverLog.push({label: `+${r}P`, type: 'extra'}); if (checkTargetReached()) { finalizeOver(true); closeModal(); setTimeout(endInnings, 100); return; } } else { let p = state.inningsSummaries.find(i => i.batTeam === getBowlTeam().name); if (p) { p.runs += r; p.penalties = (p.penalties || 0) + r; alert("Penalty added to completed innings!"); } else { state.teams[state.bowlingKey].pendingPenalties += r; alert("Penalty will be added to next innings!"); } } closeModal(); updateUI(); }); }

function openChangeWK() { 
    let o = getBowlTeam().players.map((p, i) => p.isPlayingXI ? `<option value="${i}" ${p.skill && p.skill.includes('WK') ? 'selected' : ''}>${p.name}</option>` : '').join(''); 
    showModal("🧤 Change WK", `<select id="nWK" class="modal-input w-100"><option value="-1">-- No WK Selected --</option>${o}</select>`, () => { getBowlTeam().players.forEach(p => { if(p.skill && p.skill.includes('/ WK')) { p.skill = p.skill.replace(' / WK', ''); } }); let idx = parseInt(el('nWK').value); if(idx >= 0) { if(!getBowlTeam().players[idx].skill.includes('WK')) { getBowlTeam().players[idx].skill += ' / WK'; } } syncMetadataToHistory(false); closeModal(); updateUI(); }); 
}

function updSwap() { el('swO').innerHTML = state.teams[el('swT').value].players.map((p, i) => p.isPlayingXI ? `<option value="${i}">${p.name}</option>` : '').join(''); el('swI').innerHTML = state.teams[el('swT').value].players.map((p, i) => !p.isPlayingXI ? `<option value="${i}">${p.name}</option>` : '').join(''); }
function openPlayerSwap() { showModal("🔄 Sub Swap", `<select id="swT" class="modal-input w-100" onchange="updSwap()"><option value="A">${state.teams.A.name}</option><option value="B">${state.teams.B.name}</option></select><label>OUT:</label><select id="swO" class="modal-input w-100"></select><label>IN:</label><select id="swI" class="modal-input w-100"></select>`, () => { let k = el('swT').value, o = parseInt(el('swO').value), i = parseInt(el('swI').value), t = state.teams[k].players; if ((k === state.battingKey && (state.current.sIdx === o || state.current.nsIdx === o)) || (k === state.bowlingKey && state.current.bIdx === o)) { alert("Cannot swap active player!"); return; } saveState(); t[o].isPlayingXI = false; if (!t[o].dismissalInfo && t[o].hasBatted) t[o].dismissalInfo = "Replaced (Injury)"; t[i].isPlayingXI = true; closeModal(); updateUI(); }); setTimeout(updSwap, 10); }

function openEditSquad() { let html = `<select id="editSqTeam" class="modal-input w-100" onchange="buildEditSq()"><option value="A">${state.teams.A.name}</option><option value="B">${state.teams.B.name}</option></select><div id="editSqDiv" style="max-height:60vh; overflow-y:auto; margin-top:10px; border:1px solid var(--border); border-radius:6px; background:rgba(0,0,0,0.2);"></div>`; showModal("🛠️ Edit Squad & Playing XI", html, saveEditSquad, true, "500px", "Save Changes"); setTimeout(buildEditSq, 50); }
function buildEditSq() { let k = el('editSqTeam').value, t = state.teams[k].players; let html = `<table class="roster-table" style="color:white; margin-top:0; min-width:100%;"><thead style="position:sticky; top:0; background:#020617; z-index:5;"><tr><th style="width:10%;">#</th><th style="width:65%;">Player Name</th><th style="width:25%; text-align:center;">Playing 11</th></tr></thead><tbody>`; t.forEach((p, i) => { html += `<tr><td style="text-align:center; color:var(--text-muted);">${i+1}</td><td><input type="text" id="es-n-${i}" value="${p.name}" class="w-100" style="padding:6px; font-size:0.85rem; border:none; background:transparent; border-bottom:1px solid #334155; border-radius:0;"></td><td style="text-align:center;"><input type="checkbox" id="es-p-${i}" ${p.isPlayingXI ? 'checked' : ''} style="width:18px;height:18px; cursor:pointer;"></td></tr>`; }); html += `</tbody></table>`; el('editSqDiv').innerHTML = html; }
function saveEditSquad() { let k = el('editSqTeam').value, t = state.teams[k].players; let activeIdxs = []; if (k === state.battingKey) { if(state.current.sIdx !== null) activeIdxs.push(state.current.sIdx); if(state.current.nsIdx !== null) activeIdxs.push(state.current.nsIdx); } if (k === state.bowlingKey) { if(state.current.bIdx !== null) activeIdxs.push(state.current.bIdx); } for(let i=0; i<19; i++) { let isChecked = el(`es-p-${i}`).checked; if (!isChecked && activeIdxs.includes(i)) { alert(`Cannot remove ${t[i].name} from Playing XI because they are active!`); return; } } for(let i=0; i<19; i++) { t[i].name = el(`es-n-${i}`).value.trim(); t[i].isPlayingXI = el(`es-p-${i}`).checked; } syncMetadataToHistory(true); closeModal(); updateUI(); }

function renderChart(cT) { 
    if (!document.getElementById('wormChart') || typeof window.Chart === 'undefined') return; 
    if (window.matchChart) window.matchChart.destroy(); 
    let ds = [], lbls = [], aI = [...state.inningsSummaries]; 
    if ((state.current.balls > 0 || state.current.runs > 0) && state.inningsNum > state.inningsSummaries.length) { aI.push({ innNum: state.inningsNum, overHistory: state.current.overHistory.slice(), isOngoing: true, currentRuns: state.current.runs, currentBalls: state.current.balls }); }
    let maxL = 0; 
    aI.forEach((inn, idx) => { let h = inn.overHistory || [], oR = [], cA = [], lR = 0; for(let i=0; i<h.length; i++) { let r = h[i].runs; oR.push(r - lR); cA.push(r); lR = r; } if (inn.isOngoing && inn.currentBalls % 6 !== 0) { let r = inn.currentRuns; oR.push(r - lR); cA.push(r); } if (cA.length > maxL) maxL = cA.length; if (cT === 'worm') ds.push({ label: `Inn ${inn.innNum}`, data: cA, borderColor: idx === 0 ? '#3b82f6' : '#f59e0b', borderWidth: 3, fill: false, type: 'line' }); else ds.push({ label: `Inn ${inn.innNum}`, data: oR, backgroundColor: idx === 0 ? '#3b82f6' : '#f59e0b', type: 'bar' }); }); 
    for(let i=1; i<=Math.max(maxL, 1); i++) lbls.push(i); 
    window.matchChart = new Chart(document.getElementById('wormChart').getContext('2d'), { type: cT === 'worm' ? 'line' : 'bar', data: { labels: lbls, datasets: ds }, options: { responsive: true, scales: { y: { beginAtZero: true } } } }); 
}

function showMatchGraphs() { showModal("📊 MATCH GRAPHS", `<div class="flex-row gap-10" style="justify-content:center"><button type="button" onclick="renderChart('worm')" class="btn-action">📈 WORM</button><button type="button" onclick="renderChart('manhattan')" class="btn-action" style="background:var(--accent);color:black;">📊 BAR</button></div><canvas id="wormChart"></canvas>`, closeModal, true, "650px", "Close"); setTimeout(() => { renderChart('worm'); }, 100); }

function openSelector(typ, title) { 
    let cur = state.current, lst = typ === 'bowler' ? getBowlTeam().players : getBatTeam().players; 
    let opt = lst.map((p, i) => { if (!p.isPlayingXI) return ''; let s = typ === 'bowler' ? (!cur.lastOverBowlers.has(i) && i !== cur.bIdx && p.quotaOvers < state.matchSettings.bowlerQuota) : ((!p.hasBatted || p.out === 'retiredHurt') && i !== cur.sIdx && i !== cur.nsIdx); return s ? `<option value="${i}">${p.name}</option>` : ''; }).join(''); 
    showModal(title, `<select id="gSel" class="modal-input w-100">${opt}</select>`, () => { 
        saveState(); let val = parseInt(el('gSel').value); 
        if(typ === 'bowler') { cur.bIdx = val; cur.bowlersInCurrentOver.add(val); } else { cur[typ === 'striker' ? 'sIdx' : 'nsIdx'] = val; let nB = getBatTeam().players[val]; if (nB.out === 'retiredHurt') { nB.out = false; nB.dismissalInfo = ""; } else { nB.inTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); } nB.hasBatted = true; } 
        closeModal(); updateUI(); 
        if (typ !== 'bowler' && cur.bIdx === null && cur.wkts < 10) { setTimeout(() => openSelector('bowler', "Select Next Bowler"), 50); } else if (typ !== 'bowler') { checkAutoOverPrompt(); }
    }, false, "360px", "Confirm"); 
}

function updateUI() {
    let cur = state.current, bT = getBatTeam().players, bwT = getBowlTeam().players;
    setTimeout(() => { localStorage.setItem('cricStat_activeMatch', JSON.stringify(state, (key, value) => value instanceof Set ? [...value] : value)); triggerCloudSync(); }, 0);

    el('inningsBadge').innerText = `INNINGS ${state.inningsNum}`; el('dispBatTeamName').innerText = state.teams[state.battingKey].name; el('dispBowlTeamName').innerText = state.teams[state.bowlingKey].name; el('dispBatTeamNameTop').innerText = state.teams[state.battingKey].name;
    let histHtml = ''; state.inningsSummaries.forEach(inn => { histHtml += `<div class="text-success mb-5" style="font-size:0.85rem;">Inn ${inn.innNum}: ${inn.batTeam} scored ${inn.runs}/${inn.wkts}</div>`; }); el('inningsHistoryText').innerHTML = histHtml;

    let effBalls = getEffectiveBalls(cur); let crrVal = effBalls > 0 ? ((cur.runs / effBalls) * 6).toFixed(2) : "0.00"; if(el('liveCrr')) el('liveCrr').innerText = crrVal;
    
    let curTargetString = null; let rrrVal = null;
    if (state.matchSettings.matchType === 'multiday') {
        let allInn = [...state.inningsSummaries]; let bowlTeam = getBowlTeam().name; let bowlTeamInnsCount = allInn.filter(i => i.batTeam === bowlTeam).length;
        if (state.matchSettings.customTarget) { curTargetString = `${state.matchSettings.customTarget} Runs`; } else if (bowlTeamInnsCount === 2) { let bowlTotal = allInn.filter(i => i.batTeam === bowlTeam).reduce((sum, i) => sum + i.runs, 0); let batPrevInns = allInn.filter(i => i.batTeam === getBatTeam().name).reduce((sum, i) => sum + i.runs, 0); let targetToWin = bowlTotal - batPrevInns + 1; if (targetToWin > 0) curTargetString = `Target: ${targetToWin}`; }
        if (curTargetString) { el('dispTargetText').innerText = curTargetString; el('targetDisplayBox').classList.remove('hidden'); } else { el('targetDisplayBox').classList.add('hidden'); }
        if(el('rrrBox')) el('rrrBox').classList.add('hidden'); 
    } else {
        if (state.inningsNum > 1 && state.inningsSummaries.length > 0) { 
            let tRuns = state.matchSettings.customTarget || (state.inningsSummaries[state.inningsNum - 2].runs + 1); let tOvers = state.matchSettings.customTargetOvers || state.matchSettings.originalMaxOvers; let tMethod = state.matchSettings.targetMethod || ""; curTargetString = `${tRuns} (${tOvers}) ${tMethod}`.trim(); 
            el('dispTargetText').innerText = curTargetString; el('targetDisplayBox').classList.remove('hidden'); 
            let runsNeeded = tRuns - cur.runs; if(runsNeeded < 0) runsNeeded = 0;
            let targetFullOvers = Math.floor(tOvers); let targetExtraBalls = Math.round((tOvers - targetFullOvers) * 10); let totalTargetBalls = (targetFullOvers * 6) + targetExtraBalls;
            let ballsLeft = totalTargetBalls - effBalls; if (ballsLeft < 0) ballsLeft = 0; rrrVal = ballsLeft > 0 ? ((runsNeeded / ballsLeft) * 6).toFixed(2) : "0.00";
            if(el('liveRrr')) el('liveRrr').innerText = rrrVal; 
            let runsColor = runsNeeded < ballsLeft ? 'var(--success)' : (runsNeeded > ballsLeft ? 'var(--danger)' : 'white');
            if(el('liveReq')) { el('liveReq').innerHTML = `<span style="color:${runsColor};">${runsNeeded}</span><span style="color:var(--primary);">/</span><span style="color:var(--accent);">${ballsLeft}</span>`; }
            if(el('rrrBox')) el('rrrBox').classList.remove('hidden');
        } else { el('targetDisplayBox').classList.add('hidden'); if(el('rrrBox')) el('rrrBox').classList.add('hidden'); }
    }

    let leadBoxHtml = "";
    if (state.matchSettings.matchType === 'multiday' && state.inningsNum > 1) { let tBat = getBatTeam().name, tBowl = getBowlTeam().name; let sBat = state.current.runs + state.inningsSummaries.filter(i=>i.batTeam===tBat).reduce((a,b)=>a+b.runs,0); let sBowl = state.inningsSummaries.filter(i=>i.batTeam===tBowl).reduce((a,b)=>a+b.runs,0); let diff = sBat - sBowl; let txt = diff > 0 ? `lead by ${diff}` : (diff < 0 ? `trail by ${Math.abs(diff)}` : `scores level`); leadBoxHtml = `<p class="text-accent font-bold mt-5 mb-0" style="font-size:0.85rem; text-transform:uppercase;">📊 ${tBat} ${txt}</p>`; }
    el('leadTrailBox').innerHTML = leadBoxHtml;

    el('livePartnership').innerText = `${cur.currPartnership.runs} (${cur.currPartnership.balls})`; 
    el('liveRuns').innerText = cur.runs; el('liveWkts').innerText = cur.wkts; el('liveWkts').style.color = "var(--danger)"; 
    el('liveOvers').innerText = getTeamOversDisplay(); 
    el('liveExtras').innerText = cur.extras.w + cur.extras.nb + cur.extras.b + cur.extras.lb; 
    el('exW').innerText = cur.extras.w; el('exNB').innerText = cur.extras.nb; el('exB').innerText = cur.extras.b; el('exLB').innerText = cur.extras.lb; el('livePenalties').innerText = cur.penalties; 
    el('freeHitBadge').classList.toggle('hidden', !cur.isFreeHit);
    
    if (state.current.activeBreak) { el('scoringEventsBox').classList.add('hidden'); el('breakOverlayBox').classList.remove('hidden'); el('breakTitle').innerText = `PAUSED: ${state.current.activeBreak}`; if (state.current.activeBreakInsp) { el('breakSubtitle').innerText = `Next Inspection: ${state.current.activeBreakInsp}`; } else { el('breakSubtitle').innerText = ""; } } else { el('scoringEventsBox').classList.remove('hidden'); el('breakOverlayBox').classList.add('hidden'); }

    let battedPlayers = bT.map((p, i) => ({p: p, i: i})).filter(item => item.p.hasBatted);
    battedPlayers.sort((a, b) => { let aActive = (a.i === cur.sIdx || a.i === cur.nsIdx) ? 1 : 0; let bActive = (b.i === cur.sIdx || b.i === cur.nsIdx) ? 1 : 0; if (aActive !== bActive) return bActive - aActive; return a.i - b.i; });

    let battersHtml = `<table class="bowler-table" style="font-size: 0.85rem; margin-top:0;"><thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>`;
    battersHtml += battedPlayers.map(item => { 
        let p = item.p, rI = item.i; let isActive = (rI === cur.sIdx || rI === cur.nsIdx); let isStriker = (rI === cur.sIdx); let sr = p.b > 0 ? ((p.r / p.b) * 100).toFixed(2) : "0.00"; 
        let dName = p.name; if(p.desig === 'C' || p.desig === 'C/WK') dName += ' (C)'; if(p.skill && p.skill.includes('WK')) dName += ' *'; if(isStriker) dName += ' <span style="font-size:0.8rem;" title="Striker">🏏</span>';
        let rowStyle = isActive ? (isStriker ? 'background: rgba(16, 185, 129, 0.15); border-left: 3px solid var(--success);' : 'background: rgba(255,255,255,0.05); border-left: 3px solid transparent;') : 'opacity: 0.6; border-left: 3px solid transparent;';
        let statusInfo = p.out ? `<div style="font-size:0.65rem; color:var(--danger); font-style:italic; margin-top:2px;">${p.dismissalInfo}</div>` : (isActive ? `<div style="font-size:0.65rem; color:var(--success); font-style:italic; margin-top:2px;">Not Out</div>` : '');
        return `<tr style="${rowStyle}"><td style="padding:8px; max-width: 140px;"><div style="font-weight:bold; color:${isActive ? 'white' : 'var(--text-muted)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.name}">${dName}</div>${statusInfo}</td><td style="font-weight:bold; font-size:1.1rem; color:var(--primary); padding:8px;">${p.r}</td><td style="padding:8px;">${p.b}</td><td style="color:var(--b4); padding:8px;">${p.f}</td><td style="color:var(--b6); padding:8px;">${p.s}</td><td style="color:var(--accent); font-weight:bold; padding:8px;">${sr}</td></tr>`; 
    }).join('');
    battersHtml += `</tbody></table>`; el('battersContainer').innerHTML = battersHtml;
    
    let miniBatHtml = "";
    if (cur.sIdx !== null) { let p = bT[cur.sIdx]; miniBatHtml += `<div style="display: flex; align-items: center; width: 100%; margin-bottom: 2px;"><div style="color: white; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; text-align: left;" title="${p.name}">${p.name}</div><div style="flex: 0 0 auto; margin-left: 4px; white-space: nowrap;"><span style="font-size:0.6rem; margin-right: 2px;">🏏</span><span class="text-primary" style="font-weight:bold;">${p.r}</span><span style="color:var(--text-muted); font-weight:normal; font-size:0.7rem; margin-left:2px;">(${p.b})</span></div></div>`; }
    if (cur.nsIdx !== null) { let p = bT[cur.nsIdx]; miniBatHtml += `<div style="display: flex; align-items: center; width: 100%;"><div style="color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; text-align: left;" title="${p.name}">${p.name}</div><div style="flex: 0 0 auto; margin-left: 4px; white-space: nowrap;"><span class="text-primary" style="font-weight:bold;">${p.r}</span><span style="color:var(--text-muted); font-weight:normal; font-size:0.7rem; margin-left:2px;">(${p.b})</span></div></div>`; }
    el('miniLiveBatters').innerHTML = miniBatHtml;
    
    if(cur.bIdx !== null) { 
        let actB = bwT[cur.bIdx]; let bName = actB.name; if(actB.desig === 'C' || actB.desig === 'C/WK') bName += ' (C)'; if(actB.skill && actB.skill.includes('WK')) bName += ' *'; 
        el('activeBowlerNameRight').innerText = bName; el('activeBowlerNameRight').title = bName; el('activeBowlerProgress').innerHTML = cur.currentOverLog.map(getBadgeHtml).join(''); 
        let totalRuns = (actB.rc || 0) + (actB.byes || 0) + (actB.legbyes || 0); let miniBowlHtml = `<div style="display:flex; justify-content:flex-end; align-items:center; width:100%; margin-bottom:2px;"><div style="flex: 0 0 auto; margin-right:4px;">⚾</div><div style="color:white; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex: 0 1 auto; text-align:right;">${actB.name}</div></div>`; miniBowlHtml += `<div style="color:var(--text-muted); font-size:0.75rem; text-align:right; white-space:nowrap;">${formatOver(actB.o)}-${actB.m}-${totalRuns}-<span class="text-danger" style="font-weight:bold;">${actB.w}</span></div>`; el('miniLiveBowler').innerHTML = miniBowlHtml;
    } else {
        el('activeBowlerNameRight').innerText = "Select..."; el('activeBowlerNameRight').title = ""; el('activeBowlerProgress').innerHTML = ""; el('miniLiveBowler').innerHTML = `<div style="color: var(--text-muted); font-style:italic;">Select Bowler...</div>`;
    }
    
    el('recentBallsData').innerHTML = cur.recentBalls.map(getBadgeHtml).join(''); 
    el('bowlStatsBody').innerHTML = bwT.filter(p => p.o > 0 || p.rc > 0).map(p => { 
        let bName = p.name; if(p.desig === 'C' || p.desig === 'C/WK') bName += ' (C)'; if(p.skill && p.skill.includes('WK')) bName += ' *'; 
        let totalRuns = p.rc || 0; let exStr = `${p.byes||0}b, ${p.legbyes||0}lb`; let noBalls = p.nb || 0; let wides = p.wd || 0;
        return `<tr><td style="max-width: 85px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.name}">${bName}</td><td>${formatOver(p.o)}</td><td>${p.m}</td><td>${totalRuns}</td><td style="color:var(--danger); font-weight:bold;">${p.w}</td><td style="font-size:0.7rem; color:var(--text-muted);">${exStr}</td><td>${noBalls}</td><td>${wides}</td></tr>`; 
    }).join('');
}

function calculateResultText() { 
    let allInn = [...state.inningsSummaries]; 
    if ((state.current.balls > 0 || state.current.runs > 0) && state.inningsNum > state.inningsSummaries.length) { allInn.push({ innNum: state.inningsNum, batTeam: getBatTeam().name, bowlTeam: getBowlTeam().name, runs: state.current.runs, wkts: state.current.wkts }); }
    if (allInn.length < 2) return ""; 
    if (state.matchSettings.matchType !== 'multiday') { 
        let t1 = allInn[0], t2 = allInn[1];
        if (allInn.length === 2 && (state.current.balls >= getTargetBalls() || state.current.wkts >= 10 || state.current.runs > t1.runs)) { let currentTeamScore = state.current.runs; if (currentTeamScore > t1.runs) return `${t2.batTeam} won by ${10 - state.current.wkts} wickets`; if (t1.runs > currentTeamScore) return `${t1.batTeam} won by ${t1.runs - currentTeamScore} runs`; return "MATCH TIED"; }
        return ""; 
    }
    let t1Name = allInn[0].batTeam, t2Name = allInn[0].bowlTeam; let s = {}, fI = {}; s[t1Name] = 0; s[t2Name] = 0; fI[t1Name] = null; fI[t2Name] = null; allInn.forEach(i => { s[i.batTeam] += i.runs; if(fI[i.batTeam] === null) fI[i.batTeam] = i.runs; });
    let lInn = allInn[allInn.length - 1], batL = lInn.batTeam, bowlL = lInn.bowlTeam; let t1C = allInn.filter(i => i.batTeam === t1Name).length, t2C = allInn.filter(i => i.batTeam === t2Name).length;
    if (t1C + t2C < 3) return "";
    if (lInn.wkts >= 10 || state.inningsNum > state.matchSettings.maxInnings) { if (s[batL] > s[bowlL]) return `${batL} won by ${s[batL] - s[bowlL]} runs`; if (s[bowlL] > s[batL] && t1C+t2C===4) return `${bowlL} won by ${10 - lInn.wkts} wickets`; }
    return ""; 
}

function enableSummaryConfirm() { let cBtn = el('modalConfirmBtn'); if (cBtn.disabled) { cBtn.disabled = false; cBtn.style.opacity = '1'; cBtn.style.cursor = 'pointer'; cBtn.innerText = cBtn.dataset.origText || "Confirm"; } }

// ==========================================
// EXPORT ENGINE (EXCEL & PDF SHARED LOGIC)
// ==========================================
function generateReportHTML(isExcel) {
    let css = `@media print { @page { size: A4 landscape; margin: 0.5in; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } } body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; background: #ffffff; padding: 20px; } table { border-collapse: collapse; width: 100%; font-size: 10pt; table-layout: auto; margin-bottom: 20px; page-break-inside: avoid; } tr { page-break-inside: avoid; page-break-after: auto; } th, td { border: 1px solid #d1d5db; padding: 6px; text-align: center; vertical-align: middle; color: #334155; } .main-header { background: #0f172a; color: #ffffff; font-size: 14pt; font-weight: bold; text-transform: uppercase; padding: 10px; } .sub-header { background: #f8fafc; color: #334155; font-size: 10pt; font-weight: bold; text-align: left; padding: 8px; } .inn-title { background: #1e293b; color: #fbbf24; font-size: 12pt; font-weight: bold; text-align: left; padding: 8px; } .bat-th, .bwl-th { background: #f1f5f9; color: #334155; font-weight: bold; } .text-left { text-align: left; padding-left: 10px; } .text-right { text-align: right; padding-right: 10px; } .bold { font-weight: bold; } .extra-row { background: #f1f5f9; font-weight: bold; color: #334155; border-top: 2px solid #94a3b8; } .fow-row { background: #fafafa; font-size: 9pt; color: #475569; text-align: left; padding: 10px; }`;
    let html = ``;
    if (isExcel) { html += `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>${css}</style></head><body><div align="center">`; } 
    else { html += `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Match Report PDF</title><style>${css}</style></head><body><div align="center">`; }

    let res = state.matchResult || calculateResultText() || "Match in Progress"; let mId = state.matchId || el('setupMatchId').value || "N/A"; let tourn = el('setupTournament').value || "Friendly Match"; let venue = el('setupVenue').value || "N/A"; let date = el('setupDate').value || new Date().toLocaleDateString(); let toss = `${el('tossWinner').value === 'A' ? state.teams.A.name : state.teams.B.name} chose to ${el('tossDecision').value}`;
    
    html += `<table><tr><th colspan="11" class="main-header">SPORTZSTAT OFFICIAL MATCH REPORT</th></tr><tr><td colspan="5" class="sub-header">🏆 Tournament: ${tourn}</td><td colspan="6" class="sub-header text-right">Match ID: ${mId}</td></tr><tr><td colspan="5" class="sub-header">📍 Venue: ${venue}</td><td colspan="6" class="sub-header text-right">📅 Date: ${date}</td></tr><tr><td colspan="5" class="sub-header" style="color:#059669;">🪙 Toss: ${toss}</td><td colspan="6" class="sub-header text-right" style="color:#2563eb;">🏁 Result: ${res}</td></tr></table>`;

    let allInn = [...state.inningsSummaries];
    if ((state.current.balls > 0 || state.current.runs > 0) && state.inningsNum > state.inningsSummaries.length) { let fF = JSON.parse(JSON.stringify(state.current.fow || [])); if(state.current.sIdx !== null && state.current.nsIdx !== null && state.current.wkts < 10) { let sBName = getBatTeam().players[state.current.sIdx] ? getBatTeam().players[state.current.sIdx].name : "Unknown"; let nsBName = getBatTeam().players[state.current.nsIdx] ? getBatTeam().players[state.current.nsIdx].name : "Unknown"; fF.push({ wktNum: "Unbroken", runs: state.current.runs, overs: formatOver(state.current.balls), outBatter: "-", partner: sBName + " & " + nsBName, pRuns: state.current.currPartnership.runs, pBalls: state.current.currPartnership.balls }); } allInn.push({ innNum: state.inningsNum, batTeam: getBatTeam().name, bowlTeam: getBowlTeam().name, runs: state.current.runs, wkts: state.current.wkts, overs: formatOver(state.current.balls), penalties: state.current.penalties || 0, batters: getBatTeam().players, bowlers: getBowlTeam().players, fow: fF, extras: JSON.parse(JSON.stringify(state.current.extras)), isOngoing: true, allowances: state.current.allowances || 0 }); }

    allInn.forEach(inn => {
        html += `<table><tr><th colspan="11" class="inn-title">INNINGS ${inn.innNum}: ${inn.batTeam} - ${inn.runs}/${inn.wkts} (${inn.overs} Ov)</th></tr>`;
        html += `<tr><th colspan="2" class="bat-th text-left" style="width:30%">Batter</th><th colspan="2" class="bat-th" style="width:22%">Status</th><th class="bat-th" style="width:8%">R</th><th class="bat-th" style="width:8%">B</th><th class="bat-th" style="width:8%">4s</th><th class="bat-th" style="width:8%">6s</th><th colspan="3" class="bat-th" style="width:16%">SR</th></tr>`;
        inn.batters.filter(p => p.hasBatted).forEach(p => { let sr = p.b > 0 ? ((p.r / p.b) * 100).toFixed(2) : "0.00"; let dName = p.name + (p.desig === 'C' || p.desig === 'C/WK' ? ' (C)' : '') + (p.skill && p.skill.includes('WK') ? ' *' : ''); let status = p.out ? p.dismissalInfo : "Not Out"; let statusColor = p.out ? "#991b1b" : "#065f46"; html += `<tr><td colspan="2" class="text-left bold">${dName}</td><td colspan="2" style="color:${statusColor}; font-size:9pt;">${status}</td><td class="bold">${p.r}</td><td>${p.b}</td><td>${p.f}</td><td>${p.s}</td><td colspan="3">${sr}</td></tr>`; });
        let ex = inn.extras || {w:0, nb:0, b:0, lb:0}; let pen = inn.penalties || 0; let extrasTotal = ex.w + ex.nb + ex.b + ex.lb;
        html += `<tr><td colspan="4" class="extra-row text-right">Extras</td><td colspan="7" class="extra-row text-left">${extrasTotal} <span style="font-weight:normal; font-size:8pt;">(W:${ex.w}, NB:${ex.nb}, B:${ex.b}, LB:${ex.lb})</span></td></tr>`;
        if (pen > 0) { html += `<tr><td colspan="4" class="extra-row text-right" style="color:#991b1b;">Penalties</td><td colspan="7" class="extra-row text-left">${pen}</td></tr>`; }
        html += `<tr><td colspan="4" class="extra-row text-right" style="color:#1d4ed8;">TOTAL</td><td colspan="7" class="extra-row text-left bold" style="color:#1d4ed8;">${inn.runs}/${inn.wkts} <span style="font-weight:normal; font-size:8pt;">(${inn.overs} Overs)</span></td></tr>`;
        
        html += `<tr><th colspan="3" class="bwl-th text-left">Bowler</th><th class="bwl-th">O</th><th class="bwl-th">M</th><th class="bwl-th">R</th><th class="bwl-th">W</th><th class="bwl-th">Econ</th><th class="bwl-th">Extras</th><th class="bwl-th">No Balls</th><th class="bwl-th">Wides</th></tr>`;
        
        let sumBalls = 0, sumM = 0, sumR = 0, sumW = 0, sumB = 0, sumLB = 0, sumNB = 0, sumWD = 0, sumTotEx = 0;
        inn.bowlers.filter(p => p.o > 0 || p.rc > 0).forEach(p => { 
            let totalRuns = p.rc || 0; let e = p.o > 0 ? ((totalRuns / p.o) * 6).toFixed(2) : "0.00"; let dName = p.name + (p.desig === 'C' || p.desig === 'C/WK' ? ' (C)' : '') + (p.skill && p.skill.includes('WK') ? ' *' : ''); let exStr = `${p.byes||0}b, ${p.legbyes||0}lb`; let noBalls = p.nb || 0; let wides = p.wd || 0; let totalExtras = (p.wd || 0) + (p.nb || 0) + (p.byes || 0) + (p.legbyes || 0); let po = parseFloat(p.o) || 0; let bBalls = Math.floor(po) * 6 + Math.round((po - Math.floor(po)) * 10); sumBalls += bBalls; sumM += p.m || 0; sumR += totalRuns; sumW += p.w || 0; sumB += p.byes || 0; sumLB += p.legbyes || 0; sumNB += noBalls; sumWD += wides; sumTotEx += totalExtras; 
            html += `<tr><td colspan="3" class="text-left bold">${dName}</td><td>${formatOver(p.o)}</td><td>${p.m}</td><td>${totalRuns}</td><td class="bold" style="color:#991b1b;">${p.w}</td><td>${e}</td><td style="font-size:8pt;">${exStr}</td><td>${noBalls}</td><td>${wides}</td></tr>`; 
        });
        
        let sumOvers = Math.floor(sumBalls / 6) + "." + (sumBalls % 6); let sumEcon = sumBalls > 0 ? ((sumR / sumBalls) * 6).toFixed(2) : "0.00"; let totalRunsWithByes = sumR + sumB + sumLB; let sumExStr = `${sumB}b, ${sumLB}lb`;
        html += `<tr class="extra-row"><td colspan="3" class="text-right">TOTAL</td><td>${sumOvers}</td><td>${sumM}</td><td>${totalRunsWithByes}</td><td style="color:#991b1b;">${sumW}</td><td>${sumEcon}</td><td style="font-size:8pt;">${sumExStr}</td><td>${sumNB}</td><td>${sumWD}</td></tr>`;
        
        if (inn.fow && inn.fow.length > 0) { let fowStr = inn.fow.map(f => `<b>${f.runs}/${f.wktNum==='Unbroken'?'*':f.wktNum}</b> (${f.outBatter}, ${f.overs} ov)`).join(' | '); html += `<tr><td colspan="11" class="fow-row"><b>Fall of Wickets:</b> ${fowStr}</td></tr>`; }
        html += `</table>`;
    });

    html += `<table><tr><th colspan="11" class="main-header" style="font-size:11pt; background:#334155;">MATCH OFFICIALS & LOGS</th></tr>`;
    let u1 = el('u1').value || "N/A"; let u2 = el('u2').value || "N/A"; let tvUmp = el('tvUmpire').value || "N/A"; let obsRef = el('setupObsRef').value || "N/A";
    html += `<tr><td colspan="5" class="text-left"><b>Umpires:</b> ${u1}, ${u2}</td><td colspan="6" class="text-left"><b>TV / Ref:</b> ${tvUmp} / ${obsRef}</td></tr>`;
    if (state.matchBreaks.length > 0) { let brStr = state.matchBreaks.map(b => `Inn ${b.inn}: ${b.type} (${b.dur}m)`).join(', '); html += `<tr><td colspan="11" class="text-left"><b>Breaks:</b> ${brStr}</td></tr>`; }
    if (remarkLog.length > 0) { let remStr = remarkLog.map(r => `[Ov ${r.over}] ${r.remark}`).join(' | '); html += `<tr><td colspan="11" class="text-left" style="color:#4c1d95;"><b>Remarks:</b> ${remStr}</td></tr>`; }
    html += `</table></div></body></html>`;
    return html;
}

function prepAllowancesForExport() {
    if(el('inningAllowancesInput')) { let val = parseInt(el('inningAllowancesInput').value) || 0; state.current.allowances = val; if (state.inningsSummaries.length > 0 && state.inningsNum === state.inningsSummaries.length) { state.inningsSummaries[state.inningsSummaries.length - 1].allowances = val; } }
}

function downloadSummaryExcel() {
    prepAllowancesForExport(); let html = generateReportHTML(true);
    let blob = new Blob([html], { type: 'application/vnd.ms-excel' }); let url = URL.createObjectURL(blob); let a = document.createElement('a'); a.style.display = 'none'; a.href = url; a.download = `Sportzstat_Official_Report_${el('setupTournament').value || 'Match'}.xls`; document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
}

function downloadSummaryPDF() {
    prepAllowancesForExport(); let html = generateReportHTML(false);
    let printWin = window.open('', '_blank'); printWin.document.write(html); printWin.document.close(); printWin.focus(); setTimeout(() => { printWin.print(); printWin.close(); }, 500);
}

// ==========================================
// INDIVIDUAL & COMBINED PLAYER CARD STUDIO
// ==========================================

function getTopPerformers() {
    let batters = []; let bowlers = [];
    let allInn = [...state.inningsSummaries]; 
    if ((state.current.balls > 0 || state.current.runs > 0) && state.inningsNum > state.inningsSummaries.length) { allInn.push({ innNum: state.inningsNum, batTeam: getBatTeam().name, bowlTeam: getBowlTeam().name, runs: state.current.runs, wkts: state.current.wkts, batters: getBatTeam().players, bowlers: getBowlTeam().players }); }

    allInn.forEach(inn => {
        inn.batters.forEach(b => { if(b.hasBatted && b.r >= 10) batters.push({...b, team: inn.batTeam}); }); 
        inn.bowlers.forEach(b => { if(b.w >= 1 || b.m >= 1) bowlers.push({...b, team: inn.bowlTeam}); }); 
    });

    batters.sort((a,b) => b.r - a.r || ((b.r/Math.max(1,b.b))*100) - ((a.r/Math.max(1,a.b))*100));
    let topBatters = batters.filter((b, index) => index < 5 || b.r >= 50);

    bowlers.sort((a,b) => b.w - a.w || ((a.rc/Math.max(1, a.o))*6) - ((b.rc/Math.max(1, b.o))*6));
    let topBowlers = bowlers.slice(0, 3); 

    return { batters: topBatters, bowlers: topBowlers };
}

function openCardStudio() {
    let perfs = getTopPerformers();
    let html = `<div style="max-height:60vh; overflow-y:auto; padding-right:10px;" class="custom-scroll">`;
    
    html += `<button type="button" class="btn-action w-100 mb-15" style="background: linear-gradient(90deg, #3b82f6, #0284c7); padding:15px; font-size:1.1rem; color:white; font-weight:900;" onclick="previewCombinedCard()">📊 GENERATE COMBINED MATCH CARD</button>`;

    html += `<h3 class="text-accent mt-0" style="border-bottom:1px solid #334155; padding-bottom:5px;">Top Batters</h3><div style="display:flex; flex-direction:column; gap:8px; margin-bottom:20px;">`;
    if(perfs.batters.length === 0) html += `<div class="text-muted">No qualified batters yet.</div>`;
    perfs.batters.forEach((b, i) => {
        let pStr = encodeURIComponent(JSON.stringify(b)).replace(/'/g, "%27");
        html += `<button type="button" class="btn-action w-100" style="background:rgba(255,255,255,0.05); text-align:left; padding:12px; border-left:3px solid #38bdf8;" onclick="previewPlayerCard('${pStr}', true)">
            <b>${b.name}</b> (${b.team}) - <span class="text-primary">${b.r} runs</span> off ${b.b} balls
        </button>`;
    });
    
    html += `</div><h3 class="text-accent" style="border-bottom:1px solid #334155; padding-bottom:5px;">Top Bowlers</h3><div style="display:flex; flex-direction:column; gap:8px;">`;
    if(perfs.bowlers.length === 0) html += `<div class="text-muted">No qualified bowlers yet.</div>`;
    perfs.bowlers.forEach((b, i) => {
        let pStr = encodeURIComponent(JSON.stringify(b)).replace(/'/g, "%27");
        html += `<button type="button" class="btn-action w-100" style="background:rgba(255,255,255,0.05); text-align:left; padding:12px; border-left:3px solid #ef4444;" onclick="previewPlayerCard('${pStr}', false)">
            <b>${b.name}</b> (${b.team}) - <span class="text-danger">${b.w} Wkts</span> for ${b.rc} runs
        </button>`;
    });
    html += `</div></div>`;
    
    showModal("🌟 PLAYER CARD STUDIO", html, () => {}, true, "400px");
    el('modalConfirmBtn').style.display = 'none';
    el('modalCancelBtn').style.display = ''; 
    el('modalCancelBtn').innerText = "🔙 Back to Summary"; 
    el('modalCancelBtn').onclick = () => { showMatchSummary(); };
}

function previewCombinedCard() {
    let perfs = getTopPerformers();
    let tournName = el('setupTournament').value || "OFFICIAL MATCH CARD";
    
    let allInn = [...state.inningsSummaries];
    if ((state.current.balls > 0 || state.current.runs > 0) && state.inningsNum > state.inningsSummaries.length) {
        allInn.push({ batTeam: getBatTeam().name, runs: state.current.runs, wkts: state.current.wkts, overs: getTeamOversDisplay() });
    }
    
    let scoreLine1 = allInn[0] ? `${allInn[0].batTeam}: ${allInn[0].runs}/${allInn[0].wkts} (${allInn[0].overs} ov)` : "";
    let scoreLine2 = allInn[1] ? `${allInn[1].batTeam}: ${allInn[1].runs}/${allInn[1].wkts} (${allInn[1].overs} ov)` : "";
    let res = state.matchResult || calculateResultText() || "Match in Progress";

    let mvp = perfs.batters.length > 0 ? perfs.batters[0] : (perfs.bowlers.length > 0 ? perfs.bowlers[0] : null);
    let mvpName = mvp ? mvp.name : "STAR PERFORMER";
    let mvpStat = "";
    if (mvp && mvp.r !== undefined) { mvpStat = `${mvp.r} (${mvp.b})`; } 
    else if (mvp && mvp.w !== undefined) { mvpStat = `${mvp.w}/${mvp.rc} (${formatOver(mvp.o)})`; }

    let battersHtml = perfs.batters.map(b => {
        let sr = b.b > 0 ? ((b.r/b.b)*100).toFixed(1) : "0.0";
        let nameStr = b.name + (b.out ? "" : "*");
        return `<tr><td style="padding:12px; border-bottom:1px solid rgba(255,255,255,0.1); color:white; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${nameStr}</td><td style="padding:12px; text-align:center; color:#38bdf8; font-weight:bold; border-bottom:1px solid rgba(255,255,255,0.1);">${b.r}</td><td style="padding:12px; text-align:center; color:white; border-bottom:1px solid rgba(255,255,255,0.1);">${b.b}</td><td style="padding:12px; text-align:center; color:#cbd5e1; border-bottom:1px solid rgba(255,255,255,0.1);">${sr}</td></tr>`;
    }).join('');

    let bowlersHtml = perfs.bowlers.map(b => {
        return `<tr><td style="padding:12px; border-bottom:1px solid rgba(255,255,255,0.1); color:white; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${b.name}</td><td style="padding:12px; text-align:center; color:#ef4444; font-weight:bold; border-bottom:1px solid rgba(255,255,255,0.1);">${b.w}</td><td style="padding:12px; text-align:center; color:white; border-bottom:1px solid rgba(255,255,255,0.1);">${b.rc}</td><td style="padding:12px; text-align:center; color:#cbd5e1; border-bottom:1px solid rgba(255,255,255,0.1);">${formatOver(b.o)}</td></tr>`;
    }).join('');

    let cardHtml = `
    <input type="file" id="cardPhotoUploadCombined" accept="image/*" style="display: none;" onchange="updateCardPhotoCombined(event)">
    <div style="width: 302px; height: 378px; position: relative; margin: 0 auto; overflow: hidden; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.8);">
        <div id="exportCombinedCardElement" style="width: 1080px; height: 1350px; position: absolute; top: 0; left: 0; transform-origin: top left; transform: scale(0.2796); background: linear-gradient(135deg, #0b0f1a 0%, #1e293b 100%); font-family: 'Arial', sans-serif; color: white; overflow: hidden; box-sizing: border-box; border: 6px solid #38bdf8;">
            
            <div style="position: absolute; top: -100px; right: -100px; width: 400px; height: 400px; background: rgba(245, 158, 11, 0.15); filter: blur(80px); border-radius: 50%;"></div>
            <div style="position: absolute; bottom: -100px; left: -100px; width: 500px; height: 500px; background: rgba(56, 189, 248, 0.15); filter: blur(100px); border-radius: 50%;"></div>

            <div style="text-align: center; padding: 35px 20px 20px 20px; border-bottom: 2px solid rgba(255,255,255,0.1); position:relative; z-index:2;">
                <h1 style="margin: 0; font-size: 3.8rem; font-weight: 900; text-transform: uppercase; color:#f59e0b; letter-spacing: 2px;">${tournName}</h1>
                <div style="display:flex; justify-content:center; gap:40px; margin: 15px 0; font-size: 1.8rem; font-weight:bold; color:white;">
                    <div>${scoreLine1}</div>
                    ${scoreLine2 ? `<div style="color:rgba(255,255,255,0.4)">VS</div><div>${scoreLine2}</div>` : ''}
                </div>
                <p style="color: #5eead4; font-size: 1.7rem; font-weight:bold; margin: 0; text-transform:uppercase; letter-spacing:1px;">🏁 ${res}</p>
            </div>

            <div style="display: flex; align-items: center; justify-content: center; padding: 35px; background: rgba(0,0,0,0.3); margin: 35px 40px; border-radius: 20px; border: 1px solid rgba(56, 189, 248, 0.3); position:relative; z-index:2; backdrop-filter: blur(5px);">
                <div style="flex: 0 0 230px; height: 230px; border-radius: 50%; border: 6px solid #f59e0b; overflow: hidden; cursor: pointer; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" onclick="document.getElementById('cardPhotoUploadCombined').click()" title="Click to add MVP photo">
                    <img id="combinedCardPhotoImg" crossorigin="anonymous" src="https://ui-avatars.com/api/?name=${encodeURIComponent(mvpName)}&background=1e293b&color=f59e0b&size=230" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div style="margin-left: 50px; flex: 1;">
                    <div style="color: #f59e0b; font-weight: bold; font-size: 1.6rem; letter-spacing: 2px;">STAR PERFORMER</div>
                    <div style="font-size: 4rem; font-weight: 900; margin: 5px 0; line-height: 1; color:white;">${mvpName}</div>
                    <div style="font-size: 2.2rem; color: #38bdf8; font-weight: bold;">${mvpStat}</div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; padding: 0 40px; position:relative; z-index:2;">
                <div style="width: 48%;">
                    <div style="background: rgba(15, 23, 42, 0.8); padding: 15px; border-radius: 10px 10px 0 0; border-bottom: 3px solid #38bdf8;">
                        <h2 style="margin: 0; color: #38bdf8; font-size: 1.8rem; text-align: center;">TOP BATTERS</h2>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; background: rgba(0,0,0,0.4); font-size: 1.3rem; table-layout: fixed;">
                        <thead style="background: rgba(255,255,255,0.05); color: #cbd5e1; font-size: 1.1rem;">
                            <tr><th style="padding:15px; text-align:left; width:55%;">Batter</th><th style="padding:15px; text-align:center; width:15%;">R</th><th style="padding:15px; text-align:center; width:15%;">B</th><th style="padding:15px; text-align:center; width:15%;">SR</th></tr>
                        </thead>
                        <tbody>${battersHtml}</tbody>
                    </table>
                </div>

                <div style="width: 48%;">
                    <div style="background: rgba(15, 23, 42, 0.8); padding: 15px; border-radius: 10px 10px 0 0; border-bottom: 3px solid #ef4444;">
                        <h2 style="margin: 0; color: #ef4444; font-size: 1.8rem; text-align: center;">TOP BOWLERS</h2>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; background: rgba(0,0,0,0.4); font-size: 1.3rem; table-layout: fixed;">
                        <thead style="background: rgba(255,255,255,0.05); color: #cbd5e1; font-size: 1.1rem;">
                            <tr><th style="padding:15px; text-align:left; width:55%;">Bowler</th><th style="padding:15px; text-align:center; width:15%;">W</th><th style="padding:15px; text-align:center; width:15%;">R</th><th style="padding:15px; text-align:center; width:15%;">O</th></tr>
                        </thead>
                        <tbody>${bowlersHtml}</tbody>
                    </table>
                </div>
            </div>
            
            <div style="position: absolute; bottom: 30px; width: 100%; text-align: center; color: rgba(255,255,255,0.3); font-size: 1.4rem; font-weight: bold; letter-spacing: 3px; z-index:2;">
                Sportzstat
            </div>
        </div>
    </div>
    <div style="text-align:center; color:#94a3b8; font-size:0.8rem; margin-top:10px;">💡 Click the circle avatar above to upload a real photo!</div>
    <button type="button" class="btn-action w-100 mt-15" style="background:#10b981; padding:15px; font-size:1.1rem;" onclick="downloadElementAsImage('exportCombinedCardElement', 'Sportzstat_Match_Summary.png', this)">📸 DOWNLOAD MATCH CARD</button>
    `;

    showModal("📊 Combined Match Card", cardHtml, () => {}, true, "450px");
    el('modalConfirmBtn').style.display = 'none';
    el('modalCancelBtn').style.display = ''; el('modalCancelBtn').innerText = "🔙 Back to Studio"; el('modalCancelBtn').onclick = openCardStudio;
}

function updateCardPhotoCombined(event) {
    let file = event.target.files[0];
    if (file) { el('combinedCardPhotoImg').src = URL.createObjectURL(file); }
}

function previewPlayerCard(playerStr, isBatter) {
    let p = JSON.parse(decodeURIComponent(playerStr));

    let stat1Val, stat1Lab, stat2Val, stat2Lab, stat3Val, stat3Lab;
    if (isBatter) {
        let sr = p.b > 0 ? ((p.r/p.b)*100).toFixed(2) : "0.00";
        stat1Val = p.r + (p.out ? "" : "*"); stat1Lab = "RUNS";
        stat2Val = p.b; stat2Lab = "BALLS";
        stat3Val = sr; stat3Lab = "STRIKE RATE";
    } else {
        let econ = p.o > 0 ? ((p.rc/p.o)*6).toFixed(2) : "0.00";
        stat1Val = p.w; stat1Lab = "WICKETS";
        stat2Val = formatOver(p.o); stat2Lab = "OVERS";
        stat3Val = econ; stat3Lab = "ECONOMY"; 
    }

    let d = new Date(); let dStr = ("0"+(d.getMonth()+1)).slice(-2) + "." + ("0"+d.getDate()).slice(-2) + "." + d.getFullYear().toString().slice(-2);

    let cardHtml = `
    <input type="file" id="cardPhotoUpload" accept="image/*" style="display: none;" onchange="updateCardPhoto(event)">
    <div style="width: 302px; height: 378px; position: relative; margin: 0 auto; overflow: hidden; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.8);">
        <div id="exportCardElement" style="width: 1080px; height: 1350px; position: absolute; top: 0; left: 0; transform-origin: top left; transform: scale(0.2796); background-color: #111; font-family: 'Helvetica Neue', Arial, sans-serif; box-sizing: border-box; display: flex; flex-direction: column; padding: 40px; overflow: hidden;">
            
            <div style="position: absolute; top: -5%; left: -5%; width: 110%; height: 110%; background-image: url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1080&q=80'); background-size: cover; background-position: center; filter: blur(12px); z-index: 0;"></div>
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(10, 15, 30, 0.75); z-index: 1;"></div>

            <div style="position:relative; z-index:2; display:flex; flex-direction:column; height:100%;">
                
                <div style="display:flex; justify-content:space-between; align-items:flex-start; width: 100%; margin-bottom: 20px;">
                    <div style="font-weight: 900; font-size: 2rem; color: #ffffff; text-transform: uppercase; letter-spacing: 2px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">PLAYER CONTRIBUTION</div>
                    <div style="font-weight: 900; font-size: 2.5rem; color: #ffffff; text-transform: uppercase; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">${p.team}</div>
                </div>

                <div style="display: flex; width: 100%; height: 100%; gap: 40px;">
                    <div style="width: 55%; display: flex; flex-direction: column; align-items: center;">
                        <div style="width: 100%; height: 950px; border-radius: 40px; border: 4px solid #FFCC00; overflow: hidden; cursor: pointer; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" onclick="document.getElementById('cardPhotoUpload').click()" title="Click to upload a real photo!">
                            <img id="cardPhotoImg" crossorigin="anonymous" src="https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=1e293b&color=FFCC00&size=800" style="width:100%; height:100%; object-fit:cover;">
                        </div>
                        <div style="margin-top: 25px; text-align: center; width: 100%;">
                            <h2 style="font-family: 'Impact', 'Arial Black', sans-serif; font-size: 6.5rem; line-height: 1; margin: 0; color: #ffffff; text-transform: uppercase; letter-spacing: 1px; transform: scaleY(1.2); text-shadow: 4px 4px 10px rgba(0,0,0,0.8);">${p.name}</h2>
                            <h4 style="font-size: 2rem; color: #FFCC00; margin: 30px 0 5px 0; font-weight: 900; letter-spacing: 2px; text-shadow: 2px 2px 5px rgba(0,0,0,0.8);">TOP PERFORMER</h4>
                            <div style="font-size: 1.5rem; color: #cbd5e1; font-weight: bold; letter-spacing: 2px;">${dStr}</div>
                        </div>
                    </div>

                    <div style="width: 45%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 70px; padding-bottom: 80px;">
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <div style="font-family: 'Impact', 'Arial Black', sans-serif; font-size: 12rem; color: #ffffff; line-height: 1; transform: scaleY(1.2); letter-spacing: -2px; text-shadow: 5px 5px 15px rgba(0,0,0,0.8);">${stat1Val}</div>
                            <div style="color: #FFCC00; font-size: 2.2rem; font-weight: 900; text-transform: uppercase; margin-top: 25px; letter-spacing: 4px; text-shadow: 2px 2px 5px rgba(0,0,0,0.9);">${stat1Lab}</div>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <div style="font-family: 'Impact', 'Arial Black', sans-serif; font-size: 12rem; color: #ffffff; line-height: 1; transform: scaleY(1.2); letter-spacing: -2px; text-shadow: 5px 5px 15px rgba(0,0,0,0.8);">${stat2Val}</div>
                            <div style="color: #FFCC00; font-size: 2.2rem; font-weight: 900; text-transform: uppercase; margin-top: 25px; letter-spacing: 4px; text-shadow: 2px 2px 5px rgba(0,0,0,0.9);">${stat2Lab}</div>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <div style="font-family: 'Impact', 'Arial Black', sans-serif; font-size: 11rem; color: #ffffff; line-height: 1; transform: scaleY(1.2); letter-spacing: -2px; text-shadow: 5px 5px 15px rgba(0,0,0,0.8);">${stat3Val}</div>
                            <div style="color: #FFCC00; font-size: 2.2rem; font-weight: 900; text-transform: uppercase; margin-top: 25px; letter-spacing: 4px; text-shadow: 2px 2px 5px rgba(0,0,0,0.9);">${stat3Lab}</div>
                        </div>
                    </div>
                </div>
                
                <div style="position: absolute; bottom: 10px; right: 20px; color: #FF007F; font-size: 2.5rem; font-weight: 900; letter-spacing: 3px; font-style: italic; text-shadow: 2px 2px 0px #000, -1px -1px 0px rgba(255,255,255,0.3);">Sportzstat</div>
            </div>
        </div>
    </div>
    
    <div style="text-align:center; color:#94a3b8; font-size:0.8rem; margin-top:10px;">💡 Click the tall photo area above to upload a vertical action shot!</div>
    <button type="button" class="btn-action w-100 mt-15" style="background:#10b981; padding:15px; font-size:1.1rem;" onclick="downloadElementAsImage('exportCardElement', 'Sportzstat_Player_${p.name.replace(/[^a-zA-Z0-9]/g, '_')}.png', this)">📸 DOWNLOAD IMAGE</button>
    `;
    
    showModal("🎨 Edit Player Card", cardHtml, () => {}, true, "450px");
    el('modalConfirmBtn').style.display = 'none';
    el('modalCancelBtn').style.display = ''; el('modalCancelBtn').innerText = "🔙 Back to Studio"; el('modalCancelBtn').onclick = openCardStudio;
}

function updateCardPhoto(event) {
    let file = event.target.files[0];
    if (file) { el('cardPhotoImg').src = URL.createObjectURL(file); }
}

function downloadElementAsImage(elementId, fileName, btn) {
    if(typeof html2canvas === 'undefined') { alert("Error: html2canvas library is not loaded. Please ensure you added it to your index.html file."); return; }
    let origText = btn.innerText;
    btn.innerText = "⏳ Generating..."; btn.disabled = true;

    let cardEl = el(elementId);
    
    let overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0'; overlay.style.left = '0';
    overlay.style.width = '100vw'; overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.innerHTML = '<div style="color:white; font-size:2rem; font-weight:bold;">📸 Capturing High-Res Image...</div>';
    document.body.appendChild(overlay);

    let clone = cardEl.cloneNode(true);
    clone.style.transform = "none";
    clone.style.position = "fixed";
    clone.style.left = "0";
    clone.style.top = "0";
    clone.style.zIndex = "99998"; 
    
    let origImg = cardEl.querySelector('img');
    let cloneImg = clone.querySelector('img');
    if(origImg && cloneImg) { cloneImg.crossOrigin = "anonymous"; cloneImg.src = origImg.src; }

    document.body.appendChild(clone);

    setTimeout(() => {
        html2canvas(clone, { scale: 1, backgroundColor: "#111", useCORS: true, allowTaint: true }).then(canvas => {
            let link = document.createElement('a');
            link.download = fileName;
            link.href = canvas.toDataURL("image/png");
            link.click();
            
            document.body.removeChild(clone);
            document.body.removeChild(overlay);
            btn.innerText = origText; btn.disabled = false;
        }).catch(err => {
            console.error(err); alert("Error generating image.");
            document.body.removeChild(clone);
            document.body.removeChild(overlay);
            btn.innerText = origText; btn.disabled = false;
        });
    }, 150);
}

// ==========================================
// MODALS AND UI LOCKS
// ==========================================

function showModal(title, html, cb, hideCancel = false, customWidth = "360px", confirmBtnText = "Confirm", requiresDownload = false) { 
    el('modalHeading').innerText = title; 
    el('modalBody').innerHTML = html; 
    
    let cBtn = el('modalConfirmBtn'); 
    cBtn.style.display = ''; 
    cBtn.onclick = cb; 
    
    el('modalBoxElement').style.maxWidth = customWidth; 
    
    let cancelBtn = el('modalCancelBtn'); 
    cancelBtn.innerText = "Cancel"; 
    cancelBtn.onclick = closeModal;
    
    if (requiresDownload) { 
        cBtn.disabled = true; cBtn.style.opacity = '0.5'; cBtn.style.cursor = 'not-allowed'; 
        cBtn.dataset.origText = confirmBtnText; cBtn.innerText = "🔒 Download Report First"; 
        cancelBtn.style.display = ''; cancelBtn.innerText = "🔙 Go Back & Edit"; 
    } else { 
        cBtn.disabled = false; cBtn.style.opacity = '1'; cBtn.style.cursor = 'pointer'; 
        cBtn.innerText = confirmBtnText; cancelBtn.style.display = hideCancel ? 'none' : ''; 
    } 
    el('dynamicModal').classList.remove('hidden'); 
}

function showMatchSummary() {
    let autoRes = calculateResultText();
    let isGameOver = (state.inningsNum >= state.matchSettings.maxInnings || state.matchResult !== "" || autoRes !== "");
    let isTransition = (!isGameOver && state.inningsSummaries.length === state.inningsNum);
    
    let confirmBtnText = "Confirm"; let hideCancel = false; let requiresDownload = false;
    if (isGameOver) { confirmBtnText = "🏁 End Match & Reset"; requiresDownload = true; } else if (isTransition) { confirmBtnText = "▶️ Start Next Innings"; requiresDownload = true; } else { confirmBtnText = "🔙 Continue Scoring"; hideCancel = true; }

    let html = `<div class="custom-scroll" style="max-height: 45vh; overflow-y: auto; padding-right:10px; margin-bottom:10px;">`;
    if (state.inningsSummaries.length === 0 && state.current.balls === 0) {
        html += `<p class="text-center text-muted">No data available yet.</p>`;
    } else {
        let displayInnings = [...state.inningsSummaries];
        if (!isGameOver && !isTransition && (state.current.balls > 0 || state.current.runs > 0)) {
            let fF = JSON.parse(JSON.stringify(state.current.fow || [])); 
            if(state.current.sIdx !== null && state.current.nsIdx !== null && state.current.wkts < 10) { let sBName = getBatTeam().players[state.current.sIdx] ? getBatTeam().players[state.current.sIdx].name : "Unknown"; let nsBName = getBatTeam().players[state.current.nsIdx] ? getBatTeam().players[state.current.nsIdx].name : "Unknown"; fF.push({ wktNum: "Unbroken", runs: state.current.runs, overs: formatOver(state.current.balls), outBatter: "-", partner: sBName + " & " + nsBName, pRuns: state.current.currPartnership.runs, pBalls: state.current.currPartnership.balls }); }
            displayInnings.push({ innNum: state.inningsNum, batTeam: getBatTeam().name, bowlTeam: getBowlTeam().name, runs: state.current.runs, wkts: state.current.wkts, overs: formatOver(state.current.balls), penalties: state.current.penalties || 0, batters: getBatTeam().players, bowlers: getBowlTeam().players, fow: fF, extras: JSON.parse(JSON.stringify(state.current.extras)), isOngoing: true, allowances: state.current.allowances || 0 });
        }

        displayInnings.reverse().forEach(inn => {
            html += `<div style="background:rgba(0,0,0,0.3); padding:15px; margin-bottom:15px; border-top:4px solid ${inn.isOngoing ? 'var(--danger)' : 'var(--primary)'}; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.3);"><div class="flex-row" style="justify-content:space-between; margin-bottom:12px;"><div><div class="${inn.isOngoing ? 'text-danger' : 'text-primary'} font-bold" style="font-size:0.75rem; letter-spacing:1px;">INNINGS ${inn.innNum} ${inn.isOngoing ? '(ONGOING)' : ''}</div><div class="font-bold" style="font-size:1.3rem; color:white;">${inn.batTeam}</div></div><div class="text-right"><div class="text-success font-bold" style="font-size:1.6rem;">${inn.runs}<span style="color:#94a3b8; font-size:1.2rem;">/${inn.wkts}</span></div><div class="text-muted" style="font-size:0.85rem;">(${inn.overs} Overs)</div></div></div>`;
            
            html += `<table class="scorecard-table"><thead class="bat-hdr" style="background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border-bottom: 1px solid #64748b;"><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>`;
            inn.batters.forEach(b => { if(b.hasBatted) { let isOut = b.out ? `<span style="color:#ef4444; font-size:0.65rem; display:block; margin-top:2px;">${b.dismissalInfo}</span>` : `<span style="color:#10b981; font-size:0.65rem; display:block; margin-top:2px;">Not Out</span>`; let sr = b.b > 0 ? ((b.r/b.b)*100).toFixed(2) : "0.00"; let nameStr = `<div style="max-width: 130px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${b.name}"><b style="font-size:0.85rem; color:white;">${b.name}</b>` + (b.desig==='C' || b.desig==='C/WK' ? ' <span style="color:var(--accent);">(C)</span>' : '') + (b.skill && b.skill.includes('WK') ? ' 🧤' : '') + `</div>`; html += `<tr><td>${nameStr}${isOut}</td><td style="font-weight:bold; font-size:1rem; color:white;">${b.r}</td><td style="color:white;">${b.b}</td><td style="color:white;">${b.f}</td><td style="color:white;">${b.s}</td><td style="color:var(--accent);">${sr}</td></tr>`; } });
            let ex = inn.extras || {w:0, nb:0, b:0, lb:0}; let extrasTotal = ex.w + ex.nb + ex.b + ex.lb; let pen = inn.penalties || 0;
            html += `<tr style="background:rgba(255,255,255,0.05); font-weight:bold;"><td style="color:var(--accent); text-transform:uppercase;">Extras</td><td colspan="5" style="text-align:right; color:white;">${extrasTotal} <span style="font-weight:normal; font-size:0.7rem; color:white;">(W:${ex.w}, NB:${ex.nb}, B:${ex.b}, LB:${ex.lb})</span></td></tr>`;
            if (pen > 0) html += `<tr style="background:rgba(255,255,255,0.05); font-weight:bold;"><td style="color:var(--danger); text-transform:uppercase;">Penalties</td><td colspan="5" style="text-align:right; color:white;">${pen}</td></tr>`;
            html += `</tbody></table><table class="scorecard-table">`;
            
            html += `<thead class="bwl-hdr" style="background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border-bottom: 1px solid #64748b;"><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th><th>Extras</th><th>NB</th><th>WD</th></tr></thead><tbody>`;
            
            inn.bowlers.forEach(b => { if(b.o > 0 || b.rc > 0) { let totalRuns = b.rc || 0; let econ = b.o > 0 ? ((totalRuns/b.o)*6).toFixed(2) : "0.00"; let nameStr = `<div style="max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${b.name}"><b style="color:white;">${b.name}</b></div>`; let exStr = `${b.byes||0}b, ${b.legbyes||0}lb`; let nb = b.nb || 0; let wd = b.wd || 0; html += `<tr><td>${nameStr}</td><td style="color:white;">${formatOver(b.o)}</td><td style="color:white;">${b.m}</td><td style="color:white;">${totalRuns}</td><td style="font-weight:bold; font-size:1rem; color:var(--danger);">${b.w}</td><td style="color:var(--accent);">${econ}</td><td style="font-size:0.75rem; color:white;">${exStr}</td><td style="color:white;">${nb}</td><td style="color:white;">${wd}</td></tr>`; } });
            html += `</tbody></table>`;
            if(inn.fow && inn.fow.length > 0) { let fowStr = inn.fow.map(f => `<b style="color:white;">${f.runs}/${f.wktNum==='Unbroken'?'*':f.wktNum}</b> <span style="font-size:0.65rem; color:white;">(${f.outBatter}, ${f.overs} ov)</span>`).join(', '); html += `<div style="font-size:0.75rem; color:#94a3b8; background:rgba(0,0,0,0.3); padding:8px; border-radius:6px; border-left:3px solid var(--accent);"><b style="color:white;">Fall of Wickets:</b><br><div style="margin-top:4px; line-height:1.4;">${fowStr}</div></div>`; }
            html += `</div>`;
        });
    }
    
    let currentAllowances = state.current.allowances || 0; if (state.inningsSummaries.length > 0 && state.inningsNum === state.inningsSummaries.length) { currentAllowances = state.inningsSummaries[state.inningsSummaries.length - 1].allowances || 0; }
    html += `</div><div style="border-top:1px solid var(--border); padding-top:10px;"><label class="text-accent">Official Match Result / Status</label><input type="text" id="finalMatchResult" class="modal-input w-100" value="${state.matchResult || autoRes}" placeholder="e.g., Match Awarded, Follow-on, etc."><label class="text-accent mt-5">Allowances for Inning (Mins)</label><input type="number" id="inningAllowancesInput" class="modal-input w-100" placeholder="e.g. 15" value="${currentAllowances}">`;
    
    html += `<div class="flex-row gap-10 mt-10 mb-10">
                <button type="button" onclick="downloadSummaryExcel(); enableSummaryConfirm();" class="btn-action w-100" style="background:#0284c7; padding:12px; font-size:1rem; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">📥 EXCEL</button>
                <button type="button" onclick="downloadSummaryPDF(); enableSummaryConfirm();" class="btn-action w-100" style="background:#be123c; padding:12px; font-size:1rem; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">🖨️ PDF / PRINT</button>
             </div>
             <button type="button" onclick="openCardStudio()" class="btn-action w-100 mb-10" style="background: linear-gradient(90deg, #f59e0b, #d97706); padding:15px; font-size:1.1rem; color:black; font-weight:900; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">🌟 OPEN PLAYER CARD STUDIO</button>
             </div>`;
             
    showModal(isGameOver ? "🏁 MATCH COMPLETE" : (isTransition ? `🛑 END OF INNINGS ${state.inningsNum}` : "📋 DETAILED MATCH SCORECARD"), html, () => { 
        state.matchResult = el('finalMatchResult') ? el('finalMatchResult').value : autoRes; 
        if(el('inningAllowancesInput')) { let val = parseInt(el('inningAllowancesInput').value) || 0; state.current.allowances = val; if (state.inningsSummaries.length > 0 && state.inningsNum === state.inningsSummaries.length) { state.inningsSummaries[state.inningsSummaries.length - 1].allowances = val; } }
        closeModal(); 
        setTimeout(() => { if (isGameOver) { logCareerStats(); setTimeout(() => { resetMatch(); }, 1000); } else if (isTransition) { openTransitionManager(); } }, 300);
    }, hideCancel, "700px", confirmBtnText, requiresDownload);
    el('modalCancelBtn').innerText = "🔙 Go Back & Edit";
}

function endInnings() { 
    try {
        saveState(); 
        if (state.current.bIdx !== null) finalizeOver(true); 
        state.current.inningsEndTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); 
        
        let fF = JSON.parse(JSON.stringify(state.current.fow || [])); 
        if(state.current.sIdx !== null && state.current.nsIdx !== null && state.current.wkts < 10) {
            let sBName = getBatTeam().players[state.current.sIdx] ? getBatTeam().players[state.current.sIdx].name : "Unknown"; let nsBName = getBatTeam().players[state.current.nsIdx] ? getBatTeam().players[state.current.nsIdx].name : "Unknown"; let pRuns = state.current.currPartnership ? state.current.currPartnership.runs : 0; let pBalls = state.current.currPartnership ? state.current.currPartnership.balls : 0; fF.push({ wktNum: "Unbroken", runs: state.current.runs, overs: formatOver(state.current.balls), outBatter: "-", partner: sBName + " & " + nsBName, pRuns: pRuns, pBalls: pBalls }); 
        }
        
        state.inningsSummaries.push({ innNum: state.inningsNum, batTeam: getBatTeam().name, bowlTeam: getBowlTeam().name, runs: state.current.runs, wkts: state.current.wkts, overs: formatOver(state.current.balls), penalties: state.current.penalties || 0, overHistory: JSON.parse(JSON.stringify(state.current.overHistory || [])), batters: JSON.parse(JSON.stringify(getBatTeam().players || [])), bowlers: JSON.parse(JSON.stringify(getBowlTeam().players || [])), fow: fF, extras: JSON.parse(JSON.stringify(state.current.extras)), startTime: state.current.inningsStartTime || "-", endTime: state.current.inningsEndTime, allowances: state.current.allowances || 0 }); 
        showMatchSummary(); 
    } catch(e) { console.error("End Innings Error:", e); alert("Error saving Innings Summary. Check console."); }
}

function openTransitionManager() {
    let nextInn = state.inningsNum + 1; let defaultBat = state.bowlingKey; let enforceBat = state.battingKey; let disableFollowOn = (state.matchSettings.matchType === 't20' || state.matchSettings.matchType === 'oneday') ? 'disabled' : '';
    let html = `<div class="mb-10 text-primary font-bold" style="text-align:center; font-size:1.2rem;">Setup Innings ${nextInn}</div><label class="text-accent">Who will Bat Next?</label><select id="nextBatTeam" class="modal-input w-100"><option value="${defaultBat}">Standard Rotation (${state.teams[defaultBat].name})</option><option value="${enforceBat}" ${disableFollowOn}>Follow-On / Bat Again (${state.teams[enforceBat].name})</option></select><label class="mt-10 text-danger">Special Actions</label><select id="specialAction" class="modal-input w-100"><option value="none">Normal Play</option><option value="forfeit">Forfeit Innings ${nextInn}</option></select>`;
    showModal("🔄 Innings Transition", html, function() { let nBat = el('nextBatTeam').value; let nBowl = (nBat === 'A') ? 'B' : 'A'; let action = el('specialAction').value; closeModal(); setTimeout(() => { executeTransition(nBat, nBowl, action); }, 300); }, true);
}

function executeTransition(nBat, nBowl, action) { 
    state.inningsNum++; state.battingKey = nBat; state.bowlingKey = nBowl; 
    if (action === 'forfeit') { state.inningsSummaries.push({ innNum: state.inningsNum, batTeam: state.teams[nBat].name, bowlTeam: state.teams[nBowl].name, runs: 0, wkts: 0, overs: "0.0", penalties: 0, overHistory: [], batters: JSON.parse(JSON.stringify(state.teams[nBat].players)), bowlers: JSON.parse(JSON.stringify(state.teams[nBowl].players)), fow: [], extras: {w:0, nb:0, b:0, lb:0}, startTime: "-", endTime: "-", allowances: 0 }); remarkLog.push({ over: "0.0", time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), batters: "-", bowler: "-", fielder: "-", remark: `Innings ${state.inningsNum} Forfeited by ${state.teams[nBat].name}` }); showMatchSummary(); return; }
    
    state.current = { runs: state.teams[state.battingKey].pendingPenalties || 0, wkts:0, balls:0, sIdx:null, nsIdx:null, bIdx:null, isFreeHit: false, penalties: state.teams[state.battingKey].pendingPenalties || 0, lastOverBowlers: new Set(), extras: {w:0, nb:0, b:0, lb:0}, recentBalls: [], currentOverLog: [], runsInThisOver: 0, bowlersInCurrentOver: new Set(), overHistory: [], currPartnership: { runs: 0, balls: 0 }, fow: [], activeBreak: null, activeBreakStartTime: null, activeBreakInsp: null, pendingBreakMins: 0, inningsStartTime: null, inningsEndTime: null, allowances: 0 }; 
    state.teams[state.battingKey].pendingPenalties = 0; 
    ['A', 'B'].forEach(t => state.teams[t].players.forEach(p => { p.r = p.b = p.f = p.s = p.o = p.rc = p.w = p.m = p.ex = p.wd = p.nb = p.cw = p.catches = p.stumpings = p.runouts = p.byes = p.legbyes = p.quotaOvers = p.breakMins = 0; p.out = p.hasBatted = false; p.outOnDuck = 0; p.dismissalInfo = ""; p.inTime = p.outTime = null; })); 
    updateUI(); setTimeout(() => { openMatchStartModal(); }, 100); 
}

function executeEndOver() {
    saveState(); finalizeOver(false); manualRotate(); state.current.bIdx = null; updateUI();
    if (state.current.overHistory.length >= state.matchSettings.maxOvers) { setTimeout(endInnings, 100); } else { setTimeout(() => openSelector('bowler', "Select Next Bowler"), 50); }
}

function manualEndOver() {
    if (state.current.bIdx === null) { alert("No bowler is currently active!"); return; }
    let cur = state.current; let completedOvers = cur.overHistory.length; let ballsInPreviousOvers = completedOvers > 0 ? (cur.overHistory[completedOvers - 1].totalBallsAtEnd || (completedOvers * 6)) : 0; let currentOverBalls = Math.max(0, cur.balls - ballsInPreviousOvers);
    if (currentOverBalls === 0) { alert("No legal deliveries bowled in this over yet!"); return; }
    if (currentOverBalls < 6) { showModal("⚠️ Early Over Call", `<div class="text-center mb-10 text-accent" style="font-size:1.1rem;">Only <b>${currentOverBalls}</b> legal deliveries bowled!</div><div class="text-center text-muted" style="font-size:0.85rem;">Do you really want to end this over early?</div>`, () => { closeModal(); executeEndOver(); }, false, "360px", "Yes, Call Over"); return; }
    executeEndOver();
}

function checkAutoOverPrompt() {
    let cur = state.current;
    if (cur.wkts >= 10 || checkTargetReached()) return;

    let completedOvers = cur.overHistory.length;
    let ballsInPreviousOvers = completedOvers > 0 ? (cur.overHistory[completedOvers - 1].totalBallsAtEnd || (completedOvers * 6)) : 0;
    let currentOverBalls = Math.max(0, cur.balls - ballsInPreviousOvers);

    if (currentOverBalls === 6) {
        let strikerOut = cur.sIdx !== null && getBatTeam().players[cur.sIdx].out;
        let nonStrikerOut = cur.nsIdx !== null && getBatTeam().players[cur.nsIdx].out;
        if (strikerOut || nonStrikerOut) return; 

        let scoringBox = el('scoringEventsBox');
        if(scoringBox) { scoringBox.style.pointerEvents = 'none'; scoringBox.style.opacity = '0.6'; }

        setTimeout(() => {
            if (state.current.bIdx === null) {
                if(scoringBox) { scoringBox.style.pointerEvents = 'auto'; scoringBox.style.opacity = '1'; }
                return; 
            } 
            showModal("🔄 Over Completed", `<div class="text-center mb-10 text-accent font-bold" style="font-size:1.1rem;">6 legal deliveries bowled!</div><div class="text-center text-muted" style="font-size:0.85rem;">Click <b>Call Over</b> to select the next bowler, or click <b>Cancel</b> if the umpire allows play to continue (7th ball).</div>`, () => { closeModal(); executeEndOver(); }, false, "360px", "Call Over");
        }, 600); 
    }
}

function getTeamOversDisplay() {
    let cur = state.current; let completedOvers = cur.overHistory.length; let ballsInPreviousOvers = completedOvers > 0 ? (cur.overHistory[completedOvers - 1].totalBallsAtEnd || (completedOvers * 6)) : 0; let currentOverBalls = Math.max(0, cur.balls - ballsInPreviousOvers);
    return completedOvers + "." + currentOverBalls;
}

function resetMatch() { 
    state.matchBreaks = []; state.inningsNum = 1; state.inningsSummaries = []; state.matchResult = ""; 
    stateHistory = []; remarkLog = []; state.matchId = ""; 
    state.current = { runs:0, wkts:0, balls:0, sIdx:null, nsIdx:null, bIdx:null, isFreeHit: false, penalties: 0, lastOverBowlers: new Set(), extras: {w:0, nb:0, b:0, lb:0}, recentBalls: [], currentOverLog: [], runsInThisOver: 0, bowlersInCurrentOver: new Set(), overHistory: [], currPartnership: { runs: 0, balls: 0 }, fow: [], activeBreak: null, activeBreakStartTime: null, activeBreakInsp: null, pendingBreakMins: 0, inningsStartTime: null, inningsEndTime: null, allowances: 0 }; 
    el('inningsHistoryText').innerHTML = ''; el('scoringView').classList.add('hidden'); el('setupView').classList.remove('hidden'); 
    localStorage.removeItem('cricStat_activeMatch');
    if (window.matchChart) window.matchChart.destroy(); el('setupMatchId').value = ''; if (el('setupDate').value) { generateMatchId(); }
}
    
function closeModal() { 
    el('dynamicModal').classList.add('hidden'); 
    let scoringBox = el('scoringEventsBox');
    if (scoringBox) { scoringBox.style.pointerEvents = 'auto'; scoringBox.style.opacity = '1'; }
}

function manualRotateUI() { saveState(); manualRotate(); }
function manualRotate() { [state.current.sIdx, state.current.nsIdx] = [state.current.nsIdx, state.current.sIdx]; updateUI(); }
// ==========================================
// ADMIN TO SCORER BRIDGE (FETCH MATCH LOGIC)
// ==========================================
function fetchOfficialMatch() {
    const matchId = document.getElementById('syncMatchId').value.trim().toUpperCase();
    const pin = document.getElementById('syncScorerPin').value.trim();
    const statusEl = document.getElementById('fetchStatus');
    
    if (!matchId) {
        statusEl.innerText = "❌ Please enter a Match ID.";
        statusEl.style.color = "#ef4444";
        return;
    }
    
    // BASIC AUTHENTICATION LAYER
    // In production, this can verify against Supabase. For now, we use a standard Scorer PIN.
    if (pin !== "1234" && pin !== "SCORER") { 
        statusEl.innerText = "❌ Unauthorized: Invalid Scorer PIN.";
        statusEl.style.color = "#ef4444";
        return;
    }

    // Retrieve the locked postings from local storage
    const storedMatches = JSON.parse(localStorage.getItem('cricket_matches') || "[]");
    const matchData = storedMatches.find(m => m.matchNum.toUpperCase() === matchId);

    if (!matchData) {
        statusEl.innerText = "❌ Match ID not found in Official Postings.";
        statusEl.style.color = "#ef4444";
        return;
    }

    // 1. Auto-Fill Match Details
    document.getElementById('setupTournament').value = matchData.tournament || "";
    document.getElementById('setupMatchId').value = matchData.matchNum || "";
    
    // 2. Auto-Fill Umpires (Handling comma-separated lists from Admin)
    let umps = (matchData.umpires || "").split(",").map(u => u.trim());
    document.getElementById('u1').value = umps[0] || "";
    document.getElementById('u2').value = umps[1] || "";
    if(umps[2]) document.getElementById('tvUmpire').value = umps[2];
    if(umps[3]) document.getElementById('u4').value = umps[3];

    // 3. Auto-Fill Scorers
    let scors = (matchData.scorers || "").split(",").map(s => s.trim());
    document.getElementById('s1').value = scors[0] || "";
    document.getElementById('s2').value = scors[1] || "";

    // 4. Auto-Fill Referees
    document.getElementById('setupObsRef').value = matchData.referees || "";

    // 5. Auto-Fill Teams & Trigger Roster Loading
    document.getElementById('nameTeamA').value = matchData.team1 === "TBD" ? "" : matchData.team1;
    document.getElementById('nameTeamB').value = matchData.team2 === "TBD" ? "" : matchData.team2;

    // Trigger existing functions to physically render the team names and load squad arrays
    updateTeamNames();
    if(document.getElementById('nameTeamA').value) loadTeamRoster('A', document.getElementById('nameTeamA').value);
    if(document.getElementById('nameTeamB').value) loadTeamRoster('B', document.getElementById('nameTeamB').value);

    // Success Message
    statusEl.innerText = `✅ Match Found! Auto-filled data for ${matchData.matchName}. You may edit any field before calling 'Play'.`;
    statusEl.style.color = "#10b981";
    // ==========================================
        // ADMIN MATCH SYNC (FETCH VIA 4-DIGIT PIN)
        // ==========================================
        function fetchOfficialMatch() {
            const pin = document.getElementById('match-pin-input').value.trim();
            const statusEl = document.getElementById('sync-status');
            
            if(!pin || pin.length !== 4) {
                statusEl.innerHTML = '<span style="color: #ef4444;">Please enter a valid 4-digit PIN.</span>';
                return;
            }

            // Fetch the master list of all matches
            const storedMatches = JSON.parse(localStorage.getItem('cricket_matches') || '[]');
            const matchData = storedMatches.find(m => m.pin === pin);

            if(matchData) {
                // Change 'team1-name' and 'team2-name' to match whatever IDs your scorer file uses!
                document.getElementById('team1-name').value = matchData.team1;
                document.getElementById('team2-name').value = matchData.team2;
                
                statusEl.innerHTML = `<span style="color: #10b981;">✅ Synced: ${matchData.matchName} (${matchData.team1} vs ${matchData.team2})</span>`;
                
                // Lock inputs
                document.getElementById('team1-name').readOnly = true;
                document.getElementById('team2-name').readOnly = true;
                document.getElementById('team1-name').style.border = "1px solid #10b981";
                document.getElementById('team2-name').style.border = "1px solid #10b981";
            } else {
                statusEl.innerHTML = `<span style="color: #ef4444;">❌ Invalid PIN. No match found.</span>`;
            }
        }
}
