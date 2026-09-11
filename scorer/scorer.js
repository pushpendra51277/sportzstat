// ==========================================
// SESSION 1: SUPABASE CLOUD DATABASE CONFIGURATION
// ==========================================
const SUPABASE_URL = "https://cavkoylkbcyhsifrsjyd.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_wklRlSZbzArKFCq31Ugnrw_JWAJkS4K"; 
const supabaseClient = (typeof window.supabase !== 'undefined' && SUPABASE_URL.includes("supabase.co")) 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) 
    : null;

if (typeof window.Chart !== 'undefined') { Chart.defaults.color = '#cbd5e1'; Chart.defaults.borderColor = '#334155'; } window.matchChart = null; 
const el = id => document.getElementById(id); const getBatTeam = () => state.teams[state.battingKey]; const getBowlTeam = () => state.teams[state.bowlingKey]; const formatOver = balls => Math.floor(balls/6) + "." + (balls%6); const getBadgeHtml = b => b.type === 'divider' ? `<span class="over-divider">/</span>` : `<div class="ball-badge ball-${b.type}">${b.label}</div>`;
const calcMins = (inT, outT, brk = 0) => { if(!inT) return "-"; try { let endT = outT || new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); let d1 = new Date("01/01/2000 " + inT), d2 = new Date("01/01/2000 " + endT); if(d2 < d1) d2.setDate(d2.getDate() + 1); let mins = Math.round((d2 - d1) / 60000) - brk; if (mins < 0) mins = 0; return isNaN(mins) ? "-" : mins + "m"; } catch(e) { return "-"; } };

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
let cloudRosters = { A: [], B: [] };

window.onload = function() {
    let savedMatch = localStorage.getItem('cricStat_activeMatch');
    if(savedMatch) {
        showModal("Resume Match?", "An unfinished match was found. Would you like to resume it from where you left off?", function() {
            try {
                let parsedState = JSON.parse(savedMatch); parsedState.current.lastOverBowlers = new Set(parsedState.current.lastOverBowlers); parsedState.current.bowlersInCurrentOver = new Set(parsedState.current.bowlersInCurrentOver); state = parsedState;
                el('setupView').classList.add('hidden'); el('scoringView').classList.remove('hidden'); el('displayTournament').innerText = state.matchSettings.tournament || "MATCH IN PROGRESS"; 
                if (state.matchSettings.matchType === 'multiday') { el('breakBtn').classList.remove('hidden'); }
                if(!el('setupVenue').value) { el('setupVenue').value = "Official Ground"; }
                updateUI(); closeModal();
            } catch(e) { console.error("Corrupted local state.", e); hardResetSystem(); }
        }, false, "360px", "Resume");
        el('modalCancelBtn').innerText = "Start Fresh"; el('modalCancelBtn').onclick = function() { localStorage.removeItem('cricStat_activeMatch'); closeModal(); };
    }
};

function hardResetSystem() { if(confirm("WARNING: This will wipe ongoing match data from memory. Continue?")) { localStorage.removeItem('cricStat_activeMatch'); location.reload(); } }
function toggleFullScreen() { let fsBtn = el('fsBtn'); if (!document.fullscreenElement) { document.documentElement.requestFullscreen().then(() => { fsBtn.innerText = '🔳 EXIT FULL SCREEN'; }).catch(err => alert("Fullscreen not supported.")); } else { if (document.exitFullscreen) { document.exitFullscreen().then(() => { fsBtn.innerText = '🔲 FULL'; }); } } }
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { el('fsBtn').innerText = '🔲 FULL'; } });


// ==========================================
// SESSION 1: CLOUD GATEWAY LOGIC
// ==========================================

async function authenticateCloudMatch() {
    if (!supabaseClient) { alert("Supabase SDK missing."); return; }

    const matchId = document.getElementById('cloudMatchId').value.trim().toUpperCase();
    const pin = document.getElementById('cloudMatchPin').value.trim();
    const statusEl = document.getElementById('cloudSyncStatus');

    if(!matchId || !pin) { statusEl.innerHTML = '<span style="color: #ef4444;">❌ Enter Match ID and PIN.</span>'; return; }
    
    statusEl.innerHTML = '<span style="color: #f59e0b;">⏳ Connecting to Master Database...</span>';

    const { data: matchRow, error: matchErr } = await supabaseClient.from('matches').select('*').eq('match_id', matchId).single();

    if (matchErr || !matchRow || matchRow.scorer_pin !== pin) {
        statusEl.innerHTML = `<span style="color: #ef4444;">❌ Access Denied. Incorrect Match ID or PIN.</span>`; 
        return;
    }

    const mData = matchRow.full_state || {};
    state.matchId = matchId;
    state.teams.A.name = mData.team1 || "Team A";
    state.teams.B.name = mData.team2 || "Team B";
    state.matchSettings.tournament = mData.tournament || "Official Match";

    document.getElementById('gwTournamentName').innerText = state.matchSettings.tournament;
    document.getElementById('gwMatchId').innerText = `ID: ${matchId}`;
    document.getElementById('gwTeamAName').innerText = state.teams.A.name;
    document.getElementById('gwTeamBName').innerText = state.teams.B.name;
    
    // Auto-fill UNLOCKED Officials & Venue
    el('setupTournament').value = state.matchSettings.tournament;
    el('setupMatchId').value = matchId;
    el('setupVenue').value = mData.venue || "Official Ground";
    el('setupDate').value = new Date().toISOString().split('T')[0];

    let umps = mData.umpires ? mData.umpires.split(',') : [];
    el('u1').value = umps[0] ? umps[0].trim() : "";
    el('u2').value = umps[1] ? umps[1].trim() : "";
    el('tvUmpire').value = umps[2] ? umps[2].trim() : "";
    el('u4').value = umps[3] ? umps[3].trim() : "";

    let scrs = mData.scorers ? mData.scorers.split(',') : [];
    el('s1').value = scrs[0] ? scrs[0].trim() : "";
    el('s2').value = scrs[1] ? scrs[1].trim() : "";

    el('setupObsRef').value = mData.referees || "";

    const tossSelect = document.getElementById('gwTossWinner');
    tossSelect.innerHTML = `<option value="A">${state.teams.A.name}</option><option value="B">${state.teams.B.name}</option>`;

    statusEl.innerHTML = `<span style="color: #f59e0b;">⏳ Fetching Master Squads...</span>`;
    await fetchCloudRosters('A', state.teams.A.name);
    await fetchCloudRosters('B', state.teams.B.name);

    // Populate Opening Dropdowns
    refreshOpeningDropdowns();

    document.getElementById('gatewayAuthBox').classList.add('hidden');
    document.getElementById('gatewaySetupBox').classList.remove('hidden');
}

async function fetchCloudRosters(teamKey, teamName) {
    const { data, error } = await supabaseClient.from('team_rosters').select('player_id, players(full_name, playing_role)').eq('team_name', teamName);

    const listEl = document.getElementById(`gwTeam${teamKey}List`);
    cloudRosters[teamKey] = [];

    if (error || !data || data.length === 0) {
        listEl.innerHTML = `<div style="color: #ef4444; font-size: 0.85rem; font-style: italic;">No official roster found in cloud. Admin must map players in Tournament Wizard.</div>`;
        return;
    }

    let html = "";
    data.forEach((row, idx) => {
        if(row.players) {
            cloudRosters[teamKey].push({ id: row.player_id, name: row.players.full_name, role: row.players.playing_role });
            let isChecked = idx < 11 ? "checked" : "";
            html += `
            <label style="display: flex; align-items: center; background: #0f172a; padding: 10px; border-radius: 6px; border: 1px solid #334155; cursor: pointer;">
                <input type="checkbox" class="roster-chk-${teamKey}" value="${row.player_id}" ${isChecked} onchange="refreshOpeningDropdowns()" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <div>
                    <div style="color: white; font-weight: bold;">${row.players.full_name}</div>
                    <div style="color: #94a3b8; font-size: 0.7rem;">${row.players.playing_role || 'Player'}</div>
                </div>
            </label>`;
        }
    });
    listEl.innerHTML = html;
}

// ==========================================
// DYNAMIC OPENING PLAYERS POPULATOR
// ==========================================
function refreshOpeningDropdowns() {
    let win = document.getElementById('gwTossWinner').value || 'A';
    let dec = document.getElementById('gwTossDecision').value || 'bat';
    let batKey = ((win === 'A' && dec === 'bat') || (win === 'B' && dec === 'bowl')) ? 'A' : 'B';
    let bowlKey = (batKey === 'A') ? 'B' : 'A';

    let batChecked = Array.from(document.querySelectorAll(`.roster-chk-${batKey}:checked`)).map(cb => {
        let p = cloudRosters[batKey].find(item => item.id === cb.value);
        return p ? { id: p.id, name: p.name } : null;
    }).filter(Boolean);

    let bowlChecked = Array.from(document.querySelectorAll(`.roster-chk-${bowlKey}:checked`)).map(cb => {
        let p = cloudRosters[bowlKey].find(item => item.id === cb.value);
        return p ? { id: p.id, name: p.name } : null;
    }).filter(Boolean);

    const sEl = document.getElementById('gwStriker');
    const nsEl = document.getElementById('gwNonStriker');
    const bEl = document.getElementById('gwBowler');

    let curS = sEl.value;
    let curNS = nsEl.value;
    let curB = bEl.value;

    if (batChecked.length > 0) {
        sEl.innerHTML = batChecked.map((p, idx) => `<option value="${p.id}" ${p.id === curS || (!curS && idx===0)?'selected':''}>${p.name}</option>`).join('');
        nsEl.innerHTML = batChecked.map((p, idx) => `<option value="${p.id}" ${p.id === curNS || (!curNS && idx===1)?'selected':''}>${p.name}</option>`).join('');
    } else {
        sEl.innerHTML = '<option value="">No Batters Selected</option>';
        nsEl.innerHTML = '<option value="">No Batters Selected</option>';
    }

    if (bowlChecked.length > 0) {
        bEl.innerHTML = bowlChecked.map((p, idx) => `<option value="${p.id}" ${p.id === curB || (!curB && idx===0)?'selected':''}>${p.name}</option>`).join('');
    } else {
        bEl.innerHTML = '<option value="">No Bowlers Selected</option>';
    }
}

// ==========================================
// INITIALIZE & LAUNCH ENGINE
// ==========================================
function initializeCloudEngine() {
    const matchType = document.getElementById('gwMatchType').value;
    
    let selectedA = Array.from(document.querySelectorAll('.roster-chk-A:checked')).map(cb => cb.value);
    let selectedB = Array.from(document.querySelectorAll('.roster-chk-B:checked')).map(cb => cb.value);

    if (matchType !== 'practice' && (selectedA.length !== 11 || selectedB.length !== 11)) {
        if(!confirm(`Warning: You selected ${selectedA.length} players for Team A and ${selectedB.length} players for Team B. Official matches require exactly 11. Proceed anyway?`)) return;
    } else if (selectedA.length < 2 || selectedB.length < 2) {
        alert("CRITICAL ERROR: Select at least 2 players per team."); return;
    }

    let sUUID = document.getElementById('gwStriker').value;
    let nsUUID = document.getElementById('gwNonStriker').value;
    let bUUID = document.getElementById('gwBowler').value;

    if(!sUUID || !nsUUID || !bUUID) {
        alert("Please select the Opening Striker, Non-Striker, and Bowler from the dropdowns.");
        return;
    }
    if(sUUID === nsUUID) {
        alert("Striker and Non-Striker must be different players!");
        return;
    }

    ['A', 'B'].forEach(teamKey => {
        let selectedUUIDs = teamKey === 'A' ? selectedA : selectedB;
        let fullCloudRoster = cloudRosters[teamKey];
        
        state.teams[teamKey].players = [];
        
        selectedUUIDs.forEach(uuid => {
            let pData = fullCloudRoster.find(p => p.id === uuid);
            if(pData) {
                state.teams[teamKey].players.push({ 
                    regNo: uuid,
                    name: pData.name, 
                    skill: pData.role || "",
                    desig: "", r:0, b:0, f:0, s:0, out:false, outOnDuck:0, hasBatted: false, 
                    dismissalInfo: "", o:0, rc:0, w:0, m:0, ex:0, wd:0, nb:0, byes:0, legbyes:0, 
                    cw:0, catches:0, stumpings:0, runouts:0, quotaOvers: 0, inTime: null, outTime: null, 
                    isPlayingXI: true, breakMins: 0 
                });
            }
        });
        
        for(let i = state.teams[teamKey].players.length; i < 19; i++) {
             state.teams[teamKey].players.push({
                 regNo: "", name: "Empty Slot", skill: "", desig: "", r:0, b:0, f:0, s:0, out:false, outOnDuck:0, hasBatted: false, 
                dismissalInfo: "", o:0, rc:0, w:0, m:0, ex:0, wd:0, nb:0, byes:0, legbyes:0, cw:0, catches:0, stumpings:0, runouts:0, quotaOvers: 0, inTime: null, outTime: null, isPlayingXI: false, breakMins: 0 
             });
        }
    });

    let win = document.getElementById('gwTossWinner').value; 
    let dec = document.getElementById('gwTossDecision').value; 
    state.battingKey = ((win === 'A' && dec === 'bat') || (win === 'B' && dec === 'bowl')) ? 'A' : 'B'; 
    state.bowlingKey = state.battingKey === 'A' ? 'B' : 'A';

    // Link Opener Indexes
    let sIdx = state.teams[state.battingKey].players.findIndex(p => p.regNo === sUUID);
    let nsIdx = state.teams[state.battingKey].players.findIndex(p => p.regNo === nsUUID);
    let bIdx = state.teams[state.bowlingKey].players.findIndex(p => p.regNo === bUUID);

    if(sIdx === -1 || nsIdx === -1 || bIdx === -1) {
        alert("Error mapping opening players. Verify they are checked in the Playing XI.");
        return;
    }

    saveState();
    state.current.sIdx = sIdx;
    state.current.nsIdx = nsIdx;
    state.current.bIdx = bIdx;

    let nowTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    state.teams[state.battingKey].players[sIdx].hasBatted = true;
    state.teams[state.battingKey].players[sIdx].inTime = nowTime;
    state.teams[state.battingKey].players[nsIdx].hasBatted = true;
    state.teams[state.battingKey].players[nsIdx].inTime = nowTime;
    state.current.bowlersInCurrentOver.add(bIdx);
    state.current.currPartnership = { runs: 0, balls: 0 };
    state.current.inningsStartTime = nowTime;

    state.matchSettings.matchType = matchType;
    if(matchType === 't20') { state.matchSettings.maxOvers = 20; state.matchSettings.bowlerQuota = 4; state.matchSettings.maxInnings = 2; } 
    else if(matchType === 'oneday') { state.matchSettings.maxOvers = 50; state.matchSettings.bowlerQuota = 10; state.matchSettings.maxInnings = 2; } 
    else { state.matchSettings.maxOvers = 999; state.matchSettings.bowlerQuota = 999; state.matchSettings.maxInnings = 4; }
    state.matchSettings.originalMaxOvers = state.matchSettings.maxOvers;
    if (matchType === 'multiday') { el('breakBtn').classList.remove('hidden'); }

    el('displayTournament').innerText = state.matchSettings.tournament; 
    
    document.getElementById('setupView').classList.add('hidden'); 
    document.getElementById('scoringView').classList.remove('hidden'); 
    
    updateUI(); 
}


// --- MANUAL DATA ENTRY SYSTEM (PRESERVED) ---
function openManualEntryView() { el('setupView').classList.add('hidden'); el('manualEntryView').classList.remove('hidden'); }
function closeManualEntryView() { el('manualEntryView').classList.add('hidden'); el('setupView').classList.remove('hidden'); }
function fixOversInput(inp) { let v = parseFloat(inp.value); if(isNaN(v)) return; let f = Math.floor(v); let d = Math.round((v - f) * 10); if (d >= 6) { f += Math.floor(d / 6); d = d % 6; inp.value = f + (d > 0 ? d / 10 : 0); } }

function generateManualGrids() {
    let tA = el('meTeamA').value.trim() || "Team A"; let tB = el('meTeamB').value.trim() || "Team B"; el('meTitleA').innerText = tA + " Stats"; el('meTitleB').innerText = tB + " Stats";
    function buildGridRows(teamName) { let tData = teamRegistry[teamName]; let rows = `<tr><th>Player Name</th><th>Reg No</th><th title="Not Out">NO*</th><th title="Runs">R</th><th title="Balls">B</th><th>4s</th><th>6s</th><th title="Overs (e.g. 2.3)">Ov</th><th title="Maidens">M</th><th title="Runs Conceded">R(Bwl)</th><th title="Wickets">W</th><th title="Wides Bowled">Wd</th><th title="No Balls Bowled">NB</th><th title="Catches Taken">Ct</th><th title="Stumpings Made">St</th><th title="Run Outs Effected">RO</th></tr>`; for(let i=0; i<15; i++) { let pName = "", pReg = ""; if(tData && tData.players[i]) { pName = tData.players[i].n || ""; pReg = tData.players[i].reg || ""; } let pfx = (teamName===tA ? "mea" : "meb") + "-" + i; rows += `<tr><td><input type="text" id="${pfx}-name" value="${pName}" placeholder="Player ${i+1}" style="width:120px;"></td><td><input type="text" id="${pfx}-reg" value="${pReg}" placeholder="Reg No" style="width:60px;"></td><td style="text-align:center;"><input type="checkbox" id="${pfx}-no" style="width:16px;height:16px; cursor:pointer;" title="Check if Not Out"></td><td><input type="number" id="${pfx}-r" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-b" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-4s" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-6s" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-o" class="m-input-num" min="0" step="0.1" onblur="fixOversInput(this)"></td><td><input type="number" id="${pfx}-m" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-br" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-w" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-wd" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-nb" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-ct" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-st" class="m-input-num" min="0"></td><td><input type="number" id="${pfx}-ro" class="m-input-num" min="0"></td></tr>`; } return rows; }
    el('meGridA').innerHTML = buildGridRows(tA); el('meGridB').innerHTML = buildGridRows(tB); el('meNoGridsBtn').classList.add('hidden'); el('meGridsContainer').classList.remove('hidden');
}

async function syncManualMatchData() { 
    if (!supabaseClient) { alert("Supabase is not connected! Please verify your keys."); return; }
    let manualMatchId = el('meId').value || "MANUAL-" + Date.now();
    let manualDataStr = JSON.stringify({ isManualSync: true, date: el('meDate').value, tournament: el('meTourn').value, teamA: el('meTeamA').value, teamB: el('meTeamB').value });
    try {
        const { error } = await supabaseClient.from('completed_matches').upsert({ match_id: manualMatchId, final_data: manualDataStr }, { onConflict: 'match_id' });
        if (error) throw error; alert("Success! Manual match data has been synced to Supabase.");
    } catch(e) { alert("Failed to sync: " + e.message); }
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

function openEditTarget() {
    if (state.inningsNum === 1) { alert("Target can only be edited in the 2nd innings!"); return; }
    let curT = state.matchSettings.customTarget || (state.inningsSummaries[state.inningsNum - 2].runs + 1), curO = state.matchSettings.customTargetOvers || state.matchSettings.originalMaxOvers, curM = state.matchSettings.targetMethod || "";
    let html = `<label class="text-primary">Revised Target Runs</label><input type="number" id="modTargetRuns" class="modal-input w-100" value="${curT}"><label class="text-primary mt-10">Revised Max Overs</label><input type="number" id="modTargetOvers" class="modal-input w-100" value="${curO}" step="0.1"><label class="text-primary mt-10">Method (e.g. VJD, DLS, or leave blank)</label><input type="text" id="modTargetMethod" class="modal-input w-100" value="${curM}" placeholder="VJD"><button type="button" class="btn-action w-100 mt-15" style="background:#475569;" onclick="clearCustomTarget()">Reset to Original Target</button>`;
    showModal("🎯 Edit Match Target", html, () => { saveState(); state.matchSettings.customTarget = parseInt(el('modTargetRuns').value) || null; state.matchSettings.customTargetOvers = parseFloat(el('modTargetOvers').value) || null; state.matchSettings.targetMethod = el('modTargetMethod').value.trim().toUpperCase(); if (state.matchSettings.customTargetOvers) { state.matchSettings.maxOvers = state.matchSettings.customTargetOvers; } closeModal(); updateUI(); });
}

function clearCustomTarget() { saveState(); state.matchSettings.customTarget = null; state.matchSettings.customTargetOvers = null; state.matchSettings.targetMethod = ""; state.matchSettings.maxOvers = state.matchSettings.originalMaxOvers; closeModal(); updateUI(); }
function getTargetBalls() { let ov = state.matchSettings.maxOvers; let f = Math.floor(ov); let r = Math.round((ov - f) * 10); return f * 6 + r; }

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
    
    let ballData = {
        match_id: state.matchId,
        innings_no: state.inningsNum,
        over_no: Math.floor(state.current.balls / 6),
        ball_number: (state.current.balls % 6) + 1,
        striker_id: batterObj && batterObj.regNo && batterObj.regNo.length > 15 ? batterObj.regNo : null,
        non_striker_id: null, 
        bowler_id: bowlerObj && bowlerObj.regNo && bowlerObj.regNo.length > 15 ? bowlerObj.regNo : null,
        runs_batter: runsBat,
        runs_extra: runsExtra,
        is_valid_ball: (extraType !== 'Wide' && extraType !== 'No-Ball'),
        extra_type: extraType,
        is_wicket: isWicket,
        wicket_type: wicketType || null,
        dismissed_player_name: dismissedObj ? dismissedObj.name : null
    };

    try {
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
    
    logBallEvent(s, b, runs, 0, 'None', false, null, null);

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
    logBallEvent(s, b, runsBat, runsExt, exLabel, false, null, null); 
    
    if(ex % 2 !== 0) manualRotate(); 
    if (checkTargetReached()) { finalizeOver(true); closeModal(); setTimeout(endInnings, 100); return; }
    closeModal(); updateUI(); checkAutoOverPrompt();
}

function openRetire() { if(state.current.bIdx === null) return openSelector('bowler', "Select Bowler"); showModal("🏃 Process Retire", `<label class="text-primary">Batter Out</label><select id="wWho" class="modal-input w-100"><option value="striker">Striker</option><option value="nonstriker">Non-Striker</option></select><label class="text-primary mt-5">Dismissal Type</label><select id="wType" class="modal-input w-100"><option value="RetiredHurt">Retired - Not Out</option><option value="RetiredOut">Retired - Out</option></select>`, processWicketSubmit); }

function openWicket() { 
    if(state.current.bIdx === null) return openSelector('bowler', "Select Bowler"); 
    let fOpts = `<option value="">-- Select Fielder (Sub) --</option>`; getBowlTeam().players.forEach(p => { if(p.name && p.name !== "Empty Slot") fOpts += `<option value="${p.name}">${p.name}</option>`; });
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
        logBallEvent(s, b, 0, 0, 'None', true, wType, oB);
    } 
    else {
        cur.wkts++; oB.out = true; 
        let runsScored = 0, runType = 'bat'; let runsExt = 0; let exLabel = 'None';
        
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
        
        logBallEvent(s, b, runsBat, runsExt, exLabel, true, wType, oB); 
    }

    oB.outTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    cur.fow.push({ wktNum: cur.wkts, runs: cur.runs, overs: formatOver(cur.balls), outBatter: oB.name, partner: getBatTeam().players[isSO ? cur.nsIdx : cur.sIdx].name, pRuns: cur.currPartnership.runs, pBalls: cur.currPartnership.balls }); cur.currPartnership = { runs: 0, balls: 0 };
    
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
    let o = getBowlTeam().players.map((p, i) => (p.isPlayingXI && p.name !== "Empty Slot") ? `<option value="${i}" ${p.skill && p.skill.includes('WK') ? 'selected' : ''}>${p.name}</option>` : '').join(''); 
    showModal("🧤 Change WK", `<select id="nWK" class="modal-input w-100"><option value="-1">-- No WK Selected --</option>${o}</select>`, () => { getBowlTeam().players.forEach(p => { if(p.skill && p.skill.includes('/ WK')) { p.skill = p.skill.replace(' / WK', ''); } }); let idx = parseInt(el('nWK').value); if(idx >= 0) { if(!getBowlTeam().players[idx].skill.includes('WK')) { getBowlTeam().players[idx].skill += ' / WK'; } } syncMetadataToHistory(false); closeModal(); updateUI(); }); 
}

function updSwap() { el('swO').innerHTML = state.teams[el('swT').value].players.map((p, i) => (p.isPlayingXI && p.name !== "Empty Slot") ? `<option value="${i}">${p.name}</option>` : '').join(''); el('swI').innerHTML = state.teams[el('swT').value].players.map((p, i) => (!p.isPlayingXI && p.name !== "Empty Slot") ? `<option value="${i}">${p.name}</option>` : '').join(''); }
function openPlayerSwap() { showModal("🔄 Sub Swap", `<select id="swT" class="modal-input w-100" onchange="updSwap()"><option value="A">${state.teams.A.name}</option><option value="B">${state.teams.B.name}</option></select><label>OUT:</label><select id="swO" class="modal-input w-100"></select><label>IN:</label><select id="swI" class="modal-input w-100"></select>`, () => { let k = el('swT').value, o = parseInt(el('swO').value), i = parseInt(el('swI').value), t = state.teams[k].players; if ((k === state.battingKey && (state.current.sIdx === o || state.current.nsIdx === o)) || (k === state.bowlingKey && state.current.bIdx === o)) { alert("Cannot swap active player!"); return; } saveState(); t[o].isPlayingXI = false; if (!t[o].dismissalInfo && t[o].hasBatted) t[o].dismissalInfo = "Replaced (Injury)"; t[i].isPlayingXI = true; closeModal(); updateUI(); }); setTimeout(updSwap, 10); }

function openEditSquad() { let html = `<select id="editSqTeam" class="modal-input w-100" onchange="buildEditSq()"><option value="A">${state.teams.A.name}</option><option value="B">${state.teams.B.name}</option></select><div id="editSqDiv" style="max-height:60vh; overflow-y:auto; margin-top:10px; border:1px solid var(--border); border-radius:6px; background:rgba(0,0,0,0.2);"></div>`; showModal("🛠️ Edit Squad & Playing XI", html, saveEditSquad, true, "500px", "Save Changes"); setTimeout(buildEditSq, 50); }
function buildEditSq() { let k = el('editSqTeam').value, t = state.teams[k].players; let html = `<table class="roster-table" style="color:white; margin-top:0; min-width:100%;"><thead style="position:sticky; top:0; background:#020617; z-index:5;"><tr><th style="width:10%;">#</th><th style="width:65%;">Player Name</th><th style="width:25%; text-align:center;">Playing 11</th></tr></thead><tbody>`; t.forEach((p, i) => { if(p.name !== "Empty Slot") html += `<tr><td style="text-align:center; color:var(--text-muted);">${i+1}</td><td><input type="text" id="es-n-${i}" value="${p.name}" class="w-100" style="padding:6px; font-size:0.85rem; border:none; background:transparent; border-bottom:1px solid #334155; border-radius:0;"></td><td style="text-align:center;"><input type="checkbox" id="es-p-${i}" ${p.isPlayingXI ? 'checked' : ''} style="width:18px;height:18px; cursor:pointer;"></td></tr>`; }); html += `</tbody></table>`; el('editSqDiv').innerHTML = html; }
function saveEditSquad() { let k = el('editSqTeam').value, t = state.teams[k].players; let activeIdxs = []; if (k === state.battingKey) { if(state.current.sIdx !== null) activeIdxs.push(state.current.sIdx); if(state.current.nsIdx !== null) activeIdxs.push(state.current.nsIdx); } if (k === state.bowlingKey) { if(state.current.bIdx !== null) activeIdxs.push(state.current.bIdx); } for(let i=0; i<19; i++) { if(t[i].name !== "Empty Slot") { let isChecked = el(`es-p-${i}`).checked; if (!isChecked && activeIdxs.includes(i)) { alert(`Cannot remove ${t[i].name} from Playing XI because they are active!`); return; } } } for(let i=0; i<19; i++) { if(t[i].name !== "Empty Slot") { t[i].name = el(`es-n-${i}`).value.trim(); t[i].isPlayingXI = el(`es-p-${i}`).checked; } } syncMetadataToHistory(true); closeModal(); updateUI(); }

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
    let opt = lst.map((p, i) => { if (!p.isPlayingXI || p.name === "Empty Slot") return ''; let s = typ === 'bowler' ? (!cur.lastOverBowlers.has(i) && i !== cur.bIdx && p.quotaOvers < state.matchSettings.bowlerQuota) : ((!p.hasBatted || p.out === 'retiredHurt') && i !== cur.sIdx && i !== cur.nsIdx); return s ? `<option value="${i}">${p.name}</option>` : ''; }).join(''); 
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

    let venueEl = el('setupVenue');
    el('dispGroundName').innerText = venueEl && venueEl.value ? venueEl.value : "Official Ground";

    el('livePartnership').innerText = `${cur.currPartnership.runs} (${cur.currPartnership.balls})`; 
    el('liveRuns').innerText = cur.runs; el('liveWkts').innerText = cur.wkts; el('liveWkts').style.color = "var(--danger)"; 
    el('liveOvers').innerText = getTeamOversDisplay(); 
    el('liveExtras').innerText = cur.extras.w + cur.extras.nb + cur.extras.b + cur.extras.lb; 
    el('exW').innerText = cur.extras.w; el('exNB').innerText = cur.extras.nb; el('exB').innerText = cur.extras.b; el('exLB').innerText = cur.extras.lb; el('livePenalties').innerText = cur.penalties; 
    el('freeHitBadge').classList.toggle('hidden', !cur.isFreeHit);
    
    if (state.current.activeBreak) { el('scoringEventsBox').classList.add('hidden'); el('breakOverlayBox').classList.remove('hidden'); el('breakTitle').innerText = `PAUSED: ${state.current.activeBreak}`; if (state.current.activeBreakInsp) { el('breakSubtitle').innerText = `Next Inspection: ${state.current.activeBreakInsp}`; } else { el('breakSubtitle').innerText = ""; } } else { el('scoringEventsBox').classList.remove('hidden'); el('breakOverlayBox').classList.add('hidden'); }

    let battedPlayers = bT.map((p, i) => ({p: p, i: i})).filter(item => item.p.hasBatted && item.p.name !== "Empty Slot");
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
    el('bowlStatsBody').innerHTML = bwT.filter(p => (p.o > 0 || p.rc > 0) && p.name !== "Empty Slot").map(p => { 
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

    let res = state.matchResult || calculateResultText() || "Match in Progress"; let mId = state.matchId || "N/A"; let tourn = state.matchSettings.tournament || "Official Match"; let venue = el('setupVenue') ? el('setupVenue').value : "Official Ground"; let date = new Date().toLocaleDateString(); let toss = `${state.battingKey === 'A' ? state.teams.A.name : state.teams.B.name} chose to Bat`;
    
    html += `<table><tr><th colspan="11" class="main-header">SPORTZSTAT OFFICIAL MATCH REPORT</th></tr><tr><td colspan="5" class="sub-header">🏆 Tournament: ${tourn}</td><td colspan="6" class="sub-header text-right">Match ID: ${mId}</td></tr><tr><td colspan="5" class="sub-header">📍 Venue: ${venue}</td><td colspan="6" class="sub-header text-right">📅 Date: ${date}</td></tr><tr><td colspan="5" class="sub-header" style="color:#059669;">🪙 Toss: ${toss}</td><td colspan="6" class="sub-header text-right" style="color:#2563eb;">🏁 Result: ${res}</td></tr></table>`;

    let allInn = [...state.inningsSummaries];
    if ((state.current.balls > 0 || state.current.runs > 0) && state.inningsNum > state.inningsSummaries.length) { let fF = JSON.parse(JSON.stringify(state.current.fow || [])); if(state.current.sIdx !== null && state.current.nsIdx !== null && state.current.wkts < 10) { let sBName = getBatTeam().players[state.current.sIdx] ? getBatTeam().players[state.current.sIdx].name : "Unknown"; let nsBName = getBatTeam().players[state.current.nsIdx] ? getBatTeam().players[state.current.nsIdx].name : "Unknown"; fF.push({ wktNum: "Unbroken", runs: state.current.runs, overs: formatOver(state.current.balls), outBatter: "-", partner: sBName + " & " + nsBName, pRuns: state.current.currPartnership.runs, pBalls: state.current.currPartnership.balls }); } allInn.push({ innNum: state.inningsNum, batTeam: getBatTeam().name, bowlTeam: getBowlTeam().name, runs: state.current.runs, wkts: state.current.wkts, overs: formatOver(state.current.balls), penalties: state.current.penalties || 0, batters: getBatTeam().players, bowlers: getBowlTeam().players, fow: fF, extras: JSON.parse(JSON.stringify(state.current.extras)), isOngoing: true, allowances: state.current.allowances || 0 }); }

    allInn.forEach(inn => {
        html += `<table><tr><th colspan="11" class="inn-title">INNINGS ${inn.innNum}: ${inn.batTeam} - ${inn.runs}/${inn.wkts} (${inn.overs} Ov)</th></tr>`;
        html += `<tr><th colspan="2" class="bat-th text-left" style="width:30%">Batter</th><th colspan="2" class="bat-th" style="width:22%">Status</th><th class="bat-th" style="width:8%">R</th><th class="bat-th" style="width:8%">B</th><th class="bat-th" style="width:8%">4s</th><th class="bat-th" style="width:8%">6s</th><th colspan="3" class="bat-th" style="width:16%">SR</th></tr>`;
        inn.batters.filter(p => p.hasBatted && p.name !== "Empty Slot").forEach(p => { let sr = p.b > 0 ? ((p.r / p.b) * 100).toFixed(2) : "0.00"; let dName = p.name + (p.desig === 'C' || p.desig === 'C/WK' ? ' (C)' : '') + (p.skill && p.skill.includes('WK') ? ' *' : ''); let status = p.out ? p.dismissalInfo : "Not Out"; let statusColor = p.out ? "#991b1b" : "#065f46"; html += `<tr><td colspan="2" class="text-left bold">${dName}</td><td colspan="2" style="color:${statusColor}; font-size:9pt;">${status}</td><td class="bold">${p.r}</td><td>${p.b}</td><td>${p.f}</td><td>${p.s}</td><td colspan="3">${sr}</td></tr>`; });
        let ex = inn.extras || {w:0, nb:0, b:0, lb:0}; let pen = inn.penalties || 0; let extrasTotal = ex.w + ex.nb + ex.b + ex.lb;
        html += `<tr><td colspan="4" class="extra-row text-right">Extras</td><td colspan="7" class="extra-row text-left">${extrasTotal} <span style="font-weight:normal; font-size:8pt;">(W:${ex.w}, NB:${ex.nb}, B:${ex.b}, LB:${ex.lb})</span></td></tr>`;
        if (pen > 0) { html += `<tr><td colspan="4" class="extra-row text-right" style="color:#991b1b;">Penalties</td><td colspan="7" class="extra-row text-left">${pen}</td></tr>`; }
        html += `<tr><td colspan="4" class="extra-row text-right" style="color:#1d4ed8;">TOTAL</td><td colspan="7" class="extra-row text-left bold" style="color:#1d4ed8;">${inn.runs}/${inn.wkts} <span style="font-weight:normal; font-size:8pt;">(${inn.overs} Overs)</span></td></tr>`;
        
        html += `<tr><th colspan="3" class="bwl-th text-left">Bowler</th><th class="bwl-th">O</th><th class="bwl-th">M</th><th class="bwl-th">R</th><th class="bwl-th">W</th><th class="bwl-th">Econ</th><th class="bwl-th">Extras</th><th class="bwl-th">No Balls</th><th class="bwl-th">Wides</th></tr>`;
        
        let sumBalls = 0, sumM = 0, sumR = 0, sumW = 0, sumB = 0, sumLB = 0, sumNB = 0, sumWD = 0, sumTotEx = 0;
        inn.bowlers.filter(p => (p.o > 0 || p.rc > 0) && p.name !== "Empty Slot").forEach(p => { 
            let totalRuns = p.rc || 0; let e = p.o > 0 ? ((totalRuns / p.o) * 6).toFixed(2) : "0.00"; let dName = p.name + (p.desig === 'C' || p.desig === 'C/WK' ? ' (C)' : '') + (p.skill && p.skill.includes('WK') ? ' *' : ''); let exStr = `${p.byes||0}b, ${p.legbyes||0}lb`; let noBalls = p.nb || 0; let wides = p.wd || 0; let totalExtras = (p.wd || 0) + (p.nb || 0) + (p.byes || 0) + (p.legbyes || 0); let po = parseFloat(p.o) || 0; let bBalls = Math.floor(po) * 6 + Math.round((po - Math.floor(po)) * 10); sumBalls += bBalls; sumM += p.m || 0; sumR += totalRuns; sumW += p.w || 0; sumB += p.byes || 0; sumLB += p.legbyes || 0; sumNB += noBalls; sumWD += wides; sumTotEx += totalExtras; 
            html += `<tr><td colspan="3" class="text-left bold">${dName}</td><td>${formatOver(p.o)}</td><td>${p.m}</td><td>${totalRuns}</td><td class="bold" style="color:#991b1b;">${p.w}</td><td>${e}</td><td style="font-size:8pt;">${exStr}</td><td>${noBalls}</td><td>${wides}</td></tr>`; 
        });
        
        let sumOvers = Math.floor(sumBalls / 6) + "." + (sumBalls % 6); let sumEcon = sumBalls > 0 ? ((sumR / sumBalls) * 6).toFixed(2) : "0.00"; let totalRunsWithByes = sumR + sumB + sumLB; let sumExStr = `${sumB}b, ${sumLB}lb`;
        html += `<tr class="extra-row"><td colspan="3" class="text-right">TOTAL</td><td>${sumOvers}</td><td>${sumM}</td><td>${totalRunsWithByes}</td><td style="color:#991b1b;">${sumW}</td><td>${sumEcon}</td><td style="font-size:8pt;">${sumExStr}</td><td>${sumNB}</td><td>${sumWD}</td></tr>`;
        
        if (inn.fow && inn.fow.length > 0) { let fowStr = inn.fow.map(f => `<b>${f.runs}/${f.wktNum==='Unbroken'?'*':f.wktNum}</b> (${f.outBatter}, ${f.overs} ov)`).join(' | '); html += `<tr><td colspan="11" class="fow-row"><b>Fall of Wickets:</b> ${fowStr}</td></tr>`; }
        html += `</table>`;
    });

    html += `<table><tr><th colspan="11" class="main-header" style="font-size:11pt; background:#334155;">MATCH OFFICIALS & LOGS</th></tr>`;
    
    let u1 = el('u1') ? el('u1').value : "N/A"; 
    let u2 = el('u2') ? el('u2').value : "N/A"; 
    let tvUmp = el('tvUmpire') ? el('tvUmpire').value : "N/A"; 
    let obsRef = el('setupObsRef') ? el('setupObsRef').value : "N/A";
    html += `<tr><td colspan="5" class="text-left"><b>Umpires:</b> ${u1}, ${u2}</td><td colspan="6" class="text-left"><b>TV / Ref:</b> ${tvUmp} / ${obsRef}</td></tr>`;

    if (state.matchBreaks.length > 0) { let brStr = state.matchBreaks.map(b => `Inn ${b.inn}: ${b.type} (${b.dur}m)`).join(', '); html += `<tr><td colspan="11" class="text-left"><b>Breaks:</b> ${brStr}</td></tr>`; }
    if (remarkLog.length > 0) { let remStr = remarkLog.map(r => `[Ov ${r.over}] ${r.remark}`).join(' | '); html += `<tr><td colspan="11" class="text-left" style="color:#4c1d95;"><b>Remarks:</b> ${remStr}</td></tr>`; }
    html += `</table></div></body></html>`;
    return html;
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
    el('dynamicModal').style.display = 'flex';
}

function closeModal() { 
    el('dynamicModal').classList.add('hidden'); 
    el('dynamicModal').style.display = 'none';
    let scoringBox = el('scoringEventsBox'); 
    if (scoringBox) { scoringBox.style.pointerEvents = 'auto'; scoringBox.style.opacity = '1'; }
}

function manualRotateUI() { saveState(); manualRotate(); }
function manualRotate() { [state.current.sIdx, state.current.nsIdx] = [state.current.nsIdx, state.current.sIdx]; updateUI(); }
