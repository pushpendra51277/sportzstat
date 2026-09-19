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

let activeMatch = null;
