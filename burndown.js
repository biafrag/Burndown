(function(){
  function run() {
    console.log("burndown.js carregado!");

    const GROUP_ID=457,
          HOST="https://git.tecgraf.puc-rio.br/api/v4/",
          holidays=["19/06/2025","20/06/2025", "07/07/2025", "07/09/2025", "12/10/2025", "15/10/2025", 
		  "02/11/2025", "15/11/2025", "20/11/2025","08/12/2025", "24/12/2015", "25/12/2025", "26/12/2025", "31/12/2025", "01/01/2026", "02/01/2026"];

    function initChartJs(cb){
      if(typeof Chart==="undefined"){
        const s=document.createElement("script");
        s.src="https://cdn.jsdelivr.net/npm/chart.js";
        s.onload = cb;
        document.body.appendChild(s);
      } else {
        cb();
      }
    }

    function getCurrentDate(){
      const d=new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    }

    function fetchIssues(t,c){
      const u=encodeURI(`${HOST}/groups/${GROUP_ID}/issues?milestone=${t}&per_page=100`);
      fetch(new Request(u,{method:"GET"}))
        .then(async r=>{
          if(r.status!==200) throw new Error("Erro: "+r.status);
          c(await r.json());
        }).catch(console.error);
    }

    function fetchMilestones(cb){
      const u=`${HOST}/groups/${GROUP_ID}/milestones?state=active`;
      fetch(new Request(u,{method:"GET"}))
        .then(async r=>{
          if(r.status!==200) throw new Error("Erro: "+r.status);
          let m=await r.json(),today=getCurrentDate();
          cb(m.filter(x=>x.start_date<=today).reverse());
        }).catch(console.error);
    }

    function DrawBurndownDOM(t){
      let c=document.querySelector("#burndownContainer");
      if(!c){
        const p=document.querySelector(".content-wrapper");
        c=document.createElement("div");
        c.id="burndownContainer";
        c.style="display:flex;flex-direction:column;border-bottom:1px solid #404040;padding-bottom:10px";
        c.classList.add("container-fluid","container-limited","project-highlight-puc");
        const h=document.createElement("h3"),a=document.createElement("div");
        c.append(h,a);
        p.prepend(c);
      }
      c.querySelector("h3").innerText=t;
    }

    function DrawErrorDOM(t){
      const a=document.querySelector("#burndownContainer div");
      a.innerHTML="";
      const p=document.createElement("p");
      p.innerText=t;
      a.append(p);
    }

    function DrawMilestoneSelector(ms){
      const a=document.querySelector("#burndownContainer div");
      a.innerHTML="";
      const g=document.createElement("div");
      g.classList.add("form-group");
      const s=document.createElement("select");
      s.classList.add("custom-select");
      s.id="slcMilestone";
      const o=document.createElement("option");
      o.value=0;
      o.innerHTML="Select a milestone";
      o.selected=true;
      s.append(o);
      ms.forEach(m=>{
        const o=document.createElement("option");
        o.value=m.title;
        o.innerHTML=m.title;
        s.append(o);
      });
      s.addEventListener("change",onSelectMilestone);
      g.append(s);
      a.append(g);
    }

    function formatDate(d){
      return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
    }

    function getDateWithoutTime(d=new Date()){
      return new Date(d.getFullYear(),d.getMonth(),d.getDate());
    }

    function getDatesBetween(start,due){
      const ds=[];
      while(due - start > 0){
        const f=formatDate(start),
              w = start.getDay() === 0 || start.getDay() === 6,
              h = holidays.includes(f);
        if(!w && !h) ds.push(new Date(start));
        start.setDate(start.getDate() + 1);
      }
      const fd=formatDate(due);
      if(due.getDay() !== 0 && due.getDay() !== 6 && !holidays.includes(fd)) ds.push(due);
      return ds;
    }

    function onSelectMilestone(e){
      const m=e.target.value;
      if(m !== 0 && m !== "0") {
        fetchIssues(m, issues => {
          if(issues.length === 0) return DrawErrorDOM("No issues associated with this milestone");
          const ms = issues[0].milestone;
          DrawBurndownDOM("Burndown: " + ms.title);
          const s = new Date(ms.start_date);
          const d = new Date(ms.due_date);
          s.setMinutes(s.getMinutes() + s.getTimezoneOffset());
          d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
          drawChartDOM(issues, s, d);
        });
      }
    }

    async function drawChartDOM(issues, start, due){
      const a=document.querySelector("#burndownContainer div");
      a.innerHTML="";
      a.style.height="300px";
      const c=document.createElement("canvas");
      c.id="BurndownChart";
      c.height=300;
      const ctx=c.getContext("2d");
      const range=getDatesBetween(start,due);
      const labels=range.map(d=>formatDate(d));
      const total=issues.map(i=>i.time_stats?.time_estimate||0).reduce((a,b)=>a+b,0)/3600;
      if(total===0) return DrawErrorDOM("No estimated time associated with issues");
      const gap=total/(labels.length-1);
      const ideal=[];
      const todo=[];
      const today=getDateWithoutTime();
      let sum=total;
      ideal.push(total);
      while(sum>0){
        sum-=gap;
        ideal.push(Math.abs(Math.round(sum*100)/100));
      }
      const spent={};
      issues.forEach(i=>{
        if(i.closed_at){
          const f=formatDate(new Date(i.closed_at));
          spent[f]=(spent[f]||0)+(i.time_stats?.time_estimate||0);
        }
      });
      for(const k in spent) spent[k]/=3600;
      today.setDate(today.getDate()+1);
      sum=total;
      range.forEach(d=>{
        const f=formatDate(d);
        if(spent[f]) sum-=spent[f];
        todo.push(d<today?sum:null);
      });
      new Chart(ctx,{
        type:"line",
        data:{
          labels:[null,...labels,null],
          datasets:[
            {label:"Ideal Line",data:[null,...ideal,null],fill:true,borderColor:"rgb(75,192,192)"},
            {label:"Remaining To Do",data:[null,...todo,null],fill:true,borderColor:"rgb(175,35,56)",pointStyle:"rect"}
          ]
        },
        options:{
          scales:{
            x:{title:{display:true,text:"Date"}},
            y:{beginAtZero:true,suggestedMax:total,title:{display:true,text:"Remaining Hours"}}
          },
          responsive:true,
          maintainAspectRatio:false,
          resizeDelay:200
        }
      });
      a.append(c);
    }

    function showMilestoneSelector(){
      initChartJs(()=>{
        fetchMilestones(ms=>{
          DrawBurndownDOM("Burndown: Select Milestone");
          if(ms.length===0) DrawErrorDOM("No active milestones found");
          else DrawMilestoneSelector(ms);
        });
      });
    }

    showMilestoneSelector();
  }

  if(document.readyState==="complete" || document.readyState==="interactive"){
    run();
  } else {
    document.addEventListener("DOMContentLoaded", run);
  }
})();
