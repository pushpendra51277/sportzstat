// ==========================================
// 1. GLOBALS & SUPABASE (scorer/setup.js)
// ==========================================
var SUPABASE_URL = "https://cavkoylkbcyhsifrsjyd.supabase.co";   
var SUPABASE_KEY = "sb_publishable_wklRlSZbzArKFCq31Ugnrw_JWAJkS4K"; 
var supabaseClient = (typeof window.supabase !== 'undefined') ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Global Helpers
function el(id) { return document.getElementById(id); }
function getBatTeam() { return state.teams[state.battingKey]; }
function getBowlTeam() { return state.teams[state.bowlingKey]; }
function formatOver(balls) { return Math.floor(balls / 6) + "." + (balls % 6); }
function getBadgeHtml(b) { return b.type === 'divider' ? '<span class="over-divider">/</span>' : '<div class="ball-badge ball-' + b.type + '">' + b.label + '</div>'; }

var activeMatch = null;
var setupSquads = { A: { bench: [], xi: [], subs: [], roles: { c: null, vc: null, wk: null } }, B: { bench: [], xi: [], subs: [], roles: { c: null, vc: null, wk: null } } };
var modalContext = {}, stateHistory = [], remarkLog = [];
var state = { matchId: "", inningsNum: 1, battingKey: 'A', bowlingKey: 'B', matchResult: "", matchSettings: { matchType: 't20', category: 'men', maxOvers: 20, originalMaxOvers: 20, customTarget: null, customTargetOvers: null, targetMethod: "", bowlerQuota: 4, matchSelectors: [], venue: "", officials: {} }, teams: { A: { name: "", players: [], pendingPenalties: 0 }, B: { name: "", players: [], pendingPenalties: 0 } }, current: { runs: 0, wkts: 0, balls: 0, sIdx: null, nsIdx: null, bIdx: null, isFreeHit: false, penalties: 0, lastOverBowlers: new Set(), extras: { w: 0, nb: 0, b: 0, lb: 0 }, recentBalls: [], currentOverLog: [], runsInThisOver: 0, bowlersInCurrentOver: new Set(), overHistory: [], currPartnership: { runs: 0, balls: 0 }, fow: [], activeBreak: null, activeBreakStartTime: null, activeBreakInsp: null, pendingBreakMins: 0, inningsStartTime: null, inningsEndTime: null, allowances: 0 }, inningsSummaries: [], matchBreaks: [] };

// Safe Set Converter & Cloud State Hydrator
function toSafeSet(val) {
    if (val instanceof Set) return val;
    if (Array.isArray(val)) return new Set(val);
    return new Set();
}

function hydrateCloudState(rawState, fallbackMatchId) {
    if (typeof fallbackMatchId === 'undefined') fallbackMatchId = "";
    var parsed = (typeof rawState === 'string') ? JSON.parse(rawState) : JSON.parse(JSON.stringify(rawState || {}));

    parsed.matchId = parsed.matchId || fallbackMatchId || "";
    parsed.inningsNum = parsed.inningsNum || 1;
    parsed.battingKey = parsed.battingKey || 'A';
    parsed.bowlingKey = parsed.bowlingKey || 'B';
    parsed.matchResult = parsed.matchResult || "";

    parsed.matchSettings = Object.assign({
        matchType: 't20', category: 'men', maxOvers: 20, originalMaxOvers: 20,
        customTarget: null, customTargetOvers: null, targetMethod: "",
        bowlerQuota: 4, maxInnings: 2, matchSelectors: [], venue: "", officials: {}
    }, parsed.matchSettings || {});

    parsed.teams = parsed.teams || { A: { name: "Team A", players: [], pendingPenalties: 0 }, B: { name: "Team B", players: [], pendingPenalties: 0 } };
    parsed.teams.A = Object.assign({ name: parsed.team1 || "Team A", players: [], pendingPenalties: 0 }, parsed.teams.A || {});
    parsed.teams.B = Object.assign({ name: parsed.team2 || "Team B", players: [], pendingPenalties: 0 }, parsed.teams.B || {});
    parsed.teams.A.players = Array.isArray(parsed.teams.A.players) ? parsed.teams.A.players : [];
    parsed.teams.B.players = Array.isArray(parsed.teams.B.players) ? parsed.teams.B.players : [];

    parsed.current = Object.assign({
        runs: 0, wkts: 0, balls: 0, sIdx: null, nsIdx: null, bIdx: null,
        isFreeHit: false, penalties: 0, extras: { w: 0, nb: 0, b: 0, lb: 0 },
        recentBalls: [], currentOverLog: [], runsInThisOver: 0,
        overHistory: [], currPartnership: { runs: 0, balls: 0 }, fow: [],
        activeBreak: null, activeBreakStartTime: null, activeBreakInsp: null,
        pendingBreakMins: 0, inningsStartTime: null, inningsEndTime: null, allowances: 0
    }, parsed.current || {});

    parsed.current.lastOverBowlers = toSafeSet(parsed.current.lastOverBowlers);
    parsed.current.bowlersInCurrentOver = toSafeSet(parsed.current.bowlersInCurrentOver);
    parsed.current.extras = Object.assign({ w: 0, nb: 0, b: 0, lb: 0 }, parsed.current.extras || {});
    parsed.current.recentBalls = Array.isArray(parsed.current.recentBalls) ? parsed.current.recentBalls : [];
    parsed.current.currentOverLog = Array.isArray(parsed.current.currentOverLog) ? parsed.current.currentOverLog : [];
    parsed.current.overHistory = Array.isArray(parsed.current.overHistory) ? parsed.current.overHistory : [];
    parsed.current.fow = Array.isArray(parsed.current.fow) ? parsed.current.fow : [];
    parsed.current.currPartnership = Object.assign({ runs: 0, balls: 0 }, parsed.current.currPartnership || {});

    parsed.inningsSummaries = Array.isArray(parsed.inningsSummaries) ? parsed.inningsSummaries : [];
    parsed.matchBreaks = Array.isArray(parsed.matchBreaks) ? parsed.matchBreaks : [];

    return parsed;
}

// Safe Login Status Helper (Never crashes if #login-error is missing)
function setLoginFeedback(msg, color, showAlert) {
    var errBox = el('login-error');
    if (!errBox && el('login-screen')) {
        errBox = document.createElement('div');
        errBox.id = 'login-error';
        errBox.style.marginTop = '12px';
        errBox.style.fontWeight = 'bold';
        errBox.style.fontSize = '0.9rem';
        el('login-screen').appendChild(errBox);
    }
    if (errBox) {
        errBox.classList.remove('hidden');
        errBox.style.display = 'block';
        errBox.style.color = color || '#ef4444';
        errBox.innerHTML = msg;
    }
    if (showAlert) {
        alert(msg.replace(/<[^>]*>?/gm, ''));
    }
}

function populateOpenersScreen() {
    if (el('toss-screen')) el('toss-screen').classList.add('hidden');
    if (el('login-screen')) el('login-screen').classList.add('hidden');
    if (el('scoringView')) el('scoringView').classList.add('hidden');
    if (el('initialization-screen')) el('initialization-screen').classList.remove('hidden');

    if (el('init-bat-title')) el('init-bat-title').innerText = state.teams[state.battingKey].name + " Openers";
    if (el('init-bowl-title')) el('init-bowl-title').innerText = state.teams[state.bowlingKey].name + " Bowler";

    var batOpts = '<option value="">-- Select Batter --</option>';
    state.teams[state.battingKey].players.forEach(function(p, index) {
        if (p.isPlayingXI) batOpts += '<option value="' + index + '">' + p.name + '</option>';
    });

    var bowlOpts = '<option value="">-- Select Bowler --</option>';
    state.teams[state.bowlingKey].players.forEach(function(p, index) {
        if (p.isPlayingXI) bowlOpts += '<option value="' + index + '">' + p.name + '</option>';
    });

    if (el('sel-striker')) el('sel-striker').innerHTML = batOpts;
    if (el('sel-nonstriker')) el('sel-nonstriker').innerHTML = batOpts;
    if (el('sel-bowler')) el('sel-bowler').innerHTML = bowlOpts;
}

// ==========================================
// 2. TIME & MODAL HELPERS
// ==========================================
function getTimeDropdownsHtml(prefix, allowNA) {
    if (typeof allowNA === 'undefined') allowNA = false;
    var d = new Date(); var curH = d.getHours(); var curM = d.getMinutes(); var ampm = curH >= 12 ? 'PM' : 'AM'; curH = curH % 12; if (curH === 0) curH = 12;
    var h = allowNA ? '<option value="">--</option>' : ''; var m = allowNA ? '<option value="">--</option>' : '';
    for (var i = 1; i <= 12; i++) { var val = i.toString().padStart(2, '0'); var sel = (!allowNA && i === curH) ? 'selected' : ''; h += '<option value="' + val + '" ' + sel + '>' + val + '</option>'; }
    for (var j = 0; j < 60; j++) { var valM = j.toString().padStart(2, '0'); var selM = (!allowNA && j === curM) ? 'selected' : ''; m += '<option value="' + valM + '" ' + selM + '>' + valM + '</option>'; }
    var amSel = (!allowNA && ampm === 'AM') ? 'selected' : ''; var pmSel = (!allowNA && ampm === 'PM') ? 'selected' : '';
    return '<div class="flex-row gap-5"><select id="' + prefix + 'Hr" class="modal-input" style="width:33%; margin-bottom:0;">' + h + '</select><select id="' + prefix + 'Min" class="modal-input" style="width:33%; margin-bottom:0;">' + m + '</select><select id="' + prefix + 'AmPm" class="modal-input" style="width:33%; margin-bottom:0;">' + (allowNA ? '<option value="">--</option>' : '') + '<option value="AM" ' + amSel + '>AM</option><option value="PM" ' + pmSel + '>PM</option></select></div>';
}

function parseTimeDropdowns(prefix) {
    var hrVal = el(prefix + 'Hr').value; if (!hrVal) return null;
    var hr = parseInt(hrVal, 10), min = el(prefix + 'Min').value || "00", ampm = el(prefix + 'AmPm').value || "AM";
    if (ampm === 'PM' && hr !== 12) hr += 12; if (ampm === 'AM' && hr === 12) hr = 0;
    return hr.toString().padStart(2, '0') + ":" + min;
}

function calculateDurationMins(startStr, endStr) {
    if (!startStr || !endStr) return 0;
    var sParts = startStr.split(':').map(Number), eParts = endStr.split(':').map(Number);
    var startMins = sParts[0] * 60 + sParts[1], endMins = eParts[0] * 60 + eParts[1];
    if (endMins < startMins) endMins += 24 * 60; return endMins - startMins;
}

function showModal(title, html, cb, hideCancel, customWidth, confirmBtnText, requiresDownload) {
    if (typeof hideCancel === 'undefined') hideCancel = false;
    if (typeof customWidth === 'undefined') customWidth = "360px";
    if (typeof confirmBtnText === 'undefined') confirmBtnText = "Confirm";
    if (typeof requiresDownload === 'undefined') requiresDownload = false;

    if (!el('dynamicModal')) return;
    el('modalHeading').innerText = title; el('modalBody').innerHTML = html;
    var cBtn = el('modalConfirmBtn'); cBtn.style.display = ''; cBtn.onclick = cb;
    el('modalBoxElement').style.maxWidth = customWidth;
    var cancelBtn = el('modalCancelBtn'); cancelBtn.innerText = "Cancel"; cancelBtn.onclick = closeModal;
    if (requiresDownload) { cBtn.disabled = true; cBtn.style.opacity = '0.5'; cBtn.style.cursor = 'not-allowed'; cBtn.dataset.origText = confirmBtnText; cBtn.innerText = "🔒 Download Report First"; cancelBtn.style.display = ''; cancelBtn.innerText = "🔙 Go Back & Edit"; } else { cBtn.disabled = false; cBtn.style.opacity = '1'; cBtn.style.cursor = 'pointer'; cBtn.innerText = confirmBtnText; cancelBtn.style.display = hideCancel ? 'none' : ''; }
    el('dynamicModal').classList.remove('hidden');
}

function closeModal() {
    if (el('dynamicModal')) el('dynamicModal').classList.add('hidden');
    var scoringBox = el('scoringEventsBox');
    if (scoringBox) { scoringBox.style.pointerEvents = 'auto'; scoringBox.style.opacity = '1'; }
}

// ==========================================
// 3. BOOTSTRAP & RESUME
// ==========================================
window.onload = async function() {
    if (typeof Chart !== 'undefined') { Chart.defaults.color = '#cbd5e1'; Chart.defaults.borderColor = '#334155'; }
    window.matchChart = null;
    await fetchRegistry();

    // Check URL parameters (?match=ID&pin=PIN)
    var urlParams = new URLSearchParams(window.location.search);
    var urlMatch = urlParams.get('match');
    var urlPin = urlParams.get('pin');
    if (urlMatch && el('login-match-id')) el('login-match-id').value = urlMatch;
    if (urlPin && el('login-pin')) el('login-pin').value = urlPin;

    var activeMatchStr = localStorage.getItem('cricStat_activeMatch');
    if (activeMatchStr) {
        showModal("Resume Match?", "An unfinished match was found in your browser. Would you like to resume it instantly without entering the PIN?", function() {
            try {
                state = hydrateCloudState(activeMatchStr);
                activeMatch = JSON.parse(localStorage.getItem('cricStat_activeMatchMetadata')) || null;
                var savedHistory = localStorage.getItem('cricStat_stateHistory');
                if (savedHistory) stateHistory = JSON.parse(savedHistory);

                var hasPlayers = state.teams.A.players.length > 0 && state.teams.B.players.length > 0;
                var hasOpeners = state.current.sIdx !== null && state.current.nsIdx !== null;

                if (!hasPlayers) {
                    localStorage.removeItem('cricStat_activeMatch');
                    closeModal();
                    return;
                }
                if (!hasOpeners) {
                    closeModal();
                    populateOpenersScreen();
                    return;
                }

                if (el('login-screen')) el('login-screen').classList.add('hidden');
                if (el('top-title')) el('top-title').classList.add('hidden');
                if (el('scoringView')) el('scoringView').classList.remove('hidden');
                if (state.matchSettings.matchType === 'multiday' && el('breakBtn')) el('breakBtn').classList.remove('hidden');
                if (typeof updateUI === 'function') updateUI();
                closeModal();
            } catch (e) {
                console.error("Local resume failed:", e);
                localStorage.removeItem('cricStat_activeMatch');
                location.reload();
            }
        }, false, "360px", "Resume Match");
        if (el('modalCancelBtn')) {
            el('modalCancelBtn').innerText = "Start Fresh (Enter PIN)";
            el('modalCancelBtn').onclick = function() { localStorage.removeItem('cricStat_activeMatch'); closeModal(); };
        }
    }
};

async function fetchRegistry() {
    if (!supabaseClient) return;
    try {
        var res = await supabaseClient.from('match_registry').select('*');
        if (!res.error && res.data) {
            var vHtml = '', oHtml = '';
            res.data.forEach(function(item) {
                if (item.category === 'venue') vHtml += '<option value="' + item.name + '">';
                if (item.category === 'official') oHtml += '<option value="' + item.name + '">';
            });
            if (el('db-venues')) el('db-venues').innerHTML = vHtml;
            if (el('db-officials')) el('db-officials').innerHTML = oHtml;
        }
    } catch (e) {}
}

async function saveToRegistry(venue, officials) {
    if (!supabaseClient) return;
    var payload = [];
    if (venue) payload.push({ category: 'venue', name: venue });
    Object.values(officials).forEach(function(o) { if (o) payload.push({ category: 'official', name: o }); });
    if (payload.length === 0) return;
    try { await supabaseClient.from('match_registry').upsert(payload, { onConflict: 'name' }); } catch (e) {}
}

async function authenticateMatch() {
    var unlockBtn = document.querySelector('#login-screen button');
    var origBtnText = unlockBtn ? unlockBtn.innerText : "Unlock Match";

    try {
        var matchInput = el('login-match-id');
        var pinInput = el('login-pin');
        var matchId = matchInput ? matchInput.value.trim().toUpperCase() : "";
        var pin = pinInput ? pinInput.value.trim() : "";

        if (!matchId || !pin) {
            setLoginFeedback("⚠️ Please enter both Match ID and Scorer PIN.", "#f59e0b", true);
            return;
        }

        if (unlockBtn) {
            unlockBtn.innerText = "⏳ Unlocking Match...";
            unlockBtn.disabled = true;
        }
        setLoginFeedback("⏳ Authenticating with Cloud...", "#38bdf8", false);

        if (!supabaseClient) {
            throw new Error("Supabase client did not initialize. Check your internet connection.");
        }

        // Step 1: Query match by Match ID first so we can give exact diagnostics
        var checkRes = await supabaseClient.from('matches').select('*').eq('match_id', matchId).maybeSingle();

        if (checkRes.error) {
            throw new Error("Database error: " + checkRes.error.message);
        }

        if (!checkRes.data) {
            if (unlockBtn) { unlockBtn.innerText = origBtnText; unlockBtn.disabled = false; }
            setLoginFeedback("❌ Match ID '" + matchId + "' was not found in the cloud database! Make sure the Admin clicked 'Confirm & Deploy to Cloud' in the Tournament Hub.", "#ef4444", true);
            return;
        }

        var data = checkRes.data;
        if (String(data.scorer_pin).trim() !== String(pin).trim()) {
            if (unlockBtn) { unlockBtn.innerText = origBtnText; unlockBtn.disabled = false; }
            setLoginFeedback("❌ Incorrect Scorer PIN for Match ID '" + matchId + "'.", "#ef4444", true);
            return;
        }

        var fullState = data.full_state || {};
        if (fullState.match_status === 'completed') {
            if (unlockBtn) { unlockBtn.innerText = origBtnText; unlockBtn.disabled = false; }
            setLoginFeedback("🏁 <b>Match Locked</b><br><span style='font-size:0.85rem; color:#94a3b8;'>This match has already been completed.</span>", "#f59e0b", true);
            return;
        }

        activeMatch = data;
        localStorage.setItem('cricStat_activeMatchMetadata', JSON.stringify(activeMatch));

        var hasValidCloudTeams = fullState.teams &&
                                 fullState.teams.A && Array.isArray(fullState.teams.A.players) && fullState.teams.A.players.length > 0 &&
                                 fullState.teams.B && Array.isArray(fullState.teams.B.players) && fullState.teams.B.players.length > 0;

        if (unlockBtn) { unlockBtn.innerText = origBtnText; unlockBtn.disabled = false; }

        if (fullState.match_status === 'live' && hasValidCloudTeams) {
            showModal("☁️ Cloud Sync Found", "<div class='text-center mt-10 text-success font-bold'>Match is already in progress!</div><div class='text-center text-muted mt-5' style='font-size:0.85rem;'>Resuming from the latest cloud save...</div>", function() {
                try {
                    state = hydrateCloudState(fullState, activeMatch.match_id);
                    closeModal();

                    if (state.current.sIdx === null || state.current.nsIdx === null) {
                        populateOpenersScreen();
                        return;
                    }

                    if (el('login-screen')) el('login-screen').classList.add('hidden');
                    if (el('top-title')) el('top-title').classList.add('hidden');
                    if (el('scoringView')) el('scoringView').classList.remove('hidden');
                    if (state.matchSettings.matchType === 'multiday' && el('breakBtn')) el('breakBtn').classList.remove('hidden');
                    if (typeof updateUI === 'function') updateUI();
                } catch (e) {
                    console.error("Cloud state load error:", e);
                    alert("Error loading cloud state: " + e.message);
                }
            }, true, "360px", "Resume Match");
            return;
        }

        setupSquads = { A: { bench: [], xi: [], subs: [], roles: { c: null, vc: null, wk: null } }, B: { bench: [], xi: [], subs: [], roles: { c: null, vc: null, wk: null } } };
        if (el('login-screen')) el('login-screen').classList.add('hidden');
        if (el('toss-screen')) el('toss-screen').classList.remove('hidden');

        var t1 = fullState.team1 || (fullState.teams && fullState.teams.A ? fullState.teams.A.name : 'Team A');
        var t2 = fullState.team2 || (fullState.teams && fullState.teams.B ? fullState.teams.B.name : 'Team B');
        if (el('tossWinner')) el('tossWinner').innerHTML = '<option value="A">' + t1 + '</option><option value="B">' + t2 + '</option>';
        if (el('team-a-name')) el('team-a-name').innerText = t1;
        if (el('team-b-name')) el('team-b-name').innerText = t2;
        setLoginFeedback("", "#38bdf8", false);

        await loadTournamentSquads(activeMatch.team_a_id, 'A', t1);
        await loadTournamentSquads(activeMatch.team_b_id, 'B', t2);
    } catch (e) {
        if (unlockBtn) { unlockBtn.innerText = origBtnText; unlockBtn.disabled = false; }
        console.error("Authentication Error:", e);
        setLoginFeedback("❌ System Error: " + e.message, "#ef4444", true);
    }
}

// ==========================================
// 4. TAP-AND-FLY SQUAD LOGIC
// ==========================================
async function loadTournamentSquads(teamId, teamKey, fallbackTeamName) {
    var savedPlayers = activeMatch.full_state && activeMatch.full_state.teams && activeMatch.full_state.teams[teamKey]
        ? activeMatch.full_state.teams[teamKey].players
        : null;

    if (savedPlayers && savedPlayers.length > 0) {
        savedPlayers.forEach(function(p) { setupSquads[teamKey].bench.push({ id: p.id || p.regNo, name: p.name }); });
        renderTapAndFly(teamKey);
        return;
    }
    if (!activeMatch.tournament_id || !teamId) {
        for (var i = 1; i <= 18; i++) setupSquads[teamKey].bench.push({ id: "dummy_" + teamKey + "_" + i, name: fallbackTeamName + " Player " + i });
        renderTapAndFly(teamKey);
        return;
    }
    var res = await supabaseClient.from('tournament_squads').select('player_id, players(full_name)').eq('tournament_id', activeMatch.tournament_id).eq('team_id', teamId);
    if (res.error || !res.data || res.data.length === 0) {
        for (var j = 1; j <= 18; j++) setupSquads[teamKey].bench.push({ id: "dummy_" + teamKey + "_" + j, name: fallbackTeamName + " Player " + j });
        renderTapAndFly(teamKey);
        return;
    }
    res.data.forEach(function(row, index) {
        var pName = (row.players && row.players.full_name) ? row.players.full_name : (fallbackTeamName + " Player " + (index + 1));
        var pId = row.player_id || ("dummy_" + teamKey + "_" + (index + 1));
        setupSquads[teamKey].bench.push({ id: pId, name: pName });
    });
    renderTapAndFly(teamKey);
}

function renderTapAndFly(tKey) {
    var sq = setupSquads[tKey];
    el('bench-' + tKey).innerHTML = sq.bench.map(function(p) {
        return '<div class="tf-player tf-bench" onclick="tapPlayer(\'' + tKey + '\', \'' + p.id + '\', \'bench\')"><span>' + p.name + '</span> <span>➡</span></div>';
    }).join('');
    el('xi-' + tKey).innerHTML = sq.xi.map(function(p) {
        var isC = sq.roles.c === p.id ? 'active c' : '';
        var isVC = sq.roles.vc === p.id ? 'active vc' : '';
        var isWK = sq.roles.wk === p.id ? 'active wk' : '';
        return '<div class="tf-player tf-xi" onclick="tapPlayer(\'' + tKey + '\', \'' + p.id + '\', \'xi\')"><span>' + p.name + '</span><div class="role-badges" onclick="event.stopPropagation()"><span class="r-badge ' + isC + '" onclick="setRole(event, \'' + tKey + '\', \'' + p.id + '\', \'c\')">C</span><span class="r-badge ' + isVC + '" onclick="setRole(event, \'' + tKey + '\', \'' + p.id + '\', \'vc\')">VC</span><span class="r-badge ' + isWK + '" onclick="setRole(event, \'' + tKey + '\', \'' + p.id + '\', \'wk\')">WK</span></div></div>';
    }).join('');
    el('subs-' + tKey).innerHTML = sq.subs.map(function(p) {
        return '<div class="tf-player tf-sub" onclick="tapPlayer(\'' + tKey + '\', \'' + p.id + '\', \'subs\')"><span>' + p.name + '</span> <span>⬅</span></div>';
    }).join('');
    el('count-' + tKey + '-xi').innerText = sq.xi.length + "/11";
    el('count-' + tKey + '-subs').innerText = sq.subs.length + "/7";
    el('count-' + tKey + '-xi').style.color = sq.xi.length > 11 ? '#ef4444' : '#10b981';
}

function tapPlayer(tKey, pId, fromPane) {
    var sq = setupSquads[tKey];
    if (fromPane === 'bench') {
        var pIdx = sq.bench.findIndex(function(x) { return String(x.id) === String(pId); });
        var p = sq.bench.splice(pIdx, 1)[0];
        if (sq.xi.length < 11) sq.xi.push(p);
        else if (sq.subs.length < 7) sq.subs.push(p);
        else { sq.bench.push(p); alert("Squad is full! Maximum 11 XI and 7 Subs."); }
    } else if (fromPane === 'xi') {
        var pIdxXi = sq.xi.findIndex(function(x) { return String(x.id) === String(pId); });
        var pXi = sq.xi.splice(pIdxXi, 1)[0];
        sq.bench.push(pXi);
        if (sq.roles.c === pId) sq.roles.c = null;
        if (sq.roles.vc === pId) sq.roles.vc = null;
        if (sq.roles.wk === pId) sq.roles.wk = null;
    } else if (fromPane === 'subs') {
        var pIdxSub = sq.subs.findIndex(function(x) { return String(x.id) === String(pId); });
        var pSub = sq.subs.splice(pIdxSub, 1)[0];
        sq.bench.push(pSub);
    }
    renderTapAndFly(tKey);
}

function setRole(e, tKey, pId, role) {
    e.stopPropagation();
    if (setupSquads[tKey].roles[role] === pId) setupSquads[tKey].roles[role] = null;
    else setupSquads[tKey].roles[role] = pId;
    renderTapAndFly(tKey);
}

function buildPlayerFromSetup(p, isXi, tKey) {
    var roles = setupSquads[tKey].roles;
    var desig = [];
    if (roles.c === p.id) desig.push('C');
    if (roles.vc === p.id) desig.push('VC');
    var skill = "Batter / Bowler";
    if (roles.wk === p.id) {
        skill = "WK";
        if (desig.indexOf('C') !== -1) desig = ['C/WK'];
    }
    return { id: p.id, regNo: "", name: p.name, desig: desig.join('/'), r: 0, b: 0, f: 0, s: 0, out: false, outOnDuck: 0, hasBatted: false, dismissalInfo: "", o: 0, rc: 0, w: 0, m: 0, ex: 0, wd: 0, nb: 0, byes: 0, legbyes: 0, cw: 0, catches: 0, stumpings: 0, runouts: 0, quotaOvers: 0, inTime: null, outTime: null, isPlayingXI: isXi, skill: skill, breakMins: 0 };
}

async function lockPlayingXI() {
    if (setupSquads.A.xi.length === 0 || setupSquads.B.xi.length === 0) {
        alert("Select at least 1 player in the Playing XI for both teams!");
        return;
    }
    state.matchId = activeMatch.match_id;
    state.teams.A.name = el('team-a-name').innerText;
    state.teams.B.name = el('team-b-name').innerText;
    state.teams.A.players = setupSquads.A.xi.map(function(p) { return buildPlayerFromSetup(p, true, 'A'); }).concat(setupSquads.A.subs.map(function(p) { return buildPlayerFromSetup(p, false, 'A'); }));
    state.teams.B.players = setupSquads.B.xi.map(function(p) { return buildPlayerFromSetup(p, true, 'B'); }).concat(setupSquads.B.subs.map(function(p) { return buildPlayerFromSetup(p, false, 'B'); }));

    state.matchSettings.venue = el('match-venue') ? el('match-venue').value.trim() : "";
    state.matchSettings.officials = {
        referee: el('match-referee') ? el('match-referee').value.trim() : "",
        coach: el('match-coach') ? el('match-coach').value.trim() : "",
        manager: el('match-manager') ? el('match-manager').value.trim() : "",
        umpire1: el('umpire-1') ? el('umpire-1').value.trim() : "",
        umpire2: el('umpire-2') ? el('umpire-2').value.trim() : "",
        umpire3: el('umpire-3') ? el('umpire-3').value.trim() : "",
        umpire4: el('umpire-4') ? el('umpire-4').value.trim() : "",
        scorer1: el('scorer-1') ? el('scorer-1').value.trim() : "",
        scorer2: el('scorer-2') ? el('scorer-2').value.trim() : ""
    };
    saveToRegistry(state.matchSettings.venue, state.matchSettings.officials);

    var win = el('tossWinner').value, dec = el('tossDecision').value;
    state.battingKey = ((win === 'A' && dec === 'bat') || (win === 'B' && dec === 'bowl')) ? 'A' : 'B';
    state.bowlingKey = state.battingKey === 'A' ? 'B' : 'A';

    var tossWinName = win === 'A' ? state.teams.A.name : state.teams.B.name;
    var tossDecText = dec === 'bat' ? 'bat' : 'bowl';
    state.matchSettings.tossStr = tossWinName + " won the toss and elected to " + tossDecText;

    if (activeMatch && activeMatch.full_state) {
        var format = activeMatch.full_state.format || 'T20';
        if (format.indexOf('Multi-Day') !== -1 || format === 'Test') {
            state.matchSettings.matchType = 'multiday'; state.matchSettings.maxOvers = 999; state.matchSettings.bowlerQuota = 999; state.matchSettings.maxInnings = 4;
        } else if (format === 'One Day') {
            state.matchSettings.matchType = 'oneday'; state.matchSettings.maxOvers = 50; state.matchSettings.bowlerQuota = 10; state.matchSettings.maxInnings = 2;
        } else if (format === 'T10') {
            state.matchSettings.matchType = 't20'; state.matchSettings.maxOvers = 10; state.matchSettings.bowlerQuota = 2; state.matchSettings.maxInnings = 2;
        } else {
            state.matchSettings.matchType = 't20'; state.matchSettings.maxOvers = 20; state.matchSettings.bowlerQuota = 4; state.matchSettings.maxInnings = 2;
        }
        state.matchSettings.originalMaxOvers = state.matchSettings.maxOvers;
    }

    var updatedFullState = JSON.parse(JSON.stringify(state, function(key, value) {
        return value instanceof Set ? Array.from(value) : value;
    }));
    updatedFullState.match_status = 'live';
    updatedFullState.team1 = state.teams.A.name;
    updatedFullState.team2 = state.teams.B.name;
    if (activeMatch && activeMatch.full_state) {
        updatedFullState.tournament = activeMatch.full_state.tournament || "Independent Match";
        updatedFullState.format = activeMatch.full_state.format || "T20";
        updatedFullState.tier = activeMatch.full_state.tier || "Local";
        updatedFullState.host = activeMatch.full_state.host || "Independent / Open";
        updatedFullState.matchName = activeMatch.full_state.matchName || "";
    }

    activeMatch.full_state = updatedFullState;
    localStorage.setItem('cricStat_activeMatchMetadata', JSON.stringify(activeMatch));

    var res = await supabaseClient.from('matches').update({ full_state: updatedFullState }).eq('match_id', activeMatch.match_id);
    if (res.error) {
        alert("Error connecting to cloud: " + res.error.message);
        return;
    }

    populateOpenersScreen();
}

function startInnings() {
    try {
        var s = el('sel-striker').value, ns = el('sel-nonstriker').value, b = el('sel-bowler').value;
        if (!s || !ns || !b) {
            alert("You must select the Striker, Non-Striker, and Opening Bowler to begin.");
            return;
        }
        if (s === ns) {
            alert("Striker and Non-Striker cannot be the same person!");
            return;
        }

        state.current.sIdx = parseInt(s, 10);
        state.current.nsIdx = parseInt(ns, 10);
        state.current.bIdx = parseInt(b, 10);

        var batTeam = getBatTeam();
        batTeam.players[state.current.sIdx].hasBatted = true;
        batTeam.players[state.current.nsIdx].hasBatted = true;

        state.current.bowlersInCurrentOver = toSafeSet(state.current.bowlersInCurrentOver);
        state.current.lastOverBowlers = toSafeSet(state.current.lastOverBowlers);
        state.current.bowlersInCurrentOver.add(state.current.bIdx);
        state.current.inningsStartTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (activeMatch && activeMatch.full_state) {
            var format = activeMatch.full_state.format || 'T20';
            if (format.indexOf('Multi-Day') !== -1 || format === 'Test') {
                state.matchSettings.matchType = 'multiday'; state.matchSettings.maxOvers = 999; state.matchSettings.bowlerQuota = 999; state.matchSettings.maxInnings = 4;
                if (el('breakBtn')) el('breakBtn').classList.remove('hidden');
            } else if (format === 'One Day') {
                state.matchSettings.matchType = 'oneday'; state.matchSettings.maxOvers = 50; state.matchSettings.bowlerQuota = 10; state.matchSettings.maxInnings = 2;
            } else if (format === 'T10') {
                state.matchSettings.matchType = 't20'; state.matchSettings.maxOvers = 10; state.matchSettings.bowlerQuota = 2; state.matchSettings.maxInnings = 2;
            } else {
                state.matchSettings.matchType = 't20'; state.matchSettings.maxOvers = 20; state.matchSettings.bowlerQuota = 4; state.matchSettings.maxInnings = 2;
            }
            state.matchSettings.originalMaxOvers = state.matchSettings.maxOvers;
        }

        if (activeMatch && activeMatch.full_state && el('displayTournament')) {
            el('displayTournament').innerText = activeMatch.full_state.tournament || "MATCH IN PROGRESS";
        }
        if (el('dispGroundName')) el('dispGroundName').innerText = state.matchSettings.venue || "Live Ground";

        if (el('initialization-screen')) el('initialization-screen').classList.add('hidden');
        if (el('top-title')) el('top-title').classList.add('hidden');
        if (el('scoringView')) el('scoringView').classList.remove('hidden');

        if (typeof updateUI === 'function') {
            updateUI();
        } else {
            alert("Critical Error: The scoring engine (scorer.js) did not load properly. Check your script tags or syntax.");
        }
    } catch (e) {
        console.error("Match Initialization Failed:", e);
        alert("Initialization Failed: " + e.message);
    }
}
