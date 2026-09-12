// ==========================================
// SUPABASE CLOUD DATABASE CONFIGURATION
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

// --- RESUME PROMPT ---
window.onload = function() {
    let savedMatch = localStorage.getItem('cricStat_activeMatch');
    if(savedMatch) {
        showModal("Resume Match?", "An unfinished match was found. Would you like to resume it from where you left off?", function() {
            try {
                let parsedState = JSON.parse(savedMatch); parsedState.current.lastOverBowlers = new Set(parsedState.current.lastOverBowlers); parsedState.current.bowlersInCurrentOver = new Set(parsedState.current.bowlersInCurrentOver); state = parsedState;
                el('setupView').classList.add('hidden'); el('scoringView').classList.remove('hidden'); 
                if(el('displayTournament')) el('displayTournament').innerText = state.matchSettings.tournament || "MATCH IN PROGRESS"; 
                if (state.matchSettings.matchType === 'multiday') { if(el('breakBtn')) el('breakBtn').classList.remove('hidden'); }
                if(el('setupVenue') && !el('setupVenue').value) { el('setupVenue').value = "Official Ground"; }
                updateUI(); closeModal();
            } catch(e) { console.error("Corrupted local state.", e); hardResetSystem(); }
        }, false, "360px", "Resume");
        if(el('modalCancelBtn')) { el('modalCancelBtn').innerText = "Start Fresh"; el('modalCancelBtn').onclick = function() { localStorage.removeItem('cricStat_activeMatch'); closeModal(); }; }
    }
};

function hardResetSystem() { if(confirm("WARNING: This will wipe ongoing match data from memory. Continue?")) { localStorage.removeItem('cricStat_activeMatch'); location.reload(); } }
function toggleFullScreen() { let fsBtn = el('fsBtn'); if (!document.fullscreenElement) { document.documentElement.requestFullscreen().then(() => { if(fsBtn) fsBtn.innerText = '🔳 EXIT FULL SCREEN'; }).catch(err => alert("Fullscreen not supported.")); } else { if (document.exitFullscreen) { document.exitFullscreen().then(() => { if(fsBtn) fsBtn.innerText = '🔲 FULL'; }); } } }
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && el('fsBtn')) { el('fsBtn').innerText = '🔲 FULL'; } });


// ==========================================
// CLOUD GATEWAY LOGIC
// ==========================================

async function authenticateCloudMatch() {
    if (!supabaseClient) { alert("Supabase SDK missing."); return; }

    const matchId = document.getElementById('cloudMatchId').value.trim().toUpperCase();
    const pin = document.getElementById('cloudMatchPin').value.trim();
    const statusEl = document.getElementById('cloudSyncStatus');

    if(!matchId || !pin) { statusEl.innerHTML = '<span style="color: #ef4444;">❌ Enter Match ID and PIN.</span>'; return; }
    statusEl.innerHTML = '<span style="color: #f59e0b;">⏳ Connecting to Master Database...</span>';

    localStorage.removeItem('cricStat_activeMatch');

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

    if(el('gwTournamentName')) el('gwTournamentName').innerText = state.matchSettings.tournament;
    if(el('gwMatchId')) el('gwMatchId').innerText = `ID: ${matchId}`;
    if(el('gwTeamAName')) el('gwTeamAName').innerText = state.teams.A.name;
    if(el('gwTeamBName')) el('gwTeamBName').innerText = state.teams.B.name;
    
    if(el('setupTournament')) el('setupTournament').value = state.matchSettings.tournament;
    if(el('setupMatchId')) el('setupMatchId').value = matchId;
    if(el('setupVenue')) el('setupVenue').value = mData.venue || "Official Ground";
    if(el('setupDate')) el('setupDate').value = new Date().toISOString().split('T')[0];

    let umps = mData.umpires ? mData.umpires.split(',') : [];
    if(el('u1')) el('u1').value = umps[0] ? umps[0].trim() : "";
    if(el('u2')) el('u2').value = umps[1] ? umps[1].trim() : "";
    if(el('tvUmpire')) el('tvUmpire').value = umps[2] ? umps[2].trim() : "";
    if(el('u4')) el('u4').value = umps[3] ? umps[3].trim() : "";

    let scrs = mData.scorers ? mData.scorers.split(',') : [];
    if(el('s1')) el('s1').value = scrs[0] ? scrs[0].trim() : "";
    if(el('s2')) el('s2').value = scrs[1] ? scrs[1].trim() : "";

    if(el('setupObsRef')) el('setupObsRef').value = mData.referees || "";

    const tossSelect = document.getElementById('gwTossWinner');
    if(tossSelect) tossSelect.innerHTML = `<option value="A">${state.teams.A.name}</option><option value="B">${state.teams.B.name}</option>`;

    statusEl.innerHTML = `<span style="color: #f59e0b;">⏳ Fetching Master Squads...</span>`;
    await fetchCloudRosters('A', state.teams.A.name);
    await fetchCloudRosters('B', state.teams.B.name);

    refreshOpeningDropdowns();

    if(el('gatewayAuthBox')) el('gatewayAuthBox').classList.add('hidden');
    if(el('gatewaySetupBox')) el('gatewaySetupBox').classList.remove('hidden');
}

async function fetchCloudRosters(teamKey, teamName) {
    const { data, error } = await supabaseClient.from('team_rosters').select('player_id, players(full_name, playing_role)').eq('team_name', teamName);
    const listEl = document.getElementById(`gwTeam${teamKey}List`);
    cloudRosters[teamKey] = [];

    if (error || !data || data.length === 0) {
        if(listEl) listEl.innerHTML = `<div style="color: #ef4444; font-size: 0.85rem; font-style: italic;">No official roster found in cloud. Admin must map players in Tournament Wizard.</div>`;
        return;
    }

    let html = "";
    data.forEach((row, idx) => {
        if(row.players) {
            cloudRosters[teamKey].push({ id: row.player_id, name: row.players.full_name, role: row.players.playing_role });
            let isChecked = idx < 11 ? "checked" : "";
            html += `<label style="display: flex; align-items: center; background: #0f172a; padding: 10px; border-radius: 6px; border: 1px solid #334155; cursor: pointer;">
                <input type="checkbox" class="roster-chk-${teamKey}" value="${row.player_id}" ${isChecked} onchange="refreshOpeningDropdowns()" style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;">
                <div>
                    <div style="color: white; font-weight: bold;">${row.players.full_name}</div>
                    <div style="color: #94a3b8; font-size: 0.7rem;">${row.players.playing_role || 'Player'}</div>
                </div>
            </label>`;
        }
    });
    if(listEl) listEl.innerHTML = html;
}

function refreshOpeningDropdowns() {
    let winEl = document.getElementById('gwTossWinner');
    let decEl = document.getElementById('gwTossDecision');
    let win = winEl ? winEl.value : 'A';
    let dec = decEl ? decEl.value : 'bat';
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

    let curS = sEl ? sEl.value : null;
    let curNS = nsEl ? nsEl.value : null;
    let curB = bEl ? bEl.value : null;

    if (batChecked.length > 0) {
        if(sEl) sEl.innerHTML = batChecked.map((p, idx) => `<option value="${p.id}" ${p.id === curS || (!curS && idx===0)?'selected':''}>${p.name}</option>`).join('');
        if(nsEl) nsEl.innerHTML = batChecked.map((p, idx) => `<option value="${p.id}" ${p.id === curNS || (!curNS && idx===1)?'selected':''}>${p.name}</option>`).join('');
    } else {
        if(sEl) sEl.innerHTML = '<option value="">No Batters Selected</option>';
        if(nsEl) nsEl.innerHTML = '<option value="">No Batters Selected</option>';
    }

    if (bowlChecked.length > 0) {
        if(bEl) bEl.innerHTML = bowlChecked.map((p, idx) => `<option value="${p.id}" ${p.id === curB || (!curB && idx===0)?'selected':''}>${p.name}</option>`).join('');
    } else {
        if(bEl) bEl.innerHTML = '<option value="">No Bowlers Selected</option>';
    }
}

function confirmStartMatch() {
    let sEl = document.getElementById('gwStriker');
    let nsEl = document.getElementById('gwNonStriker');
    let bEl = document.getElementById('gwBowler');

    if(!sEl || !nsEl || !bEl) { alert("Initialization error. Missing DOM elements."); return; }

    let sUUID = sEl.value; let nsUUID = nsEl.value; let bUUID = bEl.value;
    if(!sUUID || !nsUUID || !bUUID) { alert("Please select the Opening Striker, Non-Striker, and Bowler."); return; }
    if(sUUID === nsUUID) { alert("Striker and Non-Striker must be different players!"); return; }

    showModal("🏏 Ready to call 'Play'?", `<div class="text-center mt-10"><p style="font-size:1.1rem; color:var(--text); font-weight:bold;">Bowler ready? Batter ready? Umpires ready?</p></div>`, () => {
        closeModal();
        setTimeout(() => { executeInitializeCloudEngine(); }, 150);
    }, false, "400px", "✅ Let's play");
}

window.initializeCloudEngine = confirmStartMatch;
window.confirmStart = confirmStartMatch;

function executeInitializeCloudEngine() {
    const matchTypeEl = document.getElementById('gwMatchType');
    const matchType = matchTypeEl ? matchTypeEl.value : 't20';
    
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

    state.teams['A'].players = [];
    state.teams['B'].players = [];

    ['A', 'B'].forEach(teamKey => {
        let selectedUUIDs = teamKey === 'A' ? selectedA : selectedB;
        let fullCloudRoster = cloudRosters[teamKey];
        
        selectedUUIDs.forEach(uuid => {
            let pData = fullCloudRoster.find(p => p.id === uuid);
            if(pData) {
                state.teams[teamKey].players.push({ 
                    regNo: uuid, name: pData.name, skill: pData.role || "", 
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

    let winEl = document.getElementById('gwTossWinner');
    let decEl = document.getElementById('gwTossDecision');
    let win = winEl ? winEl.value : 'A'; 
    let dec = decEl ? decEl.value : 'bat'; 
    
    state.battingKey = ((win === 'A' && dec === 'bat') || (win === 'B' && dec === 'bowl')) ? 'A' : 'B'; 
    state.bowlingKey = state.battingKey === 'A' ? 'B' : 'A';

    let sIdx = state.teams[state.battingKey].players.findIndex(p => p.regNo === sUUID);
    let nsIdx = state.teams[state.battingKey].players.findIndex(p => p.regNo === nsUUID);
    let bIdx = state.teams[state.bowlingKey].players.findIndex(p => p.regNo === bUUID);

    if(sIdx === -1 || nsIdx === -1 || bIdx === -1) {
        alert("Error mapping opening players. Verify they are checked in the Playing XI.");
        return;
    }

    let nowTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    state.inningsNum = 1;
    state.inningsSummaries = [];
    state.matchResult = "";
    state.current = { 
        runs: 0, wkts: 0, balls: 0, 
        sIdx: sIdx, nsIdx: nsIdx, bIdx: bIdx, 
        isFreeHit: false, penalties: 0, 
        lastOverBowlers: new Set(), extras: {w:0, nb:0, b:0, lb:0}, 
        recentBalls: [], currentOverLog: [], runsInThisOver: 0, 
        bowlersInCurrentOver: new Set([bIdx]), 
        overHistory: [], currPartnership: { runs: 0, balls: 0 }, fow: [], 
        activeBreak: null, activeBreakStartTime: null, activeBreakInsp: null, 
        pendingBreakMins: 0, inningsStartTime: nowTime, inningsEndTime: null, allowances: 0 
    };

    state.teams[state.battingKey].players[sIdx].hasBatted = true;
    state.teams[state.battingKey].players[sIdx].inTime = nowTime;
    state.teams[state.battingKey].players[nsIdx].hasBatted = true;
    state.teams[state.battingKey].players[nsIdx].inTime = nowTime;

    state.matchSettings.matchType = matchType;
    if(matchType === 't20') { state.matchSettings.maxOvers = 20; state.matchSettings.bowlerQuota = 4; state.matchSettings.maxInnings = 2; } 
    else if(matchType === 'oneday') { state.matchSettings.maxOvers = 50; state.matchSettings.bowlerQuota = 10; state.matchSettings.maxInnings = 2; } 
    else { state.matchSettings.maxOvers = 999; state.matchSettings.bowlerQuota = 999; state.matchSettings.maxInnings = 4; }
    state.matchSettings.originalMaxOvers = state.matchSettings.maxOvers;
    if (matchType === 'multiday' && el('breakBtn')) { el('breakBtn').classList.remove('hidden'); }

    if(el('displayTournament')) el('displayTournament').innerText = state.matchSettings.tournament; 
    if(el('setupView')) el('setupView').classList.add('hidden'); 
    if(el('scoringView')) el('scoringView').classList.remove('hidden'); 
    
    saveState();
    updateUI(); 
}

// ==========================================
// CORE CALCULATION & OVER HELPERS
// ==========================================
function getTeamOversDisplay() {
    if(!state.current || !state.current.overHistory) return "0.0";
    let cur = state.current;
    let completedOvers = cur.overHistory.length;
    let ballsInPreviousOvers = completedOvers > 0 ? (cur.overHistory[completedOvers - 1].totalBallsAtEnd || (completedOvers * 6)) : 0;
    let currentOverBalls = Math.max(0, cur.balls - ballsInPreviousOvers);
    return completedOvers + "." + currentOverBalls;
}

function checkAutoOverPrompt() {
    if(!state.current || !state.current.overHistory) return;
    let cur = state.current;
    if (cur.wkts >= 10 || checkTargetReached()) return;

    let completedOvers = cur.overHistory.length;
    let ballsInPreviousOvers = completedOvers > 0 ? (cur.overHistory[completedOvers - 1].totalBallsAtEnd || (completedOvers * 6)) : 0;
    let currentOverBalls = Math.max(0, cur.balls - ballsInPreviousOvers);

    if (currentOverBalls === 6) {
        let strikerOut = cur.sIdx !== null && getBatTeam() && getBatTeam().players[cur.sIdx] && getBatTeam().players[cur.sIdx].out;
        let nonStrikerOut = cur.nsIdx !== null && getBatTeam() && getBatTeam().players[cur.nsIdx] && getBatTeam().players[cur.nsIdx].out;
        if (strikerOut || nonStrikerOut) return;

        let scoringBox = el('scoringEventsBox');
        if (scoringBox) { scoringBox.style.pointerEvents = 'none'; scoringBox.style.opacity = '0.6'; }

        setTimeout(() => {
            if (state.current.bIdx === null) {
                if (scoringBox) { scoringBox.style.pointerEvents = 'auto'; scoringBox.style.opacity = '1'; }
                return;
            }
            showModal("🔄 Over Completed", `<div class="text-center mb-10 text-accent font-bold" style="font-size:1.1rem;">6 legal deliveries bowled!</div><div class="text-center text-muted" style="font-size:0.85rem;">Click <b>Call Over</b> to select the next bowler.</div>`, () => { closeModal(); executeEndOver(); }, false, "360px", "Call Over");
        }, 600);
    }
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

function finalizeOver(isPartialTerminal = false) { 
    let cur = state.current; let prevBalls = cur.overHistory.length > 0 ? cur.overHistory[cur.overHistory.length - 1].totalBallsAtEnd : 0; let ballsThisOver = cur.balls - prevBalls; let isPartial = isPartialTerminal && ballsThisOver > 0 && ballsThisOver < 6;
    cur.bowlersInCurrentOver.forEach(i => { getBowlTeam().players[i].quotaOvers += 1; if(cur.runsInThisOver === 0 && i === cur.bIdx && !isPartial) getBowlTeam().players[i].m++; }); 
    cur.overHistory.push({ over: cur.overHistory.length + 1, runs: cur.runs, wkts: cur.wkts, totalBallsAtEnd: cur.balls, isPartialTerminal: isPartial }); 
    cur.lastOverBowlers = new Set(cur.bowlersInCurrentOver); cur.runsInThisOver = 0; cur.bowlersInCurrentOver.clear(); cur.recentBalls.push(...cur.currentOverLog, {label: '/', type: 'divider'}); if(cur.recentBalls.length > 14) cur.recentBalls = cur.recentBalls.slice(-14); cur.currentOverLog = []; 
}

// ==========================================
// SYNC & SCORE BOARD
// ==========================================

async function triggerCloudSync() {
    if (!supabaseClient || !state.matchId) return;
    let cur = state.current; let effBalls = getEffectiveBalls(cur); let crrVal = effBalls > 0 ? ((cur.runs / effBalls) * 6).toFixed(2) : "0.00";
    let lightWeightLiveData = { matchId: state.matchId, batTeam: getBatTeam() ? getBatTeam().name : "", bowlTeam: getBowlTeam() ? getBowlTeam().name : "", runs: cur.runs, wkts: cur.wkts, overs: formatOver(cur.balls), crr: crrVal, target: (el('dispTargetText') ? el('dispTargetText').innerText : ""), batters: [ cur.sIdx !== null && getBatTeam().players[cur.sIdx] ? { name: getBatTeam().players[cur.sIdx].name, r: getBatTeam().players[cur.sIdx].r, b: getBatTeam().players[cur.sIdx].b, isStriker: true } : null, cur.nsIdx !== null && getBatTeam().players[cur.nsIdx] ? { name: getBatTeam().players[cur.nsIdx].name, r: getBatTeam().players[cur.nsIdx].r, b: getBatTeam().players[cur.nsIdx].b, isStriker: false } : null ], bowler: cur.bIdx !== null && getBowlTeam().players[cur.bIdx] ? { name: getBowlTeam().players[cur.bIdx].name, o: formatOver(getBowlTeam().players[cur.bIdx].o), r: getBowlTeam().players[cur.bIdx].rc, w: getBowlTeam().players[cur.bIdx].w } : null, recentBalls: cur.recentBalls };
    try { await supabaseClient.from('live_matches').upsert({ match_id: state.matchId, live_data: lightWeightLiveData }, { onConflict: 'match_id' }); } catch(e) {}
}

async function logBallEvent(batterObj, bowlerObj, runsBat, runsExtra, extraType, isWicket, wicketType, dismissedObj) {
    if (!supabaseClient || !state.matchId) return;
    let ballData = { match_id: state.matchId, innings_no: state.inningsNum, over_no: Math.floor(state.current.balls / 6), ball_number: (state.current.balls % 6) + 1, striker_id: batterObj && batterObj.regNo && batterObj.regNo.length > 15 ? batterObj.regNo : null, non_striker_id: null, bowler_id: bowlerObj && bowlerObj.regNo && bowlerObj.regNo.length > 15 ? bowlerObj.regNo : null, runs_batter: runsBat, runs_extra: runsExtra, is_valid_ball: (extraType !== 'Wide' && extraType !== 'No-Ball'), extra_type: extraType, is_wicket: isWicket, wicket_type: wicketType || null, dismissed_player_name: dismissedObj ? dismissedObj.name : null };
    try { supabaseClient.from('ball_by_ball').insert([ballData]).then(({error}) => {}); } catch(e) {}
}

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

function updateUI() {
    try {
        let cur = state.current;
        let bT = getBatTeam() ? getBatTeam().players : [];
        let bwT = getBowlTeam() ? getBowlTeam().players : [];
        
        setTimeout(() => { localStorage.setItem('cricStat_activeMatch', JSON.stringify(state, (key, value) => value instanceof Set ? [...value] : value)); triggerCloudSync(); }, 0);

        if(el('inningsBadge')) el('inningsBadge').innerText = `INNINGS ${state.inningsNum}`; 
        if(el('dispBatTeamName') && getBatTeam()) el('dispBatTeamName').innerText = getBatTeam().name; 
        if(el('dispBowlTeamName') && getBowlTeam()) el('dispBowlTeamName').innerText = getBowlTeam().name; 
        if(el('dispBatTeamNameTop') && getBatTeam()) el('dispBatTeamNameTop').innerText = getBatTeam().name;
        
        let histHtml = ''; 
        state.inningsSummaries.forEach(inn => { histHtml += `<div class="text-success mb-5" style="font-size:0.85rem;">Inn ${inn.innNum}: ${inn.batTeam} scored ${inn.runs}/${inn.wkts}</div>`; }); 
        if(el('inningsHistoryText')) el('inningsHistoryText').innerHTML = histHtml;

        let effBalls = getEffectiveBalls(cur); 
        let crrVal = effBalls > 0 ? ((cur.runs / effBalls) * 6).toFixed(2) : "0.00"; 
        if(el('liveCrr')) el('liveCrr').innerText = crrVal;
        
        let curTargetString = null; 
        if (state.matchSettings.matchType === 'multiday') {
            let allInn = [...state.inningsSummaries]; 
            let bowlTeam = getBowlTeam() ? getBowlTeam().name : ""; 
            let bowlTeamInnsCount = allInn.filter(i => i.batTeam === bowlTeam).length;
            if (state.matchSettings.customTarget) { curTargetString = `${state.matchSettings.customTarget} Runs`; } 
            else if (bowlTeamInnsCount === 2) { 
                let bowlTotal = allInn.filter(i => i.batTeam === bowlTeam).reduce((sum, i) => sum + i.runs, 0); 
                let batPrevInns = allInn.filter(i => i.batTeam === getBatTeam().name).reduce((sum, i) => sum + i.runs, 0); 
                let targetToWin = bowlTotal - batPrevInns + 1; 
                if (targetToWin > 0) curTargetString = `Target: ${targetToWin}`; 
            }
            if (curTargetString && el('dispTargetText')) { el('dispTargetText').innerText = curTargetString; el('targetDisplayBox').classList.remove('hidden'); } 
            else if(el('targetDisplayBox')) { el('targetDisplayBox').classList.add('hidden'); }
            if(el('rrrBox')) el('rrrBox').classList.add('hidden'); 
        } else {
            if (state.inningsNum > 1 && state.inningsSummaries.length > 0) { 
                let tRuns = state.matchSettings.customTarget || (state.inningsSummaries[state.inningsNum - 2].runs + 1); 
                let tOvers = state.matchSettings.customTargetOvers || state.matchSettings.originalMaxOvers; 
                let tMethod = state.matchSettings.targetMethod || ""; 
                curTargetString = `${tRuns} (${tOvers}) ${tMethod}`.trim(); 
                if(el('dispTargetText')) el('dispTargetText').innerText = curTargetString; 
                if(el('targetDisplayBox')) el('targetDisplayBox').classList.remove('hidden'); 
                let runsNeeded = tRuns - cur.runs; if(runsNeeded < 0) runsNeeded = 0;
                let targetFullOvers = Math.floor(tOvers); 
                let targetExtraBalls = Math.round((tOvers - targetFullOvers) * 10); 
                let totalTargetBalls = (targetFullOvers * 6) + targetExtraBalls;
                let ballsLeft = totalTargetBalls - effBalls; if (ballsLeft < 0) ballsLeft = 0; 
                let rrrVal = ballsLeft > 0 ? ((runsNeeded / ballsLeft) * 6).toFixed(2) : "0.00";
                if(el('liveRrr')) el('liveRrr').innerText = rrrVal; 
                let runsColor = runsNeeded < ballsLeft ? 'var(--success)' : (runsNeeded > ballsLeft ? 'var(--danger)' : 'white');
                if(el('liveReq')) { el('liveReq').innerHTML = `<span style="color:${runsColor};">${runsNeeded}</span><span style="color:var(--primary);">/</span><span style="color:var(--accent);">${ballsLeft}</span>`; }
                if(el('rrrBox')) el('rrrBox').classList.remove('hidden');
            } else { 
                if(el('targetDisplayBox')) el('targetDisplayBox').classList.add('hidden'); 
                if(el('rrrBox')) el('rrrBox').classList.add('hidden'); 
            }
        }

        let leadBoxHtml = "";
        if (state.matchSettings.matchType === 'multiday' && state.inningsNum > 1 && getBatTeam() && getBowlTeam()) { 
            let tBat = getBatTeam().name, tBowl = getBowlTeam().name; 
            let sBat = state.current.runs + state.inningsSummaries.filter(i=>i.batTeam===tBat).reduce((a,b)=>a+b.runs,0); 
            let sBowl = state.inningsSummaries.filter(i=>i.batTeam===tBowl).reduce((a,b)=>a+b.runs,0); 
            let diff = sBat - sBowl; 
            let txt = diff > 0 ? `lead by ${diff}` : (diff < 0 ? `trail by ${Math.abs(diff)}` : `scores level`); 
            leadBoxHtml = `<p class="text-accent font-bold mt-5 mb-0" style="font-size:0.85rem; text-transform:uppercase;">📊 ${tBat} ${txt}</p>`; 
        }
        if(el('leadTrailBox')) el('leadTrailBox').innerHTML = leadBoxHtml;

        let venueEl = el('setupVenue');
        if(el('dispGroundName')) el('dispGroundName').innerText = venueEl && venueEl.value ? venueEl.value : "Official Ground";

        if(el('livePartnership')) el('livePartnership').innerText = `${cur.currPartnership.runs} (${cur.currPartnership.balls})`; 
        if(el('liveRuns')) el('liveRuns').innerText = cur.runs; 
        if(el('liveWkts')) { el('liveWkts').innerText = cur.wkts; el('liveWkts').style.color = "var(--danger)"; }
        if(el('liveOvers')) el('liveOvers').innerText = getTeamOversDisplay(); 
        if(el('liveExtras')) el('liveExtras').innerText = cur.extras.w + cur.extras.nb + cur.extras.b + cur.extras.lb; 
        if(el('exW')) el('exW').innerText = cur.extras.w; 
        if(el('exNB')) el('exNB').innerText = cur.extras.nb; 
        if(el('exB')) el('exB').innerText = cur.extras.b; 
        if(el('exLB')) el('exLB').innerText = cur.extras.lb; 
        if(el('livePenalties')) el('livePenalties').innerText = cur.penalties; 
        if(el('freeHitBadge')) el('freeHitBadge').classList.toggle('hidden', !cur.isFreeHit);
        
        if (state.current.activeBreak) { 
            if(el('scoringEventsBox')) el('scoringEventsBox').classList.add('hidden'); 
            if(el('breakOverlayBox')) el('breakOverlayBox').classList.remove('hidden'); 
            if(el('breakTitle')) el('breakTitle').innerText = `PAUSED: ${state.current.activeBreak}`; 
            if (state.current.activeBreakInsp) { 
                if(el('breakSubtitle')) el('breakSubtitle').innerText = `Next Inspection: ${state.current.activeBreakInsp}`; 
            } else { 
                if(el('breakSubtitle')) el('breakSubtitle').innerText = ""; 
            } 
        } else { 
            if(el('scoringEventsBox')) el('scoringEventsBox').classList.remove('hidden'); 
            if(el('breakOverlayBox')) el('breakOverlayBox').classList.add('hidden'); 
        }

        try {
            let battedPlayers = bT.map((p, i) => ({p: p, i: i})).filter(item => item.p && item.p.hasBatted && item.p.name !== "Empty Slot");
            battedPlayers.sort((a, b) => { let aActive = (a.i === cur.sIdx || a.i === cur.nsIdx) ? 1 : 0; let bActive = (b.i === cur.sIdx || b.i === cur.nsIdx) ? 1 : 0; if (aActive !== bActive) return bActive - aActive; return a.i - b.i; });

            let battersHtml = `<table class="bowler-table" style="font-size: 0.85rem; margin-top:0;"><thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>`;
            battersHtml += battedPlayers.map(item => { 
                let p = item.p, rI = item.i; let isActive = (rI === cur.sIdx || rI === cur.nsIdx); let isStriker = (rI === cur.sIdx); let sr = p.b > 0 ? ((p.r / p.b) * 100).toFixed(2) : "0.00"; 
                let dName = p.name || "Unknown"; if(p.desig === 'C' || p.desig === 'C/WK') dName += ' (C)'; if(p.skill && String(p.skill).includes('WK')) dName += ' *'; if(isStriker) dName += ' <span style="font-size:0.8rem;" title="Striker">🏏</span>';
                let rowStyle = isActive ? (isStriker ? 'background: rgba(16, 185, 129, 0.15); border-left: 3px solid var(--success);' : 'background: rgba(255,255,255,0.05); border-left: 3px solid transparent;') : 'opacity: 0.6; border-left: 3px solid transparent;';
                let statusInfo = p.out ? `<div style="font-size:0.65rem; color:var(--danger); font-style:italic; margin-top:2px;">${p.dismissalInfo}</div>` : (isActive ? `<div style="font-size:0.65rem; color:var(--success); font-style:italic; margin-top:2px;">Not Out</div>` : '');
                return `<tr style="${rowStyle}"><td style="padding:8px; max-width: 140px;"><div style="font-weight:bold; color:${isActive ? 'white' : 'var(--text-muted)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.name}">${dName}</div>${statusInfo}</td><td style="font-weight:bold; font-size:1.1rem; color:var(--primary); padding:8px;">${p.r}</td><td style="padding:8px;">${p.b}</td><td style="color:var(--b4); padding:8px;">${p.f}</td><td style="color:var(--b6); padding:8px;">${p.s}</td><td style="color:var(--accent); font-weight:bold; padding:8px;">${sr}</td></tr>`; 
            }).join('');
            battersHtml += `</tbody></table>`; 
            if(el('battersContainer')) el('battersContainer').innerHTML = battersHtml;
        } catch(e) { console.error("Batters Render Error:", e); }
        
        try {
            let miniBatHtml = "";
            if (cur.sIdx !== null && bT[cur.sIdx]) { let p = bT[cur.sIdx]; miniBatHtml += `<div style="display: flex; align-items: center; width: 100%; margin-bottom: 2px;"><div style="color: white; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; text-align: left;" title="${p.name}">${p.name}</div><div style="flex: 0 0 auto; margin-left: 4px; white-space: nowrap;"><span style="font-size:0.6rem; margin-right: 2px;">🏏</span><span class="text-primary" style="font-weight:bold;">${p.r}</span><span style="color:var(--text-muted); font-weight:normal; font-size:0.7rem; margin-left:2px;">(${p.b})</span></div></div>`; }
            if (cur.nsIdx !== null && bT[cur.nsIdx]) { let p = bT[cur.nsIdx]; miniBatHtml += `<div style="display: flex; align-items: center; width: 100%;"><div style="color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; text-align: left;" title="${p.name}">${p.name}</div><div style="flex: 0 0 auto; margin-left: 4px; white-space: nowrap;"><span class="text-primary" style="font-weight:bold;">${p.r}</span><span style="color:var(--text-muted); font-weight:normal; font-size:0.7rem; margin-left:2px;">(${p.b})</span></div></div>`; }
            if(el('miniLiveBatters')) el('miniLiveBatters').innerHTML = miniBatHtml;
        } catch(e) { console.error("Mini Batters Error:", e); }
        
        try {
            if(cur.bIdx !== null && bwT[cur.bIdx]) { 
                let actB = bwT[cur.bIdx]; let bName = actB.name || "Unknown"; if(actB.desig === 'C' || actB.desig === 'C/WK') bName += ' (C)'; if(actB.skill && String(actB.skill).includes('WK')) bName += ' *'; 
                if(el('activeBowlerNameRight')) { el('activeBowlerNameRight').innerText = bName; el('activeBowlerNameRight').title = bName; }
                if(el('activeBowlerProgress')) el('activeBowlerProgress').innerHTML = cur.currentOverLog.map(getBadgeHtml).join(''); 
                let totalRuns = (actB.rc || 0) + (actB.byes || 0) + (actB.legbyes || 0); 
                let miniBowlHtml = `<div style="display:flex; justify-content:flex-end; align-items:center; width:100%; margin-bottom:2px;"><div style="flex: 0 0 auto; margin-right:4px;">⚾</div><div style="color:white; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex: 0 1 auto; text-align:right;">${actB.name}</div></div>`; 
                miniBowlHtml += `<div style="color:var(--text-muted); font-size:0.75rem; text-align:right; white-space:nowrap;">${formatOver(actB.o)}-${actB.m}-${totalRuns}-<span class="text-danger" style="font-weight:bold;">${actB.w}</span></div>`; 
                if(el('miniLiveBowler')) el('miniLiveBowler').innerHTML = miniBowlHtml;
            } else {
                if(el('activeBowlerNameRight')) { el('activeBowlerNameRight').innerText = "Select..."; el('activeBowlerNameRight').title = ""; }
                if(el('activeBowlerProgress')) el('activeBowlerProgress').innerHTML = ""; 
                if(el('miniLiveBowler')) el('miniLiveBowler').innerHTML = `<div style="color: var(--text-muted); font-style:italic;">Select Bowler...</div>`;
            }
        } catch(e) { console.error("Active Bowler Render Error:", e); }
        
        try {
            if(el('recentBallsData')) el('recentBallsData').innerHTML = cur.recentBalls.map(getBadgeHtml).join(''); 
            if(el('bowlStatsBody')) {
                el('bowlStatsBody').innerHTML = bwT.filter(p => p && (p.o > 0 || p.rc > 0) && p.name !== "Empty Slot").map(p => { 
                    let bName = p.name; if(p.desig === 'C' || p.desig === 'C/WK') bName += ' (C)'; if(p.skill && String(p.skill).includes('WK')) bName += ' *'; 
                    let totalRuns = p.rc || 0; let exStr = `${p.byes||0}b, ${p.legbyes||0}lb`; let noBalls = p.nb || 0; let wides = p.wd || 0;
                    return `<tr><td style="max-width: 85px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.name}">${bName}</td><td>${formatOver(p.o)}</td><td>${p.m}</td><td>${totalRuns}</td><td style="color:var(--danger); font-weight:bold;">${p.w}</td><td style="font-size:0.7rem; color:var(--text-muted);">${exStr}</td><td>${noBalls}</td><td>${wides}</td></tr>`; 
                }).join('');
            }
        } catch(e) { console.error("Bowlers Render Error:", e); }

    } catch(mainError) {
        console.error("FATAL UI UPDATE ERROR:", mainError);
    }
}

// ==========================================
// EXTRA RUNS, WICKETS, AND TRANSITIONS
// ==========================================

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
    } else if (typ === 'NB') { 
        let nt = el('nbT').value; cur.runs += 1; cur.extras.nb += 1; b.rc += 1; b.nb += 1; cur.runsInThisOver += 1; cur.currPartnership.runs += (1 + ex); 
        runsExt = 1; exLabel = 'No-Ball';
        if(nt === 'bat' && ex > 0) { s.r += ex; b.rc += ex; cur.runs += ex; cur.runsInThisOver += ex; runsBat = ex; } 
        else if (ex > 0) { cur.runs += ex; runsExt += ex; if (nt === 'bye') { cur.extras.b += ex; b.byes += ex; } else { cur.extras.lb += ex; b.legbyes += ex; } } 
        lbl = (ex + 1) + 'nb'; if (state.matchSettings.matchType !== 'multiday') cur.isFreeHit = true; s.b++; cur.currPartnership.balls++; 
    } else { 
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
    } else {
        cur.wkts++; oB.out = true; 
        let runsScored = 0, runType = 'bat'; let runsExt = 0; let exLabel = 'None';
        
        if (['RunOut', 'ObstructingField'].includes(wType)) { 
            let runsInput = el('wRuns') ? el('wRuns').value : "0";
            runsScored = parseInt(runsInput, 10);
            if (isNaN(runsScored)) runsScored = 0; 
            runType = extraType === 'wide' ? 'wide' : (el('wRunType') ? el('wRunType').value : 'bat'); 
        }
        
        if (extraType === 'wide') { cur.runs += 1; cur.runsInThisOver += 1; cur.extras.w += 1; b.rc += 1; b.wd += 1; runsExt += 1; exLabel = 'Wide'; } 
        else if (extraType === 'noball') { cur.runs += 1; cur.runsInThisOver += 1; cur.extras.nb += 1; b.rc += 1; b.nb += 1; s.b++; cur.currPartnership.balls++; if (state.matchSettings.matchType !== 'multiday') cur.isFreeHit = true; runsExt += 1; exLabel = 'No-Ball'; } 
        else if (wType !== 'TimedOut') { s.b++; cur.balls++; b.o++; cur.currPartnership.balls++; cur.isFreeHit = false; }
        
        let runsBat = 0;
        if (runsScored > 0) { cur.runs += runsScored; cur.runsInThisOver += runsScored; cur.currPartnership.runs += runsScored; if (extraType === 'wide') { cur.extras.w += runsScored; b.rc += runsScored; b.wd += runsScored; runsExt += runsScored; } else if (runType === 'bat') { s.r += runsScored; b.rc += runsScored; if (runsScored === 4) s.f++; if (runsScored === 6) s.s++; runsBat = runsScored; } else if (runType === 'bye') { cur.extras.b += runsScored; b.byes += runsScored; runsExt += runsScored; } else if (runType === 'legbye') { cur.extras.lb += runsScored; b.legbyes += runsScored; runsExt += runsScored; } }
        
        if(['Bowled', 'Caught', 'LBW', 'Stumped', 'HitWicket'].includes(wType)) { b.w++; b.cw = (b.cw || 0) + 1; } else { b.cw = 0; }
        if (wType === 'Stumped') { let wk = getBowlTeam().players.find(p => p.skill && String(p.skill).includes('WK') && p.isPlayingXI); if (wk) { wk.stumpings++; wFldr = wk.name; } else { wFldr = "WK"; } } 
        else if (wFldr) { let fObj = getBowlTeam().players.find(p => p.name === wFldr); if (fObj) { if (wType === 'Caught') fObj.catches++; else if (wType === 'RunOut') fObj.runouts++; } }
        
        let logLabel = (runsScored > 0 ? runsScored : '') + 'W'; if (extraType === 'wide') logLabel = (runsScored + 1) + 'wd+W'; else if (extraType === 'noball') logLabel = (runsScored + 1) + 'nb+W';
        cur.currentOverLog.push({label: logLabel, type: 'wicket'}); oB.outOnDuck = (oB.r === 0) ? 1 : 0;
        
        let dT = ""; if (wType === 'Bowled') dT = `b ${b.name}`; else if (wType === 'Caught') dT = `c ${wFldr || 'Sub'} b ${b.name}`; else if (wType === 'LBW') dT = `lbw b ${b.name}`; else if (wType === 'Stumped') dT = `st ${wFldr} b ${b.name}`; else if (wType === 'RunOut') dT = `run out (${wFldr || 'Sub'})`; else if (wType === 'HitWicket') dT = `hit wicket b ${b.name}`; else if (wType === 'ObstructingField') dT = `obstructing the field`; else if (wType === 'HitBallTwice') dT = `hit the ball twice`; else if (wType === 'TimedOut') dT = `timed out`;
        if (extraType === 'wide') dT += ' (wd)'; else if (extraType === 'noball') dT += ' (nb)'; oB.dismissalInfo = dT;
        
        logBallEvent(s, b, runsBat, runsExt, exLabel, true, wType, oB); 
    }

    oB.outTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    cur.fow.push({ wktNum: cur.wkts, runs: cur.runs, overs: formatOver(cur.balls), outBatter: oB.name, partner: getBatTeam().players[isSO ? cur.nsIdx : cur.sIdx].name, pRuns: cur.currPartnership.runs, pBalls: cur.currPartnership.balls }); cur.currPartnership = { runs: 0, balls: 0 };
    
    let runsScoredRotate = 0;
    if (['RunOut', 'ObstructingField'].includes(wType)) { let rotInput = el('wRuns') ? el('wRuns').value : "0"; runsScoredRotate = parseInt(rotInput, 10); if (isNaN(runsScoredRotate)) runsScoredRotate = 0; }
    if (['RunOut', 'ObstructingField'].includes(wType)) { if (runsScoredRotate % 2 === 0) manualRotate(); } else { if (runsScoredRotate % 2 !== 0 && !['Caught', 'Bowled', 'LBW', 'Stumped', 'HitWicket', 'TimedOut'].includes(wType)) { manualRotate(); } }
    
    if (checkTargetReached()) { if(cur.bIdx !== null) finalizeOver(true); closeModal(); setTimeout(endInnings, 100); return; }
    
    closeModal(); updateUI();
    let promptDelay = 800;
    if(cur.wkts < 10) { let slot = getBatTeam().players[cur.sIdx].out ? 'striker' : 'nonstriker'; setTimeout(() => openSelector(slot, "Next Batter"), promptDelay); } else { setTimeout(() => endInnings(), promptDelay); }
}

function endInnings() { 
    try {
        saveState(); 
        if (state.current && state.current.bIdx !== null) finalizeOver(true); 
        if (state.current) { state.current.inningsEndTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); }
        
        let fF = [];
        if (state.current && state.current.fow) { fF = JSON.parse(JSON.stringify(state.current.fow)); }
        
        if(state.current && state.current.sIdx !== null && state.current.nsIdx !== null && state.current.wkts < 10) {
            let sBName = (getBatTeam() && getBatTeam().players[state.current.sIdx]) ? getBatTeam().players[state.current.sIdx].name : "Unknown"; 
            let nsBName = (getBatTeam() && getBatTeam().players[state.current.nsIdx]) ? getBatTeam().players[state.current.nsIdx].name : "Unknown"; 
            let pRuns = (state.current.currPartnership) ? state.current.currPartnership.runs : 0; 
            let pBalls = (state.current.currPartnership) ? state.current.currPartnership.balls : 0; 
            fF.push({ wktNum: "Unbroken", runs: state.current.runs, overs: formatOver(state.current.balls), outBatter: "-", partner: sBName + " & " + nsBName, pRuns: pRuns, pBalls: pBalls }); 
        }
        
        state.inningsSummaries.push({ 
            innNum: state.inningsNum || 1, 
            batTeam: getBatTeam() ? getBatTeam().name : "Team 1", 
            bowlTeam: getBowlTeam() ? getBowlTeam().name : "Team 2", 
            runs: state.current ? state.current.runs : 0, 
            wkts: state.current ? state.current.wkts : 0, 
            overs: formatOver(state.current ? state.current.balls : 0), 
            penalties: (state.current ? state.current.penalties : 0) || 0, 
            overHistory: state.current ? JSON.parse(JSON.stringify(state.current.overHistory || [])) : [], 
            batters: getBatTeam() ? JSON.parse(JSON.stringify(getBatTeam().players || [])) : [], 
            bowlers: getBowlTeam() ? JSON.parse(JSON.stringify(getBowlTeam().players || [])) : [], 
            fow: fF, 
            extras: state.current ? JSON.parse(JSON.stringify(state.current.extras || {})) : {w:0, nb:0, b:0, lb:0}, 
            startTime: (state.current ? state.current.inningsStartTime : "-") || "-", 
            endTime: (state.current ? state.current.inningsEndTime : "-") || "-", 
            allowances: (state.current ? state.current.allowances : 0) || 0 
        }); 
        
        showMatchSummary(); 
    } catch(e) { 
        console.error("End Innings Error:", e); 
        alert("Error saving Innings Summary. Check console."); 
    }
}

function showMatchSummary() {
    try {
        let autoRes = calculateResultText();
        let isGameOver = (state.inningsNum >= state.matchSettings.maxInnings || state.matchResult !== "" || autoRes !== "");
        let isTransition = (!isGameOver && state.inningsSummaries.length === state.inningsNum);
        
        let confirmBtnText = "Confirm"; let hideCancel = false; let requiresDownload = false;
        if (isGameOver) { confirmBtnText = "🏁 End Match & Reset"; requiresDownload = true; } else if (isTransition) { confirmBtnText = "▶️ Start Next Innings"; requiresDownload = true; } else { confirmBtnText = "🔙 Continue Scoring"; hideCancel = true; }

        let html = `<div class="custom-scroll" style="max-height: 45vh; overflow-y: auto; padding-right:10px; margin-bottom:10px;">`;
        if (state.inningsSummaries.length === 0 && (!state.current || state.current.balls === 0)) {
            html += `<p class="text-center text-muted">No data available yet.</p>`;
        } else {
            let displayInnings = [...state.inningsSummaries];
            if (!isGameOver && !isTransition && state.current && (state.current.balls > 0 || state.current.runs > 0)) {
                let fF = JSON.parse(JSON.stringify(state.current.fow || [])); 
                if(state.current.sIdx !== null && state.current.nsIdx !== null && state.current.wkts < 10) { 
                    let sBName = getBatTeam().players[state.current.sIdx] ? getBatTeam().players[state.current.sIdx].name : "Unknown"; 
                    let nsBName = getBatTeam().players[state.current.nsIdx] ? getBatTeam().players[state.current.nsIdx].name : "Unknown"; 
                    fF.push({ wktNum: "Unbroken", runs: state.current.runs, overs: formatOver(state.current.balls), outBatter: "-", partner: sBName + " & " + nsBName, pRuns: state.current.currPartnership.runs, pBalls: state.current.currPartnership.balls }); 
                }
                displayInnings.push({ innNum: state.inningsNum, batTeam: getBatTeam().name, bowlTeam: getBowlTeam().name, runs: state.current.runs, wkts: state.current.wkts, overs: formatOver(state.current.balls), penalties: state.current.penalties || 0, batters: getBatTeam().players, bowlers: getBowlTeam().players, fow: fF, extras: JSON.parse(JSON.stringify(state.current.extras)), isOngoing: true, allowances: state.current.allowances || 0 });
            }

            displayInnings.reverse().forEach(inn => {
                html += `<div style="background:rgba(0,0,0,0.3); padding:15px; margin-bottom:15px; border-top:4px solid ${inn.isOngoing ? 'var(--danger)' : 'var(--primary)'}; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.3);"><div class="flex-row" style="justify-content:space-between; margin-bottom:12px;"><div><div class="${inn.isOngoing ? 'text-danger' : 'text-primary'} font-bold" style="font-size:0.75rem; letter-spacing:1px;">INNINGS ${inn.innNum} ${inn.isOngoing ? '(ONGOING)' : ''}</div><div class="font-bold" style="font-size:1.3rem; color:white;">${inn.batTeam}</div></div><div class="text-right"><div class="text-success font-bold" style="font-size:1.6rem;">${inn.runs}<span style="color:#94a3b8; font-size:1.2rem;">/${inn.wkts}</span></div><div class="text-muted" style="font-size:0.85rem;">(${inn.overs} Overs)</div></div></div>`;
                
                html += `<table class="scorecard-table"><thead class="bat-hdr" style="background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border-bottom: 1px solid #64748b;"><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>`;
                
                if(inn.batters) {
                    inn.batters.forEach(b => { 
                        if(b && b.hasBatted && b.name !== "Empty Slot") { 
                            let isOut = b.out ? `<span style="color:#ef4444; font-size:0.65rem; display:block; margin-top:2px;">${b.dismissalInfo || 'Out'}</span>` : `<span style="color:#10b981; font-size:0.65rem; display:block; margin-top:2px;">Not Out</span>`; 
                            let sr = (b.b && b.b > 0) ? ((b.r/b.b)*100).toFixed(2) : "0.00"; 
                            let nameStr = `<div style="max-width: 130px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${b.name || ''}"><b style="font-size:0.85rem; color:white;">${b.name || 'Unknown'}</b>` + (b.desig==='C' || b.desig==='C/WK' ? ' <span style="color:var(--accent);">(C)</span>' : '') + (b.skill && String(b.skill).includes('WK') ? ' 🧤' : '') + `</div>`; 
                            html += `<tr><td>${nameStr}${isOut}</td><td style="font-weight:bold; font-size:1rem; color:white;">${b.r || 0}</td><td style="color:white;">${b.b || 0}</td><td style="color:white;">${b.f || 0}</td><td style="color:white;">${b.s || 0}</td><td style="color:var(--accent);">${sr}</td></tr>`; 
                        } 
                    });
                }
                
                let ex = inn.extras || {w:0, nb:0, b:0, lb:0}; let extrasTotal = (ex.w||0) + (ex.nb||0) + (ex.b||0) + (ex.lb||0); let pen = inn.penalties || 0;
                html += `<tr style="background:rgba(255,255,255,0.05); font-weight:bold;"><td style="color:var(--accent); text-transform:uppercase;">Extras</td><td colspan="5" style="text-align:right; color:white;">${extrasTotal} <span style="font-weight:normal; font-size:0.7rem; color:white;">(W:${ex.w||0}, NB:${ex.nb||0}, B:${ex.b||0}, LB:${ex.lb||0})</span></td></tr>`;
                if (pen > 0) html += `<tr style="background:rgba(255,255,255,0.05); font-weight:bold;"><td style="color:var(--danger); text-transform:uppercase;">Penalties</td><td colspan="5" style="text-align:right; color:white;">${pen}</td></tr>`;
                html += `</tbody></table><table class="scorecard-table">`;
                
                html += `<thead class="bwl-hdr" style="background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border-bottom: 1px solid #64748b;"><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th><th>Extras</th><th>NB</th><th>WD</th></tr></thead><tbody>`;
                
                if(inn.bowlers) {
                    inn.bowlers.forEach(b => { 
                        if(b && (b.o > 0 || b.rc > 0) && b.name !== "Empty Slot") { 
                            let totalRuns = b.rc || 0; 
                            let econ = (b.o && b.o > 0) ? ((totalRuns/b.o)*6).toFixed(2) : "0.00"; 
                            let nameStr = `<div style="max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${b.name || ''}"><b style="color:white;">${b.name || 'Unknown'}</b></div>`; 
                            let exStr = `${b.byes||0}b, ${b.legbyes||0}lb`; 
                            let nb = b.nb || 0; let wd = b.wd || 0; 
                            html += `<tr><td>${nameStr}</td><td style="color:white;">${formatOver(b.o||0)}</td><td style="color:white;">${b.m||0}</td><td style="color:white;">${totalRuns}</td><td style="font-weight:bold; font-size:1rem; color:var(--danger);">${b.w||0}</td><td style="color:var(--accent);">${econ}</td><td style="font-size:0.75rem; color:white;">${exStr}</td><td style="color:white;">${nb}</td><td style="color:white;">${wd}</td></tr>`; 
                        } 
                    });
                }
                
                html += `</tbody></table>`;
                if(inn.fow && inn.fow.length > 0) { 
                    let fowStr = inn.fow.map(f => `<b style="color:white;">${f.runs || 0}/${f.wktNum==='Unbroken'?'*':f.wktNum}</b> <span style="font-size:0.65rem; color:white;">(${f.outBatter || ''}, ${f.overs || '0.0'} ov)</span>`).join(', '); 
                    html += `<div style="font-size:0.75rem; color:#94a3b8; background:rgba(0,0,0,0.3); padding:8px; border-radius:6px; border-left:3px solid var(--accent);"><b style="color:white;">Fall of Wickets:</b><br><div style="margin-top:4px; line-height:1.4;">${fowStr}</div></div>`; 
                }
                html += `</div>`;
            });
        }
        
        let currentAllowances = (state.current && state.current.allowances) ? state.current.allowances : 0; 
        if (state.inningsSummaries.length > 0 && state.inningsNum === state.inningsSummaries.length) { 
            currentAllowances = state.inningsSummaries[state.inningsSummaries.length - 1].allowances || 0; 
        }
        html += `</div><div style="border-top:1px solid var(--border); padding-top:10px;"><label class="text-accent">Official Match Result / Status</label><input type="text" id="finalMatchResult" class="modal-input w-100" value="${state.matchResult || autoRes}" placeholder="e.g., Match Awarded, Follow-on, etc."><label class="text-accent mt-5">Allowances for Inning (Mins)</label><input type="number" id="inningAllowancesInput" class="modal-input w-100" placeholder="e.g. 15" value="${currentAllowances}">`;
        
        html += `<div class="flex-row gap-10 mt-10 mb-10">
                    <button type="button" onclick="downloadSummaryExcel(); enableSummaryConfirm();" class="btn-action w-100" style="background:#0284c7; padding:12px; font-size:1rem; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">📥 EXCEL</button>
                    <button type="button" onclick="downloadSummaryPDF(); enableSummaryConfirm();" class="btn-action w-100" style="background:#be123c; padding:12px; font-size:1rem; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">🖨️ PDF / PRINT</button>
                 </div>
                 </div>`;
                 
        showModal(isGameOver ? "🏁 MATCH COMPLETE" : (isTransition ? `🛑 END OF INNINGS ${state.inningsNum}` : "📋 DETAILED MATCH SCORECARD"), html, () => { 
            state.matchResult = el('finalMatchResult') ? el('finalMatchResult').value : autoRes; 
            if(el('inningAllowancesInput')) { let val = parseInt(el('inningAllowancesInput').value) || 0; state.current.allowances = val; if (state.inningsSummaries.length > 0 && state.inningsNum === state.inningsSummaries.length) { state.inningsSummaries[state.inningsSummaries.length - 1].allowances = val; } }
            closeModal(); 
            setTimeout(() => { if (isGameOver) { logCareerStats(); setTimeout(() => { resetMatch(); }, 1000); } else if (isTransition) { openTransitionManager(); } }, 300);
        }, hideCancel, "700px", confirmBtnText, requiresDownload);
        
        if (el('modalCancelBtn')) el('modalCancelBtn').innerText = "🔙 Go Back & Edit";

    } catch(err) {
        console.error("Show Match Summary Error:", err);
        alert("A critical error occurred while generating the scorecard. Please check the developer console (F12).");
    }
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
    updateUI();
}

function manualRotateUI() { saveState(); manualRotate(); }
function manualRotate() { [state.current.sIdx, state.current.nsIdx] = [state.current.nsIdx, state.current.sIdx]; updateUI(); }
function saveState() { try { stateHistory.push(JSON.stringify(state, (key, value) => value instanceof Set ? [...value] : value)); if (stateHistory.length > 300) stateHistory.shift(); } catch(e) { console.warn("State save failed"); } }
function undoLastAction() { if (stateHistory.length > 0) { let prevState = JSON.parse(stateHistory.pop()); prevState.current.lastOverBowlers = new Set(prevState.current.lastOverBowlers); prevState.current.bowlersInCurrentOver = new Set(prevState.current.bowlersInCurrentOver); state = prevState; updateUI(); } else { alert("Nothing to undo!"); } }

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
