<template>
  <div class="dashboard-container">
    <!-- Non-blocking Status Toast / Banner -->
    <div v-if="statusBanner.message" class="status-banner" :class="`status-${statusBanner.type}`" role="status">
      <span>{{ statusBanner.message }}</span>
      <button type="button" class="banner-close" @click="clearStatusBanner" aria-label="Dismiss">&times;</button>
    </div>

    <!-- Header Controls -->
    <header class="dashboard-top-header">
      <!-- Left: Scan QR Action -->
      <div class="top-left-device-badge">
        <span class="device-dot"></span>
        <button type="button" class="left-device-badge" :disabled="isProcessing" @click.prevent="openScanModal">
          Scan QR Code
        </button>
      </div>

      <!-- Right: Active Device Filter Badge & Quick Refresh -->
      <div class="header-right-toolbar">
        <button type="button" class="top-left-device-badge filter-clickable-badge"
          :class="{ inactive: !filterByCurrentDevice }" @click="filterByCurrentDevice = !filterByCurrentDevice"
          title="Click to toggle device filter">
          <span class="device-dot" :class="{ 'dot-inactive': !filterByCurrentDevice }"></span>
          Active Device: <strong>{{ operatorName }}</strong>
          <span class="filter-status-text">({{ filterByCurrentDevice ? 'Filtered' : 'All Devices' }})</span>
        </button>

        <button type="button" class="btn-refresh" :disabled="isLoadingRecords" @click="refreshRecords(true, true)"
          title="Refresh records">
          {{ isLoadingRecords ? 'Syncing...' : 'Refresh' }}
        </button>
      </div>
    </header>

    <!-- Main Tab Navigation -->
    <div class="tabs-container">
      <button type="button" class="tab-btn" :class="{ active: activeTab === 'records' }" @click="activeTab = 'records'">
        Daily NPT Records
      </button>
      <button type="button" class="tab-btn" :class="{ active: activeTab === 'summary' }" @click="activeTab = 'summary'">
        Monthly Summary Report
      </button>
    </div>

    <!-- Excel Sheet 1: Daily NPT Records & Child Tabs -->
    <div v-if="activeTab === 'records'" class="records-tab-content">
      <div class="sub-tabs-container">
        <button type="button" class="tab-btn sub-tab-btn" :class="{ active: activeDailySubTab === 'table_charts' }"
          @click="activeDailySubTab = 'table_charts'">
           Daily NPT Report
        </button>
        <button type="button" class="tab-btn sub-tab-btn" :class="{ active: activeDailySubTab === 'day_wise' }"
          @click="activeDailySubTab = 'day_wise'">
          Day-wise Bar Chart Analysis
        </button>
      </div>

      <!-- Sub-Tab Content 1: Daily Table & Charts -->
      <div v-if="activeDailySubTab === 'table_charts'">
        <div class="excel-sheet-wrapper">
          <table class="excel-table">
            <thead>
              <tr>
                <th class="row-index-header">#</th>
                <th v-for="header in HEADERS" :key="header" class="excel-cell-header">
                  {{ formatHeader(header) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="isLoadingRecords && records.length === 0">
                <td :colspan="HEADERS.length + 1" class="no-data">Loading daily NPT records...</td>
              </tr>
              <tr v-else v-for="(record, index) in filteredRecords" :key="record.ID || record.rowIndex || index"
                class="excel-row">
                <td class="row-index-cell">{{ index + 1 }}</td>
                <td v-for="header in HEADERS" :key="header" class="excel-cell">
                  <span v-if="header === 'QRcode'" class="badge badge-code">{{ record[header] || '-' }}</span>
                  <span v-else-if="header === 'Ttl_Time'" class="badge badge-ttl">{{ record[header] || '-' }}</span>
                  <span v-else-if="header === 'Duration_time'">{{ getFormattedDurationCell(record) }}</span>
                  <span v-else-if="header === 'Status'" :class="getStatusBadgeClass(record[header])">
                    {{ record[header] || '-' }}
                  </span>
                  <span v-else>{{ hasDisplayValue(record[header]) ? record[header] : '-' }}</span>
                </td>
              </tr>
              <tr v-if="!isLoadingRecords && filteredRecords.length === 0">
                <td :colspan="HEADERS.length + 1" class="no-data">
                  No records found for {{ todayDateStr }}. Click "Scan QR Code" to log an issue.
                </td>
              </tr>
            </tbody>
            <!-- Grand Total Footer Row -->
            <tfoot v-if="filteredRecords.length > 0">
              <tr class="excel-row grand-total-row">
                <td class="row-index-header font-bold">Σ</td>
                <td :colspan="HEADERS.indexOf('Ttl_Time')" class="excel-cell text-right font-bold">
                  Grand Total Lost Time & Pieces (SMV: {{ AVG_SMV }}):
                </td>
                <td class="excel-cell font-bold badge-ttl-total">
                  {{ grandTotalTtlTime }} mins (≈ {{ grandTotalLostPieces }} pcs)
                </td>
                <td :colspan="Math.max(0, HEADERS.length - HEADERS.indexOf('Ttl_Time') - 1)" class="excel-cell"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Bar Charts Section -->
        <div class="charts-row" v-if="filteredRecords.length > 0">
          <div class="chart-col">
            <div class="chart-container-wrapper">
              <div class="chart-header-title"> Daily Line Wise ( Loss Minute & Pcs)</div>
              <div class="chart-canvas-box">
                <Bar :data="DailyLineWiseBarChart" :options="barChartOptions" />
              </div>
            </div>
          </div>
        </div>
            <div class="charts-row" v-if="filteredRecords.length > 0">
          <div class="chart-col">
            <div class="chart-container-wrapper">
              <div class="chart-header-title">QR Code Wise Breakdown (Minutes vs Taka)</div>
              <div class="chart-canvas-box">
                <Bar :data="problemBarChartData" :options="barChartOptions" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sub-Tab Content 2: Day-wise Bar Chart Analysis -->
      <div v-if="activeDailySubTab === 'day_wise'">
        <div class="charts-row" style="margin-top: 16px;" v-if="records.length > 0">
          <div class="chart-col" style="flex: 1; min-width: 320px;">
            <div class="chart-container-wrapper">
              <div class="chart-header-title">Day-wise NPT Impact Analysis (Lost Minutes vs Financial Loss)</div>
              <div class="chart-canvas-box" style="height: 340px;">
                <Bar :data="dayWiseBarChartData" :options="barChartOptions" />
              </div>
            </div>
          </div>
        </div>
        <div v-if="records.length === 0" class="no-data" style="margin-top: 20px;">
          No historical records available for day-wise analysis.
        </div>
      </div>
    </div>

    <!-- Excel Sheet 2: Monthly Summary Report -->
    <div v-if="activeTab === 'summary'" class="summary-tab-content">
      <div class="sub-tabs-container">
        <button type="button" class="tab-btn sub-tab-btn" :class="{ active: activeMonthlySubTab === 'trends' }"
          @click="activeMonthlySubTab = 'trends'">
          Multi-Month Trends
        </button>
      </div>

      <div v-if="activeMonthlySubTab === 'trends'" class="excel-sheet-wrapper">
        <div class="charts-row" style="margin-top: 16px;" v-if="records.length > 0">
          <div class="chart-col" style="flex: 1; min-width: 320px;">
            <div class="chart-container-wrapper">
              <div class="chart-header-title">Monthly Lost Minutes Comparison</div>
              <div class="chart-canvas-box" style="height: 280px;">
                <Line :data="monthlyMultiLineMinutesChartData" :options="lineChartMinutesOptions" />
              </div>
            </div>
          </div>
        </div>
        <div v-else class="no-data" style="margin-top: 20px;">
          No records available for monthly trend comparison.
        </div>
      </div>
    </div>

    <!-- Mobile QR Camera Scanner Modal -->
    <div v-if="showScanModal" class="modal-overlay" @click.self="closeScanModal">
      <div class="modal-content scanner-modal" @click.stop>
        <button type="button" class="btn-close-absolute" @click.prevent="closeScanModal" aria-label="Close modal">
          &times;
        </button>

        <div class="pipup-device-badge modal-corner-badge">
          <span class="device-dot"></span> Active Device: <strong>{{ operatorName }}</strong>
        </div>

        <h3>Scan QR Code</h3>
        <p class="scanner-desc">Select Time Action first.</p>

        <!-- Step 1: Time Action Field -->
        <div class="form-group">
          <label for="timeAction">Time Action:</label>
          <select id="timeAction" v-model="selectedTimeRange" :disabled="isProcessing" @change="onTimeActionChange"
            class="form-control">
            <option disabled value="">Select time action...</option>
            <option value="start">Start Time (Log New Issue)</option>
            <option value="end">End Time (Resolve Existing Issue)</option>
          </select>
        </div>

        <!-- Step 2: Type of Problem (Appears ONLY if 'start' is selected) -->
        <div class="form-group" v-if="selectedTimeRange === 'start'">
          <label for="problemType">Type of Problem:</label>
          <select id="problemType" v-model="selectedProblemType" :disabled="isProcessing" class="form-control">
            <option disabled value="">Select problem category...</option>
            <option v-for="category in problemCategories" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
        </div>

        <!-- Step 3: Line No (Appears ONLY if 'start' is selected and problem category is chosen) -->
        <div class="form-group" v-if="selectedTimeRange === 'start' && selectedProblemType">
          <label for="lineNo">Line No:</label>
          <select id="lineNo" v-model="selectedLineNo" :disabled="isProcessing" class="form-control">
            <option disabled value="">Select line number...</option>
            <option v-for="line in lineOptions" :key="line.ID || line.Line_No" :value="line.Line_No">
              {{ line.Line_No }}
            </option>
          </select>
        </div>

        <!-- Step 4: Effective Manpower (Appears AFTER scanning QR when 'end' is selected) -->
        <div class="form-group" v-if="pendingResolveRecord && !cameraActive">
          <div class="resolved-info-banner">
            <div><strong>Scanned Machine:</strong> {{ pendingResolveRecord.QRcode }}</div>
            <div><strong>Start Time:</strong> {{ pendingResolveRecord.Start_time || '-' }}</div>
          </div>
          <label for="manpowerInput">Effective Manpower:</label>
          <input id="manpowerInput" v-model.number="effectiveManpower" type="number" min="1" :disabled="isProcessing"
            class="select-input" placeholder="e.g. 1" />
          <button type="button" class="btn btn-primary" style="margin-top: 0.5rem; width: 100%;"
            :disabled="isProcessing" @click.prevent="finalizeResolution">
            {{ isProcessing ? 'Saving...' : 'Save Data' }}
          </button>
        </div>

        <!-- Proceed Button for Start Time -->
        <button
          v-if="selectedTimeRange === 'start' && selectedProblemType && selectedLineNo && !cameraActive && !pendingResolveRecord"
          type="button" class="btn btn-primary" style="margin-top: 0.5rem; width: 100%;" :disabled="isProcessing"
          @click.prevent="startCamera">
          Proceed to Camera Scan
        </button>

        <!-- Proceed Button for End Time (Opens camera immediately) -->
        <button v-if="selectedTimeRange === 'end' && !pendingResolveRecord && !cameraActive" type="button"
          class="btn btn-primary" style="margin-top: 0.5rem; width: 100%;" :disabled="isProcessing"
          @click.prevent="startCamera">
          Proceed to Camera Scan
        </button>

        <!-- Camera Stream Component -->
        <div v-if="cameraActive">
          <div class="camera-container">
            <qrcode-stream :constraints="{ facingMode: 'environment' }" @detect="onDetect" @error="onCameraError">
              <div class="scanner-overlay-ui">
                <div class="viewfinder-box">
                  <div class="laser-line"></div>
                </div>
                <div class="scanner-instruction">Place the code inside the frame</div>
              </div>
            </qrcode-stream>
          </div>
          <button type="button" class="btn btn-secondary" style="width: 100%; margin-bottom: 0.5rem;"
            @click.prevent="cameraActive = false">
            Change Options
          </button>
        </div>

        <p v-if="cameraError" class="error-text">{{ cameraError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { QrcodeStream } from 'vue-qrcode-reader';
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ChartDataLabels);

import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Line } from 'vue-chartjs';
import { dbAPI } from '@/services/npt_qr_code_api.js';
import { dbAPI as Unit_line_API } from '@/services/unit_line_api.js';
import { dbAPI as Problem_Category_API } from '@/services/problem_category_api.js';

const SHEET_NAME = 'DailyNPTrecord';
const HEADERS = [
  'Line_No',
  'QRcode',
  'Type_of_Problem',
  'No_of_Effective_Man',
  'Start_time',
  'End_Time',
  'Duration_time',
  'Ttl_Time',
  'Device_Name',
  'Status'
];

const activeTab = ref('records');
const activeDailySubTab = ref('table_charts');
const activeMonthlySubTab = ref('trends');
const searchQuery = ref('');
const filterByCurrentDevice = ref(true);
const showScanModal = ref(false);
const cameraActive = ref(false);
const cameraError = ref('');
const isProcessing = ref(false);
const isLoadingRecords = ref(false);

const statusBanner = ref({ type: '', message: '' });
let bannerTimer = null;

const problemCategories = ref([]);
const lineOptions = ref([]);
const selectedProblemType = ref('');
const selectedLineNo = ref('');
const selectedTimeRange = ref('');
const effectiveManpower = ref(1);
const pendingResolveRecord = ref(null);

const showBanner = (message, type = 'info', durationMs = 3500) => {
  statusBanner.value = { type, message };
  if (bannerTimer) clearTimeout(bannerTimer);
  if (durationMs > 0) {
    bannerTimer = setTimeout(() => {
      statusBanner.value = { type: '', message: '' };
    }, durationMs);
  }
};

const clearStatusBanner = () => {
  if (bannerTimer) clearTimeout(bannerTimer);
  statusBanner.value = { type: '', message: '' };
};

const getCurrentDDMMYYYY = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}-${month}-${year}`;
};

const normalizeDateToDDMMYYYY = (rawDate) => {
  const str = String(rawDate || '').trim();
  if (!str) return '';

  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const dd = String(dmyMatch[1]).padStart(2, '0');
    const mm = String(dmyMatch[2]).padStart(2, '0');
    const yyyy = dmyMatch[3];
    return `${dd}-${mm}-${yyyy}`;
  }

  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const yyyy = ymdMatch[1];
    const mm = String(ymdMatch[2]).padStart(2, '0');
    const dd = String(ymdMatch[3]).padStart(2, '0');
    return `${dd}-${mm}-${yyyy}`;
  }

  return str;
};

const extractYearMonthKey = (rawDate) => {
  const normalized = normalizeDateToDDMMYYYY(rawDate);
  const match = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}`;
  }
  return 'Unknown';
};

const todayDateStr = getCurrentDDMMYYYY();

const DAILY_MACHINE_COST = 25;
const DOLLAR_RATE = 120;
const DAILY_WORKING_MINUTES = 600;
const costPerMinute = DAILY_MACHINE_COST / DAILY_WORKING_MINUTES;
const costPerMinute_TAKA = costPerMinute * DOLLAR_RATE;
const AVG_SMV = 4.5;

const getMobileBrandName = () => {
  try {
    const ua = String(navigator.userAgent || '');
    if (/iphone/i.test(ua)) return 'Apple iPhone';
    if (/ipad/i.test(ua)) return 'Apple iPad';
    if (/android/i.test(ua)) return 'Android Phone';
    if (/windows/i.test(ua)) return 'Windows PC';
    if (/mac/i.test(ua)) return 'Mac';
  } catch (e) {
    // Fallback below
  }
  return 'Mobile Terminal';
};

const operatorName = ref(getMobileBrandName());
const records = ref([]);

const hasDisplayValue = (val) => val !== undefined && val !== null && String(val).trim() !== '';

const formatDeviceTime = (date = new Date()) => {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)} ${ampm}`;
};

const parseTotalSecondsFrom12h = (timeStr) => {
  const str = String(timeStr || '').trim();
  if (!str || str === '-') return 0;

  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]) || 0;
    const minutes = Number(ampmMatch[2]) || 0;
    const seconds = Number(ampmMatch[3]) || 0;
    const modifier = ampmMatch[4].toUpperCase();
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  const hmsMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hmsMatch) {
    const hours = Number(hmsMatch[1]) || 0;
    const minutes = Number(hmsMatch[2]) || 0;
    const seconds = Number(hmsMatch[3]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }

  const parsedDate = new Date(str);
  if (!Number.isNaN(parsedDate.getTime())) {
    return (
      parsedDate.getHours() * 3600 +
      parsedDate.getMinutes() * 60 +
      parsedDate.getSeconds()
    );
  }

  return 0;
};

const formatSecondsAsClock = (totalSec) => {
  const safeSec = Math.max(0, Math.floor(Number(totalSec) || 0));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
};

// Duration_time কলামে 12:01:42 AM বা Date স্ট্রিং এলে Start_time ও End_Time থেকে সঠিক Duration দেখায়
const getFormattedDurationCell = (record) => {
  if (!record || typeof record !== 'object') return '-';
  const startSec = parseTotalSecondsFrom12h(record.Start_time);
  const endSec = parseTotalSecondsFrom12h(record.End_Time);

  if (record.Start_time && record.End_Time && record.End_Time !== '-') {
    let diff = endSec - startSec;
    if (diff < 0) diff += 24 * 3600;
    return formatSecondsAsClock(diff);
  }

  const rawDur = String(record.Duration_time || '').trim();
  if (!rawDur || rawDur === '-') return '-';

  // Sheets-এর Date/AM-PM duration (যেমন "12:01:42 AM") হলে সময় অংশ হিসেবে ধরে ক্লক ফরম্যাটে দেখায়
  const ampmDurMatch = rawDur.match(/^12:(\d{2}):(\d{2})\s*AM$/i);
  if (ampmDurMatch) {
    return `${ampmDurMatch[1]}:${ampmDurMatch[2]}`;
  }

  return rawDur;
};

const normalizeRecordsList = (rawData) => {
  if (!Array.isArray(rawData)) return [];
  return rawData
    .slice()
    .reverse()
    .map((row) => {
      if (!row || typeof row !== 'object') return row;
      const normalizedDate = normalizeDateToDDMMYYYY(row.Created_Date || row.Date || '');
      return normalizedDate ? { ...row, Created_Date: normalizedDate } : row;
    });
};

const fetchProblemCategories = async () => {
  try {
    const data = await Problem_Category_API.getRecords('Problem_Category');
    if (Array.isArray(data) && data.length > 0) {
      problemCategories.value = [
        ...new Set(
          data
            .map((item) =>
              typeof item === 'object' && item !== null
                ? item.Problem_Category || item.Name || ''
                : item
            )
            .filter(Boolean)
        )
      ];
    }
  } catch (error) {
    console.error('Failed to fetch problem categories:', error);
  }
};

const fetchLineNumbers = async () => {
  try {
    const data = await Unit_line_API.getRecords('Unit_line_No');
    if (Array.isArray(data)) {
      lineOptions.value = data;
    }
  } catch (error) {
    console.error('Failed to fetch line numbers:', error);
  }
};

const refreshRecords = async (showFeedback = false, forceRefresh = false) => {
  if (isLoadingRecords.value) return;
  isLoadingRecords.value = true;
  try {
    const fetchedData = await dbAPI.getRecords(SHEET_NAME, '', { forceRefresh });
    if (Array.isArray(fetchedData)) {
      records.value = normalizeRecordsList(fetchedData);
      if (showFeedback) {
        showBanner('Records synced.', 'success', 2000);
      }
    }
  } catch (error) {
    console.error('Failed to load records:', error);
    if (showFeedback) {
      showBanner('Unable to sync records right now.', 'error', 3500);
    }
  } finally {
    isLoadingRecords.value = false;
  }
};

onMounted(async () => {
  await Promise.allSettled([
    refreshRecords(false, false),
    fetchProblemCategories(),
    fetchLineNumbers()
  ]);
});

onBeforeUnmount(() => {
  if (bannerTimer) clearTimeout(bannerTimer);
  cameraActive.value = false;
});

const openScanModal = () => {
  cameraError.value = '';
  cameraActive.value = false;
  selectedProblemType.value = '';
  selectedLineNo.value = '';
  selectedTimeRange.value = '';
  effectiveManpower.value = 1;
  pendingResolveRecord.value = null;
  showScanModal.value = true;

  if (!problemCategories.value.length) fetchProblemCategories();
  if (!lineOptions.value.length) fetchLineNumbers();
};

const closeScanModal = () => {
  cameraActive.value = false;
  pendingResolveRecord.value = null;
  showScanModal.value = false;
};

const onTimeActionChange = () => {
  cameraError.value = '';
  cameraActive.value = false;
  selectedProblemType.value = '';
  selectedLineNo.value = '';
  pendingResolveRecord.value = null;
  if (selectedTimeRange.value === 'end') {
    effectiveManpower.value = 1;
  }
};

const startCamera = () => {
  cameraError.value = '';
  cameraActive.value = true;
};

const onCameraError = (err) => {
  cameraActive.value = false;
  const name = err?.name || '';
  if (name === 'NotAllowedError') cameraError.value = 'Camera permission denied.';
  else if (name === 'NotFoundError') cameraError.value = 'No camera device found.';
  else cameraError.value = `Camera error: ${err?.message || 'Unable to start camera.'}`;
};

const onDetect = (detectedCodes) => {
  if (!cameraActive.value || isProcessing.value) return;
  const rawVal =
    Array.isArray(detectedCodes) && detectedCodes.length > 0 ? detectedCodes[0]?.rawValue : '';
  if (rawVal) {
    processScan(rawVal);
  }
};

const processScan = async (scannedCode) => {
  if (isProcessing.value) return;
  const code = String(scannedCode || '').trim();
  if (!code) return;

  isProcessing.value = true;
  cameraActive.value = false;
  cameraError.value = '';

  try {
    const now = new Date();
    const currentDateStr = getCurrentDDMMYYYY();

    if (selectedTimeRange.value === 'end') {
      const activeRecord = records.value.find(
        (r) =>
          String(r.QRcode || '').trim() === code &&
          (!r.End_Time || String(r.End_Time).trim() === '-' || String(r.End_Time).trim() === '')
      );

      if (!activeRecord) {
        cameraError.value = `No active running record found for QR: ${code}`;
        showBanner(`No open record found for ${code}.`, 'error', 3500);
        return;
      }

      pendingResolveRecord.value = activeRecord;
      effectiveManpower.value = Number(activeRecord.No_of_Effective_Man) || 1;
      showBanner(`Scanned ${code}. Enter effective manpower and click Save Data.`, 'info', 3500);
      return;
    }

    const newEntry = {
      QRcode: code,
      Type_of_Problem: selectedProblemType.value,
      Line_No: selectedLineNo.value,
      No_of_Effective_Man: '',
      Start_time: formatDeviceTime(now),
      End_Time: '-',
      Duration_time: '-',
      Ttl_Time: '-',
      Device_Name: operatorName.value,
      Status: 'Pending',
      Created_Date: currentDateStr
    };

    records.value.unshift(newEntry);
    closeScanModal();
    showBanner(`NPT started for ${code}. Saving...`, 'info', 2500);

    const saved = await dbAPI.saveRecord(SHEET_NAME, newEntry, 'create');
    if (saved && typeof saved === 'object') {
      const merged = { ...newEntry, ...(saved.data || saved) };
      if (merged.Created_Date) {
        merged.Created_Date = normalizeDateToDDMMYYYY(merged.Created_Date);
      }
      Object.assign(newEntry, merged);
    }

    await refreshRecords(false, true);
    showBanner(`NPT logged for ${code}.`, 'success', 3000);
  } catch (error) {
    console.error('Failed to process scan action:', error);
    const msg = error?.message || 'Please try again.';
    cameraError.value = `Failed to save scan: ${msg}`;
    showBanner(`Failed to process scan: ${msg}`, 'error', 3500);
  } finally {
    isProcessing.value = false;
  }
};

const finalizeResolution = async () => {
  const target = pendingResolveRecord.value;
  if (!target || isProcessing.value) return;

  isProcessing.value = true;
  cameraError.value = '';

  try {
    const now = new Date();
    const currentDateStr = getCurrentDDMMYYYY();
    const endTimeFormatted = formatDeviceTime(now);
    const manCount = Math.max(1, Number(effectiveManpower.value) || 1);

    const existingDate = String(target.Created_Date || '').trim();
    const normalizedCreatedDate =
      !existingDate || existingDate.includes(':')
        ? currentDateStr
        : normalizeDateToDDMMYYYY(existingDate);

    const startSeconds = parseTotalSecondsFrom12h(target.Start_time);
    const endSeconds = parseTotalSecondsFrom12h(endTimeFormatted);
    let diffSeconds = endSeconds - startSeconds;
    if (diffSeconds < 0) diffSeconds += 24 * 3600;

    const totalMins = Math.floor(diffSeconds / 60);
    const secs = diffSeconds % 60;
    const hrs = Math.floor(totalMins / 60);
    const remMins = totalMins % 60;

    const durationFormatted = `${String(hrs).padStart(2, '0')}:${String(remMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const ttlFormatted = `${manCount * totalMins} mins`;

    const updatedPayload = {
      ...target,
      End_Time: endTimeFormatted,
      Status: 'Resolved',
      No_of_Effective_Man: manCount,
      Created_Date: normalizedCreatedDate,
      Duration_time: durationFormatted,
      Ttl_Time: ttlFormatted
    };

    await dbAPI.saveRecord(SHEET_NAME, updatedPayload, 'update');

    Object.assign(target, updatedPayload);
    closeScanModal();
    showBanner(`Resolved ${target.QRcode} (${target.Ttl_Time}).`, 'success', 3500);

    // পেজ reload না করেই ফ্রেশ ডেটা সিঙ্ক
    await refreshRecords(false, true);
  } catch (error) {
    console.error('Failed to save resolution data:', error);
    const msg = error?.message || 'Please try again.';
    cameraError.value = `Failed to save resolution data: ${msg}`;
    showBanner(`Failed to save resolution: ${msg}`, 'error', 3500);
  } finally {
    isProcessing.value = false;
  }
};

const formatHeader = (headerKey) => String(headerKey || '').replace(/_/g, ' ');

const getStatusBadgeClass = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'solved' || normalized === 'resolved'
    ? 'badge badge-status-solved'
    : 'badge badge-status-pending';
};

const parseNumericMinutes = (val) => {
  const digits = String(val || '').replace(/[^0-9.]/g, '');
  const num = Number(digits);
  return Number.isFinite(num) ? num : 0;
};

const filteredRecords = computed(() => {
  const query = String(searchQuery.value || '').trim().toLowerCase();
  return records.value.filter((record) => {
    if (!record || typeof record !== 'object') return false;
    const recordDate = normalizeDateToDDMMYYYY(record.Created_Date || record.Date || '');
    const matchesDate = recordDate === todayDateStr;
    const matchesDevice = !filterByCurrentDevice.value || record.Device_Name === operatorName.value;
    const matchesSearch =
      !query ||
      Object.values(record).some((val) => String(val ?? '').toLowerCase().includes(query));

    return matchesDate && matchesDevice && matchesSearch;
  });
});

const grandTotalTtlTime = computed(() => {
  return filteredRecords.value.reduce((sum, record) => sum + parseNumericMinutes(record.Ttl_Time), 0);
});

const grandTotalLostPieces = computed(() => {
  if (!AVG_SMV || AVG_SMV <= 0) return 0;
  return Math.round(grandTotalTtlTime.value / AVG_SMV);
});

const problemBarChartData = computed(() => {
  const map = {};
  filteredRecords.value.forEach((record) => {
    const key = record.Type_of_Problem || 'Unassigned';
    const timeVal = parseNumericMinutes(record.Ttl_Time);
    if (!map[key]) {
      map[key] = { mins: 0, taka: 0 };
    }
    map[key].mins += timeVal;
    map[key].taka += timeVal * costPerMinute_TAKA;
  });

  const labels = Object.keys(map);
  return {
    labels,
    datasets: [
      {
        label: 'Lost Minutes (mins)',
        data: labels.map((k) => map[k].mins),
        backgroundColor: '#1a73e8',
        borderRadius: 2
      },
      {
        label: 'Financial Loss (৳ Taka)',
        data: labels.map((k) => Number(map[k].taka.toFixed(2))),
        backgroundColor: '#34a853',
        borderRadius: 2
      }
    ]
  };
});
const DailyLineWiseBarChart= computed(() => {
  const map = {};
  filteredRecords.value.forEach((record) => {
    const key = record.Line_No || 'Unassigned';
    const timeVal = parseNumericMinutes(record.Ttl_Time);
    if (!map[key]) {
      map[key] = { mins: 0, Pcs: 0 };
    }
    map[key].mins += timeVal;
    map[key].Pcs += timeVal / AVG_SMV;
  });

  const labels = Object.keys(map);
  return {
    labels,
    datasets: [
      {
        label: 'Lost Minutes (mins)',
        data: labels.map((k) => map[k].mins),
        backgroundColor: '#1a73e8',
        borderRadius: 2
      },
      {
        label: 'Loss (Pcs)',
        data: labels.map((k) => Number(map[k].Pcs.toFixed(2))),
        backgroundColor: '#34a853',
        borderRadius: 2
      }
    ]
  };
});


const dayWiseBarChartData = computed(() => {
  const dayMap = {};
  records.value.forEach((record) => {
    const d = normalizeDateToDDMMYYYY(record.Created_Date || record.Date || '') || 'Unassigned Date';
    const timeVal = parseNumericMinutes(record.Ttl_Time);
    if (!dayMap[d]) {
      dayMap[d] = { mins: 0, taka: 0 };
    }
    dayMap[d].mins += timeVal;
    dayMap[d].taka += timeVal * costPerMinute_TAKA;
  });

  const sortedDays = Object.keys(dayMap).sort((a, b) => {
    const parseDMY = (s) => {
      const m = String(s).match(/^(\d{2})-(\d{2})-(\d{4})$/);
      return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime() : Number.MAX_SAFE_INTEGER;
    };
    return parseDMY(a) - parseDMY(b);
  });

  return {
    labels: sortedDays,
    datasets: [
      {
        label: 'Lost Minutes (mins)',
        data: sortedDays.map((d) => dayMap[d].mins),
        backgroundColor: '#1a73e8',
        borderRadius: 2
      },
      {
        label: 'Financial Loss (৳ Taka)',
        data: sortedDays.map((d) => Number(dayMap[d].taka.toFixed(2))),
        backgroundColor: '#34a853',
        borderRadius: 2
      }
    ]
  };
});

const monthlyMultiLineMinutesChartData = computed(() => {
  const allProblems = [...new Set(records.value.map((r) => r.Type_of_Problem || 'Unassigned'))].sort();
  const monthMap = {};

  records.value.forEach((record) => {
    const monthKey = extractYearMonthKey(record.Created_Date || record.Date || '');
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {};
    }
    const prob = record.Type_of_Problem || 'Unassigned';
    const timeVal = parseNumericMinutes(record.Ttl_Time);
    monthMap[monthKey][prob] = (monthMap[monthKey][prob] || 0) + timeVal;
  });

  const months = Object.keys(monthMap).sort();
  const colorPalette = ['#1a73e8', '#ea4335', '#fbbc05', '#34a853', '#ff6d01', '#7b1fa2'];

  const datasets = months.map((month, idx) => {
    const dataPoints = allProblems.map((prob) => monthMap[month][prob] || 0);
    const color = colorPalette[idx % colorPalette.length];

    let formattedMonthName = month;
    if (month.includes('-')) {
      const [y, m] = month.split('-');
      const parsedDate = new Date(Number(y), Number(m) - 1, 1);
      if (!isNaN(parsedDate.getTime())) {
        formattedMonthName = parsedDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      }
    }

    return {
      label: formattedMonthName,
      data: dataPoints,
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      fill: false,
      tension: 0.2
    };
  });

  return { labels: allProblems, datasets };
});

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: {
      top: 18
    }
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: { boxWidth: 12, font: { size: 10 } }
    },
    datalabels: {
      display: true,
      anchor: 'end',
      align: 'top',
      offset: 1,
      color: '#333',
      font: { weight: 'bold', size: 10 },
      formatter: (value) => (value > 0 ? Math.round(value) : '')
    }
  },
  scales: {
    x: { ticks: { font: { size: 9 } } },
    y: { beginAtZero: true, ticks: { font: { size: 9 } } }
  }
};

const lineChartMinutesOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
    datalabels: { display: false }
  },
  scales: {
    x: { ticks: { font: { size: 9 } } },
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Lost Minutes (mins)', font: { size: 10, weight: 'bold' } },
      ticks: { font: { size: 9 } }
    }
  }
};
</script>

<style scoped>
.dashboard-container {
  font-family: Arial, sans-serif;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 4px;
  background: #ffffff;
  box-sizing: border-box;
}

@media (min-width: 768px) {
  .dashboard-container {
    max-width: 1400px;
    margin: 10px auto;
    padding: 12px;
    border: 1px solid #d0d7de;
    border-radius: 4px;
    background: #ffffff;
  }
}

.status-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  margin-bottom: 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: bold;
}

.status-info {
  background: #e8f0fe;
  color: #1a73e8;
  border: 1px solid #c2d7fa;
}

.status-success {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.status-error {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.banner-close {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
  padding: 0 4px;
}

.dashboard-top-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #d0d7de;
  width: 100%;
}

.top-left-device-badge,
.pipup-device-badge {
  background: #f8f9fa;
  color: #1a73e8;
  border: 1px solid #d4d4d4;
  padding: 3px 8px;
  border-radius: 20px;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.left-device-badge {
  background: #1a73e8;
  padding: 3px 8px;
  border-radius: 20px;
  font-size: 11px;
  color: #fff;
  border: none;
  cursor: pointer;
  font-weight: bold;
}

.left-device-badge:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-refresh {
  background: #ffffff;
  color: #333333;
  border: 1px solid #c0c0c0;
  padding: 3px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: bold;
  cursor: pointer;
}

.btn-refresh:hover:not(:disabled) {
  background: #f1f3f4;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.filter-clickable-badge {
  cursor: pointer;
  user-select: none;
}

.filter-clickable-badge.inactive {
  background: #f1f3f4;
  color: #5f6368;
}

.filter-status-text {
  font-size: 10px;
  opacity: 0.85;
  margin-left: 2px;
}

.header-right-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.modal-corner-badge {
  margin-bottom: 8px;
  display: inline-flex;
}

.device-dot {
  width: 6px;
  height: 6px;
  background-color: #92e81a;
  border-radius: 50%;
  display: inline-block;
}

.dot-inactive {
  background-color: #94a3b8;
}

.tabs-container {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
  border-bottom: 1px solid #d0d7de;
  padding-bottom: 4px;
  width: 100%;
}

.sub-tabs-container {
  margin-top: 4px;
  margin-bottom: 8px;
  display: flex;
  gap: 6px;
  border-bottom: 1px solid #d0d7de;
  padding-bottom: 4px;
}

.tab-btn {
  padding: 6px 12px;
  background-color: #f1f3f4;
  border: 1px solid #d4d4d4;
  border-radius: 2px 2px 0 0;
  font-weight: bold;
  font-size: 11px;
  color: #333333;
  cursor: pointer;
  text-align: center;
}

.tab-btn.active {
  background-color: #ffffff;
  color: #1a73e8;
  border-bottom: 2px solid #ffffff;
  margin-bottom: -1px;
}

.sub-tab-btn {
  background-color: #e9ecef;
  font-size: 10px;
  padding: 5px 10px;
}

.sub-tab-btn.active {
  background-color: #ffffff;
  color: #1a73e8;
  border-bottom: 2px solid #ffffff;
}

.excel-sheet-wrapper {
  margin-top: 0.5rem;
  overflow-x: auto;
  max-height: 60vh;
  overflow-y: auto;
  border: 1px solid #d0d7de;
  background: #ffffff;
}

.excel-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 11px;
}

.excel-cell-header,
.excel-cell {
  border: 1px solid #d4d4d4;
  padding: 3px 6px;
  white-space: nowrap;
  color: #000000;
  height: 22px;
  text-align: center;
}

.excel-cell-header {
  background-color: #f3f3f3;
  color: #333333;
  font-weight: bold;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 2px solid #bcbcbc;
}

.row-index-header,
.row-index-cell {
  background-color: #f3f3f3;
  color: #595959;
  text-align: center;
  width: 35px;
  min-width: 35px;
  font-weight: bold;
  border: 1px solid #d4d4d4;
  height: 22px;
}

.excel-row:hover {
  background-color: #f8f9fa;
}

.grand-total-row {
  background-color: #f1f3f4;
}

.font-bold {
  font-weight: bold;
}

.text-right {
  text-align: right;
}

.badge {
  padding: 1px 6px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: 600;
}

.badge-code {
  background: #e8f0fe;
  color: #1a73e8;
  font-family: monospace;
}

.badge-ttl {
  background: #f1f3f4;
  color: #202124;
  font-family: monospace;
  font-weight: bold;
}

.badge-ttl-total {
  background: #e8f0fe;
  color: #1a73e8;
  font-family: monospace;
  font-weight: bold;
}

.badge-status-solved {
  background: #dcfce7;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}

.badge-status-pending {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.no-data {
  text-align: center;
  color: #5f6368;
  padding: 15px;
  font-style: italic;
  font-size: 11px;
}

.charts-row {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.chart-col {
  flex: 1;
  min-width: 320px;
}

.chart-container-wrapper {
  padding: 12px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chart-header-title {
  font-size: 11px;
  font-weight: bold;
  color: #333333;
  margin-bottom: 8px;
  text-align: center;
}

.chart-canvas-box {
  width: 100%;
  height: 240px;
  position: relative;
}

.btn {
  padding: 6px 12px;
  border-radius: 2px;
  border: none;
  cursor: pointer;
  font-weight: bold;
  font-size: 11px;
  text-align: center;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #1a73e8;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1557b0;
}

.btn-secondary {
  background-color: #f3f3f3;
  color: #333333;
  border: 1px solid #a3a3a3;
  width: 100%;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.resolved-info-banner {
  background: #e8f0fe;
  padding: 6px;
  border-radius: 2px;
  margin-bottom: 6px;
  font-size: 11px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 8px;
  box-sizing: border-box;
}

.modal-content {
  position: relative;
  background: white;
  padding: 16px;
  border-radius: 4px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

.btn-close-absolute {
  position: absolute;
  top: 8px;
  right: 8px;
  background: transparent;
  border: none;
  font-size: 18px;
  font-weight: bold;
  color: #5f6368;
  cursor: pointer;
  padding: 2px 6px;
}

.scanner-desc {
  font-size: 11px;
  color: #5f6368;
  margin-bottom: 8px;
}

.camera-container {
  width: 100%;
  height: 220px;
  background: #000;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.scanner-overlay-ui {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.viewfinder-box {
  width: 160px;
  height: 160px;
  border: 2px solid rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  position: relative;
  box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.laser-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: #1a73e8;
  box-shadow: 0 0 6px #1a73e8;
  animation: scanLaser 2s infinite ease-in-out;
}

@keyframes scanLaser {
  0% {
    top: 0%;
  }

  50% {
    top: 98%;
  }

  100% {
    top: 0%;
  }
}

.scanner-instruction {
  color: #ffffff;
  font-size: 10px;
  margin-top: 8px;
  background: rgba(0, 0, 0, 0.6);
  padding: 2px 6px;
  border-radius: 2px;
}

.error-text {
  color: #d93025;
  font-size: 11px;
  margin-bottom: 8px;
  text-align: center;
  font-weight: bold;
}

.form-group {
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.form-group label {
  font-size: 11px;
  margin-bottom: 2px;
  color: #333333;
  font-weight: bold;
}

.form-group input,
.form-control,
.select-input {
  padding: 4px 6px;
  border: 1px solid #c0c0c0;
  border-radius: 2px;
  width: 100%;
  font-size: 12px;
  background-color: #fff;
  box-sizing: border-box;
  height: 28px;
}
</style>