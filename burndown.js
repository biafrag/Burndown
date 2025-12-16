(function(){
  function run() {
    console.log("burndown.js carregado!");

    const GROUP_ID = 457,
          HOST = "https://git.tecgraf.puc-rio.br/api/v4/",
          holidays = ["24/12/2025", "25/12/2025", "26/12/2025", "31/12/2025", "01/01/2026", "02/01/2026"];

    const holidaysISO = new Set(
      holidays.map(h => {
        const [d,m,y] = h.split("/");
        return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
      })
    );

    function normalizeDate(d){
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function toISODate(d){
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    }

    function formatDate(d){
      return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
    }

    /* =========================
       Chart.js
    ========================= */

    function initChartJs(cb){
      if(typeof Chart==="undefined"){
        const s=document.createElement("script");
        s.src="https://cdn.jsdelivr.net/npm/chart.js";
        s.onload=cb;
        document.body.appendChild(s);
      } else cb();
    }

    /* =========================
       API
    ========================= */

    function fetchIssues(t,c){
      const u=encodeURI(`${HOST}/groups/${GROUP_ID}/issues?milestone=${t}&per_page=100`);
      fetch(u).then(r=>r.json()).then(c).catch(console.error);
    }

    function fetchMilestones(cb){
      fetch(`${HOST}/groups/${GROUP_ID}/milestones?state=active`)
        .then(r=>r.json())
        .then(m=>cb(m.reverse()))
        .catch(console.error);
    }

    /* =========================
       DATAS ÚTEIS (AQUI ERA O BUG)
    ========================= */

    function getDatesBetween(start, due){
      const ds=[];
      let cur = normalizeDate(start);
      const end = normalizeDate(due);

      while(cur <= end){
        const iso = toISODate(cur);
        const weekend = cur.getDay()===0 || cur.getDay()===6;
        const holiday = holidaysISO.has(iso);

        if(!weekend && !holiday){
          ds.push(new Date(cur));
        }
        cur.setDate(cur.getDate()+1);
      }
      return ds;
    }

    /* =========================
       UI
    ========================= */

    function DrawBurndownDOM(t){
      let c=document.querySelector("#burndownContainer");
      if(!c){
        const p=document.querySelector(".content-wrapper");
        c=document.createElement("div");
        c.id="burndownContainer";
        c.style="display:flex;flex-direction:column;border-bottom:1px solid #404040;padding-bottom:10px";
        c.classList.add("container-fluid","container-limited","project-highlight-puc");
        const h=document.createElement("h3"),a=document.createElement("div");
        a.style.height="300px";
        c.append(h,a);
        p.prepend(c);
      }
      c.querySelector("h3").innerText=t;
    }

    function DrawErrorDOM(t){
      const a=document.querySelector("#burndownContainer div");
      a.innerHTML=`<p>${t}</p>`;
    }

    function DrawMilestoneSelector(ms){
      const a=document.querySelector("#burndownContainer div");
      a.innerHTML="";
      const s=document.createElement("select");
      s.classList.add("custom-select");
      s.innerHTML=`<option value="">Select a milestone</option>`+
        ms.map(m=>`<option>${m.title}</option>`).join("");
      s.addEventListener("change",onSelectMilestone);
      a.append(s);
    }

    /* =========================
       BURNDOWN
    ========================= */

    function onSelectMilestone(e){
      if(!e.target.value) return;

      fetchIssues(e.target.value, issues=>{
        if(!issues.length) return DrawErrorDOM("No issues");
        const m = issues[0].milestone;

        const start = normalizeDate(new Date(m.start_date+"T00:00:00"));
        const due   = normalizeDate(new Date(m.due_date+"T00:00:00"));

        drawChartDOM(issues,start,due);
      });
    }

    function drawChartDOM(issues,start,due){
      const a=document.querySelector("#burndownContainer div");
      a.innerHTML="";
      const canvas=document.createElement("canvas");
      a.append(canvas);

      const range=getDatesBetween(start,due);
      console.log("Dias considerados:", range.map(toISODate));

      const labels=range.map(formatDate);
      const total=issues.reduce((s,i)=>s+(i.time_stats?.time_estimate||0),0)/3600;
      if(!total) return DrawErrorDOM("No estimates");

      const gap=total/(range.length-1);
      const ideal=range.map((_,i)=>Math.max(0,Math.round((total-gap*i)*100)/100));

      let remaining=total;
      const spent={};
      issues.forEach(i=>{
        if(i.closed_at){
          const iso=toISODate(normalizeDate(new Date(i.closed_at)));
          spent[iso]=(spent[iso]||0)+(i.time_stats?.time_estimate||0)/3600;
        }
      });

      const todo=range.map(d=>{
        const iso=toISODate(d);
        if(spent[iso]) remaining-=spent[iso];
        return Math.round(Math.max(0,remaining)*100)/100;
      });

      new Chart(canvas,{
        type:"line",
        data:{
          labels,
          datasets:[
            {label:"Ideal",data:ideal},
            {label:"Remaining",data:todo}
          ]
        },
        options:{responsive:true,maintainAspectRatio:false}
      });
    }

    function showMilestoneSelector(){
      initChartJs(()=>{
        fetchMilestones(ms=>{
          DrawBurndownDOM("Burndown: Select Milestone");
          DrawMilestoneSelector(ms);
        });
      });
    }

    showMilestoneSelector();
  }

  if(document.readyState!=="loading") run();
  else document.addEventListener("DOMContentLoaded",run);
})();
