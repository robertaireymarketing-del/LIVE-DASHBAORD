export function renderCRMTab(deps) {
  const {
    state,
    getCRMLeads,
    isLeadOverdue,
    isLeadDueToday,
    getOverdueDays,
    formatFollowUpDate,
    getCRMNeedsAction,
    getCRMHotLeads,
    getCRMNewLeadsThisWeek,
    getCRMNewLeadsLastWeek,
    getCRMSalesThisWeek,
    getCRMSalesLastWeek,
    getCRMRevenueThisWeek,
    getCRMRevenueLastWeek,
    getCRMNewLeadsThisMonth,
    getCRMNewLeadsLastMonth,
    getCRMSalesThisMonth,
    getCRMSalesLastMonth,
    getCRMRevenueThisMonth,
    getCRMRevenueLastMonth,
    getDMsSentThisWeek,
    getDMsSentLastWeek,
    getDMsSentThisMonth,
    getDMsSentLastMonth,
    getCRMComparison,
    getTodayData,
    renderDatePickerModal,
    renderSoldModal
  } = deps;

      const leads = getCRMLeads();
      const filter = state.crmFilter;
      const statusConfig = { new: { label: 'NEW', color: '#3498db', bg: 'rgba(52,152,219,0.15)' }, requested: { label: 'REQUESTED', color: '#8e44ad', bg: 'rgba(142,68,173,0.15)' }, dmd: { label: "DM'D", color: '#9b59b6', bg: 'rgba(155,89,182,0.15)' }, replied: { label: 'REPLIED', color: '#f39c12', bg: 'rgba(243,156,18,0.15)' }, interest: { label: 'INTERESTED', color: '#1abc9c', bg: 'rgba(26,188,156,0.15)' }, intent: { label: 'INTENT TO BUY', color: '#e67e22', bg: 'rgba(230,126,34,0.15)' }, sold: { label: 'SOLD', color: '#2ecc71', bg: 'rgba(46,204,113,0.15)' }, cold: { label: 'COLD', color: '#95a5a6', bg: 'rgba(149,165,166,0.15)' } };
      const tempConfig = { hot: { emoji: '🔥', label: 'HOT', color: '#e74c3c', bg: 'rgba(231,76,60,0.15)' }, warm: { emoji: '🌡️', label: 'WARM', color: '#f39c12', bg: 'rgba(243,156,18,0.15)' }, cold: { emoji: '❄️', label: 'COLD', color: '#3498db', bg: 'rgba(52,152,219,0.15)' } };
      const getPriority = (l) => { if (isLeadOverdue(l)) return 0; if (isLeadDueToday(l)) return 1; if (l.temp === 'hot') return 2; if (l.temp === 'warm') return 3; if (l.status === 'replied') return 4; if (l.status === 'dmd') return 5; if (l.status === 'new') return 6; return 7; };
      const sortedLeads = [...leads].sort((a, b) => getPriority(a) - getPriority(b));
      const filteredLeads = filter === 'all' ? sortedLeads : filter === 'action' ? sortedLeads.filter(l => isLeadOverdue(l) || isLeadDueToday(l)) : sortedLeads.filter(l => l.status === filter);
      const sections = [
        { key: 'overdue', emoji: '🔴', label: 'NEEDS ACTION', leads: filteredLeads.filter(l => isLeadOverdue(l)) },
        { key: 'today', emoji: '🟠', label: 'DUE TODAY', leads: filteredLeads.filter(l => isLeadDueToday(l) && !isLeadOverdue(l)) },
        { key: 'intent', emoji: '🎯', label: 'STATED INTENT', leads: filteredLeads.filter(l => l.status === 'intent' && !isLeadOverdue(l) && !isLeadDueToday(l)) },
        { key: 'hot', emoji: '🔥', label: 'HOT', leads: filteredLeads.filter(l => l.temp === 'hot' && !isLeadOverdue(l) && !isLeadDueToday(l)) },
        { key: 'interest', emoji: '👀', label: 'SHOWN INTEREST', leads: filteredLeads.filter(l => l.status === 'interest' && !isLeadOverdue(l) && !isLeadDueToday(l)) },
        { key: 'warm', emoji: '🌡️', label: 'WARM', leads: filteredLeads.filter(l => l.temp === 'warm' && !isLeadOverdue(l) && !isLeadDueToday(l)) },
        { key: 'replied', emoji: '💬', label: 'REPLIED', leads: filteredLeads.filter(l => l.status === 'replied' && !l.temp && !isLeadOverdue(l) && !isLeadDueToday(l)) },
        { key: 'dmd', emoji: '🔵', label: 'AWAITING REPLY', leads: filteredLeads.filter(l => l.status === 'dmd' && !isLeadOverdue(l) && !isLeadDueToday(l)) },
        { key: 'new', emoji: '⚪', label: 'NEW', leads: filteredLeads.filter(l => l.status === 'new' && !isLeadOverdue(l) && !isLeadDueToday(l)) },
        { key: 'closed', emoji: '⬇️', label: 'CLOSED', leads: filteredLeads.filter(l => ['sold', 'cold'].includes(l.status)) }
      ].filter(s => s.leads.length > 0);
      const wL = getCRMComparison(getCRMNewLeadsThisWeek(), getCRMNewLeadsLastWeek());
      const wS = getCRMComparison(getCRMSalesThisWeek(), getCRMSalesLastWeek());
      const wR = getCRMComparison(getCRMRevenueThisWeek(), getCRMRevenueLastWeek());
      const wD = getCRMComparison(getDMsSentThisWeek(), getDMsSentLastWeek());
      const mL = getCRMComparison(getCRMNewLeadsThisMonth(), getCRMNewLeadsLastMonth());
      const mS = getCRMComparison(getCRMSalesThisMonth(), getCRMSalesLastMonth());
      const mR = getCRMComparison(getCRMRevenueThisMonth(), getCRMRevenueLastMonth());
      const mD = getCRMComparison(getDMsSentThisMonth(), getDMsSentLastMonth());
      const renderLeadCard = (lead) => {
        const isExp = state.crmExpanded === lead.id;
        const over = isLeadOverdue(lead);
        const due = isLeadDueToday(lead);
        const st = statusConfig[lead.status] || statusConfig.new;
        const primaryName = lead.dmUsername || lead.username || lead.name || 'Unknown';
        const secondaryHandle = lead.dmUsername ? lead.username : '';
        const thirdName = lead.name || '';
        return '<div class="crm-lead-card ' + (over ? 'overdue' : '') + ' ' + (due ? 'due-today' : '') + '">' +
          '<div class="crm-lead-header"><div>' +
          '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">' +
          '<span class="crm-lead-username">' + primaryName + '</span>' +
          (lead.temp && tempConfig[lead.temp] ? '<span class="crm-temp-tag" style="background:' + tempConfig[lead.temp].bg + ';color:' + tempConfig[lead.temp].color + '">' + tempConfig[lead.temp].emoji + ' ' + tempConfig[lead.temp].label + '</span>' : '') +
          (['interest','intent'].includes(lead.status) ? '<span class="crm-intent-tag" style="background:' + st.bg + ';color:' + st.color + '">' + (lead.status === 'interest' ? '👀 Interested' : '🎯 Intent') + '</span>' : '') +
          (over ? (lead.status === 'requested' ?
            '<div style="margin:8px 0;padding:10px 12px;background:rgba(149,165,166,0.12);border:1px solid rgba(149,165,166,0.3);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
            '<span style="font-size:12px;color:rgba(255,255,255,0.6);">📨 No reply in 7d — they haven\'t accepted yet</span>' +
            '<button onclick="setCRMLeadStatus(\'' + lead.id + '\', \'cold\')" style="background:rgba(149,165,166,0.2);border:1px solid rgba(149,165,166,0.4);color:#95a5a6;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">❄️ Mark Cold</button>' +
            '</div>' :
            '<span class="crm-overdue-tag">⚠️ ' + getOverdueDays(lead) + 'd overdue</span>') : '') +
          '</div>' +
          (secondaryHandle ? '<div class="crm-lead-name" style="color:rgba(255,255,255,0.5);">' + secondaryHandle + '</div>' : '') +
          (thirdName ? '<div class="crm-lead-name">' + thirdName + '</div>' : '') +
          (lead.status === 'sold' && lead.saleItem ? '<div style="font-size:11px;color:#2ecc71;margin-top:3px;">✓ ' + lead.saleItem + ' · £' + (lead.saleAmount||0) + ' · Profit: £' + ((lead.saleAmount||0)-(lead.cogAmount||0)).toFixed(0) + '</div>' : '') +
          '<div class="crm-lead-meta">Added ' + lead.dateAdded + '</div>' +
          '</div><div class="crm-status-badge" style="background:' + st.bg + ';color:' + st.color + '">' + st.label + '</div></div>' +
          '<div class="crm-pipeline">' +
          ['new', 'requested', 'dmd', 'replied', 'interest', 'intent', 'sold'].map(function(s) { var sc = statusConfig[s]; var isAct = lead.status === s; var lbl = s === 'interest' ? '👀' : s === 'intent' ? '🎯' : s === 'requested' ? '📨' : sc.label; return '<div class="crm-pipeline-step" style="font-size:' + (s==='requested'?'14px':'10px') + ';' + (isAct ? 'background:' + sc.bg + ';color:' + sc.color + ';border-color:' + sc.color : '') + '" onclick="setCRMLeadStatus(\'' + lead.id + '\', \'' + s + '\')">' + lbl + '</div>'; }).join('') +
          '</div>' +
          (lead.status === 'replied' ? '<div class="crm-temp-selector">' +
            Object.keys(tempConfig).map(function(key) { var cfg = tempConfig[key]; var isAct = lead.temp === key; return '<div class="crm-temp-btn" style="' + (isAct ? 'background:' + cfg.bg + ';color:' + cfg.color + ';border-color:' + cfg.color : '') + '" onclick="setCRMLeadTemp(\'' + lead.id + '\', \'' + key + '\')">' + cfg.emoji + ' ' + cfg.label + '</div>'; }).join('') + '</div>' : '') +
          (lead.followUp && !['sold', 'cold'].includes(lead.status) ?
            '<div class="crm-followup-row ' + (over || due ? 'overdue' : '') + '">' +
            '<div class="crm-followup-text">Follow up: <span class="crm-followup-date ' + (over || due ? 'overdue' : '') + '">' + (over ? getOverdueDays(lead) + 'd OVERDUE' : due ? 'TODAY' : formatFollowUpDate(lead.followUp)) + '</span></div>' +
            '<button class="crm-change-btn" onclick="openCRMDatePicker(\'' + lead.id + '\')">📅 Change</button></div>' : '') +
          (lead.notes && !isExp ? '<div class="crm-notes">📝 ' + lead.notes + '</div>' : '') +
          (isExp ? '<textarea class="crm-notes-input" rows="3" placeholder="Add notes..." onchange="updateCRMLeadNotes(\'' + lead.id + '\', this.value)">' + (lead.notes || '') + '</textarea>' +
            '<div style="display:flex;gap:8px;">' +
            '<button class="crm-cold-btn" onclick="setCRMLeadStatus(\'' + lead.id + '\', \'cold\')">❄️ Cold</button>' +
            '<button class="crm-cold-btn" style="background:rgba(26,188,156,0.15);border-color:rgba(26,188,156,0.3);color:#1abc9c;" onclick="setCRMLeadStatus(\'' + lead.id + '\', \'interest\')">👀 Shown Interest</button>' +
            '<button class="crm-cold-btn" style="background:rgba(230,126,34,0.15);border-color:rgba(230,126,34,0.3);color:#e67e22;" onclick="setCRMLeadStatus(\'' + lead.id + '\', \'intent\')">🎯 Stated Intent</button>' +
            '</div>' : '') +
          '<button class="crm-expand-btn" onclick="toggleCRMExpand(\'' + lead.id + '\')">' + (isExp ? '▲ Collapse' : '▼ Expand') + '</button></div>';
      };
      return '<div class="cc-section-title" style="margin-top:0;">Sales & Outreach</div>' +
        '<div class="input-grid" style="margin-bottom:16px;">' +
        `<div class="input-card"><div class="input-label">SALES</div><div class="input-row"><input type="number" class="input-field" id="crm-input-sales" placeholder="${getTodayData().sales || 'Enter value'}"><button class="input-btn" onclick="logInput('sales')">LOG</button></div>${getTodayData().sales ? `<div class="logged-value">Logged: ${getTodayData().sales} sales</div>` : ''}</div>` +
        `<div class="input-card"><div class="input-label">REVENUE (£)</div><div class="input-row"><input type="number" class="input-field" id="crm-input-revenue" placeholder="${getTodayData().revenue || 'Enter value'}"><button class="input-btn" onclick="logInput('revenue')">LOG</button></div>${getTodayData().revenue ? `<div class="logged-value">Logged: £${getTodayData().revenue}</div>` : ''}</div>` +
        `<div class="input-card"><div class="input-label">DMs SENT</div><div class="input-row"><input type="number" class="input-field" id="crm-input-dmsSent" placeholder="${getTodayData().dmsSent || 'Enter value'}"><button class="input-btn" onclick="logInput('dmsSent')">LOG</button></div>${getTodayData().dmsSent ? `<div class="logged-value">Logged: ${getTodayData().dmsSent} DMs</div>` : ''}</div>` +
        `<div class="input-card"><div class="input-label">WARM LEADS</div><div class="input-row"><input type="number" class="input-field" id="crm-input-warmLeads" placeholder="${getTodayData().warmLeads || 'Enter value'}"><button class="input-btn" onclick="logInput('warmLeads')">LOG</button></div>${getTodayData().warmLeads ? `<div class="logged-value">Logged: ${getTodayData().warmLeads} leads</div>` : ''}</div>` +
        '</div>' +
        '<div class="crm-stats-grid">' +
        '<div class="crm-stat-card"><div class="crm-stat-value ' + (getCRMNeedsAction() > 0 ? 'urgent' : '') + '">' + getCRMNeedsAction() + '</div><div class="crm-stat-label">NEEDS ACTION</div></div>' +
        '<div class="crm-stat-card"><div class="crm-stat-value ' + (getCRMHotLeads() > 0 ? 'urgent' : '') + '">🔥 ' + getCRMHotLeads() + '</div><div class="crm-stat-label">HOT LEADS</div></div></div>' +
        '<div class="section-title">This Week vs Last Week</div>' +
        '<div class="crm-stats-row" style="flex-wrap:wrap;">' +
        '<div class="crm-sales-card"><div class="crm-sales-label">DMs SENT</div><div class="crm-sales-value">' + getDMsSentThisWeek() + ' <span class="crm-comparison ' + wD.cls + '">' + wD.text + '</span></div></div>' +
        '<div class="crm-sales-card"><div class="crm-sales-label">LEADS</div><div class="crm-sales-value">' + getCRMNewLeadsThisWeek() + ' <span class="crm-comparison ' + wL.cls + '">' + wL.text + '</span></div></div>' +
        '<div class="crm-sales-card"><div class="crm-sales-label">SALES</div><div class="crm-sales-value">' + getCRMSalesThisWeek() + ' <span class="crm-comparison ' + wS.cls + '">' + wS.text + '</span></div></div>' +
        '<div class="crm-sales-card"><div class="crm-sales-label">REVENUE</div><div class="crm-sales-value">£' + getCRMRevenueThisWeek() + '</div><div class="crm-sales-sub crm-comparison ' + wR.cls + '">' + (wR.text !== '—' ? 'vs £' + getCRMRevenueLastWeek() : '—') + '</div></div></div>' +
        '<div class="section-title">This Month vs Last Month</div>' +
        '<div class="crm-stats-row" style="flex-wrap:wrap;">' +
        '<div class="crm-sales-card"><div class="crm-sales-label">DMs SENT</div><div class="crm-sales-value">' + getDMsSentThisMonth() + ' <span class="crm-comparison ' + mD.cls + '">' + mD.text + '</span></div></div>' +
        '<div class="crm-sales-card"><div class="crm-sales-label">LEADS</div><div class="crm-sales-value">' + getCRMNewLeadsThisMonth() + ' <span class="crm-comparison ' + mL.cls + '">' + mL.text + '</span></div></div>' +
        '<div class="crm-sales-card"><div class="crm-sales-label">SALES</div><div class="crm-sales-value">' + getCRMSalesThisMonth() + ' <span class="crm-comparison ' + mS.cls + '">' + mS.text + '</span></div></div>' +
        '<div class="crm-sales-card"><div class="crm-sales-label">REVENUE</div><div class="crm-sales-value">£' + getCRMRevenueThisMonth() + '</div><div class="crm-sales-sub crm-comparison ' + mR.cls + '">' + (mR.text !== '—' ? 'vs £' + getCRMRevenueLastMonth() : '—') + '</div></div></div>' +
        '<div class="crm-add-section">' +
        '<div class="crm-add-row">' +
        '<input type="text" class="crm-add-input" id="crm-dm-username" placeholder="DM username (primary)">' +
        '<input type="text" class="crm-add-input" id="crm-username" placeholder="@TikTok handle"></div>' +
        '<div class="crm-add-row"><input type="text" class="crm-add-input" id="crm-name" placeholder="Name (optional)"></div>' +
        '<button class="crm-add-btn" onclick="addCRMLead()">ADD LEAD</button></div>' +
        '<div class="crm-filters">' +
        [{ key: 'all', label: 'All' }, { key: 'action', label: 'Action (' + getCRMNeedsAction() + ')' }, { key: 'new', label: 'New' }, { key: 'requested', label: '📨 Requested' }, { key: 'dmd', label: "DM'd" }, { key: 'replied', label: 'Replied' }, { key: 'interest', label: '👀 Interest' }, { key: 'intent', label: '🎯 Intent' }, { key: 'sold', label: 'Sold' }, { key: 'cold', label: 'Cold' }].map(function(f) { return '<button class="crm-filter-btn ' + (filter === f.key ? 'active' : '') + '" onclick="setCRMFilter(\'' + f.key + '\')">' + f.label + '</button>'; }).join('') + '</div>' +
        (filter === 'all' ? sections.map(function(section) { return '<div class="crm-section-header"><span class="crm-section-emoji">' + section.emoji + '</span><span class="crm-section-label">' + section.label + '</span><span class="crm-section-count">' + section.leads.length + '</span></div>' + section.leads.map(renderLeadCard).join(''); }).join('') : filteredLeads.map(renderLeadCard).join('')) +
        (state.crmDatePicker ? renderDatePickerModal() : '') +
        (state.crmSoldModal ? renderSoldModal() : '');
    
}

export function renderVaultTab(deps) {
  const {
    state,
    getVaultIdeas,
    vaultStaleCount,
    VAULT_STAGES,
    VAULT_SOURCES,
    VAULT_CATS,
    VAULT_STAGE_COLORS,
    VAULT_CAT_COLORS
  } = deps;

      function vaultTimeAgo(ts) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        const hrs  = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (mins < 1)   return 'just now';
        if (mins < 60)  return `${mins}m ago`;
        if (hrs  < 24)  return `${hrs}h ago`;
        if (days === 1) return 'yesterday';
        return `${days}d ago`;
      }

      const ideas      = getVaultIdeas();
      const activeStage = state.vaultStage || 'Raw';
      const stale      = vaultStaleCount();
      const capturing  = state.vaultCapturing || false;
      const expandedId = state.vaultExpanded || null;
      const filtered   = ideas.filter(i => i.stage === activeStage);

      const capturePanel = capturing ? `
        <div class="vault-capture-panel" style="border-radius:10px;padding:20px;margin-bottom:20px;">
          <div class="vault-capture-label">NEW CAPTURE</div>
          <input id="vault-title" placeholder="What's the idea?" class="vault-title-input" style="width:100%;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.15);padding:8px 0;font-size:20px;color:#fff;outline:none;margin-bottom:20px;"/>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div>
              <div class="vault-field-label">SOURCE</div>
              <select id="vault-source" class="vault-select" style="width:100%;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;padding:8px;font-size:13px;outline:none;">
                ${VAULT_SOURCES.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>
            <div>
              <div class="vault-field-label">CATEGORY</div>
              <select id="vault-category" class="vault-select" style="width:100%;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;padding:8px;font-size:13px;outline:none;">
                ${VAULT_CATS.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="margin-bottom:14px;">
            <div class="vault-field-label">WHAT'S THE SPARK?</div>
            <textarea id="vault-spark" rows="2" placeholder="Why did this hit? What was the insight?" class="vault-field-input" style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#ccc;padding:10px;font-size:13px;outline:none;resize:vertical;font-family:inherit;line-height:1.5;"></textarea>
          </div>
          <div class="vault-action-box" style="border-radius:6px;padding:12px;margin-bottom:14px;">
            <div style="font-size:10px;letter-spacing:1px;color:#7EB8C9;margin-bottom:6px;font-weight:600;">SO WHAT? → ONE ACTION THIS REQUIRES</div>
            <input id="vault-action" placeholder="e.g. Test as TikTok hook, delegate to VA, add to strategy doc..." class="vault-action-input" style="width:100%;background:transparent;border:none;color:#fff;padding:4px 0;font-size:13px;outline:none;"/>
          </div>
          <div style="margin-bottom:18px;">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="vaultToggleVA()">
              <div id="vault-va-toggle" style="width:36px;height:20px;border-radius:10px;background:#222;border:1px solid #333;position:relative;transition:all 0.2s;flex-shrink:0;">
                <div style="width:14px;height:14px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:left 0.2s;"></div>
              </div>
              <span class="vault-va-label">DELEGATE TO VA</span>
            </label>
            <div id="vault-va-notes-wrap" style="display:none;margin-top:10px;">
              <input id="vault-va-notes" placeholder="Brief for VA..." style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(212,175,55,0.2);border-radius:6px;color:#D4AF37;padding:8px;font-size:13px;outline:none;"/>
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <button onclick="vaultSaveIdea()" class="vault-save-btn">VAULT IT</button>
            <button onclick="vaultCancelCapture()" class="vault-cancel-btn">Cancel</button>
          </div>
        </div>` :
        `<button onclick="vaultStartCapture()" class="vault-capture-btn" style="width:100%;padding:16px;background:rgba(212,175,55,0.06);border:1.5px dashed rgba(212,175,55,0.35);border-radius:8px;color:#D4AF37;font-size:14px;cursor:pointer;margin-bottom:20px;text-align:center;font-weight:600;letter-spacing:0.5px;">
          + Capture an idea...
        </button>`;

      const stageTabs = `<div class="vault-tabs-row" style="display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap;">
        ${VAULT_STAGES.map(s => {
          const cnt = ideas.filter(i => i.stage === s).length;
          const active = activeStage === s;
          const col = VAULT_STAGE_COLORS[s];
          return `<button onclick="setVaultStage('${s}')" class="vault-pill-tab ${active ? 'active' : ''}" style="${active ? `background:${col};border-color:${col};color:#fff;` : ''}">
            ${s} <span class="vault-pill-count" style="${active ? 'background:rgba(255,255,255,0.25);color:#fff;' : ''}">${cnt}</span>
          </button>`;
        }).join('')}
      </div>`;

      const ideaCards = filtered.length === 0
        ? `<div class="vault-empty-state">No ideas in ${activeStage.toLowerCase()} yet</div>`
        : filtered.map(idea => {
            const isExpanded = expandedId === idea.id;
            const isStale    = idea.stage === 'Raw' && (Date.now() - idea.createdAt) > 7 * 86400000;
            const col        = VAULT_STAGE_COLORS[idea.stage];
            const catCol     = VAULT_CAT_COLORS[idea.category] || '#888';
            const stripeGrad = `linear-gradient(90deg, ${col}, ${col}88)`;
            return `
              <div class="vault-idea-card ${isExpanded ? 'expanded' : ''}">
                <div class="vault-card-stripe" style="background:${stripeGrad};"></div>
                <div class="vault-card-body" onclick="toggleVaultExpand('${idea.id}')">
                  <div style="flex:1;min-width:0;">
                    <div class="vault-idea-title">
                      ${idea.title}
                      ${idea.vaFlag ? `<span class="vault-va-badge">VA</span>` : ''}
                      ${isStale ? `<span class="vault-stale-badge">STALE</span>` : ''}
                    </div>
                    <div class="vault-card-pills">
                      <span class="vault-pill-cat" style="background:${catCol}22;color:${catCol};">${idea.category}</span>
                      <span class="vault-pill-src">${idea.source}</span>
                      <span class="vault-pill-time">${vaultTimeAgo(idea.createdAt)}</span>
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                    <button class="vault-delete-quick-btn" onclick="event.stopPropagation();if(confirm('Delete this idea?'))deleteVaultIdea('${idea.id}')" title="Delete">✕</button>
                    <span class="vault-expand-arrow">${isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
                ${isExpanded ? `
                  <div class="vault-expanded-body">
                    ${idea.spark ? `<div class="vault-spark-wrap">
                      <div class="vault-field-label">THE SPARK</div>
                      <p class="vault-spark-text">${idea.spark}</p>
                    </div>` : ''}
                    ${idea.action ? `<div class="vault-action-display">
                      <div style="font-size:10px;letter-spacing:1px;color:#7EB8C9;margin-bottom:4px;font-weight:600;">ACTION</div>
                      <p class="vault-action-text">${idea.action}</p>
                    </div>` : ''}
                    ${idea.vaFlag && idea.vaNotes ? `<div class="vault-va-display">
                      <div style="font-size:10px;letter-spacing:1px;color:#D4AF37;margin-bottom:4px;font-weight:600;">VA BRIEF</div>
                      <p style="margin:0;font-size:13px;color:rgba(212,175,55,0.8);">${idea.vaNotes}</p>
                    </div>` : ''}
                    <div class="vault-move-row">
                      <span class="vault-move-label">Move to →</span>
                      ${VAULT_STAGES.filter(s => s !== idea.stage).map(s => `<button class="vault-stage-move-btn" onclick="moveVaultStage('${idea.id}','${s}')" style="color:${VAULT_STAGE_COLORS[s]};border-color:${VAULT_STAGE_COLORS[s]}33;">${s}</button>`).join('')}
                    </div>
                  </div>` : ''}
              </div>`;
          }).join('');

      return `
        <div class="vault-header">
          <div>
            <div class="section-title vault-title-text" style="margin-top:0;">Idea Vault</div>
            <div class="vault-tagline">Capture. Process. Deploy.</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${stale > 0 ? `<div class="vault-stale-alert">⚑ ${stale} stale</div>` : ''}
            <div class="vault-count-badge">${ideas.length} ${ideas.length === 1 ? 'idea' : 'ideas'}</div>
          </div>
        </div>
        ${capturePanel}
        ${stageTabs}
        ${ideaCards}
      `;
    
}
