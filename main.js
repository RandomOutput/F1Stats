console.log("go");
var page = d3.select("body");

async function MakeChart() {

  var circuits = await d3.csv("data/circuits.csv"); //circuitId,circuitRef,name,location,country,lat,lng,alt,url

  var circuitMap = circuits.reduce(function(map, circuit) {
    map[circuit.circuitId] = circuit;
    return map;
  }, {});

  var drivers = await d3.csv("data/driver.csv"); // driverId, driverRef, number , code, forename, surname, dob, nationality, url

  var driverMap = drivers.reduce(function(map, driver) {
    map[driver.driverId] = driver;
    return map;
  }, {});

  console.log("loaded drivers: " + drivers.length);

  var races = await d3.csv("data/races.csv", function(d) {
    dateComponents = d.date.split("/");
    d.date = new Date(dateComponents[2], dateComponents[0], dateComponents[1]);
    d.circuit = circuitMap[d.circuitId];
    return d;
  });
  
  console.log("loaded races: " + races.length);

  var raceMap = races.reduce(function(map, race) {
    map[race.raceId] = race;
    return map;
  }, {});
  
  var lapTimes = await d3.csv("data/lap_times.csv", function(d) {
    return {
      race: raceMap[d.raceId],
      driver: driverMap[d.driverId],
      lap: d.lap,
      position: d.position,
      seconds: +d.milliseconds / 1000.0
    }
  });

  var filteredTimes = lapTimes.filter(d => d.race.date.getFullYear() >= 2015);

  var yearsData = Array.from(filteredTimes.reduce(function(set, lap) {
    set.add(lap.race.date.getFullYear());
    return set;
  }, new Set()));

  var maxYear = d3.max(yearsData);
  var minYear = d3.min(yearsData);

  var raceData = d3.nest()
    .key(d => d.race.circuit.circuitId)
    .key(d => d.driver.driverId)
    .key(d => d.race.date.getFullYear())
    .sortValues(function(a,b) { return +a.lap < +b.lap ? -1 : a > b ? 1 : a >= b ? 0 : NaN; })
    .entries(filteredTimes);
  
  var maxLapCount = d3.nest()
    .key(d => +d.race.circuit.circuitId)
    .rollup(d => d3.max(d, row => +row.lap))
    .map(filteredTimes);

  var maxLapTimes = d3.nest()
    .key(d => +d.race.circuit.circuitId)
    .rollup(d => d3.max(d, lap => +lap.seconds))
    .map(filteredTimes);

  var minLapTimes = d3.nest()
    .key(d => +d.race.circuit.circuitId)
    .rollup(d => d3.min(d, lap => +lap.seconds))
    .map(filteredTimes);
  
  console.log("loaded laps: " + lapTimes.length);
  console.log(lapTimes[0]);
  var circuitsHeaders = page.selectAll(".race")
    .data(raceData, d => d.key)
    .join("div")
      .attr("class", "race")

  circuitsHeaders
    .append("h1")
      .text(d => circuitMap[d.key].name);


  var svgOuterWidth = 350;
  var svgOuterHeight = 350;

  var yAxisInset = 30.0;
  var xAxisInset = 0;
  var svgMargin = { left: 35, right: 20, top: 20, bottom: 35 }

  var svgWidth = svgOuterWidth - svgMargin.left - svgMargin.right;
  var svgHeight = svgOuterHeight - svgMargin.top - svgMargin.bottom;

  var minLapTime = d3.min(minLapTimes.values());
  var maxLapTime = d3.max(maxLapTimes.values());

  var yMap = d3.scaleLinear()
    .domain([minLapTime, maxLapTime * 0.1])
    .range([svgHeight, 0]);

  var yAxis = d3.axisLeft(yMap)
    .ticks(10);

  console.log("y domain: " + yMap.domain());

  var xMaps = circuits.reduce(function(map, circuit) {

    var maxLapsForCircuit = maxLapCount.get(circuit.circuitId);

    if(maxLapsForCircuit == undefined) {
      maxLapsForCircuit = 0;
    }

    map[circuit.circuitId] = d3.scaleLinear()
    .domain([0, maxLapsForCircuit])  
    .range([0, svgWidth]);
    return map;
  }, {});

  var xAxis = circuits.reduce(function(map, circuit) {
    map[circuit.circuitId] = d3.axisBottom(xMaps[circuit.circuitId])
      .ticks(10);
    return map;
  }, {});

  var yearCount = maxYear - minYear;

  var colorMap = d3.scaleLinear(colorScheme(yearCount))
    .domain([minYear, maxYear]);

  var weightMap = d3.scaleLinear()
    .domain([minYear, maxYear])
    .range([1, 1]);

  var drivers = circuitsHeaders.selectAll(".drivers")
    .data(d => d.values)
    .join("svg")
      .attr("class", "drivers")
      .attr("width", svgOuterWidth)
      .attr("height", svgOuterHeight);

  drivers
    .append("rect")
      .attr("width", "100%")
      .attr("height", "100%");
      
  drivers
    .append("text")
      .attr("x", 10 + svgMargin.left)
      .attr("y", 10)
      .attr("dy", "0.35em")
      .text(d => driverMap[d.key].forename + " " + driverMap[d.key].surname);

  drivers
    .append("g")
      .attr("transform", "translate(" + yAxisInset + ", " + svgMargin.top + ")")
      .attr("class", "y axis")
      .call(yAxis)
      .append("text")
        .attr("class", "label")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .text("Seconds Per Lap");

  circuitsHeaders.each(function(p,j) {
    d3.select(this)
    .selectAll(".drivers")
      .append("g")
        .attr("transform", "translate(" + svgMargin.left + ", " + (svgOuterHeight - svgMargin.bottom + xAxisInset) + ")")
        .attr("class", "x axis")
        .call(xAxis[p.key])
        .append("text")
          .attr("class", "label")
          .attr("y", -6)
          .attr("x", svgWidth)
          .style("text-anchor", "end")
          .text("Lap Number");
    });
    
 var years = drivers.selectAll(".yearGrop")
    .data(d => d.values)
    .join("g")
      .attr("transform", "translate(" + svgMargin.left + ", " + svgMargin.top + ")")
      .attr("class", "yearGroup");
  
  var lineFunc = d3.line()
      .x(d => xMaps[d.race.circuitId](d.lap))
      .y(d => yMap(d.seconds));

  years
    .append("path")
    .attr("d", d => lineFunc(d.values))
      .attr("stroke", d => colorMap(+d.key))
      .attr("stroke-width", d => weightMap(+d.key))
      .attr("fill", "none");

  var legendWidth = 100;
  var legendHeight = 30;
  var legend = d3.select(".legend")
    .selectAll("div")
    .data(yearsData)
    .join("div")
      .attr("class", "legendLine");

  legend
    .append("div")
    .attr("class", "legendLabel")
    .text(d => d)
  
  legend 
    .append("svg")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .append("path")
        .attr("d", "M0 " + legendHeight / 2.0 + "L" + legendWidth + " " + legendHeight / 2.0)
        .attr("stroke", d => colorMap(+d))
        .attr("stroke-width", d => weightMap(+d));

  console.log("done");
}

MakeChart();

var colorScheme = function(i) {
  var colors = ["#41bbc5", "#fa7922", "#42b43c", "#e4bfab", "#b2d27a", "#d1911b"];
  i = Math.max(i,1);
  i = Math.min(colors.length, i);
  return colors.slice(0,i-1);
}