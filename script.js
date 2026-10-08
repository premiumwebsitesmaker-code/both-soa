/* ============================================================
   NIFCPL SOA CRM — Active + Closure + History (localStorage)
   ============================================================ */

const $ = (id) => document.getElementById(id);

// ---------- Utilities ----------
function inr(num) {
  const n = Number(num);
  const sign = n < 0 ? '-' : '';
  return sign + '₹' + Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function daysBetween(d1, d2) {
  if (!d1 || !d2) return 0;
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((new Date(d2) - new Date(d1)) / oneDay));
}

function addDays(dateStr, days) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ============================================================
//  LOCALSTORAGE HELPERS
// ============================================================
const STORAGE_KEY = 'nifcpl_soa_active';

function getSavedSOAs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Storage error:', e);
    return [];
  }
}

function saveSOAs(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function addSOA(record) {
  const list = getSavedSOAs();
  list.unshift(record); // newest first
  saveSOAs(list);
}

function deleteSOA(id) {
  const list = getSavedSOAs().filter(r => r.id !== id);
  saveSOAs(list);
}

function generateId() {
  return 'SOA_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// ============================================================
//  ACTIVE SOA LOGIC
// ============================================================
if ($('generateBtn')) {

  window.addEventListener('DOMContentLoaded', () => {
    $('statementDate').valueAsDate = new Date();
    renderHistory();
  });

  function calculateSOA() {
    const principal    = parseFloat($('principal').value) || 0;
    const disbDate     = $('disbursalDate').value;
    const stmtDate     = $('statementDate').value;
    const rateFirst    = parseFloat($('interestRate').value) || 4;
    const defaultRate  = parseFloat($('defaultRate').value) || 3;
    const penalBase    = parseFloat($('penalBase').value) || 1500;
    const finalOverdue = parseFloat($('finalOverdue').value) || 0;

    const first7Days   = 7;
    const totalDays    = daysBetween(disbDate, stmtDate);
    const postDueDays  = totalDays > 7 ? (totalDays - first7Days) : 0;

    const first7Interest  = principal * (rateFirst / 100) * (first7Days / 30);
    const postDueInterest = principal * (rateFirst / 100) * (postDueDays / 30);
    const total4Interest  = first7Interest + postDueInterest;
    const defaultInterest = principal * (defaultRate / 100) * (postDueDays / 30);

    const completedYears = Math.floor(totalDays / 365);
    const penalCharges   = penalBase * completedYears;

    const totalOutstanding = principal + total4Interest + defaultInterest + penalCharges;

    let waiver = totalOutstanding - finalOverdue;
    if (waiver < 0) waiver = 0;

    const netPayable = totalOutstanding - waiver;

    return {
      principal, disbDate, stmtDate, rateFirst, defaultRate, penalBase,
      first7Days, totalDays, postDueDays,
      first7Interest, postDueInterest, total4Interest,
      defaultInterest, penalCharges, completedYears,
      totalOutstanding, waiver, netPayable, finalOverdue
    };
  }

  // ---------- Build breakdown + ledger rows (reusable) ----------
  function buildBreakdownRows(data) {
    return [
      ['Principal', 'Disbursed Amount', data.principal, ''],
      [`First 7 Days Interest @ ${data.rateFirst}% p.m. SI`,
        `${data.principal.toFixed(2)} × ${data.rateFirst}% × 7/30`,
        data.first7Interest, ''],
      [`Post-Due Interest @ ${data.rateFirst}% p.m. SI`,
        `${data.principal.toFixed(2)} × ${data.rateFirst}% × ${data.postDueDays}/30`,
        data.postDueInterest, ''],
      [`Total ${data.rateFirst}% Interest`,
        `${inr(data.first7Interest)} + ${inr(data.postDueInterest)}`,
        data.total4Interest, 'total-row'],
      [`Default Interest @ ${data.defaultRate}% p.m. SI`,
        `${data.principal.toFixed(2)} × ${data.defaultRate}% × ${data.postDueDays}/30`,
        data.defaultInterest, ''],
      ['Penal Charges',
        `${inr(data.penalBase)} × ${data.completedYears} completed years`,
        data.penalCharges, ''],
      ['Total Outstanding Calculated',
        `${inr(data.principal)} + ${inr(data.total4Interest)} + ${inr(data.defaultInterest)} + ${inr(data.penalCharges)}`,
        data.totalOutstanding, 'total-row'],
      ['Concessionary Waiver / Adjustment',
        'Special Account Settlement Discount',
        -data.waiver, 'discount-row'],
      ['Net Outstanding Overdue Payable',
        'Final Payable Balance',
        data.netPayable, 'final-row']
    ];
  }

  function buildLedgerRows(data) {
    const disbFmt = fmtDate(data.disbDate);
    const stmtFmt = fmtDate(data.stmtDate);

    return [
      [disbFmt, 'Loan Disbursal Principal', data.principal, data.principal],
      [addDays(data.disbDate, 7), 'Contractual Interest (First 7 Days)', data.first7Interest, data.principal + data.first7Interest],
      [`${addDays(data.disbDate, 7)} – ${stmtFmt}`, `Overdue Interest @ ${data.rateFirst}% p.m.`, data.postDueInterest, data.principal + data.first7Interest + data.postDueInterest],
      [`${addDays(data.disbDate, 7)} – ${stmtFmt}`, `Default Interest @ ${data.defaultRate}% p.m.`, data.defaultInterest, data.principal + data.total4Interest + data.defaultInterest],
      [stmtFmt, `Penal Charges (${data.completedYears} Completed Years)`, data.penalCharges, data.totalOutstanding],
      [stmtFmt, 'Concessionary Waiver Adjustment', -data.waiver, data.netPayable]
    ];
  }

  // ---------- Render breakdown into DOM ----------
  function renderBreakdown(rows, tbodyId) {
    let html = '';
    rows.forEach(r => {
      html += `<tr class="${r[3]}">
        <td>${r[0]}</td>
        <td>${r[1]}</td>
        <td class="right">${inr(r[2])}</td>
      </tr>`;
    });
    $(tbodyId).innerHTML = html;
  }

  function renderLedger(rows, tbodyId, netPayable, status) {
    let html = '';
    rows.forEach(r => {
      html += `<tr>
        <td>${r[0]}</td>
        <td>${r[1]}</td>
        <td class="right">${inr(r[2])}</td>
        <td class="right">${inr(r[3])}</td>
      </tr>`;
    });
    html += `<tr class="final-row">
      <td colspan="3">Net Outstanding Balance</td>
      <td class="right">${inr(netPayable)} (${status})</td>
    </tr>`;
    $(tbodyId).innerHTML = html;
  }

  // ---------- Generate Active SOA ----------
  function renderSOA() {
    // Basic validation
    if (!$('disbursalDate').value) { alert('Please select Date of Disbursal'); return; }
    if (!$('statementDate').value) { alert('Please select Statement Date'); return; }
    if (!parseFloat($('principal').value)) { alert('Please enter Principal Amount'); return; }
    if (!parseFloat($('finalOverdue').value)) { alert('Please enter Final Overdue Amount'); return; }

    const data = calculateSOA();

    // Fill header
    $('outName').textContent     = ($('customerName').value || '').trim() || '—';
    $('outPan').textContent      = ($('panNumber').value || '').trim().toUpperCase() || '—';
    $('outStatus').textContent   = ($('accountStatus').value || '').trim() || '—';
    $('outDisbDate').textContent = fmtDate(data.disbDate);

    // Fill tables
    renderBreakdown(buildBreakdownRows(data), 'breakdownBody');
    const status = ($('accountStatus').value || '').trim() || 'DEFAULT';
    renderLedger(buildLedgerRows(data), 'ledgerBody', data.netPayable, status);

    // ---------- SAVE TO LOCALSTORAGE ----------
    const record = {
      id: generateId(),
      savedOn: new Date().toISOString(),
      customerName: ($('customerName').value || '').trim() || '—',
      panNumber: ($('panNumber').value || '').trim().toUpperCase() || '—',
      accountStatus: status,
      principal: data.principal,
      disbDate: data.disbDate,
      stmtDate: data.stmtDate,
      rateFirst: data.rateFirst,
      defaultRate: data.defaultRate,
      penalBase: data.penalBase,
      finalOverdue: data.finalOverdue,
      // Save all computed values so re-view is instant
      computed: {
        first7Interest: data.first7Interest,
        postDueInterest: data.postDueInterest,
        total4Interest: data.total4Interest,
        defaultInterest: data.defaultInterest,
        penalCharges: data.penalCharges,
        completedYears: data.completedYears,
        postDueDays: data.postDueDays,
        totalOutstanding: data.totalOutstanding,
        waiver: data.waiver,
        netPayable: data.netPayable
      }
    };
    addSOA(record);

    // Show preview
    $('soaPreview').classList.remove('hidden');
    $('soaPreview').scrollIntoView({ behavior: 'smooth' });

    // Refresh history table (so it's up to date)
    renderHistory();
  }

  $('generateBtn').addEventListener('click', renderSOA);

  // ---------- Download Active PDF ----------
  async function downloadActivePDF() {
    const { jsPDF } = window.jspdf;
    const element = $('soaContent');
    await new Promise(r => setTimeout(r, 250));

    const canvas = await html2canvas(element, {
      scale: 2.5, useCORS: true,
      backgroundColor: '#ffffff', logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth  = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imgWidth  = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
    }

    const name = ($('customerName').value || 'Customer').trim().replace(/\s+/g, '_') || 'Customer';
    const pan  = ($('panNumber').value || 'PAN').trim().toUpperCase() || 'PAN';
    const date = new Date().toISOString().slice(0, 10);
    pdf.save(`Active_SOA_${name}_${pan}_${date}.pdf`);
  }

  $('downloadPdfBtn').addEventListener('click', downloadActivePDF);
  $('editBtn').addEventListener('click', () => {
    $('soaPreview').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('printBtn').addEventListener('click', () => window.print());

  // ============================================================
  //  TABS SWITCHING
  // ============================================================
  $('tabGenerate').addEventListener('click', () => {
    $('tabGenerate').classList.add('active');
    $('tabHistory').classList.remove('active');
    $('generateSection').classList.remove('hidden');
    $('historySection').classList.add('hidden');
  });

  $('tabHistory').addEventListener('click', () => {
    $('tabHistory').classList.add('active');
    $('tabGenerate').classList.remove('active');
    $('historySection').classList.remove('hidden');
    $('generateSection').classList.add('hidden');
    renderHistory();
  });

  // ============================================================
  //  HISTORY RENDERING
  // ============================================================
  function renderHistory() {
    const list = getSavedSOAs();
    const query = ($('searchInput').value || '').trim().toLowerCase();

    const filtered = query
      ? list.filter(r =>
          (r.customerName || '').toLowerCase().includes(query) ||
          (r.panNumber || '').toLowerCase().includes(query)
        )
      : list;

    $('totalCount').textContent = list.length;
    $('showingCount').textContent = filtered.length;

    const tbody = $('historyBody');

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-msg">${
        query ? 'No matching records found.' : 'No saved SOA yet. Generate one to see it here.'
      }</td></tr>`;
      return;
    }

    let html = '';
    filtered.forEach((r, i) => {
      const savedDate = new Date(r.savedOn).toLocaleString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      html += `<tr>
        <td>${i + 1}</td>
        <td><b>${r.customerName}</b></td>
        <td>${r.panNumber}</td>
        <td>${fmtDate(r.disbDate)}</td>
        <td>${fmtDate(r.stmtDate)}</td>
        <td class="right"><b>${inr(r.computed.netPayable)}</b></td>
        <td style="font-size:11px; color:#64748b;">${savedDate}</td>
        <td>
          <button class="btn-view" data-id="${r.id}">👁 View</button>
          <button class="btn-pdf" data-id="${r.id}">⬇ PDF</button>
          <button class="btn-del" data-id="${r.id}">🗑 Del</button>
        </td>
      </tr>`;
    });
    tbody.innerHTML = html;

    // Attach event listeners
    tbody.querySelectorAll('.btn-view').forEach(b => {
      b.addEventListener('click', () => viewSOA(b.dataset.id));
    });
    tbody.querySelectorAll('.btn-pdf').forEach(b => {
      b.addEventListener('click', () => {
        viewSOA(b.dataset.id, true);
      });
    });
    tbody.querySelectorAll('.btn-del').forEach(b => {
      b.addEventListener('click', () => {
        if (confirm('Delete this SOA record? This cannot be undone.')) {
          deleteSOA(b.dataset.id);
          renderHistory();
        }
      });
    });
  }

  // Search live filter
  $('searchInput').addEventListener('input', renderHistory);

  $('clearSearchBtn').addEventListener('click', () => {
    $('searchInput').value = '';
    renderHistory();
  });

  // ============================================================
  //  VIEW SAVED SOA
  // ============================================================
  function viewSOA(id, autoDownload = false) {
    const list = getSavedSOAs();
    const r = list.find(x => x.id === id);
    if (!r) { alert('Record not found'); return; }

    // Fill preview
    $('hName').textContent     = r.customerName;
    $('hPan').textContent      = r.panNumber;
    $('hStatus').textContent   = r.accountStatus;
    $('hDisbDate').textContent = fmtDate(r.disbDate);

    // Reconstruct data object for rendering
    const data = {
      principal: r.principal,
      disbDate: r.disbDate,
      stmtDate: r.stmtDate,
      rateFirst: r.rateFirst,
      defaultRate: r.defaultRate,
      penalBase: r.penalBase,
      finalOverdue: r.finalOverdue,
      ...r.computed
    };

    renderBreakdown(buildBreakdownRows(data), 'hBreakdownBody');
    renderLedger(buildLedgerRows(data), 'hLedgerBody', data.netPayable, r.accountStatus);

    // Show
    $('historyPreview').classList.remove('hidden');
    $('historyPreview').scrollIntoView({ behavior: 'smooth' });

    // Auto-download if PDF button clicked
    if (autoDownload) {
      setTimeout(() => downloadHistoryPDF(r), 300);
    }
  }

  $('closeHistoryPreviewBtn').addEventListener('click', () => {
    $('historyPreview').classList.add('hidden');
  });

  // ---------- Download from History Preview ----------
  async function downloadHistoryPDF(r) {
    const { jsPDF } = window.jspdf;
    const element = $('historyContent');
    await new Promise(res => setTimeout(res, 250));

    const canvas = await html2canvas(element, {
      scale: 2.5, useCORS: true,
      backgroundColor: '#ffffff', logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth  = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imgWidth  = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
    }

    const name = (r.customerName || 'Customer').replace(/\s+/g, '_');
    const pan  = (r.panNumber || 'PAN').toUpperCase();
    const date = new Date().toISOString().slice(0, 10);
    pdf.save(`Active_SOA_${name}_${pan}_${date}.pdf`);
  }

  $('downloadHistoryPdfBtn').addEventListener('click', () => {
    // Find currently viewed record
    const visible = $('historyPreview').classList.contains('hidden');
    if (visible) return;
    // We don't track id directly — grab from hPan+hName match
    // Simpler: download current preview
    downloadCurrentPreviewPDF();
  });

  async function downloadCurrentPreviewPDF() {
    const { jsPDF } = window.jspdf;
    const element = $('historyContent');
    await new Promise(res => setTimeout(res, 250));

    const canvas = await html2canvas(element, {
      scale: 2.5, useCORS: true,
      backgroundColor: '#ffffff', logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth  = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imgWidth  = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
    }

    const name = ($('hName').textContent || 'Customer').replace(/\s+/g, '_');
    const pan  = ($('hPan').textContent || 'PAN').toUpperCase();
    const date = new Date().toISOString().slice(0, 10);
    pdf.save(`Active_SOA_${name}_${pan}_${date}.pdf`);
  }

  // Expose for history preview "Download PDF" button
  window.downloadCurrentPreviewPDF = downloadCurrentPreviewPDF;
}
