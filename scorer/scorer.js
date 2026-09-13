/**
 * SPORTZSTAT CLOUD SCORING ENGINE
 * Phase 2: Foundation & Batter/Bowler Designation
 */

let matchData = {};

function initializeScoringEngine(syncedState) {
    console.log("🚀 Scoring Engine Booting Up...");
    
    // Load the official locked state from the Toss Screen
    matchData = syncedState;
    
    // Build the Initial Scoreboard UI dynamically
    const mount = document.getElementById('engine-mount');
    
    mount.innerHTML = `
        <div style="background:#1e293b; border:1px solid #334155; padding:20px; border-radius:8px; text-align:left;">
            <h3 style="color:#38bdf8; margin-top:0;">Match Initialization</h3>
            
            <div style="margin-bottom: 20px;">
                <label style="color:#94a3b8; font-weight:bold; font-size:0.85rem; display:block; margin-bottom:5px;">Select Batting Team</label>
                <select id="sel-batting-team" class="input-dark" onchange="populateActivePlayers()">
                    <option value="">-- Who won the toss & chose to bat? --</option>
                    <option value="A">${matchData.team1}</option>
                    <option value="B">${matchData.team2}</option>
                </select>
            </div>

            <div id="player-selection-zone" class="hidden" style="border-top:1px solid #334155; padding-top:20px; display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                <!-- Batting Team Selection -->
                <div style="background:#020617; padding:15px; border-radius:8px; border:1px solid #3b82f6;">
                    <h4 style="color:#3b82f6; margin-top:0; text-align:center;">Select Openers</h4>
                    <p style="font-size:0.75rem; color:#94a3b8; text-align:center; margin-bottom:15px;">Substitutes are strictly hidden from these lists.</p>
                    
                    <label style="color:#94a3b8; font-weight:bold; font-size:0.85rem; display:block; margin-bottom:5px;">Striker (On Strike)</label>
                    <select id="sel-striker" class="input-dark" style="margin-bottom:15px;"></select>
                    
                    <label style="color:#94a3b8; font-weight:bold; font-size:0.85rem; display:block; margin-bottom:5px;">Non-Striker</label>
                    <select id="sel-nonstriker" class="input-dark"></select>
                </div>

                <!-- Bowling Team Selection -->
                <div style="background:#020617; padding:15px; border-radius:8px; border:1px solid #10b981;">
                    <h4 style="color:#10b981; margin-top:0; text-align:center;">Select Opening Bowler</h4>
                    <p style="font-size:0.75rem; color:#94a3b8; text-align:center; margin-bottom:15px;">Substitutes are strictly hidden from these lists.</p>
                    
                    <label style="color:#94a3b8; font-weight:bold; font-size:0.85rem; display:block; margin-bottom:5px;">Bowler</label>
                    <select id="sel-bowler" class="input-dark"></select>
                </div>
            </div>
            
            <button id="btn-start-innings" class="btn-green hidden" style="margin-top:20px;" onclick="startInnings()">▶ Start Innings</button>
        </div>
    `;
}

function populateActivePlayers() {
    const batTeamCode = document.getElementById('sel-batting-team').value;
    const zone = document.getElementById('player-selection-zone');
    const btnStart = document.getElementById('btn-start-innings');

    if(!batTeamCode) {
        zone.classList.add('hidden');
        btnStart.classList.add('hidden');
        return;
    }

    zone.classList.remove('hidden');
    btnStart.classList.remove('hidden');

    // Determine who is batting and who is bowling
    let battingXI = batTeamCode === 'A' ? matchData.team_a_xi : matchData.team_b_xi;
    let bowlingXI = batTeamCode === 'A' ? matchData.team_b_xi : matchData.team_a_xi;

    // Generate HTML options purely from the XI (ignores Subs)
    let batOpts = '<option value="">-- Select Batter --</option>';
    battingXI.forEach(p => batOpts += `<option value="${p.id}">${p.name}</option>`);

    let bowlOpts = '<option value="">-- Select Bowler --</option>';
    bowlingXI.forEach(p => bowlOpts += `<option value="${p.id}">${p.name}</option>`);

    document.getElementById('sel-striker').innerHTML = batOpts;
    document.getElementById('sel-nonstriker').innerHTML = batOpts;
    document.getElementById('sel-bowler').innerHTML = bowlOpts;
}

function startInnings() {
    const s = document.getElementById('sel-striker').value;
    const ns = document.getElementById('sel-nonstriker').value;
    const b = document.getElementById('sel-bowler').value;

    if(!s || !ns || !b) {
        alert("You must select the Striker, Non-Striker, and Opening Bowler to begin.");
        return;
    }

    if(s === ns) {
        alert("Striker and Non-Striker cannot be the same person!");
        return;
    }

    alert("Innings Initialized Successfully! The Scorepad UI will be built here next.");
    // In Phase 3: We render the actual scoreboard dials and buttons!
}
