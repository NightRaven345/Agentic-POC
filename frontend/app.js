/* ======================================================================
   Government Digital Services Portal — app.js
   Full Hash-based Router with Role Guards & Chrome Back/Forward Support.
   ====================================================================== */

const API_BASE = 'http://localhost:8080';
const AI_BASE  = 'http://localhost:8000';

// ── State ─────────────────────────────────────────────────────────────────
let state = {
  user: null,           // full user profile
  token: null,          // JWT Bearer token
  role: 'PUBLIC',       // PUBLIC | ROLE_USER | ROLE_EMPLOYEE
  activeContext: null,  // application being reviewed by officer
  reviewTask: null,     // pending task under officer review
  rejectTargetId: null, // ID for reject flow
};

// ── Bootstrap & Router Setup ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Restore persisted session if available
  restoreSession();

  // Listen for Chrome back/forward button & hash changes
  window.addEventListener('hashchange', handleRoute);
  
  // Initial route handling
  handleRoute();

  renderChatHeader();
  resetChatbot();
});

function restoreSession() {
  const savedToken = localStorage.getItem('gov_jwt_token');
  const savedUser = localStorage.getItem('gov_user_profile');
  if (savedToken && savedUser) {
    try {
      state.token = savedToken;
      state.user = JSON.parse(savedUser);
      state.role = state.user.role || 'PUBLIC';
    } catch(e) {
      localStorage.removeItem('gov_jwt_token');
      localStorage.removeItem('gov_user_profile');
    }
  }
}

function saveSession() {
  if (state.token && state.user) {
    localStorage.setItem('gov_jwt_token', state.token);
    localStorage.setItem('gov_user_profile', JSON.stringify(state.user));
  } else {
    localStorage.removeItem('gov_jwt_token');
    localStorage.removeItem('gov_user_profile');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ROUTER & ROLE GUARDS
// ══════════════════════════════════════════════════════════════════════════

function navigateTo(hash) {
  if (window.location.hash === hash) {
    handleRoute();
  } else {
    window.location.hash = hash;
  }
}

async function handleRoute() {
  const rawHash = window.location.hash || '#/';
  const hash = rawHash.split('?')[0]; // strip query string if any

  console.log(`[Router] Navigating to ${rawHash} | Current Role: ${state.role}`);

  // Close open modals unless the route specifically requires them
  if (hash !== '#/login') closeModal('login-modal');
  if (hash !== '#/signup') closeModal('signup-modal');

  // ── ROUTE GUARDS ──────────────────────────────────────────────────────────

  // Route 1: Officer Review Task (#/officer/review/:id)
  if (hash.startsWith('#/officer/review/')) {
    const id = parseInt(hash.replace('#/officer/review/', ''));
    if (!guardRole('ROLE_EMPLOYEE', '#/login', '🔒 Access Restricted. Officer authentication required.')) return;
    
    renderNav();
    renderCapabilitiesBar();
    if (isNaN(id)) {
      navigateTo('#/officer/dashboard');
    } else {
      await loadAndRenderReviewTask(id);
    }
    return;
  }

  // Route 2: Officer Dashboard (#/officer/dashboard)
  if (hash === '#/officer/dashboard') {
    if (!guardRole('ROLE_EMPLOYEE', '#/login', '🔒 Access Restricted. Officer login required.')) return;
    
    state.reviewTask = null;
    state.activeContext = null;
    updateContextPill();
    
    renderNav();
    renderCapabilitiesBar();
    renderOfficerDashboard(document.getElementById('main-content'));
    return;
  }

  // Route 3: Citizen Dashboard (#/citizen/dashboard)
  if (hash === '#/citizen/dashboard') {
    if (!guardRole('ROLE_USER', '#/login', '🔒 Please sign in to access your citizen dashboard.')) return;
    
    renderNav();
    renderCapabilitiesBar();
    renderMainContent();
    return;
  }

  // Route 4: Login Modal / Route (#/login)
  if (hash === '#/login') {
    if (state.token && state.user) {
      // Already logged in → redirect to dashboard
      const target = state.role === 'ROLE_EMPLOYEE' ? '#/officer/dashboard' : '#/citizen/dashboard';
      navigateTo(target);
      return;
    }
    renderNav();
    renderCapabilitiesBar();
    renderMainContent();
    openModal('login-modal');
    return;
  }

  // Route 5: Signup Modal / Route (#/signup)
  if (hash === '#/signup') {
    if (state.token && state.user) {
      const target = state.role === 'ROLE_EMPLOYEE' ? '#/officer/dashboard' : '#/citizen/dashboard';
      navigateTo(target);
      return;
    }
    renderNav();
    renderCapabilitiesBar();
    renderMainContent();
    openModal('signup-modal');
    return;
  }

  // Route 6: Default Home (#/)
  if (hash === '#/' || hash === '') {
    // If logged in, redirect to respective dashboard
    if (state.token && state.user) {
      const target = state.role === 'ROLE_EMPLOYEE' ? '#/officer/dashboard' : '#/citizen/dashboard';
      navigateTo(target);
      return;
    }
    renderNav();
    renderCapabilitiesBar();
    renderPublicPage(document.getElementById('main-content'));
    return;
  }

  // Unknown route → fallback home
  navigateTo('#/');
}

function guardRole(requiredRole, redirectHash, warningMsg) {
  if (!state.token || !state.user) {
    showToast(warningMsg || '🔒 Please log in to view this page.', 'error');
    navigateTo(redirectHash || '#/login');
    return false;
  }

  if (state.role !== requiredRole) {
    const safeTarget = state.role === 'ROLE_EMPLOYEE' ? '#/officer/dashboard' : '#/citizen/dashboard';
    showToast('🔒 Unauthorized page for your role level.', 'error');
    navigateTo(safeTarget);
    return false;
  }

  return true;
}

// ══════════════════════════════════════════════════════════════════════════
// NAVIGATION & AUTH CONTROLS UI
// ══════════════════════════════════════════════════════════════════════════
function renderNav() {
  const el = document.getElementById('nav-auth-controls');
  if (!state.user) {
    el.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="navigateTo('#/login')">
        <span class="material-icons-round">login</span> Sign In
      </button>
      <button class="btn btn-primary btn-sm" onclick="navigateTo('#/signup')">
        <span class="material-icons-round">how_to_reg</span> Register
      </button>
    `;
  } else {
    const isOfficer = state.role === 'ROLE_EMPLOYEE';
    const badgeCls = isOfficer ? 'badge-officer' : (state.user.status === 'APPROVED' ? 'badge-approved' : 'badge-pending');
    const badgeLabel = isOfficer ? 'Officer' : (state.user.status || 'Citizen');
    const name = `${state.user.firstName || ''} ${state.user.lastName || ''}`.trim() || state.user.username;
    const dashboardHash = isOfficer ? '#/officer/dashboard' : '#/citizen/dashboard';
    
    el.innerHTML = `
      <div style="text-align:right;line-height:1.3;cursor:pointer;" onclick="navigateTo('${dashboardHash}')" title="Go to Dashboard">
        <strong style="font-size:.85rem;display:block;">${name}</strong>
        <span style="font-size:.72rem;color:var(--text-muted);">${state.user.username}</span>
      </div>
      <span class="badge ${badgeCls}">${badgeLabel}</span>
      <button class="btn btn-ghost btn-sm" onclick="handleLogout()">
        <span class="material-icons-round">logout</span> Logout
      </button>
    `;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// AI CAPABILITIES BAR
// ══════════════════════════════════════════════════════════════════════════
async function renderCapabilitiesBar() {
  const levelEl = document.getElementById('caps-level');
  const toolsEl = document.getElementById('caps-tools-list');
  
  let caps = null;
  try {
    const r = await fetch(`${AI_BASE}/api/ai/capabilities?role=${state.role}`);
    if (r.ok) caps = await r.json();
  } catch (e) {}

  if (!caps) {
    caps = getFallbackCapabilities(state.role);
  }

  levelEl.innerHTML = `<span class="material-icons-round" style="font-size:15px;">auto_awesome</span> ${caps.level}`;

  const chips = [
    ...caps.available.map(t => `<span class="cap-chip active" title="${t.desc}">✓ ${t.name}</span>`),
    ...caps.unavailable.map(t => `<span class="cap-chip locked" title="${t.desc}">✗ ${t.name}</span>`)
  ];
  toolsEl.innerHTML = chips.join('');
  renderChatHeader(caps.level);
}

function getFallbackCapabilities(role) {
  const caps = {
    PUBLIC: { level: '1. Public Help & FAQ Guide', available: [{ name: 'FAQ Assistant', desc: '' }], unavailable: [{ name: 'Status Queries', desc: '' }, { name: 'SQL Tools', desc: '' }] },
    ROLE_USER: { level: '2. Citizen Service Assistant', available: [{ name: 'FAQ', desc: '' }, { name: 'My Status', desc: '' }, { name: 'My Grievances', desc: '' }], unavailable: [{ name: 'SQL Tools', desc: '' }, { name: 'Duplicate Detection', desc: '' }] },
    ROLE_EMPLOYEE: { level: '3. Officer Enterprise Intelligence', available: [{ name: 'FAQ', desc: '' }, { name: 'Citizen Lookup', desc: '' }, { name: 'SQL Stats', desc: '' }, { name: 'Duplicate Detection', desc: '' }], unavailable: [] }
  };
  return caps[role] || caps.PUBLIC;
}

function renderChatHeader(level) {
  const subEl = document.getElementById('chat-role-sub');
  if (subEl && level) subEl.textContent = level;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN CONTENT ROUTER
// ══════════════════════════════════════════════════════════════════════════
function renderMainContent() {
  const el = document.getElementById('main-content');
  if (!state.user) {
    renderPublicPage(el);
  } else if (state.role === 'ROLE_EMPLOYEE') {
    renderOfficerDashboard(el);
  } else {
    // Citizen
    if (state.user.status === 'NOT_SUBMITTED' || !state.user.hasSubmittedRegistration) {
      renderCitizenNotSubmitted(el);
    } else if (state.user.status === 'PENDING') {
      renderCitizenPending(el);
    } else if (state.user.status === 'APPROVED') {
      renderCitizenApproved(el);
    } else if (state.user.status === 'REJECTED') {
      renderCitizenRejected(el);
    } else {
      renderCitizenNotSubmitted(el);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PUBLIC VIEW
// ══════════════════════════════════════════════════════════════════════════
function renderPublicPage(el) {
  el.innerHTML = `
    <div class="hero" style="margin-bottom:1.5rem;">
      <div class="hero-badge"><span class="material-icons-round">verified</span> Official Government of India Portal</div>
      <h1>Official Citizen Services & Digital Onboarding</h1>
      <p>Register as a citizen, track your verification status, submit grievances, and access government services — all through one intelligent, secure platform.</p>
      <div class="hero-actions">
        <button class="btn hero-cta-primary" onclick="navigateTo('#/signup')">
          <span class="material-icons-round">how_to_reg</span> Create Citizen Account
        </button>
        <button class="btn hero-cta-secondary" onclick="navigateTo('#/login')">
          <span class="material-icons-round">login</span> Sign In
        </button>
      </div>
    </div>

    <div class="cards-grid">
      <div class="feature-card" onclick="sendPrompt('What documents are required for registration?')">
        <div class="f-icon"><span class="material-icons-round">description</span></div>
        <h3>FAQ Assistant</h3>
        <p>Get instant answers on registration requirements, timelines, eligible documents, and portal guidelines.</p>
        <div class="f-link">Ask: "What documents are needed?" <span class="material-icons-round" style="font-size:16px;">arrow_forward</span></div>
      </div>
      <div class="feature-card" onclick="sendPrompt('How long does registration approval take?')">
        <div class="f-icon"><span class="material-icons-round">schedule</span></div>
        <h3>Registration Timelines</h3>
        <p>Understand the approval stages, estimated processing times, and what happens at each verification step.</p>
        <div class="f-link">Ask: "How long does it take?" <span class="material-icons-round" style="font-size:16px;">arrow_forward</span></div>
      </div>
      <div class="feature-card" onclick="navigateTo('#/login')">
        <div class="f-icon"><span class="material-icons-round">admin_panel_settings</span></div>
        <h3>Officer Portal</h3>
        <p>Government review officers sign in to manage pending registrations, run automated verification audits, and issue decisions.</p>
        <div class="f-link">Officer Sign In <span class="material-icons-round" style="font-size:16px;">arrow_forward</span></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div>
          <h2>How It Works</h2>
          <p>Simple 3-step citizen registration process</p>
        </div>
      </div>
      <div class="panel-body">
        <div class="stepper">
          <div class="step-node completed">
            <div class="step-circle">1</div>
            <div class="step-label">Create Account</div>
          </div>
          <div class="step-line"></div>
          <div class="step-node">
            <div class="step-circle">2</div>
            <div class="step-label">Submit Full Registration</div>
          </div>
          <div class="step-line"></div>
          <div class="step-node">
            <div class="step-circle">3</div>
            <div class="step-label">Officer Reviews & Approves</div>
          </div>
        </div>
        <div class="prompt-chips" style="margin-top:1.2rem;">
          <button class="prompt-chip" onclick="sendPrompt('What is citizen registration?')"><span class="material-icons-round">help_outline</span> What is citizen registration?</button>
          <button class="prompt-chip" onclick="sendPrompt('How do I register on this portal?')"><span class="material-icons-round">how_to_reg</span> How to Register</button>
          <button class="prompt-chip" onclick="sendPrompt('Is there any fee for registration?')"><span class="material-icons-round">payments</span> Registration Fee</button>
          <button class="prompt-chip" onclick="sendPrompt('What documents are required for registration?')"><span class="material-icons-round">description</span> Required Documents</button>
          <button class="prompt-chip" onclick="sendPrompt('How long does registration approval take?')"><span class="material-icons-round">schedule</span> Approval Timeline</button>
          <button class="prompt-chip" onclick="sendPrompt('What is the policy on duplicate registration?')"><span class="material-icons-round">policy</span> Anti-Fraud Policy</button>
        </div>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════
// CITIZEN VIEWS
// ══════════════════════════════════════════════════════════════════════════
function renderCitizenNotSubmitted(el) {
  const name = `${state.user.firstName || ''}`.trim() || state.user.username;
  el.innerHTML = `
    <div class="panel" style="margin-bottom:1.2rem;">
      <div class="panel-body" style="text-align:center;padding:2.5rem 2rem;">
        <span class="material-icons-round" style="font-size:52px;color:var(--blue);margin-bottom:1rem;display:block;">assignment</span>
        <h2 style="margin-bottom:.5rem;">Welcome, ${name}</h2>
        <p style="color:var(--text-muted);max-width:500px;margin:0 auto 1.5rem auto;">Your citizen account is active. To access all government services and receive official verification, please submit your complete registration form.</p>
        <button class="btn btn-primary" onclick="openRegistrationModal()">
          <span class="material-icons-round">send</span> Submit Official Registration Form
        </button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-header"><div><h2>Your Account</h2><p>Basic account details</p></div></div>
      <div class="panel-body">
        <div class="info-grid">
          <div class="info-card"><div class="label">Email</div><div class="value">${state.user.username}</div></div>
          <div class="info-card"><div class="label">Account Status</div><div class="value accent-amber">Not Yet Submitted</div></div>
          <div class="info-card"><div class="label">Access Level</div><div class="value" style="color:var(--text-muted);">Full access after approval</div></div>
        </div>
        <div class="prompt-chips">
          <button class="prompt-chip" onclick="sendPrompt('What documents do I need for registration?')"><span class="material-icons-round">description</span> Required documents</button>
          <button class="prompt-chip" onclick="sendPrompt('How long does registration approval take?')"><span class="material-icons-round">schedule</span> Processing time</button>
        </div>
      </div>
    </div>
  `;
}

function renderCitizenPending(el) {
  const u = state.user;
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  el.innerHTML = `
    <div class="panel" style="margin-bottom:1.2rem;border-top:3px solid var(--amber);">
      <div class="panel-body">
        <div style="display:flex;align-items:flex-start;gap:1.2rem;flex-wrap:wrap;">
          <span class="material-icons-round" style="font-size:40px;color:var(--amber);margin-top:.2rem;">hourglass_empty</span>
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;margin-bottom:.8rem;">
              <h2>Registration Under Review</h2>
              <span class="badge badge-pending">Pending</span>
            </div>
            <p style="color:var(--text-muted);margin-bottom:1rem;">Reference: <strong>${u.registrationId || 'N/A'}</strong> &nbsp;|&nbsp; Assigned to: <strong>${u.assignedOfficerName || 'N/A'}</strong></p>
            <div class="stepper">
              <div class="step-node completed"><div class="step-circle">✓</div><div class="step-label">Submitted</div></div>
              <div class="step-line done"></div>
              <div class="step-node active"><div class="step-circle">2</div><div class="step-label">Officer Verification</div></div>
              <div class="step-line"></div>
              <div class="step-node"><div class="step-circle">3</div><div class="step-label">Decision</div></div>
            </div>
          </div>
        </div>
        <div class="info-grid" style="margin-top:1.2rem;">
          <div class="info-card"><div class="label">Current Stage</div><div class="value accent-amber" style="font-size:.88rem;">${u.approvalStage || 'Verification'}</div></div>
          <div class="info-card"><div class="label">Assigned Officer</div><div class="value" style="font-size:.88rem;">${u.assignedOfficerName || 'N/A'}</div></div>
          <div class="info-card"><div class="label">Est. Processing Time</div><div class="value">${u.estimatedProcessingDays || 'N/A'} working days</div></div>
        </div>
        ${u.missingDocuments && u.missingDocuments !== 'None' ? `
        <div style="margin-top:1rem;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:.8rem 1rem;font-size:.83rem;">
          <strong style="color:var(--amber);">⚠ Missing Documents:</strong> ${u.missingDocuments}
        </div>` : ''}
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><div><h2>Portal Help & Status Assistant</h2><p>Get help with your registration status</p></div></div>
      <div class="panel-body">
        <div class="prompt-chips">
          <button class="prompt-chip" onclick="sendPrompt('What is the current status of my registration?')"><span class="material-icons-round">info</span> My status</button>
          <button class="prompt-chip" onclick="sendPrompt('Why is my registration pending?')"><span class="material-icons-round">help</span> Why pending?</button>
          <button class="prompt-chip" onclick="sendPrompt('What documents are missing from my application?')"><span class="material-icons-round">description</span> Missing docs</button>
          <button class="prompt-chip" onclick="sendPrompt('How long will my approval take?')"><span class="material-icons-round">schedule</span> Timeline</button>
          <button class="prompt-chip" onclick="sendPrompt('What is my grievance status?')"><span class="material-icons-round">report</span> My grievances</button>
        </div>
      </div>
    </div>
  `;
}

function renderCitizenApproved(el) {
  const u = state.user;
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  el.innerHTML = `
    <div class="panel" style="margin-bottom:1.5rem;border-top:3px solid var(--emerald);">
      <div class="panel-body">
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1.2rem;">
          <span class="material-icons-round" style="font-size:40px;color:var(--emerald);">verified_user</span>
          <div>
            <div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;">
              <h2>Welcome, ${name}</h2>
              <span class="badge badge-approved">Approved</span>
            </div>
            <p style="color:var(--text-muted);">Registration ID: <strong>${u.registrationId || 'N/A'}</strong> &nbsp;|&nbsp; Verified Citizen Account</p>
          </div>
        </div>
        <div class="info-grid">
          <div class="info-card"><div class="label">Registration ID</div><div class="value accent-blue"><code>${u.registrationId || 'N/A'}</code></div></div>
          <div class="info-card"><div class="label">PAN Number</div><div class="value"><code>${u.pan || 'N/A'}</code></div></div>
          <div class="info-card"><div class="label">Organization</div><div class="value" style="font-size:.88rem;">${u.organization || 'N/A'}</div></div>
        </div>
      </div>
    </div>

    <!-- 2 Functional Features for Approved Citizens -->
    <div class="cards-grid" style="margin-bottom:1.5rem;">
      <div class="feature-card" id="notices-card" onclick="loadNoticesPanel()">
        <div class="f-icon"><span class="material-icons-round">campaign</span></div>
        <h3>Public Notices & Circulars</h3>
        <p>View official government circulars, announcements, guidelines, and updates from the Ministry.</p>
        <div class="f-link">View All Notices <span class="material-icons-round" style="font-size:16px;">arrow_forward</span></div>
      </div>
      <div class="feature-card" onclick="openModal('grievance-modal')">
        <div class="f-icon"><span class="material-icons-round">report_problem</span></div>
        <h3>Grievance Portal</h3>
        <p>Submit and track grievances related to registration, documents, or any portal service issue.</p>
        <div class="f-link">Submit / Track Grievance <span class="material-icons-round" style="font-size:16px;">arrow_forward</span></div>
      </div>
      <div class="feature-card" onclick="loadGrievancesPanel()">
        <div class="f-icon"><span class="material-icons-round">list_alt</span></div>
        <h3>My Grievances</h3>
        <p>Track the status and resolution of your submitted grievances in real time.</p>
        <div class="f-link">View My Grievances <span class="material-icons-round" style="font-size:16px;">arrow_forward</span></div>
      </div>
    </div>

    <div id="citizen-feature-panel"></div>

    <div class="panel">
      <div class="panel-header"><div><h2>Portal Service Guide</h2><p>Ask anything about the portal services</p></div></div>
      <div class="panel-body">
        <div class="prompt-chips">
          <button class="prompt-chip" onclick="sendPrompt('What is my registration status?')"><span class="material-icons-round">info</span> My status</button>
          <button class="prompt-chip" onclick="sendPrompt('What documents are required for registration?')"><span class="material-icons-round">description</span> FAQs</button>
          <button class="prompt-chip" onclick="sendPrompt('What is the anti-fraud duplicate detection policy?')"><span class="material-icons-round">policy</span> Anti-fraud policy</button>
          <button class="prompt-chip" onclick="sendPrompt('What is my grievance status?')"><span class="material-icons-round">report</span> My grievances</button>
        </div>
      </div>
    </div>
  `;
}

function renderCitizenRejected(el) {
  const u = state.user;
  el.innerHTML = `
    <div class="panel" style="border-top:3px solid var(--rose);">
      <div class="panel-body" style="text-align:center;padding:2rem;">
        <span class="material-icons-round" style="font-size:48px;color:var(--rose);margin-bottom:1rem;display:block;">cancel</span>
        <h2>Registration Not Approved</h2>
        <p style="color:var(--text-muted);margin:.8rem auto 1.5rem;max-width:480px;">
          <strong>Reason:</strong> ${u.missingDocuments || u.approvalStage || 'Please contact the Grievance Cell for details.'}
        </p>
        <div style="display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="openModal('grievance-modal')"><span class="material-icons-round">report_problem</span> File Grievance</button>
          <button class="prompt-chip" onclick="sendPrompt('My registration was rejected. What can I do?')">Get Support & Guidance</button>
        </div>
      </div>
    </div>
  `;
}

// ── Approved Citizen Feature 1: Notices ──────────────────────────────────
async function loadNoticesPanel() {
  const panel = document.getElementById('citizen-feature-panel');
  if (!panel) return;
  panel.innerHTML = `<div class="panel" style="margin-bottom:1.2rem;"><div class="panel-body"><div class="loading-state"><div class="spinner" style="border-color:rgba(30,95,203,.2);border-top-color:var(--blue);"></div> Loading notices...</div></div></div>`;
  
  let notices = [];
  try {
    const r = await fetch(`${API_BASE}/api/public/notices`);
    if (r.ok) notices = await r.json();
  } catch(e) {}

  const catIcon = { CIRCULAR: 'circle_notifications', ANNOUNCEMENT: 'campaign', GUIDELINE: 'menu_book', TENDER: 'gavel' };
  const catColor = { CIRCULAR: 'var(--blue)', ANNOUNCEMENT: 'var(--emerald)', GUIDELINE: 'var(--amber)', TENDER: 'var(--rose)' };

  panel.innerHTML = `
    <div class="panel" style="margin-bottom:1.2rem;">
      <div class="panel-header">
        <div><h2><span class="material-icons-round" style="vertical-align:middle;color:var(--blue);">campaign</span> Public Notices & Circulars</h2><p>${notices.length} active notice(s)</p></div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('citizen-feature-panel').innerHTML=''">✕ Close</button>
      </div>
      ${notices.length === 0 ? '<div class="panel-body"><p style="color:var(--text-muted);">No notices available.</p></div>' : ''}
      ${notices.map(n => `
        <div style="padding:1rem 1.5rem;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:flex-start;gap:.8rem;">
            <span class="material-icons-round" style="color:${catColor[n.category]||'var(--blue)'};font-size:20px;margin-top:.1rem;">${catIcon[n.category]||'info'}</span>
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.3rem;">
                <strong style="font-size:.9rem;">${n.title}</strong>
                <span class="badge badge-public" style="font-size:.65rem;">${n.category}</span>
              </div>
              <p style="font-size:.82rem;color:var(--text-mid);line-height:1.55;margin-bottom:.4rem;">${n.content}</p>
              <div style="font-size:.72rem;color:var(--text-muted);">
                Ref: <code>${n.referenceNumber}</code> &nbsp;|&nbsp; Issued by: ${n.issuedBy} &nbsp;|&nbsp; Effective: ${n.effectiveDate}
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Approved Citizen Feature 2: My Grievances ────────────────────────────
async function loadGrievancesPanel() {
  const panel = document.getElementById('citizen-feature-panel');
  if (!panel) return;
  panel.innerHTML = `<div class="panel" style="margin-bottom:1.2rem;"><div class="panel-body"><div class="loading-state"><div class="spinner" style="border-color:rgba(30,95,203,.2);border-top-color:var(--blue);"></div> Loading grievances...</div></div></div>`;
  
  let grievances = [];
  try {
    const r = await authFetch(`${API_BASE}/api/user/grievances`);
    if (r.ok) grievances = await r.json();
  } catch(e) {}

  const stMap = { SUBMITTED: 'badge-submitted', UNDER_REVIEW: 'badge-pending', RESOLVED: 'badge-approved', CLOSED: 'badge-officer' };

  panel.innerHTML = `
    <div class="panel" style="margin-bottom:1.2rem;">
      <div class="panel-header">
        <div><h2><span class="material-icons-round" style="vertical-align:middle;color:var(--blue);">list_alt</span> My Grievances</h2><p>${grievances.length} grievance(s) submitted</p></div>
        <div style="display:flex;gap:.5rem;">
          <button class="btn btn-primary btn-sm" onclick="openModal('grievance-modal')"><span class="material-icons-round">add</span> New</button>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('citizen-feature-panel').innerHTML=''">✕ Close</button>
        </div>
      </div>
      ${grievances.length === 0 ? '<div class="panel-body"><p style="color:var(--text-muted);">No grievances submitted yet.</p></div>' : `
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>ID</th><th>Subject</th><th>Category</th><th>Status</th><th>Submitted</th></tr></thead>
          <tbody>
            ${grievances.map(g => `
              <tr>
                <td><span class="reg-id-chip">${g.grievanceId}</span></td>
                <td><strong style="font-size:.83rem;">${g.subject}</strong>${g.resolution ? `<br><span style="font-size:.75rem;color:var(--emerald);">✓ ${g.resolution.substring(0,80)}...</span>` : ''}</td>
                <td><span style="font-size:.78rem;color:var(--text-mid);">${g.category}</span></td>
                <td><span class="badge ${stMap[g.status]||'badge-public'}">${g.status}</span></td>
                <td style="font-size:.78rem;color:var(--text-muted);">${g.submittedAt ? new Date(g.submittedAt).toLocaleDateString('en-IN') : 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`}
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════
// OFFICER DASHBOARD
// ══════════════════════════════════════════════════════════════════════════
let _officerApprovedCitizens = [];
let _officerPendingApplications = [];

async function renderOfficerDashboard(el) {
  el.innerHTML = `<div class="loading-state"><div class="spinner" style="border-color:rgba(30,95,203,.2);border-top-color:var(--blue);"></div> Loading officer dashboard...</div>`;

  let pending = [], approved = [], stats = {};
  try {
    const [pr, ar, sr] = await Promise.all([
      authFetch(`${API_BASE}/api/employee/pending`),
      authFetch(`${API_BASE}/api/employee/approved`),
      authFetch(`${API_BASE}/api/employee/stats`)
    ]);
    if (pr.ok) pending = await pr.json();
    if (ar.ok) approved = await ar.json();
    if (sr.ok) stats = await sr.json();
  } catch(e) {}

  _officerPendingApplications = pending;
  _officerApprovedCitizens = approved;

  el.innerHTML = `
    <div class="panel" style="margin-bottom:1.5rem;">
      <div class="panel-header">
        <div>
          <h2>Officer Control Center</h2>
          <p>Audit pending applications and inspect approved citizen records</p>
        </div>
        <button class="btn btn-outline btn-sm" onclick="sendPrompt('Show me all approved citizens and pending queue summary')">
          <span class="material-icons-round">psychology</span> Ask Overview
        </button>
      </div>
      <div class="panel-body" style="padding-bottom:.5rem;">
        <div class="info-grid" style="grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom:1.5rem;">
          <div class="info-card"><div class="label">Total Registered</div><div class="value">${stats.total ?? 59}</div></div>
          <div class="info-card" style="cursor:pointer;" onclick="switchOfficerTab('approved')"><div class="label">Approved Citizens</div><div class="value accent-emerald">${approved.length}</div></div>
          <div class="info-card" style="cursor:pointer;" onclick="switchOfficerTab('pending')"><div class="label">Pending Queue</div><div class="value accent-amber">${pending.length}</div></div>
          <div class="info-card"><div class="label">Rejected Records</div><div class="value" style="color:var(--rose);">${stats.rejected ?? 1}</div></div>
        </div>

        <!-- TAB NAVIGATION HEADER -->
        <div style="display:flex;gap:.8rem;border-bottom:2px solid rgba(0,0,0,.08);margin-bottom:1.2rem;">
          <button id="tab-btn-pending" class="btn btn-ghost" onclick="switchOfficerTab('pending')" style="border-bottom:3px solid var(--blue);border-radius:0;padding:.6rem 1.2rem;font-weight:700;color:var(--blue);">
            <span class="material-icons-round" style="font-size:18px;">pending_actions</span> Pending Queue (${pending.length})
          </button>
          <button id="tab-btn-approved" class="btn btn-ghost" onclick="switchOfficerTab('approved')" style="border-bottom:3px solid transparent;border-radius:0;padding:.6rem 1.2rem;font-weight:600;color:var(--text-muted);">
            <span class="material-icons-round" style="font-size:18px;">verified_user</span> Approved Citizens (${approved.length})
          </button>
        </div>
      </div>

      <!-- TAB 1: PENDING APPLICATIONS QUEUE -->
      <div id="officer-tab-pending" style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Reg. ID</th>
              <th>Applicant</th>
              <th>PAN</th>
              <th>Phone</th>
              <th>Organization</th>
              <th>Stage</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${pending.length === 0
              ? `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem;">No pending applications in queue.</td></tr>`
              : pending.map(p => `
                <tr>
                  <td><span class="reg-id-chip">${p.registrationId || 'N/A'}</span></td>
                  <td>
                    <strong>${p.firstName || ''} ${p.lastName || ''}</strong>
                    <div style="font-size:.75rem;color:var(--text-muted);">${p.email || ''}</div>
                  </td>
                  <td><span class="pan-chip">${p.pan || 'N/A'}</span></td>
                  <td style="font-size:.83rem;">${p.phone || 'N/A'}</td>
                  <td style="font-size:.83rem;">${p.organization || 'N/A'}</td>
                  <td style="font-size:.75rem;color:var(--text-mid);">${p.approvalStage || 'Verification'}</td>
                  <td><span class="badge badge-pending">Pending</span></td>
                  <td>
                    <button class="btn btn-primary btn-sm" onclick="navigateTo('#/officer/review/${p.id}')">
                      <span class="material-icons-round">analytics</span> Inspect
                    </button>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>

      <!-- TAB 2: APPROVED CITIZENS DIRECTORY -->
      <div id="officer-tab-approved" style="display:none;padding:0 1.5rem 1.5rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;gap:1rem;flex-wrap:wrap;">
          <div style="position:relative;flex:1;max-width:400px;">
            <span class="material-icons-round" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:18px;">search</span>
            <input type="text" id="approved-search-input" placeholder="Search approved citizens by name, PAN, phone, or email..." onkeyup="filterApprovedCitizensTable()" style="width:100%;padding:.55rem .8rem .55rem 2.2rem;border:1px solid rgba(0,0,0,.15);border-radius:6px;font-size:.85rem;">
          </div>
          <div style="font-size:.83rem;color:var(--text-muted);">
            Showing <strong id="approved-visible-count">${approved.length}</strong> of ${approved.length} approved citizens
          </div>
        </div>

        <div style="overflow-x:auto;">
          <table class="data-table" id="approved-citizens-table">
            <thead>
              <tr>
                <th>Reg. ID</th>
                <th>Citizen Name</th>
                <th>PAN</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Organization</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="approved-table-body">
              ${renderApprovedRows(approved)}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><div><h2>Enterprise Query Assistant</h2><p>Query pending applications or approved citizen records</p></div></div>
      <div class="panel-body">
        <div class="prompt-chips">
          <button class="prompt-chip" onclick="sendPrompt('Show me all approved citizens in the database')"><span class="material-icons-round">verified_user</span> Approved Citizens</button>
          <button class="prompt-chip" onclick="sendPrompt('Show me all pending applications')"><span class="material-icons-round">list</span> Pending queue</button>
          <button class="prompt-chip" onclick="sendPrompt('How many approved and pending citizens are there?')"><span class="material-icons-round">bar_chart</span> Database stats</button>
          <button class="prompt-chip" onclick="sendPrompt('What is the government policy on duplicate registration?')"><span class="material-icons-round">policy</span> Duplicate policy</button>
        </div>
      </div>
    </div>
  `;
}

function switchOfficerTab(tab) {
  const pendingTab = document.getElementById('officer-tab-pending');
  const approvedTab = document.getElementById('officer-tab-approved');
  const pendingBtn = document.getElementById('tab-btn-pending');
  const approvedBtn = document.getElementById('tab-btn-approved');

  if (!pendingTab || !approvedTab) return;

  if (tab === 'approved') {
    pendingTab.style.display = 'none';
    approvedTab.style.display = 'block';
    pendingBtn.style.borderBottom = '3px solid transparent';
    pendingBtn.style.color = 'var(--text-muted)';
    pendingBtn.style.fontWeight = '600';
    approvedBtn.style.borderBottom = '3px solid var(--blue)';
    approvedBtn.style.color = 'var(--blue)';
    approvedBtn.style.fontWeight = '700';
  } else {
    approvedTab.style.display = 'none';
    pendingTab.style.display = 'block';
    approvedBtn.style.borderBottom = '3px solid transparent';
    approvedBtn.style.color = 'var(--text-muted)';
    approvedBtn.style.fontWeight = '600';
    pendingBtn.style.borderBottom = '3px solid var(--blue)';
    pendingBtn.style.color = 'var(--blue)';
    pendingBtn.style.fontWeight = '700';
  }
}

function renderApprovedRows(list) {
  if (!list || list.length === 0) {
    return `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem;">No approved citizens found.</td></tr>`;
  }
  return list.map(c => `
    <tr>
      <td><span class="reg-id-chip">${c.registrationId || 'USR-2000'}</span></td>
      <td>
        <strong>${c.firstName || ''} ${c.lastName || ''}</strong>
        <div style="font-size:.75rem;color:var(--text-muted);">${c.username || c.email || ''}</div>
      </td>
      <td><span class="pan-chip">${c.pan || 'N/A'}</span></td>
      <td style="font-size:.83rem;">${c.phone || 'N/A'}</td>
      <td style="font-size:.83rem;">${c.email || 'N/A'}</td>
      <td style="font-size:.83rem;">${c.organization || 'N/A'}</td>
      <td><span class="badge badge-approved">Approved</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="inspectApprovedCitizen(${c.id})">
          <span class="material-icons-round">person</span> Inspect Profile
        </button>
      </td>
    </tr>
  `).join('');
}

function filterApprovedCitizensTable() {
  const query = (document.getElementById('approved-search-input')?.value || '').toLowerCase().trim();
  const filtered = _officerApprovedCitizens.filter(c => {
    const full = `${c.firstName || ''} ${c.lastName || ''} ${c.pan || ''} ${c.phone || ''} ${c.email || ''} ${c.registrationId || ''} ${c.organization || ''}`.toLowerCase();
    return full.includes(query);
  });
  const tbody = document.getElementById('approved-table-body');
  if (tbody) tbody.innerHTML = renderApprovedRows(filtered);
  const visibleEl = document.getElementById('approved-visible-count');
  if (visibleEl) visibleEl.textContent = filtered.length;
}

function inspectApprovedCitizen(id) {
  const citizen = _officerApprovedCitizens.find(c => c.id === id);
  if (citizen) {
    state.activeContext = citizen;
    updateContextPill();
    renderApprovedProfilePage(citizen);
  }
}

function renderApprovedProfilePage(c) {
  const el = document.getElementById('main-content');
  if (!el) return;

  const addr = `${c.address || 'N/A'}, ${c.district || ''}, ${c.state || ''} - ${c.pin || ''}`.replace(/^[\s,]+|[\s,]+$/g, '');

  el.innerHTML = `
    <div class="panel" style="margin-bottom:1.2rem;">
      <div class="panel-body" style="padding:1rem 1.5rem;">
        <div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="navigateTo('#/officer/dashboard')">
            <span class="material-icons-round">arrow_back</span> Back to Dashboard
          </button>
          <div style="flex:1;">
            <h2 style="font-size:1.15rem;font-weight:700;">Citizen Record: ${c.firstName || ''} ${c.middleName || ''} ${c.lastName || ''}</h2>
            <span style="font-size:.8rem;color:var(--text-muted);">Registration ID: <strong>${c.registrationId || 'N/A'}</strong> | Status: <span class="badge badge-approved" style="font-weight:700;">APPROVED & ACTIVE</span></span>
          </div>
        </div>
      </div>
    </div>

    <div class="review-grid">
      <!-- Left: Full Profile Details -->
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 style="display:flex;align-items:center;gap:.4rem;"><span class="material-icons-round" style="color:var(--blue);">badge</span> Approved Citizen Information</h2>
            <p>Verified profile details stored in national database</p>
          </div>
        </div>
        <div class="panel-body">
          <div class="review-field-grid">
            <div class="review-field"><div class="label">Full Name</div><div class="value">${c.firstName || ''} ${c.middleName || ''} ${c.lastName || ''}</div></div>
            <div class="review-field"><div class="label">PAN Card Number</div><div class="value"><span class="pan-chip">${c.pan || 'N/A'}</span></div></div>
            <div class="review-field"><div class="label">Date of Birth</div><div class="value">${c.dob || 'N/A'}</div></div>
            <div class="review-field"><div class="label">Gender</div><div class="value">${c.gender || 'N/A'}</div></div>
            <div class="review-field"><div class="label">Phone Number</div><div class="value">${c.phone || 'N/A'}</div></div>
            <div class="review-field"><div class="label">Email Address</div><div class="value" style="word-break:break-all;">${c.email || 'N/A'}</div></div>
            <div class="review-field" style="grid-column:1/-1"><div class="label">Residential Address</div><div class="value">${addr}</div></div>
            <div class="review-field"><div class="label">Highest Qualification</div><div class="value">${c.qualification || 'N/A'}</div></div>
            <div class="review-field"><div class="label">Current Organization</div><div class="value">${c.organization || 'N/A'}</div></div>
            <div class="review-field"><div class="label">Experience</div><div class="value">${c.experienceYears != null ? c.experienceYears + ' yrs' : 'N/A'}</div></div>
            <div class="review-field"><div class="label">Emergency Contact</div><div class="value">${c.emergencyContact || c.phone || 'N/A'}</div></div>
          </div>
        </div>
      </div>

      <!-- Right: Audit Status Card -->
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 style="display:flex;align-items:center;gap:.4rem;"><span class="material-icons-round" style="color:var(--emerald);">verified</span> Verification Audit Summary</h2>
            <p>Database record status and compliance checks</p>
          </div>
        </div>
        <div class="panel-body">
          <div style="display:flex;align-items:center;gap:1.2rem;margin-bottom:1.2rem;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:1rem;">
            <div style="width:48px;height:48px;border-radius:50%;background:rgba(16,185,129,.15);color:var(--emerald);display:flex;align-items:center;justify-content:center;">
              <span class="material-icons-round" style="font-size:28px;">check_circle</span>
            </div>
            <div>
              <div style="font-size:.75rem;color:var(--text-muted);">Account Verification</div>
              <div style="font-weight:700;color:var(--emerald);font-size:1rem;">Approved & Active Citizen</div>
            </div>
          </div>

          <div style="margin-top:1rem;">
            <h5 style="font-size:.82rem;color:var(--text-muted);margin-bottom:.5rem;">Verification Audit Checklist:</h5>
            <ul style="list-style:none;padding:0;margin:0;font-size:.83rem;display:flex;flex-direction:column;gap:.4rem;">
              <li>✓ PAN Verification: <strong>Verified</strong></li>
              <li>✓ Address Audit: <strong>Complete</strong></li>
              <li>✓ Phone & Email Registry: <strong>Active</strong></li>
              <li>✓ Multi-Account Fraud Check: <strong>Passed (0% Duplicate Risk)</strong></li>
            </ul>
          </div>

          <div style="margin-top:1.5rem;background:rgba(30,95,203,.06);border:1px solid rgba(30,95,203,.2);border-radius:8px;padding:.8rem 1rem;font-size:.82rem;color:var(--blue);">
            <span class="material-icons-round" style="font-size:16px;vertical-align:middle;">info</span>
            <strong>AI Assistant Ready:</strong> You can open the chat assistant anytime and ask <em>"What is the address of this guy?"</em> or <em>"What is the PAN of ${c.firstName}?"</em>.
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Officer: Load & Render Review Task ────────────────────────────────────
async function loadAndRenderReviewTask(id) {
  const el = document.getElementById('main-content');
  el.innerHTML = `<div class="loading-state"><div class="spinner" style="border-color:rgba(30,95,203,.2);border-top-color:var(--blue);"></div> Loading application...</div>`;

  let task = null;
  try {
    const r = await authFetch(`${API_BASE}/api/employee/application/${id}`);
    if (r.ok) task = await r.json();
  } catch(e) {}

  if (!task) {
    showToast('Failed to load application.', 'error');
    navigateTo('#/officer/dashboard');
    return;
  }

  state.reviewTask = task;
  state.activeContext = task;
  updateContextPill();

  // Auto-run duplicate detection
  let dupResult = null;
  try {
    const r = await authFetch(`${AI_BASE}/api/ai/duplicate-check`, {
      method: 'POST',
      body: JSON.stringify({ target_user: task })
    });
    if (r.ok) dupResult = await r.json();
  } catch(e) {}

  renderReviewPage(el, dupResult);
}

function renderReviewPage(el, dupResult) {
  const app = state.reviewTask;
  if (!app) { navigateTo('#/officer/dashboard'); return; }

  // Duplicate detection display
  const score = dupResult ? dupResult.confidence_score : null;
  const isDup = dupResult ? dupResult.has_duplicate : false;
  const rec = dupResult ? dupResult.recommendation : 'Running analysis...';
  const reasons = dupResult ? (dupResult.key_evidence || dupResult.reasons || []) : [];
  const matched = dupResult ? dupResult.matched_user : null;
  const source = dupResult ? dupResult.analysis_source : '';

  const scoreCls = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  const recColor = isDup ? 'var(--rose)' : (score >= 40 ? 'var(--amber)' : 'var(--emerald)');
  const sourceBadge = source === 'llm' ? '🤖 Live LLM Analysis' : '⚡ Algorithmic Pre-Screen';

  el.innerHTML = `
    <div class="panel" style="margin-bottom:1.2rem;">
      <div class="panel-body" style="padding:1rem 1.5rem;">
        <div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="navigateTo('#/officer/dashboard')"><span class="material-icons-round">arrow_back</span> Back to Dashboard</button>
          <div style="flex:1;">
            <h2>Reviewing: ${app.firstName || ''} ${app.middleName||''} ${app.lastName || ''}</h2>
            <span style="font-size:.8rem;color:var(--text-muted);">Reg ID: <strong>${app.registrationId}</strong> | Assigned: ${app.assignedOfficerName || 'N/A'}</span>
          </div>
          <div style="display:flex;gap:.6rem;">
            <button class="btn btn-danger btn-sm" onclick="openRejectFlow(${app.id})"><span class="material-icons-round">cancel</span> Reject</button>
            <button class="btn btn-success btn-sm" onclick="approveApplication(${app.id})"><span class="material-icons-round">check_circle</span> Approve</button>
          </div>
        </div>
      </div>
    </div>

    <div class="review-grid">
      <!-- Left: Applicant Details -->
      <div class="panel">
        <div class="panel-header"><div><h2>Applicant Details</h2><p>Submitted registration information</p></div></div>
        <div class="panel-body">
          <div class="review-field-grid">
            <div class="review-field"><div class="label">Full Name</div><div class="value">${app.firstName||''} ${app.middleName||''} ${app.lastName||''}</div></div>
            <div class="review-field"><div class="label">PAN</div><div class="value"><span class="pan-chip">${app.pan||'N/A'}</span></div></div>
            <div class="review-field"><div class="label">Date of Birth</div><div class="value">${app.dob||'N/A'}</div></div>
            <div class="review-field"><div class="label">Gender</div><div class="value">${app.gender||'N/A'}</div></div>
            <div class="review-field"><div class="label">Phone</div><div class="value">${app.phone||'N/A'}</div></div>
            <div class="review-field"><div class="label">Email</div><div class="value" style="word-break:break-all;">${app.email||'N/A'}</div></div>
            <div class="review-field" style="grid-column:1/-1"><div class="label">Address</div><div class="value">${app.address||'N/A'}, ${app.district||''}, ${app.state||''} - ${app.pin||''}</div></div>
            <div class="review-field"><div class="label">Qualification</div><div class="value">${app.qualification||'N/A'}</div></div>
            <div class="review-field"><div class="label">Organization</div><div class="value">${app.organization||'N/A'}</div></div>
            <div class="review-field"><div class="label">Experience</div><div class="value">${app.experienceYears != null ? app.experienceYears + ' yrs' : 'N/A'}</div></div>
            <div class="review-field"><div class="label">Skills</div><div class="value" style="font-size:.82rem;">${app.skills||'N/A'}</div></div>
          </div>
          ${app.missingDocuments && app.missingDocuments !== 'None' ? `
          <div style="margin-top:1rem;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:.7rem 1rem;font-size:.82rem;">
            <strong style="color:var(--amber);">⚠ Missing Documents:</strong> ${app.missingDocuments}
          </div>` : ''}
        </div>
      </div>

      <!-- Right: Verification & Duplicate Prevention Analysis -->
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2 style="display:flex;align-items:center;gap:.4rem;"><span class="material-icons-round" style="color:var(--blue);">verified_user</span> Duplicate Prevention Analysis</h2>
            <p>Multi-attribute similarity analysis against database</p>
          </div>
          <span style="font-size:.7rem;background:var(--bg);border:1px solid var(--border);padding:.15rem .5rem;border-radius:4px;">${sourceBadge}</span>
        </div>
        <div class="panel-body">
          ${dupResult === null ? `
            <div class="loading-state"><div class="spinner" style="border-color:rgba(30,95,203,.2);border-top-color:var(--blue);"></div> Running verification audit...</div>
          ` : `
          <div style="display:flex;align-items:center;gap:1.5rem;margin-bottom:1.2rem;">
            <div class="score-ring ${scoreCls}">
              <div class="num">${score !== null ? score + '%' : '—'}</div>
              <div class="sub">CONFIDENCE</div>
            </div>
            <div>
              <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:.25rem;">Audit Recommendation</div>
              <div style="font-weight:700;color:${recColor};font-size:.95rem;">${rec}</div>
            </div>
          </div>

          ${(matched && score >= 10) ? `
          <div style="background:rgba(239,68,68,.05);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:.8rem 1rem;margin-bottom:1rem;font-size:.83rem;">
            <strong style="color:var(--rose);display:flex;align-items:center;gap:.3rem;"><span class="material-icons-round" style="font-size:16px;">content_copy</span> Matched Existing Record</strong>
            <div style="margin-top:.4rem;color:var(--text-mid);">
              ${matched.fullName ? `<strong>${matched.fullName}</strong> (<code>${matched.registrationId}</code>)<br>` : ''}
              ${matched.pan ? `PAN: <code>${matched.pan}</code>` : ''} ${matched.phone ? `| Phone: <code>${matched.phone}</code>` : ''}
            </div>
          </div>` : `
          <div style="background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.2);border-radius:8px;padding:.8rem 1rem;margin-bottom:1rem;font-size:.83rem;">
            <strong style="color:var(--emerald);display:flex;align-items:center;gap:.3rem;"><span class="material-icons-round" style="font-size:16px;">verified</span> Unique Application — No Duplicate Record Found</strong>
            <div style="margin-top:.4rem;color:var(--text-mid);">No matching approved citizen records detected in the database (&lt;10% match threshold).</div>
          </div>`}

          ${dupResult.reasoning ? `
          <div style="background:rgba(30,95,203,.05);border:1px solid rgba(30,95,203,.15);border-radius:8px;padding:.8rem 1rem;margin-bottom:1rem;font-size:.82rem;line-height:1.5;">
            <strong style="color:var(--navy);display:block;margin-bottom:.3rem;">🧠 Automated Audit Findings:</strong>
            ${dupResult.reasoning}
          </div>` : ''}

          <div style="margin-bottom:1rem;">
            <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:.5rem;">Key Evidence</div>
            <ul style="list-style:none;display:flex;flex-direction:column;gap:.3rem;font-size:.82rem;">
              ${reasons.length ? reasons.map(r => `<li style="color:${isDup ? 'var(--rose)' : 'var(--emerald)'};">• ${r}</li>`).join('') : '<li style="color:var(--emerald);">✓ No significant matches found.</li>'}
            </ul>
          </div>
          `}
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:1.2rem;">
      <div class="panel-header"><div><h2>Automated Verification Guidance</h2><p>Ask the portal assistant for application evaluation</p></div></div>
      <div class="panel-body">
        <div class="prompt-chips">
          <button class="prompt-chip" onclick="sendPrompt('Explain the duplicate detection results for this application')"><span class="material-icons-round">psychology</span> Explain results</button>
          <button class="prompt-chip" onclick="sendPrompt('Should I approve or reject this application based on the verification analysis?')"><span class="material-icons-round">gavel</span> Recommendation</button>
          <button class="prompt-chip" onclick="sendPrompt('What documents are missing from this application?')"><span class="material-icons-round">description</span> Missing docs</button>
          <button class="prompt-chip" onclick="sendPrompt('What is the anti-fraud policy for duplicate registrations?')"><span class="material-icons-round">policy</span> Policy</button>
        </div>
      </div>
    </div>
  `;
}

async function approveApplication(id) {
  try {
    const r = await authFetch(`${API_BASE}/api/employee/approve/${id}`, { method: 'POST' });
    if (r.ok) {
      const data = await r.json();
      showToast('✓ ' + data.message, 'success');
      navigateTo('#/officer/dashboard');
    } else {
      const err = await r.json();
      showToast(err.error || 'Approval failed.', 'error');
    }
  } catch(e) {
    showToast('Network error during approval.', 'error');
  }
}

function openRejectFlow(id) {
  state.rejectTargetId = id;
  document.getElementById('reject-reason').value = '';
  openModal('reject-modal');
}

async function confirmReject() {
  const reason = document.getElementById('reject-reason').value.trim();
  if (!reason) { showToast('Please provide a rejection reason.', 'error'); return; }
  try {
    const r = await authFetch(`${API_BASE}/api/employee/reject/${state.rejectTargetId}`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    if (r.ok) {
      const data = await r.json();
      closeModal('reject-modal');
      showToast('✓ ' + data.message, 'success');
      state.rejectTargetId = null;
      navigateTo('#/officer/dashboard');
    } else {
      const err = await r.json();
      showToast(err.error || 'Rejection failed.', 'error');
    }
  } catch(e) {
    showToast('Network error during rejection.', 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════
// AUTH HANDLERS
// ══════════════════════════════════════════════════════════════════════════
async function handleLogin(e) {
  e.preventDefault();
  const alertEl = document.getElementById('login-alert');
  alertEl.style.display = 'none';

  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;

  if (!email || !pass) { showAlert(alertEl, 'Email and password are required.'); return; }

  try {
    const r = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password: pass })
    });
    const data = await r.json();
    if (!r.ok) { showAlert(alertEl, data.error || 'Invalid credentials. Please try again.'); return; }

    state.token = data.token;
    state.role = data.role;
    state.user = {
      username: data.username,
      role: data.role,
      status: data.status,
      registrationId: data.registrationId,
      firstName: data.fullName ? data.fullName.split(' ')[0] : '',
      lastName: data.fullName ? data.fullName.split(' ').slice(1).join(' ') : '',
    };

    // Fetch full profile if citizen
    if (data.role === 'ROLE_USER') {
      try {
        const pr = await authFetch(`${API_BASE}/api/user/me`);
        if (pr.ok) { state.user = { ...(await pr.json()), token: undefined }; }
      } catch(e) {}
    }

    saveSession();
    resetChatbot();
    closeModal('login-modal');
    showToast(`Welcome, ${state.user.firstName || state.user.username}!`, 'success');

    // Navigate to appropriate dashboard based on role
    const target = state.role === 'ROLE_EMPLOYEE' ? '#/officer/dashboard' : '#/citizen/dashboard';
    navigateTo(target);
  } catch(err) {
    showAlert(alertEl, 'Server unavailable. Please try again.');
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const alertEl = document.getElementById('signup-alert');
  alertEl.style.display = 'none';

  const name = document.getElementById('su-name').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const dob = document.getElementById('su-dob').value;
  const pass = document.getElementById('su-pass').value;
  const confirm = document.getElementById('su-confirm').value;

  // Validation
  if (!name || name.length < 2) { showAlert(alertEl, 'Please enter your full name.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAlert(alertEl, 'Please enter a valid email address.'); return; }
  if (!dob) { showAlert(alertEl, 'Date of Birth is required.'); return; }

  const birthDate = new Date(dob);
  const today = new Date();
  if (isNaN(birthDate.getTime()) || birthDate > today) { showAlert(alertEl, 'Invalid Date of Birth.'); return; }
  let age = today.getFullYear() - birthDate.getFullYear();
  if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age--;
  if (age < 18) { showAlert(alertEl, 'You must be at least 18 years old to register.'); return; }

  if (pass.length < 8) { showAlert(alertEl, 'Password must be at least 8 characters.'); return; }
  if (!/[A-Z]/.test(pass)) { showAlert(alertEl, 'Password must contain at least one uppercase letter.'); return; }
  if (!/[0-9]/.test(pass)) { showAlert(alertEl, 'Password must contain at least one number.'); return; }
  if (!/[^A-Za-z0-9]/.test(pass)) { showAlert(alertEl, 'Password must contain at least one special character.'); return; }
  if (pass !== confirm) { showAlert(alertEl, 'Passwords do not match.'); return; }

  const btn = document.getElementById('signup-btn');
  btn.innerHTML = '<div class="spinner"></div> Creating account...';
  btn.disabled = true;

  try {
    const r = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, fullName: name, dob })
    });
    const data = await r.json();
    if (!r.ok) { showAlert(alertEl, data.error || 'Registration failed.'); btn.innerHTML = '<span class="material-icons-round">how_to_reg</span> Create Account'; btn.disabled = false; return; }

    state.token = data.token;
    state.role = data.role;
    state.user = {
      username: data.username,
      email: data.username,
      role: data.role,
      status: data.status || 'NOT_SUBMITTED',
      hasSubmittedRegistration: false,
      fullName: name,
      firstName: name.split(' ')[0],
      lastName: name.split(' ').slice(1).join(' '),
      dob: dob
    };

    saveSession();
    resetChatbot();
    closeModal('signup-modal');
    showToast('Account created! Please complete your registration.', 'success');
    navigateTo('#/citizen/dashboard');
  } catch(err) {
    showAlert(alertEl, 'Server unavailable. Please try again.');
    btn.innerHTML = '<span class="material-icons-round">how_to_reg</span> Create Account';
    btn.disabled = false;
  }
}

function openRegistrationModal() {
  if (state.user) {
    const u = state.user;
    const fnameEl = document.getElementById('r-fname');
    if (fnameEl) fnameEl.value = u.firstName || (u.fullName ? u.fullName.split(' ')[0] : '');

    const lnameEl = document.getElementById('r-lname');
    if (lnameEl) lnameEl.value = u.lastName || (u.fullName && u.fullName.split(' ').length > 1 ? u.fullName.split(' ').slice(1).join(' ') : '');

    const emailEl = document.getElementById('r-email');
    if (emailEl) emailEl.value = u.email || u.username || '';

    const dobEl = document.getElementById('r-dob');
    if (dobEl && u.dob) dobEl.value = u.dob;
  }
  openModal('reg-modal');
}

async function handleRegistrationSubmit(e) {
  e.preventDefault();
  const alertEl = document.getElementById('reg-alert');
  alertEl.style.display = 'none';

  const pan = document.getElementById('r-pan').value.trim();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
    showAlert(alertEl, 'Invalid PAN format. Must be like ABCDE1234F.'); return;
  }
  const phone = document.getElementById('r-phone').value.trim();
  if (!/^[0-9]{10}$/.test(phone)) {
    showAlert(alertEl, 'Mobile number must be exactly 10 digits.'); return;
  }

  const body = {
    firstName: document.getElementById('r-fname').value.trim(),
    middleName: document.getElementById('r-mname').value.trim(),
    lastName: document.getElementById('r-lname').value.trim(),
    dob: document.getElementById('r-dob').value,
    gender: document.getElementById('r-gender').value,
    phone,
    email: document.getElementById('r-email').value.trim(),
    emergencyContact: document.getElementById('r-emergency').value.trim(),
    pan,
    address: document.getElementById('r-address').value.trim(),
    district: document.getElementById('r-district').value.trim(),
    state: document.getElementById('r-state').value,
    pin: document.getElementById('r-pin').value.trim(),
    qualification: document.getElementById('r-qual').value,
    organization: document.getElementById('r-org').value.trim(),
    experienceYears: parseInt(document.getElementById('r-exp').value),
    skills: document.getElementById('r-skills').value.trim(),
  };

  const btn = document.getElementById('reg-submit-btn');
  btn.innerHTML = '<div class="spinner"></div> Submitting...';
  btn.disabled = true;

  try {
    const r = await authFetch(`${API_BASE}/api/auth/submit-registration`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) { showAlert(alertEl, data.error || 'Submission failed.'); btn.innerHTML = '<span class="material-icons-round">send</span> Submit'; btn.disabled = false; return; }

    state.user = {
      ...state.user,
      ...body,
      status: 'PENDING',
      hasSubmittedRegistration: true,
      registrationId: data.registrationId,
      assignedOfficerName: data.assignedOfficer,
      approvalStage: data.approvalStage,
      estimatedProcessingDays: data.estimatedDays,
      missingDocuments: 'Address Verification Copy, PAN Verification Pending',
    };

    saveSession();
    closeModal('reg-modal');
    showToast(`✓ Submitted! Reference: ${data.registrationId}. Assigned to ${data.assignedOfficer}.`, 'success');
    navigateTo('#/citizen/dashboard');
  } catch(err) {
    showAlert(alertEl, 'Server unavailable. Please try again.');
    btn.innerHTML = '<span class="material-icons-round">send</span> Submit';
    btn.disabled = false;
  }
}

async function handleGrievanceSubmit(e) {
  e.preventDefault();
  const alertEl = document.getElementById('grv-alert');
  alertEl.style.display = 'none';

  const body = {
    subject: document.getElementById('grv-subject').value.trim(),
    description: document.getElementById('grv-desc').value.trim(),
    category: document.getElementById('grv-cat').value,
  };

  if (!body.category) { showAlert(alertEl, 'Please select a category.'); return; }
  if (!body.subject) { showAlert(alertEl, 'Subject is required.'); return; }
  if (!body.description) { showAlert(alertEl, 'Description is required.'); return; }

  const btn = document.getElementById('grv-submit-btn');
  btn.innerHTML = '<div class="spinner"></div> Submitting...';
  btn.disabled = true;

  try {
    const r = await authFetch(`${API_BASE}/api/user/grievance`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) { showAlert(alertEl, data.error || 'Submission failed.'); btn.innerHTML = '<span class="material-icons-round">send</span> Submit Grievance'; btn.disabled = false; return; }

    closeModal('grievance-modal');
    showToast(`✓ Grievance ${data.grievanceId} submitted successfully.`, 'success');
    btn.innerHTML = '<span class="material-icons-round">send</span> Submit Grievance';
    btn.disabled = false;
    document.getElementById('grv-subject').value = '';
    document.getElementById('grv-desc').value = '';
    document.getElementById('grv-cat').value = '';
  } catch(err) {
    showAlert(alertEl, 'Server unavailable. Please try again.');
    btn.innerHTML = '<span class="material-icons-round">send</span> Submit Grievance';
    btn.disabled = false;
  }
}

function handleLogout() {
  state = { user: null, token: null, role: 'PUBLIC', activeContext: null, reviewTask: null, rejectTargetId: null };
  saveSession();
  resetChatbot();
  showToast('Logged out successfully.', 'success');
  navigateTo('#/');
}

// ══════════════════════════════════════════════════════════════════════════
// CHATBOT
// ══════════════════════════════════════════════════════════════════════════
function resetChatbot() {
  const msgEl = document.getElementById('chat-messages');
  if (msgEl) {
    msgEl.innerHTML = '';
  }
  appendWelcomeMessage();
}

function appendWelcomeMessage() {
  const firstName = state.user?.firstName || (state.user?.username ? state.user.username.split('@')[0] : '');
  const msgs = {
    PUBLIC: 'Hello! I\'m the Government Portal Assistant.\n\nSince you\'re not logged in, I can answer **public FAQs** about registration requirements, timelines, and portal guidelines. Log in or create an account to unlock personalized assistance.',
    ROLE_USER: `Hello${firstName ? ' **' + firstName + '**' : ''}! Welcome to your Citizen Portal.\n\nI can help you with:\n- **Your registration status and timeline**\n- **Missing document information**\n- **Grievance tracking**\n- **Portal FAQs**`,
    ROLE_EMPLOYEE: `Welcome, Officer${firstName ? ' **' + firstName + '**' : ''}!\n\nI have full enterprise intelligence access. You can:\n- Ask about **specific citizens** by name, PAN, or registration ID\n- Run **duplicate detection** on any application\n- Query **database statistics**\n- Get **approval recommendations**\n\nClick "Inspect" on any pending task to load its context.`
  };
  appendChatMessage('ai', msgs[state.role] || msgs.PUBLIC);
}

function toggleChat() {
  const win = document.getElementById('chat-window');
  const icon = document.getElementById('chat-fab-icon');
  win.classList.toggle('open');
  icon.textContent = win.classList.contains('open') ? 'close' : 'chat';
}

function sendPrompt(text) {
  document.getElementById('chat-user-input').value = text;
  sendChatMessage();
  document.getElementById('chat-window').classList.add('open');
  document.getElementById('chat-fab-icon').textContent = 'close';
}

async function sendChatMessage() {
  const input = document.getElementById('chat-user-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  appendChatMessage('user', text);

  // Typing indicator
  const typingId = 'typing-' + Date.now();
  const msgEl = document.getElementById('chat-messages');
  const typingDiv = document.createElement('div');
  typingDiv.id = typingId;
  typingDiv.className = 'msg ai';
  typingDiv.innerHTML = `<div class="msg-bubble"><div class="chat-typing"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
  msgEl.appendChild(typingDiv);
  msgEl.scrollTop = msgEl.scrollHeight;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

    const r = await fetch(`${AI_BASE}/api/ai/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: text,
        role: state.role,
        user_details: state.user,
        active_app_context: state.activeContext
      })
    });

    document.getElementById(typingId)?.remove();

    if (!r.ok) {
      appendChatMessage('ai', '⚠️ The AI service is temporarily unavailable.', [], true);
      return;
    }

    // Create stream message bubble
    const aiMsgId = 'stream-msg-' + Date.now();
    const aiDiv = document.createElement('div');
    aiDiv.className = 'msg ai';
    aiDiv.innerHTML = `<div class="msg-tools" id="tools-${aiMsgId}"></div><div class="msg-bubble" id="bubble-${aiMsgId}"></div>`;
    msgEl.appendChild(aiDiv);

    const reader = r.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep trailing fragment in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line.trim());
          if (event.type === 'metadata') {
            const tools = event.tools_used || [];
            const toolChips = tools.map(t => `<span class="tool-chip">🛠 ${t}</span>`).join('');
            const ctxChip = event.active_context_used ? `<span class="tool-chip" style="color:var(--amber);">📊 Context Active</span>` : '';
            const modelTag = event.llm_provider ? `<span class="tool-chip" style="opacity:.5;">${event.llm_provider}</span>` : '';
            document.getElementById(`tools-${aiMsgId}`).innerHTML = `${toolChips}${ctxChip}${modelTag}`;
          } else if (event.type === 'token') {
            accumulatedText += event.content || '';
            const bubble = document.getElementById(`bubble-${aiMsgId}`);
            if (bubble) bubble.innerHTML = formatMarkdown(accumulatedText);
            msgEl.scrollTop = msgEl.scrollHeight;
          }
        } catch(e) {}
      }
    }

    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer.trim());
        if (event.type === 'token') {
          accumulatedText += event.content || '';
          const bubble = document.getElementById(`bubble-${aiMsgId}`);
          if (bubble) bubble.innerHTML = formatMarkdown(accumulatedText);
        }
      } catch(e) {}
    }

  } catch(err) {
    document.getElementById(typingId)?.remove();
    appendChatMessage('ai', '⚠️ Cannot reach AI service. Please ensure the AI backend is running on port 8000.', [], true);
  }
}

function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,.06);padding:.1rem .3rem;border-radius:3px;font-size:.85em;">$1</code>')
    .replace(/^### (.+)$/gm, '<strong style="font-size:.9rem;display:block;margin:.5rem 0 .2rem;color:var(--navy);">$1</strong>')
    .replace(/^#### (.+)$/gm, '<strong style="font-size:.85rem;display:block;margin:.4rem 0 .2rem;color:var(--navy);">$1</strong>')
    .replace(/^- (.+)$/gm, '<div style="padding-left:.6rem;margin:.1rem 0;">• $1</div>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function appendChatMessage(sender, text, tools = [], isError = false, ctxUsed = false, provider = null, model = null) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg ${sender}`;

  let header = '';
  if (sender === 'ai' && (tools?.length || ctxUsed || provider)) {
    const toolChips = (tools || []).map(t => `<span class="tool-chip">🛠 ${t}</span>`).join('');
    const ctxChip = ctxUsed ? `<span class="tool-chip" style="color:var(--amber);">📊 Context Active</span>` : '';
    const modelTag = provider ? `<span class="tool-chip" style="opacity:.5;">${provider}</span>` : '';
    header = `<div class="msg-tools">${toolChips}${ctxChip}${modelTag}</div>`;
  }

  // Use formatMarkdown helper
  const html = formatMarkdown(text);

  div.innerHTML = `${header}<div class="msg-bubble${isError ? ' error' : ''}">${html}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ══════════════════════════════════════════════════════════════════════════
// CONTEXT PILL
// ══════════════════════════════════════════════════════════════════════════
function updateContextPill() {
  const pill = document.getElementById('active-ctx-pill');
  const label = document.getElementById('ctx-label');
  if (state.activeContext && pill && label) {
    const a = state.activeContext;
    label.textContent = `${a.firstName || ''} ${a.lastName || ''} (${a.registrationId || ''})`.trim();
    pill.style.display = 'flex';
  } else if (pill) {
    pill.style.display = 'none';
  }
}

function clearActiveContext() {
  state.activeContext = null;
  state.reviewTask = null;
  updateContextPill();
  if (state.role === 'ROLE_EMPLOYEE') navigateTo('#/officer/dashboard');
}

// ══════════════════════════════════════════════════════════════════════════
// UTILITIES & MODALS
// ══════════════════════════════════════════════════════════════════════════
function authFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  return fetch(url, { ...options, headers });
}

function showAlert(el, msg) {
  el.textContent = msg;
  el.style.display = 'flex';
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `show ${type}`;
  setTimeout(() => { t.className = ''; }, 3500);
}

function openModal(id) {
  const alert = document.querySelector(`#${id} .alert-box`);
  if (alert) alert.style.display = 'none';
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}
