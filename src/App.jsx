import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import logo from './images/Byazo logo .jpg';
import wallpaper from './images/byazo wallpaper.jpg';
import './App.css';
import LoginScreen from './LoginScreen';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);


const emptyForm = {
  buying_price: '',
  old_stock: 0,
  new_stock: 0,
  liters_sold_1500: 0,
  liters_sold_1600: 0,
  liters_sold_1700: 0,
  liters_sold_1800: 0,
  liters_sold_1900: 0,
  liters_sold_2000: 0,
  liters_sold_2200: 0,
  expense_fuel: 0,
  expense_transport: 0,
  expense_electricity: 0,
  expense_salaries: 0,
  expense_packaging: 0,
  expense_repairs: 0,
  expense_other: 0
};

function Dashboard() {
  const [currentView, setCurrentView] = useState('dashboard'); // 'daily' | 'dashboard' | 'analytics'
  const [branch, setBranch] = useState('Bakuli');
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('byazo-dark-mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('byazo-dark-mode', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const [formData, setFormData] = useState(emptyForm);
  const [selectedTier, setSelectedTier] = useState('1500');
  const [tierLiters, setTierLiters] = useState('');
  const [selectedExpense, setSelectedExpense] = useState('fuel');
  const [expenseAmount, setExpenseAmount] = useState('');

  const [branchFilter, setBranchFilter] = useState('All');

  const [dashboardData, setDashboardData] = useState([]);
  const [message, setMessage] = useState('');
  const isSwitching = useRef(false);
  const lastSavedSignature = useRef('');
  const saveTimerRef = useRef(null);

  // --- Analytics State ---
  const [analyticsDate, setAnalyticsDate] = useState(new Date().toISOString().split('T')[0]);
  const [analyticsBranch, setAnalyticsBranch] = useState('All');
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [branchPerfData, setBranchPerfData] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [rangeRecords, setRangeRecords] = useState([]);
  const [rangeLoading, setRangeLoading] = useState(false);

  // --- Branches State ---
  const [branchesSubTab, setBranchesSubTab] = useState('profiles');
  const [branchProfiles, setBranchProfiles] = useState([]);
  const [editingProfile, setEditingProfile] = useState(null); // branch_name being edited
  const [profileDraft, setProfileDraft] = useState({});
  const [stockTransfers, setStockTransfers] = useState([]);
  const [transferForm, setTransferForm] = useState({
    from_branch: 'Bakuli', to_branch: 'Kawempe',
    liters: '', transfer_date: new Date().toISOString().split('T')[0], reason: ''
  });
  const [transferMsg, setTransferMsg] = useState('');
  const [branchStaff, setBranchStaff] = useState([]);
  const [staffForm, setStaffForm] = useState({ branch_name: 'Bakuli', staff_name: '', role: 'Cashier' });
  const [staffMsg, setStaffMsg] = useState('');
  const [branchesLoading, setBranchesLoading] = useState(false);

  // Fetch specific record when branch or date changes
  useEffect(() => {
    // Block autosave while loading
    isSwitching.current = true;
    setIsLoading(true);
    setFormData(emptyForm); // clear immediately so stale data never lingers

    const fetchRecord = async () => {
      try {
        const [recordRes, stockRes] = await Promise.all([
          axios.get(`http://localhost:5000/api/milk-records/${recordDate}/${branch}`),
          axios.get(`http://localhost:5000/api/previous-stock/${recordDate}/${branch}`)
        ]);

        const previousStock = Number(stockRes.data?.old_stock ?? 0);

        if (recordRes.data) {
          const existingOldStock = Number(recordRes.data.old_stock ?? 0);
          const effectiveOldStock = existingOldStock > 0 ? existingOldStock : previousStock;

          // Record exists for this date — load it, but fall back to previous closing stock if opening stock is still zero.
          setFormData({
            buying_price: recordRes.data.buying_price ?? '',
            old_stock: effectiveOldStock,
            new_stock: recordRes.data.new_stock ?? 0,
            liters_sold_1500: recordRes.data.liters_sold_1500 ?? 0,
            liters_sold_1600: recordRes.data.liters_sold_1600 ?? 0,
            liters_sold_1700: recordRes.data.liters_sold_1700 ?? 0,
            liters_sold_1800: recordRes.data.liters_sold_1800 ?? 0,
            liters_sold_1900: recordRes.data.liters_sold_1900 ?? 0,
            liters_sold_2000: recordRes.data.liters_sold_2000 ?? 0,
            liters_sold_2200: recordRes.data.liters_sold_2200 ?? 0,
            expense_fuel: recordRes.data.expense_fuel ?? 0,
            expense_transport: recordRes.data.expense_transport ?? 0,
            expense_electricity: recordRes.data.expense_electricity ?? 0,
            expense_salaries: recordRes.data.expense_salaries ?? 0,
            expense_packaging: recordRes.data.expense_packaging ?? 0,
            expense_repairs: recordRes.data.expense_repairs ?? 0,
            expense_other: recordRes.data.expense_other ?? 0
          });
        } else {
          // No record yet — pull the previous day's closing stock as old stock
          setFormData({ ...emptyForm, old_stock: previousStock });
        }
      } catch (err) {
        console.error("Error fetching record", err);
        setFormData(emptyForm);
      } finally {
        setIsLoading(false);
        // Keep autosave blocked a bit longer after data loads to avoid double-saves
        setTimeout(() => { isSwitching.current = false; }, 800);
      }
    };
    fetchRecord();
  }, [branch, recordDate]);

  // Fetch Dashboard metrics
  const fetchDashboard = (date = recordDate, branchName = branchFilter) => {
    axios.get(`http://localhost:5000/api/dashboard/${date}`, { params: { branch: branchName } })
      .then(res => setDashboardData(res.data))
      .catch(err => console.error("Error fetching dashboard", err));
  };

  useEffect(() => {
    fetchDashboard(recordDate, branchFilter);
  }, [recordDate, branchFilter]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddTier = (e) => {
    if (e) e.preventDefault();
    const litersVal = Number(tierLiters) || 0;
    if (litersVal <= 0) return;
    setFormData(prev => ({
      ...prev,
      [`liters_sold_${selectedTier}`]: (Number(prev[`liters_sold_${selectedTier}`]) || 0) + litersVal
    }));
    setTierLiters('');
  };

  const handleRemoveTier = (tier) => {
    setFormData(prev => ({
      ...prev,
      [`liters_sold_${tier}`]: 0
    }));
  };

  const handleAddExpense = (e) => {
    if (e) e.preventDefault();
    const amtVal = Number(expenseAmount) || 0;
    if (amtVal <= 0) return;
    setFormData(prev => ({
      ...prev,
      [`expense_${selectedExpense}`]: (Number(prev[`expense_${selectedExpense}`]) || 0) + amtVal
    }));
    setExpenseAmount('');
  };

  const handleRemoveExpense = (key) => {
    setFormData(prev => ({
      ...prev,
      [`expense_${key}`]: 0
    }));
  };

  // --- Branches Handlers ---
  const fetchBranchesData = async () => {
    setBranchesLoading(true);
    try {
      const [profilesRes, transfersRes, staffRes] = await Promise.all([
        axios.get('http://localhost:5000/api/branches'),
        axios.get('http://localhost:5000/api/stock-transfers'),
        axios.get('http://localhost:5000/api/branch-staff')
      ]);
      setBranchProfiles(profilesRes.data);
      setStockTransfers(transfersRes.data);
      setBranchStaff(staffRes.data);
    } catch (err) {
      console.error('Failed to fetch branches data:', err);
    } finally {
      setBranchesLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'branches') fetchBranchesData();
  }, [currentView]);

  const handleSaveProfile = async (branchName) => {
    try {
      await axios.put(`http://localhost:5000/api/branches/${branchName}`, profileDraft);
      setEditingProfile(null);
      fetchBranchesData();
    } catch (err) {
      console.error('Failed to save profile:', err);
    }
  };

  const handleLogTransfer = async (e) => {
    e.preventDefault();
    setTransferMsg('');
    if (!transferForm.liters || Number(transferForm.liters) <= 0) {
      setTransferMsg('⚠️ Please enter a valid liters amount.');
      return;
    }
    if (transferForm.from_branch === transferForm.to_branch) {
      setTransferMsg('⚠️ Source and destination must differ.');
      return;
    }
    try {
      await axios.post('http://localhost:5000/api/stock-transfers', transferForm);
      setTransferMsg('✅ Transfer logged successfully.');
      setTransferForm(prev => ({ ...prev, liters: '', reason: '' }));
      fetchBranchesData();
      setTimeout(() => setTransferMsg(''), 4000);
    } catch (err) {
      setTransferMsg('❌ ' + (err.response?.data?.error || 'Failed to log transfer.'));
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setStaffMsg('');
    if (!staffForm.staff_name.trim()) {
      setStaffMsg('⚠️ Please enter a staff name.');
      return;
    }
    try {
      await axios.post('http://localhost:5000/api/branch-staff', staffForm);
      setStaffMsg('✅ Staff member assigned.');
      setStaffForm(prev => ({ ...prev, staff_name: '' }));
      fetchBranchesData();
      setTimeout(() => setStaffMsg(''), 4000);
    } catch (err) {
      setStaffMsg('❌ ' + (err.response?.data?.error || 'Failed to assign staff.'));
    }
  };

  const handleRemoveStaff = async (staffId) => {
    try {
      await axios.delete(`http://localhost:5000/api/branch-staff/${staffId}`);
      fetchBranchesData();
    } catch (err) {
      console.error('Failed to remove staff:', err);
    }
  };

  const analytics = useMemo(() => {
    const parseNumber = (value) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : 0;
    };

    const tierPrices = [1500, 1600, 1700, 1800, 1900, 2000, 2200];
    const litersByTier = tierPrices.map(price => parseNumber(formData[`liters_sold_${price}`]));
    const totalLitersSold = litersByTier.reduce((sum, liters) => sum + liters, 0);
    const expectedRevenue = litersByTier.reduce((sum, liters, index) => sum + (liters * tierPrices[index]), 0);
    const totalExpenses = ['fuel', 'transport', 'electricity', 'salaries', 'packaging', 'repairs', 'other']
      .reduce((sum, key) => sum + parseNumber(formData[`expense_${key}`]), 0);
    const availableStock = parseNumber(formData.old_stock) + parseNumber(formData.new_stock);
    const remainingStock = Math.max(0, availableStock - totalLitersSold);
    const stockPercent = availableStock > 0 ? Math.min(100, Math.round((remainingStock / availableStock) * 100)) : 0;
    const netDailyMargin = expectedRevenue - totalExpenses;

    return {
      totalLitersSold,
      expectedRevenue,
      totalExpenses,
      netDailyMargin,
      remainingStock,
      stockPercent,
      availableStock
    };
  }, [formData]);

  const saveRecord = async (dataToSave, isAutoSave = false) => {
    const oldStock = Number(dataToSave.old_stock) || 0;
    const newStock = Number(dataToSave.new_stock) || 0;
    const totalAvailable = oldStock + newStock;

    const sold = 
      (Number(dataToSave.liters_sold_1500) || 0) +
      (Number(dataToSave.liters_sold_1600) || 0) +
      (Number(dataToSave.liters_sold_1700) || 0) +
      (Number(dataToSave.liters_sold_1800) || 0) +
      (Number(dataToSave.liters_sold_1900) || 0) +
      (Number(dataToSave.liters_sold_2000) || 0) +
      (Number(dataToSave.liters_sold_2200) || 0);

    if (sold > totalAvailable) {
      if (!isAutoSave) setMessage(`Error: Insufficient stock. You only have ${totalAvailable} liters available, but tried to sell ${sold} liters.`);
      return;
    }

    if (!isAutoSave) setMessage('');

    const payload = {
      record_date: recordDate,
      branch_name: branch,
      ...dataToSave
    };
    const signature = JSON.stringify(payload);

    if (lastSavedSignature.current === signature && isAutoSave) {
      return;
    }

    try {
      setIsSaving(true);
      await axios.post('http://localhost:5000/api/milk-records', payload);
      lastSavedSignature.current = signature;
      if (!isAutoSave) setMessage('Daily record saved successfully!');
      fetchDashboard(recordDate);
    } catch (err) {
      if (!isAutoSave) setMessage('Error saving record: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveRecord(formData, false);
  };

  // Live Auto-Save Effect (debounced and skipped right after a branch/date switch)
  useEffect(() => {
    const hasMeaningfulData = Object.values(formData).some(value => Number(value) > 0);

    if (isSwitching.current || !hasMeaningfulData) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveRecord(formData, true);
    }, 1400);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [formData, branch, recordDate]);

  // --- Analytics Data Fetching ---
  const fetchAnalytics = async (date, branch) => {
    setAnalyticsLoading(true);
    setRangeLoading(true);
    try {
      const params = { date, branch };
      const trendDays = branch !== 'All' ? 3 : 7;

      const endDateObj = new Date(date);
      const startDateObj = new Date(endDateObj);
      startDateObj.setDate(startDateObj.getDate() - 30); // 30 days ago
      const startDateStr = startDateObj.toISOString().split('T')[0];

      const [summaryRes, trendRes, txRes, branchRes, rangeRes] = await Promise.all([
        axios.get('http://localhost:5000/api/analytics/summary', { params }),
        axios.get('http://localhost:5000/api/analytics/trend', { params: { ...params, days: trendDays } }),
        axios.get('http://localhost:5000/api/analytics/transactions', { params: { ...params, limit: 5 } }),
        axios.get(`http://localhost:5000/api/dashboard/${date}`),
        axios.get('http://localhost:5000/api/analytics/range-records', {
          params: { startDate: startDateStr, endDate: date, branch: 'All' }
        })
      ]);
      setAnalyticsSummary(summaryRes.data);
      setTrendData(trendRes.data || []);
      setRecentTx(txRes.data || []);
      setRangeRecords(rangeRes.data || []);
      
      // Build branch performance with percentages
      const bData = branchRes.data || [];
      const maxVol = Math.max(...bData.map(b => Number(b.total_liters) || 0), 1);
      setBranchPerfData(bData.map(b => ({
        ...b,
        percent: Math.round(((Number(b.total_liters) || 0) / maxVol) * 100)
      })));
    } catch (err) {
      console.error('Analytics fetch error', err);
    } finally {
      setAnalyticsLoading(false);
      setRangeLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'analytics') {
      fetchAnalytics(analyticsDate, analyticsBranch);
    }
  }, [currentView, analyticsDate, analyticsBranch]);

  const exportToCSV = (type) => {
    let records = [];
    const todayStr = analyticsDate;
    
    if (type === 'daily') {
      records = rangeRecords.filter(r => r.record_date.startsWith(todayStr));
    } else if (type === 'weekly') {
      const limitDate = new Date(todayStr);
      limitDate.setDate(limitDate.getDate() - 7);
      records = rangeRecords.filter(r => new Date(r.record_date) >= limitDate);
    } else {
      records = rangeRecords;
    }
    
    if (records.length === 0) {
      alert("No records found to export.");
      return;
    }
    
    const headers = [
      "Record Date", "Branch Name", "Buying Price", "Opening Stock", "New Stock Added", "Total Stock Available",
      "Liters Sold 1500", "Liters Sold 1600", "Liters Sold 1700", "Liters Sold 1800", "Liters Sold 1900", "Liters Sold 2000", "Liters Sold 2200",
      "Total Liters Sold", "Closing Stock", "Gross Revenue (Sales)", "Cost of Goods Sold", "Gross Profit",
      "Expense Fuel", "Expense Transport", "Expense Electricity", "Expense Salaries", "Expense Packaging", "Expense Repairs", "Expense Other",
      "Total Expenses", "Net Profit"
    ];
    
    const csvRows = [headers.join(",")];
    for (const r of records) {
      const rowValues = [
        r.record_date ? r.record_date.split('T')[0] : "",
        r.branch_name,
        r.buying_price,
        r.old_stock,
        r.new_stock,
        r.total_stock,
        r.liters_sold_1500,
        r.liters_sold_1600,
        r.liters_sold_1700,
        r.liters_sold_1800,
        r.liters_sold_1900,
        r.liters_sold_2000,
        r.liters_sold_2200,
        r.total_liters_sold,
        r.closing_stock,
        r.total_sales,
        r.total_cost_of_goods_sold,
        r.gross_profit,
        r.expense_fuel,
        r.expense_transport,
        r.expense_electricity,
        r.expense_salaries,
        r.expense_packaging,
        r.expense_repairs,
        r.expense_other,
        r.total_expenses,
        r.net_profit
      ];
      csvRows.push(rowValues.map(val => `"${val !== undefined && val !== null ? val : ''}"`).join(","));
    }
    
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `byazo_milk_tracker_${type}_summary_${analyticsDate}.csv`);
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportMasterReport = () => {
    if (branchPerfData.length === 0) {
      alert("No master report data to export for this date.");
      return;
    }

    const headers = [
      "Branch", "Total Liters Sold", "Total Buying Price (Capital)", "Total Gross Revenue", "Total Expenses", "Net Profit"
    ];

    const csvRows = [headers.join(",")];
    let totalLiters = 0;
    let totalBuying = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalNetProfit = 0;

    for (const b of branchPerfData) {
      totalLiters += Number(b.total_liters || 0);
      totalBuying += Number(b.total_buying_cost || 0);
      totalRevenue += Number(b.total_revenue || 0);
      totalExpenses += Number(b.total_expenses || 0);
      totalNetProfit += Number(b.total_net_profit || 0);

      csvRows.push([
        `"${b.branch_name}"`,
        `"${Number(b.total_liters || 0).toFixed(1)}"`,
        `"${Number(b.total_buying_cost || 0).toFixed(2)}"`,
        `"${Number(b.total_revenue || 0).toFixed(2)}"`,
        `"${Number(b.total_expenses || 0).toFixed(2)}"`,
        `"${Number(b.total_net_profit || 0).toFixed(2)}"`
      ].join(","));
    }

    // Add summary row
    csvRows.push([
      '"COMPANY TOTAL"',
      `"${totalLiters.toFixed(1)}"`,
      `"${totalBuying.toFixed(2)}"`,
      `"${totalRevenue.toFixed(2)}"`,
      `"${totalExpenses.toFixed(2)}"`,
      `"${totalNetProfit.toFixed(2)}"`
    ].join(","));

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Master_Report_${analyticsDate}.csv`);
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
  };

  const weeklyDates = useMemo(() => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(analyticsDate);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, [analyticsDate]);

  const weeklyChartData = useMemo(() => {
    const branches = ["Bakuli", "Owiino", "Kawempe"];
    const datasets = branches.map(brName => {
      const data = weeklyDates.map(dateStr => {
        const match = rangeRecords.find(r => r.branch_name === brName && r.record_date.startsWith(dateStr));
        return match ? Number(match.total_sales || 0) : 0;
      });
      
      const colors = {
        Bakuli: { bg: 'rgba(59, 130, 246, 0.85)', border: '#3b82f6' },
        Owiino: { bg: 'rgba(16, 185, 129, 0.85)', border: '#10b981' },
        Kawempe: { bg: 'rgba(245, 158, 11, 0.85)', border: '#f59e0b' }
      };

      return {
        label: brName,
        data,
        backgroundColor: colors[brName].bg,
        borderColor: colors[brName].border,
        borderWidth: 1.5
      };
    });

    return {
      labels: weeklyDates.map(d => {
        const dateObj = new Date(d);
        return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets
    };
  }, [rangeRecords, weeklyDates]);

  const monthlyChartData = useMemo(() => {
    const branches = ["Bakuli", "Owiino", "Kawempe"];
    const periods = [
      { label: "Wk 1 (4w ago)", startOffset: 28, endOffset: 22 },
      { label: "Wk 2 (3w ago)", startOffset: 21, endOffset: 15 },
      { label: "Wk 3 (2w ago)", startOffset: 14, endOffset: 8 },
      { label: "Wk 4 (Last Wk)", startOffset: 7, endOffset: 0 }
    ];

    const datasets = branches.map(brName => {
      const data = periods.map(p => {
        const startD = new Date(analyticsDate);
        startD.setDate(startD.getDate() - p.startOffset);
        const endD = new Date(analyticsDate);
        endD.setDate(endD.getDate() - p.endOffset);

        const filtered = rangeRecords.filter(r => {
          if (r.branch_name !== brName) return false;
          const rDate = new Date(r.record_date);
          rDate.setHours(0,0,0,0);
          const sDate = new Date(startD); sDate.setHours(0,0,0,0);
          const eDate = new Date(endD); eDate.setHours(23,59,59,999);
          return rDate >= sDate && rDate <= eDate;
        });

        return filtered.reduce((sum, r) => sum + Number(r.total_sales || 0), 0);
      });

      const colors = {
        Bakuli: { bg: 'rgba(59, 130, 246, 0.85)', border: '#3b82f6' },
        Owiino: { bg: 'rgba(16, 185, 129, 0.85)', border: '#10b981' },
        Kawempe: { bg: 'rgba(245, 158, 11, 0.85)', border: '#f59e0b' }
      };

      return {
        label: brName,
        data,
        backgroundColor: colors[brName].bg,
        borderColor: colors[brName].border,
        borderWidth: 1.5
      };
    });

    return {
      labels: periods.map(p => p.label),
      datasets
    };
  }, [rangeRecords, analyticsDate]);

  const profitabilityChartData = useMemo(() => {
    const filtered = analyticsBranch === 'All'
      ? rangeRecords
      : rangeRecords.filter(r => r.branch_name === analyticsBranch);

    let fuel = 0, transport = 0, electricity = 0, salaries = 0, packaging = 0, repairs = 0, other = 0;
    let cogs = 0, netProfit = 0, grossRevenue = 0;

    filtered.forEach(r => {
      fuel += Number(r.expense_fuel || 0);
      transport += Number(r.expense_transport || 0);
      electricity += Number(r.expense_electricity || 0);
      salaries += Number(r.expense_salaries || 0);
      packaging += Number(r.expense_packaging || 0);
      repairs += Number(r.expense_repairs || 0);
      other += Number(r.expense_other || 0);
      cogs += Number(r.total_cost_of_goods_sold || 0);
      grossRevenue += Number(r.total_sales || 0);
    });

    const totalExpenses = fuel + transport + electricity + salaries + packaging + repairs + other;
    netProfit = grossRevenue - (cogs + totalExpenses);

    return {
      labels: ["Fuel", "Transport", "Electricity", "Salaries", "Packaging", "Repairs", "Other Costs", "Cost of Goods Sold", "Net Profit"],
      datasets: [{
        data: [
          fuel,
          transport,
          electricity,
          salaries,
          packaging,
          repairs,
          other,
          cogs,
          Math.max(0, netProfit)
        ],
        backgroundColor: [
          '#ef4444',
          '#f97316',
          '#eab308',
          '#a855f7',
          '#06b6d4',
          '#64748b',
          '#94a3b8',
          '#3b82f6',
          '#10b981'
        ],
        borderWidth: 1
      }],
      summary: {
        grossRevenue,
        totalExpenses,
        cogs,
        netProfit
      }
    };
  }, [rangeRecords, analyticsBranch]);

  const priceTierChartData = useMemo(() => {
    const filtered = analyticsBranch === 'All'
      ? rangeRecords
      : rangeRecords.filter(r => r.branch_name === analyticsBranch);

    const tiers = ['1500', '1600', '1700', '1800', '1900', '2000', '2200'];
    const volumes = tiers.map(tier => {
      return filtered.reduce((sum, r) => sum + Number(r[`liters_sold_${tier}`] || 0), 0);
    });
    
    const revenues = tiers.map((tier, idx) => {
      return volumes[idx] * Number(tier);
    });

    return {
      labels: tiers.map(t => `${t} UGX`),
      datasets: [
        {
          label: "Volume (Liters)",
          data: volumes,
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: "Revenue (UGX)",
          data: revenues,
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderColor: '#10b981',
          borderWidth: 1,
          yAxisID: 'y1'
        }
      ]
    };
  }, [rangeRecords, analyticsBranch]);

  // --- Analytics Helper Functions ---
  const buildLinePath = (data) => {
    if (!data || data.length < 2) return '';
    const maxVal = Math.max(...data.map(d => Number(d.total_volume) || 0), 1);
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 270 + 15;
      const y = 80 - ((Number(d.total_volume) || 0) / maxVal) * 65;
      return [x, y];
    });
    // Smooth curve using quadratic bezier
    let path = `M ${points[0][0]},${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const mx = (points[i-1][0] + points[i][0]) / 2;
      path += ` Q ${mx},${points[i-1][1]} ${points[i][0]},${points[i][1]}`;
    }
    return path;
  };

  const buildAreaPath = (data) => {
    if (!data || data.length < 2) return '';
    const maxVal = Math.max(...data.map(d => Number(d.total_volume) || 0), 1);
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 270 + 15;
      const y = 80 - ((Number(d.total_volume) || 0) / maxVal) * 65;
      return [x, y];
    });
    let path = `M ${points[0][0]},80 L ${points[0][0]},${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const mx = (points[i-1][0] + points[i][0]) / 2;
      path += ` Q ${mx},${points[i-1][1]} ${points[i][0]},${points[i][1]}`;
    }
    path += ` L ${points[points.length-1][0]},80 Z`;
    return path;
  };

  const fmtDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.toLocaleString('en', { month: 'short' })} ${String(d.getDate()).padStart(2,'0')}`;
  };

  const fmtRevenue = (val) => {
    const n = Number(val) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toFixed(0);
  };

  const getTxIcon = (tx) => {
    if (Number(tx.new_stock) > 0) return '🚚';
    if (Number(tx.total_sales) > 0) return '🛒';
    return '📋';
  };

  const getTxType = (tx) => {
    if (Number(tx.new_stock) > 0) return 'Vendor Delivery';
    if (Number(tx.total_sales) > 0) return 'Bulk Purchase';
    return 'Inventory Sync';
  };

  const getInsights = () => {
    if (!branchPerfData.length) return [];
    const sorted = [...branchPerfData].sort((a, b) => Number(b.total_liters) - Number(a.total_liters));
    const avg = branchPerfData.reduce((s, b) => s + Number(b.total_liters), 0) / branchPerfData.length || 1;
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    const topPct = avg > 0 ? Math.round(((Number(top.total_liters) - avg) / avg) * 100) : 0;
    const bottomPct = avg > 0 ? Math.round(((avg - Number(bottom.total_liters)) / avg) * 100) : 0;
    const insights = [];
    if (Number(top.total_liters) > 0) {
      insights.push({
        type: 'success',
        icon: '✅',
        title: `TOP PERFORMER: ${top.branch_name.toUpperCase()}`,
        text: `${top.branch_name} achieved ${Number(top.total_liters).toFixed(1)}L today${
          topPct > 0 ? `, exceeding regional average by ${topPct}%.` : '.'
        } Consider replicating their supply chain efficiency elsewhere.`
      });
    }
    if (bottom.branch_name !== top.branch_name) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: `NEEDS IMPROVEMENT: ${bottom.branch_name.toUpperCase()}`,
        text: `${bottom.branch_name} is ${bottomPct > 0 ? bottomPct + '% below' : 'at'} target. Urgent audit of cold chain storage and vendor delivery times recommended.`
      });
    }
    return insights;
  };

  return (
    <div className="container">
      <header className="app-header">
        <div className="header-overlay" />
        <div className="brand" style={{ width: '100%', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img src={logo} alt="Byazo logo" className="brand-logo" />
            <div className="brand-text" style={{ textAlign: 'left' }}>
              <h1>Byazo Milk and Suppliers</h1>
              <p>Real-time milk tracking for {currentView === 'analytics' ? 'analytics' : currentView === 'dashboard' ? 'dashboard' : currentView === 'branches' ? 'branch management' : 'daily logs'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative', zIndex: 2 }}>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="theme-toggle-btn"
              aria-label="Toggle dark mode"
              title="Toggle theme"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('token');
                window.location.reload();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: 'white',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              aria-label="Logout"
              title="Logout"
            >
              <span>Logout</span>
              <span style={{ fontSize: '14px' }}>🚪</span>
            </button>
          </div>
        </div>
      </header>

      <div className="tab-nav">
        <button 
          className={`tab-btn ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentView('dashboard')}
        >
          📊 Dashboard
        </button>
        <button 
          className={`tab-btn ${currentView === 'daily' ? 'active' : ''}`}
          onClick={() => setCurrentView('daily')}
        >
          📋 Daily Logs
        </button>
        <button 
          className={`tab-btn ${currentView === 'branches' ? 'active' : ''}`}
          onClick={() => setCurrentView('branches')}
        >
          🏪 Branches
        </button>
        <button 
          className={`tab-btn ${currentView === 'analytics' ? 'active' : ''}`}
          onClick={() => setCurrentView('analytics')}
        >
          📈 Analytics
        </button>
      </div>

      {message && <div className={`alert ${message.includes('Error') ? 'error' : ''}`}>{message}</div>}

      {/* Daily Logs View */}
      {currentView === 'daily' && (
        <div className="main-layout">
          {/* Entry Form */}
          <form onSubmit={handleSubmit} className="card">
            <h2>📝 Daily Record Entry</h2>

            <div className="form-row">
              <div className="form-group">
                <label>📍 Branch Location:</label>
                <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                  <option value="Bakuli">Bakuli</option>
                  <option value="Owiino">Owiino</option>
                  <option value="Kawempe">Kawempe</option>
                </select>
              </div>

              <div className="form-group">
                <label>📅 Date:</label>
                <input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>💵 Purchase Price (UGX/LITER):</label>
                <input type="number" step="any" name="buying_price" value={formData.buying_price} onChange={handleChange} placeholder="0.00" />
              </div>
            </div>

            {isLoading && (
              <div style={{ textAlign: 'center', color: '#888', padding: '12px 0', fontSize: '14px' }}>
                ⏳ Loading record for {branch} — {recordDate}…
              </div>
            )}

            {/* Stock Management */}
            <h3>📦 Stock Management (L)</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Opening Stock (L)</label>
                <input type="number" step="any" name="old_stock" value={formData.old_stock} onChange={handleChange} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>New Stock (L)</label>
                <input type="number" step="any" name="new_stock" value={formData.new_stock} onChange={handleChange} placeholder="0.00" />
              </div>
            </div>

            {/* Price Tiers */}
            <h3>💰 Price Tiers (Liters Sold)</h3>
            <div className="compact-tier-row">
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Select Price Tier</label>
                <select value={selectedTier} onChange={(e) => setSelectedTier(e.target.value)} className="tier-select">
                  <option value="1500">1500 UGX</option>
                  <option value="1600">1600 UGX</option>
                  <option value="1700">1700 UGX</option>
                  <option value="1800">1800 UGX</option>
                  <option value="1900">1900 UGX</option>
                  <option value="2000">2000 UGX</option>
                  <option value="2200">2200 UGX</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1.2, marginBottom: 0 }}>
                <label>Insert Liters</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    step="any"
                    value={tierLiters}
                    onChange={(e) => setTierLiters(e.target.value)}
                    placeholder="e.g. 50"
                    className="tier-input"
                  />
                  <button type="button" onClick={handleAddTier} className="btn-secondary btn-add-tier">+</button>
                </div>
              </div>
            </div>

            {/* Active Tiers Display */}
            <div className="active-tiers-container">
              {['1500', '1600', '1700', '1800', '1900', '2000', '2200'].some(t => Number(formData[`liters_sold_${t}`]) > 0) ? (
                <div className="active-tiers-grid">
                  {['1500', '1600', '1700', '1800', '1900', '2000', '2200'].map(tier => {
                    const liters = Number(formData[`liters_sold_${tier}`]) || 0;
                    if (liters <= 0) return null;
                    return (
                      <div key={tier} className="tier-badge-pill">
                        <span className="pill-text"><strong>{tier} UGX:</strong> {liters} L</span>
                        <button type="button" onClick={() => handleRemoveTier(tier)} className="pill-close" title="Clear">&times;</button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="active-tiers-empty">No liters sold added yet. Select a price tier above and insert liters.</div>
              )}
            </div>

            {/* Operating Expenses — Compact Selector */}
            <h3>💸 Operating Expenses</h3>
            <div className="tier-selector-row">
              <div className="form-group" style={{ flex: 1.5, marginBottom: 0 }}>
                <label>Expense Type</label>
                <select
                  value={selectedExpense}
                  onChange={(e) => setSelectedExpense(e.target.value)}
                  className="tier-select"
                >
                  <option value="fuel">⛽ Fuel</option>
                  <option value="transport">🚚 Transport</option>
                  <option value="electricity">⚡ Electricity</option>
                  <option value="salaries">👥 Salaries</option>
                  <option value="packaging">📦 Packaging</option>
                  <option value="repairs">🔧 Repairs</option>
                  <option value="other">📌 Other Costs</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1.2, marginBottom: 0 }}>
                <label>Amount (UGX)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    step="any"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddExpense(e)}
                    placeholder="e.g. 25000"
                    className="tier-input"
                  />
                  <button type="button" onClick={handleAddExpense} className="btn-secondary btn-add-tier">+</button>
                </div>
              </div>
            </div>

            {/* Active Expenses Display */}
            <div className="active-tiers-container">
              {[
                { key: 'fuel', icon: '⛽', label: 'Fuel' },
                { key: 'transport', icon: '🚚', label: 'Transport' },
                { key: 'electricity', icon: '⚡', label: 'Electricity' },
                { key: 'salaries', icon: '👥', label: 'Salaries' },
                { key: 'packaging', icon: '📦', label: 'Packaging' },
                { key: 'repairs', icon: '🔧', label: 'Repairs' },
                { key: 'other', icon: '📌', label: 'Other Costs' }
              ].some(exp => Number(formData[`expense_${exp.key}`]) > 0) ? (
                <div className="active-tiers-grid">
                  {[
                    { key: 'fuel', icon: '⛽', label: 'Fuel' },
                    { key: 'transport', icon: '🚚', label: 'Transport' },
                    { key: 'electricity', icon: '⚡', label: 'Electricity' },
                    { key: 'salaries', icon: '👥', label: 'Salaries' },
                    { key: 'packaging', icon: '📦', label: 'Packaging' },
                    { key: 'repairs', icon: '🔧', label: 'Repairs' },
                    { key: 'other', icon: '📌', label: 'Other Costs' }
                  ].map(exp => {
                    const amount = Number(formData[`expense_${exp.key}`]) || 0;
                    if (amount <= 0) return null;
                    return (
                      <div key={exp.key} className="tier-badge-pill">
                        <span className="pill-text"><strong>{exp.icon} {exp.label}:</strong> {amount.toLocaleString()} UGX</span>
                        <button type="button" onClick={() => handleRemoveExpense(exp.key)} className="pill-close" title="Clear">&times;</button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="active-tiers-empty">No expenses added yet. Select an expense type above and insert the amount.</div>
              )}
            </div>

            <button type="submit" className="btn-submit" disabled={isSaving}>
              {isSaving ? '💾 Saving…' : '💾 Save Record'}
            </button>
          </form>

          {/* Summary Card */}
          <div className="card">
            <h2>📊 Expected Revenue</h2>
            
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Expected Revenue</div>
                <div className="metric-value" style={{ fontSize: '32px' }}>{analytics.expectedRevenue.toLocaleString()}</div>
                <div className="metric-unit">UGX</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Total Liters Sold</div>
                <div className="metric-value">{analytics.totalLitersSold.toFixed(1)}</div>
                <div className="metric-unit">Liters</div>
              </div>
            </div>

            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Est. Expenses</div>
                <div className="metric-value">{analytics.totalExpenses.toLocaleString()}</div>
                <div className="metric-unit">UGX</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Net Daily Margin</div>
                <div className="metric-value">{analytics.netDailyMargin.toLocaleString()}</div>
                <div className="metric-unit">UGX</div>
              </div>
            </div>

            <h3>📏 Volume Check</h3>
            <div className="volume-check">
              <div className="title">Remaining Stock</div>
              <div className="percentage">{analytics.stockPercent}%</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${analytics.stockPercent}%` }}></div>
              </div>
            </div>

            <div className="inventory-alert">
              <div className="alert-icon">⚠️</div>
              <div className="alert-content">
                <p className="alert-title">Inventory Alert</p>
                <p className="alert-message">{analytics.remainingStock > 0 ? `Remaining stock is ${analytics.remainingStock.toFixed(1)} liters after today's sales.` : 'No stock remains after today\'s sales.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard View */}
      {currentView === 'dashboard' && (
        <div className="main-layout">
          
          {/* Global Summary Cards */}
          <div className="global-summary-container">
            <div className="global-summary-card cost">
              <div className="global-summary-title">Total Capital Invested (Buying Price)</div>
              <div className="global-summary-value">
                {dashboardData.reduce((sum, b) => sum + Number(b.total_buying_cost || 0), 0).toLocaleString()} UGX
              </div>
            </div>
            <div className="global-summary-card revenue">
              <div className="global-summary-title">Total Gross Revenue (Money Got)</div>
              <div className="global-summary-value">
                {dashboardData.reduce((sum, b) => sum + Number(b.total_revenue || 0), 0).toLocaleString()} UGX
              </div>
            </div>
            <div className="global-summary-card profit">
              <div className="global-summary-title">Global Net Profit</div>
              <div className="global-summary-value">
                {dashboardData.reduce((sum, b) => sum + Number(b.total_net_profit || 0), 0).toLocaleString()} UGX
              </div>
            </div>
          </div>

          <div className="card dashboard-card">
            <h2>📈 Branch Performance</h2>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', margin: '10px 0 16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px' }}>📅 Date</label>
                <input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px' }}>🏷️ Branch</label>
                <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                  <option value="All">All Branches</option>
                  <option value="Bakuli">Bakuli</option>
                  <option value="Owiino">Owiino</option>
                  <option value="Kawempe">Kawempe</option>
                </select>
              </div>
            </div>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Total Liters</th>
                    <th>Revenue (UGX)</th>
                    <th>Expenses (UGX)</th>
                    <th>Net Profit (UGX)</th>
                    <th>Current Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.map((row, idx) => (
                    <tr key={idx}>
                      <td><strong>{row.branch_name}</strong></td>
                      <td>{row.total_liters || 0}</td>
                      <td>{Number(row.total_revenue || 0).toLocaleString()}</td>
                      <td>{Number(row.total_expenses || 0).toLocaleString()}</td>
                      <td className="profit-text">{Number(row.total_net_profit || 0).toLocaleString()}</td>
                      <td>{row.current_stock || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2>📊 Daily Overview</h2>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', marginTop: '15px' }}>
              Real-time milk tracking for {recordDate}
            </p>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Total Liters Today</div>
                <div className="metric-value">{analytics.totalLitersSold.toFixed(1)}</div>
                <div className="metric-unit">L</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Gross Revenue</div>
                <div className="metric-value">{analytics.expectedRevenue.toLocaleString()}</div>
                <div className="metric-unit">UGX</div>
              </div>
            </div>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Operating Costs</div>
                <div className="metric-value">{analytics.totalExpenses.toLocaleString()}</div>
                <div className="metric-unit">UGX</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Net Daily Margin</div>
                <div className="metric-value">{analytics.netDailyMargin.toLocaleString()}</div>
                <div className="metric-unit">UGX</div>
              </div>
            </div>
            
            <h3>📏 Volume Check</h3>
            <div className="volume-check">
              <div className="title">Remaining Stock</div>
              <div className="percentage">{analytics.stockPercent}%</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${analytics.stockPercent}%` }}></div>
              </div>
            </div>

            <div className="inventory-alert">
              <div className="alert-icon">⚠️</div>
              <div className="alert-content">
                <p className="alert-title">Inventory Alert</p>
                <p className="alert-message">{analytics.remainingStock > 0 ? `Remaining stock is ${analytics.remainingStock.toFixed(1)} liters after today's sales.` : 'No stock remains after today\'s sales.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics View */}
      {currentView === 'analytics' && (
        <div className="analytics-dashboard-container">
          {/* Dashboard Header / Toolbar */}
          <div className="card toolbar-card no-print">
            <div className="toolbar-flex">
              <div>
                <h2>📊 Executive Reporting Dashboard</h2>
                <p className="toolbar-subtitle">Analyze historical performance, expenses, price tier distributions and export management reports.</p>
              </div>
              <div className="toolbar-controls">
                <div className="form-group" style={{ margin: 0 }}>
                  <label>📅 Reference Date</label>
                  <input
                    type="date"
                    value={analyticsDate}
                    onChange={(e) => setAnalyticsDate(e.target.value)}
                    className="toolbar-input"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>🏪 Selected Branch</label>
                  <select
                    value={analyticsBranch}
                    onChange={(e) => setAnalyticsBranch(e.target.value)}
                    className="toolbar-input"
                  >
                    <option value="All">All Branches</option>
                    <option value="Bakuli">Bakuli</option>
                    <option value="Owiino">Owiino</option>
                    <option value="Kawempe">Kawempe</option>
                  </select>
                </div>
                {analyticsLoading && <span className="an-spinner" style={{ alignSelf: 'center', marginTop: '16px' }}>↻</span>}
              </div>
            </div>

            <div className="export-actions">
              <span className="export-label">📥 Export Summaries:</span>
              <button type="button" onClick={() => exportToCSV('daily')} className="btn-secondary btn-sm">CSV Daily</button>
              <button type="button" onClick={() => exportToCSV('weekly')} className="btn-secondary btn-sm">CSV Weekly (7d)</button>
              <button type="button" onClick={() => exportToCSV('monthly')} className="btn-secondary btn-sm">CSV Monthly (30d)</button>
              <button type="button" onClick={() => window.print()} className="btn-secondary btn-sm print-btn">🖨️ PDF Report</button>
              <button type="button" onClick={exportMasterReport} className="btn-export">📊 Export Master Report</button>
            </div>
          </div>

          {/* Range Performance Summary KPIs */}
          <div className="metrics-grid dashboard-kpis">
            <div className="metric-card kpi-blue">
              <div className="metric-label">30-Day Total Volume</div>
              <div className="metric-value">
                {rangeRecords.filter(r => analyticsBranch === 'All' ? true : r.branch_name === analyticsBranch)
                  .reduce((sum, r) => sum + Number(r.total_liters_sold || 0), 0)
                  .toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </div>
              <div className="metric-unit">Liters Sold</div>
            </div>
            <div className="metric-card kpi-green">
              <div className="metric-label">30-Day Gross Revenue</div>
              <div className="metric-value">
                {profitabilityChartData.summary.grossRevenue.toLocaleString()}
              </div>
              <div className="metric-unit">UGX</div>
            </div>
            <div className="metric-card kpi-orange">
              <div className="metric-label">30-Day Total Expenses</div>
              <div className="metric-value">
                {profitabilityChartData.summary.totalExpenses.toLocaleString()}
              </div>
              <div className="metric-unit">UGX (Operating Costs)</div>
            </div>
            <div className={`metric-card ${profitabilityChartData.summary.netProfit >= 0 ? 'kpi-emerald' : 'kpi-red'}`}>
              <div className="metric-label">30-Day Net Profit</div>
              <div className="metric-value">
                {profitabilityChartData.summary.netProfit.toLocaleString()}
              </div>
              <div className="metric-unit">UGX</div>
            </div>
          </div>

          {/* Print Only Header */}
          <div className="print-only-header">
            <h2>BYAZO MILK AND SUPPLIERS</h2>
            <h3>EXECUTIVE MANAGEMENT REPORT</h3>
            <p><strong>Date:</strong> {analyticsDate} | <strong>Branch Scope:</strong> {analyticsBranch}</p>
            <hr />
          </div>

          {/* AI / System Insights */}
          {analyticsBranch === 'All' && branchPerfData.length > 0 && (
            <div className="card insights-card" style={{ marginBottom: '24px', background: 'var(--accent-bg)', borderColor: 'var(--accent)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', marginBottom: '16px' }}>
                💡 System Insights & Recommendations
              </h3>
              <div className="insights-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {getInsights().map((insight, idx) => (
                  <div key={idx} style={{ 
                    padding: '16px', 
                    borderRadius: '8px', 
                    background: 'var(--card-bg)',
                    borderLeft: `4px solid ${insight.type === 'success' ? '#10b981' : '#f59e0b'}`,
                    boxShadow: 'var(--shadow)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '8px', color: insight.type === 'success' ? '#10b981' : '#f59e0b' }}>
                      <span>{insight.icon}</span>
                      <span>{insight.title}</span>
                    </div>
                    <p style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-color)', margin: 0 }}>
                      {insight.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visual Charts Grid */}
          <div className="charts-layout-grid">
            {/* 1. Branch Revenues (Weekly & Monthly side-by-side) */}
            <div className="card chart-container-card">
              <h3>📈 Weekly Branch Performance (Side-by-Side)</h3>
              <div className="chart-wrapper">
                <Bar
                  data={weeklyChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { color: darkMode ? '#9ca3af' : '#4b5563' } },
                      tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                      x: { grid: { color: darkMode ? '#374151' : '#e5e7eb' }, ticks: { color: darkMode ? '#9ca3af' : '#4b5563' } },
                      y: { grid: { color: darkMode ? '#374151' : '#e5e7eb' }, ticks: { color: darkMode ? '#9ca3af' : '#4b5563' } }
                    }
                  }}
                />
              </div>
            </div>

            <div className="card chart-container-card">
              <h3>📊 Monthly Branch Performance (Weekly Aggregated)</h3>
              <div className="chart-wrapper">
                <Bar
                  data={monthlyChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { color: darkMode ? '#9ca3af' : '#4b5563' } }
                    },
                    scales: {
                      x: { grid: { color: darkMode ? '#374151' : '#e5e7eb' }, ticks: { color: darkMode ? '#9ca3af' : '#4b5563' } },
                      y: { grid: { color: darkMode ? '#374151' : '#e5e7eb' }, ticks: { color: darkMode ? '#9ca3af' : '#4b5563' } }
                    }
                  }}
                />
              </div>
            </div>

            {/* 2. Profitability Breakdown Pie/Donut Chart */}
            <div className="card chart-container-card">
              <h3>🍩 30-Day Profitability & Expenses Distribution</h3>
              <div className="profitability-grid">
                <div className="chart-wrapper donut-wrapper">
                  <Doughnut
                    data={profitabilityChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'right', labels: { color: darkMode ? '#9ca3af' : '#4b5563', boxWidth: 12 } }
                      }
                    }}
                  />
                </div>
                <div className="profitability-legend">
                  <div className="legend-row">
                    <span className="legend-name">Gross Revenue:</span>
                    <span className="legend-val">{profitabilityChartData.summary.grossRevenue.toLocaleString()} UGX</span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-name">Cost of Goods Sold (Cogs):</span>
                    <span className="legend-val">{profitabilityChartData.summary.cogs.toLocaleString()} UGX</span>
                  </div>
                  <div className="legend-row">
                    <span className="legend-name">Operating Expenses:</span>
                    <span className="legend-val">{profitabilityChartData.summary.totalExpenses.toLocaleString()} UGX</span>
                  </div>
                  <hr style={{ borderTop: darkMode ? '1px solid #374151' : '1px solid #e5e7eb', margin: '8px 0' }} />
                  <div className="legend-row highlight-row">
                    <span className="legend-name">Est. Net Profit:</span>
                    <span className="legend-val" style={{ color: profitabilityChartData.summary.netProfit >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                      {profitabilityChartData.summary.netProfit.toLocaleString()} UGX
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Product / Price Tier Breakdown */}
            <div className="card chart-container-card">
              <h3>🏷️ 30-Day Sales Volume & Revenue by Price Tier</h3>
              <div className="chart-wrapper">
                <Bar
                  data={priceTierChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { color: darkMode ? '#9ca3af' : '#4b5563' } }
                    },
                    scales: {
                      x: { grid: { color: darkMode ? '#374151' : '#e5e7eb' }, ticks: { color: darkMode ? '#9ca3af' : '#4b5563' } },
                      y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Volume (Liters)', color: darkMode ? '#9ca3af' : '#4b5563' },
                        grid: { color: darkMode ? '#374151' : '#e5e7eb' },
                        ticks: { color: darkMode ? '#9ca3af' : '#4b5563' }
                      },
                      y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Revenue (UGX)', color: darkMode ? '#9ca3af' : '#4b5563' },
                        grid: { drawOnChartArea: false },
                        ticks: { color: darkMode ? '#9ca3af' : '#4b5563' }
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* 4. Consolidated P&L Master Table */}
            <div className="card">
              <h3>🏢 Consolidated P&L (Company Financials)</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Side-by-side totals for all branches for the selected date: <strong>{analyticsDate}</strong></p>
              <div style={{ overflowX: 'auto' }}>
                <table className="master-pl-table">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th>Liters Sold</th>
                      <th>Buying Price (Cost)</th>
                      <th>Money Got (Revenue)</th>
                      <th>Total Expenses</th>
                      <th>Net Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchPerfData.map(b => (
                      <tr key={b.branch_name}>
                        <td style={{ fontWeight: 600 }}>{b.branch_name}</td>
                        <td>{Number(b.total_liters || 0).toLocaleString()} L</td>
                        <td>{Number(b.total_buying_cost || 0).toLocaleString()} UGX</td>
                        <td>{Number(b.total_revenue || 0).toLocaleString()} UGX</td>
                        <td style={{ color: '#ef4444' }}>{Number(b.total_expenses || 0).toLocaleString()} UGX</td>
                        <td style={{ color: Number(b.total_net_profit || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                          {Number(b.total_net_profit || 0).toLocaleString()} UGX
                        </td>
                      </tr>
                    ))}
                    <tr className="company-total-row">
                      <td>COMPANY TOTAL</td>
                      <td>{branchPerfData.reduce((s, b) => s + Number(b.total_liters || 0), 0).toLocaleString()} L</td>
                      <td>{branchPerfData.reduce((s, b) => s + Number(b.total_buying_cost || 0), 0).toLocaleString()} UGX</td>
                      <td>{branchPerfData.reduce((s, b) => s + Number(b.total_revenue || 0), 0).toLocaleString()} UGX</td>
                      <td style={{ color: '#ef4444' }}>{branchPerfData.reduce((s, b) => s + Number(b.total_expenses || 0), 0).toLocaleString()} UGX</td>
                      <td style={{ color: branchPerfData.reduce((s, b) => s + Number(b.total_net_profit || 0), 0) >= 0 ? '#10b981' : '#ef4444' }}>
                        {branchPerfData.reduce((s, b) => s + Number(b.total_net_profit || 0), 0).toLocaleString()} UGX
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Branches View */}
      {currentView === 'branches' && (
        <div className="main-layout" style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Sub-tab navigation */}
            <div className="branches-sub-nav">
              {[
                { key: 'profiles', icon: '🏪', label: 'Branch Profiles' },
                { key: 'transfers', icon: '🔄', label: 'Stock Transfers' },
                { key: 'staff', icon: '👥', label: 'Staff Assignment' }
              ].map(tab => (
                <button
                  key={tab.key}
                  className={`branches-sub-btn ${branchesSubTab === tab.key ? 'active' : ''}`}
                  onClick={() => setBranchesSubTab(tab.key)}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <div style={{ padding: '24px' }}>
              {branchesLoading && <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>⏳ Loading branch data…</div>}

              {/* ── BRANCH PROFILES ── */}
              {!branchesLoading && branchesSubTab === 'profiles' && (
                <div>
                  <h3 style={{ marginBottom: '20px' }}>🏪 Branch Profile Management</h3>
                  <div className="branch-profiles-grid">
                    {branchProfiles.map(profile => (
                      <div key={profile.branch_name} className="branch-profile-card">
                        <div className="branch-card-header">
                          <div>
                            <div className="branch-card-title">📍 {profile.branch_name}</div>
                            <span className={`branch-status-badge status-${(profile.status || 'Active').toLowerCase().replace(' ', '-')}`}>
                              {profile.status || 'Active'}
                            </span>
                          </div>
                          {editingProfile !== profile.branch_name ? (
                            <button
                              className="btn-secondary"
                              style={{ padding: '6px 14px', fontSize: '13px' }}
                              onClick={() => {
                                setEditingProfile(profile.branch_name);
                                setProfileDraft({
                                  manager_name: profile.manager_name || '',
                                  contact_phone: profile.contact_phone || '',
                                  address: profile.address || '',
                                  status: profile.status || 'Active',
                                  notes: profile.notes || ''
                                });
                              }}
                            >✏️ Edit</button>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="btn-submit" style={{ padding: '6px 14px', fontSize: '13px' }} onClick={() => handleSaveProfile(profile.branch_name)}>💾 Save</button>
                              <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => setEditingProfile(null)}>✕</button>
                            </div>
                          )}
                        </div>

                        {editingProfile !== profile.branch_name ? (
                          <div className="branch-card-details">
                            <div className="branch-detail-row"><span className="branch-detail-label">👤 Manager</span><span>{profile.manager_name || <em style={{color:'#9ca3af'}}>Not set</em>}</span></div>
                            <div className="branch-detail-row"><span className="branch-detail-label">📞 Contact</span><span>{profile.contact_phone || <em style={{color:'#9ca3af'}}>Not set</em>}</span></div>
                            <div className="branch-detail-row"><span className="branch-detail-label">🗺️ Address</span><span>{profile.address || <em style={{color:'#9ca3af'}}>Not set</em>}</span></div>
                            {profile.notes && <div className="branch-detail-row"><span className="branch-detail-label">📝 Notes</span><span>{profile.notes}</span></div>}
                          </div>
                        ) : (
                          <div className="branch-edit-form">
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                              <label>👤 Manager Name</label>
                              <input type="text" value={profileDraft.manager_name} onChange={e => setProfileDraft(p => ({ ...p, manager_name: e.target.value }))} placeholder="e.g. John Ssekamwa" />
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                              <label>📞 Contact Phone</label>
                              <input type="text" value={profileDraft.contact_phone} onChange={e => setProfileDraft(p => ({ ...p, contact_phone: e.target.value }))} placeholder="e.g. +256 700 123456" />
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                              <label>🗺️ Address</label>
                              <input type="text" value={profileDraft.address} onChange={e => setProfileDraft(p => ({ ...p, address: e.target.value }))} placeholder="e.g. Bakuli Market, Kampala" />
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                              <label>🔘 Operational Status</label>
                              <select value={profileDraft.status} onChange={e => setProfileDraft(p => ({ ...p, status: e.target.value }))}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                                <option value="Under Maintenance">Under Maintenance</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>📝 Notes</label>
                              <input type="text" value={profileDraft.notes} onChange={e => setProfileDraft(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional notes…" />
                            </div>
                          </div>
                        )}

                        {/* Staff count badge */}
                        <div className="branch-staff-count">
                          👥 {branchStaff.filter(s => s.branch_name === profile.branch_name).length} staff assigned
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── STOCK TRANSFERS ── */}
              {!branchesLoading && branchesSubTab === 'transfers' && (
                <div>
                  <h3 style={{ marginBottom: '20px' }}>🔄 Inter-Branch Stock Transfers</h3>
                  <form onSubmit={handleLogTransfer} className="transfer-form card" style={{ background: 'var(--bg-secondary)', marginBottom: '24px' }}>
                    <h4 style={{ marginBottom: '16px', color: 'var(--accent)' }}>📦 Log New Transfer</h4>
                    <div className="tier-selector-row" style={{ flexWrap: 'wrap' }}>
                      <div className="form-group" style={{ flex: 1, minWidth: '140px', marginBottom: 0 }}>
                        <label>🚀 From Branch</label>
                        <select value={transferForm.from_branch} onChange={e => setTransferForm(p => ({ ...p, from_branch: e.target.value }))} className="tier-select">
                          <option>Bakuli</option>
                          <option>Kawempe</option>
                          <option>Owiino</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 1, minWidth: '140px', marginBottom: 0 }}>
                        <label>🎯 To Branch</label>
                        <select value={transferForm.to_branch} onChange={e => setTransferForm(p => ({ ...p, to_branch: e.target.value }))} className="tier-select">
                          <option>Bakuli</option>
                          <option>Kawempe</option>
                          <option>Owiino</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 1, minWidth: '120px', marginBottom: 0 }}>
                        <label>🥛 Liters</label>
                        <input type="number" step="any" min="0.1" value={transferForm.liters} onChange={e => setTransferForm(p => ({ ...p, liters: e.target.value }))} placeholder="e.g. 50" className="tier-input" />
                      </div>
                      <div className="form-group" style={{ flex: 1, minWidth: '140px', marginBottom: 0 }}>
                        <label>📅 Date</label>
                        <input type="date" value={transferForm.transfer_date} onChange={e => setTransferForm(p => ({ ...p, transfer_date: e.target.value }))} className="tier-input" />
                      </div>
                      <div className="form-group" style={{ flex: 2, minWidth: '180px', marginBottom: 0 }}>
                        <label>📝 Reason</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input type="text" value={transferForm.reason} onChange={e => setTransferForm(p => ({ ...p, reason: e.target.value }))} placeholder="e.g. Surplus rebalancing" className="tier-input" />
                          <button type="submit" className="btn-submit" style={{ whiteSpace: 'nowrap', padding: '0 18px' }}>Log ✓</button>
                        </div>
                      </div>
                    </div>
                    {transferMsg && <div style={{ marginTop: '12px', fontSize: '14px', fontWeight: 600 }}>{transferMsg}</div>}
                  </form>

                  {/* Audit Trail */}
                  <h4 style={{ marginBottom: '12px' }}>📋 Transfer Audit Trail</h4>
                  {stockTransfers.length === 0 ? (
                    <div className="active-tiers-empty">No transfers logged yet.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="transfer-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>From</th>
                            <th>To</th>
                            <th>Liters</th>
                            <th>Reason</th>
                            <th>Logged At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stockTransfers.map(tx => (
                            <tr key={tx.transfer_id}>
                              <td>{tx.transfer_date ? new Date(tx.transfer_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</td>
                              <td><span className="transfer-branch-badge from">{tx.from_branch}</span></td>
                              <td><span className="transfer-branch-badge to">{tx.to_branch}</span></td>
                              <td><strong>{Number(tx.liters).toFixed(1)} L</strong></td>
                              <td style={{ color: 'var(--text-muted)', fontStyle: tx.reason ? 'normal' : 'italic' }}>{tx.reason || 'No reason given'}</td>
                              <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(tx.created_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── STAFF ASSIGNMENT ── */}
              {!branchesLoading && branchesSubTab === 'staff' && (
                <div>
                  <h3 style={{ marginBottom: '20px' }}>👥 Branch Staff Assignment</h3>

                  {/* Add staff form */}
                  <form onSubmit={handleAddStaff} className="card" style={{ background: 'var(--bg-secondary)', marginBottom: '28px' }}>
                    <h4 style={{ marginBottom: '16px', color: 'var(--accent)' }}>➕ Assign New Staff Member</h4>
                    <div className="tier-selector-row" style={{ flexWrap: 'wrap' }}>
                      <div className="form-group" style={{ flex: 1, minWidth: '140px', marginBottom: 0 }}>
                        <label>🏪 Branch</label>
                        <select value={staffForm.branch_name} onChange={e => setStaffForm(p => ({ ...p, branch_name: e.target.value }))} className="tier-select">
                          <option>Bakuli</option>
                          <option>Kawempe</option>
                          <option>Owiino</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 2, minWidth: '180px', marginBottom: 0 }}>
                        <label>👤 Staff Name</label>
                        <input type="text" value={staffForm.staff_name} onChange={e => setStaffForm(p => ({ ...p, staff_name: e.target.value }))} placeholder="e.g. Aisha Nakato" className="tier-input" />
                      </div>
                      <div className="form-group" style={{ flex: 1, minWidth: '140px', marginBottom: 0 }}>
                        <label>🎖️ Role</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select value={staffForm.role} onChange={e => setStaffForm(p => ({ ...p, role: e.target.value }))} className="tier-select">
                            <option>Cashier</option>
                            <option>Branch Manager</option>
                            <option>Stock Keeper</option>
                            <option>Delivery Driver</option>
                            <option>Sales Agent</option>
                          </select>
                          <button type="submit" className="btn-submit" style={{ whiteSpace: 'nowrap', padding: '0 18px' }}>Assign</button>
                        </div>
                      </div>
                    </div>
                    {staffMsg && <div style={{ marginTop: '12px', fontSize: '14px', fontWeight: 600 }}>{staffMsg}</div>}
                  </form>

                  {/* Per-branch staff lists */}
                  <div className="branch-profiles-grid">
                    {['Bakuli', 'Kawempe', 'Owiino'].map(bName => {
                      const members = branchStaff.filter(s => s.branch_name === bName);
                      return (
                        <div key={bName} className="branch-profile-card">
                          <div className="branch-card-header" style={{ marginBottom: '16px' }}>
                            <div className="branch-card-title">📍 {bName}</div>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{members.length} member{members.length !== 1 ? 's' : ''}</span>
                          </div>
                          {members.length === 0 ? (
                            <div className="active-tiers-empty" style={{ marginTop: 0 }}>No staff assigned yet.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {members.map(s => (
                                <div key={s.staff_id} className="staff-chip">
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{s.staff_name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.role}</div>
                                  </div>
                                  <button
                                    type="button"
                                    className="pill-close"
                                    title="Remove staff"
                                    onClick={() => handleRemoveStaff(s.staff_id)}
                                    style={{ fontSize: '16px', padding: '2px 6px' }}
                                  >&times;</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="bottom-nav">
        <div 
          className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentView('dashboard')}
        >
          <span className="nav-icon">📊</span>
          <span>Dashboard</span>
        </div>
        <div 
          className={`nav-item ${currentView === 'daily' ? 'active' : ''}`}
          onClick={() => setCurrentView('daily')}
        >
          <span className="nav-icon">📋</span>
          <span>Daily Logs</span>
        </div>
        <div 
          className={`nav-item ${currentView === 'branches' ? 'active' : ''}`}
          onClick={() => setCurrentView('branches')}
        >
          <span className="nav-icon">🏪</span>
          <span>Branches</span>
        </div>
        <div 
          className={`nav-item ${currentView === 'analytics' ? 'active' : ''}`}
          onClick={() => setCurrentView('analytics')}
        >
          <span className="nav-icon">📈</span>
          <span>Analytics</span>
        </div>
        <div 
          className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentView('settings')}
        >
          <span className="nav-icon">⚙️</span>
          <span>Settings</span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  if (!token) {
    return <LoginScreen onLoginSuccess={() => setToken(localStorage.getItem('token'))} />;
  }

  return <Dashboard />;
}

export default App;

