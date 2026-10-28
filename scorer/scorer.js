// ==========================================
// SCORING ENGINE & UI REFRESH (scorer.js)
// ==========================================

var superfixOpenedFromSummary = false;

// AUTO-HEAL HELPER: Ensures only one summary ever exists per Innings Number
function deduplicateInningsSummaries() {
    if (!state || !Array.isArray(state.inningsSummaries)) return;
    var map = new Map();
    state.inningsSummaries.forEach(function(inn) {
        if (inn && inn.innNum) {
            map.set(inn.innNum, inn);
        }
    });
    state.inningsSummaries = Array.from(map.values()).sort(function(a, b) {
        return a.innNum - b.innNum;
    });
}

// Helper: Convert "16.2" overs string/number to total balls (98)
function oversToBalls(val) {
    var v = parseFloat(val);
    if (isNaN(v) || v <= 0) return 0;
    var full = Math.floor(v);
    var balls = Math.round((v - full) * 10);
    return (full * 6) + balls;
}

function getEffectiveBalls(cur) {
    var effective = 0;
    var prevActual = 0;
    for (var i = 0; i < cur.overHistory.length; i++) {
        var actualBallsInOver = cur.overHistory[i].totalBallsAtEnd - prevActual;
        if (cur.overHistory[i].isPartialTerminal) {
            effective += actualBallsInOver;
        } else {
            effective += 6;
        }
        prevActual = cur.overHistory[i].totalBallsAtEnd;
    }
    var currentOverBalls = Math.max(0, cur.balls - prevActual);
    effective += currentOverBalls;
    return effective;
}

function toggleFullScreen() {
    var fsBtn = el('fsBtn');
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(function() {
            if (fsBtn) fsBtn.innerText = '🔳 EXIT FULL SCREEN';
        }).catch(function() {
            alert("Fullscreen not supported.");
        });
    } else if (document.exitFullscreen) {
        document.exitFullscreen().then(function() {
            if (fsBtn) fsBtn.innerText = '🔲 FULL';
        });
    }
}

document.addEventListener('fullscreenchange', function() {
    if (!document.fullscreenElement && el('fsBtn')) {
        el('fsBtn').innerText = '🔲 FULL';
    }
});

function saveState() {
    try {
        stateHistory.push(JSON.stringify(state, function(key, value) {
            return value instanceof Set ? Array.from(value) : value;
        }));
        if (stateHistory.length > 100) stateHistory.shift();
        localStorage.setItem('cricStat_stateHistory', JSON.stringify(stateHistory));
    } catch (e) {
        console.warn("State save failed");
    }
}

function undoLastAction() {
    if (stateHistory.length > 0) {
        var prevState = JSON.parse(stateHistory.pop());
        prevState.current.lastOverBowlers = new Set(Array.isArray(prevState.current.lastOverBowlers) ? prevState.current.lastOverBowlers : []);
        prevState.current.bowlersInCurrentOver = new Set(Array.isArray(prevState.current.bowlersInCurrentOver) ? prevState.current.bowlersInCurrentOver : []);
        state = prevState;
        deduplicateInningsSummaries();
        localStorage.setItem('cricStat_stateHistory', JSON.stringify(stateHistory));
        updateUI();
    } else {
        alert("Nothing to undo!");
    }
}

async function restartCloudMatch() {
    var conf = confirm("🚨 DANGER 🚨\nAre you sure you want to RESTART this entire match?\nAll runs, wickets, and history will be permanently wiped from the cloud.");
    if (!conf) return;
    var pin = prompt("To confirm, please enter the 4-Digit Scorer PIN for this match:");
    if (pin !== activeMatch.scorer_pin) {
        alert("❌ Incorrect PIN. Match restart aborted.");
        return;
    }

    var tName = (activeMatch && activeMatch.tournaments && activeMatch.tournaments.name)
        ? activeMatch.tournaments.name
        : (activeMatch && activeMatch.full_state && activeMatch.full_state.tournament ? activeMatch.full_state.tournament : "INDEPENDENT MATCH");

    var resetState = {
        tournament: tName,
        format: (activeMatch && activeMatch.full_state && activeMatch.full_state.format) ? activeMatch.full_state.format : "T20",
        tier: (activeMatch && activeMatch.full_state && activeMatch.full_state.tier) ? activeMatch.full_state.tier : "Local",
        host: (activeMatch && activeMatch.full_state && activeMatch.full_state.host) ? activeMatch.full_state.host : "Independent / Open",
        team1: (activeMatch && activeMatch.full_state && activeMatch.full_state.team1) ? activeMatch.full_state.team1 : (activeMatch && activeMatch.full_state && activeMatch.full_state.teams ? activeMatch.full_state.teams.A.name : "Team A"),
        team2: (activeMatch && activeMatch.full_state && activeMatch.full_state.team2) ? activeMatch.full_state.team2 : (activeMatch && activeMatch.full_state && activeMatch.full_state.teams ? activeMatch.full_state.teams.B.name : "Team B"),
        matchName: (activeMatch && activeMatch.full_state && activeMatch.full_state.matchName) ? activeMatch.full_state.matchName : "",
        match_status: 'upcoming'
    };

    try {
        await supabaseClient.from('matches').update({ full_state: resetState }).eq('match_id', state.matchId);
        await supabaseClient.from('live_matches').delete().eq('match_id', state.matchId);
        await supabaseClient.from('ball_by_ball').delete().eq('match_id', state.matchId);
    } catch (e) {
        console.error(e);
    }
    localStorage.removeItem('cricStat_activeMatch');
    localStorage.removeItem('cricStat_activeMatchMetadata');
    localStorage.removeItem('cricStat_stateHistory');
    alert("✅ Match has been wiped and reset to Upcoming. Returning to login...");
    window.location.reload();
}

function syncMetadataToHistory(syncPlayingXI) {
    stateHistory = stateHistory.map(function(hStr) {
        var h = JSON.parse(hStr);
        ['A', 'B'].forEach(function(t) {
            for (var i = 0; i < h.teams[t].players.length; i++) {
                h.teams[t].players[i].name = state.teams[t].players[i].name;
                h.teams[t].players[i].regNo = state.teams[t].players[i].regNo;
                h.teams[t].players[i].skill = state.teams[t].players[i].skill;
                if (syncPlayingXI) {
                    h.teams[t].players[i].isPlayingXI = state.teams[t].players[i].isPlayingXI;
                }
            }
        });
        return JSON.stringify(h, function(k, v) {
            return v instanceof Set ? Array.from(v) : v;
        });
    });
}

function openRemarkModal() {
    var cur = state.current;
    var s = cur.sIdx !== null ? getBatTeam().players[cur.sIdx].name : "N/A";
    var ns = cur.nsIdx !== null ? getBatTeam().players[cur.nsIdx].name : "N/A";
    var b = cur.bIdx !== null ? getBowlTeam().players[cur.bIdx].name : "N/A";
    var fOpts = '<option value="">-- No Fielder / N/A --</option>';
    getBowlTeam().players.forEach(function(p) {
        if (p.name) fOpts += '<option value="' + p.name + '">' + p.name + '</option>';
    });
    var remarkHtml = '<div class="mb-10 text-muted" style="font-size:0.8rem;">Over: <b class="text-accent">' + formatOver(cur.balls) + '</b> | Local Time: <b class="text-accent">' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</b></div>' +
        '<div class="mb-10" style="font-size:0.85rem; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px;"><span class="text-primary font-bold">Striker:</span> ' + s + '<br><span class="text-primary font-bold">Non-Striker:</span> ' + ns + '<br><span class="text-primary font-bold">Bowler:</span> ' + b + '</div>' +
        '<label class="text-primary mt-10">Fielder Involved (Optional)</label><select id="remFielder" class="modal-input w-100">' + fOpts + '</select>' +
        '<label class="text-primary mt-10">Remark / Incident</label><input type="text" id="remText" class="modal-input w-100" placeholder="e.g., Warning...">';
    showModal("📝 Match Remark", remarkHtml, function() {
        var txt = el('remText').value.trim();
        if (!txt) return;
        remarkLog.push({
            over: formatOver(cur.balls),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            batters: s + " / " + ns,
            bowler: b,
            fielder: el('remFielder').value || "-",
            remark: txt
        });
        closeModal();
    });
}

function openEditTarget() {
    openEditMatchConditions();
}

function clearCustomTarget() {
    saveState();
    state.matchSettings.customTarget = null;
    state.matchSettings.customTargetOvers = null;
    state.matchSettings.targetMethod = "";
    state.matchSettings.maxOvers = state.matchSettings.originalMaxOvers;
    closeModal();
    updateUI();
}

function getTargetBalls() {
    var ov = state.matchSettings.maxOvers;
    var f = Math.floor(ov);
    var r = Math.round((ov - f) * 10);
    return f * 6 + r;
}

function openBreakModal() {
    var html = '<label class="text-primary">Select Interval Type</label><select id="brkType" class="modal-input w-100"><option value="Luncheon Break">Luncheon Break</option><option value="Tea Break">Tea Break</option><option value="Day End / Stumps">Day End / Stumps</option><option value="Innings Break">Innings Break</option><option value="Drinks Break">Drinks Break</option><option value="Other Scheduled Interval">Other Scheduled Interval</option></select><label class="text-primary mt-10">Start Time</label>' + getTimeDropdownsHtml('brkStart');
    showModal("Scheduled Break", html, startScheduledBreak, false, "360px", "Log Break");
}

function startScheduledBreak() {
    saveState();
    var type = el('brkType').value;
    var sT = parseTimeDropdowns('brkStart');
    state.current.activeBreak = type;
    state.current.activeBreakStartTime = sT;
    state.current.activeBreakInsp = null;
    closeModal();
    updateUI();
}

function openInterruptionModal() {
    var html = '<label class="text-primary">Select Reason for Delay</label><select id="intType" class="modal-input w-100"><option value="Bad Weather / Rain">Bad Weather / Rain</option><option value="Bad Light">Bad Light</option><option value="Unfit Ground Conditions">Unfit Ground Conditions</option><option value="Medical Emergency">Medical Emergency</option><option value="Other Interruption">Other Interruption</option></select><label class="text-primary mt-10">Start Time</label>' + getTimeDropdownsHtml('intStart') + '<label class="text-primary mt-10">Next Inspection At (Optional)</label>' + getTimeDropdownsHtml('intInsp', true);
    showModal("Match Interruption", html, startInterruption, false);
}

function startInterruption() {
    saveState();
    var type = el('intType').value;
    var sT = parseTimeDropdowns('intStart');
    var nI = parseTimeDropdowns('intInsp');
    state.current.activeBreak = type;
    state.current.activeBreakStartTime = sT;
    state.current.activeBreakInsp = nI;
    closeModal();
    updateUI();
}

function openResumeModal() {
    var html = '<label class="text-primary">Interruption Started At</label><input type="text" class="modal-input w-100" value="' + state.current.activeBreakStartTime + '" disabled><label class="text-primary mt-10">Select Resume Time</label>' + getTimeDropdownsHtml('intEnd');
    showModal("End Interruption", html, endInterruption, false, "360px", "Resume Play");
}

function endInterruption() {
    var eT = parseTimeDropdowns('intEnd');
    var sT = state.current.activeBreakStartTime;
    var dur = calculateDurationMins(sT, eT);
    if (state.current.sIdx !== null) getBatTeam().players[state.current.sIdx].breakMins += dur;
    if (state.current.nsIdx !== null) getBatTeam().players[state.current.nsIdx].breakMins += dur;
    state.matchBreaks.push({ inn: state.inningsNum, type: state.current.activeBreak, start: sT, end: eT, dur: dur });
    var remarkStr = state.current.activeBreak + ": " + sT + " to " + eT + " (Lost: " + dur + "m)";
    if (state.current.activeBreakInsp) remarkStr += " [Insp: " + state.current.activeBreakInsp + "]";
    remarkLog.push({ over: formatOver(state.current.balls), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), batters: "-", bowler: "-", fielder: "-", remark: remarkStr });
    state.current.activeBreak = null;
    state.current.activeBreakStartTime = null;
    state.current.activeBreakInsp = null;
    closeModal();
    updateUI();
}

function markOpenerTimes() {
    if (state.current.sIdx !== null && state.current.nsIdx !== null) {
        var now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (!getBatTeam().players[state.current.sIdx].inTime) getBatTeam().players[state.current.sIdx].inTime = now;
        if (!getBatTeam().players[state.current.nsIdx].inTime) getBatTeam().players[state.current.nsIdx].inTime = now;
    }
}

function checkTargetReached() {
    if (state.matchSettings.customTarget && state.current.runs >= state.matchSettings.customTarget) return true;
    if (state.matchSettings.matchType === 'multiday') {
        var bowlTeamInns = state.inningsSummaries.filter(function(i) { return i.batTeam === getBowlTeam().name; }).length;
        if (bowlTeamInns === 2) {
            var batTotal = state.current.runs + state.inningsSummaries.filter(function(i) { return i.batTeam === getBatTeam().name; }).reduce(function(a, b) { return a + b.runs; }, 0);
            var bowlTotal = state.inningsSummaries.filter(function(i) { return i.batTeam === getBowlTeam().name; }).reduce(function(a, b) { return a + b.runs; }, 0);
            if (batTotal > bowlTotal) return true;
        }
        return false;
    } else {
        if (state.inningsNum % 2 === 0 && state.inningsSummaries.length >= state.inningsNum - 1) {
            var prevInn = state.inningsSummaries.find(function(i) { return i.innNum === state.inningsNum - 1; }) || state.inningsSummaries[0];
            var targetToWin = state.matchSettings.customTarget || (prevInn ? prevInn.runs + 1 : 9999);
            if (state.current.runs >= targetToWin) return true;
        }
        return false;
    }
}

function finalizeOver(isPartialTerminal) {
    if (typeof isPartialTerminal === 'undefined') isPartialTerminal = false;
    var cur = state.current;
    var prevBalls = cur.overHistory.length > 0 ? cur.overHistory[cur.overHistory.length - 1].totalBallsAtEnd : 0;
    var ballsThisOver = cur.balls - prevBalls;
    var isPartial = isPartialTerminal && ballsThisOver > 0 && ballsThisOver < 6;
    cur.bowlersInCurrentOver.forEach(function(i) {
        getBowlTeam().players[i].quotaOvers += 1;
        if (cur.runsInThisOver === 0 && i === cur.bIdx && !isPartial) getBowlTeam().players[i].m++;
    });
    cur.overHistory.push({ over: cur.overHistory.length + 1, runs: cur.runs, wkts: cur.wkts, totalBallsAtEnd: cur.balls, isPartialTerminal: isPartial });
    cur.lastOverBowlers = new Set(cur.bowlersInCurrentOver);
    cur.runsInThisOver = 0;
    cur.bowlersInCurrentOver.clear();
    cur.recentBalls.push.apply(cur.recentBalls, cur.currentOverLog.concat([{ label: '/', type: 'divider' }]));
    if (cur.recentBalls.length > 14) cur.recentBalls = cur.recentBalls.slice(-14);
    cur.currentOverLog = [];
}

// ==========================================
// CLOUD SYNC & FAN PORTAL GENERATOR
// ==========================================

function buildFanPortalSummary() {
    deduplicateInningsSummaries();
    var allInn = state.inningsSummaries.slice();
    var hasCurrentInSummaries = allInn.some(function(i) { return i.innNum === state.inningsNum; });
    if ((state.current.balls > 0 || state.current.runs > 0) && !hasCurrentInSummaries) {
        allInn.push({ innNum: state.inningsNum, batTeam: getBatTeam().name, runs: state.current.runs, wkts: state.current.wkts, overs: getTeamOversDisplay(), fow: state.current.fow || [] });
    }
    var perfs = (typeof getTopPerformers === 'function') ? getTopPerformers() : { batters: [], bowlers: [] };
    var teamPts = {};
    teamPts[state.teams.A.name] = state.teams.A.points || 0;
    teamPts[state.teams.B.name] = state.teams.B.points || 0;

    return {
        match_id: state.matchId,
        tournament: (activeMatch && activeMatch.full_state && activeMatch.full_state.tournament) ? activeMatch.full_state.tournament : "Independent Match",
        venue: state.matchSettings.venue || "Unknown Venue",
        match_type: state.matchSettings.matchType,
        officials: state.matchSettings.officials,
        toss: state.matchSettings.tossStr || "Toss not recorded",
        result: state.matchResult || calculateResultText() || "Match in Progress",
        team_points: teamPts,
        innings: allInn.map(function(i) { return { team: i.batTeam || i.team, score: i.runs + "/" + i.wkts, overs: i.overs, fow: i.fow || [] }; }),
        top_batters: perfs.batters.slice(0, 3).map(function(b) { return { name: b.name, runs: b.r, balls: b.b }; }),
        top_bowlers: perfs.bowlers.slice(0, 3).map(function(b) { return { name: b.name, wkts: b.w, runs: b.rc, overs: formatOver(b.o) }; })
    };
}

async function triggerCloudSync() {
    if (!supabaseClient || !state.matchId) return;

    deduplicateInningsSummaries();
    var fps = buildFanPortalSummary();

    var fullStatePayload = JSON.parse(JSON.stringify(state, function(key, value) {
        return value instanceof Set ? Array.from(value) : value;
    }));
    fullStatePayload.match_status = 'live';
    fullStatePayload.team1 = state.teams.A.name;
    fullStatePayload.team2 = state.teams.B.name;

    if (activeMatch && activeMatch.full_state) {
        fullStatePayload.tournament = activeMatch.full_state.tournament || "Independent Match";
        fullStatePayload.format = activeMatch.full_state.format || "T20";
        fullStatePayload.tier = activeMatch.full_state.tier || "Local";
        fullStatePayload.host = activeMatch.full_state.host || "Independent / Open";
    }

    fullStatePayload.fan_portal_summary = fps;

    try {
        await supabaseClient.from('matches').update({ full_state: fullStatePayload }).eq('match_id', state.matchId);
    } catch (e) {}

    var cur = state.current;
    var effBalls = getEffectiveBalls(cur);
    var crrVal = effBalls > 0 ? ((cur.runs / effBalls) * 6).toFixed(2) : "0.00";

    var lightWeightLiveData = {
        matchId: state.matchId,
        batTeam: getBatTeam() ? getBatTeam().name : "",
        bowlTeam: getBowlTeam() ? getBowlTeam().name : "",
        runs: cur.runs,
        wkts: cur.wkts,
        overs: getTeamOversDisplay(),
        crr: crrVal,
        target: el('dispTargetText') ? el('dispTargetText').innerText : "",
        batters: [
            cur.sIdx !== null ? { name: getBatTeam().players[cur.sIdx].name, r: getBatTeam().players[cur.sIdx].r, b: getBatTeam().players[cur.sIdx].b, isStriker: true } : null,
            cur.nsIdx !== null ? { name: getBatTeam().players[cur.nsIdx].name, r: getBatTeam().players[cur.nsIdx].r, b: getBatTeam().players[cur.nsIdx].b, isStriker: false } : null
        ],
        bowler: cur.bIdx !== null ? { name: getBowlTeam().players[cur.bIdx].name, o: formatOver(getBowlTeam().players[cur.bIdx].o), r: getBowlTeam().players[cur.bIdx].rc, w: getBowlTeam().players[cur.bIdx].w } : null,
        recentBalls: cur.recentBalls,
        fow: cur.fow || [],
        fan_portal_summary: fps
    };

    try {
        await supabaseClient.from('live_matches').upsert({ match_id: state.matchId, live_data: lightWeightLiveData }, { onConflict: 'match_id' });
    } catch (e) {}
}

async function logCareerStats() {
    if (!supabaseClient || !state.matchId) return;

    deduplicateInningsSummaries();
    var fps = buildFanPortalSummary();

    var finalState = JSON.parse(JSON.stringify(state, function(key, value) {
        return value instanceof Set ? Array.from(value) : value;
    }));
    finalState.match_status = 'completed';
    finalState.team1 = state.teams.A.name;
    finalState.team2 = state.teams.B.name;

    var tName = "Independent Match";
    if (activeMatch && activeMatch.full_state) {
        tName = activeMatch.full_state.tournament || "Independent Match";
        finalState.tournament = tName;
        finalState.format = activeMatch.full_state.format || "T20";
        finalState.tier = activeMatch.full_state.tier || "Local";
        finalState.host = activeMatch.full_state.host || "Independent / Open";
    }

    finalState.fan_portal_summary = fps;

    try { await supabaseClient.from('matches').update({ full_state: finalState }).eq('match_id', state.matchId); } catch (e) {}

    var completedPayload = { inningsSummaries: state.inningsSummaries, fan_portal_summary: fps };
    try { await supabaseClient.from('completed_matches').upsert({ match_id: state.matchId, final_data: JSON.stringify(completedPayload) }, { onConflict: 'match_id' }); } catch (e) {}
    try { await supabaseClient.from('live_matches').delete().eq('match_id', state.matchId); } catch (e) {}

    try {
        let statsPayload = [];
        
        const processTeamStats = async (teamKey, teamName) => {
            let players = state.teams[teamKey].players;
            let names = players.map(p => p.name);
            let { data: dbPlayers } = await supabaseClient.from('players').select('player_id, full_name').in('full_name', names);
            
            let teamUUID = null;
            if (activeMatch && activeMatch.team_a_id && teamKey === 'A') teamUUID = activeMatch.team_a_id;
            if (activeMatch && activeMatch.team_b_id && teamKey === 'B') teamUUID = activeMatch.team_b_id;
            
            players.forEach(p => {
                let participated = p.hasBatted || (p.o > 0) || (p.catches > 0) || (p.stumpings > 0) || (p.runouts > 0);
                if (!participated) return;

                let pid = p.player_id || p.id;
                if (!pid && dbPlayers) {
                    let matched = dbPlayers.find(dp => dp.full_name === p.name);
                    if (matched) pid = matched.player_id;
                }

                if (pid) {
                    let oversBowledNumeric = 0.0;
                    if (p.o > 0) {
                        oversBowledNumeric = parseFloat(Math.floor(p.o / 6) + "." + (p.o % 6));
                    }

                    let runsScored = p.r || 0;
                    let wktsTaken = p.w || 0;
                    let isHalfCentury = (runsScored >= 50 && runsScored < 100) ? 1 : 0;
                    let isCentury = (runsScored >= 100) ? 1 : 0;
                    let is4W = (wktsTaken === 4) ? 1 : 0;
                    let is5W = (wktsTaken >= 5) ? 1 : 0;

                    statsPayload.push({
                        stat_id: crypto.randomUUID ? crypto.randomUUID() : undefined,
                        player_id: pid,
                        match_id: state.matchId,
                        team_id: teamUUID,
                        
                        runs_scored: runsScored,
                        balls_faced: p.b || 0,
                        fours: p.f || 0,
                        sixes: p.s || 0,
                        is_not_out: !(p.out === true || p.out === 'out'),
                        half_centuries: isHalfCentury,
                        centuries: isCentury,
                        
                        overs_bowled: oversBowledNumeric,
                        maidens_bowled: p.m || 0,
                        runs_conceded: p.rc || 0,
                        wickets_taken: wktsTaken,
                        four_wicket_hauls: is4W,
                        five_wicket_hauls: is5W,
                        hat_tricks: 0,
                        
                        catches: p.catches || 0,
                        stumpings: p.stumpings || 0,
                        run_outs: p.runouts || 0
                    });
                }
            });
        };

        await processTeamStats('A', state.teams.A.name);
        await processTeamStats('B', state.teams.B.name);

        if (statsPayload.length > 0) {
            await supabaseClient.from('player_match_stats').upsert(statsPayload, { onConflict: 'player_id, match_id' });
            console.log("✅ Career stats securely locked into player_match_stats ledger!");
        }
    } catch (e) {
        console.error("Failed to save career stats to ledger:", e);
    }
}

async function logBallEvent(batterObj, bowlerObj, runsBat, runsExtra, extraType, isWicket, wicketType, dismissedObj) {
    if (!supabaseClient || !state.matchId) return;
    var ballData = {
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
        await supabaseClient.from('ball_by_ball').insert([ballData]);
    } catch (e) {}
}

function ballScored(runs, isB) {
    saveState();
    markOpenerTimes();
    var cur = state.current;
    if (cur.bIdx === null) return openSelector('bowler', "Select Bowler");
    cur.bowlersInCurrentOver.add(cur.bIdx);
    var s = getBatTeam().players[cur.sIdx];
    var b = getBowlTeam().players[cur.bIdx];
    b.cw = 0;
    s.r += runs;
    s.b++;
    if (isB) {
        if (runs === 4) s.f++;
        else s.s++;
    }
    b.rc += runs;
    b.o++;
    cur.runs += runs;
    cur.runsInThisOver += runs;
    cur.balls++;
    cur.currPartnership.runs += runs;
    cur.currPartnership.balls++;
    cur.currentOverLog.push({ label: runs.toString(), type: isB ? (runs === 4 ? 'four' : 'six') : 'normal' });
    cur.isFreeHit = false;
    logBallEvent(s, b, runs, 0, 'None', false, null, null);
    if (runs % 2 !== 0) manualRotate();
    if (checkTargetReached()) {
        finalizeOver(true);
        setTimeout(endInnings, 100);
        return;
    }
    updateUI();
    checkAutoOverPrompt();
}

function getTeamOversDisplay() {
    var cur = state.current;
    var completedOvers = cur.overHistory.length;
    var ballsInPreviousOvers = completedOvers > 0 ? (cur.overHistory[completedOvers - 1].totalBallsAtEnd || (completedOvers * 6)) : 0;
    var currentOverBalls = Math.max(0, cur.balls - ballsInPreviousOvers);
    return completedOvers + "." + currentOverBalls;
}

function resetMatch() {
    state.matchBreaks = [];
    state.inningsNum = 1;
    state.inningsSummaries = [];
    state.matchResult = "";
    stateHistory = [];
    remarkLog = [];
    state.matchId = "";
    state.current = {
        runs: 0, wkts: 0, balls: 0, sIdx: null, nsIdx: null, bIdx: null, isFreeHit: false, penalties: 0,
        lastOverBowlers: new Set(), extras: { w: 0, nb: 0, b: 0, lb: 0 }, recentBalls: [], currentOverLog: [],
        runsInThisOver: 0, bowlersInCurrentOver: new Set(), overHistory: [], currPartnership: { runs: 0, balls: 0 },
        fow: [], activeBreak: null, activeBreakStartTime: null, activeBreakInsp: null, pendingBreakMins: 0,
        inningsStartTime: null, inningsEndTime: null, allowances: 0
    };
    el('inningsHistoryText').innerHTML = '';
    el('scoringView').classList.add('hidden');
    localStorage.removeItem('cricStat_activeMatch');
    localStorage.removeItem('cricStat_activeMatchMetadata');
    localStorage.removeItem('cricStat_stateHistory');
    if (window.matchChart) window.matchChart.destroy();
    window.location.reload();
}

function calculateResultText() {
    deduplicateInningsSummaries();
    var allInn = state.inningsSummaries.slice();
    var hasCurrent = allInn.some(function(i) { return i.innNum === state.inningsNum; });
    if ((state.current.balls > 0 || state.current.runs > 0) && !hasCurrent) {
        allInn.push({ innNum: state.inningsNum, batTeam: getBatTeam().name, bowlTeam: getBowlTeam().name, runs: state.current.runs, wkts: state.current.wkts });
    }
    if (allInn.length < 2) return "";
    if (state.matchSettings.matchType !== 'multiday') {
        var t1 = allInn[0], t2 = allInn[1];
        var targetRuns = state.matchSettings.customTarget ? (state.matchSettings.customTarget - 1) : t1.runs;
        if (allInn.length === 2 && (state.current.balls >= getTargetBalls() || state.current.wkts >= 10 || state.current.runs > targetRuns)) {
            var currentTeamScore = state.current.runs;
            if (currentTeamScore > targetRuns) return t2.batTeam + " won by " + (10 - state.current.wkts) + " wickets";
            if (targetRuns > currentTeamScore) return t1.batTeam + " won by " + (targetRuns - currentTeamScore) + " runs";
            return "MATCH TIED";
        }
        return "";
    }
    var t1Name = allInn[0].batTeam, t2Name = allInn[0].bowlTeam;
    var s = {}, fI = {};
    s[t1Name] = 0; s[t2Name] = 0; fI[t1Name] = null; fI[t2Name] = null;
    allInn.forEach(function(i) {
        s[i.batTeam] += i.runs;
        if (fI[i.batTeam] === null) fI[i.batTeam] = i.runs;
    });
    var lInn = allInn[allInn.length - 1], batL = lInn.batTeam, bowlL = lInn.bowlTeam;
    var t1C = allInn.filter(function(i) { return i.batTeam === t1Name; }).length;
    var t2C = allInn.filter(function(i) { return i.batTeam === t2Name; }).length;
    if (t1C + t2C < 3) return "";
    if (lInn.wkts >= 10 || state.inningsNum > state.matchSettings.maxInnings) {
        if (s[batL] > s[bowlL]) return batL + " won by " + (s[batL] - s[bowlL]) + " runs";
        if (s[bowlL] > s[batL] && t1C + t2C === 4) return bowlL + " won by " + (10 - lInn.wkts) + " wickets";
    }
    return "";
}

function enableSummaryConfirm() {
    var cBtn = el('modalConfirmBtn');
    if (cBtn.disabled) {
        cBtn.disabled = false;
        cBtn.style.opacity = '1';
        cBtn.style.cursor = 'pointer';
        cBtn.innerText = cBtn.dataset.origText || "Confirm";
    }
}

function showMatchSummary() {
    deduplicateInningsSummaries();
    var autoRes = calculateResultText();
    var isGameOver = (state.inningsNum >= state.matchSettings.maxInnings || state.matchResult !== "" || autoRes !== "");
    var isTransition = (!isGameOver && state.inningsSummaries.some(function(i) { return i.innNum === state.inningsNum; }));

    var confirmBtnText = "Confirm";
    var hideCancel = false;
    var requiresDownload = false;
    if (isGameOver) {
        confirmBtnText = "🏁 End Match & Reset";
        requiresDownload = true;
    } else if (isTransition) {
        confirmBtnText = "▶️ Start Next Innings";
        requiresDownload = true;
    } else {
        confirmBtnText = "🔙 Continue Scoring";
        hideCancel = true;
    }

    var html = '<div class="custom-scroll" style="max-height: 45vh; overflow-y: auto; padding-right:10px; margin-bottom:10px;">';
    if (state.inningsSummaries.length === 0 && state.current.balls === 0) {
        html += '<p class="text-center text-muted">No data available yet.</p>';
    } else {
        var displayInnings = state.inningsSummaries.slice();
        if (!isGameOver && !isTransition && (state.current.balls > 0 || state.current.runs > 0)) {
            var fF = JSON.parse(JSON.stringify(state.current.fow || []));
            if (state.current.sIdx !== null && state.current.nsIdx !== null && state.current.wkts < 10) {
                var sBName = getBatTeam().players[state.current.sIdx] ? getBatTeam().players[state.current.sIdx].name : "Unknown";
                var nsBName = getBatTeam().players[state.current.nsIdx] ? getBatTeam().players[state.current.nsIdx].name : "Unknown";
                fF.push({ wktNum: "Unbroken", runs: state.current.runs, overs: getTeamOversDisplay(), outBatter: "-", partner: sBName + " & " + nsBName, pRuns: state.current.currPartnership.runs, pBalls: state.current.currPartnership.balls });
            }
            displayInnings.push({ innNum: state.inningsNum, batTeam: getBatTeam().name, bowlTeam: getBowlTeam().name, runs: state.current.runs, wkts: state.current.wkts, overs: getTeamOversDisplay(), penalties: state.current.penalties || 0, batters: getBatTeam().players, bowlers: getBowlTeam().players, fow: fF, extras: JSON.parse(JSON.stringify(state.current.extras)), isOngoing: true, allowances: state.current.allowances || 0 });
        }

        displayInnings.reverse().forEach(function(inn) {
            html += '<div style="background:rgba(0,0,0,0.3); padding:15px; margin-bottom:15px; border-top:4px solid ' + (inn.isOngoing ? 'var(--danger)' : 'var(--primary)') + '; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.3);"><div class="flex-row" style="justify-content:space-between; margin-bottom:12px;"><div><div class="' + (inn.isOngoing ? 'text-danger' : 'text-primary') + ' font-bold" style="font-size:0.75rem; letter-spacing:1px;">INNINGS ' + inn.innNum + ' ' + (inn.isOngoing ? '(ONGOING)' : '') + '</div><div class="font-bold" style="font-size:1.3rem; color:white;">' + inn.batTeam + '</div></div><div class="text-right"><div class="text-success font-bold" style="font-size:1.6rem;">' + inn.runs + '<span style="color:#94a3b8; font-size:1.2rem;">/' + inn.wkts + '</span></div><div class="text-muted" style="font-size:0.85rem;">(' + inn.overs + ' Overs)</div></div></div>';

            html += '<table class="scorecard-table"><thead class="bat-hdr" style="background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border-bottom: 1px solid #64748b;"><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>';
            inn.batters.forEach(function(b) {
                if (b.hasBatted) {
                    var isOut = b.out ? '<span style="color:#ef4444; font-size:0.65rem; display:block; margin-top:2px;">' + b.dismissalInfo + '</span>' : '<span style="color:#10b981; font-size:0.65rem; display:block; margin-top:2px;">Not Out</span>';
                    var sr = b.b > 0 ? ((b.r / b.b) * 100).toFixed(2) : "0.00";
                    var nameStr = '<div style="max-width: 130px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="' + b.name + '"><b style="font-size:0.85rem; color:white;">' + b.name + '</b>' + (b.desig === 'C' || b.desig === 'C/WK' || (b.desig && b.desig.includes('C')) ? ' <span style="color:var(--accent);">(C)</span>' : '') + (b.skill && b.skill.includes('WK') ? ' 🧤' : '') + '</div>';
                    html += '<tr><td>' + nameStr + isOut + '</td><td style="font-weight:bold; font-size:1rem; color:white;">' + b.r + '</td><td style="color:white;">' + b.b + '</td><td style="color:white;">' + b.f + '</td><td style="color:white;">' + b.s + '</td><td style="color:var(--accent);">' + sr + '</td></tr>';
                }
            });
            var ex = inn.extras || { w: 0, nb: 0, b: 0, lb: 0 };
            var extrasTotal = ex.w + ex.nb + ex.b + ex.lb;
            var pen = inn.penalties || 0;
            html += '<tr style="background:rgba(255,255,255,0.05); font-weight:bold;"><td style="color:var(--accent); text-transform:uppercase;">Extras</td><td colspan="5" style="text-align:right; color:white;">' + extrasTotal + ' <span style="font-weight:normal; font-size:0.7rem; color:white;">(W:' + ex.w + ', NB:' + ex.nb + ', B:' + ex.b + ', LB:' + ex.lb + ')</span></td></tr>';
            if (pen > 0) html += '<tr style="background:rgba(255,255,255,0.05); font-weight:bold;"><td style="color:var(--danger); text-transform:uppercase;">Penalties</td><td colspan="5" style="text-align:right; color:white;">' + pen + '</td></tr>';
            html += '</tbody></table><table class="scorecard-table">';

            html += '<thead class="bwl-hdr" style="background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border-bottom: 1px solid #64748b;"><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th><th>Extras</th><th>NB</th><th>WD</th></tr></thead><tbody>';

            inn.bowlers.forEach(function(b) {
                if (b.o > 0 || b.rc > 0) {
                    var totalRuns = b.rc || 0;
                    var econ = b.o > 0 ? ((totalRuns / b.o) * 6).toFixed(2) : "0.00";
                    var nameStr = '<div style="max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="' + b.name + '"><b style="color:white;">' + b.name + '</b></div>';
                    var exStr = (b.byes || 0) + 'b, ' + (b.legbyes || 0) + 'lb';
                    var nb = b.nb || 0;
                    var wd = b.wd || 0;
                    html += '<tr><td>' + nameStr + '</td><td style="color:white;">' + formatOver(b.o) + '</td><td style="color:white;">' + b.m + '</td><td style="color:white;">' + totalRuns + '</td><td style="font-weight:bold; font-size:1rem; color:var(--danger);">' + b.w + '</td><td style="color:var(--accent);">' + econ + '</td><td style="font-size:0.75rem; color:white;">' + exStr + '</td><td style="color:white;">' + nb + '</td><td style="color:white;">' + wd + '</td></tr>';
                }
            });
            html += '</tbody></table>';
            if (inn.fow && inn.fow.length > 0) {
                var fowStr = inn.fow.map(function(f) { return '<b style="color:white;">' + f.runs + '/' + (f.wktNum === 'Unbroken' ? '*' : f.wktNum) + '</b> <span style="font-size:0.65rem; color:white;">(' + f.outBatter + ', ' + f.overs + ' ov)</span>'; }).join(', ');
                html += '<div style="font-size:0.75rem; color:#94a3b8; background:rgba(0,0,0,0.3); padding:8px; border-radius:6px; border-left:3px solid var(--accent);"><b style="color:white;">Fall of Wickets:</b><br><div style="margin-top:4px; line-height:1.4;">' + fowStr + '</div></div>';
            }
            html += '</div>';
        });
    }

    var currentAllowances = state.current.allowances || 0;
    var savedCurrInn = state.inningsSummaries.find(function(i) { return i.innNum === state.inningsNum; });
    if (savedCurrInn) {
        currentAllowances = savedCurrInn.allowances || 0;
    }
    html += '</div><div style="border-top:1px solid var(--border); padding-top:10px;"><label class="text-accent">Official Match Result / Status</label><input type="text" id="finalMatchResult" class="modal-input w-100" value="' + (state.matchResult || autoRes) + '" placeholder="e.g., Match Awarded, Follow-on, etc."><label class="text-accent mt-5">Allowances for Inning (Mins)</label><input type="number" id="inningAllowancesInput" class="modal-input w-100" placeholder="e.g. 15" value="' + currentAllowances + '">';

    var pointsHtml = "";
    if (isGameOver) {
        var ptsA = state.teams.A.points || 0;
        var ptsB = state.teams.B.points || 0;
        pointsHtml = '<div style="background:rgba(16, 185, 129, 0.1); border:1px solid #10b981; padding:15px; border-radius:8px; margin-top:15px;"><h4 style="color:#10b981; margin-top:0; text-align:center;">🏆 Tournament Points</h4><div style="display:flex; gap:15px;"><div style="flex:1;"><label class="text-primary" style="font-size:0.8rem; font-weight:bold;">' + state.teams.A.name + '</label><input type="number" id="teamAPoints" class="modal-input w-100" value="' + ptsA + '" step="0.5"></div><div style="flex:1;"><label class="text-primary" style="font-size:0.8rem; font-weight:bold;">' + state.teams.B.name + '</label><input type="number" id="teamBPoints" class="modal-input w-100" value="' + ptsB + '" step="0.5"></div></div></div>';
    }
    html += pointsHtml;

    html += '<button type="button" onclick="openSuperfixModal(\'current\', true)" class="btn-action w-100 mt-10" style="background:#7c3aed; padding:12px; font-size:0.95rem; color:white; font-weight:bold; border:1px solid #a78bfa; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">🛠️ SUPERFIX: DIRECT EDIT SCORECARD & FOW</button>';

    html += '<div class="flex-row gap-10 mt-10 mb-10"><button type="button" onclick="if(typeof downloadSummaryExcel===\'function\')downloadSummaryExcel(); enableSummaryConfirm();" class="btn-action w-100" style="background:#0284c7; padding:12px; font-size:1rem; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">📥 EXCEL</button><button type="button" onclick="if(typeof downloadSummaryPDF===\'function\')downloadSummaryPDF(); enableSummaryConfirm();" class="btn-action w-100" style="background:#be123c; padding:12px; font-size:1rem; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">🖨️ PDF / PRINT</button></div><button type="button" onclick="if(typeof openCardStudio===\'function\')openCardStudio()" class="btn-action w-100 mb-10" style="background: linear-gradient(90deg, #f59e0b, #d97706); padding:15px; font-size:1.1rem; color:black; font-weight:900; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">🌟 OPEN PLAYER CARD STUDIO</button></div>';

    showModal(isGameOver ? "🏁 MATCH COMPLETE" : (isTransition ? "🛑 END OF INNINGS " + state.inningsNum : "📋 DETAILED MATCH SCORECARD"), html, function() {
        state.matchResult = el('finalMatchResult') ? el('finalMatchResult').value : autoRes;
        if (el('inningAllowancesInput')) {
            var val = parseInt(el('inningAllowancesInput').value, 10) || 0;
            state.current.allowances = val;
            var currSummary = state.inningsSummaries.find(function(i) { return i.innNum === state.inningsNum; });
            if (currSummary) currSummary.allowances = val;
        }

        if (isGameOver && el('teamAPoints') && el('teamBPoints')) {
            state.teams.A.points = parseFloat(el('teamAPoints').value) || 0;
            state.teams.B.points = parseFloat(el('teamBPoints').value) || 0;
        }

        closeModal();
        setTimeout(function() {
            if (isGameOver) {
                logCareerStats();
                setTimeout(function() { resetMatch(); }, 1000);
            } else if (isTransition) {
                openTransitionManager();
            }
        }, 300);
    }, hideCancel, "700px", confirmBtnText, requiresDownload);

    el('modalCancelBtn').innerText = "🔙 Go Back & Edit";
    el('modalCancelBtn').onclick = function() {
        closeModal();
        if (isTransition || isGameOver) {
            undoLastAction();
        }
    };
}

function endInnings() {
    try {
        deduplicateInningsSummaries();
        saveState();
        if (state.current.bIdx !== null) finalizeOver(true);
        state.current.inningsEndTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        var fF = JSON.parse(JSON.stringify(state.current.fow || []));
        if (state.current.sIdx !== null && state.current.nsIdx !== null && state.current.wkts < 10) {
            var sBName = getBatTeam().players[state.current.sIdx] ? getBatTeam().players[state.current.sIdx].name : "Unknown";
            var nsBName = getBatTeam().players[state.current.nsIdx] ? getBatTeam().players[state.current.nsIdx].name : "Unknown";
            var pRuns = state.current.currPartnership ? state.current.currPartnership.runs : 0;
            var pBalls = state.current.currPartnership ? state.current.currPartnership.balls : 0;
            fF.push({ wktNum: "Unbroken", runs: state.current.runs, overs: getTeamOversDisplay(), outBatter: "-", partner: sBName + " & " + nsBName, pRuns: pRuns, pBalls: pBalls });
        }

        var summaryPayload = {
            innNum: state.inningsNum,
            batTeam: getBatTeam().name,
            bowlTeam: getBowlTeam().name,
            runs: state.current.runs,
            wkts: state.current.wkts,
            overs: getTeamOversDisplay(),
            penalties: state.current.penalties || 0,
            overHistory: JSON.parse(JSON.stringify(state.current.overHistory || [])),
            batters: JSON.parse(JSON.stringify(getBatTeam().players || [])),
            bowlers: JSON.parse(JSON.stringify(getBowlTeam().players || [])),
            fow: fF,
            extras: JSON.parse(JSON.stringify(state.current.extras)),
            startTime: state.current.inningsStartTime || "-",
            endTime: state.current.inningsEndTime,
            allowances: state.current.allowances || 0
        };

        var existingIdx = state.inningsSummaries.findIndex(function(inn) { return inn.innNum === state.inningsNum; });
        if (existingIdx !== -1) {
            state.inningsSummaries[existingIdx] = summaryPayload;
        } else {
            state.inningsSummaries.push(summaryPayload);
        }

        updateUI();
        showMatchSummary();
    } catch (e) {
        console.error("End Innings Error:", e);
        alert("Error saving Innings Summary. Check console.");
    }
}

function openTransitionManager() {
    var nextInn = state.inningsNum + 1;
    var defaultBat = state.bowlingKey;
    var enforceBat = state.battingKey;
    var disableFollowOn = (state.matchSettings.matchType === 't20' || state.matchSettings.matchType === 'oneday') ? 'disabled' : '';
    var html = '<div class="mb-10 text-primary font-bold" style="text-align:center; font-size:1.2rem;">Setup Innings ' + nextInn + '</div><label class="text-accent">Who will Bat Next?</label><select id="nextBatTeam" class="modal-input w-100"><option value="' + defaultBat + '">Standard Rotation (' + state.teams[defaultBat].name + ')</option><option value="' + enforceBat + '" ' + disableFollowOn + '>Follow-On / Bat Again (' + state.teams[enforceBat].name + ')</option></select><label class="mt-10 text-danger">Special Actions</label><select id="specialAction" class="modal-input w-100"><option value="none">Normal Play</option><option value="forfeit">Forfeit Innings ' + nextInn + '</option></select>';
    showModal("🔄 Innings Transition", html, function() {
        var nBat = el('nextBatTeam').value;
        var nBowl = (nBat === 'A') ? 'B' : 'A';
        var action = el('specialAction').value;
        closeModal();
        setTimeout(function() { executeTransition(nBat, nBowl, action); }, 300);
    }, true);
}

function executeTransition(nBat, nBowl, action) {
    deduplicateInningsSummaries();
    state.inningsNum++;
    state.battingKey = nBat;
    state.bowlingKey = nBowl;
    if (action === 'forfeit') {
        state.inningsSummaries.push({ innNum: state.inningsNum, batTeam: state.teams[nBat].name, bowlTeam: state.teams[nBowl].name, runs: 0, wkts: 0, overs: "0.0", penalties: 0, overHistory: [], batters: JSON.parse(JSON.stringify(state.teams[nBat].players)), bowlers: JSON.parse(JSON.stringify(state.teams[nBowl].players)), fow: [], extras: { w: 0, nb: 0, b: 0, lb: 0 }, startTime: "-", endTime: "-", allowances: 0 });
        remarkLog.push({ over: "0.0", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), batters: "-", bowler: "-", fielder: "-", remark: "Innings " + state.inningsNum + " Forfeited by " + state.teams[nBat].name });
        showMatchSummary();
        return;
    }

    state.current = {
        runs: state.teams[state.battingKey].pendingPenalties || 0, wkts: 0, balls: 0, sIdx: null, nsIdx: null, bIdx: null,
        isFreeHit: false, penalties: state.teams[state.battingKey].pendingPenalties || 0, lastOverBowlers: new Set(),
        extras: { w: 0, nb: 0, b: 0, lb: 0 }, recentBalls: [], currentOverLog: [], runsInThisOver: 0,
        bowlersInCurrentOver: new Set(), overHistory: [], currPartnership: { runs: 0, balls: 0 }, fow: [],
        activeBreak: null, activeBreakStartTime: null, activeBreakInsp: null, pendingBreakMins: 0,
        inningsStartTime: null, inningsEndTime: null, allowances: 0
    };
    state.teams[state.battingKey].pendingPenalties = 0;
    ['A', 'B'].forEach(function(t) {
        state.teams[t].players.forEach(function(p) {
            p.r = p.b = p.f = p.s = p.o = p.rc = p.w = p.m = p.ex = p.wd = p.nb = p.cw = p.catches = p.stumpings = p.runouts = p.byes = p.legbyes = p.quotaOvers = p.breakMins = 0;
            p.out = p.hasBatted = false;
            p.outOnDuck = 0;
            p.dismissalInfo = "";
            p.inTime = p.outTime = null;
        });
    });
    updateUI();
    setTimeout(function() { openMatchStartModal(); }, 100);
}

function openMatchStartModal() {
    var bI = [];
    getBatTeam().players.forEach(function(p, i) { if (p.isPlayingXI) bI.push(i); });
    var sO = getBatTeam().players.map(function(p, i) { return p.isPlayingXI ? '<option value="' + i + '" ' + (i === bI[0] ? 'selected' : '') + '>' + p.name + '</option>' : ''; }).join('');
    var nsO = getBatTeam().players.map(function(p, i) { return p.isPlayingXI ? '<option value="' + i + '" ' + (i === bI[1] ? 'selected' : '') + '>' + p.name + '</option>' : ''; }).join('');
    var bowlOpts = getBowlTeam().players.map(function(p, i) { return p.isPlayingXI ? '<option value="' + i + '">' + p.name + '</option>' : ''; }).join('');
    var html = '<div class="modal-grid-3 mt-10"><div class="modal-player-card"><label class="text-success mb-5">🏏 STRIKER</label><select id="sStr" class="modal-input w-100">' + sO + '</select></div><div class="modal-player-card"><label class="text-success mb-5">🏃 NON-STRIKER</label><select id="sNStr" class="modal-input w-100">' + nsO + '</select></div><div class="modal-player-card"><label class="text-danger mb-5">⚾ BOWLER</label><select id="sBwl" class="modal-input w-100">' + bowlOpts + '</select></div></div><div id="startError" class="text-danger font-bold text-center mt-15"></div>';
    showModal("INNINGS " + state.inningsNum + " SETUP", html, function() {
        var s1 = parseInt(el('sStr').value, 10), s2 = parseInt(el('sNStr').value, 10), b1 = parseInt(el('sBwl').value, 10);
        if (s1 === s2) {
            el('startError').innerText = "🚨 Striker and Non-Striker must be different players!";
            return;
        }
        saveState();
        state.current.sIdx = s1;
        state.current.nsIdx = s2;
        state.current.bIdx = b1;
        getBatTeam().players[s1].hasBatted = true;
        getBatTeam().players[s2].hasBatted = true;
        state.current.bowlersInCurrentOver.add(b1);
        state.current.currPartnership = { runs: 0, balls: 0 };
        state.current.inningsStartTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        closeModal();
        updateUI();
    }, false, "500px", "Start Innings");
}

function openManualRun() {
    showModal("Manual Runs", '<label class="text-primary">Enter Runs Scored</label><input type="number" id="mRunVal" value="5" min="0" class="modal-input w-100">', function() {
        var r = parseInt(el('mRunVal').value, 10) || 0;
        closeModal();
        ballScored(r, false);
    });
}

function openExtra(type) {
    if (state.current.bIdx === null) return openSelector('bowler', "Select Bowler");
    modalContext = { action: 'extra', type: type };
    var defVal = (type === 'B' || type === 'LB') ? 1 : 0;
    var html = '<label class="text-primary">Extra Runs:</label><input type="number" id="exR" value="' + defVal + '" class="modal-input w-100">';
    if (type === 'NB') {
        html += '<select id="nbT" class="modal-input w-100 mt-5"><option value="bat">Off the Bat</option><option value="bye">Byes</option><option value="legbye">Leg Byes</option></select>';
    }
    showModal((type === 'W' ? 'WIDE' : (type === 'NB' ? 'NO BALL' : type)) + " Entry", html, processExtraSubmit);
}

function processExtraSubmit() {
    saveState();
    markOpenerTimes();
    var cur = state.current, ex = parseInt(el('exR').value, 10) || 0, b = getBowlTeam().players[cur.bIdx], s = getBatTeam().players[cur.sIdx], typ = modalContext.type, lbl = '';
    cur.bowlersInCurrentOver.add(cur.bIdx);
    var runsBat = 0, runsExt = 0, exLabel = '';

    if (typ === 'W') {
        var t = ex + 1;
        cur.runs += t; cur.runsInThisOver += t; cur.currPartnership.runs += t;
        b.rc += t; b.wd += t; cur.extras.w += t; lbl = t + 'wd'; runsExt = t; exLabel = 'Wide';
    } else if (typ === 'NB') {
        var nt = el('nbT').value;
        cur.runs += 1; cur.extras.nb += 1; b.rc += 1; b.nb += 1; cur.runsInThisOver += 1; cur.currPartnership.runs += (1 + ex);
        runsExt = 1; exLabel = 'No-Ball';
        if (nt === 'bat' && ex > 0) {
            s.r += ex; b.rc += ex; cur.runs += ex; cur.runsInThisOver += ex; runsBat = ex;
        } else if (ex > 0) {
            cur.runs += ex; runsExt += ex;
            if (nt === 'bye') { cur.extras.b += ex; b.byes += ex; } else { cur.extras.lb += ex; b.legbyes += ex; }
        }
        lbl = (ex + 1) + 'nb';
        if (state.matchSettings.matchType !== 'multiday') cur.isFreeHit = true;
        s.b++; cur.currPartnership.balls++;
    } else {
        lbl = ex + (typ === 'B' ? 'b' : 'lb');
        cur.runs += ex; cur.balls++; b.o++; s.b++; cur.currPartnership.runs += ex; cur.currPartnership.balls++;
        runsExt = ex; exLabel = (typ === 'B' ? 'Bye' : 'Leg-Bye');
        if (typ === 'B') { cur.extras.b += ex; b.byes += ex; } else { cur.extras.lb += ex; b.legbyes += ex; }
        cur.isFreeHit = false;
    }

    cur.currentOverLog.push({ label: lbl, type: 'extra' });
    logBallEvent(s, b, runsBat, runsExt, exLabel, false, null, null);
    if (ex % 2 !== 0) manualRotate();
    if (checkTargetReached()) {
        finalizeOver(true);
        closeModal();
        setTimeout(endInnings, 100);
        return;
    }
    closeModal();
    updateUI();
    checkAutoOverPrompt();
}

function openRetire() {
    if (state.current.bIdx === null) return openSelector('bowler', "Select Bowler");
    showModal("🏃 Process Retire", '<label class="text-primary">Batter Out</label><select id="wWho" class="modal-input w-100"><option value="striker">Striker</option><option value="nonstriker">Non-Striker</option></select><label class="text-primary mt-5">Dismissal Type</label><select id="wType" class="modal-input w-100"><option value="RetiredHurt">Retired - Not Out</option><option value="RetiredOut">Retired - Out</option></select>', processWicketSubmit);
}

function openWicket() {
    if (state.current.bIdx === null) return openSelector('bowler', "Select Bowler");
    var fOpts = '<option value="">-- Select Fielder (Sub) --</option>';
    getBowlTeam().players.forEach(function(p) {
        if (p.name) fOpts += '<option value="' + p.name + '">' + p.name + '</option>';
    });
    var html = '<label class="text-danger">Batter Out</label><select id="wWho" class="modal-input w-100" onchange="updWktOpts()"><option value="striker">Striker</option><option value="nonstriker">Non-Striker</option></select><label class="text-primary mt-5">Type of Delivery</label><select id="wExtra" class="modal-input w-100" onchange="updWktOpts()"><option value="none">Legal</option><option value="wide">Wide</option><option value="noball">No-ball</option></select><label class="text-danger mt-5">Dismissal Type</label><select id="wType" class="modal-input w-100" onchange="updWktFlds()"></select><select id="wFldr" class="modal-input w-100 hidden mt-5">' + fOpts + '</select><div id="wRunsBox" class="hidden mt-10" style="background:rgba(0,0,0,0.3); padding:10px; border-radius:6px; border:1px dashed var(--primary);"><label class="text-primary">Runs Completed Before Dismissal</label><input type="number" id="wRuns" class="modal-input w-100" value="0" min="0"><div id="wRunTypeWrap"><label class="text-primary mt-5">Runs Scored Via</label><select id="wRunType" class="modal-input w-100" style="margin-bottom:0;"><option value="bat">Off the Bat</option><option value="bye">Byes</option><option value="legbye">Leg Byes</option></select></div></div>';
    showModal("🚨 Process Wicket", html, processWicketSubmit);
    setTimeout(function() { updWktOpts(); }, 10);
}

function updWktOpts() {
    if (!el('wWho') || !el('wType')) return;
    var who = el('wWho').value, wT = el('wType'), wEx = el('wExtra') ? el('wExtra').value : 'none', o = '';
    if (wT.options.length > 0 && wT.options[0].value === 'RetiredHurt') return;
    var isFreeHitActive = state.current.isFreeHit || wEx === 'noball';
    if (isFreeHitActive) {
        if (who === 'striker') o = '<option value="RunOut">Run Out</option><option value="HitBallTwice">Hit the ball twice</option><option value="ObstructingField">Obstructing the field</option>';
        else o = '<option value="RunOut">Run Out</option><option value="ObstructingField">Obstructing the field</option>';
    } else if (wEx === 'wide') {
        if (who === 'striker') o = '<option value="Stumped">Stumped</option><option value="RunOut">Run Out</option><option value="HitWicket">Hit Wicket</option><option value="TimedOut">Timed Out</option><option value="ObstructingField">Obstructing the field</option><option value="HitBallTwice">Hit the ball twice</option>';
        else o = '<option value="RunOut">Run Out</option><option value="TimedOut">Timed Out</option><option value="ObstructingField">Obstructing the field</option>';
    } else {
        if (who === 'striker') o = '<option value="Bowled">Bowled</option><option value="Caught">Caught</option><option value="LBW">LBW</option><option value="RunOut">Run Out</option><option value="Stumped">Stumped</option><option value="HitWicket">Hit Wicket</option><option value="TimedOut">Timed Out</option><option value="ObstructingField">Obstructing the field</option><option value="HitBallTwice">Hit the ball twice</option>';
        else o = '<option value="RunOut">Run Out</option><option value="TimedOut">Timed Out</option><option value="ObstructingField">Obstructing the field</option>';
    }
    wT.innerHTML = o;
    updWktFlds();
}

function updWktFlds() {
    if (!el('wType')) return;
    var t = el('wType').value, fldr = el('wFldr'), rBox = el('wRunsBox'), wEx = el('wExtra') ? el('wExtra').value : 'none';
    if (fldr) {
        if (['Caught', 'RunOut'].indexOf(t) !== -1) fldr.classList.remove('hidden');
        else fldr.classList.add('hidden');
    }
    if (rBox) {
        if (['RunOut', 'ObstructingField'].indexOf(t) !== -1) {
            rBox.classList.remove('hidden');
            if (el('wRunTypeWrap')) el('wRunTypeWrap').classList.toggle('hidden', wEx === 'wide');
        } else {
            rBox.classList.add('hidden');
        }
    }
}

function processWicketSubmit() {
    saveState();
    markOpenerTimes();
    var cur = state.current, wWho = el('wWho').value, wType = el('wType').value, wFldr = el('wFldr') ? el('wFldr').value : "", extraType = el('wExtra') ? el('wExtra').value : 'none';
    var b = getBowlTeam().players[cur.bIdx], s = getBatTeam().players[cur.sIdx];
    cur.bowlersInCurrentOver.add(cur.bIdx);
    var isSO = (wWho === 'striker'), outIdx = isSO ? cur.sIdx : cur.nsIdx, oB = getBatTeam().players[outIdx];

    if (wType === 'RetiredHurt' || wType === 'RetiredOut') {
        if (wType === 'RetiredHurt') {
            oB.out = 'retiredHurt';
            oB.dismissalInfo = "Retired Hurt (Not Out)";
        } else {
            cur.wkts++;
            oB.out = true;
            oB.dismissalInfo = "Retired Out";
        }
        cur.currentOverLog.push({ label: 'Ret', type: 'wicket' });
        logBallEvent(s, b, 0, 0, 'None', true, wType, oB);
    } else {
        cur.wkts++;
        oB.out = true;
        var runsScored = 0, runType = 'bat', runsExt = 0, exLabel = 'None';

        if (['RunOut', 'ObstructingField'].indexOf(wType) !== -1) {
            var runsInput = el('wRuns') ? el('wRuns').value : "0";
            runsScored = parseInt(runsInput, 10);
            if (isNaN(runsScored)) runsScored = 0;
            runType = extraType === 'wide' ? 'wide' : (el('wRunType') ? el('wRunType').value : 'bat');
        }
        if (extraType === 'wide') {
            cur.runs += 1; cur.runsInThisOver += 1; cur.extras.w += 1; b.rc += 1; b.wd += 1; runsExt += 1; exLabel = 'Wide';
        } else if (extraType === 'noball') {
            cur.runs += 1; cur.runsInThisOver += 1; cur.extras.nb += 1; b.rc += 1; b.nb += 1; s.b++; cur.currPartnership.balls++;
            if (state.matchSettings.matchType !== 'multiday') cur.isFreeHit = true;
            runsExt += 1; exLabel = 'No-Ball';
        } else if (wType !== 'TimedOut') {
            s.b++; cur.balls++; b.o++; cur.currPartnership.balls++; cur.isFreeHit = false;
        }

        var runsBat = 0;
        if (runsScored > 0) {
            cur.runs += runsScored; cur.runsInThisOver += runsScored; cur.currPartnership.runs += runsScored;
            if (extraType === 'wide') {
                cur.extras.w += runsScored; b.rc += runsScored; b.wd += runsScored; runsExt += runsScored;
            } else if (runType === 'bat') {
                s.r += runsScored; b.rc += runsScored;
                if (runsScored === 4) s.f++;
                if (runsScored === 6) s.s++;
                runsBat = runsScored;
            } else if (runType === 'bye') {
                cur.extras.b += runsScored; b.byes += runsScored; runsExt += runsScored;
            } else if (runType === 'legbye') {
                cur.extras.lb += runsScored; b.legbyes += runsScored; runsExt += runsScored;
            }
        }
        if (['Bowled', 'Caught', 'LBW', 'Stumped', 'HitWicket'].indexOf(wType) !== -1) {
            b.w++;
            b.cw = (b.cw || 0) + 1;
        } else {
            b.cw = 0;
        }

        if (wType === 'Stumped') {
            var wk = getBowlTeam().players.find(function(p) { return p.skill && p.skill.includes('WK') && p.isPlayingXI; });
            if (wk) { wk.stumpings++; wFldr = wk.name; } else { wFldr = "WK"; }
        } else if (wFldr) {
            var fObj = getBowlTeam().players.find(function(p) { return p.name === wFldr; });
            if (fObj) {
                if (wType === 'Caught') fObj.catches++;
                else if (wType === 'RunOut') fObj.runouts++;
            }
        }

        var logLabel = (runsScored > 0 ? runsScored : '') + 'W';
        if (extraType === 'wide') logLabel = (runsScored + 1) + 'wd+W';
        else if (extraType === 'noball') logLabel = (runsScored + 1) + 'nb+W';
        cur.currentOverLog.push({ label: logLabel, type: 'wicket' });
        oB.outOnDuck = (oB.r === 0) ? 1 : 0;
        var dT = "";
        if (wType === 'Bowled') dT = "b " + b.name;
        else if (wType === 'Caught') dT = "c " + (wFldr || 'Sub') + " b " + b.name;
        else if (wType === 'LBW') dT = "lbw b " + b.name;
        else if (wType === 'Stumped') dT = "st " + wFldr + " b " + b.name;
        else if (wType === 'RunOut') dT = "run out (" + (wFldr || 'Sub') + ")";
        else if (wType === 'HitWicket') dT = "hit wicket b " + b.name;
        else if (wType === 'ObstructingField') dT = "obstructing the field";
        else if (wType === 'HitBallTwice') dT = "hit the ball twice";
        else if (wType === 'TimedOut') dT = "timed out";
        if (extraType === 'wide') dT += ' (wd)';
        else if (extraType === 'noball') dT += ' (nb)';
        oB.dismissalInfo = dT;
        logBallEvent(s, b, runsBat, runsExt, exLabel, true, wType, oB);
    }

    oB.outTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    cur.fow.push({ wktNum: cur.wkts, runs: cur.runs, overs: getTeamOversDisplay(), outBatter: oB.name, partner: getBatTeam().players[isSO ? cur.nsIdx : cur.sIdx].name, pRuns: cur.currPartnership.runs, pBalls: cur.currPartnership.balls });
    cur.currPartnership = { runs: 0, balls: 0 };
    var runsScoredRotate = 0;
    if (['RunOut', 'ObstructingField'].indexOf(wType) !== -1) {
        var rotInput = el('wRuns') ? el('wRuns').value : "0";
        runsScoredRotate = parseInt(rotInput, 10);
        if (isNaN(runsScoredRotate)) runsScoredRotate = 0;
    }
    if (['RunOut', 'ObstructingField'].indexOf(wType) !== -1) {
        if (runsScoredRotate % 2 === 0) manualRotate();
    } else {
        if (runsScoredRotate % 2 !== 0 && ['Caught', 'Bowled', 'LBW', 'Stumped', 'HitWicket', 'TimedOut'].indexOf(wType) === -1) {
            manualRotate();
        }
    }
    if (checkTargetReached()) {
        if (cur.bIdx !== null) finalizeOver(true);
        closeModal();
        setTimeout(endInnings, 100);
        return;
    }
    closeModal();
    updateUI();
    var promptDelay = 800;
    if (cur.wkts < 10) {
        var slot = getBatTeam().players[cur.sIdx].out ? 'striker' : 'nonstriker';
        setTimeout(function() { openSelector(slot, "Next Batter"); }, promptDelay);
    } else {
        setTimeout(function() { endInnings(); }, promptDelay);
    }
}

function openPenalty() {
    var html = '<select id="penT" class="modal-input w-100"><option value="bat">Batting Team</option><option value="bowl">Bowling Team</option></select><input type="number" id="penR" class="modal-input w-100" placeholder="Runs" value="5">';
    showModal("Award Penalty Runs", html, function() {
        saveState();
        var t = el('penT').value, r = parseInt(el('penR').value, 10) || 0;
        if (r === 0) { closeModal(); return; }
        if (t === 'bat') {
            state.current.runs += r;
            state.current.penalties += r;
            state.current.currentOverLog.push({ label: "+" + r + "P", type: 'extra' });
            if (checkTargetReached()) {
                finalizeOver(true);
                closeModal();
                setTimeout(endInnings, 100);
                return;
            }
        } else {
            var p = state.inningsSummaries.find(function(i) { return i.batTeam === getBowlTeam().name; });
            if (p) {
                p.runs += r;
                p.penalties = (p.penalties || 0) + r;
                alert("Penalty added to completed innings!");
            } else {
                state.teams[state.bowlingKey].pendingPenalties += r;
                alert("Penalty will be added to next innings!");
            }
        }
        closeModal();
        updateUI();
    });
}

function openChangeWK() {
    var o = getBowlTeam().players.map(function(p, i) {
        return p.isPlayingXI ? '<option value="' + i + '" ' + (p.skill && p.skill.includes('WK') ? 'selected' : '') + '>' + p.name + '</option>' : '';
    }).join('');
    showModal("🧤 Change WK", '<select id="nWK" class="modal-input w-100"><option value="-1">-- No WK Selected --</option>' + o + '</select>', function() {
        getBowlTeam().players.forEach(function(p) {
            if (p.skill && p.skill.includes('/ WK')) p.skill = p.skill.replace(' / WK', '');
        });
        var idx = parseInt(el('nWK').value, 10);
        if (idx >= 0 && !getBowlTeam().players[idx].skill.includes('WK')) {
            getBowlTeam().players[idx].skill += ' / WK';
        }
        syncMetadataToHistory(false);
        closeModal();
        updateUI();
    });
}

function updSwap() {
    el('swO').innerHTML = state.teams[el('swT').value].players.map(function(p, i) { return p.isPlayingXI ? '<option value="' + i + '">' + p.name + '</option>' : ''; }).join('');
    el('swI').innerHTML = state.teams[el('swT').value].players.map(function(p, i) { return !p.isPlayingXI ? '<option value="' + i + '">' + p.name + '</option>' : ''; }).join('');
}

function openPlayerSwap() {
    var html = '<select id="swT" class="modal-input w-100" onchange="updSwap()"><option value="A">' + state.teams.A.name + '</option><option value="B">' + state.teams.B.name + '</option></select><label>OUT:</label><select id="swO" class="modal-input w-100"></select><label>IN:</label><select id="swI" class="modal-input w-100"></select>';
    showModal("🔄 Sub Swap", html, function() {
        var k = el('swT').value, o = parseInt(el('swO').value, 10), i = parseInt(el('swI').value, 10), t = state.teams[k].players;
        if ((k === state.battingKey && (state.current.sIdx === o || state.current.nsIdx === o)) || (k === state.bowlingKey && state.current.bIdx === o)) {
            alert("Cannot swap active player!");
            return;
        }
        saveState();
        t[o].isPlayingXI = false;
        if (!t[o].dismissalInfo && t[o].hasBatted) t[o].dismissalInfo = "Replaced (Injury)";
        t[i].isPlayingXI = true;
        closeModal();
        updateUI();
    });
    setTimeout(updSwap, 10);
}

function openEditSquad() {
    var html = '<select id="editSqTeam" class="modal-input w-100" onchange="buildEditSq()"><option value="A">' + state.teams.A.name + '</option><option value="B">' + state.teams.B.name + '</option></select><div id="editSqDiv" style="max-height:60vh; overflow-y:auto; margin-top:10px; border:1px solid var(--border); border-radius:6px; background:rgba(0,0,0,0.2);"></div>';
    showModal("🛠️ Edit Squad & Playing XI", html, saveEditSquad, true, "500px", "Save Changes");
    setTimeout(buildEditSq, 50);
}

function buildEditSq() {
    var k = el('editSqTeam').value, t = state.teams[k].players;
    var html = '<table class="roster-table" style="color:white; margin-top:0; min-width:100%;"><thead style="position:sticky; top:0; background:#020617; z-index:5;"><tr><th style="width:10%;">#</th><th style="width:65%;">Player Name</th><th style="width:25%; text-align:center;">Playing 11</th></tr></thead><tbody>';
    t.forEach(function(p, i) {
        html += '<tr><td style="text-align:center; color:var(--text-muted);">' + (i + 1) + '</td><td><input type="text" id="es-n-' + i + '" value="' + p.name + '" class="w-100" style="padding:6px; font-size:0.85rem; border:none; background:transparent; border-bottom:1px solid #334155; border-radius:0;"></td><td style="text-align:center;"><input type="checkbox" id="es-p-' + i + '" ' + (p.isPlayingXI ? 'checked' : '') + ' style="width:18px;height:18px; cursor:pointer;"></td></tr>';
    });
    html += '</tbody></table>';
    el('editSqDiv').innerHTML = html;
}

function saveEditSquad() {
    var k = el('editSqTeam').value, t = state.teams[k].players, activeIdxs = [];
    if (k === state.battingKey) {
        if (state.current.sIdx !== null) activeIdxs.push(state.current.sIdx);
        if (state.current.nsIdx !== null) activeIdxs.push(state.current.nsIdx);
    }
    if (k === state.bowlingKey && state.current.bIdx !== null) activeIdxs.push(state.current.bIdx);
    for (var i = 0; i < t.length; i++) {
        var isChecked = el('es-p-' + i).checked;
        if (!isChecked && activeIdxs.indexOf(i) !== -1) {
            alert("Cannot remove " + t[i].name + " from Playing XI because they are active!");
            return;
        }
    }
    for (var j = 0; j < t.length; j++) {
        t[j].name = el('es-n-' + j).value.trim();
        t[j].isPlayingXI = el('es-p-' + j).checked;
    }
    syncMetadataToHistory(true);
    closeModal();
    updateUI();
}

function openSelector(typ, title) {
    var cur = state.current, lst = typ === 'bowler' ? getBowlTeam().players : getBatTeam().players;
    var hasValidDefault = false;
    var optOptions = [];

    lst.forEach(function(p, i) {
        if (!p.isPlayingXI) return;
        var s = false;
        if (typ === 'bowler') {
            s = (i !== cur.bIdx);
        } else {
            s = ((!p.hasBatted || p.out === 'retiredHurt') && i !== cur.sIdx && i !== cur.nsIdx);
        }
        if (!s) return;

        var label = p.name;
        var isWarning = false;
        if (typ === 'bowler') {
            if (p.quotaOvers >= state.matchSettings.bowlerQuota) { label += ' ⚠️ (Quota Full)'; isWarning = true; }
            if (cur.lastOverBowlers.has(i)) { label += ' 🛑 (Bowled Last Over)'; isWarning = true; }
        }

        var selectedStr = "";
        if (!hasValidDefault && !isWarning) {
            selectedStr = "selected";
            hasValidDefault = true;
        }
        optOptions.push('<option value="' + i + '" ' + selectedStr + '>' + label + '</option>');
    });

    if (typ !== 'bowler' && optOptions.length === 0) {
        alert("No more batters available! The innings will now end automatically.");
        setTimeout(endInnings, 500);
        return;
    }

    var finalOptHtml = (typ === 'bowler' && !hasValidDefault)
        ? '<option value="-1" selected disabled>-- Select Bowler --</option>' + optOptions.join('')
        : optOptions.join('');

    showModal(title, '<select id="gSel" class="modal-input w-100">' + finalOptHtml + '</select>', function() {
        var val = parseInt(el('gSel').value, 10);
        if (isNaN(val) || val < 0) {
            alert("Please select a valid player from the dropdown.");
            return;
        }

        saveState();
        if (typ === 'bowler') {
            var selectedBowler = getBowlTeam().players[val];
            if (selectedBowler.quotaOvers >= state.matchSettings.bowlerQuota) {
                if (!confirm("⚠️ WARNING: " + selectedBowler.name + " has already bowled their quota of " + state.matchSettings.bowlerQuota + " overs!\n\nAre you absolutely sure the umpire is allowing them to bowl an extra over?")) return;
            }
            if (cur.lastOverBowlers.has(val)) {
                if (!confirm("🛑 RULE BREACH WARNING: " + selectedBowler.name + " bowled the previous over!\n\nBowlers cannot bowl consecutive overs. Are you sure the umpire is allowing this?")) return;
            }
            cur.bIdx = val;
            cur.bowlersInCurrentOver.add(val);
        } else {
            cur[typ === 'striker' ? 'sIdx' : 'nsIdx'] = val;
            var nB = getBatTeam().players[val];
            if (nB.out === 'retiredHurt') {
                nB.out = false;
                nB.dismissalInfo = "";
            } else {
                nB.inTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            nB.hasBatted = true;
        }
        closeModal();
        updateUI();
        if (typ !== 'bowler' && cur.bIdx === null && cur.wkts < 10) {
            setTimeout(function() { openSelector('bowler', "Select Next Bowler"); }, 50);
        } else if (typ !== 'bowler') {
            checkAutoOverPrompt();
        }
    }, false, "360px", "Confirm");
}

function updateUI() {
    deduplicateInningsSummaries();
    var cur = state.current, bT = getBatTeam().players, bwT = getBowlTeam().players;
    setTimeout(function() {
        localStorage.setItem('cricStat_activeMatch', JSON.stringify(state, function(key, value) {
            return value instanceof Set ? Array.from(value) : value;
        }));
        triggerCloudSync();
    }, 0);

    if (activeMatch && activeMatch.full_state) {
        var tName = (activeMatch && activeMatch.tournaments && activeMatch.tournaments.name)
            ? activeMatch.tournaments.name
            : (activeMatch && activeMatch.full_state && activeMatch.full_state.tournament ? activeMatch.full_state.tournament : "INDEPENDENT MATCH");
        if (el('displayTournament')) el('displayTournament').innerText = tName;
    }

    el('inningsBadge').innerText = "INNINGS " + state.inningsNum;
    el('dispBatTeamName').innerText = state.teams[state.battingKey].name;
    el('dispBowlTeamName').innerText = state.teams[state.bowlingKey].name;
    el('dispBatTeamNameTop').innerText = state.teams[state.battingKey].name;

    var histHtml = '';
    state.inningsSummaries.forEach(function(inn) {
        histHtml += '<div class="text-success mb-5" style="font-size:0.85rem;">Inn ' + inn.innNum + ': ' + inn.batTeam + ' scored ' + inn.runs + '/' + inn.wkts + '</div>';
    });
    el('inningsHistoryText').innerHTML = histHtml;

    var effBalls = getEffectiveBalls(cur);
    var crrVal = effBalls > 0 ? ((cur.runs / effBalls) * 6).toFixed(2) : "0.00";
    if (el('liveCrr')) el('liveCrr').innerText = crrVal;

    var curTargetString = null, rrrVal = null;
    if (state.matchSettings.matchType === 'multiday') {
        var allInn = state.inningsSummaries.slice();
        var bowlTeam = getBowlTeam().name;
        var bowlTeamInnsCount = allInn.filter(function(i) { return i.batTeam === bowlTeam; }).length;
        if (state.matchSettings.customTarget) {
            curTargetString = state.matchSettings.customTarget + " Runs";
        } else if (bowlTeamInnsCount === 2) {
            var bowlTotal = allInn.filter(function(i) { return i.batTeam === bowlTeam; }).reduce(function(sum, i) { return sum + i.runs; }, 0);
            var batPrevInns = allInn.filter(function(i) { return i.batTeam === getBatTeam().name; }).reduce(function(sum, i) { return sum + i.runs; }, 0);
            var targetToWin = bowlTotal - batPrevInns + 1;
            if (targetToWin > 0) curTargetString = "Target: " + targetToWin;
        }
        if (curTargetString) {
            el('dispTargetText').innerText = curTargetString;
            el('targetDisplayBox').classList.remove('hidden');
        } else {
            el('targetDisplayBox').classList.add('hidden');
        }
        if (el('rrrBox')) el('rrrBox').classList.add('hidden');
    } else {
        if (state.inningsNum > 1 && state.inningsSummaries.length > 0) {
            var prevInn = state.inningsSummaries.find(function(i) { return i.innNum === state.inningsNum - 1; }) || state.inningsSummaries[0];
            var tRuns = state.matchSettings.customTarget || (prevInn ? prevInn.runs + 1 : 1);
            var tOvers = state.matchSettings.customTargetOvers || state.matchSettings.maxOvers || state.matchSettings.originalMaxOvers;
            var tMethod = state.matchSettings.targetMethod || "";
            curTargetString = (tRuns + " (" + tOvers + ") " + tMethod).trim();
            el('dispTargetText').innerText = curTargetString;
            el('targetDisplayBox').classList.remove('hidden');
            var runsNeeded = tRuns - cur.runs;
            if (runsNeeded < 0) runsNeeded = 0;
            var targetFullOvers = Math.floor(tOvers);
            var targetExtraBalls = Math.round((tOvers - targetFullOvers) * 10);
            var totalTargetBalls = (targetFullOvers * 6) + targetExtraBalls;
            var ballsLeft = totalTargetBalls - effBalls;
            if (ballsLeft < 0) ballsLeft = 0;
            rrrVal = ballsLeft > 0 ? ((runsNeeded / ballsLeft) * 6).toFixed(2) : "0.00";
            if (el('liveRrr')) el('liveRrr').innerText = rrrVal;
            var runsColor = runsNeeded < ballsLeft ? 'var(--success)' : (runsNeeded > ballsLeft ? 'var(--danger)' : 'white');
            if (el('liveReq')) {
                el('liveReq').innerHTML = '<span style="color:' + runsColor + ';">' + runsNeeded + '</span><span style="color:var(--primary);">/</span><span style="color:var(--accent);">' + ballsLeft + '</span>';
            }
            if (el('rrrBox')) el('rrrBox').classList.remove('hidden');
        } else {
            el('targetDisplayBox').classList.add('hidden');
            if (el('rrrBox')) el('rrrBox').classList.add('hidden');
        }
    }

    var leadBoxHtml = "";
    if (state.matchSettings.matchType === 'multiday' && state.inningsNum > 1) {
        var tBat = getBatTeam().name, tBowl = getBowlTeam().name;
        var sBat = state.current.runs + state.inningsSummaries.filter(function(i) { return i.batTeam === tBat; }).reduce(function(a, b) { return a + b.runs; }, 0);
        var sBowl = state.inningsSummaries.filter(function(i) { return i.batTeam === tBowl; }).reduce(function(a, b) { return a + b.runs; }, 0);
        var diff = sBat - sBowl;
        var txt = diff > 0 ? "lead by " + diff : (diff < 0 ? "trail by " + Math.abs(diff) : "scores level");
        leadBoxHtml = '<p class="text-accent font-bold mt-5 mb-0" style="font-size:0.85rem; text-transform:uppercase;">📊 ' + tBat + ' ' + txt + '</p>';
    }
    el('leadTrailBox').innerHTML = leadBoxHtml;

    el('livePartnership').innerText = cur.currPartnership.runs + " (" + cur.currPartnership.balls + ")";
    el('liveRuns').innerText = cur.runs;
    el('liveWkts').innerText = cur.wkts;
    el('liveWkts').style.color = "var(--danger)";
    el('liveOvers').innerText = getTeamOversDisplay();
    el('liveExtras').innerText = cur.extras.w + cur.extras.nb + cur.extras.b + cur.extras.lb;
    el('exW').innerText = cur.extras.w;
    el('exNB').innerText = cur.extras.nb;
    el('exB').innerText = cur.extras.b;
    el('exLB').innerText = cur.extras.lb;
    el('livePenalties').innerText = cur.penalties;
    el('freeHitBadge').classList.toggle('hidden', !cur.isFreeHit);

    if (state.current.activeBreak) {
        el('scoringEventsBox').classList.add('hidden');
        el('breakOverlayBox').classList.remove('hidden');
        el('breakTitle').innerText = "PAUSED: " + state.current.activeBreak;
        el('breakSubtitle').innerText = state.current.activeBreakInsp ? "Next Inspection: " + state.current.activeBreakInsp : "";
    } else {
        el('scoringEventsBox').classList.remove('hidden');
        el('breakOverlayBox').classList.add('hidden');
    }

    var battedPlayers = bT.map(function(p, i) { return { p: p, i: i }; }).filter(function(item) { return item.p.hasBatted; });
    battedPlayers.sort(function(a, b) {
        var aActive = (a.i === cur.sIdx || a.i === cur.nsIdx) ? 1 : 0;
        var bActive = (b.i === cur.sIdx || b.i === cur.nsIdx) ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return a.i - b.i;
    });

    var battersHtml = '<table class="bowler-table" style="font-size: 0.85rem; margin-top:0;"><thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>';
    battersHtml += battedPlayers.map(function(item) {
        var p = item.p, rI = item.i;
        var isActive = (rI === cur.sIdx || rI === cur.nsIdx);
        var isStriker = (rI === cur.sIdx);
        var sr = p.b > 0 ? ((p.r / p.b) * 100).toFixed(2) : "0.00";
        var dName = p.name;
        if (p.desig === 'C' || p.desig === 'C/WK' || (p.desig && p.desig.includes('C'))) dName += ' (C)';
        if (p.skill && p.skill.includes('WK')) dName += ' *';
        if (isStriker) dName += ' <span style="font-size:0.8rem;" title="Striker">🏏</span>';
        var rowStyle = isActive ? (isStriker ? 'background: rgba(16, 185, 129, 0.15); border-left: 3px solid var(--success);' : 'background: rgba(255,255,255,0.05); border-left: 3px solid transparent;') : 'opacity: 0.6; border-left: 3px solid transparent;';
        var statusInfo = p.out ? '<div style="font-size:0.65rem; color:var(--danger); font-style:italic; margin-top:2px;">' + p.dismissalInfo + '</div>' : (isActive ? '<div style="font-size:0.65rem; color:var(--success); font-style:italic; margin-top:2px;">Not Out</div>' : '');
        return '<tr style="' + rowStyle + '"><td style="padding:8px; max-width: 140px;"><div style="font-weight:bold; color:' + (isActive ? 'white' : 'var(--text-muted)') + '; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="' + p.name + '">' + dName + '</div>' + statusInfo + '</td><td style="font-weight:bold; font-size:1.1rem; color:var(--primary); padding:8px;">' + p.r + '</td><td style="padding:8px;">' + p.b + '</td><td style="color:var(--b4); padding:8px;">' + p.f + '</td><td style="color:var(--b6); padding:8px;">' + p.s + '</td><td style="color:var(--accent); font-weight:bold; padding:8px;">' + sr + '</td></tr>';
    }).join('');
    battersHtml += '</tbody></table>';

    var liveFowList = (cur.fow && cur.fow.length > 0)
        ? cur.fow.map(function(f) { return '<span style="display:inline-block; margin-right:8px; margin-bottom:4px;"><b style="color:white;">' + f.runs + '/' + f.wktNum + '</b> <span style="color:#94a3b8;">(' + f.outBatter + ', ' + f.overs + ' ov)</span></span>'; }).join('')
        : '<span style="color:#64748b; font-style:italic;">No wickets fallen yet.</span>';

    battersHtml += '<div style="margin-top:10px; background:rgba(0,0,0,0.25); border:1px solid #334155; border-left:3px solid #f59e0b; border-radius:6px; padding:8px; font-size:0.75rem;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;"><b style="color:#f59e0b; text-transform:uppercase; letter-spacing:0.5px;">📉 Fall of Wickets</b><button type="button" onclick="openFoWModal()" style="background:#334155; color:#38bdf8; border:none; border-radius:4px; padding:2px 8px; font-size:0.7rem; font-weight:bold; cursor:pointer;">✏️ Edit FoW</button></div><div style="line-height:1.4;">' + liveFowList + '</div></div><button type="button" onclick="openSuperfixModal(\'current\', false)" class="btn-action w-100 mt-10" style="background:#7c3aed; color:white; padding:10px; font-size:0.85rem; border:1px solid #a78bfa; box-shadow:0 4px 10px rgba(0,0,0,0.3);">🛠️ SUPERFIX SCORECARD & FOW</button>';

    el('battersContainer').innerHTML = battersHtml;

    var miniBatHtml = "";
    if (cur.sIdx !== null) {
        var p1 = bT[cur.sIdx];
        miniBatHtml += '<div style="display: flex; align-items: center; width: 100%; margin-bottom: 2px;"><div style="color: white; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; text-align: left;" title="' + p1.name + '">' + p1.name + '</div><div style="flex: 0 0 auto; margin-left: 4px; white-space: nowrap;"><span style="font-size:0.6rem; margin-right: 2px;">🏏</span><span class="text-primary" style="font-weight:bold;">' + p1.r + '</span><span style="color:var(--text-muted); font-weight:normal; font-size:0.7rem; margin-left:2px;">(' + p1.b + ')</span></div></div>';
    }
    if (cur.nsIdx !== null) {
        var p2 = bT[cur.nsIdx];
        miniBatHtml += '<div style="display: flex; align-items: center; width: 100%;"><div style="color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; text-align: left;" title="' + p2.name + '">' + p2.name + '</div><div style="flex: 0 0 auto; margin-left: 4px; white-space: nowrap;"><span class="text-primary" style="font-weight:bold;">' + p2.r + '</span><span style="color:var(--text-muted); font-weight:normal; font-size:0.7rem; margin-left:2px;">(' + p2.b + ')</span></div></div>';
    }
    el('miniLiveBatters').innerHTML = miniBatHtml;

   if (cur.bIdx !== null) {
        var actB = bwT[cur.bIdx];
        var bName = actB.name;
        if (actB.desig === 'C' || actB.desig === 'C/WK' || (actB.desig && actB.desig.includes('C'))) bName += ' (C)';
        if (actB.skill && actB.skill.includes('WK')) bName += ' *';
        if (actB.quotaOvers > state.matchSettings.bowlerQuota) bName += ' <span style="color:#f59e0b;" title="Exceeded Quota">⚠️</span>';

        el('activeBowlerNameRight').innerHTML = bName;
        el('activeBowlerNameRight').title = actB.name;
        
        var badgesHtml = cur.currentOverLog.map(getBadgeHtml).join('');
        el('activeBowlerProgress').innerHTML = badgesHtml;
        if(el('mainCurrentOverProgress')) el('mainCurrentOverProgress').innerHTML = badgesHtml;
        
        var totalRuns = (actB.rc || 0);
        var miniBowlHtml = '<div style="display:flex; justify-content:flex-end; align-items:center; width:100%; margin-bottom:2px;"><div style="flex: 0 0 auto; margin-right:4px;">⚾</div><div style="color:white; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex: 0 1 auto; text-align:right;">' + actB.name + '</div></div><div style="color:var(--text-muted); font-size:0.75rem; text-align:right; white-space:nowrap;">' + formatOver(actB.o) + '-' + actB.m + '-' + totalRuns + '-<span class="text-danger" style="font-weight:bold;">' + actB.w + '</span></div>';
        el('miniLiveBowler').innerHTML = miniBowlHtml;
    } else {
        el('activeBowlerNameRight').innerText = "Select...";
        el('activeBowlerNameRight').title = "";
        el('activeBowlerProgress').innerHTML = "";
        if(el('mainCurrentOverProgress')) el('mainCurrentOverProgress').innerHTML = "";
        el('miniLiveBowler').innerHTML = '<div style="color: var(--text-muted); font-style:italic;">Select Bowler...</div>';
    }

    el('recentBallsData').innerHTML = cur.recentBalls.map(getBadgeHtml).join('');
    el('bowlStatsBody').innerHTML = bwT.filter(function(p) { return p.o > 0 || p.rc > 0; }).map(function(p) {
        var bName = p.name;
        if (p.desig === 'C' || p.desig === 'C/WK' || (p.desig && p.desig.includes('C'))) bName += ' (C)';
        if (p.skill && p.skill.includes('WK')) bName += ' *';
        if (p.quotaOvers > state.matchSettings.bowlerQuota) bName += ' <span style="color:#f59e0b;" title="Exceeded Quota">⚠️</span>';
        var totalRuns = p.rc || 0;
        var exStr = (p.byes || 0) + 'b, ' + (p.legbyes || 0) + 'lb';
        var noBalls = p.nb || 0;
        var wides = p.wd || 0;
        return '<tr><td style="max-width: 85px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="' + p.name + '">' + bName + '</td><td>' + formatOver(p.o) + '</td><td>' + p.m + '</td><td>' + totalRuns + '</td><td style="color:var(--danger); font-weight:bold;">' + p.w + '</td><td style="font-size:0.7rem; color:var(--text-muted);">' + exStr + '</td><td>' + noBalls + '</td><td>' + wides + '</td></tr>';
    }).join('');
}

function manualRotateUI() {
    saveState();
    manualRotate();
}

function manualRotate() {
    var temp = state.current.sIdx;
    state.current.sIdx = state.current.nsIdx;
    state.current.nsIdx = temp;
    updateUI();
}

function executeEndOver() {
    saveState();
    if (state.current.isFreeHit) {
        state.current.isFreeHit = false;
    }
    finalizeOver(false);
    manualRotate();
    state.current.bIdx = null;
    updateUI();

    if (state.current.overHistory.length >= state.matchSettings.maxOvers) {
        setTimeout(endInnings, 100);
    } else {
        setTimeout(function() { openSelector('bowler', "Select Next Bowler"); }, 50);
    }
}

function toggleFreeHit() {
    saveState();
    state.current.isFreeHit = !state.current.isFreeHit;
    updateUI();
}

function manualEndOver() {
    if (state.current.bIdx === null) {
        alert("No bowler is currently active!");
        return;
    }
    var cur = state.current;
    var completedOvers = cur.overHistory.length;
    var ballsInPreviousOvers = completedOvers > 0 ? (cur.overHistory[completedOvers - 1].totalBallsAtEnd || (completedOvers * 6)) : 0;
    var currentOverBalls = Math.max(0, cur.balls - ballsInPreviousOvers);

    if (currentOverBalls === 0) {
        alert("No legal deliveries bowled in this over yet!");
        return;
    }

    var confirmAndEndOver = function() {
        if (state.current.isFreeHit) {
            state.current.isFreeHit = false;
            var fhBadge = document.getElementById('freeHitBadge');
            if (fhBadge) fhBadge.classList.add('hidden');
        }
        if (currentOverBalls > 6) {
            var excess = currentOverBalls - 6;
            state.current.balls -= excess;
            var b = getBowlTeam().players[state.current.bIdx];
            if (b) b.o -= excess;
        }
        executeEndOver();
    };

    if (currentOverBalls < 6) {
        showModal(
            "⚠️ Early Over Call",
            '<div class="text-center mb-10 text-accent" style="font-size:1.1rem;">Only <b>' + currentOverBalls + '</b> legal deliveries bowled!</div><div class="text-center text-muted" style="font-size:0.85rem;">Do you really want to end this over early?</div>',
            function() {
                closeModal();
                confirmAndEndOver();
            },
            false,
            "360px",
            "Yes, Call Over"
        );
        return;
    }
    confirmAndEndOver();
}

function checkAutoOverPrompt() {
    var cur = state.current;
    if (cur.wkts >= 10 || checkTargetReached()) return;

    var completedOvers = cur.overHistory.length;
    var ballsInPreviousOvers = completedOvers > 0 ? (cur.overHistory[completedOvers - 1].totalBallsAtEnd || (completedOvers * 6)) : 0;
    var currentOverBalls = Math.max(0, cur.balls - ballsInPreviousOvers);

    if (currentOverBalls === 6) {
        var strikerOut = cur.sIdx !== null && getBatTeam().players[cur.sIdx].out;
        var nonStrikerOut = cur.nsIdx !== null && getBatTeam().players[cur.nsIdx].out;
        if (strikerOut || nonStrikerOut) return;

        var scoringBox = el('scoringEventsBox');
        if (scoringBox) {
            scoringBox.style.pointerEvents = 'none';
            scoringBox.style.opacity = '0.6';
        }

        setTimeout(function() {
            if (state.current.bIdx === null) {
                if (scoringBox) {
                    scoringBox.style.pointerEvents = 'auto';
                    scoringBox.style.opacity = '1';
                }
                return;
            }
            showModal("🔄 Over Completed", '<div class="text-center mb-10 text-accent font-bold" style="font-size:1.1rem;">6 legal deliveries bowled!</div><div class="text-center text-muted" style="font-size:0.85rem;">Click <b>Call Over</b> to select the next bowler, or click <b>Cancel</b> if the umpire allows play to continue (7th ball).</div>', function() {
                closeModal();
                executeEndOver();
            }, false, "360px", "Call Over");
        }, 600);
    }
}

// ==========================================
// 📉 MATCH REVISOR ENGINE (DLS / VJD / RAIN DELAYS)
// ==========================================

function openEditMatchConditions() {
    if (!state.matchSettings) {
        state.matchSettings = { maxOvers: 20, originalMaxOvers: 20, bowlerQuota: 4 };
    }
    var curOvers = state.matchSettings.customTargetOvers || state.matchSettings.maxOvers || 20;
    var prevInn = state.inningsSummaries.find(function(i) { return i.innNum === 1; }) || state.inningsSummaries[0];
    var defaultTarget = state.matchSettings.customTarget || (prevInn ? prevInn.runs + 1 : "");
    var curMethod = state.matchSettings.targetMethod || "";

    var html = '<div style="background:rgba(239,68,68,0.1); border:1px solid #ef4444; padding:15px; border-radius:8px; margin-bottom:15px;">' +
        '<label style="color:#ef4444; font-weight:bold;">Revised Max Overs (Current / 2nd Innings)</label>' +
        '<input type="number" id="modOvers" class="modal-input w-100" value="' + curOvers + '" step="0.1" style="font-size:1.1rem; margin-top:5px;">' +
        '<p style="font-size:0.75rem; color:#94a3b8; margin-top:5px; margin-bottom:0;">Automatically recalculates Bowler Quota (20%) and Required Run Rate (RRR).</p>' +
        '</div>' +
        '<div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; padding:15px; border-radius:8px; margin-bottom:15px;">' +
        '<label style="color:#10b981; font-weight:bold;">Revised Target Runs (DLS / VJD)</label>' +
        '<input type="number" id="modTarget" class="modal-input w-100" value="' + defaultTarget + '" placeholder="Leave blank if 1st Innings" style="font-size:1.1rem; margin-top:5px;">' +
        '<label style="color:#10b981; font-weight:bold; margin-top:10px;">Calculation Method</label>' +
        '<input type="text" id="modMethod" class="modal-input w-100" value="' + curMethod + '" placeholder="e.g., DLS, VJD, Curtailed" style="margin-top:5px;">' +
        '</div>' +
        '<button type="button" class="btn-action w-100" style="background:#475569; padding:10px;" onclick="clearMatchConditions()">🔄 Reset to Original Match Rules</button>';

    showModal("📉 Revise Overs & Target (DLS / VJD)", html, saveMatchConditions, false, "420px", "Apply Revisions");
}

function saveMatchConditions() {
    var newOvers = parseFloat(el('modOvers').value);
    var newTarget = el('modTarget') && el('modTarget').value !== "" ? parseInt(el('modTarget').value, 10) : null;
    var newMethod = el('modMethod') ? el('modMethod').value.trim().toUpperCase() : "";

    if (!newOvers || newOvers <= 0) {
        alert("Please enter valid overs.");
        return;
    }

    saveState();
    state.matchSettings.maxOvers = newOvers;
    state.matchSettings.customTargetOvers = newOvers;
    state.matchSettings.bowlerQuota = Math.ceil(newOvers / 5);
    state.matchSettings.customTarget = (!isNaN(newTarget) && newTarget > 0) ? newTarget : null;
    state.matchSettings.targetMethod = newMethod;

    closeModal();
    updateUI();
}

function clearMatchConditions() {
    saveState();
    state.matchSettings.customTarget = null;
    state.matchSettings.customTargetOvers = null;
    state.matchSettings.targetMethod = "";
    state.matchSettings.maxOvers = state.matchSettings.originalMaxOvers || 20;
    state.matchSettings.bowlerQuota = Math.ceil(state.matchSettings.maxOvers / 5);

    closeModal();
    updateUI();
}

// ==========================================
// 🛠️ SUPERFIX DIRECT SCORECARD & FOW EDITOR
// ==========================================

function openFoWModal() {
    openSuperfixModal('current', false, 'fow');
}

function openSuperfixModal(targetKey, fromSummary, scrollToSection) {
    if (typeof targetKey === 'undefined') targetKey = 'current';
    if (typeof fromSummary === 'undefined') fromSummary = false;
    if (typeof scrollToSection === 'undefined') scrollToSection = '';

    deduplicateInningsSummaries();
    superfixOpenedFromSummary = fromSummary;

    var optionsHtml = '<option value="current" ' + (targetKey === 'current' ? 'selected' : '') + '>🔴 Current Live Innings (Inn ' + state.inningsNum + ': ' + getBatTeam().name + ')</option>';
    state.inningsSummaries.forEach(function(inn, idx) {
        if (inn.innNum !== state.inningsNum) {
            var sel = (String(targetKey) === String(idx)) ? 'selected' : '';
            optionsHtml += '<option value="' + idx + '" ' + sel + '>✅ Completed Innings ' + inn.innNum + ': ' + inn.batTeam + ' (' + inn.runs + '/' + inn.wkts + ')</option>';
        }
    });

    var html = '<div style="background:rgba(124,58,237,0.15); border:1px solid #7c3aed; padding:10px 12px; border-radius:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">' +
        '<div style="flex:1; min-width:220px;">' +
        '<label style="color:#c4b5fd; font-size:0.7rem;">SELECT INNINGS TO EDIT</label>' +
        '<select id="sf-innings-select" class="modal-input w-100" style="margin-bottom:0; margin-top:4px; font-weight:bold;" onchange="renderSuperfixBody(this.value)">' +
        optionsHtml +
        '</select>' +
        '</div>' +
        '<button type="button" onclick="superfixAutoSum()" class="btn-action" style="width:auto; padding:10px 14px; background:#0284c7; font-size:0.8rem;">🧮 Auto-Sum Total from Players</button>' +
        '</div>' +
        '<div id="sf-editor-body" class="custom-scroll" style="max-height:60vh; overflow-y:auto; padding-right:6px;"></div>';

    showModal("🛠️ SUPERFIX: Direct Scorecard & FoW Editor", html, saveSuperfixChanges, false, "850px", "💾 Save Superfix & Sync");
    el('modalCancelBtn').onclick = function() {
        closeModal();
        if (superfixOpenedFromSummary) setTimeout(showMatchSummary, 100);
    };

    renderSuperfixBody(String(targetKey));

    if (scrollToSection === 'fow') {
        setTimeout(function() {
            var fowEl = document.getElementById('sf-fow-section');
            if (fowEl) fowEl.scrollIntoView({ behavior: 'smooth' });
        }, 150);
    }
}

function getSuperfixTargetData(targetKey) {
    if (targetKey === 'current') {
        return {
            isCurrent: true,
            innNum: state.inningsNum,
            batTeamName: getBatTeam().name,
            bowlTeamName: getBowlTeam().name,
            runs: state.current.runs,
            wkts: state.current.wkts,
            overs: getTeamOversDisplay(),
            penalties: state.current.penalties || 0,
            extras: state.current.extras || { w: 0, nb: 0, b: 0, lb: 0 },
            batters: getBatTeam().players,
            bowlers: getBowlTeam().players,
            fow: state.current.fow || []
        };
    } else {
        var idx = parseInt(targetKey, 10);
        var inn = state.inningsSummaries[idx];
        return {
            isCurrent: false,
            summaryIdx: idx,
            innNum: inn.innNum,
            batTeamName: inn.batTeam,
            bowlTeamName: inn.bowlTeam,
            runs: inn.runs,
            wkts: inn.wkts,
            overs: inn.overs,
            penalties: inn.penalties || 0,
            extras: inn.extras || { w: 0, nb: 0, b: 0, lb: 0 },
            batters: inn.batters,
            bowlers: inn.bowlers,
            fow: inn.fow || []
        };
    }
}

function renderSuperfixBody(targetKey) {
    var data = getSuperfixTargetData(targetKey);
    var container = el('sf-editor-body');
    if (!container) return;

    var esc = function(str) { return String(str || '').replace(/"/g, '&quot;'); };

    var html = '<div style="background:rgba(0,0,0,0.3); border:1px solid #334155; border-radius:8px; padding:12px; margin-bottom:15px;">' +
        '<div style="color:#38bdf8; font-weight:bold; font-size:0.85rem; margin-bottom:8px;">📊 TEAM TOTAL & EXTRAS (' + data.batTeamName + ')</div>' +
        '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(85px, 1fr)); gap:8px;">' +
        '<div><label>Total Runs</label><input type="number" id="sf-total-runs" value="' + data.runs + '" class="w-100" style="padding:6px;"></div>' +
        '<div><label>Wickets</label><input type="number" id="sf-total-wkts" value="' + data.wkts + '" min="0" max="10" class="w-100" style="padding:6px;"></div>' +
        '<div><label>Overs (e.g. 16.2)</label><input type="text" id="sf-total-overs" value="' + data.overs + '" class="w-100" style="padding:6px;"></div>' +
        '<div><label>Wides (W)</label><input type="number" id="sf-ex-w" value="' + (data.extras.w || 0) + '" class="w-100" style="padding:6px;"></div>' +
        '<div><label>No Balls (NB)</label><input type="number" id="sf-ex-nb" value="' + (data.extras.nb || 0) + '" class="w-100" style="padding:6px;"></div>' +
        '<div><label>Byes (B)</label><input type="number" id="sf-ex-b" value="' + (data.extras.b || 0) + '" class="w-100" style="padding:6px;"></div>' +
        '<div><label>Leg Byes (LB)</label><input type="number" id="sf-ex-lb" value="' + (data.extras.lb || 0) + '" class="w-100" style="padding:6px;"></div>' +
        '<div><label>Penalties</label><input type="number" id="sf-penalties" value="' + (data.penalties || 0) + '" class="w-100" style="padding:6px;"></div>' +
        '</div></div>';

    html += '<div style="background:rgba(0,0,0,0.3); border:1px solid #334155; border-radius:8px; padding:12px; margin-bottom:15px; overflow-x:auto;">' +
        '<div style="color:#10b981; font-weight:bold; font-size:0.85rem; margin-bottom:8px;">🏏 BATTING SCORECARD (' + data.batTeamName + ')</div>' +
        '<table class="scorecard-table" style="min-width:680px; margin-bottom:0;">' +
        '<thead class="bat-hdr"><tr><th style="width:7%;">Batted</th><th style="width:22%;">Batter Name</th><th style="width:16%;">Status</th><th style="width:27%;">Dismissal Text</th><th style="width:7%;">R</th><th style="width:7%;">B</th><th style="width:7%;">4s</th><th style="width:7%;">6s</th></tr></thead><tbody>';

    data.batters.forEach(function(p, i) {
        var statusVal = p.out === 'retiredHurt' ? 'retiredHurt' : (p.out ? 'out' : 'notOut');
        html += '<tr>' +
            '<td style="text-align:center;"><input type="checkbox" id="sf-bat-hb-' + i + '" ' + (p.hasBatted ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;"></td>' +
            '<td><input type="text" id="sf-bat-name-' + i + '" value="' + esc(p.name) + '" class="w-100" style="padding:5px; font-size:0.8rem;"></td>' +
            '<td><select id="sf-bat-out-' + i + '" class="w-100" style="padding:5px; font-size:0.75rem;" onchange="if(this.value!==\'notOut\') document.getElementById(\'sf-bat-hb-' + i + '\').checked=true;">' +
            '<option value="notOut" ' + (statusVal === 'notOut' ? 'selected' : '') + '>Not Out</option>' +
            '<option value="out" ' + (statusVal === 'out' ? 'selected' : '') + '>Out</option>' +
            '<option value="retiredHurt" ' + (statusVal === 'retiredHurt' ? 'selected' : '') + '>Retired Hurt</option>' +
            '</select></td>' +
            '<td><input type="text" id="sf-bat-dism-' + i + '" value="' + esc(p.dismissalInfo) + '" placeholder="e.g. c Rahul b Arif" class="w-100" style="padding:5px; font-size:0.75rem;"></td>' +
            '<td><input type="number" id="sf-bat-r-' + i + '" value="' + (p.r || 0) + '" min="0" class="w-100" style="padding:5px; text-align:center;" oninput="if(this.value>0) document.getElementById(\'sf-bat-hb-' + i + '\').checked=true;"></td>' +
            '<td><input type="number" id="sf-bat-b-' + i + '" value="' + (p.b || 0) + '" min="0" class="w-100" style="padding:5px; text-align:center;" oninput="if(this.value>0) document.getElementById(\'sf-bat-hb-' + i + '\').checked=true;"></td>' +
            '<td><input type="number" id="sf-bat-f-' + i + '" value="' + (p.f || 0) + '" min="0" class="w-100" style="padding:5px; text-align:center;"></td>' +
            '<td><input type="number" id="sf-bat-s-' + i + '" value="' + (p.s || 0) + '" min="0" class="w-100" style="padding:5px; text-align:center;"></td>' +
            '</tr>';
    });

    html += '</tbody></table></div>';

    html += '<div style="background:rgba(0,0,0,0.3); border:1px solid #334155; border-radius:8px; padding:12px; margin-bottom:15px; overflow-x:auto;">' +
        '<div style="color:#f87171; font-weight:bold; font-size:0.85rem; margin-bottom:8px;">⚾ BOWLING SCORECARD (' + data.bowlTeamName + ')</div>' +
        '<table class="scorecard-table" style="min-width:680px; margin-bottom:0;">' +
        '<thead class="bwl-hdr"><tr><th style="width:28%;">Bowler Name</th><th style="width:10%;">Overs (e.g. 3.2)</th><th style="width:8%;">M</th><th style="width:10%;">Runs (R)</th><th style="width:8%;">Wkts (W)</th><th style="width:9%;">WD</th><th style="width:9%;">NB</th><th style="width:9%;">Byes</th><th style="width:9%;">L-Byes</th></tr></thead><tbody>';

    data.bowlers.forEach(function(p, i) {
        var ovDisp = formatOver(p.o || 0);
        html += '<tr>' +
            '<td><input type="text" id="sf-bwl-name-' + i + '" value="' + esc(p.name) + '" class="w-100" style="padding:5px; font-size:0.8rem;"></td>' +
            '<td><input type="text" id="sf-bwl-o-' + i + '" value="' + ovDisp + '" class="w-100" style="padding:5px; text-align:center;"></td>' +
            '<td><input type="number" id="sf-bwl-m-' + i + '" value="' + (p.m || 0) + '" min="0" class="w-100" style="padding:5px; text-align:center;"></td>' +
            '<td><input type="number" id="sf-bwl-rc-' + i + '" value="' + (p.rc || 0) + '" min="0" class="w-100" style="padding:5px; text-align:center;"></td>' +
            '<td><input type="number" id="sf-bwl-w-' + i + '" value="' + (p.w || 0) + '" min="0" class="w-100" style="padding:5px; text-align:center;"></td>' +
            '<td><input type="number" id="sf-bwl-wd-' + i + '" value="' + (p.wd || 0) + '" min="0" class="w-100" style="padding:5px; text-align:center;"></td>' +
            '<td><input type="number" id="sf-bwl-nb-' + i + '" value="' + (p.nb || 0) + '" min="0" class="w-100" style="padding:5px; text-align:center;"></td>' +
            '<td><input type="number" id="sf-bwl-b-' + i + '" value="' + (p.byes || 0) + '" min="0" class="w-100" style="padding:5px; text-align:center;"></td>' +
            '<td><input type="number" id="sf-bwl-lb-' + i + '" value="' + (p.legbyes || 0) + '" min="0" class="w-100" style="padding:5px; text-align:center;"></td>' +
            '</tr>';
    });

    html += '</tbody></table></div>';

    html += '<div id="sf-fow-section" style="background:rgba(0,0,0,0.3); border:1px solid #f59e0b; border-radius:8px; padding:12px; margin-bottom:10px; overflow-x:auto;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
        '<span style="color:#f59e0b; font-weight:bold; font-size:0.85rem;">📉 FALL OF WICKETS (FoW)</span>' +
        '<button type="button" onclick="addSuperfixFoWRow()" class="btn-action" style="width:auto; padding:5px 12px; background:#10b981; font-size:0.75rem;">+ Add Wicket</button>' +
        '</div>' +
        '<table class="scorecard-table" style="min-width:650px; margin-bottom:0;">' +
        '<thead><tr style="background:rgba(245,158,11,0.15); color:#fbbf24;"><th style="width:9%;">Wkt #</th><th style="width:12%;">Team Runs</th><th style="width:12%;">Over (e.g. 4.2)</th><th style="width:24%;">Batter Out</th><th style="width:21%;">Partner</th><th style="width:8%;">P\'ship R</th><th style="width:8%;">P\'ship B</th><th style="width:6%;">Del</th></tr></thead>' +
        '<tbody id="sf-fow-tbody"></tbody></table></div>';

    container.innerHTML = html;

    var cleanFow = (data.fow || []).filter(function(f) { return f.wktNum !== 'Unbroken'; });
    cleanFow.forEach(function(f) { addSuperfixFoWRow(f); });
}

function addSuperfixFoWRow(fowObj) {
    var tbody = el('sf-fow-tbody');
    if (!tbody) return;
    var rowCount = tbody.children.length + 1;
    var f = fowObj || { wktNum: rowCount, runs: 0, overs: "0.0", outBatter: "", partner: "", pRuns: 0, pBalls: 0 };
    var esc = function(str) { return String(str || '').replace(/"/g, '&quot;'); };

    var tr = document.createElement('tr');
    tr.className = 'sf-fow-row';
    tr.innerHTML = '<td><input type="number" class="sf-fow-num w-100" value="' + f.wktNum + '" style="padding:5px; text-align:center;"></td>' +
        '<td><input type="number" class="sf-fow-runs w-100" value="' + f.runs + '" style="padding:5px; text-align:center;"></td>' +
        '<td><input type="text" class="sf-fow-overs w-100" value="' + esc(f.overs) + '" style="padding:5px; text-align:center;"></td>' +
        '<td><input type="text" class="sf-fow-out w-100" value="' + esc(f.outBatter) + '" placeholder="Batter Out" style="padding:5px;"></td>' +
        '<td><input type="text" class="sf-fow-part w-100" value="' + esc(f.partner) + '" placeholder="Partner" style="padding:5px;"></td>' +
        '<td><input type="number" class="sf-fow-pr w-100" value="' + (f.pRuns || 0) + '" style="padding:5px; text-align:center;"></td>' +
        '<td><input type="number" class="sf-fow-pb w-100" value="' + (f.pBalls || 0) + '" style="padding:5px; text-align:center;"></td>' +
        '<td style="text-align:center;"><button type="button" onclick="this.closest(\'tr\').remove()" style="background:#ef4444; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-weight:bold;">✕</button></td>';
    tbody.appendChild(tr);
}

function superfixAutoSum() {
    var targetKey = el('sf-innings-select').value;
    var data = getSuperfixTargetData(targetKey);
    var batRuns = 0;
    var wktsCount = 0;

    data.batters.forEach(function(_, i) {
        var r = parseInt(el('sf-bat-r-' + i).value, 10) || 0;
        var outState = el('sf-bat-out-' + i).value;
        batRuns += r;
        if (outState === 'out') wktsCount++;
    });

    var exW = parseInt(el('sf-ex-w').value, 10) || 0;
    var exNB = parseInt(el('sf-ex-nb').value, 10) || 0;
    var exB = parseInt(el('sf-ex-b').value, 10) || 0;
    var exLB = parseInt(el('sf-ex-lb').value, 10) || 0;
    var pen = parseInt(el('sf-penalties').value, 10) || 0;

    el('sf-total-runs').value = batRuns + exW + exNB + exB + exLB + pen;
    el('sf-total-wkts').value = wktsCount;
}

function saveSuperfixChanges() {
    saveState();
    var targetKey = el('sf-innings-select').value;
    var data = getSuperfixTargetData(targetKey);

    var newRuns = parseInt(el('sf-total-runs').value, 10) || 0;
    var newWkts = parseInt(el('sf-total-wkts').value, 10) || 0;
    var newOversStr = el('sf-total-overs').value.trim() || "0.0";
    var newPen = parseInt(el('sf-penalties').value, 10) || 0;
    var newExtras = {
        w: parseInt(el('sf-ex-w').value, 10) || 0,
        nb: parseInt(el('sf-ex-nb').value, 10) || 0,
        b: parseInt(el('sf-ex-b').value, 10) || 0,
        lb: parseInt(el('sf-ex-lb').value, 10) || 0
    };

    data.batters.forEach(function(p, i) {
        p.hasBatted = el('sf-bat-hb-' + i).checked;
        p.name = el('sf-bat-name-' + i).value.trim() || p.name;
        var outVal = el('sf-bat-out-' + i).value;
        p.out = (outVal === 'retiredHurt') ? 'retiredHurt' : (outVal === 'out');
        p.dismissalInfo = el('sf-bat-dism-' + i).value.trim();
        p.r = parseInt(el('sf-bat-r-' + i).value, 10) || 0;
        p.b = parseInt(el('sf-bat-b-' + i).value, 10) || 0;
        p.f = parseInt(el('sf-bat-f-' + i).value, 10) || 0;
        p.s = parseInt(el('sf-bat-s-' + i).value, 10) || 0;
        p.outOnDuck = (p.out === true && p.r === 0) ? 1 : 0;
    });

    data.bowlers.forEach(function(p, i) {
        p.name = el('sf-bwl-name-' + i).value.trim() || p.name;
        var bBalls = oversToBalls(el('sf-bwl-o-' + i).value);
        p.o = bBalls;
        p.quotaOvers = Math.floor(bBalls / 6);
        p.m = parseInt(el('sf-bwl-m-' + i).value, 10) || 0;
        p.rc = parseInt(el('sf-bwl-rc-' + i).value, 10) || 0;
        p.w = parseInt(el('sf-bwl-w-' + i).value, 10) || 0;
        p.wd = parseInt(el('sf-bwl-wd-' + i).value, 10) || 0;
        p.nb = parseInt(el('sf-bwl-nb-' + i).value, 10) || 0;
        p.byes = parseInt(el('sf-bwl-b-' + i).value, 10) || 0;
        p.legbyes = parseInt(el('sf-bwl-lb-' + i).value, 10) || 0;
    });

    var newFow = [];
    document.querySelectorAll('#sf-fow-tbody .sf-fow-row').forEach(function(row, idx) {
        newFow.push({
            wktNum: parseInt(row.querySelector('.sf-fow-num').value, 10) || (idx + 1),
            runs: parseInt(row.querySelector('.sf-fow-runs').value, 10) || 0,
            overs: row.querySelector('.sf-fow-overs').value.trim() || "0.0",
            outBatter: row.querySelector('.sf-fow-out').value.trim() || "Unknown",
            partner: row.querySelector('.sf-fow-part').value.trim() || "-",
            pRuns: parseInt(row.querySelector('.sf-fow-pr').value, 10) || 0,
            pBalls: parseInt(row.querySelector('.sf-fow-pb').value, 10) || 0
        });
    });

    if (data.isCurrent) {
        var oldOversDisp = getTeamOversDisplay();
        state.current.runs = newRuns;
        state.current.wkts = newWkts;
        state.current.penalties = newPen;
        state.current.extras = newExtras;
        state.current.fow = newFow;

        if (newOversStr !== oldOversDisp) {
            var totalBalls = oversToBalls(newOversStr);
            var targetCompOvers = Math.floor(totalBalls / 6);
            var remBalls = totalBalls % 6;
            state.current.balls = totalBalls;

            while (state.current.overHistory.length > targetCompOvers) {
                state.current.overHistory.pop();
            }
            while (state.current.overHistory.length < targetCompOvers) {
                var ovNum = state.current.overHistory.length + 1;
                state.current.overHistory.push({
                    over: ovNum,
                    runs: state.current.runs,
                    wkts: state.current.wkts,
                    totalBallsAtEnd: ovNum * 6,
                    isPartialTerminal: false
                });
            }
            if (state.current.overHistory.length > 0) {
                state.current.overHistory[state.current.overHistory.length - 1].totalBallsAtEnd = totalBalls - remBalls;
            }
        }

        var existingCurrIdx = state.inningsSummaries.findIndex(function(inn) { return inn.innNum === state.inningsNum; });
        if (existingCurrIdx !== -1) {
            var sInnCurr = state.inningsSummaries[existingCurrIdx];
            sInnCurr.runs = newRuns;
            sInnCurr.wkts = newWkts;
            sInnCurr.overs = newOversStr;
            sInnCurr.penalties = newPen;
            sInnCurr.extras = JSON.parse(JSON.stringify(newExtras));
            sInnCurr.batters = JSON.parse(JSON.stringify(getBatTeam().players));
            sInnCurr.bowlers = JSON.parse(JSON.stringify(getBowlTeam().players));
            sInnCurr.fow = JSON.parse(JSON.stringify(newFow));
        }
    } else {
        var sInn = state.inningsSummaries[data.summaryIdx];
        sInn.runs = newRuns;
        sInn.wkts = newWkts;
        sInn.overs = newOversStr;
        sInn.penalties = newPen;
        sInn.extras = newExtras;
        sInn.fow = newFow;
    }

    closeModal();
    updateUI();

    if (superfixOpenedFromSummary) {
        setTimeout(showMatchSummary, 150);
    }
}


// ==========================================
// 🔥 NEW: MULTI-DAY MANUAL MATCH END LOGIC
// ==========================================

function initiateManualMatchEnd() {
    let defaultResultText = "Match drawn by mutual agreement";
    
    let totalA = 0; let totalB = 0;
    if (state.inningsSummaries) {
        state.inningsSummaries.forEach(function(summary) {
            if (summary.batTeam === state.teams.A.name) totalA += (summary.runs || 0);
            if (summary.batTeam === state.teams.B.name) totalB += (summary.runs || 0);
        });
    }
    if (state.current.batTeam === state.teams.A.name) totalA += state.current.runs;
    if (state.current.batTeam === state.teams.B.name) totalB += state.current.runs;

    if (totalA > totalB) {
        defaultResultText = `Match drawn. ${state.teams.A.name} lead by ${totalA - totalB} runs.`;
    } else if (totalB > totalA) {
        defaultResultText = `Match drawn. ${state.teams.B.name} lead by ${totalB - totalA} runs.`;
    } else {
        defaultResultText = "Match drawn. Scores level.";
    }

    var html = '<p style="font-size:0.85rem; color:#94a3b8; margin-bottom:15px;">' +
        'You are about to permanently close this match. Edit the result text below as needed for the Fan Portal:' +
        '</p>' +
        '<label style="display:block; text-align:left; color:#cbd5e1; font-size:0.85rem; font-weight:bold; margin-bottom:5px;">Official Result Text:</label>' +
        '<textarea id="manual-result-input" class="modal-input w-100" rows="3" style="resize:none;">' + defaultResultText + '</textarea>' +
        '<p style="font-size:0.75rem; color:#f59e0b; margin-top:15px; text-align:center;">' +
        '⚠️ Warning: Once confirmed, the engine will lock permanently.' +
        '</p>';

    showModal("🛑 End Match Manually", html, confirmManualMatchEnd, false, "450px", "END MATCH & SAVE TO CLOUD");
    var confirmBtn = el('modalConfirmBtn');
    if (confirmBtn) confirmBtn.style.background = "#ef4444";
}

async function confirmManualMatchEnd() {
    var inputEl = el('manual-result-input');
    var finalResultText = inputEl ? inputEl.value.trim() : "Match Drawn";
    if (!finalResultText) {
        alert("You must enter a result text.");
        return;
    }

    var confirmBtn = el('modalConfirmBtn');
    if (confirmBtn) {
        confirmBtn.innerText = "Syncing to Cloud...";
        confirmBtn.disabled = true;
    }

    deduplicateInningsSummaries();
    var fps = buildFanPortalSummary();
    fps.result = finalResultText;

    state.match_status = "completed";
    state.matchResult = finalResultText;

    var finalState = JSON.parse(JSON.stringify(state, function(key, value) {
        return value instanceof Set ? Array.from(value) : value;
    }));
    finalState.match_status = 'completed';
    finalState.team1 = state.teams.A.name;
    finalState.team2 = state.teams.B.name;
    finalState.fan_portal_summary = fps;

    try {
        await db.from('matches').update({ full_state: finalState }).eq('match_id', state.matchId);

        var completedPayload = { inningsSummaries: state.inningsSummaries, fan_portal_summary: fps };
        await db.from('completed_matches').upsert({ match_id: state.matchId, final_data: JSON.stringify(completedPayload) }, { onConflict: 'match_id' });
        
        await db.from('live_matches').delete().eq('match_id', state.matchId);

        if (typeof logCareerStats === 'function') {
            await logCareerStats();
        }

        closeModal();
        alert("✅ Match Successfully Ended & Saved!");
        window.location.reload();

    } catch (e) {
        alert("Error saving match result: " + e.message);
        if (confirmBtn) {
            confirmBtn.innerText = "END MATCH & SAVE TO CLOUD";
            confirmBtn.disabled = false;
        }
    }
}
