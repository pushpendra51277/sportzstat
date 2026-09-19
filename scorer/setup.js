window.onload = function() {
    if (el('savedTeamsList') && typeof teamRegistry !== 'undefined') {
        let opts = ''; for (let teamName in teamRegistry) { opts += `<option value="${teamName}">`; } el('savedTeamsList').innerHTML = opts; 
    }

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
                
                if (state.matchSettings.matchType === 'multiday') { el('breakBtn').classList.remove('hidden'); }
                activeMatch = JSON.parse(localStorage.getItem('cricStat_activeMatchMetadata')) || null;
                
                let savedHistory = localStorage.getItem('cricStat_stateHistory');
                if (savedHistory) { stateHistory = JSON.parse(savedHistory); }

                updateUI(); closeModal();
            } catch(e) { console.error("Corrupted local state.", e); localStorage.removeItem('cricStat_activeMatch'); location.reload(); }
        }, false, "360px", "Resume Match");
        el('modalCancelBtn').innerText = "Start Fresh (Enter PIN)"; 
        el('modalCancelBtn').onclick = function() { localStorage.removeItem('cricStat_activeMatch'); closeModal(); };
    }
};

async function authenticateMatch() {
    try {
        const matchId = el('login-match-id').value.trim().toUpperCase();
        const pin = el('login-pin').value.trim();
        const errBox = el('login-error');

        if(!matchId || !pin) { errBox.innerText = "Please enter both Match ID and PIN."; return; }
        errBox.style.color = "#38bdf8"; errBox.innerText = "⏳ Authenticating with Cloud...";

        if (!supabaseClient) throw new Error("Database connection failed. Please check your internet connection.");

        // 🔥 FIX: Explicit tournaments(name) added here to grab the parent name!
        const { data, error } = await supabaseClient.from('matches').select('*, tournaments(name)').eq('match_id', matchId).eq('scorer_pin', pin).single();

        if (error || !data) { errBox.style.color = "#ef4444"; errBox.innerText = "❌ Invalid Match ID or PIN."; return; }

        let fullState = data.full_state || {};

        if (fullState.match_status === 'completed') {
            errBox.style.color = "#f59e0b";
            errBox.innerHTML = "🏁 <b>Match Locked</b><br><span style='font-size:0.85rem; color:#94a3b8;'>This match has already been completed.</span>";
            return;
        }

        activeMatch = data;
        localStorage.setItem('cricStat_activeMatchMetadata', JSON.stringify(activeMatch));

        if (fullState.match_status === 'live') {
            showModal("☁️ Cloud Sync Found", "<div class='text-center mt-10 text-success font-bold'>Match is already in progress!</div><div class='text-center text-muted mt-5' style='font-size:0.85rem;'>Resuming from the latest cloud save...</div>", function() {
                try {
                    let parsedState = fullState;
                    parsedState.current.lastOverBowlers = new Set(parsedState.current.lastOverBowlers || []); 
                    parsedState.current.bowlersInCurrentOver = new Set(parsedState.current.bowlersInCurrentOver || []); 
                    state = parsedState;
                    el('login-screen').classList.add('hidden'); 
                    el('top-title').classList.add('hidden');
                    el('scoringView').classList.remove('hidden'); 
                    
                    if (state.matchSettings.matchType === 'multiday') { el('breakBtn').classList.remove('hidden'); }
                    
                    updateUI(); 
                    closeModal();
                } catch(e) { console.error("Cloud Resume Error", e); alert("Error loading cloud state."); }
            }, true, "360px", "Resume Match");
            return;
        }

        el('login-screen').classList.add('hidden');
        el('toss-screen').classList.remove('hidden');
        
        let t1 = fullState.team1 || (fullState.teams && fullState.teams.A ? fullState.teams.A.name : 'Team A');
        let t2 = fullState.team2 || (fullState.teams && fullState.teams.B ? fullState.teams.B.name : 'Team B');

        el('tossWinner').innerHTML = `<option value="A">${t1}</option><option value="B">${t2}</option>`;
        el('team-a-name').innerText = t1;
        el('team-b-name').innerText = t2;

        errBox.innerText = ""; 

        await loadTournamentSquads(activeMatch.team_a_id, 'team-a', t1);
        await loadTournamentSquads(activeMatch.team_b_id, 'team-b', t2);
        
    } catch(e) {
        console.error("Auth Exception:", e);
        let errBox = el('login-error');
        if(errBox) { errBox.style.color = "#ef4444"; errBox.innerText = "❌ System Error: " + e.message; }
    }
}

async function loadTournamentSquads(teamId, containerPrefix, fallbackTeamName) {
    const container = el(`${containerPrefix}-squad`);
    
    if (!activeMatch.tournament_id || !teamId) {
        let html = `<div style="color:#f59e0b; font-size:0.85rem; margin-bottom:10px; background:rgba(245,158,11,0.1); padding:8px; border-radius:4px;">No linked cloud roster found. Generating local squad.</div>`;
        for(let i=1; i<=15; i++) {
            let isXI = i <= 11 ? "xi" : "none";
            let selXI = i <= 11 ? "selected" : "";
            let selSub = "";
            let selNone = i > 11 ? "selected" : "";
            
            html += `<div class="player-row"><span style="font-weight:bold; font-size:0.95rem;">${i}. ${fallbackTeamName} Player ${i}</span><select class="role-select role-${containerPrefix} ${isXI}" data-pid="dummy_${i}" data-pname="${fallbackTeamName} Player ${i}" onchange="updateSquadCounters('${containerPrefix}', this)">
                <option value="none" ${selNone}>Not Playing</option>
                <option value="xi" ${selXI}>Playing XI</option>
                <option value="sub" ${selSub}>Substitute</option>
            </select></div>`;
        }
        container.innerHTML = html;
        let dummySelect = container.querySelector('select');
        if (dummySelect) updateSquadCounters(containerPrefix, dummySelect);
        return;
    }

    const { data, error } = await supabaseClient.from('tournament_squads').select('player_id, players(full_name)').eq('tournament_id', activeMatch.tournament_id).eq('team_id', teamId);

    if(error || !data || data.length === 0) { 
        container.innerHTML = `<div style="color:#ef4444;">No players assigned by Admin. Return to Tournament Creator to add players.</div>`; 
        return; 
    }

    let html = "";
    data.forEach((row, index) => {
        if(row.players) {
            html += `<div class="player-row"><span style="font-weight:bold; font-size:0.95rem;">${index + 1}. ${row.players.full_name}</span><select class="role-select role-${containerPrefix}" data-pid="${row.player_id}" data-pname="${row.players.full_name}" onchange="updateSquadCounters('${containerPrefix}', this)"><option value="none">Not Playing</option><option value="xi">Playing XI</option><option value="sub">Substitute</option></select></div>`;
        }
    });
    container.innerHTML = html;
}

function updateSquadCounters(prefix, selectElement) {
    selectElement.classList.remove('xi', 'sub');
    if(selectElement.value === 'xi') selectElement.classList.add('xi');
    if(selectElement.value === 'sub') selectElement.classList.add('sub');
    let xiCount = 0, subCount = 0;
    document.querySelectorAll(`.role-${prefix}`).forEach(sel => { if(sel.value === 'xi') xiCount++; if(sel.value === 'sub') subCount++; });
    el(`count-xi-${prefix}`).innerText = `XI: ${xiCount}/11`; el(`count-sub-${prefix}`).innerText = `Subs: ${subCount}/4`;
    el(`count-xi-${prefix}`).style.color = xiCount > 11 ? '#ef4444' : '#34d399'; el(`count-sub-${prefix}`).style.color = subCount > 4 ? '#ef4444' : '#fbbf24';
}

function buildPlayerObject(p, isXi) {
    return { id: p.id, regNo: "", name: p.name, desig: "", r:0, b:0, f:0, s:0, out:false, outOnDuck:0, hasBatted: false, dismissalInfo: "", o:0, rc:0, w:0, m:0, ex:0, wd:0, nb:0, byes:0, legbyes:0, cw:0, catches:0, stumpings:0, runouts:0, quotaOvers: 0, inTime: null, outTime: null, isPlayingXI: isXi, skill: "Batter / Bowler", breakMins: 0 };
}

async function lockPlayingXI() {
    let tA_XI = [], tA_Sub = [], tB_XI = [], tB_Sub = [];
    document.querySelectorAll('.role-team-a').forEach(sel => { if(sel.value === 'xi') tA_XI.push({ id: sel.dataset.pid, name: sel.dataset.pname }); if(sel.value === 'sub') tA_Sub.push({ id: sel.dataset.pid, name: sel.dataset.pname }); });
    document.querySelectorAll('.role-team-b').forEach(sel => { if(sel.value === 'xi') tB_XI.push({ id: sel.dataset.pid, name: sel.dataset.pname }); if(sel.value === 'sub') tB_Sub.push({ id: sel.dataset.pid, name: sel.dataset.pname }); });

    if(tA_XI.length === 0 || tB_XI.length === 0) { alert("Select at least 1 player in the Playing XI for both teams!"); return; }

    state.matchId = activeMatch.match_id;
    state.teams.A.name = el('team-a-name').innerText;
    state.teams.B.name = el('team-b-name').innerText;
    
    state.teams.A.players = [...tA_XI.map(p => buildPlayerObject(p, true)), ...tA_Sub.map(p => buildPlayerObject(p, false))];
    state.teams.B.players = [...tB_XI.map(p => buildPlayerObject(p, true)), ...tB_Sub.map(p => buildPlayerObject(p, false))];

    let win = el('tossWinner').value, dec = el('tossDecision').value;
    state.battingKey = ((win === 'A' && dec === 'bat') || (win === 'B' && dec === 'bowl')) ? 'A' : 'B';
    state.bowlingKey = state.battingKey === 'A' ? 'B' : 'A';

    let updatedFullState = activeMatch.full_state || {};
    updatedFullState.match_status = 'live';
    const { error } = await supabaseClient.from('matches').update({ full_state: updatedFullState }).eq('match_id', activeMatch.match_id);
    if(error) { alert("Error connecting to cloud: " + error.message); return; }

    el('toss-screen').classList.add('hidden');
    el('initialization-screen').classList.remove('hidden');
    
    el('init-bat-title').innerText = `${state.teams[state.battingKey].name} Openers`;
    el('init-bowl-title').innerText = `${state.teams[state.bowlingKey].name} Bowler`;

    let batOpts = '<option value="">-- Select Batter --</option>';
    state.teams[state.battingKey].players.forEach((p, index) => { if(p.isPlayingXI) batOpts += `<option value="${index}">${p.name}</option>`; });
    
    let bowlOpts = '<option value="">-- Select Bowler --</option>';
    state.teams[state.bowlingKey].players.forEach((p, index) => { if(p.isPlayingXI) bowlOpts += `<option value="${index}">${p.name}</option>`; });

    el('sel-striker').innerHTML = batOpts; el('sel-nonstriker').innerHTML = batOpts; el('sel-bowler').innerHTML = bowlOpts;
}

function startInnings() {
    const s = el('sel-striker').value, ns = el('sel-nonstriker').value, b = el('sel-bowler').value;
    if(!s || !ns || !b) { alert("You must select the Striker, Non-Striker, and Opening Bowler to begin."); return; }
    if(s === ns) { alert("Striker and Non-Striker cannot be the same person!"); return; }

    state.current.sIdx = parseInt(s); state.current.nsIdx = parseInt(ns); state.current.bIdx = parseInt(b);
    getBatTeam().players[state.current.sIdx].hasBatted = true; getBatTeam().players[state.current.nsIdx].hasBatted = true;
    state.current.bowlersInCurrentOver.add(state.current.bIdx);
    state.current.inningsStartTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    if (activeMatch && activeMatch.full_state) {
        let format = activeMatch.full_state.format || 'T20';
        if (format.includes('Multi-Day') || format === 'Test') {
            state.matchSettings.matchType = 'multiday';
            state.matchSettings.maxOvers = 999;
            state.matchSettings.bowlerQuota = 999;
            state.matchSettings.maxInnings = 4;
            el('breakBtn').classList.remove('hidden');
        } else if (format === 'One Day') {
            state.matchSettings.matchType = 'oneday';
            state.matchSettings.maxOvers = 50;
            state.matchSettings.bowlerQuota = 10;
            state.matchSettings.maxInnings = 2;
        } else {
            state.matchSettings.matchType = 't20';
            state.matchSettings.maxOvers = 20;
            state.matchSettings.bowlerQuota = 4;
            state.matchSettings.maxInnings = 2;
        }
        state.matchSettings.originalMaxOvers = state.matchSettings.maxOvers;
    }

    if(activeMatch && activeMatch.full_state) {
        el('displayTournament').innerText = activeMatch.full_state.tournament || "MATCH IN PROGRESS"; 
    }
    el('dispGroundName').innerText = "Live Ground"; 
    
    el('initialization-screen').classList.add('hidden');
    el('top-title').classList.add('hidden');
    el('scoringView').classList.remove('hidden');
    updateUI();
}
