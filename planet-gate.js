// Beta 1.3 — planet gating. A planet's course opens through the campaign and the guardian of the planet before it,
// then an expedition cost is paid when the long-range scan starts (Credits, ore, crystals — on top of the scan's fuel
// and the old "verdiente Credits" threshold). The cost stays hidden ("???") until the guardian is beaten.
// Loaded after campaign-ui.js. No new save fields: the gate reads meta.campaign, the guardians and planetsUnlocked.
//
// Rules that never change: a planet that is unlocked stays unlocked (the gate only looks at locked planets), a scan
// that is already running finishes, the Sternen-Archiv still re-opens planets 1–4 after a Lichtzyklus, and
// Aurelia-Forge (no campaign, no guardian, out of scope) is never reachable through the scan.
//
// Glacies is gated by Orion's Feldzug + P.I.P.S. Beta 1.6: every outer world is gated by its predecessor's campaign
// (Pyra-9 by the Frostwacht, Mekhanos by the Glutwacht, Viridia by the Taktband). Their guardians are the climax of each
// world's story, with their own rewards, but not a travel requirement (guardian: null) — measured in M6: requiring them
// tied every next world to the previous world's deep economy. A planet that is already open stays open; the gate only
// reads locked planets.

const PLANET_GATES = {
  ice: { campaign: 'crystal', guardian: 'pips', guardianName: 'P.I.P.S.', cost: { credits: 3000, ore: 60, crystals: 3 } },
  // Beta 1.6 (M6): the expedition is paid on top of the old earned-Credits threshold; a quarter of it as the price keeps a
  // casual player's course within one session of saving (measured with tools/economy-sim.mjs)
  volcanic: { campaign: 'ice', guardian: null, cost: { credits: 10000, ore: 300, crystals: 5 } },
  machine: { campaign: 'volcanic', guardian: null, cost: { credits: 150000, ore: 1200, crystals: 8 } },
  verdant: { campaign: 'machine', guardian: null, cost: { credits: 4000000, ore: 5000, crystals: 12 } },
  forge: { never: true }
};
const GATE_COST_ICONS = { credits: '◈', ore: '⬡', crystals: '◆', alloys: '▰' };

// null = no gate (old rule); otherwise { never } or { open, campaignDone, guardianDone, waves, total, cost (null = hidden) }
function planetGate(index) {
  const planet = PLANETS[index],
    gate = planet && PLANET_GATES[planet.id];
  if (!gate || state.planetsUnlocked[index]) return null;
  if (gate.never) return { never: true, name: planet.name };
  if (!CAMPAIGN_FLAGS[gate.campaign]) return null;
  const total = CAMPAIGNS[gate.campaign].waves.length,
    waves = Math.min(total, campaignCleared(gate.campaign)),
    guardianDone = !gate.guardian || ['defeated', 'repaired'].includes(state.meta?.guardians?.[gate.guardian]?.stage),
    campaignDone = waves >= total;
  return { name: planet.name, campaign: gate.campaign, guardianName: gate.guardianName, waves, total, campaignDone, guardianDone, open: campaignDone && guardianDone, cost: (gate.guardian ? guardianDone : campaignDone) ? gate.cost : null };
}
// what the player has to do first (Orion: fend off the inspection; the others: break through the guardian's campaign)
function gateCampaignVerb(gate) {
  return gate.campaign === 'crystal' ? 'Wehre erst die Inspektion ab' : 'Durchbrich erst ' + gateCampaignTitle(gate);
}
function gateCampaignTitle(gate) {
  const title = CAMPAIGNS[gate.campaign]?.title || 'den Feldzug';
  return title.replace(/^Die /, 'die ').replace(/^Das /, 'das ');
}
function gateCostText(cost) {
  return Object.entries(cost)
    .map(([k, v]) => GATE_COST_ICONS[k] + ' ' + fmt(v))
    .join(' · ');
}
function gateCostMissing(cost) {
  const have = { credits: state.credits, ore: state.ore, crystals: state.crystals, alloys: state.alloys };
  return Object.entries(cost)
    .filter(([k, v]) => have[k] < v)
    .map(([k, v]) => GATE_COST_ICONS[k] + ' ' + fmt(v - have[k]));
}
function gateBlockText(gate) {
  if (gate.never) return 'Signal zu schwach – der Kurs nach ' + gate.name + ' ist noch nicht berechenbar.';
  if (!gate.campaignDone) return 'Kurs nach ' + gate.name + ' gesperrt: ' + gateCampaignVerb(gate) + ' (Feldzug ' + gate.waves + '/' + gate.total + ').';
  return 'Kurs nach ' + gate.name + ' gesperrt: ' + gate.guardianName + ' versperrt den Sprungkorridor.';
}
function nextPlanetIndex() {
  return PLANETS.findIndex((_, i) => !state.planetsUnlocked[i]);
}

// ----- the scan button: the gate first, then the expedition cost, then the old scan (fuel, threshold, timer) -----
const surveyClickBeforeGate = $('surveyButton').onclick;
$('surveyButton').onclick = e => {
  const target = nextPlanetIndex(),
    gate = target >= 0 ? planetGate(target) : null;
  if (!gate) return surveyClickBeforeGate(e);
  // the first long-range scan towards Glacies is the moment M.O.T.T.E. notices the colony (if the Frachtdock's
  // radio has not already caught P.I.P.S.): the warning starts the campaign, nothing is paid, no scan starts
  if (inspectionPending(gate)) {
    if (state.totalEarned < PLANETS[target].unlock) return surveyClickBeforeGate(e);
    startInspection('scan');
    return render();
  }
  if (gate.never || !gate.open) {
    feedback('deny', 'warning');
    return toast(gateBlockText(gate));
  }
  // the old checks decide first (no cost is taken for a scan the old rule would refuse)
  if (state.surveyEnd > Date.now() || state.totalEarned < PLANETS[target].unlock || state.fuel < scanFuelCost()) return surveyClickBeforeGate(e);
  const missing = gateCostMissing(gate.cost);
  if (missing.length) {
    feedback('deny', 'warning');
    return toast('Für die Expedition fehlen noch ' + missing.join(' · '));
  }
  state.credits -= gate.cost.credits || 0;
  state.ore -= gate.cost.ore || 0;
  state.crystals -= gate.cost.crystals || 0;
  state.alloys -= gate.cost.alloys || 0;
  surveyClickBeforeGate(e);
};

// ----- galaxy route, scan button and the objective tell the truth about the gate -----
function renderPlanetGate() {
  const target = nextPlanetIndex(),
    gate = target >= 0 ? planetGate(target) : null,
    survey = $('surveyButton');
  if (!gate || !survey) return;
  const surveyLeft = Math.max(0, state.surveyEnd - Date.now());
  if (inspectionPending(gate)) {
    // the scan works as a scan until M.O.T.T.E. answers it (the old threshold text stays below the threshold)
    if (state.totalEarned >= PLANETS[target].unlock && !surveyLeft) {
      survey.disabled = false;
      survey.textContent = 'LANGSTRECKENSCAN STARTEN · ' + gate.name.toUpperCase();
    }
    return;
  }
  if (gate.never) {
    survey.disabled = true;
    survey.textContent = 'SIGNAL ZU SCHWACH · ' + gate.name.toUpperCase();
  } else if (!gate.open) {
    survey.disabled = true;
    survey.textContent = '🔒 KURS GESPERRT · ' + (gate.campaignDone ? gate.guardianName : 'FELDZUG ' + gate.waves + '/' + gate.total);
  } else if (!surveyLeft && state.totalEarned >= PLANETS[target].unlock) {
    const missing = gateCostMissing(gate.cost);
    survey.disabled = survey.disabled || missing.length > 0;
    survey.textContent = 'EXPEDITION STARTEN · ' + gateCostText(gate.cost) + ' · ⛽ ' + scanFuelCost();
  }
  const row = ($('planetList') || document).querySelector(`.planet-route[data-planet="${target}"]`),
    note = row?.querySelector('.route-next');
  if (note) {
    const text = gate.never
      ? 'Signal zu schwach – Kurs noch nicht berechenbar'
      : !gate.campaignDone
        ? `🔒 Feldzug ${gate.waves}/${gate.total}${gate.guardianName ? ' · dann ' + gate.guardianName : ''} · Expeditionskosten: ???`
        : !gate.guardianDone
          ? `🔒 ${gate.guardianName} versperrt den Korridor · Expeditionskosten: ???`
          : 'Expedition: ' + gateCostText(gate.cost) + ' · ⛽ ' + scanFuelCost();
    if (note.textContent !== text) note.textContent = text;
  }
}
// "Glacies entdecken" while the course is still closed → the campaign / guardian is the real next step
const renderObjectiveBaseBeforeGate = renderObjectiveBase;
renderObjectiveBase = () => {
  renderObjectiveBaseBeforeGate();
  const target = nextPlanetIndex(),
    gate = target >= 0 ? planetGate(target) : null;
  if (!gate || gate.never || gate.open || inspectionPending(gate) || $('objectiveTitle').textContent !== gate.name + ' entdecken') return;
  $('objectiveIcon').textContent = '⚔';
  $('objectiveTitle').textContent = gate.campaignDone ? gate.guardianName + ' besiegen' : gate.campaign === 'crystal' ? 'Inspektion abwehren' : CAMPAIGNS[gate.campaign].title + ' durchbrechen';
  $('objectiveText').textContent = gate.campaignDone
    ? gate.guardianName + ' versperrt den Kurs nach ' + gate.name + '. Besiege ihn im Abenteuer-Tab.'
    : 'Feldzug ' + gate.waves + '/' + gate.total + (gate.campaign === 'crystal' ? '' : ' auf ' + PLANETS[CAMPAIGNS[gate.campaign].planet].name) + (gate.guardianName ? ': Danach stellt sich ' + gate.guardianName + ' – und der Kurs nach ' + gate.name + ' wird frei.' : ': Danach ist der Kurs nach ' + gate.name + ' frei.');
  $('objectiveAction').textContent = 'ABENTEUER ›';
  $('objectiveCard').dataset.screen = 'battle';
};
// The inspection (P.I.P.S.' warning → Orion's campaign) begins at a discovery moment: the Frachtdock's old radio
// (game.js updateStory) or — for a player who never builds the dock — the first long-range scan towards Glacies.
// Neither can happen twice (stage + story journal); the scan button stays usable, so nobody is stuck.
function inspectionPending(gate) {
  return Boolean(gate && !gate.never && gate.campaign === 'crystal' && pips().stage === 'locked');
}
function startInspection(source) {
  const p = pips();
  if (p.stage !== 'locked') return false;
  p.stage = 'warned';
  p.drones = 0;
  if (source === 'scan') storyEvent('scan-noticed');
  storyEvent('pips-warning');
  feedback('unlock', 'warning');
  toast('Der Scan wurde bemerkt – der Abenteuer-Tab ist offen. Kein Treibstoff verbraucht.');
  requestSave(200);
  return true;
}
const renderBeforePlanetGate = render;
render = () => {
  renderBeforePlanetGate();
  renderPlanetGate();
};
