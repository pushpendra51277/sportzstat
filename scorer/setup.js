// ==========================================
// PRE-MATCH SETUP & AUTHENTICATION ENGINE
// ==========================================

let setupSquads = {
    A: { bench: [], xi: [], subs: [], roles: { c: null, vc: null, wk: null } },
    B: { bench: [], xi: [], subs: [], roles: { c: null, vc: null, wk: null } }
};

// Safe registry loader (will not crash if match_registry table doesn't exist)
async function fetchRegistry() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient.from('match_registry').select('*');
        if (!error && data) {
            let vHtml = '', oHtml = '';
            data.forEach(item => {
                if (item.category === 'venue') vHtml += `<option value="${item.name}">`;
                if (item.category === 'official') oHtml += `<option value="${item.name}">`;
            });
            if (el('db-venues')) el('db-venues').innerHTML = vHtml;
            if (el('db-officials')) el('db-officials').innerHTML = oHtml;
        }
    } catch (e) {
        console.warn("Notice: match_registry table not found. Using local input.");
    }
}

async function saveToRegistry(venue, officials) {
    if (!supabaseClient) return;
    let payload = [];
    if (venue) payload.push({ category: 'venue', name: venue });
    Object.values(officials).forEach(name => {
        if (name) payload.push({ category: 'official', name: name });
    });
    if (payload.length === 0) return;
    try {
        await supabaseClient.from('match_registry').upsert(payload, { onConflict: 'name' });
    } catch (e) {
        console.warn("Registry save skipped:", e.message);
    }
}

// Authentication Entry Point
async function authenticateMatch() {
    const matchId = el('login-match-id').value.trim().toUpperCase();
    const pin = el('login-pin').value.trim();
    const errBox = el('login-error');

    if (!matchId || !pin) {
        errBox.innerText = "Please enter both Match ID and PIN.";
        return;
    }
    errBox.style.color = "#38bdf8";
    errBox.innerText = "⏳ Authenticating with Cloud...";

    try {
        if (!supabaseClient) throw new Error("Supabase client is not initialized.");

        const { data, error } = await supabaseClient
            .from('matches')
            .select('*, tournaments(name)')
            .eq('match_id', matchId)
            .eq('scorer_pin', pin)
            .single();

        if (error || !data) {
            console.error("Match authentication error:", error);
            errBox.style.color = "#ef4444";
            errBox.innerText = "❌ Invalid Match ID or PIN.";
            return;
        }

        console.log("✅ Authenticated Match Record:", data);
        activeMatch = data;
        localStorage.setItem('cricStat_activeMatchMetadata', JSON.stringify(activeMatch));

        let fullState = data.full_state || {};

        if (fullState.match_status === 'completed') {
            errBox.style.color = "#f59e0b";
            errBox.innerHTML = "🏁 <b>Match Locked</b><br><span style='font-size:0.85rem; color:#94a3b8;'>This match has already ended.</span>";
            return;
        }

        if (fullState.match_status === 'live') {
            showModal("☁️ Cloud Sync Found", "<div class='text-center mt-10 text-success font-bold'>Match is already in progress!</div>", function() {
                try {
                    let parsedState = fullState;
                    parsedState.current.lastOverBowlers = new Set(parsedState.current.lastOverBowlers || []);
                    parsedState.current.bowlersInCurrentOver = new Set(parsedState.current.bowlersInCurrentOver || []);
                    state = parsedState;
                    el('login-screen').classList.add('hidden');
                    el('top-title').classList.add('hidden');
                    el('scoringView').classList.remove('hidden');
                    if (state.matchSettings?.matchType === 'multiday') el('breakBtn').classList.remove('hidden');
                    updateUI();
                    closeModal();
                } catch(e) {
                    alert("Error parsing live state: " + e.message);
                }
            }, true, "360px", "Resume Match");
            return;
        }

        // Reset squads
        setupSquads = {
            A: { bench: [], xi: [], subs: [], roles: { c: null, vc: null, wk: null } },
            B: { bench: [], xi: [], subs: [], roles: { c: null, vc: null, wk: null } }
        };

        el('login-screen').classList.add('hidden');
        el('toss-screen').classList.remove('hidden');

        let t1 = fullState.team1 || fullState.teams?.A?.name || 'Team A';
        let t2 = fullState.team2 || fullState.teams?.B?.name || 'Team B';

        el('tossWinner').innerHTML = `<option value="A">${t1}</option><option value="B">${t2}</option>`;
        el('team-a-name').innerText = t1;
        el('team-b-name').innerText = t2;
        errBox.innerText = "";

        await loadSquadResilient(activeMatch.team_a_id, 'A', t1);
        await loadSquadResilient(activeMatch.team_b_id, 'B', t2);

    } catch (e) {
        console.error("Auth Exception:", e);
        errBox.style.color = "#ef4444";
        errBox.innerText = "❌ System Error: " + e.message;
    }
}

// Resilient multi-tier squad loader
async function loadSquadResilient(teamId, teamKey, fallbackTeamName) {
    console.log(`🔍 Loading Squad for ${teamKey} (Team ID: ${teamId}, Tournament ID: ${activeMatch?.tournament_id})`);

    // Tier 1: Check if full_state already contains the roster
    let existingPlayers = activeMatch.full_state?.teams?.[teamKey]?.players;
    if (existingPlayers && existingPlayers.length > 0) {
        console.log(`✓ Loaded ${existingPlayers.length} players from full_state cache for ${teamKey}`);
        existingPlayers.forEach(p => setupSquads[teamKey].bench.push({ id: p.id || p.regNo, name: p.name }));
        renderTapAndFly(teamKey);
        return;
    }

    // Tier 2: Check tournament_squads with join
    if (activeMatch.tournament_id && teamId) {
        const { data, error } = await supabaseClient
            .from('tournament_squads')
            .select('player_id, players(id, full_name, name)')
            .eq('tournament_id', activeMatch.tournament_id)
            .eq('team_id', teamId);

        if (!error && data && data.length > 0) {
            console.log(`✓ Loaded ${data.length} players from tournament_squads join for ${teamKey}`);
            data.forEach((row, idx) => {
                let pName = row.players?.full_name || row.players?.name || `${fallbackTeamName} Player ${idx + 1}`;
                setupSquads[teamKey].bench.push({ id: row.player_id || `pid_${idx}`, name: pName });
            });
            renderTapAndFly(teamKey);
            return;
        }

        if (error) {
            console.warn("tournament_squads join failed, attempting separate lookup:", error.message);
            // Tier 3: Foreign key missing; fetch player_ids then fetch from players directly
            const { data: squadRows } = await supabaseClient
                .from('tournament_squads')
                .select('player_id')
                .eq('tournament_id', activeMatch.tournament_id)
                .eq('team_id', teamId);

            if (squadRows && squadRows.length > 0) {
                const pIds = squadRows.map(r => r.player_id).filter(Boolean);
                const { data: playerDetails } = await supabaseClient
                    .from('players')
                    .select('*')
                    .in('id', pIds);

                if (playerDetails && playerDetails.length > 0) {
                    console.log(`✓ Loaded ${playerDetails.length} players via manual join for ${teamKey}`);
                    playerDetails.forEach((p, idx) => {
                        setupSquads[teamKey].bench.push({ id: p.id, name: p.full_name || p.name || `Player ${idx + 1}` });
                    });
                    renderTapAndFly(teamKey);
                    return;
                }
            }
        }
    }

    // Tier 4: Fallback squad generation so scorer is never blocked
    console.warn(`⚠️ No cloud squad found for ${teamKey}. Generating local placeholder squad.`);
    for (let i = 1; i <= 15; i++) {
        setupSquads[teamKey].bench.push({ id: `dummy_${teamKey}_${i}`, name: `${fallbackTeamName} Player ${i}` });
    }
    renderTapAndFly(teamKey);
}

function renderTapAndFly(tKey) {
    let sq = setupSquads[tKey];
    
    el(`bench-${tKey}`).innerHTML = sq.bench.map(p => 
        `<div class="tf-player tf-bench" onclick="tapPlayer('${tKey}', '${p.id}', 'bench')">
            <span>${p.name}</span> <span>➡</span>
        </div>`
    ).join('');

    el(`xi-${tKey}`).innerHTML = sq.xi.map(p => {
        let isC = sq.roles.c === p.id ? 'active c' : '';
        let isVC = sq.roles.vc === p.id ? 'active vc' : '';
        let isWK = sq.roles.wk === p.id ? 'active wk' : '';
        return `
        <div class="tf-player tf-xi" onclick="tapPlayer('${tKey}', '${p.id}', 'xi')">
            <span>${p.name}</span>
            <div class="role-badges" onclick="event.stopPropagation()">
                <span class="r-badge ${isC}" onclick="setRole(event, '${tKey}', '${p.id}', 'c')">C</span>
                <span class="r-badge ${isVC}" onclick="setRole(event, '${tKey}', '${p.id}', 'vc')">VC</span>
                <span class="r-badge ${isWK}" onclick="setRole(event, '${tKey}', '${p.id}', 'wk')">WK</span>
            </div>
        </div>`;
    }).join('');

    el(`subs-${tKey}`).innerHTML = sq.subs.map(p => 
        `<div class="tf-player tf-sub" onclick="tapPlayer('${tKey}', '${p.id}', 'subs')">
            <span>${p.name}</span> <span>⬅</span>
        </div>`
    ).join('');

    el(`count-${tKey}-xi`).innerText = `${sq.xi.length}/11`;
    el(`count-${tKey}-subs`).innerText = `${sq.subs.length}/4`;
    el(`count-${tKey}-xi`).style.color = sq.xi.length > 11 ? '#ef4444' : '#10b981';
}

function tapPlayer(tKey, pId, fromPane) {
    let sq = setupSquads[tKey];
    if (fromPane === 'bench') {
        let pIdx = sq.bench.findIndex(x => String(x.id) === String(pId));
        let p = sq.bench.splice(pIdx, 1)[0];
        if (sq.xi.length < 11) {
            sq.xi.push(p);
        } else if (sq.subs.length < 4) {
            sq.subs.push(p);
        } else {
            sq.bench.push(p);
            alert("Squad limits reached (Max 11 in Playing XI, 4 Substitutes).");
        }
    } else if (fromPane === 'xi') {
        let pIdx = sq.xi.findIndex(x => String(x.id) === String(pId));
        let p = sq.xi.splice(pIdx, 1)[0];
        sq.bench.push(p);
        if (sq.roles.c === pId) sq.roles.c = null;
        if (sq.roles.vc === pId) sq.roles.vc = null;
        if (sq.roles.wk === pId) sq.roles.wk = null;
    } else if (fromPane === 'subs') {
        let pIdx = sq.subs.findIndex(x => String(x.id) === String(pId));
        let p = sq.subs.splice(pIdx, 1)[0];
        sq.bench.push(p);
    }
    renderTapAndFly(tKey);
}

function setRole(e, tKey, pId, role) {
    e.stopPropagation();
    if (setupSquads[tKey].roles[role] === pId) {
        setupSquads[tKey].roles[role] = null;
    } else {
        setupSquads[tKey].roles[role] = pId;
    }
    renderTapAndFly(tKey);
}

function buildPlayerObject(p, isXi, tKey) {
    let roles = setupSquads[tKey].roles;
    let desig = [];
    if (roles.c === p.id) desig.push('C');
    if (roles.vc === p.id) desig.push('VC');
    let skill = "Batter / Bowler";
    if (roles.wk === p.id) {
        skill = "WK";
        if (desig.includes('C')) desig = ['C/WK'];
    }
    return {
        id: p.id, regNo: "", name: p.name, desig: desig.join('/'), r: 0, b: 0, f: 0, s: 0,
        out: false, outOnDuck: 0, hasBatted: false, dismissalInfo: "",
        o: 0, rc: 0, w: 0, m: 0, ex: 0, wd: 0, nb: 0, byes: 0, legbyes: 0, cw: 0,
        catches: 0, stumpings: 0, runouts: 0, quotaOvers: 0,
        inTime: null, outTime: null, isPlayingXI: isXi, skill: skill, breakMins: 0
    };
}

async function lockPlayingXI() {
    if (setupSquads.A.xi.length === 0 || setupSquads.B.xi.length === 0) {
        alert("Select at least 1 player in the Playing XI for both teams!");
        return;
    }

    state.matchId = activeMatch.match_id;
    state.teams.A.name = el('team-a-name').innerText;
    state.teams.B.name = el('team-b-name').innerText;

    state.teams.A.players = [
        ...setupSquads.A.xi.map(p => buildPlayerObject(p, true, 'A')),
        ...setupSquads.A.subs.map(p => buildPlayerObject(p, false, 'A'))
    ];
    state.teams.B.players = [
        ...setupSquads.B.xi.map(p => buildPlayerObject(p, true, 'B')),
        ...setupSquads.B.subs.map(p => buildPlayerObject(p, false, 'B'))
    ];

    state.matchSettings.venue = el('match-venue')?.value.trim() || "Live Ground";
    state.matchSettings.officials = {
        referee: el('match-referee')?.value.trim() || "",
        coach: el('match-coach')?.value.trim() || "",
        manager: el('match-manager')?.value.trim() || "",
        umpire1: el('umpire-1')?.value.trim() || "",
        umpire2: el('umpire-2')?.value.trim() || "",
        umpire3: el('umpire-3')?.value.trim() || "",
        umpire4: el('umpire-4')?.value.trim() || "",
        scorer1: el('scorer-1')?.value.trim() || "",
        scorer2: el('scorer-2')?.value.trim() || ""
    };
    saveToRegistry(state.matchSettings.venue, state.matchSettings.officials);

    let win = el('tossWinner').value, dec = el('tossDecision').value;
    state.battingKey = ((win === 'A' && dec === 'bat') || (win === 'B' && dec === 'bowl')) ? 'A' : 'B';
    state.bowlingKey = state.battingKey === 'A' ? 'B' : 'A';

    let updatedFullState = activeMatch.full_state || {};
    updatedFullState.match_status = 'live';
    
    try {
        await supabaseClient.from('matches').update({ full_state: updatedFullState }).eq('match_id', activeMatch.match_id);
    } catch(e) {
        console.warn("Status update non-fatal error:", e);
    }

    el('toss-screen').classList.add('hidden');
    el('initialization-screen').classList.remove('hidden');

    el('init-bat-title').innerText = `${state.teams[state.battingKey].name} Openers`;
    el('init-bowl-title').innerText = `${state.teams[state.bowlingKey].name} Bowler`;

    let batOpts = '<option value="">-- Select Batter --</option>';
    state.teams[state.battingKey].players.forEach((p, idx) => {
        if (p.isPlayingXI) batOpts += `<option value="${idx}">${p.name}</option>`;
    });

    let bowlOpts = '<option value="">-- Select Bowler --</option>';
    state.teams[state.bowlingKey].players.forEach((p, idx) => {
        if (p.isPlayingXI) bowlOpts += `<option value="${idx}">${p.name}</option>`;
    });

    el('sel-striker').innerHTML = batOpts;
    el('sel-nonstriker').innerHTML = batOpts;
    el('sel-bowler').innerHTML = bowlOpts;
}
