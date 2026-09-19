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

function generateReportHTML(isExcel) {
    let css = `@media print { @page { size: A4 landscape; margin: 0.5in; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } } body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; background: #ffffff; padding: 20px; } table { border-collapse: collapse; width: 100%; font-size: 10pt; table-layout: auto; margin-bottom: 20px; page-break-inside: avoid; } tr { page-break-inside: avoid; page-break-after: auto; } th, td { border: 1px solid #d1d5db; padding: 6px; text-align: center; vertical-align: middle; color: #334155; } .main-header { background: #0f172a; color: #ffffff; font-size: 14pt; font-weight: bold; text-transform: uppercase; padding: 10px; } .sub-header { background: #f8fafc; color: #334155; font-size: 10pt; font-weight: bold; text-align: left; padding: 8px; } .inn-title { background: #1e293b; color: #fbbf24; font-size: 12pt; font-weight: bold; text-align: left; padding: 8px; } .bat-th, .bwl-th { background: #f1f5f9; color: #334155; font-weight: bold; } .text-left { text-align: left; padding-left: 10px; } .text-right { text-align: right; padding-right: 10px; } .bold { font-weight: bold; } .extra-row { background: #f1f5f9; font-weight: bold; color: #334155; border-top: 2px solid #94a3b8; } .fow-row { background: #fafafa; font-size: 9pt; color: #475569; text-align: left; padding: 10px; }`;
    let html = ``;
    if (isExcel) { html += `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>${css}</style></head><body><div align="center">`; } 
    else { html += `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Match Report PDF</title><style>${css}</style></head><body><div align="center">`; }

    let res = state.matchResult || calculateResultText() || "Match in Progress"; let mId = state.matchId || "N/A"; 
    
    // 🔥 FIX: Ensures PDF exports explicitly pull from Relational data instead of old JSON string
    let tourn = (activeMatch && activeMatch.tournaments && activeMatch.tournaments.name) ? activeMatch.tournaments.name : (activeMatch && activeMatch.full_state && activeMatch.full_state.tournament ? activeMatch.full_state.tournament : "Independent Match");
    let date = new Date().toLocaleDateString();
    
    html += `<table><tr><th colspan="11" class="main-header">SPORTZSTAT OFFICIAL MATCH REPORT</th></tr><tr><td colspan="5" class="sub-header">🏆 Tournament: ${tourn}</td><td colspan="6" class="sub-header text-right">Match ID: ${mId}</td></tr><tr><td colspan="5" class="sub-header">📅 Date: ${date}</td><td colspan="6" class="sub-header text-right" style="color:#2563eb;">🏁 Result: ${res}</td></tr></table>`;

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
            let totalRuns = p.rc || 0; 
            let e = p.o > 0 ? ((totalRuns / p.o) * 6).toFixed(2) : "0.00"; 
            let dName = p.name + (p.desig === 'C' || p.desig === 'C/WK' ? ' (C)' : '') + (p.skill && p.skill.includes('WK') ? ' *' : ''); let exStr = `${p.byes||0}b, ${p.legbyes||0}lb`; let noBalls = p.nb || 0; let wides = p.wd || 0; let totalExtras = (p.wd || 0) + (p.nb || 0) + (p.byes || 0) + (p.legbyes || 0); 
            let bBalls = p.o || 0; 
            
            sumBalls += bBalls; sumM += p.m || 0; sumR += totalRuns; sumW += p.w || 0; sumB += p.byes || 0; sumLB += p.legbyes || 0; sumNB += noBalls; sumWD += wides; sumTotEx += totalExtras; 
            html += `<tr><td colspan="3" class="text-left bold">${dName}</td><td>${formatOver(p.o)}</td><td>${p.m}</td><td>${totalRuns}</td><td class="bold" style="color:#991b1b;">${p.w}</td><td>${e}</td><td style="font-size:8pt;">${exStr}</td><td>${noBalls}</td><td>${wides}</td></tr>`; 
        });
        
        let sumOvers = formatOver(sumBalls); let sumEcon = sumBalls > 0 ? ((sumR / sumBalls) * 6).toFixed(2) : "0.00"; let totalRunsWithByes = sumR + sumB + sumLB; let sumExStr = `${sumB}b, ${sumLB}lb`;
        html += `<tr class="extra-row"><td colspan="3" class="text-right">TOTAL</td><td>${sumOvers}</td><td>${sumM}</td><td>${totalRunsWithByes}</td><td style="color:#991b1b;">${sumW}</td><td>${sumEcon}</td><td style="font-size:8pt;">${sumExStr}</td><td>${sumNB}</td><td>${sumWD}</td></tr>`;
        
        if (inn.fow && inn.fow.length > 0) { let fowStr = inn.fow.map(f => `<b>${f.runs}/${f.wktNum==='Unbroken'?'*':f.wktNum}</b> (${f.outBatter}, ${f.overs} ov)`).join(' | '); html += `<tr><td colspan="11" class="fow-row"><b>Fall of Wickets:</b> ${fowStr}</td></tr>`; }
        html += `</table>`;
    });

    html += `<table><tr><th colspan="11" class="main-header" style="font-size:11pt; background:#334155;">MATCH LOGS</th></tr>`;
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
    let blob = new Blob([html], { type: 'application/vnd.ms-excel' }); let url = URL.createObjectURL(blob); let a = document.createElement('a'); a.style.display = 'none'; a.href = url; a.download = `Sportzstat_Match_Report.xls`; document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
}

function downloadSummaryPDF() {
    prepAllowancesForExport(); let html = generateReportHTML(false);
    let printWin = window.open('', '_blank'); printWin.document.write(html); printWin.document.close(); printWin.focus(); setTimeout(() => { printWin.print(); printWin.close(); }, 500);
}
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
    let tournName = activeMatch && activeMatch.full_state ? activeMatch.full_state.tournament : "OFFICIAL MATCH CARD";
    
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
