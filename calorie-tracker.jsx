import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from "recharts";

// ────────────────────────────────────────────────────────────
const EXERCISE_LIST = [
  { name: "걷기", met: 3.5 }, { name: "조깅", met: 7.0 },
  { name: "달리기", met: 11.5 }, { name: "사이클", met: 8.0 },
  { name: "수영", met: 8.0 }, { name: "헬스(웨이트)", met: 5.0 },
  { name: "요가", met: 3.0 }, { name: "줄넘기", met: 11.0 },
  { name: "등산", met: 6.0 }, { name: "테니스", met: 7.3 },
];

const STORAGE_KEY = "calorie_tracker_v3";

function getTodayStr() { return new Date().toISOString().slice(0, 10); }
function addDays(dateStr, n) {
  const d = new Date(dateStr); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function calcBMR(w, h, a, g) {
  return g === "male"
    ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * a
    : 447.593 + 9.247 * w + 3.098 * h - 4.33 * a;
}
function calcTDEE(bmr, act) {
  return bmr * ({ sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 }[act] || 1.2);
}
function fmtDate(ds) { return ds.slice(5).replace("-", "/"); } // "05/19"

// ── Claude AI 음식 검색 ──────────────────────────────────────
async function searchFoodWithClaude(query) {
  const prompt = `사용자가 "${query}"를 검색했습니다.
이 음식과 관련된 한국 음식 목록 최대 7개를 JSON 배열로만 응답해주세요.
각 항목: name(음식명), kcal(1인분 칼로리 정수), protein(단백질g 소수점1자리), carbs(탄수화물g 소수점1자리), fat(지방g 소수점1자리), serving(1인분 기준).
JSON 배열만 응답, 다른 텍스트 절대 포함 금지.`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000,
      messages:[{ role:"user", content:prompt }] }),
  });
  if (!res.ok) throw new Error();
  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";
  return JSON.parse(text.replace(/```json|```/g,"").trim());
}

// ── CSS ──────────────────────────────────────────────────────
const css = `
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f2f4f6; font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; }
  input, select, button { font-family: inherit; }
  input:focus, select:focus { outline: none; border-color: #3182f6 !important; box-shadow: 0 0 0 3px rgba(49,130,246,0.1); }
  .card { background: #fff; border-radius: 20px; padding: 24px; margin-bottom: 12px; }
  .btn-primary { background: #3182f6; color: #fff; border: none; border-radius: 14px; padding: 16px; font-size: 16px; font-weight: 700; cursor: pointer; width: 100%; transition: background 0.15s, transform 0.1s; }
  .btn-primary:hover { background: #1c6fe0; }
  .btn-primary:active { transform: scale(0.98); }
  .btn-primary:disabled { background: #e5e8eb; color: #adb5bd; cursor: default; }
  .btn-sm { background: #f2f4f6; color: #4e5968; border: none; border-radius: 10px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s; white-space:nowrap; }
  .btn-sm:hover { background: #e5e8eb; }
  .btn-sm.active { background: #3182f6; color: #fff; }
  .tab-btn { flex: 1; padding: 10px 6px; border-radius: 12px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; white-space:nowrap; }
  .tab-active { background: #3182f6; color: #fff; }
  .tab-inactive { background: transparent; color: #8b95a1; }
  .input-field { width: 100%; background: #f8f9fa; border: 1.5px solid #f0f1f3; border-radius: 12px; padding: 13px 14px; font-size: 15px; color: #191f28; transition: border 0.15s, box-shadow 0.15s; }
  .input-field::placeholder { color: #c9d4e0; }
  .list-item { display: flex; align-items: center; padding: 14px 0; border-bottom: 1px solid #f2f4f6; }
  .list-item:last-child { border-bottom: none; padding-bottom: 0; }
  .remove-btn { background: none; border: none; color: #d1d5db; cursor: pointer; font-size: 20px; padding: 0 0 0 8px; line-height: 1; transition: color 0.1s; flex-shrink: 0; }
  .remove-btn:hover { color: #f04452; }
  .stat-chip { background: #f8f9fa; border-radius: 14px; padding: 14px 16px; }
  select.input-field { appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%238b95a1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; }
  .search-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #fff; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.13); overflow: hidden; z-index: 300; border: 1.5px solid #f0f1f3; max-height: 380px; overflow-y: auto; }
  .search-item { display: flex; align-items: center; padding: 13px 16px; cursor: pointer; transition: background 0.1s; border-bottom: 1px solid #f8f9fa; }
  .search-item:last-child { border-bottom: none; }
  .search-item:hover, .search-item.hovered { background: #f0f5ff; }
  .nutrient-tag { font-size: 11px; color: #8b95a1; background: #f2f4f6; border-radius: 5px; padding: 2px 7px; }
  .spinner { display: inline-block; width: 18px; height: 18px; border: 2px solid #e5e8eb; border-top-color: #3182f6; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .ai-badge { display: inline-flex; align-items: center; gap: 4px; background: linear-gradient(90deg,#e8f4ff,#f0f5ff); color: #3182f6; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 20px; border: 1px solid #c5d8f8; }
  .goal-row { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #f2f4f6; gap: 10px; }
  .goal-row:last-child { border-bottom: none; }
  .tooltip-box { background: #fff; border: 1.5px solid #f0f1f3; border-radius: 12px; padding: 10px 14px; font-size: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
`;

// ── 커스텀 툴팁 ──────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-box">
      <div style={{ fontWeight: 700, color: "#191f28", marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 700 }}>{p.value?.toFixed(2)} kg</span>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
export default function App() {
  const [profile, setProfile] = useState({ weight:"", height:"", age:"", gender:"male", activity:"moderate" });
  const [profileSaved, setProfileSaved] = useState(false);
  const [tab, setTab] = useState("today");
  const [section, setSection] = useState("food");
  const [foodInput, setFoodInput] = useState({ name:"", kcal:"", protein:"", carbs:"", fat:"" });
  const [exerciseInput, setExerciseInput] = useState({ name:"", minutes:"" });
  const [logs, setLogs] = useState({});

  // 목표 설정: [{ month: "2025-06", targetKg: 0.5 }, ...]
  const [goals, setGoals] = useState([]);
  const [goalInput, setGoalInput] = useState({ month: "", targetKg: "" });

  // 검색
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState("idle");
  const [showDropdown, setShowDropdown] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const [chartRange, setChartRange] = useState("30"); // "30" | "90" | "180"
  const searchTimer = useRef(null);
  const dropdownRef = useRef(null);
  const today = getTodayStr();

  // ── 초기 로드 ──
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (s.profile) { setProfile(s.profile); setProfileSaved(true); }
      if (s.logs) setLogs(s.logs);
      if (s.goals) setGoals(s.goals);
    } catch {}
  }, []);

  function persist(updates) {
    const cur = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"); } catch { return {}; } })();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...updates }));
  }

  function saveProfile() {
    if (!profile.weight || !profile.height || !profile.age) return;
    setProfileSaved(true); persist({ profile });
  }

  // ── 목표 관리 ──
  function addGoal() {
    if (!goalInput.month || !goalInput.targetKg) return;
    const updated = [...goals.filter(g => g.month !== goalInput.month),
      { month: goalInput.month, targetKg: +goalInput.targetKg }]
      .sort((a, b) => a.month.localeCompare(b.month));
    setGoals(updated); persist({ goals: updated });
    setGoalInput({ month: "", targetKg: "" });
  }
  function removeGoal(month) {
    const updated = goals.filter(g => g.month !== month);
    setGoals(updated); persist({ goals: updated });
  }

  // ── 검색 ──
  function onSearchChange(val) {
    setSearchQuery(val);
    setFoodInput(p => ({ ...p, name:val, kcal:"", protein:"", carbs:"", fat:"" }));
    setHoveredIdx(-1);
    clearTimeout(searchTimer.current);
    if (!val.trim()) { setShowDropdown(false); setSearchResults([]); setSearchStatus("idle"); return; }
    searchTimer.current = setTimeout(() => runSearch(val), 600);
  }
  async function runSearch(q) {
    setSearchStatus("loading"); setShowDropdown(true); setSearchResults([]);
    try { setSearchResults(await searchFoodWithClaude(q)); setSearchStatus("done"); }
    catch { setSearchStatus("error"); setSearchResults([]); }
  }
  function selectFood(food) {
    setSearchQuery(food.name);
    setFoodInput({ name:food.name, kcal:String(food.kcal), protein:String(food.protein||""), carbs:String(food.carbs||""), fat:String(food.fat||"") });
    setShowDropdown(false); setHoveredIdx(-1);
  }

  // ── 기록 ──
  const todayLog = logs[today] || { foods:[], exercises:[] };
  function addFood() {
    if (!foodInput.name || !foodInput.kcal) return;
    const nl = { ...todayLog, foods:[...todayLog.foods, { ...foodInput, kcal:+foodInput.kcal, time:new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}) }] };
    const newLogs = { ...logs, [today]:nl };
    setLogs(newLogs); persist({ logs:newLogs });
    setFoodInput({ name:"", kcal:"", protein:"", carbs:"", fat:"" });
    setSearchQuery(""); setShowDropdown(false); setSearchResults([]);
  }
  function addExercise() {
    if (!exerciseInput.name || !exerciseInput.minutes) return;
    const ex = EXERCISE_LIST.find(e => e.name===exerciseInput.name);
    const kcal = ex ? Math.round(ex.met*(+profile.weight||65)*(+exerciseInput.minutes/60)) : 0;
    const nl = { ...todayLog, exercises:[...todayLog.exercises, { name:exerciseInput.name, minutes:+exerciseInput.minutes, kcal, time:new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}) }] };
    const newLogs = { ...logs, [today]:nl };
    setLogs(newLogs); persist({ logs:newLogs });
    setExerciseInput({ name:"", minutes:"" });
  }
  function removeFood(i) {
    const nl = { ...todayLog, foods:todayLog.foods.filter((_,idx)=>idx!==i) };
    const newLogs = { ...logs, [today]:nl };
    setLogs(newLogs); persist({ logs:newLogs });
  }
  function removeExercise(i) {
    const nl = { ...todayLog, exercises:todayLog.exercises.filter((_,idx)=>idx!==i) };
    const newLogs = { ...logs, [today]:nl };
    setLogs(newLogs); persist({ logs:newLogs });
  }

  // ── 통계 ──
  const totalFood = todayLog.foods.reduce((s,f)=>s+f.kcal,0);
  const totalBurn = todayLog.exercises.reduce((s,e)=>s+e.kcal,0);
  const net = totalFood - totalBurn;
  const bmr  = profileSaved ? calcBMR(+profile.weight,+profile.height,+profile.age,profile.gender) : 0;
  const tdee = profileSaved ? calcTDEE(bmr,profile.activity) : 2000;
  const deficit = tdee - net;
  const progressPct = Math.min((net/tdee)*100,100);
  const weightDayKg = deficit / 7700;
  const weightWeekKg = weightDayKg * 7;

  // ── 추이 그래프 데이터 생성 ──────────────────────────────────
  const chartData = (() => {
    if (!profileSaved) return [];
    const days = +chartRange;
    const startW = +profile.weight;
    if (!startW) return [];

    // 1. 실제 추이: 기록 기반으로 날짜별 누적 체중 변화
    const points = [];
    let cumDeltaActual = 0;

    // 기록이 있는 가장 이른 날짜 찾기
    const logDates = Object.keys(logs).sort();
    const firstLogDate = logDates.length > 0 ? logDates[0] : today;
    const startDate = addDays(today, -(days - 1));
    // 시작 기준점: 시작일 이전까지의 누적 변화량 계산
    let baselineDelta = 0;
    for (let d = firstLogDate; d < startDate; d = addDays(d, 1)) {
      const log = logs[d];
      if (log) {
        const food = log.foods.reduce((s,f)=>s+f.kcal,0);
        const burn = log.exercises.reduce((s,e)=>s+e.kcal,0);
        const dayDeficit = tdee - (food - burn);
        baselineDelta += dayDeficit / 7700;
      }
    }

    // 차트 기간 데이터
    for (let i = 0; i < days; i++) {
      const ds = addDays(today, -(days - 1 - i));
      const log = logs[ds];
      const label = fmtDate(ds);
      const isToday = ds === today;
      const isFuture = ds > today;

      if (!isFuture) {
        if (log) {
          const food = log.foods.reduce((s,f)=>s+f.kcal,0);
          const burn = log.exercises.reduce((s,e)=>s+e.kcal,0);
          const dayDeficit = tdee - (food - burn);
          cumDeltaActual += dayDeficit / 7700;
        }
        // 기록 없는 날은 이전 값 유지 (null로 표시해서 선 끊기지 않게)
        points.push({
          date: label,
          dateStr: ds,
          actual: parseFloat((startW + baselineDelta + cumDeltaActual).toFixed(3)),
          goal: null,
          isToday,
        });
      }
    }

    // 2. 목표 추이: 월별 목표 감량량 기준 선형 보간
    if (goals.length > 0) {
      // 목표라인: 오늘부터 미래까지 + 과거도 포함해서 전체 기간
      const sortedGoals = [...goals].sort((a,b)=>a.month.localeCompare(b.month));

      // 각 포인트에 목표 체중 계산
      const allPoints = [];
      for (let i = 0; i < days; i++) {
        const ds = addDays(today, -(days - 1 - i));
        allPoints.push(ds);
      }
      // 미래 90일까지 추가 (목표선 연장)
      const futureDays = Math.min(90, days);
      for (let i = 1; i <= futureDays; i++) {
        allPoints.push(addDays(today, i));
      }

      // 목표 체중 계산: 오늘 기준 체중에서 월별 목표 누적 적용
      const goalWeightMap = {};
      // 오늘 실제 체중
      const todayActual = points.find(p=>p.isToday)?.actual || startW;
      // 각 달의 끝에 달성할 목표 체중 계산
      let runningWeight = todayActual;
      const monthTargets = {}; // "2025-06" → 목표 체중

      // 첫 목표달 이전: 오늘 체중
      sortedGoals.forEach((g, gi) => {
        const prevWeight = gi === 0 ? todayActual : (monthTargets[sortedGoals[gi-1].month] || todayActual);
        monthTargets[g.month] = parseFloat((prevWeight - g.targetKg).toFixed(3));
      });

      // 각 날짜에 보간된 목표 체중 할당
      allPoints.forEach(ds => {
        const ym = ds.slice(0,7);
        // 이 날짜가 어느 목표 구간에 있는지
        const prevGoalIdx = sortedGoals.findIndex(g => g.month > ym) - 1;
        const nextGoalIdx = sortedGoals.findIndex(g => g.month >= ym);

        if (ds < today) {
          goalWeightMap[ds] = null; // 과거는 목표선 없음
          return;
        }

        if (nextGoalIdx === -1) {
          // 모든 목표 지남
          const lastG = sortedGoals[sortedGoals.length-1];
          goalWeightMap[ds] = monthTargets[lastG.month];
          return;
        }

        const nextG = sortedGoals[nextGoalIdx];
        // 이 목표 달의 시작일(오늘 또는 월초)과 끝일(월말)
        const monthStart = ds <= today ? today : `${nextG.month}-01`;
        const monthEnd = (() => {
          const [y,m] = nextG.month.split("-").map(Number);
          return new Date(y, m, 0).toISOString().slice(0,10);
        })();
        const startW2 = prevGoalIdx >= 0 ? monthTargets[sortedGoals[prevGoalIdx].month] : todayActual;
        const endW2 = monthTargets[nextG.month];

        // 선형 보간
        const totalDays = Math.max(1, (new Date(monthEnd) - new Date(today)) / 86400000);
        const passedDays = (new Date(ds) - new Date(today)) / 86400000;
        const ratio = Math.min(1, passedDays / totalDays);
        goalWeightMap[ds] = parseFloat((startW2 + (endW2 - startW2) * ratio).toFixed(3));
      });

      // points에 goal 값 병합
      points.forEach(p => { p.goal = goalWeightMap[p.dateStr] || null; });

      // 미래 포인트 추가
      for (let i = 1; i <= futureDays; i++) {
        const ds = addDays(today, i);
        const label = fmtDate(ds);
        if (goalWeightMap[ds] != null) {
          points.push({ date: label, dateStr: ds, actual: null, goal: goalWeightMap[ds], isToday: false });
        }
      }
    }

    return points;
  })();

  // 차트 Y축 범위
  const allWeights = chartData.flatMap(d => [d.actual, d.goal].filter(Boolean));
  const minW = allWeights.length ? Math.floor(Math.min(...allWeights) * 10) / 10 - 0.5 : 0;
  const maxW = allWeights.length ? Math.ceil(Math.max(...allWeights) * 10) / 10 + 0.5 : 100;

  // 7일 히스토리
  const last7 = Array.from({length:7},(_,i)=>{
    const d = new Date(); d.setDate(d.getDate()-(6-i));
    const ds = d.toISOString().slice(0,10);
    const log = logs[ds]||{foods:[],exercises:[]};
    return { date:fmtDate(ds), food:log.foods.reduce((s,f)=>s+f.kcal,0), burn:log.exercises.reduce((s,e)=>s+e.kcal,0) };
  });
  const maxVal = Math.max(...last7.map(d=>d.food),tdee,1);

  const statusInfo = deficit>=300 ? {label:"목표 달성 중",color:"#00c471",bg:"#e8faf2"}
    : deficit<=-200 ? {label:"목표 초과",color:"#f04452",bg:"#fff0f1"}
    : {label:"거의 맞췄어요",color:"#ff9500",bg:"#fff8ee"};
  const activityLabels = {
    sedentary:"비활동적 (주로 앉아서)", light:"가벼운 활동 (주 1~2회)",
    moderate:"보통 활동 (주 3~5회)", active:"활발한 활동 (주 6~7회)",
    very_active:"매우 활발 (운동선수 수준)"
  };
  const previewBurn = exerciseInput.name && exerciseInput.minutes
    ? Math.round((EXERCISE_LIST.find(e=>e.name===exerciseInput.name)?.met||0)*(+profile.weight||65)*(+exerciseInput.minutes/60)) : null;

  // 외부 클릭
  useEffect(() => {
    const h = e => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // 다음달 기본값
  const nextMonth = (() => {
    const d = new Date(); d.setMonth(d.getMonth()+1);
    return d.toISOString().slice(0,7);
  })();

  // X축 레이블 간격 (데이터 포인트 수 기반)
  const xInterval = chartData.length > 60 ? Math.floor(chartData.length / 10) : chartData.length > 30 ? 6 : 3;

  // ── 렌더 ────────────────────────────────────────────────────
  return (
    <div style={{background:"#f2f4f6",minHeight:"100vh"}}>
      <style>{css}</style>

      {/* 상단 네비 */}
      <div style={{background:"#fff",position:"sticky",top:0,zIndex:100,borderBottom:"1px solid #f2f4f6"}}>
        <div style={{maxWidth:520,margin:"0 auto",padding:"0 20px",display:"flex",alignItems:"center",height:56}}>
          <span style={{fontSize:20}}>🥗</span>
          <span style={{marginLeft:8,fontSize:17,fontWeight:700,color:"#191f28",letterSpacing:"-0.3px"}}>칼로리 트래커</span>
          <div style={{marginLeft:"auto"}}>
            <span className="ai-badge">✦ AI 음식 검색</span>
          </div>
        </div>
      </div>

      <div style={{maxWidth:520,margin:"0 auto",padding:"16px 16px 80px"}}>

        {/* 요약 히어로 */}
        {profileSaved && (
          <div className="card" style={{padding:0,overflow:"hidden",marginBottom:12}}>
            <div style={{background:"#3182f6",padding:"28px 24px 32px"}}>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.75)",fontWeight:500,marginBottom:6}}>오늘 순 칼로리</div>
              <div style={{display:"flex",alignItems:"flex-end",gap:6}}>
                <span style={{fontSize:48,fontWeight:800,color:"#fff",letterSpacing:"-2px",lineHeight:1}}>{net.toLocaleString()}</span>
                <span style={{fontSize:18,color:"rgba(255,255,255,0.8)",fontWeight:500,marginBottom:4}}>kcal</span>
              </div>
              <div style={{marginTop:20,background:"rgba(255,255,255,0.22)",borderRadius:100,height:7,overflow:"hidden"}}>
                <div style={{width:`${progressPct}%`,height:"100%",background:"#fff",borderRadius:100,transition:"width 0.5s cubic-bezier(.4,0,.2,1)"}}/>
              </div>
              <div style={{marginTop:8,display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,0.65)"}}>
                <span>0</span><span>목표 {Math.round(tdee).toLocaleString()} kcal</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
              {[{label:"섭취",value:totalFood,icon:"🍽"},{label:"소모",value:totalBurn,icon:"🔥"},{label:"기초대사량",value:Math.round(bmr),icon:"💤"}].map((s,i)=>(
                <div key={i} style={{padding:"16px 12px",textAlign:"center",borderRight:i<2?"1px solid #f2f4f6":"none"}}>
                  <div style={{fontSize:11,color:"#8b95a1",marginBottom:5}}>{s.icon} {s.label}</div>
                  <div style={{fontSize:17,fontWeight:700,color:"#191f28",letterSpacing:"-0.5px"}}>{s.value.toLocaleString()}</div>
                  <div style={{fontSize:10,color:"#c9d4e0",marginTop:1}}>kcal</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 체중 예측 */}
        {profileSaved && (
          <div className="card" style={{marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{width:40,height:40,borderRadius:12,background:statusInfo.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>⚖️</div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#191f28"}}>예상 체중 변화</div>
                <div style={{fontSize:12,color:"#8b95a1",marginTop:1}}>오늘 칼로리 기준 추정</div>
              </div>
              <div style={{marginLeft:"auto",fontSize:12,fontWeight:600,color:statusInfo.color,background:statusInfo.bg,padding:"5px 12px",borderRadius:20,flexShrink:0}}>{statusInfo.label}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div className="stat-chip">
                <div style={{fontSize:11,color:"#8b95a1",fontWeight:500,marginBottom:6}}>오늘 하루</div>
                <div style={{fontSize:26,fontWeight:800,color:weightDayKg>=0?"#00c471":"#f04452",letterSpacing:"-1px"}}>
                  {weightDayKg>=0?"−":"+"}{Math.abs(weightDayKg*1000).toFixed(0)}<span style={{fontSize:14,fontWeight:600,marginLeft:2}}>g</span>
                </div>
              </div>
              <div className="stat-chip">
                <div style={{fontSize:11,color:"#8b95a1",fontWeight:500,marginBottom:6}}>7일 유지 시</div>
                <div style={{fontSize:26,fontWeight:800,color:weightWeekKg>=0?"#00c471":"#f04452",letterSpacing:"-1px"}}>
                  {weightWeekKg>=0?"−":"+"}{Math.abs(weightWeekKg).toFixed(2)}<span style={{fontSize:14,fontWeight:600,marginLeft:2}}>kg</span>
                </div>
              </div>
            </div>
            <div style={{padding:"12px 14px",background:"#f8f9fa",borderRadius:12,fontSize:13,color:"#4e5968",lineHeight:1.6}}>
              {deficit>=0 ? `하루 ${Math.round(deficit).toLocaleString()} kcal 부족 → 체중 감량 추세예요` : `하루 ${Math.round(Math.abs(deficit)).toLocaleString()} kcal 초과 → 체중이 늘 수 있어요`}
            </div>
          </div>
        )}

        {/* 프로필 */}
        <div className="card">
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
            <div style={{width:40,height:40,borderRadius:12,background:"#f0f5ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>👤</div>
            <div style={{fontSize:15,fontWeight:700,color:"#191f28"}}>내 정보</div>
            {profileSaved && <span style={{marginLeft:"auto",fontSize:12,color:"#00c471",fontWeight:600}}>저장됨 ✓</span>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[{label:"몸무게 (kg)",key:"weight",ph:"65"},{label:"키 (cm)",key:"height",ph:"170"},{label:"나이",key:"age",ph:"28"}].map(f=>(
              <div key={f.key}>
                <div style={{fontSize:12,color:"#8b95a1",marginBottom:6,fontWeight:500}}>{f.label}</div>
                <input className="input-field" type="number" placeholder={f.ph} value={profile[f.key]} onChange={e=>setProfile(p=>({...p,[f.key]:e.target.value}))}/>
              </div>
            ))}
            <div>
              <div style={{fontSize:12,color:"#8b95a1",marginBottom:6,fontWeight:500}}>성별</div>
              <select className="input-field" value={profile.gender} onChange={e=>setProfile(p=>({...p,gender:e.target.value}))}>
                <option value="male">남성</option><option value="female">여성</option>
              </select>
            </div>
            <div style={{gridColumn:"1 / -1"}}>
              <div style={{fontSize:12,color:"#8b95a1",marginBottom:6,fontWeight:500}}>활동 수준</div>
              <select className="input-field" value={profile.activity} onChange={e=>setProfile(p=>({...p,activity:e.target.value}))}>
                {Object.entries(activityLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary" style={{marginTop:16}} onClick={saveProfile} disabled={!profile.weight||!profile.height||!profile.age}>저장하기</button>
        </div>

        {/* 탭 */}
        <div style={{display:"flex",gap:4,background:"#fff",padding:6,borderRadius:16,marginBottom:12}}>
          {[["today","오늘 기록"],["history","📋 기록"],["trend","📈 추이"]].map(([t,l])=>(
            <button key={t} className={`tab-btn ${tab===t?"tab-active":"tab-inactive"}`} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </div>

        {/* ── 오늘 기록 탭 ── */}
        {tab==="today" && (
          <>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              {[["food","🍽 음식"],["exercise","🏃 운동"]].map(([s,l])=>(
                <button key={s} onClick={()=>setSection(s)}
                  style={{padding:"9px 20px",borderRadius:100,border:`1.5px solid ${section===s?"#3182f6":"#e5e8eb"}`,background:section===s?"#f0f5ff":"#fff",color:section===s?"#3182f6":"#8b95a1",fontWeight:600,fontSize:14,cursor:"pointer",transition:"all 0.15s"}}>
                  {l}
                </button>
              ))}
            </div>

            {section==="food" && (
              <div className="card">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                  <div style={{fontSize:15,fontWeight:700,color:"#191f28"}}>음식 추가</div>
                  <span className="ai-badge">✦ AI 검색</span>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:12,color:"#8b95a1",marginBottom:6,fontWeight:500}}>음식 이름 검색</div>
                  <div style={{position:"relative"}} ref={dropdownRef}>
                    <div style={{position:"relative"}}>
                      <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",fontSize:15,pointerEvents:"none",zIndex:1}}>
                        {searchStatus==="loading"?<span className="spinner"/>:"🔍"}
                      </span>
                      <input className="input-field" placeholder="예: 된장찌개, 치킨, 아이스 아메리카노..." value={searchQuery} style={{paddingLeft:42}}
                        onChange={e=>onSearchChange(e.target.value)}
                        onFocus={()=>{ if(searchResults.length>0) setShowDropdown(true); }}
                        onKeyDown={e=>{
                          if (!showDropdown||!searchResults.length) return;
                          if (e.key==="ArrowDown"){e.preventDefault();setHoveredIdx(i=>Math.min(i+1,searchResults.length-1));}
                          else if (e.key==="ArrowUp"){e.preventDefault();setHoveredIdx(i=>Math.max(i-1,0));}
                          else if (e.key==="Enter"&&hoveredIdx>=0){e.preventDefault();selectFood(searchResults[hoveredIdx]);}
                          else if (e.key==="Escape") setShowDropdown(false);
                        }}/>
                    </div>
                    {showDropdown && (
                      <div className="search-dropdown">
                        {searchStatus==="loading" && <div style={{padding:"18px 16px",display:"flex",alignItems:"center",gap:10,color:"#8b95a1",fontSize:13}}><div className="spinner"/><span>AI가 음식 정보를 찾는 중…</span></div>}
                        {searchStatus==="error" && <div style={{padding:"16px",textAlign:"center",fontSize:13,color:"#f04452"}}>검색 실패 · 직접 칼로리를 입력해주세요</div>}
                        {searchStatus==="done" && searchResults.length===0 && <div style={{padding:"16px",textAlign:"center",fontSize:13,color:"#8b95a1"}}>결과 없음 · 직접 입력해주세요</div>}
                        {searchStatus==="done" && searchResults.length>0 && (
                          <>
                            <div style={{padding:"8px 16px 6px",fontSize:11,color:"#8b95a1",borderBottom:"1px solid #f2f4f6",display:"flex",alignItems:"center",gap:5}}>
                              <span className="ai-badge" style={{fontSize:10}}>✦ AI</span><span>검색 결과 {searchResults.length}건</span>
                            </div>
                            {searchResults.map((food,i)=>(
                              <div key={i} className={`search-item${hoveredIdx===i?" hovered":""}`} onMouseEnter={()=>setHoveredIdx(i)} onMouseDown={()=>selectFood(food)}>
                                <span style={{fontSize:17,marginRight:12,flexShrink:0}}>🍽</span>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:14,fontWeight:600,color:"#191f28",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{food.name}</div>
                                  <div style={{display:"flex",gap:5,marginTop:4,flexWrap:"wrap"}}>
                                    {food.serving && <span className="nutrient-tag">📏 {food.serving}</span>}
                                    {food.carbs && <span className="nutrient-tag">탄 {food.carbs}g</span>}
                                    {food.protein && <span className="nutrient-tag">단 {food.protein}g</span>}
                                    {food.fat && <span className="nutrient-tag">지 {food.fat}g</span>}
                                  </div>
                                </div>
                                <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
                                  <div style={{fontSize:16,fontWeight:800,color:"#3182f6"}}>{Number(food.kcal).toLocaleString()}</div>
                                  <div style={{fontSize:11,color:"#8b95a1"}}>kcal</div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:12,color:"#8b95a1",marginBottom:6,fontWeight:500}}>칼로리 (kcal)</div>
                  <input className="input-field" type="number" placeholder="검색 선택 시 자동 입력, 직접 수정도 가능" value={foodInput.kcal} onChange={e=>setFoodInput(p=>({...p,kcal:e.target.value}))}/>
                </div>
                {(foodInput.protein||foodInput.carbs||foodInput.fat) && (
                  <div style={{marginBottom:12,padding:"10px 14px",background:"#f0f5ff",borderRadius:12,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:12,color:"#3182f6",fontWeight:700}}>영양 정보</span>
                    {foodInput.carbs && <span style={{fontSize:12,color:"#4e5968"}}>탄수화물 {foodInput.carbs}g</span>}
                    {foodInput.protein && <span style={{fontSize:12,color:"#4e5968"}}>단백질 {foodInput.protein}g</span>}
                    {foodInput.fat && <span style={{fontSize:12,color:"#4e5968"}}>지방 {foodInput.fat}g</span>}
                  </div>
                )}
                <button className="btn-primary" onClick={addFood} disabled={!foodInput.name||!foodInput.kcal}>추가하기</button>
                {todayLog.foods.length>0 && (
                  <div style={{marginTop:20}}>
                    <div style={{fontSize:12,color:"#8b95a1",fontWeight:600,marginBottom:2}}>오늘 먹은 것</div>
                    {todayLog.foods.map((f,i)=>(
                      <div key={i} className="list-item">
                        <div style={{width:36,height:36,borderRadius:11,background:"#fff0f5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,marginRight:12,flexShrink:0}}>🍽</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:15,fontWeight:600,color:"#191f28",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                          <div style={{fontSize:12,color:"#8b95a1",marginTop:2}}>{f.time}{(f.protein||f.carbs||f.fat)&&<span style={{marginLeft:6,color:"#c9d4e0"}}>· 탄{f.carbs||"?"}g 단{f.protein||"?"}g 지{f.fat||"?"}g</span>}</div>
                        </div>
                        <div style={{fontSize:15,fontWeight:700,color:"#3182f6",marginLeft:8,flexShrink:0}}>{f.kcal.toLocaleString()} kcal</div>
                        <button className="remove-btn" onClick={()=>removeFood(i)}>×</button>
                      </div>
                    ))}
                    <div style={{paddingTop:14,display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700,color:"#191f28"}}>
                      <span>합계</span><span style={{color:"#3182f6"}}>{totalFood.toLocaleString()} kcal</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {section==="exercise" && (
              <div className="card">
                <div style={{fontSize:15,fontWeight:700,color:"#191f28",marginBottom:16}}>운동 추가</div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:12,color:"#8b95a1",marginBottom:6,fontWeight:500}}>운동 종류</div>
                  <select className="input-field" value={exerciseInput.name} onChange={e=>setExerciseInput(p=>({...p,name:e.target.value}))}>
                    <option value="">선택...</option>
                    {EXERCISE_LIST.map(e=><option key={e.name} value={e.name}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:12,color:"#8b95a1",marginBottom:6,fontWeight:500}}>운동 시간 (분)</div>
                  <input className="input-field" type="number" placeholder="예: 30" value={exerciseInput.minutes} onChange={e=>setExerciseInput(p=>({...p,minutes:e.target.value}))}/>
                </div>
                {previewBurn!==null && (
                  <div style={{marginTop:10,padding:"11px 14px",background:"#e8faf2",borderRadius:12,fontSize:13,color:"#00c471",fontWeight:600}}>예상 소모 칼로리: {previewBurn.toLocaleString()} kcal</div>
                )}
                <button className="btn-primary" style={{marginTop:14}} onClick={addExercise} disabled={!exerciseInput.name||!exerciseInput.minutes}>추가하기</button>
                {todayLog.exercises.length>0 && (
                  <div style={{marginTop:20}}>
                    <div style={{fontSize:12,color:"#8b95a1",fontWeight:600,marginBottom:2}}>오늘 운동</div>
                    {todayLog.exercises.map((e,i)=>(
                      <div key={i} className="list-item">
                        <div style={{width:36,height:36,borderRadius:11,background:"#e8faf2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,marginRight:12,flexShrink:0}}>🏃</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:15,fontWeight:600,color:"#191f28"}}>{e.name}</div>
                          <div style={{fontSize:12,color:"#8b95a1",marginTop:2}}>{e.minutes}분 · {e.time}</div>
                        </div>
                        <div style={{fontSize:15,fontWeight:700,color:"#00c471",marginLeft:8,flexShrink:0}}>−{e.kcal.toLocaleString()} kcal</div>
                        <button className="remove-btn" onClick={()=>removeExercise(i)}>×</button>
                      </div>
                    ))}
                    <div style={{paddingTop:14,display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700,color:"#191f28"}}>
                      <span>합계 소모</span><span style={{color:"#00c471"}}>−{totalBurn.toLocaleString()} kcal</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── 기록 탭 ── */}
        {tab==="history" && (()=>{
          const currentMonth = today.slice(0,7); // "2026-05"

          // 로그에서 월 목록 추출 (최신순)
          const allMonths = [...new Set(Object.keys(logs).map(d=>d.slice(0,7)))]
            .sort((a,b)=>b.localeCompare(a));

          if (allMonths.length === 0) return (
            <div className="card" style={{textAlign:"center",padding:"40px 24px",color:"#c9d4e0",fontSize:14}}>
              아직 기록이 없어요<br/>
              <span style={{fontSize:12,marginTop:6,display:"block"}}>음식과 운동을 기록하면 여기에 표시돼요</span>
            </div>
          );

          return (
            <div>
              {allMonths.map(month => {
                const [y, m] = month.split("-");
                const isCurrentMonth = month === currentMonth;

                // 해당 월의 모든 날짜 로그
                const monthDays = Object.entries(logs)
                  .filter(([d]) => d.startsWith(month))
                  .sort(([a],[b]) => b.localeCompare(a)); // 최신일 먼저

                if (monthDays.length === 0) return null;

                // 월 합계
                const monthTotalFood = monthDays.reduce((s,[,log])=>s+log.foods.reduce((a,f)=>a+f.kcal,0),0);
                const monthTotalBurn = monthDays.reduce((s,[,log])=>s+log.exercises.reduce((a,e)=>a+e.kcal,0),0);
                const monthNet = monthTotalFood - monthTotalBurn;
                // 월별 고유 음식 목록 (중복 제거, 상위 3개)
                const allFoods = monthDays.flatMap(([,log])=>log.foods);
                const allExercises = monthDays.flatMap(([,log])=>log.exercises);

                return (
                  <div key={month} className="card" style={{marginBottom:12}}>
                    {/* 월 헤더 */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                      <div>
                        <div style={{fontSize:16,fontWeight:800,color:"#191f28",letterSpacing:"-0.3px"}}>
                          {y}년 {m}월
                          {isCurrentMonth && <span style={{marginLeft:8,fontSize:11,fontWeight:700,color:"#3182f6",background:"#f0f5ff",padding:"2px 8px",borderRadius:20}}>이번 달</span>}
                        </div>
                        <div style={{fontSize:12,color:"#8b95a1",marginTop:2}}>{monthDays.length}일 기록</div>
                      </div>
                      {/* 월 합계 요약 */}
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:12,color:"#8b95a1"}}>섭취 {monthTotalFood.toLocaleString()} · 소모 {monthTotalBurn.toLocaleString()}</div>
                        <div style={{fontSize:15,fontWeight:800,color:monthNet<=monthDays.length*tdee?"#00c471":"#f04452",marginTop:2,letterSpacing:"-0.3px"}}>
                          순 {monthNet.toLocaleString()} kcal
                        </div>
                      </div>
                    </div>

                    {/* 이번 달: 일별 상세 */}
                    {isCurrentMonth ? (
                      <div>
                        {monthDays.map(([dateStr, log], i) => {
                          const food = log.foods.reduce((s,f)=>s+f.kcal,0);
                          const burn = log.exercises.reduce((s,e)=>s+e.kcal,0);
                          const net = food - burn;
                          const isToday = dateStr === today;
                          return (
                            <div key={dateStr} style={{borderTop:"1px solid #f2f4f6",paddingTop:12,marginTop:12}}>
                              {/* 날짜 행 */}
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                                <div style={{display:"flex",alignItems:"center",gap:6}}>
                                  <span style={{fontSize:13,fontWeight:700,color:"#191f28"}}>{dateStr.slice(5).replace("-","/")} {["일","월","화","수","목","금","토"][new Date(dateStr).getDay()]}</span>
                                  {isToday && <span style={{fontSize:10,fontWeight:700,color:"#3182f6",background:"#f0f5ff",padding:"1px 7px",borderRadius:10}}>오늘</span>}
                                </div>
                                <span style={{fontSize:13,fontWeight:700,color:net<=tdee?"#00c471":"#f04452"}}>순 {net.toLocaleString()} kcal</span>
                              </div>
                              {/* 음식 목록 */}
                              {log.foods.length > 0 && (
                                <div style={{marginBottom:6}}>
                                  {log.foods.map((f,fi)=>(
                                    <div key={fi} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 10px",background:"#f8f9fa",borderRadius:8,marginBottom:3}}>
                                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                                        <span style={{fontSize:13}}>🍽</span>
                                        <span style={{fontSize:13,color:"#4e5968"}}>{f.name}</span>
                                        {f.time && <span style={{fontSize:11,color:"#c9d4e0"}}>{f.time}</span>}
                                      </div>
                                      <span style={{fontSize:13,fontWeight:600,color:"#3182f6"}}>{f.kcal.toLocaleString()} kcal</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* 운동 목록 */}
                              {log.exercises.length > 0 && (
                                <div>
                                  {log.exercises.map((e,ei)=>(
                                    <div key={ei} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 10px",background:"#f0faf5",borderRadius:8,marginBottom:3}}>
                                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                                        <span style={{fontSize:13}}>🏃</span>
                                        <span style={{fontSize:13,color:"#4e5968"}}>{e.name} {e.minutes}분</span>
                                        {e.time && <span style={{fontSize:11,color:"#c9d4e0"}}>{e.time}</span>}
                                      </div>
                                      <span style={{fontSize:13,fontWeight:600,color:"#00c471"}}>−{e.kcal.toLocaleString()} kcal</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* 지난 달: 합계 요약만 */
                      <div style={{borderTop:"1px solid #f2f4f6",paddingTop:14}}>
                        {/* 통계 3개 */}
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                          {[
                            {label:"총 섭취",value:monthTotalFood,color:"#3182f6",icon:"🍽"},
                            {label:"총 소모",value:monthTotalBurn,color:"#00c471",icon:"🔥"},
                            {label:"기록일수",value:monthDays.length,color:"#8b95a1",icon:"📅",unit:"일"},
                          ].map((s,i)=>(
                            <div key={i} style={{background:"#f8f9fa",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                              <div style={{fontSize:11,color:"#8b95a1",marginBottom:3}}>{s.icon} {s.label}</div>
                              <div style={{fontSize:16,fontWeight:800,color:s.color,letterSpacing:"-0.5px"}}>{s.value.toLocaleString()}</div>
                              <div style={{fontSize:10,color:"#c9d4e0"}}>{s.unit||"kcal"}</div>
                            </div>
                          ))}
                        </div>
                        {/* 많이 먹은 음식 TOP3 */}
                        {allFoods.length > 0 && (()=>{
                          const foodMap = {};
                          allFoods.forEach(f=>{ foodMap[f.name]=(foodMap[f.name]||0)+f.kcal; });
                          const top3 = Object.entries(foodMap).sort((a,b)=>b[1]-a[1]).slice(0,3);
                          return (
                            <div style={{marginBottom:10}}>
                              <div style={{fontSize:11,color:"#8b95a1",fontWeight:600,marginBottom:6}}>🍽 많이 먹은 음식</div>
                              {top3.map(([name,kcal],i)=>(
                                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 10px",background:"#f8f9fa",borderRadius:8,marginBottom:3}}>
                                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                                    <span style={{fontSize:11,color:"#c9d4e0",fontWeight:700}}>#{i+1}</span>
                                    <span style={{fontSize:13,color:"#4e5968"}}>{name}</span>
                                  </div>
                                  <span style={{fontSize:13,fontWeight:600,color:"#3182f6"}}>{kcal.toLocaleString()} kcal</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        {/* 많이 한 운동 TOP3 */}
                        {allExercises.length > 0 && (()=>{
                          const exMap = {};
                          allExercises.forEach(e=>{ exMap[e.name]=(exMap[e.name]||0)+e.kcal; });
                          const top3 = Object.entries(exMap).sort((a,b)=>b[1]-a[1]).slice(0,3);
                          return (
                            <div>
                              <div style={{fontSize:11,color:"#8b95a1",fontWeight:600,marginBottom:6}}>🏃 많이 한 운동</div>
                              {top3.map(([name,kcal],i)=>(
                                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 10px",background:"#f0faf5",borderRadius:8,marginBottom:3}}>
                                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                                    <span style={{fontSize:11,color:"#c9d4e0",fontWeight:700}}>#{i+1}</span>
                                    <span style={{fontSize:13,color:"#4e5968"}}>{name}</span>
                                  </div>
                                  <span style={{fontSize:13,fontWeight:600,color:"#00c471"}}>−{kcal.toLocaleString()} kcal</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ── 추이 탭 ── */}
        {tab==="trend" && (
          <>
            {/* 목표 설정 카드 */}
            <div className="card" style={{marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                <div style={{width:40,height:40,borderRadius:12,background:"#fff8ee",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🎯</div>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#191f28"}}>월별 감량 목표</div>
                  <div style={{fontSize:12,color:"#8b95a1",marginTop:1}}>목표 달성 시 그래프에 반영돼요</div>
                </div>
              </div>

              {/* 목표 추가 */}
              <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"flex-end"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:"#8b95a1",marginBottom:6,fontWeight:500}}>목표 월</div>
                  <input className="input-field" type="month" value={goalInput.month} min={today.slice(0,7)}
                    onChange={e=>setGoalInput(p=>({...p,month:e.target.value}))}
                    style={{fontSize:14}}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:"#8b95a1",marginBottom:6,fontWeight:500}}>목표 감량 (kg)</div>
                  <input className="input-field" type="number" step="0.1" min="0.1" max="10" placeholder="예: 2.0"
                    value={goalInput.targetKg} onChange={e=>setGoalInput(p=>({...p,targetKg:e.target.value}))}/>
                </div>
                <button onClick={addGoal} disabled={!goalInput.month||!goalInput.targetKg}
                  style={{background:"#3182f6",border:"none",borderRadius:12,padding:"13px 16px",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",flexShrink:0,alignSelf:"flex-end",opacity:(!goalInput.month||!goalInput.targetKg)?0.4:1}}>
                  추가
                </button>
              </div>

              {/* 목표 목록 */}
              {goals.length > 0 ? (
                <div>
                  {goals.map(g=>{
                    const [y,m] = g.month.split("-");
                    return (
                      <div key={g.month} className="goal-row">
                        <div style={{width:36,height:36,borderRadius:10,background:"#fff8ee",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>📅</div>
                        <div style={{flex:1,marginLeft:10}}>
                          <div style={{fontSize:14,fontWeight:600,color:"#191f28"}}>{y}년 {m}월</div>
                          <div style={{fontSize:12,color:"#8b95a1",marginTop:2}}>이 달 목표 감량</div>
                        </div>
                        <div style={{fontSize:16,fontWeight:800,color:"#f04452",marginRight:4}}>−{g.targetKg} kg</div>
                        <button className="remove-btn" onClick={()=>removeGoal(g.month)}>×</button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{textAlign:"center",padding:"12px 0",fontSize:13,color:"#c9d4e0"}}>
                  목표를 추가하면 그래프에 목표선이 표시돼요
                </div>
              )}
            </div>

            {/* 체중 추이 그래프 카드 */}
            <div className="card">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#191f28"}}>체중 추이</div>
                  <div style={{fontSize:12,color:"#8b95a1",marginTop:2}}>
                    {profileSaved ? `기준 체중 ${profile.weight}kg` : "프로필을 먼저 저장해주세요"}
                  </div>
                </div>
                {/* 기간 선택 */}
                <div style={{display:"flex",gap:4}}>
                  {[["30","30일"],["90","90일"],["180","180일"]].map(([v,l])=>(
                    <button key={v} className={`btn-sm${chartRange===v?" active":""}`} onClick={()=>setChartRange(v)}
                      style={{padding:"6px 12px",fontSize:12}}>{l}</button>
                  ))}
                </div>
              </div>

              {!profileSaved ? (
                <div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center",color:"#c9d4e0",fontSize:13}}>
                  프로필을 저장하면 그래프가 표시돼요
                </div>
              ) : (
                <>
                  {/* 레전드 */}
                  <div style={{display:"flex",gap:16,marginBottom:16,flexWrap:"wrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#3182f6" strokeWidth="2.5" strokeDasharray="none"/></svg>
                      <span style={{fontSize:12,color:"#4e5968"}}>실제 추이 (기록 기반)</span>
                    </div>
                    {goals.length>0 && (
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#ff9500" strokeWidth="2" strokeDasharray="5,3"/></svg>
                        <span style={{fontSize:12,color:"#4e5968"}}>목표 체중</span>
                      </div>
                    )}
                  </div>

                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData} margin={{top:4,right:8,left:-10,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f3" vertical={false}/>
                      <XAxis
                        dataKey="date"
                        tick={{fontSize:10,fill:"#8b95a1"}}
                        interval={xInterval}
                        axisLine={false}
                        tickLine={false}
                        dy={6}
                      />
                      <YAxis
                        domain={[minW, maxW]}
                        tick={{fontSize:10,fill:"#8b95a1"}}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v=>`${v}kg`}
                        width={46}
                      />
                      <Tooltip content={<ChartTooltip/>}/>
                      {/* 오늘 기준선 */}
                      <ReferenceLine
                        x={fmtDate(today)}
                        stroke="#c9d4e0"
                        strokeDasharray="4 2"
                        label={{value:"오늘",position:"top",fontSize:10,fill:"#8b95a1"}}
                      />
                      {/* 실제 추이선 */}
                      <Line
                        type="monotone"
                        dataKey="actual"
                        name="실제 추이"
                        stroke="#3182f6"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{r:5,fill:"#3182f6",stroke:"#fff",strokeWidth:2}}
                        connectNulls={false}
                      />
                      {/* 목표선 */}
                      {goals.length>0 && (
                        <Line
                          type="monotone"
                          dataKey="goal"
                          name="목표 체중"
                          stroke="#ff9500"
                          strokeWidth={2}
                          strokeDasharray="6 3"
                          dot={false}
                          activeDot={{r:5,fill:"#ff9500",stroke:"#fff",strokeWidth:2}}
                          connectNulls={true}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>

                  {/* 요약 인사이트 */}
                  <div style={{marginTop:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom: goals.length > 0 ? 16 : 0}}>
                    <div className="stat-chip">
                      <div style={{fontSize:11,color:"#8b95a1",marginBottom:4}}>현재 체중 (기준)</div>
                      <div style={{fontSize:20,fontWeight:800,color:"#191f28",letterSpacing:"-0.5px"}}>{profile.weight}<span style={{fontSize:13,fontWeight:500,marginLeft:2}}>kg</span></div>
                    </div>
                    {goals.length>0 && (()=>{
                      const totalTarget = goals.reduce((s,g)=>s+g.targetKg,0);
                      const targetWeight = +profile.weight - totalTarget;
                      return (
                        <div className="stat-chip">
                          <div style={{fontSize:11,color:"#8b95a1",marginBottom:4}}>최종 목표 체중</div>
                          <div style={{fontSize:20,fontWeight:800,color:"#f04452",letterSpacing:"-0.5px"}}>
                            {targetWeight.toFixed(1)}<span style={{fontSize:13,fontWeight:500,marginLeft:2}}>kg</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 목표별 하루 필요 칼로리 */}
                  {goals.length > 0 && (()=>{
                    const items = goals.map((g, gi) => {
                      const [y, m] = g.month.split("-").map(Number);
                      // 해당 월 마지막 날 (자정 기준으로 맞춤)
                      const monthEnd = new Date(y, m, 0);          // e.g. 2026-05-31
                      const todayMidnight = new Date(today + "T00:00:00");
                      const daysLeft = Math.max(1, Math.round((monthEnd - todayMidnight) / 86400000) + 1);
                      // 이전 목표 누적 감량
                      const prevKg = goals.slice(0, gi).reduce((s, pg) => s + (+pg.targetKg), 0);
                      const startWeight = +profile.weight - prevKg;
                      const targetWeight = startWeight - (+g.targetKg);
                      // 필요 총 칼로리 적자 (숫자 강제 변환)
                      const totalDeficitNeeded = (+g.targetKg) * 7700;
                      // 하루 필요 적자
                      const dailyDeficit = Math.round(totalDeficitNeeded / daysLeft);
                      // 하루 목표 섭취량 = TDEE - 하루 필요 적자
                      const allowedKcal = Math.round(tdee - dailyDeficit);
                      const isAchievable = allowedKcal >= Math.round(bmr);
                      const isPast = monthEnd < todayMidnight;

                      return { g, y, m, daysLeft, startWeight, targetWeight, dailyDeficit, allowedKcal, isAchievable, isPast };
                    });

                    return (
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:"#191f28",marginBottom:10}}>🔥 목표 달성 플랜</div>
                        {items.map(({ g, y, m, daysLeft, startWeight, targetWeight, dailyDeficit, allowedKcal, isAchievable, isPast }) => {
                          const statusColor = isPast ? "#c9d4e0" : isAchievable ? "#00c471" : "#f04452";
                          const statusBg   = isPast ? "#f8f9fa"  : isAchievable ? "#e8faf2"  : "#fff0f1";
                          const statusLabel = isPast ? "기간 종료" : isAchievable ? "달성 가능" : "과도한 목표";
                          return (
                            <div key={g.month} style={{background:statusBg,borderRadius:16,padding:"16px",marginBottom:10,border:`1.5px solid ${statusColor}22`}}>
                              {/* 헤더 */}
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                                <div>
                                  <span style={{fontSize:15,fontWeight:700,color:"#191f28"}}>{y}년 {m}월 목표</span>
                                  <span style={{marginLeft:8,fontSize:12,color:"#8b95a1"}}>{startWeight.toFixed(1)} → {targetWeight.toFixed(1)} kg</span>
                                </div>
                                <span style={{fontSize:11,fontWeight:700,color:statusColor,background:"#fff",padding:"3px 10px",borderRadius:20,border:`1px solid ${statusColor}44`}}>
                                  {statusLabel}
                                </span>
                              </div>

                              {/* 핵심 수치 2개 — 하루 목표 섭취량 강조 */}
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                                <div style={{background:"#fff",borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
                                  <div style={{fontSize:10,color:"#8b95a1",marginBottom:3}}>남은 일수</div>
                                  <div style={{fontSize:22,fontWeight:800,color:"#191f28",letterSpacing:"-0.5px"}}>{isPast ? "−" : daysLeft}</div>
                                  <div style={{fontSize:10,color:"#c9d4e0"}}>일</div>
                                </div>
                                <div style={{background: isPast?"#f8f9fa": isAchievable?"#f0f5ff":"#fff0f1", borderRadius:12,padding:"12px 8px",textAlign:"center",border:`1.5px solid ${isPast?"#f0f1f3":isAchievable?"#3182f620":"#f0445220"}`}}>
                                  <div style={{fontSize:10,color:"#8b95a1",marginBottom:3}}>하루 목표 섭취량</div>
                                  <div style={{fontSize:22,fontWeight:800,color:isPast?"#c9d4e0":isAchievable?"#3182f6":"#f04452",letterSpacing:"-0.5px"}}>{isPast ? "−" : allowedKcal.toLocaleString()}</div>
                                  <div style={{fontSize:10,color:"#c9d4e0"}}>kcal/일</div>
                                </div>
                              </div>

                              {/* 안내 메시지 */}
                              {!isPast && (
                                <div style={{fontSize:12,color:isAchievable?"#4e5968":"#f04452",lineHeight:1.7,padding:"10px 14px",background:"#fff",borderRadius:12}}>
                                  {isAchievable ? (
                                    <>
                                      하루 <b style={{color:"#3182f6"}}>{allowedKcal.toLocaleString()} kcal</b> 이내로 먹으면 {m}월 말까지 <b>{(+g.targetKg).toFixed(1)} kg</b> 감량할 수 있어요.<br/>
                                      <span style={{color:"#8b95a1",fontSize:11}}>운동으로 소모한 칼로리만큼 더 먹어도 괜찮아요.</span>
                                    </>
                                  ) : (
                                    <>
                                      목표를 달성하려면 하루 <b>{allowedKcal.toLocaleString()} kcal</b>만 먹어야 하는데,<br/>
                                      기초대사량 <b>{Math.round(bmr).toLocaleString()} kcal</b>보다 낮아서 건강에 위험해요.<br/>
                                      <span style={{fontSize:11}}>목표 감량을 줄이거나 다음 달로 나눠서 설정해보세요.</span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {chartData.filter(d=>d.actual!=null).length === 0 && (
                    <div style={{marginTop:12,padding:"10px 14px",background:"#f8f9fa",borderRadius:12,fontSize:12,color:"#8b95a1",textAlign:"center"}}>
                      음식/운동을 기록하면 실제 추이선이 표시돼요
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        <p style={{textAlign:"center",fontSize:11,color:"#c9d4e0",marginTop:16,lineHeight:1.8}}>
          칼로리 정보는 AI 추정값으로 참고용이에요<br/>1kg 지방 ≈ 7,700 kcal 기준
        </p>
      </div>
    </div>
  );
}
