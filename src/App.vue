<template>
  <div class="dashboard-container">
    <!-- Header Controls -->
    <header class="dashboard-top-header">
      <!-- Left: Active Device Badge -->
      <div class="top-left-device-badge">
        <span class="device-dot"></span> 
        <button type="button" class="left-device-badge" @click.prevent="openScanModal">
          Scan QR Code
        </button>
      </div>
      
      <!-- Right: Combined Device Filter Badge & Scan Button -->
      <div class="header-right-toolbar">
        <button 
          type="button" 
          class="top-left-device-badge filter-clickable-badge" 
          :class="{ inactive: !filterByCurrentDevice }" 
          @click="filterByCurrentDevice = !filterByCurrentDevice"
          title="Click to toggle device filter"
        >
          <span class="device-dot" :class="{ 'dot-inactive': !filterByCurrentDevice }"></span> 
          Active Device: <strong>{{ operatorName }}</strong>
          <span class="filter-status-text">({{ filterByCurrentDevice ? 'Filtered' : 'All Devices' }})</span>
        </button>
      </div>
    </header>

    <!-- Main Tab Navigation -->
    <div class="tabs-container">
      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'records' }" 
        @click="activeTab = 'records'"
      >Daily NPT Records
      </button>
      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: activeTab === 'summary' }" 
        @click="activeTab = 'summary'"
      >Monthly Summary Report
      </button>
    </div>

    <!-- Excel Sheet 1: Daily NPT Records & Child Tabs -->
    <div v-if="activeTab === 'records'" class="records-tab-content">
      <!-- Child Tab Navigation Under Daily NPT Records -->
      <div class="sub-tabs-container" style="margin-top: 4px; margin-bottom: 8px; display: flex; gap: 6px; border-bottom: 1px solid #d0d7de; padding-bottom: 4px;">
        <button 
          type="button" 
          class="tab-btn sub-tab-btn" 
          :class="{ active: activeDailySubTab === 'table_charts' }" 
          @click="activeDailySubTab = 'table_charts'"
        >NPT Table & Charts
        </button>
        <button 
          type="button" 
          class="tab-btn sub-tab-btn" 
          :class="{ active: activeDailySubTab === 'day_wise' }" 
          @click="activeDailySubTab = 'day_wise'"
        >Day-wise Bar Chart Analysis
        </button>
      </div>

      <!-- Sub-Tab Content 1: Daily Table & Category/Dept/Line Charts -->
      <div v-if="activeDailySubTab === 'table_charts'">
        <div class="excel-sheet-wrapper" style="margin-top: 0.5rem;">
          <table class="excel-table">
            <thead>
              <tr>
                <th class="row-index-header">#</th>
                <th v-for="header in HEADERS" :key="header" class="excel-cell-header">{{ formatHeader(header) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(record, index) in filteredRecords" :key="record.ID || index" class="excel-row">
                <td class="row-index-cell">{{ index + 1 }}</td>
                <td v-for="header in HEADERS" :key="header" class="excel-cell">
                  <span v-if="header === 'QRcode'" class="badge badge-code">{{ record[header] }}</span>
                  <span v-else-if="header === 'Type_of_Problem'" class="badge badge-problem">{{ record[header] }}</span>
                  <span v-else-if="header === 'Ttl_Time'" class="badge badge-ttl">{{ record[header] }}</span>
                  <span v-else-if="header === 'Status'" :class="getStatusBadgeClass(record[header])">
                    {{ record[header] || '-' }}
                  </span>
                  <span v-else>{{ record[header] !== undefined && record[header] !== '' ? record[header] : '-' }}</span>
                </td>
              </tr>
              <tr v-if="filteredRecords.length === 0">
                <td :colspan="HEADERS.length + 1" class="no-data">No records found for today. Click "Scan QR Code" to log an issue.</td>
              </tr>
            </tbody>
            <!-- Grand Total Footer Row -->
            <tfoot v-if="filteredRecords.length > 0">
              <tr class="excel-row grand-total-row">
                <td class="row-index-header font-bold">Σ</td>
                <td :colspan="HEADERS.indexOf('Ttl_Time')" class="excel-cell text-right font-bold">Grand Total Lost Time & Pieces (SMV: {{ AVG_SMV }}):</td>
                <td class="excel-cell font-bold badge-ttl-total">{{ grandTotalTtlTime }} mins (≈ {{ grandTotalLostPieces }} pcs)</td>
                <td :colspan="HEADERS.length - HEADERS.indexOf('Ttl_Time') - 1" class="excel-cell"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Side-by-Side Bar Charts Section Below Daily Table -->
        <div class="charts-row" v-if="filteredRecords.length > 0">
          <div class="chart-col">
            <div class="chart-container-wrapper">
              <div class="chart-header-title">Problem Category Wise (Minutes vs Taka)</div>
              <div class="chart-canvas-box">
                <Bar :data="problemBarChartData" :options="barChartOptions" />
              </div>
            </div>
          </div>
          <div class="chart-col">
            <div class="chart-container-wrapper">
              <div class="chart-header-title">Responsible Department Wise (Minutes vs Taka)</div>
              <div class="chart-canvas-box">
                <Bar :data="departmentBarChartData" :options="barChartOptions" />
              </div>
            </div>
          </div>
          <div class="chart-col">
            <div class="chart-container-wrapper">
              <div class="chart-header-title">Line Wise (Minutes vs Taka)</div>
              <div class="chart-canvas-box">
                <Bar :data="lineBarChartData" :options="barChartOptions" />
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
      <!-- Child Tab Navigation Under Monthly Tab -->
      <div class="sub-tabs-container" style="margin-top: 8px; margin-bottom: 12px; display: flex; gap: 6px; border-bottom: 1px solid #d0d7de; padding-bottom: 4px;">
        <button 
          type="button" 
          class="tab-btn sub-tab-btn" 
          :class="{ active: activeMonthlySubTab === 'trends' }" 
          @click="activeMonthlySubTab = 'trends'"
        >Multi-Month Trends
        </button>
        <button 
          type="button" 
          class="tab-btn sub-tab-btn" 
          :class="{ active: activeMonthlySubTab === 'problem_vs_lost' }" 
          @click="activeMonthlySubTab = 'problem_vs_lost'"
        >Problem vs Lost
        </button>
      </div>

      <!-- Sub-Tab Content 1: Multi-Month Trend Charts -->
      <div v-if="activeMonthlySubTab === 'trends'" class="excel-sheet-wrapper" style="margin-top: 0.5rem;">
        <div class="charts-row" style="margin-top: 16px;" v-if="records.length > 0">    
          <div class="chart-col" style="flex: 1; min-width: 320px;">
            <div class="chart-container-wrapper">
              <div class="chart-header-title">Monthly Problem vs Lost Minutes (Multi-Month Line Comparison)</div>
              <div class="chart-canvas-box" style="height: 280px;">
                <Line :data="monthlyMultiLineMinutesChartData" :options="lineChartMinutesOptions" />
              </div>
            </div>
          </div>
        </div>

        <div class="charts-row" style="margin-top: 16px;" v-if="records.length > 0">    
          <div class="chart-col" style="flex: 1; min-width: 320px;">
            <div class="chart-container-wrapper">
              <div class="chart-header-title">Monthly Problem vs Lost Taka (Multi-Month Line Comparison)</div>
              <div class="chart-canvas-box" style="height: 280px;">
                <Line :data="monthlyMultiLineTakaChartData" :options="lineChartTakaOptions" />
              </div>
            </div>
          </div>
        </div>

        <div class="charts-row" style="margin-top: 16px;" v-if="records.length > 0">    
          <div class="chart-col" style="flex: 1; min-width: 320px;">
            <div class="chart-container-wrapper">
              <div class="chart-header-title">Monthly Problem vs Percentage (Multi-Month Line Comparison)</div>
              <div class="chart-canvas-box" style="height: 280px;">
                <Line :data="monthlyMultiLinePercentageChartData" :options="lineChartPercentageOptions" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sub-Tab Content 2: Problem vs Lost Table & Chart -->
      <div v-if="activeMonthlySubTab === 'problem_vs_lost'" class="excel-sheet-wrapper" style="margin-top: 0.5rem;">
        <div class="smv-config-banner" style="padding: 6px 12px; background: #f8f9fa; border-bottom: 1px solid #d4d4d4; font-size: 11px; display: flex; align-items: center; justify-content: space-between;">
          <span><strong>Average Style SMV:</strong> {{ AVG_SMV }} mins/pc (Problem-wise Lost Pieces = $\text{Total Mins} / \text{SMV}$)</span>
        </div>
        <table class="excel-table">
          <thead>
            <tr>
              <th class="row-index-header">#</th>
              <th class="excel-cell-header">Type of Problem</th>
              <th class="excel-cell-header">Total Minutes (mins)</th>
              <th class="excel-cell-header">Lost Production (Garments Pcs)</th>
              <th class="excel-cell-header">Total Financial Loss (৳ Taka)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in summaryProblemVsLostData" :key="row.problem" class="excel-row">
              <td class="row-index-cell">{{ index + 1 }}</td>
              <td class="excel-cell font-bold text-left" style="text-align: left; padding-left: 10px;">
                <span class="badge badge-problem">{{ row.problem }}</span>
              </td>
              <td class="excel-cell badge-ttl">{{ row.totalMins }} mins</td>
              <td class="excel-cell badge-pcs font-bold" style="color: #b45309;">{{ row.lostPcs }} pcs</td>
              <td class="excel-cell badge-cost">৳ {{ row.totalTaka.toLocaleString() }}</td>
            </tr>
            <tr v-if="summaryProblemVsLostData.length === 0">
              <td colspan="5" class="no-data">No problem records available for comparison.</td>
            </tr>
          </tbody>
          <tfoot v-if="summaryProblemVsLostData.length > 0">
            <tr class="excel-row grand-total-row">
              <td class="row-index-header font-bold">Σ</td>
              <td class="excel-cell font-bold text-right" style="text-align: right;">Grand Totals:</td>
              <td class="excel-cell font-bold badge-ttl-total">{{ grandTotalProblemMins }} mins</td>
              <td class="excel-cell font-bold" style="color: #b45309; background: #fef3c7;">{{ grandTotalProblemPieces }} pcs</td>
              <td class="excel-cell font-bold badge-cost">৳ {{ grandTotalProblemTaka.toLocaleString() }}</td>
            </tr>
          </tfoot>
        </table>

        <div class="charts-row" style="margin-top: 16px;" v-if="summaryProblemVsLostData.length > 0">    
          <div class="chart-col" style="flex: 1; min-width: 320px;">
            <div class="chart-container-wrapper">
              <div class="chart-header-title">Problem Category vs Lost Pieces & Impact</div>
              <div class="chart-canvas-box" style="height: 300px;">
                <Bar :data="problemVsLostBarChartData" :options="barChartOptions" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile QR Camera Scanner Modal -->
    <div v-if="showScanModal" class="modal-overlay" @click.self="closeScanModal">
      <div class="modal-content scanner-modal" @click.stop>
        <button type="button" class="btn-close-absolute" @click.prevent="closeScanModal">&times;</button>
        
        <div class="pipup-device-badge modal-corner-badge">
          <span class="device-dot"></span> Active Device: <strong>{{ operatorName }}</strong>
        </div>

        <h3>Scan QR Code</h3>
        <p class="scanner-desc">Follow the steps below to record start or end time.</p>

        <!-- Step 1: Type of Problem -->
        <div class="form-group">
          <label for="problemType">Type of Problem:</label>
          <select id="problemType" v-model="selectedProblemType" @change="onProblemChange" class="form-control">
            <option disabled value="">Select problem category...</option>
            <option v-for="category in problemCategories" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
        </div>

        <!-- Step 2: Line No (Appears after Type of Problem is selected) -->
        <div class="form-group" v-if="selectedProblemType">
          <label for="lineNo">Line No:</label>
          <select id="lineNo" v-model="selectedLineNo" @change="onLineChange" class="form-control">
            <option disabled value="">Select line number...</option>
            <option v-for="line in lineOptions" :key="line.ID || line.Line_No" :value="line.Line_No">
             {{ line.Line_No }}
            </option>
          </select>
        </div>

        <!-- Step 3: Time Action (Appears after Line No is selected) -->
        <div class="form-group" v-if="selectedLineNo">
          <label for="timeAction">Time Action:</label>
          <select id="timeAction" v-model="selectedTimeRange" @change="onTimeActionChange" class="form-control">
            <option disabled value="">Select time action...</option>
            <option value="start">Start Time</option>
            <option value="end">End Time</option>
          </select>
        </div>

        <!-- Step 4: Effective Manpower (Appears only if Time Action is 'end') -->
        <div class="form-group" v-if="selectedTimeRange === 'end' && !cameraActive">
          <label for="manpowerInput">Effective Manpower:</label>
          <input id="manpowerInput" v-model.number="effectiveManpower" type="number" min="1" class="select-input"
            placeholder="e.g. 1" />
        </div>

        <button v-if="selectedTimeRange && !cameraActive" type="button" class="btn btn-primary" style="margin-top: 0.5rem; width: 100%;"
          @click.prevent="startCamera">
          Proceed to Camera Scan
        </button>

        <!-- Camera Stream Component -->
        <div v-if="cameraActive">
          <div class="camera-container">
            <qrcode-stream 
              :constraints="{ facingMode: 'environment' }" 
              @detect="onDetect"
              @error="onCameraError"
            >
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
import { ref, computed, onMounted } from 'vue';
import { QrcodeStream } from 'vue-qrcode-reader';
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, LineElement, PointElement, CategoryScale, LinearScale } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Line } from 'vue-chartjs';
import { dbAPI } from'@/services/npt_qr_code_api.js';
import { dbAPI as Unit_line_API } from '@/services/unit_line_api.js';
import { dbAPI as Problem_Category_API } from '@/services/problem_category_api.js';

ChartJS.register(Title, Tooltip, Legend, BarElement, LineElement, PointElement, CategoryScale, LinearScale, ChartDataLabels);

const SHEET_NAME = 'DailyNPTrecord';
const SUMMARY_SHEET_NAME = 'SummaryReport';

const HEADERS = [ 'Line_No', 'QRcode', 'Type_of_Problem', 'No_of_Effective_Man', 'Start_time', 'End_Time', 'Duration_time', 'Ttl_Time', 'Device_Name', 'Status'];
const SUMMARY_HEADERS = [ 'Type_of_Problem', 'Ttl_Minuts', 'Ttl_loss(taka)'];

const activeTab = ref('records');
const activeDailySubTab = ref('table_charts'); 
const activeMonthlySubTab = ref('trends'); 
const searchQuery = ref('');
const filterByCurrentDevice = ref(true);
const showScanModal = ref(false);
const cameraActive = ref(false);
const cameraError = ref('');
const isProcessing = ref(false);

const problemCategories = ref([]);
const lineOptions = ref([]);
const selectedProblemType = ref('');
const selectedLineNo = ref('');
const selectedTimeRange = ref(''); 
const effectiveManpower = ref('');

const getCurrentYYYYMMDD = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const todayDateStr = getCurrentYYYYMMDD();

const DAILY_MACHINE_COST = 25; 
const DOLLAR_RATE = 120; 
const DAILY_WORKING_MINUTES = 600; 
const costPerMinute = DAILY_MACHINE_COST / DAILY_WORKING_MINUTES;
const costPerMinute_TAKA = costPerMinute * DOLLAR_RATE;

// Average SMV constant for garment production loss conversion
const AVG_SMV = 4.5; 

const getMobileBrandName = () => {
  const ua = navigator.userAgent;
  if (/iphone/i.test(ua)) return "Apple iPhone";
  if (/ipad/i.test(ua)) return "Apple iPad";
  if (/samsung/i.test(ua) || /sm-/i.test(ua)) return "Samsung Device";
  if (/pixel/i.test(ua)) return "Google Pixel";
  if (/xiaomi|redmi/i.test(ua)) return "Xiaomi Device";
  if (/oppo/i.test(ua)) return "Oppo Device";
  if (/vivo/i.test(ua)) return "Vivo Device";
  if (/huawei/i.test(ua)) return "Huawei Device";
  if (/android/i.test(ua)) return "Android Phone";
  if (/windows/i.test(ua)) return "Windows PC";
  if (/mac/i.test(ua)) return "Mac";
  return "Mobile Terminal";
};

const operatorName = ref(getMobileBrandName());
const records = ref([]);
const summaryRecords = ref([]);

const formatDeviceTime = (date = new Date()) => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)} ${ampm}`;
};

const parseTotalSecondsFrom12h = (timeStr) => {
  if (!timeStr || timeStr === '-') return 0;
  const [timePart, modifier] = timeStr.split(' ');
  let [hours, minutes, seconds] = timePart.split(':').map(Number);

  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;

  return (hours * 3600) + (minutes * 60) + (seconds || 0);
};

// --- CORRECTED FUNCTION USING Problem_Category_API ---
const fetchProblemCategories = async () => {
  try {
    const data = await Problem_Category_API.getRecords('Problem_Category'); // Adjust table/sheet name parameter if required by your backend
    if (Array.isArray(data) && data.length > 0) {
      // Map based on your schema (e.g. item.Problem_Category or item.Name)
      problemCategories.value = [...new Set(data.map(item => item.Problem_Category || item.Name || item).filter(Boolean))];
    }
  } catch (error) {
    console.error('Failed to fetch problem categories:', error);
  }
};

const fetchLineNumbers = async () => {
  try {
    const data = await Unit_line_API.getRecords('Unit_line_No');
    lineOptions.value = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to fetch line numbers:', error);
  }
};

onMounted(async () => {
  try {
    const fetchedData = await dbAPI.getRecords(SHEET_NAME);
    if (fetchedData?.length) records.value = fetchedData.reverse();
  } catch (error) {
    console.error('Failed to load records:', error);
  }

  try {
    const fetchedSummary = await dbAPI.getRecords(SUMMARY_SHEET_NAME);
    if (fetchedSummary?.length) summaryRecords.value = fetchedSummary;
  } catch (error) {
    console.error('Failed to load summary records:', error);
  }

  await fetchProblemCategories();
  await fetchLineNumbers();
});

const openScanModal = async () => {
  cameraError.value = '';
  cameraActive.value = false;
  selectedProblemType.value = '';
  selectedLineNo.value = '';
  selectedTimeRange.value = '';
  effectiveManpower.value = '';
  showScanModal.value = true;
  await fetchLineNumbers();
  await fetchProblemCategories();
};

const closeScanModal = () => {
  showScanModal.value = false;
  cameraActive.value = false;
};

const onProblemChange = () => {
  selectedLineNo.value = '';
  selectedTimeRange.value = '';
  effectiveManpower.value = '';
};

const onLineChange = () => {
  selectedTimeRange.value = '';
  effectiveManpower.value = '';
};

const onTimeActionChange = () => {
  if (selectedTimeRange.value === 'start') {
    effectiveManpower.value = '';
  } else if (selectedTimeRange.value === 'end') {
    effectiveManpower.value = 1;
  }
};

const startCamera = () => {
  if (!selectedProblemType.value || !selectedLineNo.value || !selectedTimeRange.value) {
    cameraError.value = 'Please complete all selections first.';
    return;
  }
  cameraError.value = '';
  cameraActive.value = true;
};

const onCameraError = (err) => {
  if (err.name === 'NotAllowedError') cameraError.value = 'Camera permission denied.';
  else if (err.name === 'NotFoundError') cameraError.value = 'No camera device found.';
  else cameraError.value = `Camera error: ${err.message}`;
};

const onDetect = (detectedCodes) => {
  if (detectedCodes?.length) processScan(detectedCodes[0].rawValue);
};

const processScan = async (scannedCode) => {
  if (isProcessing.value) return;
  const code = scannedCode?.trim();
  if (!code) return;

  isProcessing.value = true;
  const now = new Date();
  cameraActive.value = false;
  showScanModal.value = false;

  try {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const currentDateStr = `${year}-${month}-${day}`;

    if (selectedTimeRange.value === 'end') {
      const activeRecord = records.value.find(
        r => r.QRcode === code && 
             r.Device_Name === operatorName.value &&
             (!r.End_Time || r.End_Time === '-' || r.End_Time === '')
      );

      if (!activeRecord) {
        alert('No active running record found for this device with this QR code to end.');
        isProcessing.value = false;
        return;
      }

      activeRecord.End_Time = formatDeviceTime(now);
      activeRecord.Status = 'Resolved';
      activeRecord.No_of_Effective_Man = effectiveManpower.value || 1;

      if (!activeRecord.Created_Date || activeRecord.Created_Date.includes(':')) {
        activeRecord.Created_Date = currentDateStr;
      }

      const startSeconds = parseTotalSecondsFrom12h(activeRecord.Start_time);
      const endSeconds = parseTotalSecondsFrom12h(activeRecord.End_Time);
      let diffSeconds = endSeconds - startSeconds;
      if (diffSeconds < 0) diffSeconds += 24 * 3600;

      const effectiveMan = Number(activeRecord.No_of_Effective_Man) || 1;
      const mins = Math.floor(diffSeconds / 60);
      const secs = diffSeconds % 60;
      
      activeRecord.Duration_time = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      const totalManMins = effectiveMan * mins;
      activeRecord.Ttl_Time = `${totalManMins} mins`;

      await dbAPI.saveRecord(SHEET_NAME, activeRecord, 'update');
    } else {
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
      await dbAPI.saveRecord(SHEET_NAME, newEntry, 'create');
    }
  } catch (error) {
    console.error('Failed to process scan action:', error);
  } finally {
    isProcessing.value = false;
  }
};

const formatHeader = (headerKey) => headerKey.replace(/_/g, ' ');

const getStatusBadgeClass = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  return (normalized === 'solved' || normalized === 'resolved') 
    ? 'badge badge-status-solved' 
    : 'badge badge-status-pending';
};

const filteredRecords = computed(() => {
  return records.value.filter(record => {
    const recordDate = record.Created_Date || record.Date || '';
    const matchesDate = recordDate.startsWith(todayDateStr);
    const matchesDevice = !filterByCurrentDevice.value || record.Device_Name === operatorName.value;
    const matchesSearch = !searchQuery.value || 
      Object.values(record).some(val => String(val).toLowerCase().includes(searchQuery.value.toLowerCase()));

    return matchesDate && matchesDevice && matchesSearch;
  });
});

const grandTotalTtlTime = computed(() => {
  return filteredRecords.value.reduce((sum, record) => {
    const val = Number(String(record.Ttl_Time || '').replace(/[^0-9]/g, '')) || 0;
    return sum + val;
  }, 0);
});

const grandTotalLostPieces = computed(() => {
  if (!AVG_SMV || AVG_SMV <= 0) return 0;
  return Math.round(grandTotalTtlTime.value / AVG_SMV);
});

const buildDualChartData = (recordsList, keySelector) => {
  const map = {};
  recordsList.forEach(record => {
    const key = keySelector(record);
    const timeVal = Number(String(record.Ttl_Time || '').replace(/[^0-9]/g, '')) || 0;
    
    if (!map[key]) {
      map[key] = { mins: 0, taka: 0 };
    }
    map[key].mins += timeVal;
    map[key].taka += timeVal * costPerMinute_TAKA;
  });

  const labels = Object.keys(map);
  const minutesData = labels.map(k => map[k].mins);
  const takaData = labels.map(k => Number(map[k].taka.toFixed(2)));

  return {
    labels,
    datasets: [
      {
        label: 'Lost Minutes (mins)',
        data: minutesData,
        backgroundColor: '#1a73e8',
        borderRadius: 2
      },
      {
        label: 'Financial Loss (৳ Taka)',
        data: takaData,
        backgroundColor: '#34a853',
        borderRadius: 2
      }
    ]
  };
};

const problemBarChartData = computed(() => buildDualChartData(filteredRecords.value, r => r.Type_of_Problem || 'Unassigned'));
const departmentBarChartData = computed(() => buildDualChartData(filteredRecords.value, r => r.Responsible_Dept || r.Responsible_Department || 'Unassigned Dept'));
const lineBarChartData = computed(() => buildDualChartData(filteredRecords.value, r => r.Line_No ? `Line ${r.Line_No}` : 'Unassigned Line'));

const dayWiseBarChartData = computed(() => {
  const dayMap = {};
  records.value.forEach(record => {
    const d = record.Created_Date || record.Date || 'Unassigned Date';
    const timeVal = Number(String(record.Ttl_Time || '').replace(/[^0-9]/g, '')) || 0;
    if (!dayMap[d]) {
      dayMap[d] = { mins: 0, taka: 0 };
    }
    dayMap[d].mins += timeVal;
    dayMap[d].taka += timeVal * costPerMinute_TAKA;
  });

  const sortedDays = Object.keys(dayMap).sort();
  const labels = sortedDays;
  const minsData = sortedDays.map(d => dayMap[d].mins);
  const takaData = sortedDays.map(d => Number(dayMap[d].taka.toFixed(2)));

  return {
    labels,
    datasets: [
      {
        label: 'Lost Minutes (mins)',
        data: minsData,
        backgroundColor: '#1a73e8',
        borderRadius: 2
      },
      {
        label: 'Financial Loss (৳ Taka)',
        data: takaData,
        backgroundColor: '#34a853',
        borderRadius: 2
      }
    ]
  };
});

const buildMultiLineDataset = (metricKey) => {
  const allProblems = [...new Set(records.value.map(r => r.Type_of_Problem || 'Unassigned'))].sort();
  const monthMap = {};
  const monthTotals = {};

  records.value.forEach(record => {
    const d = record.Created_Date || record.Date || '';
    const monthKey = d.length >= 7 ? d.substring(0, 7) : 'Unknown';
    if (!monthMap[monthKey]) {
      monthMap[monthKey] = {};
      monthTotals[monthKey] = 0;
    }
    const prob = record.Type_of_Problem || 'Unassigned';
    const timeVal = Number(String(record.Ttl_Time || '').replace(/[^0-9]/g, '')) || 0;

    monthMap[monthKey][prob] = (monthMap[monthKey][prob] || 0) + timeVal;
    monthTotals[monthKey] += timeVal;
  });

  const months = Object.keys(monthMap).sort();
  const colorPalette = ['#1a73e8', '#ea4335', '#fbbc05', '#34a853', '#ff6d01', '#7b1fa2', '#00796b'];

  const datasets = months.map((month, idx) => {
    const dataPoints = allProblems.map(prob => {
      const probVal = monthMap[month][prob] || 0;
      if (metricKey === 'mins') return probVal;
      if (metricKey === 'taka') return Number((probVal * costPerMinute_TAKA).toFixed(2));
      if (metricKey === 'percentage') {
        const total = monthTotals[month] || 0;
        return total > 0 ? Number(((probVal / total) * 100).toFixed(1)) : 0;
      }
      return probVal;
    });

    const color = colorPalette[idx % colorPalette.length];

    let formattedMonthName = month;
    if (month.includes('-')) {
      const [y, m] = month.split('-');
      const dateObj = new Date(Number(y), Number(m) - 1, 1);
      formattedMonthName = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
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

  return {
    labels: allProblems,
    datasets: datasets
  };
};

const monthlyMultiLineMinutesChartData = computed(() => buildMultiLineDataset('mins'));
const monthlyMultiLineTakaChartData = computed(() => buildMultiLineDataset('taka'));
const monthlyMultiLinePercentageChartData = computed(() => buildMultiLineDataset('percentage'));

const summaryProblemVsLostData = computed(() => {
  const problemMap = {};
  records.value.forEach(record => {
    const prob = record.Type_of_Problem || 'Unassigned';
    const timeVal = Number(String(record.Ttl_Time || '').replace(/[^0-9]/g, '')) || 0;
    if (!problemMap[prob]) {
      problemMap[prob] = 0;
    }
    problemMap[prob] += timeVal;
  });

  return Object.keys(problemMap).map(prob => {
    const totalMins = problemMap[prob];
    const lostPcs = AVG_SMV > 0 ? Math.round(totalMins / AVG_SMV) : 0;
    const totalTaka = Number((totalMins * costPerMinute_TAKA).toFixed(2));
    return { problem: prob, totalMins, lostPcs, totalTaka };
  }).sort((a, b) => b.totalMins - a.totalMins);
});

const grandTotalProblemMins = computed(() => {
  return summaryProblemVsLostData.value.reduce((sum, item) => sum + item.totalMins, 0);
});

const grandTotalProblemPieces = computed(() => {
  return summaryProblemVsLostData.value.reduce((sum, item) => sum + item.lostPcs, 0);
});

const grandTotalProblemTaka = computed(() => {
  return Number(summaryProblemVsLostData.value.reduce((sum, item) => sum + item.totalTaka, 0).toFixed(2));
});

const problemVsLostBarChartData = computed(() => {
  const labels = summaryProblemVsLostData.value.map(i => i.problem);
  const minsData = summaryProblemVsLostData.value.map(i => i.totalMins);
  const pcsData = summaryProblemVsLostData.value.map(i => i.lostPcs);
  const takaData = summaryProblemVsLostData.value.map(i => i.totalTaka);

  return {
    labels,
    datasets: [
      {
        label: 'Total Lost Minutes (mins)',
        data: minsData,
        backgroundColor: '#1a73e8',
        borderRadius: 2
      },
      {
        label: 'Lost Garments (pcs)',
        data: pcsData,
        backgroundColor: '#d97706',
        borderRadius: 2
      },
      {
        label: 'Total Financial Loss (৳ Taka)',
        data: takaData,
        backgroundColor: '#34a853',
        borderRadius: 2
      }
    ]
  };
});

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
    datalabels: { display: false }
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
    y: { beginAtZero: true, title: { display: true, text: 'Lost Minutes (mins)', font: { size: 10, weight: 'bold' } }, ticks: { font: { size: 9 } } }
  }
};

const lineChartTakaOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
    datalabels: { display: false }
  },
  scales: {
    x: { ticks: { font: { size: 9 } } },
    y: { beginAtZero: true, title: { display: true, text: 'Financial Loss (৳ Taka)', font: { size: 10, weight: 'bold' } }, ticks: { font: { size: 9 } } }
  }
};

const lineChartPercentageOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
    datalabels: {
      display: true,
      align: 'top',
      anchor: 'end',
      font: { size: 9, weight: 'bold' },
      formatter: (value) => (value > 0 ? `${value}%` : '')
    }
  },
  scales: {
    x: { ticks: { font: { size: 9 } } },
    y: { 
      beginAtZero: true, 
      max: 100, 
      title: { display: true, text: 'Percentage (%)', font: { size: 10, weight: 'bold' } }, 
      ticks: { font: { size: 9 }, callback: (v) => `${v}%` } 
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
    box-shadow: none;
  }
}

.dashboard-top-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #d0d7de;
  width: 100%;
}

.top-left-device-badge {
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
  width: 50%;
}


.left-device-badge {
  background: #1a73e8;
  padding: 3px 8px;
  border-radius: 20px;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  color: #fff;
  border: none;
  cursor: pointer;
  font-weight: bold;
}

.filter-clickable-badge {
  cursor: pointer;
  user-select: none;
}

.filter-clickable-badge:hover {
  background: #f1f3f4;
}

.filter-clickable-badge.inactive {
  background: #f1f3f4;
  color: #5f6368;
  border-color: #d4d4d4;
}

.filter-status-text {
  font-size: 10px;
  opacity: 0.85;
  margin-left: 2px;
}

.header-right-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
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

.tab-btn:hover {
  background-color: #e5e7eb;
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

.table-section-title {
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 4px;
  color: #333;
  margin-left: 3px;
}

.excel-sheet-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  max-height: 60vh;
  overflow-y: auto;
  border: 1px solid #d0d7de;
  border-radius: 0;
  background: #ffffff;
}

.excel-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 11px;
  table-layout: auto;
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
  text-align: center;
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

.badge-problem {
  background: #fce8e6;
  color: #c5221f;
}

.badge-ttl {
  background: #f1f3f4;
  color: #202124;
  font-family: monospace;
  font-weight: bold;
}

.badge-pcs {
  background: #fef3c7;
  color: #b45309;
  font-family: monospace;
  font-weight: bold;
}

.badge-cost {
  background: #e6f4ea;
  color: #137333;
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

.btn-primary {
  background-color: #1a73e8;
  color: #ffffff;
}

.btn-primary:hover {
  background-color: #1557b0;
}

.btn-secondary {
  background-color: #f3f3f3;
  color: #333333;
  border: 1px solid #a3a3a3;
  width: 100%;
}

.btn-secondary:hover {
  background-color: #e5e7eb;
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
  line-align: 1;
}

.btn-close-absolute:hover {
  background-color: #f1f3f4;
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
  0% { top: 0%; }
  50% { top: 98%; }
  100% { top: 0%; }
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