/* ============================================================
   NIFCPL SOA CRM — Active + Closure Logic
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
//  ACTIVE SOA LOGIC (only runs on index.html)
// ============================================================
if ($('generateBtn')) {

  window.addEventListener('DOMContentLoaded', () => {
    $('statementDate').valueAsDate = new Date();
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

  function renderSOA() {
    const data = calculateSOA();

    $('outName').textContent     = ($('customerName').value || '').trim() || '—';
    $('outPan').textContent      = ($('panNumber').value || '').trim().toUpperCase() || '—';
    $('outStatus').textContent   = ($('accountStatus').value || '').trim() || '—';
    $('outDisbDate').textContent = fmtDate(data.disbDate);

    const disbFmt = fmtDate(data.disbDate);
    const stmtFmt = fmtDate(data.stmtDate);

    // Breakdown
    const rows = [
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

    let html = '';
    rows.forEach(r => {
      html += `<tr class="${r[3]}">
        <td>${r[0]}</td>
        <td>${r[1]}</td>
        <td class="right">${inr(r[2])}</td>
      </tr>`;
    });
    $('breakdownBody').innerHTML = html;

    // Ledger
    const led = [
      [disbFmt, 'Loan Disbursal Principal', data.principal, data.principal],
      [addDays(data.disbDate, 7), 'Contractual Interest (First 7 Days)', data.first7Interest, data.principal + data.first7Interest],
      [`${addDays(data.disbDate, 7)} – ${stmtFmt}`, `Overdue Interest @ ${data.rateFirst}% p.m.`, data.postDueInterest, data.principal + data.first7Interest + data.postDueInterest],
      [`${addDays(data.disbDate, 7)} – ${stmtFmt}`, `Default Interest @ ${data.defaultRate}% p.m.`, data.defaultInterest, data.principal + data.total4Interest + data.defaultInterest],
      [stmtFmt, `Penal Charges (${data.completedYears} Completed Years)`, data.penalCharges, data.totalOutstanding],
      [stmtFmt, 'Concessionary Waiver Adjustment', -data.waiver, data.netPayable]
    ];

    let lhtml = '';
    led.forEach(r => {
      lhtml += `<tr>
        <td>${r[0]}</td>
        <td>${r[1]}</td>
        <td class="right">${inr(r[2])}</td>
        <td class="right">${inr(r[3])}</td>
      </tr>`;
    });

    const status = ($('accountStatus').value || '').trim() || 'DEFAULT';
    lhtml += `<tr class="final-row">
      <td colspan="3">Net Outstanding Balance</td>
      <td class="right">${inr(data.netPayable)} (${status})</td>
    </tr>`;
    $('ledgerBody').innerHTML = lhtml;

    $('soaPreview').classList.remove('hidden');
    $('soaPreview').scrollIntoView({ behavior: 'smooth' });
  }

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

  $('generateBtn').addEventListener('click', renderSOA);
  $('downloadPdfBtn').addEventListener('click', downloadActivePDF);
  $('editBtn').addEventListener('click', () => {
    $('soaPreview').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('printBtn').addEventListener('click', () => window.print());
}

// ============================================================
//  CLOSURE SOA LOGIC (only runs on closure.html)
// ============================================================
if ($('generateClosureBtn')) {

  window.addEventListener('DOMContentLoaded', () => {
    // Add 1 default payment row
    addPaymentRow();
  });

  // ---------- Payment Rows ----------
  function addPaymentRow(date = '', mode = '', ref = '', amt = '') {
    const tbody = $('paymentBody');
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td><input type="date" class="pay-date" value="${date}" /></td>
      <td>
        <select class="pay-mode" style="width:100%; padding:8px 10px; border:1.5px solid #cbd5e0; border-radius:6px; font-size:13px; background:#f9fbfd;">
          <option value="">Select Mode</option>
          <option value="Cash" ${mode === 'Cash' ? 'selected' : ''}>Cash</option>
          <option value="UPI" ${mode === 'UPI' ? 'selected' : ''}>UPI</option>
          <option value="NEFT" ${mode === 'NEFT' ? 'selected' : ''}>NEFT</option>
          <option value="RTGS" ${mode === 'RTGS' ? 'selected' : ''}>RTGS</option>
          <option value="Cheque" ${mode === 'Cheque' ? 'selected' : ''}>Cheque</option>
          <option value="DD" ${mode === 'DD' ? 'selected' : ''}>DD</option>
          <option value="Bank Transfer" ${mode === 'Bank Transfer' ? 'selected' : ''}>Bank Transfer</option>
        </select>
      </td>
      <td><input type="text" class="pay-ref" placeholder="e.g. TXN12345" value="${ref}" /></td>
      <td class="right"><input type="number" class="pay-amount" step="0.01" placeholder="0.00" value="${amt}" style="text-align:right;" /></td>
      <td><button class="btn-remove" onclick="this.closest('tr').remove()">✕</button></td>
    `;
    tbody.appendChild(tr);
  }

  $('addPaymentBtn').addEventListener('click', () => addPaymentRow());

  // ---------- Generate Closure SOA ----------
  function renderClosure() {
    const cName        = ($('cCustomerName').value || '').trim() || '—';
    const cPan         = ($('cPanNumber').value || '').trim().toUpperCase() || '—';
    const cPrincipal   = parseFloat($('cPrincipal').value) || 0;
    const cDisbDate    = $('cDisbursalDate').value;
    const cClosureDate = $('cClosureDate').value;
    const cOverdue     = parseFloat($('cTotalOverdue').value) || 0;
    const cDiscount    = parseFloat($('cDiscount').value) || 0;
    const cSettled     = parseFloat($('cSettledAmount').value) || 0;

    // Fill SOA header
    $('outCName').textContent     = cName;
    $('outCPan').textContent      = cPan;
    $('outCDisbDate').textContent = fmtDate(cDisbDate);
    $('outCCloseDate2').textContent = fmtDate(cClosureDate);
    $('outCCloseDate3').textContent = fmtDate(cClosureDate);
    $('outCName2').textContent    = cName;
    $('outClosureDate').textContent = `Closed on ${fmtDate(cClosureDate)}`;

    // ---------- Payment History ----------
    const payRows = $('paymentBody').querySelectorAll('tr');
    let payHtml = '';
    let totalPaid = 0;
    let srNo = 1;

    payRows.forEach(tr => {
      const date = tr.querySelector('.pay-date').value;
      const mode = tr.querySelector('.pay-mode').value;
      const ref  = tr.querySelector('.pay-ref').value.trim();
      const amt  = parseFloat(tr.querySelector('.pay-amount').value) || 0;

      if (date || mode || ref || amt > 0) {
        totalPaid += amt;
        payHtml += `<tr>
          <td>${srNo++}</td>
          <td>${fmtDate(date)}</td>
          <td>${mode || '—'}</td>
          <td>${ref || '—'}</td>
          <td class="right">${inr(amt)}</td>
        </tr>`;
      }
    });

    if (!payHtml) {
      payHtml = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px;">No payment records added</td></tr>`;
    }

    $('outPaymentBody').innerHTML = payHtml;

    // ---------- Summary ----------
    $('outTotalOverdue').textContent  = inr(cOverdue);
    $('outTotalDiscount').textContent = '- ' + inr(cDiscount);
    $('outNetSettled').textContent    = inr(cSettled);
    $('outTotalPaid').textContent     = inr(totalPaid);

    // Show preview
    $('closurePreview').classList.remove('hidden');
    $('closurePreview').scrollIntoView({ behavior: 'smooth' });
  }

  $('generateClosureBtn').addEventListener('click', renderClosure);

  // ---------- Download Closure PDF ----------
  async function downloadClosurePDF() {
    const { jsPDF } = window.jspdf;
    const element = $('closureContent');
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

    const name = ($('cCustomerName').value || 'Customer').trim().replace(/\s+/g, '_') || 'Customer';
    const pan  = ($('cPanNumber').value || 'PAN').trim().toUpperCase() || 'PAN';
    const date = new Date().toISOString().slice(0, 10);
    pdf.save(`Closure_SOA_${name}_${pan}_${date}.pdf`);
  }

  $('downloadClosurePdfBtn').addEventListener('click', downloadClosurePDF);
  $('editClosureBtn').addEventListener('click', () => {
    $('closurePreview').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('printClosureBtn').addEventListener('click', () => window.print());
}