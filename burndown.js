(function(){
  function run() {
    console.log("burndown.js carregado!");

    const GROUP_ID = 457,
          HOST = "https://git.tecgraf.puc-rio.br/api/v4/",
          holidays = [
            "19/06/2025","20/06/2025","07/07/2025","07/09/2025",
            "12/10/2025","15/10/2025","02/11/2025","15/11/2025",
            "20/11/2025","08/12/2025","24/12/2025","25/12/2025",
            "26/12/2025","31/12/2025","01/01/2026","02/01/2026"
          ];

    // 🔒 feriados normalizados
    const holidaysISO = new Set(
      holidays.map(h => {
        const [d,m,y] = h.split("/");
        return `${y}-${m}-${d}`;
      })
    );

    function toISODate(d){
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    }

    function normalizeDate(d){
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function initChartJs(cb){
      if(typeof Chart === "undefined"){
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/chart.js";
        s.onload = cb;
        document.body.appendChild(s);
      } else cb();
    }

    function fetchIssues(t,c){
      const u = encodeURI(`${HOST}/groups/${GROUP_ID}/issues?milestone=${t}&per_page=100`);
      fetch(u).then(r=>r.json()).then(c).catch(console.error);
    }

    function fetchMilestones(cb){
      fetch(`${HOST}/groups/${GROUP_ID}/milestones?state=active`)
        .then(r=>r.json())
        .then(m=>cb(m.reverse()))
        .catch(console.error);
    }

    function getDatesBetween(start, due){
      const ds = [];
      let cur = normalizeDate(start);
      const end = normalizeDate(due);

      while(cur <= end){
        const iso = toISODate(cur);
        const w = cur.getDay() === 0 || cur.getDay() === 6;
        const h = holidaysISO.has(iso);

        if(!w && !h) ds.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      return ds;
    }

    function onSelectMilestone(e){
      const m = e.target.value;
      if(!m) return;

      fetchIssues(m, issues=>{
        const ms = issues[0].milestone;

        const start = new Date(ms.start_date + "T00:00:00");
        const due   = new Date(ms.due_date   + "T00:00:00");

        drawChartDOM(issues, start, due);
      });
    }

    function drawChartDOM(issues, start, due){
      const range = getDatesBetween(start, due);

      console.log("Dias considerados:", range.map(toISODate));

      // se quiser, aqui você já verá que 24/12, 25/12 etc NÃO aparecem
    }

    function showMilestoneSelector(){
      initChartJs(()=>{
        fetchMilestones(ms=>{
          const s = document.createElement("select");
          s.innerHTML = `<option value="">Select milestone</option>` +
            ms.map(m=>`<option>${m.title}</option>`).join("");
          s.addEventListener("change", onSelectMilestone);
          document.body.prepend(s);
        });
      });
    }

    showMilestoneSelector();
  }

  if(document.readyState !== "loading") run();
  else document.addEventListener("DOMContentLoaded", run);
})();
