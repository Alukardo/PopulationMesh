// 获取地图容器尺寸
function getDimensions() {
  const container = document.querySelector('.map-container');
  if (container) {
    return {
      width: container.clientWidth,
      height: container.clientHeight
    };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight - 120 // 减去 header 和 footer
  };
}

let width = getDimensions().width;
let height = getDimensions().height;

const svg = d3.select("#world-map")
    .attr("width", width)
    .attr("height", height);

// 初始化投影
function createProjection(w, h) {
  return d3.geoMercator()
    .scale(Math.min(w, h) / 4.5)
    .translate([w / 2, h / 1.5]);
}

let projection = createProjection(width, height);

let path = d3.geoPath().projection(projection);

// 窗口大小调整处理
function handleResize() {
  const dims = getDimensions();
  width = dims.width;
  height = dims.height;

  d3.select("#world-map").attr("width", width).attr("height", height);

  projection = createProjection(width, height);
  path = d3.geoPath().projection(projection);

  // 重新绘制地图
  if (countryPaths) {
    countryPaths.attr("d", path);
  }
}

window.addEventListener("resize", handleResize);
const tooltip = d3.select("#tooltip");
const colorScale = d3.scaleSequential(d3.interpolateHcl("#f5e6c5", "#32430E"));
const backgroundColor = "#32430E"; // 背景色 (与 country 页面一致)

let currentView = 'country';
let selectedCountry = null;
let countryPaths = null;

// 从配置文件加载可用国家列表
let availableCountries = new Set();

async function loadAvailableCountries() {
  try {
    const response = await fetch('/data/countries-config.json');
    const config = await response.json();
    availableCountries = new Set(Object.keys(config.countries || {}));
    console.log('[INDEX] Available countries:', [...availableCountries]);
  } catch (err) {
    console.warn('[INDEX] Could not load countries config:', err);
    // 默认全部可用
    availableCountries = new Set(['USA', 'VEN', 'CHN', 'GBR', 'DEU', 'FRA', 'IND', 'RUS', 'AUS', 'CAN']);
  }
}

// 获取国家页面路径
function getCountryPagePath(cca3) {
  // 只有在配置文件中配置的国家才有详细页面
  if (availableCountries.has(cca3)) {
    return `./country.html?countryCode=${cca3}`;
  }
  return null;
}

// 启动时加载配置
loadAvailableCountries();

Promise.all([
  d3.json("/data/world.json"),
  d3.csv("/data/world_population.csv")
]).then(([geoData, popData]) => {

  const popMap = new Map();
  const continentMap = new Map();

  popData.forEach(d => {
    popMap.set(d.CCA3, d);
    if (!continentMap.has(d.Continent)) {
      continentMap.set(d.Continent, []);
    }
    continentMap.get(d.Continent).push(d.CCA3);
  });

  // 设置颜色范围到1.2B
  const maxPop = 1.2e9;
  colorScale.domain([0, maxPop]);


  // 绘制国家
  function getOriginalFill(d) {
    // Bermuda 使用背景色
    if (d.id === "BMU") {
      return backgroundColor;
    }
    const info = popMap.get(d.id);
    return info
        ? colorScale(+info["2022 Population"])
        : "#ccc";
  }
  const countries = svg.append("g")
      .selectAll("path")
      .data(geoData.features)
      .enter().append("path")
      .attr("d", path)
      .attr("fill", d => {
        // Bermuda 使用背景色
        if (d.id === "BMU") {
          return backgroundColor;
        }
        const info = popMap.get(d.id);
        return info ? colorScale(+info["2022 Population"]) : "#ccc";
      })
      .attr("stroke", "transparent")
      .attr("stroke-width", 0)
      .on("click", function(event, d) {
        const info = popMap.get(d.id);
        if (!info) return;

        // 获取国家代码
        const cca3 = d.id;
        const countryPagePath = getCountryPagePath(cca3);

        if (countryPagePath) {
          // 跳转到对应的国家页面
          window.location.href = countryPagePath;
        } else {
          // 如果没有对应的国家页面，显示提示信息
          const countryName = info["Country/Territory"] || cca3;
          alert(`抱歉，${countryName} 的详细页面尚未创建。`);
        }
      })
      .on("mouseover", function(event, d) {
        const info = popMap.get(d.id);
        if (info) {
          const countryName = info["Country/Territory"] || d.id;
          const population = info["2022 Population"] || "未知";
          const formattedPop = (+population).toLocaleString('zh-CN');

          // 获取鼠标相对于 map-container 的位置
          const container = document.querySelector('.map-container');
          const containerRect = container.getBoundingClientRect();
          const x = event.clientX - containerRect.left;
          const y = event.clientY - containerRect.top;

          // 偏移量，让 tooltip 靠近鼠标
          const offsetX = 15;
          const offsetY = 15;

          tooltip
            .html(`<strong>${countryName}</strong><br/>人口: ${formattedPop}`)
            .style("left", (x + offsetX) + "px")
            .style("top", (y + offsetY) + "px")
            .classed("hidden", false);
        }
      })
      .on("mouseout", function() {
        tooltip.classed("hidden", true);
      })
  countryPaths = countries;


}).catch(err => console.error(err));
