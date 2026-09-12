const SUPABASE_URL = "https://cavkoylkbcyhsifrsjyd.supabase.co";   
const SUPABASE_KEY = "sb_publishable_wklRlSZbzArKFCq31Ugnrw_JWAJkS4K"; 

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let globalTeams = [];
let globalTournaments = [];

// BOOT THE ADMIN PANEL
window.onload = async function() {
    await fetchDropdownData();
};

async function fetchDropdownData() {
    // Fetch Tournaments
    const { data: tData, error: tErr } = await supabase.from('tournaments').select('tournament_id, name');
    if (tData) {
        globalTournaments = tData;
        const selT = document.getElementById('selTournament');
        selT.innerHTML = tData.map(t => `<option value="${t.tournament_id}">${t.name}</option>`).join('');
    }

    // Fetch Teams
    const { data: teamData, error: teamErr } = await supabase.from('teams').select('team_id, name');
    if (teamData) {
        globalTeams = teamData;
        const opts = teamData.map(t => `<option value="${t.team_id}" data-name="${t.name}">${t.name}</option>`).join('');
        document.getElementById('selTeamA').innerHTML = opts;
        document.getElementById('selTeamB').innerHTML = opts;
        // Make Team B select the second option by default
        if(teamData.length > 1) document.getElementById('selTeamB').selectedIndex = 1;
    }
}

async function loadRosters() {
    const teamA = document.getElementById('selTeamA');
    const teamB = document.getElementById('selTeamB');
    
    if (teamA.value === teamB.value) {
        alert("Team A and Team B must be different!");
        return;
    }

    const tAName = teamA.options[teamA.selectedIndex].dataset.name;
    const tBName = teamB.options[teamB.selectedIndex].dataset.name;

    document.getElementById('labelTeamA').innerText = tAName;
    document.getElementById('labelTeamB').innerText = tBName;

    // Fetch Players from team_rosters using team_name
    await populateRosterList('A', tAName);
    await populateRosterList('B', tBName);

    document.getElementById('rosterSelectionBox').classList.remove('hidden');
    document.getElementById('matchCreationBox').classList.remove('hidden');
}

async function populateRosterList(teamKey, teamName) {
    const listEl = document.getElementById(`listTeamA`);
    const targetEl = document.getElementById(`listTeam${teamKey}`);
    
    const { data, error } = await supabase
        .from('team_rosters')
        .select('player_id, players(full_name)')
        .eq('team_name', teamName);

    if (error || !data || data.length === 0) {
        targetEl.innerHTML = `<div style="color: #ef4444; font-size: 0.85rem;">No players found in master roster for ${teamName}.</div>`;
        return;
    }

    let html = "";
    data.forEach(row => {
        if(row.players) {
            html += `
            <label style="display: flex; align-items: center; background: #0f172a; padding: 10px; border-radius: 4px; cursor: pointer; border: 1px solid #334155;">
                <input type="checkbox" class="chk-squad-${teamKey}" value="${row.player_id}" checked style="width: 16px; height: 16px; margin-right: 10px;">
                <span style="color: white;">${row.players.full_name}</span>
            </label>`;
        }
    });
    targetEl.innerHTML = html;
}

async function createMatch() {
    const statusEl = document.getElementById('statusMessage');
    statusEl.innerHTML = '<span style="color:#f59e0b;">⏳ Processing Database Injection...</span>';

    const tournId = document.getElementById('selTournament').value;
    const teamAId = document.getElementById('selTeamA').value;
    const teamBId = document.getElementById('selTeamB').value;
    const pin = document.getElementById('matchPin').value;
    const venue = document.getElementById('matchVenue').value || "Official Ground";
    
    const tournName = document.getElementById('selTournament').options[document.getElementById('selTournament').selectedIndex].text;
    const teamAName = document.getElementById('selTeamA').options[document.getElementById('selTeamA').selectedIndex].dataset.name;
    const teamBName = document.getElementById('selTeamB').options[document.getElementById('selTeamB').selectedIndex].dataset.name;

    // Generate unique Match ID like M-AB12C
    const matchId = "M-" + Math.random().toString(36).substring(2, 7).toUpperCase();

    // 1. Gather Selected Players
    const selectedA = Array.from(document.querySelectorAll('.chk-squad-A:checked')).map(cb => cb.value);
    const selectedB = Array.from(document.querySelectorAll('.chk-squad-B:checked')).map(cb => cb.value);

    if(selectedA.length === 0 || selectedB.length === 0) {
        statusEl.innerHTML = '<span style="color:#ef4444;">❌ Error: Select at least 1 player per team to form the squad.</span>';
        return;
    }

    // 2. Prepare tournament_squads Payload
    const squadsPayload = [];
    selectedA.forEach(pid => {
        squadsPayload.push({ tournament_id: tournId, team_id: teamAId, player_id: pid });
    });
    selectedB.forEach(pid => {
        squadsPayload.push({ tournament_id: tournId, team_id: teamBId, player_id: pid });
    });

    // Inject into tournament_squads
    const { error: squadErr } = await supabase.from('tournament_squads').insert(squadsPayload);
    if(squadErr) {
        console.error(squadErr);
        statusEl.innerHTML = '<span style="color:#ef4444;">❌ Error injecting squads. Check console.</span>';
        return;
    }

    // 3. Prepare Matches Payload
    const matchPayload = {
        match_id: matchId,
        tournament_id: tournId,
        team_a_id: teamAId,
        team_b_id: teamBId,
        scorer_pin: pin,
        full_state: {
            tournament: tournName,
            team1: teamAName,
            team2: teamBName,
            venue: venue
        }
    };

    // Inject into matches
    const { error: matchErr } = await supabase.from('matches').insert([matchPayload]);
    if(matchErr) {
        console.error(matchErr);
        statusEl.innerHTML = '<span style="color:#ef4444;">❌ Error creating match. Check console.</span>';
        return;
    }

    // Success!
    statusEl.innerHTML = `
        <span style="color:#10b981;">✅ SUCCESS! Database Injected.</span><br><br>
        <div style="background:#020617; padding:20px; border-radius:8px; border:1px solid #10b981; display:inline-block; text-align:left;">
            <div style="color:#94a3b8; font-size:0.9rem;">Give these details to the scorer:</div>
            <div style="font-size:1.5rem; color:white; margin:10px 0;">MATCH ID: <b style="color:#38bdf8;">${matchId}</b></div>
            <div style="font-size:1.2rem; color:white;">PIN: <b style="color:#f59e0b;">${pin}</b></div>
        </div>
    `;
}
